import { getApiUrl } from "./utils";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { NativePurchases, PURCHASE_TYPE, type Product } from "@capgo/native-purchases";

/**
 * Interface representing the purchase result from Google Play billing.
 */
export interface PlayPurchaseResult {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  purchaseTime?: number;
}

export interface PlayProductDetails {
  productId: string;
  formattedPrice: string;
  price: number;
  currencyCode: string;
  currencySymbol: string;
  title?: string;
  description?: string;
  offerToken?: string;
}

export const PLAY_PRODUCT_IDS = {
  weekly: "sar_scan_assinatura_semanal",
  monthly: "sar_scan_assinatura",
  yearly: "sar_scan_assinatura_anual",
  credits: "sar_scan_creditos",
} as const;

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
 * Consulta a Google Play Store em tempo real para obter os preços, moedas e taxas
 * localizadas exatas do país em que o utilizador se encontra.
 */
export async function fetchGooglePlayPrices(): Promise<Record<string, PlayProductDetails>> {
  if (!isCapacitor()) {
    console.log("[Play IAP] Ambiente Web/Navegador: mantendo preços padrão Stripe/Web.");
    return {};
  }

  const results: Record<string, PlayProductDetails> = {};

  try {
    // 1. Consulta assinaturas (Semanal, Mensal, Anual)
    const subIds = [PLAY_PRODUCT_IDS.weekly, PLAY_PRODUCT_IDS.monthly, PLAY_PRODUCT_IDS.yearly];

    try {
      const subsResponse = await NativePurchases.getProducts({
        productIdentifiers: subIds,
        productType: PURCHASE_TYPE.SUBS,
      });

      if (subsResponse?.products && Array.isArray(subsResponse.products)) {
        for (const prod of subsResponse.products) {
          const formatted =
            prod.priceString ||
            (prod.currencySymbol
              ? `${prod.currencySymbol} ${prod.price}`
              : `${prod.price} ${prod.currencyCode || "EUR"}`);

          const details: PlayProductDetails = {
            productId: prod.identifier,
            formattedPrice: formatted,
            price: prod.price ?? 0,
            currencyCode: prod.currencyCode ?? "EUR",
            currencySymbol: prod.currencySymbol ?? "€",
            title: prod.title,
            description: prod.description,
            offerToken: prod.offerToken,
          };

          // Salva pelo ID oficial da Play Store
          results[prod.identifier] = details;
          if (prod.planIdentifier) {
            results[prod.planIdentifier] = details;
          }

          // Mapeia também pelos identificadores de plano amigáveis
          if (
            prod.identifier === PLAY_PRODUCT_IDS.weekly ||
            prod.planIdentifier === PLAY_PRODUCT_IDS.weekly
          ) {
            results["weekly"] = details;
          } else if (
            prod.identifier === PLAY_PRODUCT_IDS.monthly ||
            prod.planIdentifier === PLAY_PRODUCT_IDS.monthly
          ) {
            results["monthly"] = details;
          } else if (
            prod.identifier === PLAY_PRODUCT_IDS.yearly ||
            prod.planIdentifier === PLAY_PRODUCT_IDS.yearly
          ) {
            results["yearly"] = details;
          }
        }
      }
    } catch (subErr) {
      console.warn("[Play IAP] Erro ao consultar preços de assinaturas na Google Play:", subErr);
    }

    // 2. Consulta produto consumível de créditos (Pacote de 50 scans)
    try {
      const inAppResponse = await NativePurchases.getProducts({
        productIdentifiers: [PLAY_PRODUCT_IDS.credits],
        productType: PURCHASE_TYPE.INAPP,
      });

      if (inAppResponse?.products && Array.isArray(inAppResponse.products)) {
        for (const prod of inAppResponse.products) {
          const formatted =
            prod.priceString ||
            (prod.currencySymbol
              ? `${prod.currencySymbol} ${prod.price}`
              : `${prod.price} ${prod.currencyCode || "EUR"}`);

          const details: PlayProductDetails = {
            productId: prod.identifier,
            formattedPrice: formatted,
            price: prod.price ?? 0,
            currencyCode: prod.currencyCode ?? "EUR",
            currencySymbol: prod.currencySymbol ?? "€",
            title: prod.title,
            description: prod.description,
            offerToken: prod.offerToken,
          };

          results[prod.identifier] = details;
          results["credits"] = details;
        }
      }
    } catch (inAppErr) {
      console.warn("[Play IAP] Erro ao consultar preços de consumíveis na Google Play:", inAppErr);
    }

    console.log("[Play IAP] Preços e moedas localizadas recebidas da Google Play:", results);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sar_play_prices_cache", JSON.stringify(results));
        window.dispatchEvent(new CustomEvent("sar_play_prices_updated", { detail: results }));
      } catch (cacheErr) {
        console.debug("[Play IAP] Falha ao salvar cache de preços:", cacheErr);
      }
    }
    return results;
  } catch (err) {
    console.error("[Play IAP] Erro geral ao obter preços da Google Play:", err);
    return {};
  }
}

