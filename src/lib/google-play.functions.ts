import { getApiUrl } from "./utils";
import { toast } from "sonner";

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
 * Safety check to detect if running inside Capacitor native context.
 */
export const isCapacitor = (): boolean => {
  return typeof window !== "undefined" && (window as any).Capacitor !== undefined;
};

/**
 * Initialize Google Play In-App Purchase.
 * Supports both standard web fallbacks and Capacitor Native Plugins or Cordova Purchase.
 */
export async function initializeGooglePlayIAP(): Promise<void> {
  if (!isCapacitor()) {
    console.log("[Play IAP] Running in web simulation mode. Native IAP initialization skipped.");
    return;
  }

  try {
    const win = window as any;

    // 1. Cordova Purchase Plugin Fallback (widely used in hybrid setups via window.store)
    if (win.CdvPurchase || win.store) {
      console.log("[Play IAP] Initializing via CdvPurchase/store...");
      const store = win.CdvPurchase?.store || win.store;

      store.verbosity = 1; // Log errors and warnings

      // Register products
      store.register([
        {
          id: "sar_scan_creditos",
          type: "consumable",
        },
        {
          id: "sar_scan_assinatura",
          type: "paid subscription",
        },
      ]);

      // Setup purchase behaviors
      store.when("sar_scan_creditos").approved((p: any) => {
        console.log("[Play IAP] Consumable approved natively:", p);
        p.verify(); // Starts verification sequence
      });

      store.when("sar_scan_assinatura").approved((p: any) => {
        console.log("[Play IAP] Subscription approved natively:", p);
        p.verify();
      });

      store.initialize();
      console.log("[Play IAP] CdvPurchase/store initialized successfully.");
      return;
    }

    // 2. Capacitor Community / Capawesome In-App Purchase native plugin initialization
    const cap = (window as any).Capacitor;
    const InAppPurchasePlugin = cap?.Plugins?.InAppPurchase || cap?.Plugins?.CapacitorInAppPurchase;

    if (InAppPurchasePlugin && typeof InAppPurchasePlugin.initialize === "function") {
      console.log("[Play IAP] Initializing via native Capacitor IAP plugin...");
      await InAppPurchasePlugin.initialize();
      console.log("[Play IAP] Native Capacitor plugin initialized.");
    } else {
      console.warn(
        "[Play IAP] No native In-App Purchase plugin found on window or Capacitor.Plugins",
      );
    }
  } catch (error) {
    console.error("[Play IAP] Error during IAP initialization:", error);
  }
}

/**
 * Launches the native Google Play purchase screen for a product or subscription
 * and captures the purchase token, sending it to the backend for authorization.
 *
 * @param productId Product identifier ('sar_scan_creditos' or 'sar_scan_assinatura')
 * @param token User authenticated JWT token for authorization
 */
export async function requestGooglePlayPurchase(
  productId: string,
  token: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[Play IAP] Initiating purchase for ID: ${productId}`);

  // WEB FALLBACK / SIMULATION (If not running on Native Device)
  if (!isCapacitor()) {
    console.log("[Play IAP] Simulating purchase in developer browser environment...");
    toast.info("Simulando compra da Google Play no navegador Web...");

    // Auto-generate mock purchase token for testing in preview environment
    const mockToken = "mock_token_" + Math.random().toString(36).substring(7);

    // Send to backend for validation (this tests the API integration!)
    return await verifyPurchaseOnBackend(productId, mockToken, token);
  }

  try {
    const win = window as any;

    // 1. Native Bridge using Cordova CdvPurchase (window.store)
    if (win.CdvPurchase || win.store) {
      return new Promise((resolve) => {
        const store = win.CdvPurchase?.store || win.store;

        console.log("[Play IAP] Ordering product via Cordova Store:", productId);

        // Define listeners momentarily for resolution
        store.once(productId).verified(async (p: any) => {
          console.log("[Play IAP] Native validation event. Verified purchase:", p);

          const purchaseToken = p.transaction?.purchaseToken || p.transaction?.id;
          if (!purchaseToken) {
            resolve({ success: false, error: "Token de compra não capturado do provedor." });
            return;
          }

          const verification = await verifyPurchaseOnBackend(productId, purchaseToken, token);

          if (verification.success) {
            // Natively finalize/finish transaction to clear the queue
            p.finish();
            resolve(verification);
          } else {
            resolve({
              success: false,
              error: verification.error || "A verificação do servidor falhou.",
            });
          }
        });

        store.once(productId).error((err: any) => {
          console.error("[Play IAP] Native purchasing error:", err);
          resolve({
            success: false,
            error: err.message || "Erro durante o pagamento no dispositivo.",
          });
        });

        const orderResult = store.order(productId);
        console.log("[Play IAP] Native order issued:", orderResult);
      });
    }

    // 2. Native Bridge using Capacitor Community / Capawesome In-App Purchase API
    const cap = (window as any).Capacitor;
    const InAppPurchasePlugin = cap?.Plugins?.InAppPurchase || cap?.Plugins?.CapacitorInAppPurchase;

    if (InAppPurchasePlugin) {
      console.log("[Play IAP] Registering purchase via Capacitor Plugins structure...");

      // Determine if a subscription or consumable product is requested
      let purchaseRes: any;

      if (typeof InAppPurchasePlugin.purchase === "function") {
        purchaseRes = await InAppPurchasePlugin.purchase({ productId });
      } else if (typeof InAppPurchasePlugin.getProducts === "function") {
        // Some plugins require getting products first, then ordering
        purchaseRes = await InAppPurchasePlugin.purchase({ productId });
      } else {
        throw new Error("O plugin de In-App Purchase nativo não possui o método 'purchase'.");
      }

      console.log("[Play IAP] Received purchase result from native plugin:", purchaseRes);

      const purchaseToken =
        purchaseRes?.purchaseToken || purchaseRes?.transactionId || purchaseRes?.token;

      if (!purchaseToken) {
        return { success: false, error: "Nenhum token de compra retornado do ecrã de pagamento." };
      }

      // Send to server to perform Google API Server-to-Server validation
      const verification = await verifyPurchaseOnBackend(productId, purchaseToken, token);

      if (verification.success) {
        // If it is credit pack (consumable), verify and notify device to consume it (mark as delivered)
        if (productId === "sar_scan_creditos") {
          console.log(
            "[Play IAP] Consumable verified. Sending Native Delivery consumption confirmation...",
          );
          if (typeof InAppPurchasePlugin.consume === "function") {
            try {
              await InAppPurchasePlugin.consume({ purchaseToken });
              console.log("[Play IAP] Native purchase consumed successfully!");
            } catch (e) {
              console.warn(
                "[Play IAP] Failed to natively consume package (might be auto-consumed):",
                e,
              );
            }
          }
        }
      }

      return verification;
    }

    throw new Error(
      "Não foi detetado nenhum driver ou plugin de In-App Purchase nativo habilitado.",
    );
  } catch (err: any) {
    console.error("[Play IAP] Purchasing failed:", err);
    return { success: false, error: err?.message || "Erro indefinido ao chamar a Google Play." };
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
