import { supabaseAdmin } from "../integrations/supabase/client.server.js";

export type AppSettings = {
  gemini_api_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  resend_api_key?: string;
  google_play_package_name?: string;
  [key: string]: string | undefined;
};

let _settingsCache: AppSettings | null = null;
let _lastFetch = 0;
const CACHE_TTL = 3 * 1000; // 3 seconds TTL for immediate updates

export function invalidateSettingsCache() {
  _settingsCache = null;
  _lastFetch = 0;
}

export async function getAppSettings(forceRefresh = false): Promise<AppSettings> {
  const now = Date.now();
  if (!forceRefresh && _settingsCache && now - _lastFetch < CACHE_TTL) {
    return _settingsCache;
  }

  try {
    const admin = supabaseAdmin;
    console.log("[Settings] Buscando configurações no banco de dados Supabase...");

    const cleanVal = (v: any) => {
      if (v === null || v === undefined) return "";
      let s = typeof v === "string" ? v.trim() : String(v).trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
      }
      return s;
    };

    const settings: AppSettings = {};
    const tablesToTry = [
      "app_settings",
      "settings",
      "stripe_settings",
      "stripe_keys",
      "stripe_customer",
      "stripe_customers",
      "app_stream_coxa",
      "secrets",
      "config",
      "app_config",
    ];

    let foundAny = false;

    for (const tableName of tablesToTry) {
      try {
        const { data, error } = await (admin as any).from(tableName).select("*");
        if (!error && data && Array.isArray(data) && data.length > 0) {
          foundAny = true;
          console.log(
            `[Settings] Tabela encontrada: '${tableName}' com ${data.length} registro(s).`,
          );

          for (const row of data) {
            // Formato 1: Linha Chave-Valor (key, value)
            if (row.key !== undefined && row.value !== undefined && row.key !== null) {
              const valStr = cleanVal(row.value);
              const keyStr = String(row.key).trim();
              if (valStr) {
                settings[keyStr] = valStr;
                settings[keyStr.toLowerCase()] = valStr;
                settings[keyStr.toUpperCase()] = valStr;
              }
            }

            // Formato 2: Colunas dedicadas
            for (const [colKey, colVal] of Object.entries(row)) {
              if (
                colVal !== null &&
                colVal !== undefined &&
                !["id", "created_at", "updated_at", "key", "value"].includes(colKey)
              ) {
                const valStr = cleanVal(colVal);
                if (valStr) {
                  settings[colKey] = valStr;
                  settings[colKey.toLowerCase()] = valStr;
                  settings[colKey.toUpperCase()] = valStr;
                }
              }
            }
          }
        }
      } catch {
        // Tabela não existe no schema, continua para próxima
      }
    }

    if (!foundAny) {
      console.warn("[Settings] Nenhuma tabela de configuração retornou registros.");
    }

    // Merge com variáveis de ambiente como fallback
    if (!settings.stripe_secret_key && process.env.STRIPE_SECRET_KEY) {
      settings.stripe_secret_key = cleanVal(process.env.STRIPE_SECRET_KEY);
    }
    if (!settings.stripe_webhook_secret && process.env.STRIPE_WEBHOOK_SECRET) {
      settings.stripe_webhook_secret = cleanVal(process.env.STRIPE_WEBHOOK_SECRET);
    }
    if (!settings.gemini_api_key && process.env.GEMINI_API_KEY) {
      settings.gemini_api_key = cleanVal(process.env.GEMINI_API_KEY);
    }

    _settingsCache = settings;
    _lastFetch = now;

    const maskedStripeKey = settings.stripe_secret_key
      ? `${settings.stripe_secret_key.slice(0, 10)}...${settings.stripe_secret_key.slice(-4)}`
      : "NÃO ENCONTRADA";
    console.log(
      `[Settings] Configurações ativas carregadas com sucesso. Stripe Key: ${maskedStripeKey}`,
    );

    return settings;
  } catch (e) {
    console.error("[Settings] Erro crítico ao carregar configurações:", e);
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
