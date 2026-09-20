import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { createStripeCheckoutInternal } from "../../src/lib/stripe.server.js";

loadEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
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
    const origin =
      req.body?.origin ||
      req.headers.origin ||
      (req.headers.referer ? new URL(req.headers.referer as string).origin : "") ||
      "";
    const result = await createStripeCheckoutInternal({
      ...req.body,
      origin: origin || undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
