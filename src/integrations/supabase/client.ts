import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { invokeEdge } from "@/lib/edge-proxy.functions";

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  const patchedInvoke = (async (name: string, opts?: { body?: unknown }) => {
    try {
      const data = await invokeEdge({
        name,
        body: (opts?.body ?? {}) as Record<string, unknown>,
      });
      return { data, error: null } as { data: unknown; error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) } as {
        data: null;
        error: Error;
      };
    }
  }) as typeof client.functions.invoke;
  try {
    client.functions.invoke = patchedInvoke;
    const proto = Object.getPrototypeOf(client.functions);
    if (proto) proto.invoke = patchedInvoke;
  } catch (e) {
    console.warn("[supabase] invoke patch failed", e);
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
