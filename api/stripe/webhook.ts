import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { handleStripeWebhook } from "../../src/lib/stripe.webhook.js";

// Ensure environment variables are loaded
loadEnv();

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

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
    const rawBody = await getRawBody(req);
    const sig = (req.headers["stripe-signature"] as string) || null;
    console.log(
      `[Vercel /api/stripe/webhook] Recebido webhook do Stripe (bytes: ${rawBody.length})`,
    );
    const result = await handleStripeWebhook(rawBody, sig);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Vercel /api/stripe/webhook error]:", error.message || error);
    return res.status(500).json({ error: error.message || "Erro interno no webhook" });
  }
}
