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
import { generateContentWithOptimalModel } from "./gemini-client.server.js";
import { scanQueue } from "./scan-queue.server.js";

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

  // Endpoints da Fila Inteligente de Processamento (Queue)
  app.post("/api/queue/enqueue", (req, res) => {
    try {
      const { type = "food_scan", payload, user_id: userId } = req.body || {};
      if (!payload) {
        return res.status(400).json({ error: "Payload da requisição não fornecido." });
      }

      const queueInfo = scanQueue.enqueue(type, payload, userId);
      res.json({
        success: true,
        ...queueInfo,
      });
    } catch (err: any) {
      console.error("[Queue API] Erro ao enfileirar:", err);
      res.status(500).json({ error: err.message || "Erro ao adicionar à fila." });
    }
  });

  app.get("/api/queue/status/:jobId", (req, res) => {
    try {
      const { jobId } = req.params;
      const statusInfo = scanQueue.getJobStatus(jobId);
      if (!statusInfo) {
        return res.status(404).json({ error: "Job não encontrado ou expirado." });
      }
      res.json(statusInfo);
    } catch (err: any) {
      console.error("[Queue API] Erro ao consultar status:", err);
      res.status(500).json({ error: err.message || "Erro ao consultar status da fila." });
    }
  });

  app.get("/api/queue/overview", (_req, res) => {
    res.json(scanQueue.getOverview());
  });

  // Proxy for invokeEdge / gemini-scan
  app.post("/api/gemini-scan", async (req, res) => {
    try {
      const {
        base64Data: rawBase64Data,
        user_id: userId,
        deduct_on_fail: deductOnFail,
        hand_calibration: handCalibration,
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

      let handCalibrationInstruction = "";
      if (handCalibration && handCalibration.comprimento_cm) {
        handCalibrationInstruction = `
INSTRUÇÃO ESPECIAL DE ALTA PRECISÃO MÉTRICA COM MÃO BIOMÉTRICA:
O utilizador possui uma calibração biométrica da sua mão registrada no sistema:
- Comprimento da mão do utilizador (do pulso até a ponta do dedo médio): ${handCalibration.comprimento_cm} cm
- Largura da palma do utilizador (transversal): ${handCalibration.largura_palma_cm || 8.0} cm
- Objeto de referência utilizado: ${handCalibration.objeto_referencia || "cartão"}

DIRETRIZ DE VISÃO ESPACIAL 3D:
Verifique atentamente se a mão humana do utilizador está visível na imagem (ao lado do prato, segurando o prato/recipiente ou próxima aos alimentos).
- Se a mão ESTIVER VISÍVEL: Use as medidas anatômicas calibradas acima como régua métrica biométrica de escala real no espaço 3D para calcular o diâmetro, altura, volume em cm³ e o peso exato em gramas dos alimentos com máxima precisão. No campo "calibrado_por_mao", retorne true.
- Se a mão NÃO estiver visível: Estime as porções visualmente pelo tamanho do prato ou recipientes convencionais e defina "calibrado_por_mao": false.
`;
      }

      const promptText = `Analisa esta imagem de comida no contexto do perfil e objetivos do utilizador.
${userProfileContext}
${handCalibrationInstruction}

IMPORTANTE: Se a imagem NÃO contiver alimentos ou refeições visíveis (por exemplo, se for apenas uma pessoa, vestuário/calças, o chão, teto, objetos aleatórios, paisagens, ou uma imagem preta/ilegível), você DEVE obrigatoriamente retornar a lista de "itens" totalmente vazia: "itens": []. Nunca crie itens fictícios para indicar a ausência de comida (como "Nenhum alimento visível", "Sem alimentos" ou similares). No "feedback_meta", explique de forma amigável em português (PT) que nenhum alimento foi detectado na imagem e peça para enviar uma foto clara da refeição.

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
  "calibrado_por_mao": boolean,
  "feedback_meta": "string breve, direta e encorajadora em português (PT) explicando ao utilizador como este alimento impacta a sua meta específica (seja perder gordura, manter ou ganhar massa), indicando se o aproxima ou afasta da meta, balanço calórico/nutricional e uma recomendação prática."
}`;

      const { response: aiResponse, modelUsed } = await generateContentWithOptimalModel({
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
        maxOutputTokens: 2048,
      });

      console.log(`[gemini-scan] Sucesso utilizando modelo: ${modelUsed}`);

      const textoFinal = aiResponse.text || "";
      let hasFoods = false;
      try {
        const cleanJson = textoFinal.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        const list = parsed?.itens || parsed?.items || [];

        // Filtrar itens de ausência ou placeholders
        const realFoods = list.filter((item: any) => {
          if (!item || !item.nome) return false;
          const name = String(item.nome).toLowerCase();
          return !(
            name.includes("nenhum") ||
            name.includes("não detectado") ||
            name.includes("nao detectado") ||
            name.includes("no food") ||
            name.includes("not detected") ||
            name.includes("sem alimento") ||
            name.includes("invisível") ||
            name.includes("invisivel") ||
            name.includes("ausência") ||
            name.includes("ausencia")
          );
        });

        if (Array.isArray(realFoods) && realFoods.length > 0) {
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

  // Endpoint de Calibração Biométrica da Mão
  app.post("/api/calibrate-hand", async (req, res) => {
    try {
      const {
        base64Data: rawBase64Data,
        reference_type: referenceType = "card",
        user_id: userId,
      } = req.body || {};

      if (!rawBase64Data) {
        return res.status(400).json({ sucesso: false, erro: "Imagem não fornecida." });
      }

      const settings = await getAppSettings().catch(() => ({}) as any);
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
        throw new Error("Chave GEMINI_API_KEY não configurada.");
      }

      const parts = (rawBase64Data || "").split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      const promptCalib = `Você é um sistema especialista em visão computacional biométrica, medição óptica e calibração espacial de alta precisão.
O utilizador capturou uma foto de sua mão aberta/espalmada sobre uma superfície plana ao lado de um objeto de referência do tipo: "${referenceType}".

Dimensões físicas padronizadas dos objetos de referência:
- "card": Cartão Plástico Padrão ISO (Crédito, Débito, ID, Cidadão) -> Largura exata = 85.60 mm (8.56 cm), Altura = 53.98 mm (5.40 cm).
- "coin_2eur": Moeda de 2 Euros -> Diâmetro exato = 25.75 mm (2.575 cm).
- "coin_1real": Moeda de 1 Real Brasileiro -> Diâmetro exato = 27.00 mm (2.70 cm).
- "coin_1eur": Moeda de 1 Euro -> Diâmetro exato = 23.25 mm (2.325 cm).
- "bottle_cap": Tampa de garrafa PET padrão -> Diâmetro = 28.00 mm (2.80 cm).
- "ruler": Régua ou fita métrica com graduação em centímetros/milímetros.

INSTRUÇÕES DE ANÁLISE:
1. Detecte o objeto de referência na imagem e meça seus pixels de largura/diâmetro para definir a relação Pixels por Milímetro (PPM).
2. Detecte a mão humana aberta do usuário posicionada no mesmo plano focal.
3. Meça com precisão biométrica em centímetros (com uma casa decimal):
   - "comprimento_cm": Distância linear do início do pulso (vinco da base da mão) até o ápice da ponta do dedo médio (geralmente entre 15.5 cm e 22.0 cm para adultos).
   - "largura_palma_cm": Largura transversal da palma medida na base dos nós dos dedos (geralmente entre 6.8 cm e 9.8 cm).
   - "largura_indicador_cm": Largura média do dedo indicador (geralmente entre 1.6 cm e 2.3 cm).
4. Verifique a coerência anatômica da mão humana.
5. Calcule um índice de confiança da detecção (0 a 100%).

Retorne ESTRITAMENTE um objeto JSON no seguinte formato (sem blocos de código markdown desnecessários):
{
  "sucesso": true,
  "comprimento_cm": 18.5,
  "largura_palma_cm": 8.2,
  "largura_indicador_cm": 1.9,
  "objeto_detectado": "Cartão Bancário",
  "confianca_percentual": 96,
  "mensagem": "Calibração concluída com altíssima precisão! A sua mão mede 18.5 cm de comprimento e 8.2 cm de largura.",
  "dicas": [
    "Ao escanear um prato de comida, posicione sua mão aberta ao lado do prato para que a IA use a sua escala real.",
    "Mantenha a câmera paralela ao prato (ângulo superior) para garantir máxima precisão das gramas."
  ]
}

Se a mão ou o objeto não puderem ser identificados com segurança, faltar algum elemento ou a imagem estiver inadequada, retorne ESTRITAMENTE:
{
  "sucesso": false,
  "motivo_falha": "objeto_ausente" | "mao_ausente" | "imagem_escura" | "mao_fechada" | "objeto_errado" | "distancia_incorreta" | "outro",
  "titulo_erro": "Título curto e claro em português (ex: 'Cartão não encontrado na imagem', 'Mão fora do enquadramento', 'Imagem muito escura ou borrada')",
  "erro": "Explicação detalhada e amigável em português (PT) sobre exatamente o que impediu a verificação da mão (ex: 'Não encontramos o cartão de referência ao lado da sua mão', 'A mão precisa estar aberta sobre a mesa para calcularmos os dedos', etc.)",
  "dica_correcao": "Orientação prática e direta de como posicionar a mão e o objeto na próxima foto para dar certo."
}`;

      const { response: aiResponse, modelUsed } = await generateContentWithOptimalModel({
        contents: [
          {
            role: "user",
            parts: [
              { text: promptCalib },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        maxOutputTokens: 1024,
      });

      console.log(`[calibrate-hand] Sucesso utilizando modelo: ${modelUsed}`);

      const responseText = aiResponse.text || "";
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const parsedResult = JSON.parse(cleanJson);

      res.json(parsedResult);
    } catch (err: any) {
      console.error("[Server] /api/calibrate-hand error:", err);
      res.status(500).json({
        sucesso: false,
        erro: err.message || "Erro ao processar calibração biométrica da mão.",
      });
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
