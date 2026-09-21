import { supabaseAdmin } from "../integrations/supabase/client.server.js";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

import { getAppSettings } from "./settings.server.js";
import { loadEnv } from "./env-loader.server.js";

// Garantir que as variáveis do .env estão carregadas
loadEnv();

type Body = Record<string, unknown> | undefined;

function getAdminSafe() {
  try {
    return supabaseAdmin;
  } catch (e) {
    console.error("[Edge] Supabase admin client not available:", e);
    return null;
  }
}

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

let _cachedKey: string | null = null;
async function getGeminiKey() {
  if (_cachedKey) return _cachedKey;

  const settings = await getAppSettings();
  console.log("[Edge] Settings object keys:", Object.keys(settings));

  const candidateKeys = [
    settings.gemini_api_key,
    settings.GEMINI_API_KEY,
    settings.gemini_key,
    settings.GEMINI_KEY,
    settings.GoogleGeminiApiKey,
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
  ];

  const rawKey = candidateKeys.find((k) => k && k !== "undefined" && k !== "null");
  const key = cleanApiKey(rawKey);

  if (key) {
    _cachedKey = key;
    console.log(
      "[Edge] Gemini key successfully retrieved (first 5 chars):",
      key.substring(0, 5) + "***",
    );
    return key;
  }

  console.error(
    "[Edge] Gemini key NOT found! Settings found:",
    Object.keys(settings),
    "Env has GEMINI_API_KEY:",
    !!process.env.GEMINI_API_KEY,
    "Env has VITE_GEMINI_API_KEY:",
    !!process.env.VITE_GEMINI_API_KEY,
  );
  throw new Error(
    "Chave Gemini não configurada. Defina GEMINI_API_KEY ou VITE_GEMINI_API_KEY no arquivo .env ou nas configurações do ambiente.",
  );
}

async function getGroqKey() {
  const settings = await getAppSettings();
  const rawKey = settings.GROQ_API_KEY || settings.groq_api_key || process.env.GROQ_API_KEY;
  return cleanApiKey(rawKey);
}

async function groqCall(opts: { systemInstruction?: string; contents: GeminiContent[] }) {
  const apiKey = await getGroqKey();
  if (!apiKey) throw new Error("Groq API key not configured");

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemInstruction) {
    messages.push({ role: "system", content: opts.systemInstruction });
  }

  for (const c of opts.contents) {
    const role = c.role === "model" ? "assistant" : "user";
    let textContent = "";
    for (const part of c.parts) {
      if ("text" in part && part.text) {
        textContent += part.text;
      }
    }
    if (textContent) {
      messages.push({ role, content: textContent });
    }
  }

  const groqModels = [
    "llama-3.3-70b-versatile",
    "llama-3.3-70b-specdec",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "llama-3.1-8b-instant",
  ];

  let lastError: any = null;
  for (const model of groqModels) {
    try {
      console.log(`[Groq Call] Tentando modelo: ${model}`);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as any;
      const replyText = data.choices?.[0]?.message?.content || "";
      return { text: replyText };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Groq Call] Modelo ${model} falhou ou inacessível:`, err?.message || err);
    }
  }

  throw lastError || new Error("Todos os modelos do Groq falharam.");
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
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview",
  ];
  let response: any = null;
  let lastErr: any = null;

  for (const m of modelsToTry) {
    try {
      response = await ai.models.generateContent({
        model: m,
        contents: opts.contents,
        config: {
          maxOutputTokens: opts.maxTokens ?? 2048,
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          ...(opts.responseSchema
            ? { responseMimeType: "application/json", responseSchema: opts.responseSchema as any }
            : {}),
        },
      });
      break;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Gemini SDK] Model ${m} failed:`, err?.message || err);
    }
  }

  if (!response) {
    const msg = lastErr?.message || String(lastErr);
    console.error("[Gemini SDK Error All Models Failed]", lastErr);
    if (
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota") ||
      msg.includes("UNAVAILABLE")
    ) {
      throw new Error(
        "Serviço da Gemini temporariamente sobrecarregado (503/429). Tente novamente em alguns segundos.",
      );
    }
    throw new Error(`Erro na API do Gemini: ${msg}`);
  }

  const text = response.text ?? "";
  return { text, raw: response };
}

