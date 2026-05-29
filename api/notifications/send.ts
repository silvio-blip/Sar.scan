import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadEnv } from "../../src/lib/env-loader.server.js";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server.js";
import { getAppSettings } from "../../src/lib/settings.server.js";

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
  } catch (error: any) {
    console.error("[Push] Erro crítico no envio da notificação:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}
