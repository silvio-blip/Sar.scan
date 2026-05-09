import { supabaseAdmin } from "../integrations/supabase/client.server.js";

import { getAppSettings } from "./settings.server.js";

type Body = Record<string, unknown> | undefined;

const MODEL = "gemini-flash-lite-latest";

function getAdminSafe() {
  try {
    return supabaseAdmin;
  } catch (e) {
    console.error("[Edge] Supabase admin client not available:", e);
    return null;
  }
}

let _cachedKey: string | null = null;
async function getGeminiKey() {
  if (_cachedKey) return _cachedKey;

  const settings = await getAppSettings();
  const key = settings.gemini_api_key || process.env.GEMINI_API_KEY;
  
  if (key) {
    _cachedKey = key;
    return key;
  }
  throw new Error("Chave Gemini não configurada (não encontrada em app_settings nem environment)");
}

type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role?: string; parts: GeminiPart[] };

async function geminiCall(opts: {
  systemInstruction?: string;
  contents: GeminiContent[];
  responseSchema?: unknown;
  maxTokens?: number;
}) {
  const key = await getGeminiKey();
  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 2048,
      ...(opts.responseSchema
        ? { responseMimeType: "application/json", responseSchema: opts.responseSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429)
      throw new Error("Limite de uso da Gemini atingido. Tente em alguns instantes.");
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "";
  return { text, raw: data };
}

const ALIMENTOS_SCHEMA = {
  type: "object",
  properties: {
    alimentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          porcao: { type: "string" },
          cal: { type: "number" },
          carb: { type: "number" },
          prot: { type: "number" },
          gord: { type: "number" },
        },
        required: ["nome", "porcao", "cal", "carb", "prot", "gord"],
      },
    },
  },
  required: ["alimentos"],
};

const SCAN_SCHEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          quantidade: { type: "string" },
          cal: { type: "number" },
          carb: { type: "number" },
          prot: { type: "number" },
          gord: { type: "number" },
        },
        required: ["nome", "quantidade", "cal", "carb", "prot", "gord"],
      },
    },
  },
  required: ["itens"],
};

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // ignore
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      // ignore
    }
  }
  return null;
}

async function handleSearchFoodAi(body: Body) {
  const mode = (body?.mode as string) ?? "variants";
  const query = (body?.query as string) ?? "";

  if (mode === "popular") {
    const admin = getAdminSafe();
    if (!admin) return { alimentos: [] };
    
    const { data } = await (admin as any)
      .from("foods_basic")
      .select("nome, cal, carb, prot, gord, foto_url")
      .limit(100);
    return { alimentos: (data ?? []).map((c: any) => ({ ...c, porcao: "1 porção" })) };
  }

  if (!query.trim()) return { alimentos: [] };

  const { text } = await geminiCall({
    systemInstruction:
      "Você é um nutricionista brasileiro. Responda apenas com JSON conforme o schema, em português.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Liste até 6 variantes comuns do alimento "${query}". Para cada uma: nome curto, porção comum (ex.: "100g", "1 unidade"), calorias e macros (carb, prot, gord em gramas) por porção.`,
          },
        ],
      },
    ],
    responseSchema: ALIMENTOS_SCHEMA,
  });
  const parsed = safeJson<{ alimentos?: Array<Record<string, unknown>> }>(text);
  const alimentos = (parsed?.alimentos ?? []).map((a) => ({
    nome: String(a.nome ?? ""),
    porcao: String(a.porcao ?? "1 porção"),
    cal: Number(a.cal ?? 0),
    carb: Number(a.carb ?? 0),
    prot: Number(a.prot ?? 0),
    gord: Number(a.gord ?? 0),
    foto_url: null,
  }));
  return { alimentos };
}

async function handleNutritionChat(body: Body) {
  const message = String(body?.message ?? "").trim();
  const userId = body?.user_id ? String(body.user_id) : null;
  if (!message) return { reply: "" };

  const { text } = await geminiCall({
    systemInstruction:
      "Você é um nutricionista brasileiro amigável. Respostas curtas, claras e em português.",
    contents: [{ role: "user", parts: [{ text: message }] }],
  });
  const reply = text || "Não consegui responder agora.";

  if (userId) {
    try {
      const admin = getAdminSafe();
      if (admin) {
        await (admin as any)
          .from("chat_messages")
          .insert({ user_id: userId, role: "assistant", content: reply });
      }
    } catch (e) {
      console.error("chat persist failed", e);
    }
  }
  return { reply };
}

