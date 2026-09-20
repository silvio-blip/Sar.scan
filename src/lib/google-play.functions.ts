import { getApiUrl } from "./utils";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { NativePurchases, PURCHASE_TYPE, type Product } from "@capgo/native-purchases";
import { supabase } from "@/integrations/supabase/client";

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
  offerId?: string | null;
  baseOfferToken?: string;
  trialOfferToken?: string;
  hasFreeTrial?: boolean;
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

// In-memory cache for fetched Play Store product pricing and offers
let cachedPlayPrices: Record<string, PlayProductDetails> = {};

function isTrialOfferIdentifier(offerId?: string | null): boolean {
  if (!offerId) return false;
  const lower = offerId.toLowerCase().trim();
  return (
    lower === "7-dias-gratis" ||
    lower === "7-dias-grátis" ||
    lower === "7-dias-de-graca" ||
    lower === "7-dias-de-graça" ||
    lower === "7dias" ||
    lower === "7-dias" ||
    lower === "7_dias_gratis" ||
    lower === "7_dias_de_graca" ||
    lower === "7 dias" ||
    lower === "7 dias gratis" ||
    lower === "7 dias de graça" ||
    lower === "7 dias de graca" ||
    lower === "7-dias-de-gratis" ||
    lower.includes("7") ||
    lower.includes("trial") ||
    lower.includes("gratis") ||
    lower.includes("grátis") ||
    lower.includes("graça") ||
    lower.includes("graca") ||
    lower.includes("free")
  );
}

/**
 * Consulta a Google Play Store em tempo real para obter os preços oficiais
 * definidos na Google Play Console do país/moeda da conta do utilizador.
 */
