import { supabaseAdmin } from "../integrations/supabase/client.server.js";

export type AppSettings = {
  GEMINI_API_KEY?: string;
  google_play_package_name?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  [key: string]: string | undefined;
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await (supabaseAdmin as any).from("app_settings").select("key, value");

    if (error) {
      console.error("[Settings] Erro ao consultar app_settings:", error);
      return {};
    }

    const settings: AppSettings = {};
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.key) {
          const val = row.value ? String(row.value).trim() : "";
          settings[row.key] = val;
        }
      }
    }

    console.log(
      `[Settings] Carregadas ${Object.keys(settings).length} chaves da tabela app_settings (stripe_secret_key: ${settings.stripe_secret_key ? "definida" : "vazia"})`,
    );

    return settings;
  } catch (err) {
    console.error("[Settings] Exceção ao consultar app_settings:", err);
    return {};
  }
}

export function invalidateSettingsCache() {
  // Mantido para compatibilidade
}

export async function getSetting(key: string, envName?: string): Promise<string | undefined> {
  const settings = await getAppSettings();
  if (settings[key]) return settings[key];
  if (envName && process.env[envName]) return process.env[envName];
  return undefined;
}
