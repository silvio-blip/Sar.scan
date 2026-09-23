import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { getAppSettings } from "./settings.server.js";
import { loadEnv } from "./env-loader.server.js";

loadEnv();

// Prioridade de modelos ordenada por eficiência máxima de cota (Free Tier) e robustez
export const FREE_TIER_OPTIMAL_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
] as const;

// Registro em memória de modelos descontinuados ou temporariamente em cooldown
const deprecatedOrUnavailableModels = new Set<string>();
const modelCooldowns = new Map<string, number>();

function cleanApiKey(val: string | undefined | null): string | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.trim();
  if (
    !cleaned ||
    cleaned === "undefined" ||
    cleaned === "null" ||
    cleaned === '""' ||
    cleaned === "''"
  ) {
    return null;
  }
  return cleaned;
}

export async function getCleanGeminiApiKey(): Promise<string> {
  const settings = await getAppSettings().catch(() => ({}) as any);
  const candidateKeys = [
    settings?.gemini_api_key,
    settings?.GEMINI_API_KEY,
    settings?.gemini_key,
    settings?.GEMINI_KEY,
    settings?.GoogleGeminiApiKey,
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
  ];

  const rawKey = candidateKeys.find((k) => k && k !== "undefined" && k !== "null");
  const apiKey = cleanApiKey(rawKey);

  if (!apiKey) {
    throw new Error(
      "Chave GEMINI_API_KEY não configurada. Configure no painel Settings > Secrets ou no arquivo de variáveis de ambiente.",
    );
  }
  return apiKey;
}

export function getOptimalGeminiModels(): string[] {
  const now = Date.now();
  // Filtra modelos marcados como descontinuados ou em cooldown por excesso de cota momentâneo
  const available = FREE_TIER_OPTIMAL_MODELS.filter((model) => {
    if (deprecatedOrUnavailableModels.has(model)) return false;
    const cooldownUntil = modelCooldowns.get(model);
    if (cooldownUntil && now < cooldownUntil) return false;
    return true;
  });

  // Se todos estiverem temporariamente bloqueados, limpa o cooldown e tenta todos
  if (available.length === 0) {
    modelCooldowns.clear();
    return [...FREE_TIER_OPTIMAL_MODELS];
  }

  return available;
}

export interface SmartGeminiCallParams {
  contents: GenerateContentParameters["contents"];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Executa uma chamada à API do Gemini com o modelo mais econômico em cota
 * e realiza failover inteligente automático em caso de descontinuação (404),
 * estouro de rate limit (429) ou instabilidade (503).
 */
export async function generateContentWithOptimalModel(
  params: SmartGeminiCallParams,
  preferredModel?: string,
) {
  const apiKey = await getCleanGeminiApiKey();
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const modelsList = preferredModel
    ? [preferredModel, ...getOptimalGeminiModels().filter((m) => m !== preferredModel)]
    : getOptimalGeminiModels();

  let lastError: any = null;

  for (const model of modelsList) {
    try {
      console.log(`[Gemini Smart Client] Testando requisição com o modelo econômico: ${model}`);

      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          maxOutputTokens: params.maxOutputTokens ?? 1500,
          temperature: params.temperature ?? 0.2,
          ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
          ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
          ...(params.responseSchema ? { responseSchema: params.responseSchema as any } : {}),
        },
      });

      console.log(`[Gemini Smart Client] Sucesso com o modelo: ${model}`);
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isDeprecated =
        errMsg.includes("404") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("NOT_FOUND") ||
        errMsg.includes("deprecated");
      const isQuotaExceeded =
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("quota") ||
        errMsg.includes("rate limit");

      if (isDeprecated) {
        console.warn(
          `[Gemini Smart Client] ⚠️ Modelo ${model} foi descontinuado pelo Google. Desativando e pulando para o próximo modelo da cadeia...`,
        );
        deprecatedOrUnavailableModels.add(model);
      } else if (isQuotaExceeded) {
        console.warn(
          `[Gemini Smart Client] ⏳ Cota temporária atingida no modelo ${model}. Aplicando cooldown de 60s e utilizando o próximo modelo...`,
        );
        modelCooldowns.set(model, Date.now() + 60 * 1000);
      } else {
        console.warn(`[Gemini Smart Client] Erro com o modelo ${model}:`, errMsg);
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "Não foi possível obter resposta dos modelos disponíveis da API Gemini. Tente novamente em alguns instantes.",
    )
  );
}
