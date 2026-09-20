import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyStripeSessionInternal } from "../../src/lib/stripe.server.js";

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

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const authHeader = (req.headers.authorization as string) || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const result = await verifyStripeSessionInternal(token, sessionId);
    res.json(result);
  } catch (error: any) {
    console.error("[Vercel /api/stripe/verify-session Error]", error);
    res.status(500).json({ error: error.message || "Erro ao verificar sessão Stripe" });
  }
}
