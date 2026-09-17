import { GoogleAuth } from "google-auth-library";
import { getAppSettings } from "./settings.server";

// Fallback direct service account creds if not configured in DB or ENV
export const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "sar-scan",
  private_key_id: "98fe471c331db8d980f10f1984be966bf98457af",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7iDn+D4nX3gt6\nrGHsJ9CyiJ9yzZzI5S5S+aPCkdTjCBIp9QKvZClVXTo9n6NGFz+Vn8UyX8yu6NZM\nklhmLbzYZRaU72A74WaPdYh3O+HXJOnvop36KhYg9cgscD25hSOQfdU8cgzMo6ZZ\nL2/EvfbRRK0kOaSEvInZPO9Ol6bxuTH2SHK1UsIynpXwD5OZG5ElKaH0E4jbgAYU\nB8EjiLRVxVDQex7RfjC/3WTUnc4sxARo+q2BBvwmpn+oty8ydTr6rUcn3zzKQsV2\n7zZd9emzn+vKmpCIykrZBU/Tj2A/AV8qTuANJr/MA5W6gIv/v4pGgGXgPanjb1xa\n70tRiqyTAgMBAAECggEAAPYh1fueaUzqIibgGaXanA+3QY9sTltecW52OHkm7kMM\nVMq8yMlqrNVdhxNacvGLkejPygJTulHXR204ps11OmbKRtkzVRtCu1mO6Y2VCtVV\nnbTnunCczG52KEQrDNhx5ju+7CBpkGMGZ06m9AtFSK1hdd4VydhtnH+DepOsd3DJ\nYZq9nKMfs5K13NRFGDDwM9QLqghQTjkYnKhBwOpl7egMlcErF4oMZnLtdizr8y7H\nFq1zbXbvFPTNj+gqs3HQA6J7KGzipnEC0UnuEiscWb7FHViTkZVzAxEiy/ItCFzw\nFMicISbIa8HCCzMGzrjjsSm4/DzBiaEk4rv1BmsegQKBgQDdNKih4Ai3TZLUUk4g\niD+P0xKUjgwLAxA5D/Eov+XXPvFjpWDOoBB/S61zTyOCx6kEtCS99laBxhVmS7Gt\nh7fR3LKsFr7I1Zp3oLLOaWAIgF8SDtXfc2riZpPVuf1UBF5ZEs4E6C/4Z7LrH7Be\nCHBOS+tYH6DWcdlZht/m4yEPjwKBgQDZB6BpsChCvqMLHCGB8+HM7VRkMjyRPvzh\nA20jr7YHhhUTacRVv8w3K4583xcmvnSyaDvzamn3acwh9yH+6llAZTh6YFT3hCdY\nRm2n4WY/BjWHXADyfDdVxJ3Fd05BJtmK4B6i8futE2q5HQuaWRBxRbHko9t5Psfn\nfhWrw6LQvQKBgQDNsj/1dyzjt0EIKxj3a3sftPkcJxLP0qNtTIPGjtud0qwJKyng\nOjvdA3RhO4AcBqoG87UO6Fj9CEOyAkVQxlmKzx1epS/39ZlUEJz1EEv629SMKDt9\nNAh6S0TBg9gsHnvVfIUTTw38ggGAXtFUP6ifRj2sjoyznN6uP5tJSn/dxQKBgAct\n8WiNo0dR9yLO82zRHI8i6r/FyaskYkkvS9T6YxMspFXYEd6kUaUhk70dxC5L7qBY\nQmNzCb5diZs2CbHdHsa6knu55BWsEYEiE06Sbkd3dR3dNUrQQSRdNLrrj3MoTdoC\nQAEz8BdxpP4qr8+TUq/slk3x/bitEv/dc+oStrghAoGAEAFqQvmDzQHA5TpBIkbv\nmCSDAlAW4oq0zDnSMWbPYXSpdfOW4U3BCZpqHXQ0QCl2q8FzI1yMSvVQ47y8/ek+\n/0P0JugdtAPuvAp2fsDdiY3VH1lC7Ko4vxKT+I7hPoYbCNlg7ToSFwxfmLDHd/J4\nSGywFKjSiX/FTjyALzXxpjw=\n-----END PRIVATE KEY-----\n",
  client_email: "fcm-send@sar-scan.iam.gserviceaccount.com",
  client_id: "101323936761483406520",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/fcm-send%40sar-scan.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

interface ServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function invalidateFcmTokenCache() {
  cachedAccessToken = null;
}

