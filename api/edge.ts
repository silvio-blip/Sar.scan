import type { VercelRequest, VercelResponse } from "@vercel/node";
import { invokeEdgeInternal } from "../src/lib/edge-proxy.server.js";

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
    const result = await invokeEdgeInternal(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
