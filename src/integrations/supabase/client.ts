import { createClient } from "@supabase/supabase-js";
import { getApiUrl } from "@/lib/utils";
import type { Database } from "./types";

function cleanEnvValue(val: string | undefined): string | undefined {
  if (!val) return val;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

function createSupabaseClient() {
  const SUPABASE_URL = cleanEnvValue(
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined)
  );

  const SUPABASE_PUBLISHABLE_KEY = cleanEnvValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined)
  );

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Por favor, verifique as configurações no Vercel. Certifique-se de usar o prefixo VITE_ se estiver definindo variáveis para o frontend.`;
    console.error(`[Supabase] ${message}`);

    // LOG EXTRA
    console.log("[Supabase DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);

    // In production, we might want to still return a placeholder or handle this gracefully in UI
    if (import.meta.env.PROD) {
      // Return a dummy client that throws on actual use, to avoid crashing the whole app on load if we can show a better error state
      // But the proxy pattern below handles this
    }
    throw new Error(message);
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  // Intercept Supabase Edge Function invokes to route through our own server's full-stack API proxy.
  // This ensures reliability when direct Edge Functions on the active Supabase project are not deployed or fail.
  let realFunctionsInstance: any = null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(client), "functions");
    if (descriptor?.get) {
      realFunctionsInstance = descriptor.get.call(client);
    }
  } catch (e) {
    console.warn("[Supabase Proxy] Failed to get prototype functions descriptor:", e);
  }

  if (!realFunctionsInstance) {
    realFunctionsInstance = (client as any)._functions || (client as any).functions;
  }

  if (realFunctionsInstance) {
    const originalInvoke = realFunctionsInstance.invoke;

    const proxiedInvoke = async function (functionName: string, options?: any) {
      const isLocalOnly = true;

      try {
        const url = getApiUrl("/api/edge");
        console.log(
          `[Supabase Proxy] Intercepção de função: ${functionName} -> Redirecionando para API local: ${url}`,
        );

        let authHeader = "";
        try {
          const {
            data: { session },
          } = await client.auth.getSession();
          if (session?.access_token) {
            authHeader = `Bearer ${session.access_token}`;
          }
        } catch (e) {
          console.warn("[Supabase Proxy] Falha ao obter sessão de autenticação:", e);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authHeader) {
          headers["Authorization"] = authHeader;
        }

        let response;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: functionName,
              body: options?.body,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchErr) {
          console.warn(
            "[Supabase Proxy] Chamada principal falhou. Tentando URL alternativa...",
            fetchErr,
          );
          const fallbackUrl = url.includes(
            "ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app",
          )
            ? url.replace(
                "ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app",
                "ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app",
              )
            : url.replace(
                "ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app",
                "ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app",
              );

          console.log(`[Supabase Proxy] Chamando fallback: ${fallbackUrl}`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            response = await fetch(fallbackUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: functionName,
                body: options?.body,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fallbackErr: any) {
            console.error("[Supabase Proxy] Conexão alternativa também falhou:", fallbackErr);
            throw new Error(
              `Ambas as conexões de IA falharam (Failed to fetch). Detalhe: ${fallbackErr.message || fallbackErr}`,
            );
          }
        }

        if (response.ok) {
          const resBody = await response.json();
          // Se o backend retornou um objeto com a chave "error":
          if (resBody && typeof resBody === "object" && "error" in resBody && resBody.error) {
            console.warn(`[Supabase Proxy] Proxy retornou um erro interno: ${resBody.error}`);
            return { data: null, error: new Error(resBody.error) };
          }
          return { data: resBody, error: null };
        } else {
          const errorText = await response.text();
          let parsedError = "";
          try {
            const parsed = JSON.parse(errorText);
            parsedError = parsed?.error || parsed?.message || "";
          } catch {
            // não é json
          }
          const errMsg =
            parsedError || errorText || `Erro no servidor local (status ${response.status})`;
          console.warn(`[Supabase Proxy] Request retornou status ${response.status}: ${errMsg}.`);

          if (isLocalOnly) {
            return { data: null, error: new Error(errMsg) };
          }
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        console.warn(`[Supabase Proxy] Falha ao rotear via proxy. Erro:`, e);
        if (isLocalOnly) {
          return { data: null, error: new Error(errMsg) };
        }
      }

      if (typeof originalInvoke === "function") {
        return originalInvoke.call(realFunctionsInstance, functionName, options);
      }
      return { data: null, error: new Error("Proxy failed and original invoke unavailable") };
    };

    // Sobrescreve invoke na instância real
    realFunctionsInstance.invoke = proxiedInvoke;

    // Redefine a propriedade functions do client para retornar a instância com o invoke modificado
    Object.defineProperty(client, "functions", {
      get() {
        return realFunctionsInstance;
      },
      configurable: true,
    });
  }

  return client;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
