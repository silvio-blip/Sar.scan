import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../src/lib/env-loader.server.js";
import { getAppSettings } from "../src/lib/settings.server.js";
import { checkEligibility, deductScan } from "../src/lib/edge-proxy.server.js";

// Garantir que as variáveis do .env estão carregadas
loadEnv();

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, stripe-signature",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { base64Data: rawBase64Data, user_id: userId, deduct_on_fail: deductOnFail } = req.body;

    let eligibility: any = null;
    if (userId) {
      // Verifica elegibilidade e lança erro caso não possua créditos / limite diário
      eligibility = await checkEligibility(userId);
    }

    const settings = await getAppSettings().catch((err) => {
      console.warn("[Vercel] Falha ao buscar app_settings:", err);
      return {} as any;
    });

    const candidateKeys = [
      settings?.gemini_api_key,
      settings?.GEMINI_API_KEY,
      settings?.gemini_key,
      settings?.GEMINI_KEY,
      settings?.GoogleGeminiApiKey,
      process.env.GEMINI_API_KEY,
      process.env.VITE_GEMINI_API_KEY,
    ];
    const rawApiKey = candidateKeys.find((k) => k && k !== "undefined" && k !== "null");
    const apiKey = cleanApiKey(rawApiKey);

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured (checked app_settings table, process.env.GEMINI_API_KEY and VITE_GEMINI_API_KEY). Certifique-se de configurar a variável no painel de controle ou no arquivo .env.",
      );
    }

    // Remove prefixo se existir (ex: data:image/jpeg;base64,...) e extrai o mimeType
    const parts = rawBase64Data.split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];

    // Tenta extrair o mimeType (ex: "data:image/webp;base64" -> "image/webp")
    const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    const promptText = `Analisa esta imagem de comida.
Retorna UM OBJETO JSON ESTRITAMENTE, sem texto extra, markdown, ou explicações.
O formato deve ser exatamente:
{
  "itens": [
    { 
      "nome": "string",
      "quantidade": "string (ex: 100g, 1 unidade)",
      "cal": number, 
      "carb": number, 
      "prot": number, 
      "gord": number 
    }
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API do Gemini (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    const textoFinal = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Verificar se algum alimento foi de fato identificado
    let hasFoods = false;
    try {
      const cleanJson = textoFinal.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const list = parsed?.itens || parsed?.items || [];
      if (Array.isArray(list) && list.length > 0) {
        hasFoods = true;
      }
    } catch (err) {
      console.warn("[Vercel] Parsing response text failed:", err);
    }

    // Se elegível e houve identificação ou se foi a 3ª falha consecutiva, cobramos o scan
    if (userId && eligibility) {
      if (hasFoods || deductOnFail) {
        console.log(
          `[Billing Vercel] Debitante scan do usuário ${userId}. Motivo: hasFoods=${hasFoods}, deductOnFail=${deductOnFail}`,
        );
        await deductScan(userId, eligibility);
      }
    }

    res.json({ result: textoFinal });
  } catch (error: any) {
    console.error("[Vercel] /api/gemini-scan error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
