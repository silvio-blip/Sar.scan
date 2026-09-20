import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleStripeWebhook } from "../../src/lib/stripe.webhook.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
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

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const rawBody = await getRawBody(req);
    const sig = (req.headers["stripe-signature"] as string) || null;
    const result = await handleStripeWebhook(rawBody, sig);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("[Vercel /api/stripe/webhook Error]", error.message);
    res.status(400).json({ error: error.message });
  }
}
