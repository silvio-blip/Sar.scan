import type { VercelRequest, VercelResponse } from "@vercel/node";
import { invokeEdgeInternal } from "../src/lib/edge-proxy.server.ts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    const result = await invokeEdgeInternal(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