const ALIMENTOS_SCHEMA = {
  type: "OBJECT",
  properties: {
    alimentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          porcao: { type: "STRING" },
          cal: { type: "NUMBER" },
          carb: { type: "NUMBER" },
          prot: { type: "NUMBER" },
          gord: { type: "NUMBER" },
        },
        required: ["nome", "porcao", "cal", "carb", "prot", "gord"],
      },
    },
  },
  required: ["alimentos"],
};

const SCAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          quantidade: { type: "STRING" },
          cal: { type: "NUMBER" },
          carb: { type: "NUMBER" },
          prot: { type: "NUMBER" },
          gord: { type: "NUMBER" },
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
      "Você é um nutricionista e base de dados mundial de alimentos. Responda apenas com JSON conforme o schema, em português.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Pesquise no mundo inteiro por alimentos, pratos (ex: hambúrgueres, massas, sushi, fast food, pratos típicos de qualquer país) ou marcas cujo nome corresponda ou seja semelhante a "${query}". Liste até 8 opções comuns com nome, porção comum (ex.: "100g", "1 unidade"), calorias e macros (carb, prot, gord em gramas) por porção.`,
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

  let userProfile: any = null;
  let chatHistory: any[] = [];
  const admin = getAdminSafe();

  if (userId) {
    const status = await getUserStatus(userId);
    if (!status?.isAdmin) {
      const planKey = (status?.plan || "free").replace("_cancelled", "").toLowerCase();
      let limit = 30;
      if (planKey === "yearly" || planKey === "annual") {
        limit = 100;
      } else if (planKey === "monthly") {
        limit = 50;
      } else if (planKey === "weekly") {
        limit = 30;
      } else {
        limit = 30;
      }

      if (admin) {
        const { data: usageData } = await (admin as any)
          .from("chat_usage")
          .select("usage_count, last_message_at")
          .eq("user_id", userId)
          .maybeSingle();

        let currentUsage = usageData?.usage_count ?? 0;

        if (usageData?.last_message_at) {
          const lastDate = new Date(usageData.last_message_at).toDateString();
          const today = new Date().toDateString();
          if (lastDate !== today) {
            currentUsage = 0;
          }
        }

        if (currentUsage >= limit) {
          throw new Error(
            `Você atingiu o limite diário de ${limit} mensagens do seu plano. O limite será renovado amanhã!`,
          );
        }
      }
    }

    if (admin) {
      try {
        const { data: prof } = await (admin as any)
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        userProfile = prof;

        const { data: hist } = await (admin as any)
          .from("chat_messages")
          .select("role, content")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(10);
        if (hist) chatHistory = hist;
      } catch (err) {
        console.warn("[Nutrition Chat] Failed to fetch profile or history:", err);
      }
    }
  }

  const profileContext = userProfile
    ? `Dados do usuário: Nome: ${userProfile.nome || "Usuário"}, Peso: ${userProfile.peso || "Não informado"}kg, Altura: ${userProfile.altura || "Não informada"}cm, Objetivo: ${userProfile.objetivo || "Não informado"}, Dieta/Preferências: ${userProfile.dieta || "Não informado"}.`
    : "";

  const systemInstruction = `Você é um nutricionista brasileiro e uma inteligência artificial ESTRITAMENTE focado em nutrição, dietas, alimentos, calorias e saúde metabólica.
${profileContext}

DIRETRIZES DE ESCOPO ABSOLUTAS (OBRIGATÓRIO):
1. RESPOSTA EXCLUSIVA DE NUTRIÇÃO E SAÚDE: Você só está autorizado a responder a perguntas diretamente relacionadas a nutrição, alimentação, saúde metabólica, calorias, receitas e dietas. Se o usuário fizer qualquer pergunta fora deste escopo, responda: "Desculpe, fui projetado exclusivamente para ajudar com nutrição, dietas e saúde."
2. RESPOSTAS CURTAS, DIRETAS E CONCISAS: Seja extremamente direto e conciso. Responda com um resumo rápido de poucas linhas ou um parágrafo breve. Evite explicações prolixas.
3. Se o usuário enviar uma foto de prato de comida ou alimento, analise detalhadamente os ingredientes, calorias e macronutrientes.
4. NUNCA gere blocos [APLICAR_MELHORIAS: ...] a menos que o usuário solicite explicitamente a criação ou alteração de um plano nutricional ou meta. Em conversas normais, dúvidas do dia a dia, cálculos de água ou orientações, responda APENAS com texto explicativo conciso, sem nenhum bloco de plano automático.`;

  const contents: any[] = [];
  chatHistory.forEach((h) => {
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  });

  const userParts: any[] = [{ text: message || "Analise esta imagem nutricional." }];
  if (body.image) {
    const base64Data = String(body.image).includes(",")
      ? String(body.image).split(",")[1]
      : String(body.image);
    const mimeType = body.imageMimeType || "image/jpeg";
    userParts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }
  contents.push({ role: "user", parts: userParts });

  let text = "";
  const hasImage = !!body.image;

  if (!hasImage) {
    try {
      console.log("[Nutrition Chat] Tentando disparar agente Groq (texto puro)...");
      const groqRes = await groqCall({ systemInstruction, contents });
      text = groqRes.text;
      console.log("[Nutrition Chat] Resposta obtida via Groq com sucesso.");
    } catch (groqErr: any) {
      console.warn(
        "[Nutrition Chat] Groq falhou ou indisponível, fallback automático para Gemini:",
        groqErr?.message,
      );
      const geminiRes = await geminiCall({ systemInstruction, contents });
      text = geminiRes.text;
    }
  } else {
    console.log(
      "[Nutrition Chat] Imagem detetada, encaminhando diretamente para agente Gemini Vision...",
    );
    const geminiRes = await geminiCall({ systemInstruction, contents });
    text = geminiRes.text;
  }

  const reply = text || "Não consegui responder agora.";

  if (userId && admin) {
    try {
      await (admin as any).from("chat_messages").insert([
        { user_id: userId, role: "user", content: message },
        { user_id: userId, role: "assistant", content: reply },
      ]);
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
      "Você é um especialista em nutrição e visão computacional em saúde. Identifique todos os alimentos/bebidas visíveis na imagem e estime detalhadamente a quantidade e os macronutrientes de cada um. Responda APENAS com JSON em português, seguindo estritamente a estrutura e tipos do responseSchema.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Identifique detalhadamente e liste cada alimento separadamente nesta imagem (ex.: arroz integral, feijão carioca, peito de frango grelhado, salada de tomate e alface). Para cada item detectado informe: nome, quantidade estimada (ex: '150g', '1 unidade', '1 concha'), calorias, e macronutrientes correspondentes àquela quantidade (carb, prot e gord em gramas).\n\nInstrução Importante: Se a imagem contiver qualquer tipo de prato de refeição, lanche, mantimento ou alimento que seja difícil de identificar exatamente devido a iluminação ou enquadramento, não desista ou retorne uma lista vazia. Pelo contrário, realize uma estimativa razoável (por exemplo, chame de 'Refeição Analisada' ou 'Alimento Estimado', com calorias coerentes de 350-500 kcal e macros balanceados), garantindo que o usuário possa de forma flexível arrumar e refinar as quantidades e nomes depois no diário.",
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
        "Não conseguimos identificar um alimento nessa imagem. Tente tirar outra foto mais de perto, com melhor enquadramento e sob boa iluminação.",
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

export async function getUserStatus(userId: string) {
  const admin = getAdminSafe();
  if (!admin) return null;

  const [{ data: sub }, { data: roles }, { data: profile }] = await Promise.all([
    (admin as any)
      .from("subscriptions")
      .select("status, scans_credits, ai_agent_enabled, current_period_end, plan")
      .eq("user_id", userId)
      .maybeSingle(),
    (admin as any).from("user_roles").select("role").eq("user_id", userId),
    (admin as any).from("profiles").select("email").eq("id", userId).maybeSingle(),
  ]);

  const isAdmin =
    roles?.some((r: any) => r.role === "admin") || profile?.email === "silviok5000@gmail.com";

  let finalSub = sub;

  if (finalSub && finalSub.status === "active" && finalSub.current_period_end) {
    const expired = new Date(finalSub.current_period_end) < new Date();
    if (expired) {
      console.log(
        `[Backend Status] User ${userId} subscription expired dynamically at ${finalSub.current_period_end}. Revoking status to free.`,
      );
      await (admin as any)
        .from("subscriptions")
        .update({ status: "free", plan: null, ai_agent_enabled: false })
        .eq("user_id", userId);

      finalSub = {
        ...finalSub,
        status: "free",
        plan: null,
        ai_agent_enabled: false,
        scans_credits: finalSub.scans_credits,
      };
    }
  }

  // Se não existir subscription, criamos o teste grátis de 7 dias com 30 créditos
  if (!finalSub) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const { data: newSub } = await (admin as any)
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "trialing",
        trial_end: trialEnd.toISOString(),
        scans_credits: 30,
        plan: "trial",
        ai_agent_enabled: true,
      })
      .select()
      .single();
    finalSub = newSub;
  }

  // Se for usuário free (sem plano ou status free), redefinir seus créditos para 3 a cada 24h
  if (finalSub && finalSub.status === "free") {
    const dailyLimit = 3;
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await (admin as any)
      .from("scan_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("data", today)
      .maybeSingle();

    if (!usage) {
      // É um novo dia para o usuário. Reinicia seus créditos de scans para o limite diário.
      console.log(
        `[Daily Reset Backend] Resetando scans_credits para ${dailyLimit} do usuário free: ${userId}`,
      );

      // Salva marcação em scan_usage de hoje para evitar repetir este loop no mesmo dia
      await (admin as any)
        .from("scan_usage")
        .insert({ user_id: userId, data: today, count: 0, bonus: 0 });

      if (finalSub.scans_credits < dailyLimit) {
        await (admin as any)
          .from("subscriptions")
          .update({ scans_credits: dailyLimit })
          .eq("user_id", userId);

        finalSub = {
          ...finalSub,
          scans_credits: dailyLimit,
        };
      }
    }
  }

  return { ...finalSub, isAdmin };
}

