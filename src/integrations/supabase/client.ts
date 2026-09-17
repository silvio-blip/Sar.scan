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
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ||
      import.meta.env.SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL ||
      (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : undefined),
  );

  const SUPABASE_SERVICE_ROLE_KEY = cleanEnvValue(
    (typeof process !== "undefined" ? process.env?.SUPABASE_SERVICE_ROLE_KEY : undefined) ||
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ||
      import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined),
  );

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    const message = `Variáveis de conexão do Supabase ausentes: ${missing.join(", ")}. Por favor, configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.`;
    console.error(`[Supabase] ${message}`);

    if (import.meta.env.PROD) {
      // Return placeholder client to prevent catastrophic bundle crashes on initial load
      return createClient<Database>("https://placeholder-url.supabase.co", "placeholder-key", {
        auth: { persistSession: false },
      });
    }
    throw new Error(message);
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
