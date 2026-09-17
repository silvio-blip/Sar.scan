import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import { loadEnv } from "./src/lib/env-loader.server";
loadEnv();

import { invokeEdgeInternal, checkEligibility, deductScan } from "./src/lib/edge-proxy.server";
import { createStripeCheckoutInternal, syncStripePlansInternal } from "./src/lib/stripe.server";
import { handleStripeWebhook } from "./src/lib/stripe.webhook";
import { verifyGooglePlayPurchaseInternal } from "./src/lib/google-play.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { getAppSettings } from "./src/lib/settings.server";

// Logic from edge-proxy and stripe functions
// Since we want to keep it simple, we'll import the logic directly if possible or copy it.
// To avoid complex restructuring, I'll define the API routes here and use the logic from the existing files.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.use(express.json({ limit: "50mb" }));

  // API Routes

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

  // Proxy for invokeEdge
  app.post("/api/gemini-scan", async (req, res) => {
    try {
      const { base64Data: rawBase64Data, user_id: userId, deduct_on_fail: deductOnFail } = req.body;

      let eligibility: any = null;
      if (userId) {
        // Verifica elegibilidade e lança erro caso não possua créditos / limite diário
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

      if (!apiKey)
        throw new Error(
          "GEMINI_API_KEY is not configured (checked app_settings table, process.env.GEMINI_API_KEY and VITE_GEMINI_API_KEY). Certifique-se de configurar em 'Settings > Secrets', na tabela app_settings ou no arquivo .env",
        );

      // Remove o prefixo se existir (ex: data:image/jpeg;base64,...) e extrai o mimeType
      const parts = rawBase64Data.split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];

      // Tenta extrair o mimeType (ex: "data:image/webp;base64" -> "image/webp")
      const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      const promptText = `Analisa esta imagem de comida.
Retorna UM OBJETO JSON ESTRITAMENTE, sem texto extra, markdown, ou explicações.
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
  ]
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API do Gemini (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textoFinal = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Verificar se algum alimento foi de fato identificado
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

      // Se elegível e houve identificação ou se foi a 3ª falha consecutiva, cobramos o scan
      if (userId && eligibility) {
        if (hasFoods || deductOnFail) {
          console.log(
            `[Billing Dev] Debitante scan do usuário ${userId}. Motivo: hasFoods=${hasFoods}, deductOnFail=${deductOnFail}`,
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

  // Proxy for invokeEdge
  app.post("/api/edge", async (req, res) => {
    try {
      console.log("[Server] /api/edge received request:", req.body.name);

      const result = await invokeEdgeInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error("[Server] /api/edge error:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Proxy for FCM notification delivery
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const { targetUserId, title, body, data, customData } = req.body;
      const fcmPayloadData = data || customData || {};
      if (!targetUserId) {
        return res.status(400).json({ error: "O campo targetUserId é obrigatório." });
      }

      console.log(
        `[Push] Tentando enviar notificação para usuário ${targetUserId}: ${title} - ${body}`,
      );

      const admin = supabaseAdmin;
      if (!admin) {
        return res.status(500).json({ error: "Supabase Admin não disponível." });
      }

      // Query the user's FCM token from profiles
      const { data: recipientProfile, error: profileError } = await (admin as any)
        .from("profiles")
        .select("fcm_token, nome")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileError || !recipientProfile) {
        console.error("[Push] Erro ao buscar perfil do destinatário:", profileError);
        return res.status(404).json({ error: "Perfil do destinatário não encontrado." });
      }

      const rawFcmToken = recipientProfile.fcm_token;
      // Suporte Multi-Dispositivo: Extrair todos os tokens (telemóveis) registados para este utilizador
      const extractTokens = (raw: string | null | undefined): string[] => {
        if (!raw || typeof raw !== "string") return [];
        const trimmed = raw.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return parsed
                .map((t) => String(t).trim())
                .filter((t) => Boolean(t) && !t.startsWith("fcm_mock_"));
            }
          } catch {
            // fallback
          }
        }
        return trimmed
          .split(",")
          .map((t) => t.trim())
          .filter((t) => Boolean(t) && !t.startsWith("fcm_mock_"));
      };

      const tokens = extractTokens(rawFcmToken);
      if (tokens.length === 0) {
        console.warn(`[Push] Usuário ${targetUserId} não tem FCM token válido cadastrado.`);
        return res.json({
          success: false,
          message: "Destinatário não tem fcm_token registrado no perfil.",
        });
      }

      console.log(
        `[Push] Disparando notificação para ${tokens.length} dispositivo(s)/telemóvel(is) do usuário ${targetUserId}...`,
      );

      const settings = await getAppSettings();
      const serverKey =
        settings.fcm_server_key || process.env.FCM_SERVER_KEY || process.env.VITE_FCM_SERVER_KEY;
      let fcmResultLog = null;

      if (!serverKey) {
        console.warn("[Push] FCM_SERVER_KEY não configurada no servidor.");
      } else {
        const isCallNotification =
          fcmPayloadData?.type === "INCOMING_CALL" ||
          fcmPayloadData?.type === "incoming_call" ||
          (typeof title === "string" && title.toLowerCase().includes("chamada"));

        const callChannelId = "incoming_calls";
        const generalChannelId = "default_channel";
        const channelId = isCallNotification ? callChannelId : generalChannelId;

        // Montar payload com registration_ids (e 'to' se único) com parâmetros de alta prioridade para o Android
        const fcmBody: any = {
          priority: "high",
          content_available: true,
          notification: {
            title,
            body,
            android_channel_id: channelId,
            channel_id: channelId,
            sound: isCallNotification ? "ringtone" : "default",
            badge: 1,
            priority: "high",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
          },
          data: {
            ...fcmPayloadData,
            type: fcmPayloadData?.type || (isCallNotification ? "INCOMING_CALL" : "general"),
            roomId: fcmPayloadData?.roomId || fcmPayloadData?.callId || targetUserId,
            channelId,
            title,
            body,
          },
          android: {
            priority: "high",
            ttl: isCallNotification ? "60s" : "86400s",
            notification: {
              sound: isCallNotification ? "ringtone" : "default",
              channel_id: channelId,
              android_channel_id: channelId,
              priority: "max",
              visibility: "public",
            },
          },
        };

        if (tokens.length === 1) {
          fcmBody.to = tokens[0];
        } else {
          fcmBody.registration_ids = tokens;
        }

        const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            Authorization: `key=${serverKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmBody),
        });

        if (!fcmResponse.ok) {
          const errorText = await fcmResponse.text();
          console.error("[Push] Erro ao disparar FCM:", errorText);
          throw new Error(`FCM API responded with status ${fcmResponse.status}: ${errorText}`);
        }

        const fcmResult = await fcmResponse.json();
        console.log(
          `[Push] Notificação disparada com sucesso para ${tokens.length} dispositivo(s):`,
          fcmResult,
        );
        fcmResultLog = fcmResult;
      }

      res.json({ success: true, fcmResult: fcmResultLog });
    } catch (error: unknown) {
      console.error("[Push] Erro crítico no envio da notificação:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Proxy for stripe checkout
  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const result = await createStripeCheckoutInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Google Play Billing verification route
  app.post("/api/play-billing/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

      const { productId, purchaseToken } = req.body;
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

  app.post("/api/stripe/sync", async (req, res) => {
    try {
      const result = await syncStripePlansInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Webhook
  app.post(
    "/api/public/stripe-webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"] as string;
        const result = await handleStripeWebhook(req.body.toString(), sig);
        res.send(result);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("[Webhook Error]", msg);
        res.status(500).send(msg);
      }
    },
  );

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
