import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file into process.env before any other imports load
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log("[Env Loader] Variáveis do arquivo .env carregadas com sucesso!");
  } else {
    console.log("[Env Loader] Arquivo .env não encontrado no diretório raiz.");
  }
} catch (err) {
  console.warn("[Env Loader] Erro ao carregar arquivo .env:", err);
}

import express from "express";
import { createServer as createViteServer } from "vite";
import { invokeEdgeInternal } from "./src/lib/edge-proxy.server";
import { createStripeCheckoutInternal, syncStripePlansInternal } from "./src/lib/stripe.server";
import { handleStripeWebhook } from "./src/lib/stripe.webhook";
import { verifyGooglePlayPurchaseInternal } from "./src/lib/google-play.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { getAppSettings } from "./src/lib/settings.server";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS middleware for all development, staging and production origins
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    const requestHeaders = req.headers["access-control-request-headers"];
    if (requestHeaders) {
      res.setHeader("Access-Control-Allow-Headers", requestHeaders);
    } else {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, stripe-signature, apikey, x-client-info",
      );
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // API Routes

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

      const fcmToken = recipientProfile.fcm_token;
      if (!fcmToken) {
        console.warn(`[Push] Usuário ${targetUserId} não tem FCM token cadastrado.`);
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
        // Dispatch push notification via FCM legacy endpoint
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