async function handleScanFood(body: Body) {
  const image = String(body?.image ?? "");
  if (!image.startsWith("data:")) {
    return { ok: false, error: "Imagem inválida.", itens: [] };
  }
  const m = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { ok: false, error: "Formato de imagem não suportado.", itens: [] };
  const mimeType = m[1];
  const data = m[2];

  const { text } = await geminiCall({
    systemInstruction:
      "Você é um nutricionista. Identifique TODOS os alimentos visíveis na foto e estime os macros de cada um. Responda apenas em JSON conforme o schema, em português.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Liste cada alimento separadamente (ex.: arroz, feijão, frango, salada). Para cada um: nome em português, quantidade visível estimada (ex.: '100g', '1 unidade'), calorias e macros (carb, prot, gord em gramas) dessa quantidade.",
          },
          { inlineData: { mimeType, data } },
        ],
      },
    ],
    responseSchema: SCAN_SCHEMA,
    maxTokens: 2048,
  });
  const parsed = safeJson<{ itens?: Array<Record<string, unknown>> }>(text);
  const itens = (parsed?.itens ?? []).map((i) => ({
    nome: String(i.nome ?? "Alimento"),
    quantidade: String(i.quantidade ?? "1 porção"),
    cal: Number(i.cal ?? 0),
    carb: Number(i.carb ?? 0),
    prot: Number(i.prot ?? 0),
    gord: Number(i.gord ?? 0),
    foto_url: null as string | null,
  }));
  if (itens.length === 0) {
    return {
      ok: false,
      reason: "no_food",
      error:
        "Não conseguimos identificar um alimento nessa imagem. Tente outra foto, com melhor iluminação e enquadramento.",
      itens: [],
    };
  }
  const total = itens.reduce(
    (a, i) => ({
      cal: a.cal + i.cal,
      carb: a.carb + i.carb,
      prot: a.prot + i.prot,
      gord: a.gord + i.gord,
    }),
    { cal: 0, carb: 0, prot: 0, gord: 0 },
  );
  return { ok: true, itens, total };
}

async function getUserStatus(userId: string) {
  const admin = getAdminSafe();
  if (!admin) return null;

  const { data: sub } = await (admin as any)
    .from("subscriptions")
    .select("status, scans_credits, ai_agent_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  // Se não existir subscription, criamos uma 'free' por padrão como solicitado
  if (!sub) {
    const { data: newSub } = await (admin as any)
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "free",
        scans_credits: 0,
        ai_agent_enabled: false,
      })
      .select()
      .single();
    return newSub;
  }

  return sub;
}

async function checkAndDeductScan(userId: string) {
  const admin = getAdminSafe();
  if (!admin) throw new Error("Erro de conexão com o banco");

  const today = new Date().toISOString().split("T")[0];

  // 1. Verificar uso diário gratuito (limite de 3)
  const { data: usage } = await (admin as any)
    .from("scan_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("data", today)
    .maybeSingle();

  const currentDailyCount = (usage as any)?.count ?? 0;

  if (currentDailyCount < 3) {
    // Usa um scan gratuito diário
    await (admin as any).from("scan_usage").upsert(
      { user_id: userId, data: today, count: currentDailyCount + 1 },
      { onConflict: "user_id,data" }
    );
    return true;
  }

  // 2. Se esgotou os gratuitos, verificar créditos do plano
  const { data: sub } = await (admin as any)
    .from("subscriptions")
    .select("scans_credits")
    .eq("user_id", userId)
    .maybeSingle();

  const credits = (sub as any)?.scans_credits ?? 0;

  if (credits > 0) {
    // Deduz do saldo pago
    await (admin as any)
      .from("subscriptions")
      .update({ scans_credits: credits - 1 })
      .eq("user_id", userId);
    return true;
  }

  throw new Error("Você atingiu o limite de 3 scans gratuitos por dia. Assine um plano para continuar escaneando ou aguarde amanhã!");
}

export async function invokeEdgeInternal(data: { name: string; body?: Body }) {
  const userId = data.body?.user_id ? String(data.body.user_id) : null;

  try {
    // Proteção de IA para chats e buscas inteligentes
    if (data.name === "nutrition-chat") {
      if (!userId) throw new Error("Usuário não identificado");
      const status = await getUserStatus(userId);
      if (!status?.ai_agent_enabled) {
        throw new Error("O chat da inteligência artificial está disponível apenas para assinantes pagantes.");
      }
    }
    // search-food-ai e scan-food são liberados na trial.
    // nutrition-chat é apenas para assinantes (após trial).
    // ...
    
    switch (data.name) {
      case "search-food-ai":
        return await handleSearchFoodAi(data.body);
      case "nutrition-chat":
        return await handleNutritionChat(data.body);
      case "scan-food": {
        if (!userId) throw new Error("Usuário não identificado");
        // Verifica se pode escanear (deduz crédito ou incrementa contador diário)
        await checkAndDeductScan(userId);
        return await handleScanFood(data.body);
      }
      case "food-image":
        return { ok: true };
      case "backfill-food-images":
        return { ok: true, processed: 0, message: "Imagens automáticas desativadas." };
      case "food-lookup":
        return { error: "Lookup indisponível", alimentos: [] };
      default:
        return { error: `Função desconhecida: ${data.name}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
