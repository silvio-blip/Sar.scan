import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler, { config as webhookConfig } from "./stripe/webhook.js";

export const config = webhookConfig;
export default async function rootWebhookHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