export async function getFcmServiceAccount(): Promise<{
  credentials: ServiceAccountCredentials;
  source: string;
}> {
  const settings = await getAppSettings();

  // 1. Tentar pegar JSON do Supabase app_settings
  const jsonStringCandidates: [string | undefined, string][] = [
    [settings?.firebase_service_account, "Supabase DB (app_settings.firebase_service_account)"],
    [settings?.FIREBASE_SERVICE_ACCOUNT, "Supabase DB (app_settings.FIREBASE_SERVICE_ACCOUNT)"],
    [settings?.service_account_json, "Supabase DB (app_settings.service_account_json)"],
    [settings?.SERVICE_ACCOUNT_JSON, "Supabase DB (app_settings.SERVICE_ACCOUNT_JSON)"],
    [settings?.fcm_service_account, "Supabase DB (app_settings.fcm_service_account)"],
    [settings?.google_service_account, "Supabase DB (app_settings.google_service_account)"],
    [process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "Env (FIREBASE_SERVICE_ACCOUNT_JSON)"],
    [process.env.FIREBASE_SERVICE_ACCOUNT, "Env (FIREBASE_SERVICE_ACCOUNT)"],
    [process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "Env (GOOGLE_APPLICATION_CREDENTIALS_JSON)"],
  ];

  for (const [raw, sourceName] of jsonStringCandidates) {
    if (raw && typeof raw === "string") {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed.project_id && parsed.client_email && parsed.private_key) {
          let pk = String(parsed.private_key);
          if (pk.includes("\\n")) {
            pk = pk.replace(/\\n/g, "\n");
          }
          return {
            credentials: {
              project_id: String(parsed.project_id).trim(),
              client_email: String(parsed.client_email).trim(),
              private_key: pk.trim(),
            },
            source: sourceName,
          };
        }
      } catch {
        // Continue fallback
      }
    }
  }

  // 2. Usar credenciais embutidas se o banco ainda não tiver gravado
  return {
    credentials: {
      project_id: DEFAULT_SERVICE_ACCOUNT.project_id,
      client_email: DEFAULT_SERVICE_ACCOUNT.client_email,
      private_key: DEFAULT_SERVICE_ACCOUNT.private_key.replace(/\\n/g, "\n"),
    },
    source: `Embedded Service Account (${DEFAULT_SERVICE_ACCOUNT.client_email})`,
  };
}

/**
 * Obtém o Bearer Access Token OAuth2 oficial do Google para a API FCM HTTP v1
 */
export async function getFcmV1AccessToken(): Promise<{
  accessToken: string;
  projectId: string;
  source: string;
}> {
  const { credentials, source } = await getFcmServiceAccount();

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return {
      accessToken: cachedAccessToken.token,
      projectId: credentials.project_id,
      source,
    };
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error("Não foi possível gerar Access Token OAuth2 com a conta de serviço do Google.");
  }

  cachedAccessToken = {
    token: tokenResponse.token,
    expiresAt: now + 3500 * 1000, // expira geralmente em 1 hora (3600s)
  };

  return {
    accessToken: tokenResponse.token,
    projectId: credentials.project_id,
    source,
  };
}

export interface FcmSendPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "high" | "normal";
}

/**
 * Envia notificação usando a API Moderna FCM HTTP v1 (OAuth2 Service Account)
 */
export async function sendFcmV1Notification({
  token,
  title,
  body,
  data = {},
  priority = "high",
}: FcmSendPayload) {
  const { accessToken, projectId } = await getFcmV1AccessToken();

  // Converter todos os valores do objeto `data` para string conforme exigido pela API FCM v1
  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      stringData[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
  }

  const isCall =
    stringData.type === "INCOMING_CALL" ||
    stringData.type === "incoming_call" ||
    stringData.isCall === "true" ||
    (typeof title === "string" && title.toLowerCase().includes("chamada"));

  const channelId = isCall ? "incoming_calls" : "default_channel";
  stringData.channelId = channelId;

  const messagePayload: any = {
    message: {
      token,
      notification: {
        title,
        body,
      },
      data: stringData,
      android: {
        priority: priority === "high" ? "HIGH" : "NORMAL",
        ttl: isCall ? "60s" : "86400s",
        notification: {
          title,
          body,
          sound: isCall ? "ringtone" : "default",
          channelId: channelId,
          priority: isCall ? "MAX" : "HIGH",
          defaultSound: !isCall,
          defaultVibrateTimings: true,
          visibility: "PUBLIC",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            alert: { title, body },
            sound: isCall ? "ringtone.caf" : "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    },
  };

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messagePayload),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errorCode =
      responseData?.error?.details?.[0]?.errorCode ||
      responseData?.error?.status ||
      responseData?.error?.message ||
      `HTTP_${response.status}`;

    return {
      success: false,
      error: errorCode,
      rawError: responseData,
      httpStatus: response.status,
    };
  }

  return {
    success: true,
    messageId: responseData.name,
    rawResponse: responseData,
  };
}
