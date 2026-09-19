import { getApiUrl } from "./utils";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";

/**
 * Interface representing the purchase result from Google Play billing.
 */
export interface PlayPurchaseResult {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  purchaseTime?: number;
}

/**
 * Safety check to detect if running inside real native Android/iOS Capacitor context.
 * In a web browser / desktop preview, this returns false so web uses Stripe Checkout.
 */
export const isCapacitor = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    const cap = (window as any).Capacitor;
    return !!(
      cap &&
      (cap.isNative === true ||
        cap.platform === "android" ||
        cap.platform === "ios" ||
        (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()))
    );
  }
};

/**
 * Initialize Google Play In-App Purchase.
 */
export async function initializeGooglePlayIAP(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    console.log("[Play IAP] Initializing Native Google Play Billing...");
  } catch (error) {
    console.error("[Play IAP] Error during IAP initialization:", error);
  }
}

/**
 * Launches the REAL native Google Play purchase bottom sheet on the Android device
 * and captures the purchase token, sending it to the backend for authorization.
 *
 * @param productId Product identifier ('sar_scan_creditos', 'sar_scan_assinatura', etc.)
 * @param token User authenticated JWT token for authorization
 */
export async function requestGooglePlayPurchase(
  productId: string,
  token: string,
  customPlanId?: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[Play IAP] Invocando compra nativa Google Play para o produto: ${productId}`);

  if (!isCapacitor()) {
    return {
      success: false,
      error: "Google Play só está disponível dentro do aplicativo Android.",
    };
  }

  try {
    const isSub = productId !== "sar_scan_creditos";

    // Determina o ID do Plano Base configurado no Google Play Console
    let planIdentifier: string | undefined = customPlanId;
    if (isSub && !planIdentifier) {
      if (productId.includes("semanal")) {
        planIdentifier = "semanal";
      } else if (productId.includes("anual")) {
        planIdentifier = "anual";
      } else {
        planIdentifier = "mensal";
      }
    }

    // 1. Invoca a Bottom Sheet oficial da Google Play Store no celular
    const purchaseOptions: any = {
      productIdentifier: productId,
      productType: isSub ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP,
      isConsumable: !isSub,
      autoAcknowledgePurchases: true,
    };

    if (isSub && planIdentifier) {
      purchaseOptions.planIdentifier = planIdentifier;
    }

    const transaction = await NativePurchases.purchaseProduct(purchaseOptions);

    console.log("[Play IAP] Transação oficial retornada pela Google Play:", transaction);

    const purchaseToken = transaction.purchaseToken;
    if (!purchaseToken) {
      return {
        success: false,
        error: "Google Play concluiu a compra mas não gerou o token de autorização.",
      };
    }

    // 2. Se for consumível (créditos de 50 scans), consome na Google Play
    if (!isSub) {
      try {
        await NativePurchases.consumePurchase({ purchaseToken });
      } catch (consumeErr) {
        console.warn("[Play IAP] Aviso ao consumir produto:", consumeErr);
      }
    }

    // 3. Envia o token para o backend para creditar no Supabase
    const verification = await verifyPurchaseOnBackend(productId, purchaseToken, token);
    return verification;
  } catch (err: any) {
    console.error("[Play IAP] Erro na Google Play Billing:", err);

    const errorMessage = err?.message || String(err);
    if (
      errorMessage.includes("User cancelled") ||
      errorMessage.includes("USER_CANCELED") ||
      errorMessage.includes("cancel")
    ) {
      return { success: false, error: "Operação cancelada na Google Play." };
    }

    return {
      success: false,
      error: errorMessage || "Erro ao conectar com a Google Play Store.",
    };
  }
}

/**
 * Perform server-to-server validation of the payment token against Google Play API.
 */
async function verifyPurchaseOnBackend(
  productId: string,
  purchaseToken: string,
  token: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(getApiUrl("/api/play-billing/verify"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId,
        purchaseToken,
      }),
    });

    if (!res.ok) {
      const errRes = await res
        .json()
        .catch(() => ({ error: "Erro de comunicação com o servidor de validação" }));
      return { success: false, error: errRes.error || "Operação de validação não autorizada." };
    }

    const payload = await res.json();
    return { success: true, data: payload };
  } catch (fetchErr: any) {
    console.error("[Play IAP] Backend fetching exception:", fetchErr);
    return {
      success: false,
      error: fetchErr.message || "Falha ao validar a transação junto do servidor.",
    };
  }
}