export async function checkEligibility(userId: string) {
  const admin = getAdminSafe();
  if (!admin) throw new Error("Erro de conexão com o banco");

  const status = await getUserStatus(userId);
  if (status?.isAdmin) return { type: "admin" as const, val: -1 };

  // Unificação: a elegibilidade e quantidade de fotos do usuário livre ou pago é medida direto pelo campo scans_credits
  const credits = status?.scans_credits ?? 0;
  if (credits > 0) {
    return { type: "paid" as const, val: credits };
  }

  throw new Error(
    "Você atingiu o limite de 3 scans gratuitos por dia. Assine um plano para continuar escaneando ou aguarde amanhã!",
  );
}

export async function deductScan(
  userId: string,
  eligibility: { type: "free" | "paid" | "admin"; val: number },
) {
  if (eligibility.type === "admin" || eligibility.val < 0) return; // Admin não deduz nada

  const admin = getAdminSafe();
  const today = new Date().toISOString().split("T")[0];

  // Deduzir 1 crédito de scans_credits do usuário
  await (admin as any)
    .from("subscriptions")
    .update({ scans_credits: Math.max(0, eligibility.val - 1) })
    .eq("user_id", userId);

  // Também incrementar o scan_usage para auditoria/estatística
  try {
    const { data: usage } = await (admin as any)
      .from("scan_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("data", today)
      .maybeSingle();

    const currentCount = usage?.count ?? 0;
    await (admin as any)
      .from("scan_usage")
      .upsert(
        { user_id: userId, data: today, count: currentCount + 1 },
        { onConflict: "user_id,data" },
      );
  } catch (err) {
    console.warn("[Backend deductScan] Falha ao incrementar scan_usage para estatística:", err);
  }
}

export async function invokeEdgeInternal(data: { name: string; body?: Body }) {
  const userId = data.body?.user_id ? String(data.body.user_id) : null;
  const isPopularSearch = data.name === "search-food-ai" && data.body?.mode === "popular";

  try {
    // Proteção de IA para chats e buscas inteligentes
    if (
      data.name === "nutrition-chat" ||
      data.name === "search-food-ai" ||
      data.name === "scan-food"
    ) {
      if (!isPopularSearch) {
        if (!userId) throw new Error("Usuário não identificado");
      }
    }
    // search-food-ai e scan-food são liberados na trial.
    // nutrition-chat é apenas para assinantes (após trial).
    // ...

    switch (data.name) {
      case "password-reset":
        return await handlePasswordReset(data.body);
      case "search-food-ai": {
        if (isPopularSearch) {
          return await handleSearchFoodAi(data.body);
        }
        if (!userId) throw new Error("Usuário não identificado");

        // Verifica se pode usar IA (deduz crédito ou incrementa contador diário)
        const eligibility = await checkEligibility(userId);
        const result = await handleSearchFoodAi(data.body);
        // Se a busca retornar resultados (não for popular/vazia), deduzimos
        if (result && Array.isArray(result.alimentos) && result.alimentos.length > 0) {
          await deductScan(userId, eligibility);
        }
        return result;
      }
      case "update-plan-status": {
        const msgId = String(data.body?.msg_id ?? "");
        const status = String(data.body?.status ?? "");
        if (!msgId || !status) throw new Error("Parâmetros incompletos");
        const admin = getAdminSafe();
        if (!admin) throw new Error("Admin client unavailable");

        const { data: msg } = await (admin as any)
          .from("chat_messages")
          .select("*")
          .eq("id", msgId)
          .maybeSingle();

        if (!msg) throw new Error("Mensagem não encontrada");

        const currentContent = msg.content || "";
        const updatedContent = currentContent.includes("[PLAN_STATUS:")
          ? currentContent.replace(/\[PLAN_STATUS:[^\]]+\]/, `[PLAN_STATUS:${status}]`)
          : currentContent + ` [PLAN_STATUS:${status}]`;

        const { error } = await (admin as any)
          .from("chat_messages")
          .update({ content: updatedContent })
          .eq("id", msgId);

        if (error) throw error;
        return { success: true };
      }
      case "nutrition-chat":
        return await handleNutritionChat(data.body);
      case "scan-food": {
        if (!userId) throw new Error("Usuário não identificado");
        // Verifica se pode escanear
        const eligibility = await checkEligibility(userId);
        const result = await handleScanFood(data.body);
        if (result.ok) {
          await deductScan(userId, eligibility);
        }
        return result;
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

async function handlePasswordReset(body: Body) {
  const action = body?.action as string;
  const email = (body?.email as string)?.toLowerCase().trim();
  const admin = getAdminSafe();
  if (!admin) throw new Error("Erro de conexão com o banco");

  if (action === "request") {
    if (!email) throw new Error("Email é obrigatório");

    // 1. Try to find the user in profiles table first (this is fast, and works with public fallback keys)
    let targetUserId: string | null = null;
    try {
      const { data: profileRecord, error: profileError } = await (admin as any)
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!profileError && profileRecord) {
        targetUserId = profileRecord.id;
        console.log(`[Password Reset] User found in profiles table: ${targetUserId}`);
      }
    } catch (profileErr) {
      console.warn("[Password Reset] Querying profiles table failed:", profileErr);
    }

    // 2. Fall back to listing auth users only if the profiles table didn't yield a result
    if (!targetUserId) {
      try {
        const { data: userData, error: listError } = await (admin as any).auth.admin.listUsers();
        if (listError) {
          console.warn("[Password Reset] listUsers returned error:", listError.message);
        } else if (userData?.users) {
          const targetUser = userData.users.find(
            (u: any) => u.email?.toLowerCase().trim() === email,
          );
          if (targetUser) {
            targetUserId = targetUser.id;
            console.log(`[Password Reset] User found via listUsers: ${targetUserId}`);
          }
        }
      } catch (authErr) {
        console.warn("[Password Reset] Calling listUsers threw an error:", authErr);
      }
    }

    if (!targetUserId) {
      throw new Error("O e-mail inserido não corresponde a uma conta cadastrada no sistema");
    }

    // Generate 15 digit/char code
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let code = "";
    for (let i = 0; i < 15; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    // Delete existing codes first to avoid constraint and duplicate issues
    try {
      const { error: deleteError } = await (admin as any)
        .from("password_reset_codes")
        .delete()
        .eq("email", email);
      if (deleteError) {
        console.warn("[Password Reset] Explicit delete returned error:", deleteError.message);
      } else {
        console.log(
          `[Password Reset] Successfully deleted any existing recovery codes for: ${email}`,
        );
      }
    } catch (delErr: any) {
      console.warn("[Password Reset] Delete before insert threw exception:", delErr.message);
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora de expiração

    // Use upsert to safely replace or insert the code for the primary key (email)
    let insertResult = await (admin as any).from("password_reset_codes").upsert({
      email,
      code,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      user_id: targetUserId,
    });

    if (
      insertResult.error &&
      (insertResult.error.message.includes("user_id") ||
        insertResult.error.message.includes("column") ||
        insertResult.error.message.includes("schema cache"))
    ) {
      console.warn("[Password Reset] Retrying upsert without user_id...");
      insertResult = await (admin as any).from("password_reset_codes").upsert({
        email,
        code,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    }

    if (
      insertResult.error &&
      (insertResult.error.message.includes("expires_at") ||
        insertResult.error.message.includes("column") ||
        insertResult.error.message.includes("schema cache"))
    ) {
      console.warn("[Password Reset] Retrying upsert without expires_at...");
      insertResult = await (admin as any).from("password_reset_codes").upsert({
        email,
        code,
        created_at: new Date().toISOString(),
        user_id: targetUserId,
      });
    }

    if (insertResult.error) {
      console.warn("[Password Reset] Retrying upsert with minimal fields...");
      insertResult = await (admin as any).from("password_reset_codes").upsert({
        email,
        code,
      });
    }

    if (insertResult.error) {
      throw new Error(`Erro ao guardar código de segurança: ${insertResult.error.message}`);
    }

    // SMTP Send
    console.log(`[SMTP] Enviando código para ${email}: ${code}`);
    const settings = await getAppSettings();
    const smtpHost = settings.SMTP_HOST || process.env.SMTP_HOST;
    const smtpUser = settings.SMTP_USER || process.env.SMTP_USER;
    const smtpPass = settings.SMTP_PASS || process.env.SMTP_PASS;
    const smtpPort = settings.SMTP_PORT || process.env.SMTP_PORT || "587";
    const smtpSecure = (settings.SMTP_SECURE || process.env.SMTP_SECURE || "") === "true";
    const smtpSender = settings.SMTP_SENDER || process.env.SMTP_SENDER || smtpUser;

    if (smtpHost && smtpUser) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: smtpSender,
          to: email,
          subject: "Redefinição de Senha",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #007bff;">Redefinição de Senha</h2>
              <p>Olá,</p>
              <p>Recebemos uma solicitação para redefinir a sua senha. Utilize o código de segurança abaixo para prosseguir:</p>
              <div style="padding: 20px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                ${code}
              </div>
              <p>Se você não solicitou esta redefinição, por favor, ignore este e-mail.</p>
              <p>Atenciosamente,<br>Equipe Sar.Scan</p>
            </div>
          `,
        });
        console.log(`[SMTP] E-mail enviado com sucesso para ${email}`);
        return { success: true };
      } catch (err: any) {
        console.error(`[SMTP] Erro ao enviar e-mail para ${email}:`, err);
        return { success: true, warning: "smtp_failed", code, errorDetails: err.message };
      }
    } else {
      console.warn(
        "[SMTP] Configuração de SMTP incompleta. Retornando código de segurança para uso ou simulação local.",
      );
      return { success: true, warning: "smtp_missing", code };
    }
  } else if (action === "verify") {
    const code = body?.code as string;
    if (!email || !code) throw new Error("Dados incompletos");

    const { data: record } = await (admin as any)
      .from("password_reset_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code.trim())
      .maybeSingle();

    if (!record) {
      throw new Error("Código de segurança inválido ou expirado");
    }

    return { success: true };
  } else if (action === "confirm") {
    const code = body?.code as string;
    const password = body?.password as string;

    if (!email || !code || !password) throw new Error("Dados incompletos");

    const { data: record } = await (admin as any)
      .from("password_reset_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .maybeSingle();

    if (!record) {
      throw new Error("Código de segurança inválido ou expirado");
    }

    let targetUserId = record.user_id;
    if (!targetUserId) {
      console.log("[Password Reset] user_id not stored in record, finding via listUsers...");
      try {
        const { data: userData } = await (admin as any).auth.admin.listUsers();
        if (userData?.users) {
          const targetUser = userData.users.find(
            (u: any) => u.email?.toLowerCase().trim() === email.toLowerCase().trim(),
          );
          if (targetUser) {
            targetUserId = targetUser.id;
          }
        }
      } catch (authErr) {
        console.warn("[Password Reset] Failed to retrieve targetUserId from email:", authErr);
      }
    }

    if (!targetUserId) {
      throw new Error("Usuário não associado ao código de redefinição");
    }

    // Update password using admin auth
    try {
      const { error: updateError } = await (admin as any).auth.admin.updateUserById(targetUserId, {
        password: password,
      });

      if (updateError) {
        throw new Error(`Erro na atualização de senha no Supabase: ${updateError.message}`);
      }
    } catch (authErr: any) {
      console.error("[Password Reset] Error modifying user password:", authErr);
      throw new Error(
        authErr?.message ||
          "Não foi possível atualizar a senha. Verifique se o backend possui a chave SUPABASE_SERVICE_ROLE_KEY configurada.",
      );
    }

    // Delete code
    await (admin as any).from("password_reset_codes").delete().eq("email", email);

    return { success: true };
  }
  throw new Error("Ação inválida");
}
