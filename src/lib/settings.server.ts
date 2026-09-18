import { supabaseAdmin } from "../integrations/supabase/client.server.js";

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
    const admin = supabaseAdmin;
    console.log("[Settings] Iniciando busca na tabela app_settings...");

    // Explicitly use the admin client to select from app_settings (or fallback to app_stream_coxa)
    let { data, error } = await (admin as any).from("app_settings").select("*");

    if (error) {
      console.warn("[Settings] Tabela app_settings não encontrada, tentando app_stream_coxa...");
      const alt = await (admin as any).from("app_stream_coxa").select("*");
      if (!alt.error && alt.data) {
        data = alt.data;
        error = null;
      }
    }

    if (error) {
      console.error(
        "[Settings] ERRO AO BUSCAR NO BANCO (from app_settings / app_stream_coxa):",
        JSON.stringify(error, null, 2),
      );
      return (_settingsCache || {}) as AppSettings;
    }

    const settings: AppSettings = {};
    if (data && Array.isArray(data)) {
      console.log(`[Settings] Sucesso na query, retornou ${data.length} linhas.`);
      for (const row of data) {
        // Formato 1: Tabela Chave-Valor (key, value)
        if (row.key !== undefined && row.value !== undefined && row.key !== null) {
          const valStr = typeof row.value === "string" ? row.value.trim() : String(row.value);
          const keyStr = String(row.key).trim();
          settings[keyStr] = valStr;
          settings[keyStr.toLowerCase()] = valStr;
          settings[keyStr.toUpperCase()] = valStr;
          console.log(`[Settings] Carregado (chave/valor): ${keyStr}`);
        }

        // Formato 2: Tabela com colunas diretas (ex: stripe_secret_key, stripe_webhook_secret)
        for (const [colKey, colVal] of Object.entries(row)) {
          if (
            colVal !== null &&
            colVal !== undefined &&
            !["id", "created_at", "updated_at", "key", "value"].includes(colKey)
          ) {
            const valStr = typeof colVal === "string" ? colVal.trim() : String(colVal);
            settings[colKey] = valStr;
            settings[colKey.toLowerCase()] = valStr;
            settings[colKey.toUpperCase()] = valStr;
            console.log(`[Settings] Carregado (coluna): ${colKey}`);
          }
        }
      }
    } else {
      console.warn(
        "[Settings] Nenhum dado retornado ou formato inválido da tabela app_settings.",
        data,
      );
    }

    _settingsCache = settings;
    _lastFetch = now;
    console.log("[Settings] Configurações carregadas:", Object.keys(settings));
    return settings;
  } catch (e) {
    console.error("[Settings] Erro crítico ao buscar configurações:", e);
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