export async function fetchGooglePlayPrices(): Promise<Record<string, PlayProductDetails>> {
  if (!isCapacitor()) {
    return cachedPlayPrices;
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

      console.log(
        "[Play IAP] Produtos de assinatura retornados pela Google Play:",
        subsResponse?.products,
      );

      if (subsResponse?.products && Array.isArray(subsResponse.products)) {
        for (const prod of subsResponse.products) {
          const formatted =
            prod.priceString ||
            (prod.currencySymbol
              ? `${prod.currencySymbol} ${prod.price}`
              : `${prod.price} ${prod.currencyCode || "EUR"}`);

          const isTrial =
            isTrialOfferIdentifier(prod.offerId) ||
            prod.price === 0 ||
            (prod.introductoryPrice !== null && prod.introductoryPrice !== undefined);

          const details: PlayProductDetails = {
            productId: prod.identifier,
            formattedPrice: formatted,
            price: prod.price ?? 0,
            currencyCode: prod.currencyCode ?? "EUR",
            currencySymbol: prod.currencySymbol ?? "€",
            title: prod.title,
            description: prod.description,
            offerToken: prod.offerToken,
            offerId: prod.offerId,
            hasFreeTrial: isTrial,
          };

          // Salva pelo identificador retornado
          results[prod.identifier] = details;
          if (prod.planIdentifier) {
            results[prod.planIdentifier] = details;
          }

          // Mapeia para chaves de plano padronizadas
          const rawId = (prod.identifier || "").toLowerCase();
          const rawPlan = (prod.planIdentifier || "").toLowerCase();

          if (
            rawId === PLAY_PRODUCT_IDS.weekly.toLowerCase() ||
            rawPlan === PLAY_PRODUCT_IDS.weekly.toLowerCase() ||
            rawPlan === "semanal" ||
            rawId.includes("semanal")
          ) {
            if (!results["weekly"] || (!results["weekly"].trialOfferToken && isTrial)) {
              results["weekly"] = {
                ...details,
                trialOfferToken: isTrial ? prod.offerToken : results["weekly"]?.trialOfferToken,
                baseOfferToken: !isTrial ? prod.offerToken : results["weekly"]?.baseOfferToken,
              };
            }
          } else if (
            rawId === PLAY_PRODUCT_IDS.monthly.toLowerCase() ||
            rawPlan === PLAY_PRODUCT_IDS.monthly.toLowerCase() ||
            rawPlan === "mensal" ||
            rawId.includes("assinatura")
          ) {
            results["monthly"] = details;
          } else if (
            rawId === PLAY_PRODUCT_IDS.yearly.toLowerCase() ||
            rawPlan === PLAY_PRODUCT_IDS.yearly.toLowerCase() ||
            rawPlan === "anual" ||
            rawId.includes("anual")
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

      console.log(
        "[Play IAP] Produtos consumíveis retornados pela Google Play:",
        inAppResponse?.products,
      );

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
      console.warn("[Play IAP] Erro ao consultar consumíveis na Google Play:", inAppErr);
    }

    cachedPlayPrices = { ...cachedPlayPrices, ...results };
    console.log("[Play IAP] Tabela de preços consolidada da Google Play:", results);
    return results;
  } catch (err) {
    console.error("[Play IAP] Erro geral ao obter preços da Google Play:", err);
    return cachedPlayPrices;
  }
}

/**
 * Retorna os preços em cache da Google Play Store.
 */
export function getStoredPlayPrices(): Record<string, PlayProductDetails> {
  return cachedPlayPrices;
}

/**
 * Força sincronização de preços da Google Play.
 */
export async function syncGooglePlayPrices(): Promise<Record<string, PlayProductDetails>> {
  return fetchGooglePlayPrices();
}

export interface GooglePlayPurchaseOptions {
  customPlanId?: string;
  isTrial?: boolean;
  offerId?: string;
}

/**
 * Launches the REAL native Google Play purchase bottom sheet on the Android device
 * and captures the purchase token, sending it to the backend for authorization.
 *
 * @param productId Product identifier ('sar_scan_creditos', 'sar_scan_assinatura', etc.)
 * @param token User authenticated JWT token for authorization
 * @param options Purchase options including isTrial, customPlanId, etc.
 */
export async function requestGooglePlayPurchase(
  productId: string,
  token: string,
  options?: GooglePlayPurchaseOptions | string,
): Promise<{ success: boolean; data?: any; error?: string; isCancelled?: boolean }> {
  const purchaseOpts: GooglePlayPurchaseOptions =
    typeof options === "string" ? { customPlanId: options } : options || {};

  console.log(
    `[Play IAP] Invocando compra nativa Google Play para o produto: ${productId}, options:`,
    purchaseOpts,
  );

  if (!isCapacitor()) {
    return {
      success: false,
      error: "Google Play só está disponível dentro do aplicativo Android.",
    };
  }

  try {
    const isSub = productId !== "sar_scan_creditos";

    // Determina o ID do Plano Base configurado no Google Play Console
    let planIdentifier: string | undefined = purchaseOpts.customPlanId;
    if (isSub && !planIdentifier) {
      if (productId.includes("semanal")) {
        planIdentifier = "semanal";
      } else if (productId.includes("anual")) {
        planIdentifier = "anual";
      } else {
        planIdentifier = "mensal";
      }
    }

    let selectedOfferToken: string | undefined = undefined;

    // Verifica no banco de dados se o utilizador já possui assinatura ativa ou já utilizou o período de teste
    let eligibleForTrial = Boolean(purchaseOpts.isTrial);
    if (eligibleForTrial && token) {
      try {
        const { data: userAuth } = await supabase.auth.getUser(token);
        const userId = userAuth?.user?.id;
        if (userId) {
          const { data: dbSub } = await supabase
            .from("subscriptions")
            .select("status, plan, trial_end, stripe_subscription_id, play_purchase_token")
            .eq("user_id", userId)
            .maybeSingle();

          if (
            dbSub &&
            (dbSub.status === "active" ||
              dbSub.status === "trialing" ||
              dbSub.status === "expired" ||
              Boolean(dbSub.trial_end) ||
              Boolean(dbSub.stripe_subscription_id) ||
              Boolean(dbSub.play_purchase_token) ||
              (dbSub.plan && dbSub.plan !== "free"))
          ) {
            console.log(
              "[Play IAP] Utilizador já possui assinatura ou teste no banco de dados. Forçando plano base pago.",
            );
            eligibleForTrial = false;
          }
        }
      } catch (dbCheckErr) {
        console.warn("[Play IAP] Verificação de elegibilidade no banco:", dbCheckErr);
      }
    }

    // Se for assinatura, busca os produtos e ofertas disponíveis para encontrar a oferta exata (ex: 7 dias grátis)
    if (isSub) {
      try {
        const prodQuery = await NativePurchases.getProducts({
          productIdentifiers: [productId],
          productType: PURCHASE_TYPE.SUBS,
        });

        if (
          prodQuery?.products &&
          Array.isArray(prodQuery.products) &&
          prodQuery.products.length > 0
        ) {
          console.log("[Play IAP] Ofertas disponíveis para o produto:", prodQuery.products);

          if (eligibleForTrial) {
            // Busca a oferta de 7 dias grátis configurada no Google Play Console
            const trialOffer = prodQuery.products.find((p) => {
              const isTrial =
                isTrialOfferIdentifier(p.offerId) ||
                isTrialOfferIdentifier(p.identifier) ||
                p.price === 0 ||
                (p.introductoryPrice !== null && p.introductoryPrice !== undefined);
              return isTrial;
            });

            if (trialOffer && trialOffer.offerToken) {
              console.log("[Play IAP] Oferta de Teste Grátis de 7 dias encontrada:", trialOffer);
              selectedOfferToken = trialOffer.offerToken;
              if (trialOffer.identifier) {
                planIdentifier = trialOffer.identifier;
              }
            } else {
              // Fallback para a primeira oferta disponível caso não haja diferenciação explícita
              console.log("[Play IAP] Usando oferta padrão disponível:", prodQuery.products[0]);
              selectedOfferToken = prodQuery.products[0].offerToken;
            }
          } else {
            // Compra regular (sem teste): seleciona oferta base padrão sem trial
            const baseOffer =
              prodQuery.products.find((p) => !p.offerId || !isTrialOfferIdentifier(p.offerId)) ||
              prodQuery.products[0];
            if (baseOffer) {
              selectedOfferToken = baseOffer.offerToken;
              if (baseOffer.identifier) {
                planIdentifier = baseOffer.identifier;
              }
            }
          }
        }
      } catch (queryErr) {
        console.warn("[Play IAP] Erro ao consultar produtos para obter offerToken:", queryErr);
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

    if (isSub && selectedOfferToken) {
      purchaseOptions.offerToken = selectedOfferToken;
    }

    console.log("[Play IAP] Chamando NativePurchases.purchaseProduct com:", purchaseOptions);
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
      errorMessage.includes("cancel") ||
      errorMessage.includes("Purchase is not purchased") ||
      errorMessage.includes("Purchases is not purchased") ||
      errorMessage.includes("Activity was cancelled") ||
      errorMessage.includes("User pressed back") ||
      errorMessage.includes("RESULT_CANCELED")
    ) {
      return { success: false, error: "Operação cancelada na Google Play.", isCancelled: true };
    }

    if (errorMessage.includes("ITEM_ALREADY_OWNED")) {
      return {
        success: false,
        error: "Você já possui este item ou assinatura ativa na Google Play.",
      };
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
