import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    const { base64Data: rawBase64Data } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured (checked process.env.GEMINI_API_KEY and VITE_GEMINI_API_KEY). Certifique-se de configurar a variável no painel de controle da Vercel.",
      );
    }

    // Remove prefixo se existir (ex: data:image/jpeg;base64,...) e extrai o mimeType
    const parts = rawBase64Data.split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];

    // Tenta extrair o mimeType (ex: "data:image/webp;base64" -> "image/webp")
    const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
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
    const result = await model.generateContent([
      promptText,
      { inlineData: { data: base64Data, mimeType: mimeType } },
    ]);
    const textoFinal = await result.response.text();
    res.json({ result: textoFinal });
  } catch (error: any) {
    console.error("[Vercel] /api/gemini-scan error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
