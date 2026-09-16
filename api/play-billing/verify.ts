import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { verifyGooglePlayPurchaseInternal } from "../../src/lib/google-play.server.js";

// Garantir que as variáveis do .env estão carregadas
loadEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

    const { productId, purchaseToken } = req.body;
    const result = await verifyGooglePlayPurchaseInternal({
      token,
      productId,
      purchaseToken,
    });
    res.json(result);
  } catch (error: any) {
    console.error("[Play Billing Backend Error]", error);
    res.status(500).json({ error: error.message || "Erro desconhecido" });
  }
}
