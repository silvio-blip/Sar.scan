import express from "express";
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "./env-loader.server.js";
import { invokeEdgeInternal, checkEligibility, deductScan } from "./edge-proxy.server.js";
import {
  createStripeCheckoutInternal,
  syncStripePlansInternal,
  verifyStripeSessionInternal,
} from "./stripe.server.js";
import { handleStripeWebhook } from "./stripe.webhook.js";
import {
  verifyGooglePlayPurchaseInternal,
  cancelSubscriptionInternal,
  syncSubscriptionStatusInternal,
  reactivateSubscriptionInternal,
} from "./google-play.server.js";
import { applyCampaignBonusInternal } from "./campaign.server.js";
import { supabaseAdmin } from "../integrations/supabase/client.server.js";
import { getAppSettings } from "./settings.server.js";

loadEnv();

function cleanApiKey(val: string | undefined | null): string | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.trim();
  if (
    !cleaned ||
    cleaned === "undefined" ||
    cleaned === "null" ||
    cleaned === '""' ||
    cleaned === "''"
  ) {
    return null;
  }
  return cleaned;
}

export function createApiApp() {
  const app = express();

  // Enable CORS middleware for all development, staging and production origins
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, stripe-signature",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(
    express.json({
      limit: "50mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy for invokeEdge / gemini-scan
  app.post("/api/gemini-scan", async (req, res) => {
    try {
      const {
        base64Data: rawBase64Data,
        user_id: userId,
        deduct_on_fail: deductOnFail,
      } = req.body || {};

      let eligibility: any = null;
      if (userId) {
        eligibility = await checkEligibility(userId);
      }

      const settings = await getAppSettings().catch((err) => {
        console.warn("[Server] Falha ao buscar app_settings:", err);
        return {} as any;
      });

      const candidateKeys = [
        settings?.gemini_api_key,
        settings?.GEMINI_API_KEY,
        settings?.gemini_key,
        settings?.GEMINI_KEY,
        settings?.GoogleGeminiApiKey,
        process.env.GEMINI_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
      ];
      const rawApiKey = candidateKeys.find((k) => k && k !== "undefined" && k !== "null");
      const apiKey = cleanApiKey(rawApiKey);

      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY não configurada. Configure em 'Settings > Secrets' ou nas variáveis de ambiente.",
        );
      }

      const parts = (rawBase64Data || "").split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      let userProfileContext = "";
      if (userId) {
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          if (profile) {
            userProfileContext = `
Dados e Perfil do Utilizador:
- Objetivo principal: ${profile.objetivo || "manter"} (opções: perder gordura, manter, ganhar massa)
- Peso atual: ${profile.peso || "não informado"} kg
- Altura: ${profile.altura || "não informado"} cm
- Meta de peso: ${profile.meta_peso || "não informado"} kg
- Calorias diárias alvo: ${profile.calorias_meta || "não informado"} kcal
`;
          }
        } catch (e) {
          console.warn(
            "[Server] Falha ao buscar perfil para análise nutricional personalizada:",
            e,
          );
        }
      }

      const promptText = `Analisa esta imagem de comida no contexto do perfil e objetivos do utilizador.
${userProfileContext}

Retorna UM OBJETO JSON ESTRITAMENTE, sem texto extra, markdown ou explicações fora do JSON.
O formato deve ser exatamente:
{
  "itens": [
    { 
      "nome": "string",
      "quantidade": "string (ex: 100g, 1 unidade)",
      "cal": number, 
      "carb": number, 
      "prot": number, 
      "gord": number 
    }
  ],
  "feedback_meta": "string breve, direta e encorajadora em português (PT) explicando ao utilizador como este alimento impacta a sua meta específica (seja perder gordura, manter ou ganhar massa), indicando se o aproxima ou afasta da meta, balanço calórico/nutricional e uma recomendação prática."
}`;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let aiResponse;
      const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];
      let lastError: any = null;

      for (const m of modelsToTry) {
        try {
          aiResponse = await ai.models.generateContent({
            model: m,
            contents: [
              {
                role: "user",
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
          });
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[Server] Model ${m} failed, trying next...`, e?.message || e);
        }
      }

      if (!aiResponse) {
        throw lastError || new Error("Falha ao gerar resposta com os modelos Gemini.");
      }

      const textoFinal = aiResponse.text || "";
      let hasFoods = false;
      try {
        const cleanJson = textoFinal.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        const list = parsed?.itens || parsed?.items || [];
        if (Array.isArray(list) && list.length > 0) {
          hasFoods = true;
        }
      } catch (err) {
        console.warn("[Server] Parsing response text failed:", err);
      }

      if (userId && eligibility) {
        if (hasFoods || deductOnFail) {
          console.log(
            `[Billing] Debitando scan do utilizador ${userId}. Motivo: hasFoods=${hasFoods}, deductOnFail=${deductOnFail}`,
          );
          await deductScan(userId, eligibility);
        }
      }

      res.json({ result: textoFinal });
    } catch (error: any) {
      console.error("[Server] /api/gemini-scan error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Edge function proxy
  app.post("/api/edge", async (req, res) => {
    try {
      console.log("[Server] /api/edge received request:", req.body?.name);
      const result = await invokeEdgeInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error("[Server] /api/edge error:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Notifications
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const { targetUserId, title, body, data, customData } = req.body || {};
      const fcmPayloadData = data || customData || {};
      if (!targetUserId) {
        return res.status(400).json({ error: "O campo targetUserId é obrigatório." });
      }

      console.log(
        `[Push] Tentando enviar notificação para utilizador ${targetUserId}: ${title} - ${body}`,
      );

      const admin = supabaseAdmin;
      if (!admin) {
        return res.status(500).json({ error: "Supabase Admin não disponível." });
      }

      const { data: recipientProfile, error: profileError } = await (admin as any)
        .from("profiles")
        .select("fcm_token, nome")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileError || !recipientProfile) {
        console.error("[Push] Erro ao buscar perfil do destinatário:", profileError);
        return res.status(404).json({ error: "Perfil do destinatário não encontrado." });
      }

      const fcmToken = recipientProfile.fcm_token;
      if (!fcmToken) {
        console.warn(`[Push] Utilizador ${targetUserId} não tem FCM token cadastrado.`);
        return res.json({
          success: false,
          message: "Destinatário não tem fcm_token registrado no perfil.",
        });
      }

      const settings = await getAppSettings();
      const serverKey =
        settings.fcm_server_key || process.env.FCM_SERVER_KEY || process.env.VITE_FCM_SERVER_KEY;
      let fcmResultLog = null;

      if (!serverKey) {
        console.warn("[Push] FCM_SERVER_KEY não configurada no servidor.");
      } else {
        const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            Authorization: `key=${serverKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: fcmToken,
            notification: {
              title,
              body,
              sound: "default",
              badge: 1,
            },
            data: fcmPayloadData,
          }),
        });

        if (!fcmResponse.ok) {
          const errorText = await fcmResponse.text();
          console.error("[Push] Erro ao disparar FCM:", errorText);
          throw new Error(`FCM API responded with status ${fcmResponse.status}: ${errorText}`);
        }

        const fcmResult = await fcmResponse.json();
        console.log("[Push] Notificação disparada com sucesso via FCM:", fcmResult);
        fcmResultLog = fcmResult;
      }

      res.json({ success: true, fcmResult: fcmResultLog });
    } catch (error: unknown) {
      console.error("[Push] Erro crítico no envio da notificação:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Checkout
  app.post("/api/stripe/checkout", async (req, res) => {
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Verify Session
  app.post("/api/stripe/verify-session", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
      const { sessionId } = req.body || {};
      const result = await verifyStripeSessionInternal(token, sessionId);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao verificar sessão Stripe";
      res.status(500).json({ error: msg });
    }
  });

  // Google Play Billing verification route
  app.post("/api/play-billing/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
      const { productId, purchaseToken } = req.body || {};
      const result = await verifyGooglePlayPurchaseInternal({
        token,
        productId,
        purchaseToken,
      });
      res.json(result);
    } catch (error: unknown) {
      console.error("[Play Billing Backend Error]", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Campaign Apply Route (atomic & persistent to prevent duplicate bonuses)
  app.post("/api/campaign/apply", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { data: userData, error: userErr } = await (supabaseAdmin as any).auth.getUser(token);
      if (userErr || !userData?.user?.id) {
        res.status(401).json({ error: "Invalid session" });
        return;
      }
      const result = await applyCampaignBonusInternal(userData.user.id);
      res.json(result);
    } catch (error: unknown) {
      console.error("[Campaign Apply API Error]", error);
      const msg = error instanceof Error ? error.message : "Erro ao processar bônus da campanha";
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Sync
  app.post("/api/stripe/sync", async (req, res) => {
    try {
      const result = await syncStripePlansInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Subscription Cancel
  app.post("/api/subscriptions/cancel", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
      const { immediate } = req.body || {};

      const result = await cancelSubscriptionInternal({
        token,
        immediate: Boolean(immediate),
      });
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao cancelar assinatura";
      if (msg.startsWith("Unauthorized")) {
        res.status(401).json({ error: msg });
        return;
      }
      console.error("[Subscription Cancel Error]", error);
      res.status(500).json({ error: msg });
    }
  });

  // Subscription Sync Status
  app.post("/api/subscriptions/sync-status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

      const result = await syncSubscriptionStatusInternal({ token });
      res.json(result);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Erro ao sincronizar status da assinatura";
      if (msg.startsWith("Unauthorized")) {
        res.status(401).json({ error: msg });
        return;
      }
      console.error("[Subscription Sync Error]", error);
      res.status(500).json({ error: msg });
    }
  });

  // Subscription Reactivate
  app.post("/api/subscriptions/reactivate", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

      const result = await reactivateSubscriptionInternal({ token });
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao reativar assinatura";
      if (msg.startsWith("Unauthorized")) {
        res.status(401).json({ error: msg });
        return;
      }
      console.error("[Subscription Reactivate Error]", error);
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Webhooks
  const webhookHandler = async (req: any, res: any) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      const rawPayload = req.rawBody
        ? req.rawBody.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);
      const result = await handleStripeWebhook(rawPayload, sig);
      res.json(result || { received: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[Webhook Error]", msg);
      res.status(400).send(msg);
    }
  };

  app.post("/api/public/stripe-webhook", webhookHandler);
  app.post("/api/stripe/webhook", webhookHandler);
  app.post("/api/webhook/stripe", webhookHandler);

  return app;
}
