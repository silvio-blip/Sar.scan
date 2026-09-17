import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server.js";
import { sendFcmV1Notification } from "../../src/lib/fcm-v1.server.js";

// Garantir que as variáveis do .env estão carregadas
loadEnv();

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

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { targetUserId, fcmToken, token, title, body, data, customData } = req.body;
    const fcmPayloadData = data || customData || {};
    const target = targetUserId || fcmToken || token;

    if (!target) {
      return res.status(400).json({ error: "O campo targetUserId ou fcmToken é obrigatório." });
    }

    console.log(`[Push] Tentando enviar notificação v1 para ${target}: ${title} - ${body}`);

    let tokens: string[] = [];

    // Determinar se o target é um Token FCM direto ou um User ID (UUID)
    const targetStr = String(target).trim();
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetStr);
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

      // Query the user's FCM token from profiles
      const { data: recipientProfile, error: profileError } = await (admin as any)
        .from("profiles")
        .select("fcm_token, nome")
        .eq("id", targetStr)
        .maybeSingle();

      if (profileError || !recipientProfile) {
        if (targetStr.length > 25) {
          tokens = [targetStr];
        } else {
          return res.status(404).json({
            error: "Perfil do destinatário não encontrado.",
            diagnosis: `Não foi encontrado nenhum utilizador com o ID '${targetStr}' na tabela profiles do Supabase. Certifique-se de passar o User ID (UUID) do destinatário ou o Token FCM direto.`,
          });
        }
      } else {
        if (recipientProfile.fcm_token) {
          const rawToken = String(recipientProfile.fcm_token).trim();
          try {
            if (rawToken.startsWith("[") && rawToken.endsWith("]")) {
              const parsed = JSON.parse(rawToken);
              if (Array.isArray(parsed)) {
                tokens = parsed.filter(Boolean);
              }
            } else {
              tokens = [rawToken];
            }
          } catch {
            tokens = [rawToken];
          }
        }
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
      `[Push] Disparando notificação FCM v1 para ${tokens.length} dispositivo(s)/telemóvel(is)...`,
    );

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

    return res.json({
      success: errorsList.length === 0,
      api: "FCM_HTTP_V1",
      fcmResult: fcmResults,
      tokensCount: tokens.length,
      maskedTokens: tokens.map((t: string) => `${t.slice(0, 8)}...${t.slice(-6)}`),
      errors: errorsList,
      diagnosis,
    });
  } catch (error: any) {
    console.error("[Push] Erro crítico no envio da notificação:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}
