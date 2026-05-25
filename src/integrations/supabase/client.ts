import { createClient } from "@supabase/supabase-js";
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
  const originalInvoke = client.functions.invoke.bind(client.functions);
  client.functions.invoke = async function (functionName, options) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/api/edge`;
      console.log(
        `[Supabase Proxy] Intercepting function invoke: ${functionName} -> Proxying to local API ${url}`,
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: functionName,
          body: options?.body,
        }),
      });

      if (response.ok) {
        const resBody = await response.json();
        // If our backend internal returned an actual error string as `error` key:
        if (resBody && typeof resBody === "object" && "error" in resBody && resBody.error) {
          console.warn(`[Supabase Proxy] Proxy returned inner error: ${resBody.error}`);
          return { data: null, error: new Error(resBody.error) };
        }
        return { data: resBody, error: null };
      } else {
        const errorText = await response.text();
        console.warn(
          `[Supabase Proxy] Proxy request returned status ${response.status}: ${errorText}. Falling back to direct Supabase invoke.`,
        );
      }
    } catch (e) {
      console.warn(
        `[Supabase Proxy] Failed to route via proxy, falling back to direct Supabase invoke. Error:`,
        e,
      );
    }
    return originalInvoke(functionName, options);
  };

  return client;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
