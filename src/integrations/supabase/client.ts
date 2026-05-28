import { createClient } from "@supabase/supabase-js";
import { getApiUrl } from "@/lib/utils";
import type { Database } from "./types";

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Por favor, verifique as configurações no Vercel. Certifique-se de usar o prefixo VITE_ se estiver definindo variáveis para o frontend.`;
    console.error(`[Supabase] ${message}`);
    console.log("[Supabase DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(target, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();

    if (prop === "functions") {
      const realFunctionsInstance = _supabase.functions;
      const originalInvoke = realFunctionsInstance.invoke;

      return new Proxy(realFunctionsInstance, {
        get(fnTarget, fnProp, fnReceiver) {
          if (fnProp === "invoke") {
            return async function (functionName: string, options?: any) {
              if (functionName === "password-reset") {
                console.log(
                  `[Supabase Proxy] Direct invoke for "password-reset" bypass to real Supabase.`,
                );
                if (typeof originalInvoke === "function") {
                  return originalInvoke.call(realFunctionsInstance, functionName, options);
                }
              }

              const isLocalOnly = true;

              try {
                const url = getApiUrl("/api/edge");
                console.log(
                  `[Supabase Proxy Sync] Intercepting function invoke: ${functionName} -> Proxying to local API ${url}`,
                );

                let authHeader = "";
                try {
                  const {
                    data: { session },
                  } = await _supabase!.auth.getSession();
                  if (session?.access_token) {
                    authHeader = `Bearer ${session.access_token}`;
                  }
                } catch (e) {
                  console.warn("[Supabase Proxy] Failed to get session:", e);
                }

                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                };
                if (authHeader) {
                  headers["Authorization"] = authHeader;
                }

                let response;
                try {
                  response = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                      name: functionName,
                      body: options?.body,
                    }),
                  });
                } catch (fetchErr) {
                  console.warn(
                    "[Supabase Proxy] Primary fetch failed. Trying fallback URL...",
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

                  console.log(`[Supabase Proxy] Fetching fallback: ${fallbackUrl}`);
                  try {
                    response = await fetch(fallbackUrl, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({
                        name: functionName,
                        body: options?.body,
                      }),
                    });
                  } catch (fallbackErr: any) {
                    console.error("[Supabase Proxy] Both local API proxies failed.", fallbackErr);

                    const detailError = fallbackErr.message || String(fallbackErr);
                    const explainMsg = `As chamadas de IA falharam porque a aplicação não conseguiu ligar ao servidor de API em '${url}' ou '${fallbackUrl}' (Erro: ${detailError}). Se estiver a usar o telemóvel/aplicativo instalado ou site de produção, certifique-se de que o servidor backend está online e que a variável de ambiente VITE_API_BASE_URL está configurada com o endereço público correto do seu backend.`;

                    if (typeof originalInvoke === "function") {
                      console.log(
                        "[Supabase Proxy] Trying DIRECT cloud Supabase functions invoke as last fallback...",
                      );
                      try {
                        const directResult = await originalInvoke.call(
                          realFunctionsInstance,
                          functionName,
                          options,
                        );
                        console.log(
                          "[Supabase Proxy] Direct Supabase invoke succeeded:",
                          directResult,
                        );
                        if (directResult?.error) {
                          throw new Error(directResult.error.message || String(directResult.error));
                        }
                        return directResult;
                      } catch (directErr: any) {
                        console.error(
                          "[Supabase Proxy] Direct invoke fallback also failed:",
                          directErr,
                        );
                        throw new Error(
                          `${explainMsg} Chamada Direta Supabase também falhou: ${directErr.message || directErr}`,
                        );
                      }
                    } else {
                      throw new Error(explainMsg);
                    }
                  }
                }

                if (response.ok) {
                  const resBody = await response.json();
                  if (
                    resBody &&
                    typeof resBody === "object" &&
                    "error" in resBody &&
                    resBody.error
                  ) {
                    console.warn(`[Supabase Proxy] Proxy returned inner error: ${resBody.error}`);
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
                    // not json
                  }
                  const errMsg =
                    parsedError ||
                    errorText ||
                    `Erro no servidor local (status ${response.status})`;
                  console.warn(
                    `[Supabase Proxy] Proxy request returned status ${response.status}: ${errMsg}.`,
                  );

                  if (isLocalOnly) {
                    return { data: null, error: new Error(errMsg) };
                  }
                }
              } catch (e: any) {
                const errMsg = e?.message || String(e);
                console.warn(
                  `[Supabase Proxy] Failed to route via proxy. ${isLocalOnly ? "Failing" : "Falling back"}. Error:`,
                  e,
                );
                if (isLocalOnly) {
                  return { data: null, error: new Error(errMsg) };
                }
              }

              if (typeof originalInvoke === "function") {
                return originalInvoke.call(realFunctionsInstance, functionName, options);
              }
              return {
                data: null,
                error: new Error("Proxy failed and original invoke unavailable"),
              };
            };
          }
          return Reflect.get(fnTarget, fnProp, fnReceiver);
        },
      });
    }

    return Reflect.get(_supabase, prop, receiver);
  },
});
