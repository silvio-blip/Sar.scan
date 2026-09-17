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
import {
  getAppSettings,
  invalidateSettingsCache,
  saveAppSetting,
  SQL_APP_SETTINGS_MIGRATION,
} from "./src/lib/settings.server";
import {
  sendFcmV1Notification,
  getFcmV1AccessToken,
  getFcmServiceAccount,
  DEFAULT_SERVICE_ACCOUNT,
  invalidateFcmTokenCache,
} from "./src/lib/fcm-v1.server";

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
      const { targetUserId, fcmToken, token, title, body, data, customData } = req.body;
      const fcmPayloadData = data || customData || {};
      const target = targetUserId || fcmToken || token;

      if (!target) {
        return res.status(400).json({ error: "O campo targetUserId ou fcmToken é obrigatório." });
      }

      console.log(`[Push] Tentando enviar notificação para ${target}: ${title} - ${body}`);

      let tokens: string[] = [];

      // Determinar se o target é um Token FCM direto ou um User ID (UUID)
      const targetStr = String(target).trim();
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          targetStr,
        );
      const isDirectFcmToken =
        Boolean(fcmToken || token) || !isUUID || targetStr.includes(":") || targetStr.length > 40;

      if (isDirectFcmToken && !isUUID) {
        console.log("[Push] Identificado token FCM direto fornecido na requisição.");
        tokens = [targetStr];
      } else {
        const admin = supabaseAdmin;
        if (!admin) {
          return res.status(500).json({ error: "Supabase Admin não disponível." });
        }

        // Query the user's FCM token from profiles by user ID
        const { data: recipientProfile, error: profileError } = await (admin as any)
          .from("profiles")
          .select("fcm_token, nome")
          .eq("id", targetStr)
          .maybeSingle();

        if (profileError || !recipientProfile) {
          console.warn(`[Push] Perfil não encontrado por ID (${targetStr}). Tentando fallback...`);
          // Se não encontrou por ID, mas parece um token longo, usa-o diretamente
          if (targetStr.length > 25) {
            tokens = [targetStr];
          } else {
            return res.status(404).json({
              error: "Perfil do destinatário não encontrado.",
              diagnosis: `Não foi encontrado nenhum utilizador com o ID '${targetStr}' na tabela profiles do Supabase. Certifique-se de passar o User ID (UUID) do destinatário ou o Token FCM direto.`,
            });
          }
        } else {
          const rawFcmToken = recipientProfile.fcm_token;
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

          tokens = extractTokens(rawFcmToken);
        }
      }

      if (tokens.length === 0) {
        console.warn(`[Push] Destinatário ${target} não tem FCM token válido cadastrado.`);
        return res.json({
          success: false,
          message: "Destinatário não tem fcm_token registrado no perfil.",
          diagnosis: "O utilizador existe no Supabase, mas a coluna 'fcm_token' está vazia.",
        });
      }

      console.log(
        `[Push] Disparando notificação v1 para ${tokens.length} dispositivo(s)/telemóvel(is)...`,
      );

      // Usar Google Service Account (FCM HTTP v1 API)
      const fcmResults: any[] = [];
      const errorsList: string[] = [];

      for (const t of tokens) {
        try {
          const resV1 = await sendFcmV1Notification({
            token: t,
            title,
            body,
            data: {
              ...fcmPayloadData,
              type: fcmPayloadData?.type || "general",
              roomId: fcmPayloadData?.roomId || fcmPayloadData?.callId || targetUserId || "",
              title,
              body,
            },
            priority: "high",
          });

          fcmResults.push(resV1);
          if (!resV1.success) {
            errorsList.push(resV1.error || "UNKNOWN_FCM_ERROR");
          }
        } catch (fcmErr: any) {
          console.error("[Push] Erro ao enviar FCM v1 para token:", t, fcmErr);
          errorsList.push(fcmErr.message || "FCM_V1_FAILED");
        }
      }

      let diagnosis = "";
      if (errorsList.length > 0) {
        if (
          errorsList.some(
            (e) => e.includes("UNREGISTERED") || e.includes("NotRegistered") || e.includes("404"),
          )
        ) {
          diagnosis =
            "O Token FCM do telemóvel expirou ou a aplicação foi reinstalada (UNREGISTERED/404). Abra a app no telemóvel para registrar um novo token.";
        } else if (errorsList.some((e) => e.includes("INVALID_ARGUMENT"))) {
          diagnosis =
            "Token FCM com formato inválido ou pertencente a outro projeto. Abra a app para gerar token atualizado.";
        } else {
          diagnosis = `O Google FCM v1 retornou: ${errorsList.join(", ")}`;
        }
      } else {
        diagnosis = `Notificação entregue com SUCESSO via Google FCM HTTP v1 (Service Account) para ${tokens.length} dispositivo(s)!`;
      }

      console.log("[Push] Resultado do envio FCM v1:", { errorsList, count: tokens.length });

      res.json({
        success: errorsList.length === 0,
        api: "FCM_HTTP_V1",
        fcmResult: fcmResults,
        tokensCount: tokens.length,
        maskedTokens: tokens.map((t) => `${t.slice(0, 8)}...${t.slice(-6)}`),
        errors: errorsList,
        diagnosis,
      });
    } catch (error: unknown) {
      console.error("[Push] Erro crítico no envio da notificação:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Consultar e validar configuração FCM atual (Service Account v1 e chaves)
  app.get("/api/notifications/config", async (req, res) => {
    try {
      const settings = await getAppSettings();
      const serviceAccountInfo = await getFcmServiceAccount();
      let accessTokenValid = false;
      let accessTokenError = null;

      try {
        const tokenRes = await getFcmV1AccessToken();
        accessTokenValid = Boolean(tokenRes.accessToken);
      } catch (err: any) {
        accessTokenError = err.message;
      }

      // Quantos perfis têm fcm_token cadastrado no Supabase
      let profilesWithTokenCount = 0;
      if (supabaseAdmin) {
        const { count } = await (supabaseAdmin as any)
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("fcm_token", "is", null);
        profilesWithTokenCount = count || 0;
      }

      res.json({
        serviceAccountConfigured: Boolean(serviceAccountInfo.credentials.private_key),
        projectId: serviceAccountInfo.credentials.project_id,
        clientEmail: serviceAccountInfo.credentials.client_email,
        serviceAccountSource: serviceAccountInfo.source,
        accessTokenValid,
        accessTokenError,
        loadedSettingsKeys: Object.keys(settings || {}),
        profilesWithTokenCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao consultar configuração FCM" });
    }
  });

  // Salvar ou atualizar Google Service Account JSON diretamente na tabela app_settings
  app.post("/api/notifications/config", async (req, res) => {
    try {
      const { service_account_json } = req.body;
      let lastSaveResult: any = null;

      if (service_account_json) {
        let cleanJsonStr =
          typeof service_account_json === "string"
            ? service_account_json.trim()
            : JSON.stringify(service_account_json);

        // Remover formatação de markdown se houver (ex: ```json ... ```)
        if (cleanJsonStr.startsWith("```")) {
          cleanJsonStr = cleanJsonStr
            .replace(/^```(json)?/, "")
            .replace(/```$/, "")
            .trim();
        }

        // Validar se é JSON válido
        try {
          const parsed = JSON.parse(cleanJsonStr);
          if (!parsed || typeof parsed !== "object") {
            return res.status(400).json({ error: "O JSON fornecido deve ser um objeto válido." });
          }
        } catch (jsonErr: any) {
          return res.status(400).json({ error: `O texto fornecido não é um JSON válido: ${jsonErr.message}` });
        }

        const saveRes = await saveAppSetting("firebase_service_account", cleanJsonStr);
        lastSaveResult = saveRes;

        if (!saveRes.success) {
          return res.status(500).json({
            error: saveRes.error,
            diagnosis: saveRes.diagnosis,
            sqlFix: saveRes.sqlFix,
            source: saveRes.source,
          });
        }
      }

      invalidateSettingsCache();
      invalidateFcmTokenCache();
      const updatedSettings = await getAppSettings();

      return res.json({
        success: true,
        message: "Configuração da Conta de Serviço salva com sucesso no Supabase!",
        source: lastSaveResult?.source || "Supabase Database (app_settings)",
        loadedSettingsKeys: Object.keys(updatedSettings || {}),
      });
    } catch (error: any) {
      console.error("[Settings] Erro ao atualizar configurações FCM:", error);
      res.status(500).json({
        error: error.message || "Erro interno ao salvar configurações",
        sqlFix: SQL_APP_SETTINGS_MIGRATION,
      });
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
