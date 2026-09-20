import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { syncSubscriptionStatusInternal } from "../../src/lib/google-play.server.js";

// Ensure environment variables are loaded
loadEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
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

    console.log("[Vercel /api/subscriptions/sync-status] Sincronizando status de assinatura...");
    const result = await syncSubscriptionStatusInternal({ token });
    return res.status(200).json(result);
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : "Erro ao sincronizar status da assinatura";
    if (msg.startsWith("Unauthorized")) {
      return res.status(401).json({ error: msg });
    }
    console.error("[Vercel /api/subscriptions/sync-status error]:", error);
    return res.status(500).json({ error: msg });
  }
}
