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

              // 1. Primeiro tenta fazer a chamada DIRETA para a função na nuvem do Supabase.
              // Isto funciona nativamente em produção, sites Vercel, PWAs e aplicativos móveis (Capacitor)
              // porque as credenciais do Supabase já estão embutidas na aplicação. Não exige servidor Node próprio
              // nem configuração de variáveis de ambiente de base de url como VITE_API_BASE_URL.
              if (typeof originalInvoke === "function") {
                try {
                  console.log(
                    `[Supabase SDK] Invocando função de nuvem "${functionName}" diretamente...`,
                  );
                  const directResult = await originalInvoke.call(
                    realFunctionsInstance,
                    functionName,
                    options,
                  );
                  if (directResult && !directResult.error) {
                    console.log(
                      `[Supabase SDK] Sucesso na chamada direta da função de nuvem "${functionName}".`,
                    );
                    return directResult;
                  }

                  const errMessage = String(
                    directResult?.error?.message || directResult?.error || "",
                  ).toLowerCase();
                  const isFunctionNotFound =
                    errMessage.includes("not found") ||
                    errMessage.includes("404") ||
                    errMessage.includes("failed to fetch") ||
                    directResult?.error?.status === 404;

                  if (!isFunctionNotFound) {
                    console.log(
                      `[Supabase SDK] Função "${functionName}" retornou erro de lógica operacional. Retornando ao chamador.`,
                    );
                    return directResult;
                  }

                  console.warn(
                    `[Supabase SDK] Função de nuvem "${functionName}" não encontrada ou indisponível (Erro: ${errMessage}). Tentando proxy local...`,
                  );
                } catch (directErr: any) {
                  const directErrStr = String(directErr?.message || directErr);
                  console.warn(
                    `[Supabase SDK] Chamada direta da função de nuvem falhou com exceção: ${directErrStr}. Tentando proxy local...`,
                  );
                }
              }

              // 2. Se a chamada direta falhar por inocorrência (ex: em ambiente sandbox do AI Studio),
              // recorremos ao proxy Node local (/api/edge) que está a correr no nosso backend Express de desenvolvimento.
              try {
                const url = getApiUrl("/api/edge");
                console.log(`[Supabase Proxy] Roteando para API de proxy local: ${url}`);

                let authHeader = "";
                try {
                  const {
                    data: { session },
                  } = await _supabase!.auth.getSession();
                  if (session?.access_token) {
                    authHeader = `Bearer ${session.access_token}`;
                  }
                } catch (e) {
                  console.warn("[Supabase Proxy] Erro ao carregar sessão para o proxy:", e);
                }

                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                };
                if (authHeader) {
                  headers["Authorization"] = authHeader;
                }

                const response = await fetch(url, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    name: functionName,
                    body: options?.body,
                  }),
                });

                if (response.ok) {
                  const resBody = await response.json();
                  if (
                    resBody &&
                    typeof resBody === "object" &&
                    "error" in resBody &&
                    resBody.error
                  ) {
                    console.warn(`[Supabase Proxy] Proxy retornou erro interno: ${resBody.error}`);
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
                    // ignore
                  }
                  const errMsg =
                    parsedError ||
                    errorText ||
                    `Erro no servidor local (status ${response.status})`;
                  console.warn(
                    `[Supabase Proxy] Proxy falhou com status ${response.status}: ${errMsg}`,
                  );
                  return { data: null, error: new Error(errMsg) };
                }
              } catch (e: any) {
                const errMsg = e?.message || String(e);
                console.error(`[Supabase Proxy] Falha grave no proxy local:`, e);
                return {
                  data: null,
                  error: new Error(
                    `Não foi possível executar a função "${functionName}". Ocorreu um erro ao ligar ao serviço de IA. Detalhes: ${errMsg}`,
                  ),
                };
              }
            };
          }
          return Reflect.get(fnTarget, fnProp, fnReceiver);
        },
      });
    }

    return Reflect.get(_supabase, prop, receiver);
  },
});
