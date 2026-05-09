import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppSettings = {
  gemini_api_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  resend_api_key?: string;
  [key: string]: string | undefined;
};

let _settingsCache: AppSettings | null = null;
let _lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (_settingsCache && now - _lastFetch < CACHE_TTL) {
    return _settingsCache;
  }

  try {
    // Check if supabaseAdmin is accessible before calling it
    // The Proxy in client.server.ts will throw if env vars are missing
    let admin;
    try {
      admin = supabaseAdmin;
      const { data, error } = await (admin as any)
        .from("app_settings")
        .select("key, value");

      if (error) {
        console.error("[Settings] DB select error:", error.message);
        return (_settingsCache || {}) as AppSettings;
      }

      const settings: AppSettings = {};
      if (data) {
        for (const row of data) {
          settings[row.key] = row.value;
        }
      }

      _settingsCache = settings;
      _lastFetch = now;
      return settings;
    } catch (adminError) {
      console.warn("[Settings] Supabase admin client not available:", adminError);
      return (_settingsCache || {}) as AppSettings;
    }
  } catch (e) {
    console.error("[Settings] Critical error fetching settings:", e);
    return (_settingsCache || {}) as AppSettings;
  }
}

/**
 * Gets a specific setting, falling back to environment variable if not found in DB.
 */
export async function getSetting(key: string, envName?: string): Promise<string | undefined> {
  const settings = await getAppSettings();
  if (settings[key]) return settings[key];
  
  if (envName) {
    return process.env[envName];
  }
  return undefined;
}
