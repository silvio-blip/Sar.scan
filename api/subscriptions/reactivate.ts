import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reactivateSubscriptionInternal } from "../../src/lib/google-play.server.js";

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

    const result = await reactivateSubscriptionInternal({ token });
    res.json(result);
  } catch (error: any) {
    const msg = error?.message || "Erro ao reativar assinatura";
    if (msg.startsWith("Unauthorized")) {
      return res.status(401).json({ error: msg });
    }
    console.error("[Vercel /api/subscriptions/reactivate Error]", error);
    res.status(500).json({ error: msg });
  }
}
