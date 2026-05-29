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
      (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined),
  );

  const SUPABASE_PUBLISHABLE_KEY = cleanEnvValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined),
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

  return client;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