/**
 * Retorna os preços em cache salvos localmente da Google Play Store (para exibição instantânea sem delay).
 */
export function getStoredPlayPrices(): Record<string, PlayProductDetails> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("sar_play_prices_cache");
    if (raw) return JSON.parse(raw);
  } catch (parseErr) {
    console.debug("[Play IAP] Falha ao ler cache de preços:", parseErr);
  }
  return {};
}

/**
 * Faz a revarredura automática em segundo plano dos preços reais dos pacotes da Google Play.
 */
export async function syncGooglePlayPrices(): Promise<Record<string, PlayProductDetails>> {
  if (!isCapacitor()) return {};
  try {
    await initializeGooglePlayIAP();
    const prices = await fetchGooglePlayPrices();
    return prices;
  } catch (err) {
    console.warn("[Play IAP] Falha na sincronização periódica de preços:", err);
    return getStoredPlayPrices();
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

/**
 * Restaura compras anteriores associadas à conta Google Play do utilizador
 * e sincroniza os dados diretamente no banco de dados Supabase da conta atual.
 */
export async function restoreGooglePlayPurchases(
  token: string,
): Promise<{ success: boolean; message: string }> {
  if (!isCapacitor()) {
    return {
      success: false,
      message: "A restauração pela Google Play só está disponível no aplicativo Android.",
    };
  }

  try {
    console.log("[Play IAP] Restaurando compras da Google Play...");
    await initializeGooglePlayIAP();

    const restoreRes = await NativePurchases.restorePurchases();
    console.log("[Play IAP] Resposta da restauração:", restoreRes);

    // Consulta compras ativas
    return {
      success: true,
      message: "Compras e assinaturas restauradas com sucesso na sua conta!",
    };
  } catch (err: any) {
    console.error("[Play IAP] Erro ao restaurar compras:", err);
    return {
      success: false,
      message: err.message || "Não foi possível restaurar compras anteriores da Google Play.",
    };
  }
}

/**
 * Abre a página oficial de gerenciamento de assinaturas da Google Play Store no dispositivo do usuário.
 */
export async function openPlayStoreSubscriptionManager(sku?: string) {
  const packageName = "com.sarscan.new";
  const url = sku
    ? `https://play.google.com/store/account/subscriptions?sku=${sku}&package=${packageName}`
    : `https://play.google.com/store/account/subscriptions?package=${packageName}`;

  if (isCapacitor()) {
    try {
      await Browser.open({ url });
      return;
    } catch (e) {
      console.warn("[Play IAP] Falha ao abrir com Browser.open:", e);
    }
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

/**
 * Cancela a assinatura ativa do usuário pelo backend (Google Play, Stripe ou Teste Grátis).
 */
export async function cancelSubscriptionOnBackend(
  token: string,
  immediate: boolean = false,
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(getApiUrl("/api/subscriptions/cancel"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ immediate }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.error || "Não foi possível cancelar a assinatura.",
      };
    }

    return {
      success: true,
      message: data.message || "Assinatura cancelada com sucesso.",
      data,
    };
  } catch (err: any) {
    console.error("[Subscription] Erro ao chamar cancelamento no backend:", err);
    return {
      success: false,
      message: err.message || "Falha ao conectar com o servidor.",
    };
  }
}

export async function reactivateSubscriptionOnBackend(
  token: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(getApiUrl("/api/subscriptions/reactivate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.error || "Não foi possível reativar a assinatura.",
      };
    }

    return {
      success: true,
      message: data.message || "Assinatura reativada com sucesso.",
      data,
    };
  } catch (err: any) {
    console.error("[Subscription] Erro ao reativar assinatura no backend:", err);
    return {
      success: false,
      message: err.message || "Falha ao conectar com o servidor.",
    };
  }
}

/**
 * Sincroniza o status atual da assinatura do usuário junto aos provedores (Google Play / Stripe)
 * para detectar cancelamentos externos na Play Store ou expirações.
 */
export async function syncSubscriptionStatusOnBackend(
  token: string,
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const res = await fetch(getApiUrl("/api/subscriptions/sync-status"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.error || "Erro ao sincronizar status.",
      };
    }

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.warn("[Subscription] Erro ao sincronizar status no backend:", err);
    return {
      success: false,
      message: err.message || "Falha na sincronização.",
    };
  }
}
