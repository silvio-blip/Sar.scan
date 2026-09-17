import { supabaseAdmin } from "../integrations/supabase/client.server.js";

export type AppSettings = {
  gemini_api_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  resend_api_key?: string;
  firebase_service_account?: string;
  fcm_server_key?: string;
  [key: string]: string | undefined;
};

let _settingsCache: AppSettings | null = null;
let _lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export const SQL_APP_SETTINGS_MIGRATION = `-- Execute no Supabase SQL Editor para criar a tabela app_settings com suporte seguro:
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir índice único para a coluna key
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_idx ON public.app_settings (key);

-- Habilitar RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Permitir acesso total ao backend (service role) e leitura de configurações
DROP POLICY IF EXISTS "Allow service role full access" ON public.app_settings;
CREATE POLICY "Allow service role full access" ON public.app_settings
  FOR ALL USING (true) WITH CHECK (true);
`;

export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (_settingsCache && now - _lastFetch < CACHE_TTL) {
    return _settingsCache;
  }

  try {
    const admin = supabaseAdmin;
    console.log("[Settings] Iniciando busca na tabela app_settings...");

    const { data, error } = await (admin as any).from("app_settings").select("key, value");

    if (error) {
      console.warn(
        "[Settings] Aviso ao buscar no banco (from app_settings):",
        error.message || error,
      );
      return (_settingsCache || {}) as AppSettings;
    }

    const settings: AppSettings = {};
    if (data && Array.isArray(data)) {
      console.log(`[Settings] Sucesso na query, retornou ${data.length} linhas.`);
      for (const row of data) {
        if (row.key && row.value !== undefined && row.value !== null) {
          const rawKey = String(row.key).trim();
          const rawVal = String(row.value).trim();
          settings[rawKey] = rawVal;
          // Normalização para facilitar busca case-insensitive
          settings[rawKey.toLowerCase()] = rawVal;
        }
      }
    }

    _settingsCache = settings;
    _lastFetch = now;
    return settings;
  } catch (e) {
    console.error("[Settings] Erro crítico ao buscar configurações:", e);
    return (_settingsCache || {}) as AppSettings;
  }
}

export function invalidateSettingsCache() {
  _settingsCache = null;
  _lastFetch = 0;
}

export function setMemorySetting(key: string, value: string) {
  if (!_settingsCache) _settingsCache = {};
  _settingsCache[key] = value;
  _settingsCache[key.toLowerCase()] = value;
  _lastFetch = Date.now();
}

/**
 * Salva uma configuração no Supabase de forma resiliente
 */
export async function saveAppSetting(
  key: string,
  value: string,
): Promise<{
  success: boolean;
  error?: string;
  diagnosis?: string;
  sqlFix?: string;
  source: string;
}> {
  const cleanKey = key.trim();
  const cleanValue = value.trim();

  // Atualizar imediatamente no cache de memória local para garantir funcionamento instantâneo
  setMemorySetting(cleanKey, cleanValue);

  const admin = supabaseAdmin;
  if (!admin) {
    return {
      success: true,
      source: "Memória do Servidor (Supabase client indisponível)",
    };
  }

  try {
    console.log(`[Settings] Salvando chave '${cleanKey}' no Supabase (app_settings)...`);

    // 1. Verificar se a linha já existe
    const { data: existing, error: selectErr } = await (admin as any)
      .from("app_settings")
      .select("id, key")
      .eq("key", cleanKey)
      .maybeSingle();

    let upsertError: any = null;

    if (selectErr) {
      console.warn("[Settings] Erro ao consultar app_settings:", selectErr.message);
      // Tentar upsert direto com colunas explícitas
      const resUpsert = await (admin as any).from("app_settings").upsert(
        {
          key: cleanKey,
          value: cleanValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      upsertError = resUpsert.error;
    } else if (existing) {
      console.log(`[Settings] Chave '${cleanKey}' encontrada no Supabase. Atualizando registro...`);
      const resUpdate = await (admin as any)
        .from("app_settings")
        .update({
          value: cleanValue,
          updated_at: new Date().toISOString(),
        })
        .eq("key", cleanKey);
      upsertError = resUpdate.error;
    } else {
      console.log(`[Settings] Chave '${cleanKey}' não encontrada. Inserindo novo registro...`);
      const resInsert = await (admin as any).from("app_settings").insert({
        key: cleanKey,
        value: cleanValue,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      upsertError = resInsert.error;
    }

    if (upsertError) {
      const errMsg = upsertError.message || String(upsertError);
      const isTableMissing =
        upsertError.code === "42P01" ||
        errMsg.toLowerCase().includes("does not exist") ||
        errMsg.toLowerCase().includes("relation");
      const isRlsError =
        upsertError.code === "42501" ||
        errMsg.toLowerCase().includes("row-level security") ||
        errMsg.toLowerCase().includes("permission denied");

      if (isTableMissing) {
        return {
          success: false,
          error: "A tabela 'app_settings' ainda não foi criada no seu banco de dados Supabase.",
          diagnosis:
            "A tabela app_settings precisa ser criada no Supabase SQL Editor para persistir credenciais permanentemente.",
          sqlFix: SQL_APP_SETTINGS_MIGRATION,
          source: "Memória do Servidor (Ativo até reiniciar)",
        };
      }

      if (isRlsError) {
        return {
          success: false,
          error: "Permissão negada pelas políticas de RLS na tabela 'app_settings'.",
          diagnosis:
            "A tabela app_settings tem Row Level Security ativo que bloqueia a gravação. Execute o script SQL no Supabase para liberar.",
          sqlFix: SQL_APP_SETTINGS_MIGRATION,
          source: "Memória do Servidor (Ativo até reiniciar)",
        };
      }

      return {
        success: false,
        error: `Erro ao gravar no Supabase: ${errMsg}`,
        diagnosis:
          "Ocorreu um erro ao gravar no Supabase. Os dados foram salvos na memória do servidor.",
        sqlFix: SQL_APP_SETTINGS_MIGRATION,
        source: "Memória do Servidor",
      };
    }

    invalidateSettingsCache();
    return {
      success: true,
      source: "Supabase Database (app_settings)",
    };
  } catch (err: any) {
    console.error("[Settings] Exceção ao salvar no Supabase:", err);
    return {
      success: false,
      error: err.message || "Erro desconhecido ao salvar no banco",
      sqlFix: SQL_APP_SETTINGS_MIGRATION,
      source: "Memória do Servidor",
    };
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
