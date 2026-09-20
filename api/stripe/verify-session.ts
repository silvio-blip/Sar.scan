import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { verifyStripeSessionInternal } from "../../src/lib/stripe.server.js";

// Ensure environment variables are loaded
loadEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, stripe-signature",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: "O parâmetro sessionId é obrigatório." });
    }

    console.log(`[Vercel /api/stripe/verify-session] Verificando sessão: ${sessionId}`);
    const result = await verifyStripeSessionInternal(token, sessionId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Vercel /api/stripe/verify-session error]:", error);
    return res.status(500).json({ error: error.message || "Erro ao verificar sessão Stripe" });
  }
}
