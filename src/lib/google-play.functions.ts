import { useState, useEffect } from "react";
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

export const ALL_PLAY_SUBSCRIPTION_IDS = [
  "sar_scan_assinatura",
  "sar_scan_assinatura_semanal",
  "sar_scan_assinatura_mensal",
  "sar_scan_assinatura_anual",
  "sar_scan_semanal",
  "sar_scan_mensal",
  "sar_scan_anual",
  "sar_scan_premium",
  "assinatura",
];

export const ALL_PLAY_INAPP_IDS = [
  "sar_scan_creditos",
  "sar_scan_credits",
  "creditos",
  "sar_scan_50_creditos",
  "50_creditos",
  "creditos_50",
];

export const PLAY_PRODUCT_IDS = {
  weekly: "sar_scan_assinatura_semanal",
  monthly: "sar_scan_assinatura",
  yearly: "sar_scan_assinatura_anual",
  credits: "sar_scan_creditos",
} as const;

export const PLAY_BASE_PLANS: Record<string, string> = {
  [PLAY_PRODUCT_IDS.weekly]: "semanal",
  [PLAY_PRODUCT_IDS.monthly]: "mensal",
  [PLAY_PRODUCT_IDS.yearly]: "anual",
  weekly: "semanal",
  monthly: "mensal",
  yearly: "anual",
  annual: "anual",
  sar_scan_assinatura_semanal: "semanal",
  sar_scan_assinatura_mensal: "mensal",
  sar_scan_assinatura: "mensal",
  sar_scan_assinatura_anual: "anual",
};

export function getBasePlanId(productIdOrPlan: string): string {
  const lower = (productIdOrPlan || "").toLowerCase();
  if (PLAY_BASE_PLANS[lower]) return PLAY_BASE_PLANS[lower];
  if (lower.includes("semanal") || lower === "weekly") return "semanal";
  if (lower.includes("anual") || lower === "yearly" || lower === "annual") return "anual";
  return "mensal";
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

const PLAY_PRICES_STORAGE_KEY = "sar_scan_google_play_prices_cache";

function getCachedPricesFromStorage(): Record<string, PlayProductDetails> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(PLAY_PRICES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.debug("[Play IAP] Erro ao ler cache de preços:", e);
  }
  return {};
}

// In-memory cache for fetched Play Store product pricing and offers
let cachedPlayPrices: Record<string, PlayProductDetails> = getCachedPricesFromStorage();

/**
 * Initialize Google Play In-App Purchase.
 */
export async function initializeGooglePlayIAP(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    console.log("[Play IAP] Inicializando Native Google Play Billing e varrendo preços...");
    fetchGooglePlayPrices().catch((e) =>
      console.warn("[Play IAP] Falha na varredura inicial de preços:", e),
    );
  } catch (error) {
    console.error("[Play IAP] Error during IAP initialization:", error);
  }
}

function isTrialOfferIdentifier(offerId?: string | null): boolean {
  if (!offerId) return false;
  const lower = offerId.toLowerCase().trim();
  return (
    lower === "77-dias-gratis" ||
    lower === "77diasgratis" ||
    lower === "77-dias-grátis" ||
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
    lower === "teste-gratis" ||
    lower === "teste-grátis" ||
    lower === "testegratis" ||
    lower === "free-trial" ||
    lower.includes("77") ||
    lower.includes("7-dias") ||
    lower.includes("7dias") ||
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

  const results: Record<string, PlayProductDetails> = { ...cachedPlayPrices };

  try {
    // 1. Consulta assinaturas configuradas na Google Play
    try {
      const subsResponse = await NativePurchases.getProducts({
        productIdentifiers: ALL_PLAY_SUBSCRIPTION_IDS,
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
            (prod.introductoryPrice !== null &&
              prod.introductoryPrice !== undefined &&
              prod.introductoryPrice === 0);

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
          const rawTitle = (prod.title || "").toLowerCase();

          if (
            rawId === PLAY_PRODUCT_IDS.weekly.toLowerCase() ||
            rawPlan === "semanal" ||
            rawId.endsWith("_semanal") ||
            rawId.includes("semanal") ||
            rawPlan.includes("semanal") ||
            rawTitle.includes("semanal") ||
            rawTitle.includes("semana")
          ) {
            if (!results["weekly"] || (!isTrial && prod.price && prod.price > 0)) {
              results["weekly"] = {
                ...details,
                formattedPrice:
                  (!isTrial && formatted) || results["weekly"]?.formattedPrice || formatted,
                price: (!isTrial && prod.price) || results["weekly"]?.price || prod.price || 0,
                trialOfferToken: isTrial ? prod.offerToken : results["weekly"]?.trialOfferToken,
                baseOfferToken: !isTrial ? prod.offerToken : results["weekly"]?.baseOfferToken,
              };
            } else if (isTrial && results["weekly"]) {
              results["weekly"].trialOfferToken = prod.offerToken;
              results["weekly"].hasFreeTrial = true;
            }
          } else if (
            rawId === PLAY_PRODUCT_IDS.yearly.toLowerCase() ||
            rawPlan === "anual" ||
            rawId.endsWith("_anual") ||
            rawId.includes("anual") ||
            rawPlan.includes("anual") ||
            rawTitle.includes("anual") ||
            rawTitle.includes("ano")
          ) {
            results["yearly"] = details;
          } else if (
            rawId === PLAY_PRODUCT_IDS.monthly.toLowerCase() ||
            rawPlan === "mensal" ||
            rawId === "sar_scan_assinatura" ||
            rawId.includes("mensal") ||
            rawId.includes("assinatura") ||
            rawPlan.includes("mensal") ||
            rawTitle.includes("mensal") ||
            rawTitle.includes("mês") ||
            rawTitle.includes("mes")
          ) {
            results["monthly"] = details;
          }
        }
      }
    } catch (subErr) {
      console.warn("[Play IAP] Erro ao consultar preços de assinaturas na Google Play:", subErr);
    }

    // 2. Consulta produto consumível de créditos (Pacote de 50 scans)
    try {
      const inAppResponse = await NativePurchases.getProducts({
        productIdentifiers: ALL_PLAY_INAPP_IDS,
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

    // Persiste no localStorage do dispositivo para carregamento instantâneo nas próximas aberturas
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(PLAY_PRICES_STORAGE_KEY, JSON.stringify(cachedPlayPrices));
        window.dispatchEvent(
          new CustomEvent("sarscan_play_prices_updated", { detail: cachedPlayPrices }),
        );
      }
    } catch (saveErr) {
      console.debug("[Play IAP] Falha ao persistir cache de preços:", saveErr);
    }

    console.log(
      "[Play IAP] Tabela de preços atualizada com dados do Google Play Console:",
      results,
    );
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
  if (Object.keys(cachedPlayPrices).length === 0) {
    cachedPlayPrices = getCachedPricesFromStorage();
  }
  return cachedPlayPrices;
}

/**
 * React Hook para obter e reagir em tempo real aos preços oficiais do Google Play Console.
 */
export function useGooglePlayPrices() {
  const [prices, setPrices] = useState<Record<string, PlayProductDetails>>(() =>
    getStoredPlayPrices(),
  );
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const handlePricesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Record<string, PlayProductDetails>>;
      if (customEvent?.detail) {
        setPrices({ ...customEvent.detail });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("sarscan_play_prices_updated", handlePricesUpdated);
    }

    if (isCapacitor()) {
      setIsScanning(true);
      fetchGooglePlayPrices()
        .then((updated) => {
          if (updated && Object.keys(updated).length > 0) {
            setPrices({ ...updated });
          }
        })
        .catch((err) => {
          console.warn("[useGooglePlayPrices] Falha ao varrer preços:", err);
        })
        .finally(() => {
          setIsScanning(false);
        });
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("sarscan_play_prices_updated", handlePricesUpdated);
      }
    };
  }, []);

  return {
    prices,
    isScanning,
    refreshPrices: fetchGooglePlayPrices,
  };
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
  offerToken?: string;
}

/**
 * Inicia o fluxo nativo oficial de faturamento da Google Play Store no Android
 * com auto-descoberta dinâmica de produtos, ofertas e planos base.
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
    const isSub = productId !== "sar_scan_creditos" && productId !== PLAY_PRODUCT_IDS.credits;
    const targetPlan = (purchaseOpts.customPlanId || getBasePlanId(productId)).toLowerCase();

    let planIdentifier: string = targetPlan;
    let finalProductId: string = productId;
    let selectedOfferToken: string | undefined = purchaseOpts.offerToken;

    // 1. Verifica elegibilidade para teste grátis (7 dias)
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

    // 2. Consulta à Google Play para identificar com precisão o produto e a oferta
    if (isSub) {
      try {
        const queryIds = Array.from(new Set([productId, ...ALL_PLAY_SUBSCRIPTION_IDS]));
        const prodQuery = await NativePurchases.getProducts({
          productIdentifiers: queryIds,
          productType: PURCHASE_TYPE.SUBS,
        });

        console.log("[Play IAP] Produtos encontrados no Google Play:", prodQuery?.products);

        if (
          prodQuery?.products &&
          Array.isArray(prodQuery.products) &&
          prodQuery.products.length > 0
        ) {
          // Filtra produtos que correspondem ao plano desejado (semanal, mensal ou anual)
          const matchingProducts = prodQuery.products.filter((p) => {
            const rawId = (p.identifier || "").toLowerCase();
            const rawPlan = (p.planIdentifier || "").toLowerCase();
            const title = (p.title || "").toLowerCase();

            if (targetPlan === "semanal") {
              return (
                rawId.includes("semanal") ||
                rawPlan.includes("semanal") ||
                title.includes("semanal") ||
                title.includes("semana") ||
                rawId === PLAY_PRODUCT_IDS.weekly.toLowerCase()
              );
            }
            if (targetPlan === "anual") {
              return (
                rawId.includes("anual") ||
                rawPlan.includes("anual") ||
                title.includes("anual") ||
                title.includes("ano") ||
                rawId === PLAY_PRODUCT_IDS.yearly.toLowerCase()
              );
            }
            // Mensal (padrão)
            return (
              rawId.includes("mensal") ||
              rawPlan.includes("mensal") ||
              title.includes("mensal") ||
              title.includes("mês") ||
              rawId === "sar_scan_assinatura" ||
              rawId === PLAY_PRODUCT_IDS.monthly.toLowerCase()
            );
          });

          const candidates = matchingProducts.length > 0 ? matchingProducts : prodQuery.products;

          if (eligibleForTrial) {
            // Busca oferta com 7 dias grátis
            const trialOffer = candidates.find((p) => {
              return (
                isTrialOfferIdentifier(p.offerId) ||
                isTrialOfferIdentifier(p.identifier) ||
                p.price === 0 ||
                (p.introductoryPrice !== null &&
                  p.introductoryPrice !== undefined &&
                  p.introductoryPrice === 0)
              );
            });

            if (trialOffer) {
              console.log("[Play IAP] Oferta de teste gratuito encontrada:", trialOffer);
              selectedOfferToken = trialOffer.offerToken || selectedOfferToken;
              finalProductId = trialOffer.planIdentifier || trialOffer.identifier || finalProductId;
              planIdentifier = trialOffer.identifier || targetPlan;
            } else {
              // Fallback para primeira oferta do plano
              const firstOffer = candidates[0];
              selectedOfferToken = firstOffer.offerToken || selectedOfferToken;
              finalProductId = firstOffer.planIdentifier || firstOffer.identifier || finalProductId;
              planIdentifier = firstOffer.identifier || targetPlan;
            }
          } else {
            // Compra normal (sem teste): pega a oferta base
            const baseOffer =
              candidates.find((p) => !p.offerId || !isTrialOfferIdentifier(p.offerId)) ||
              candidates[0];
            if (baseOffer) {
              selectedOfferToken = baseOffer.offerToken || selectedOfferToken;
              finalProductId = baseOffer.planIdentifier || baseOffer.identifier || finalProductId;
              planIdentifier = baseOffer.identifier || targetPlan;
            }
          }
        }
      } catch (queryErr) {
        console.warn("[Play IAP] Aviso ao consultar ofertas de assinatura:", queryErr);
      }
    } else {
      // In-App (Créditos de 50 scans)
      try {
        const prodQuery = await NativePurchases.getProducts({
          productIdentifiers: ALL_PLAY_INAPP_IDS,
          productType: PURCHASE_TYPE.INAPP,
        });
        if (prodQuery?.products && prodQuery.products.length > 0) {
          const item = prodQuery.products[0];
          finalProductId = item.identifier || productId;
          selectedOfferToken = item.offerToken || selectedOfferToken;
        }
      } catch (inAppQueryErr) {
        console.warn("[Play IAP] Aviso ao consultar produto de créditos:", inAppQueryErr);
      }
    }

    // 3. Monta os parâmetros para NativePurchases.purchaseProduct
    const purchaseOptions: any = {
      productIdentifier: finalProductId,
      productType: isSub ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP,
      isConsumable: !isSub,
      autoAcknowledgePurchases: true,
    };

    if (isSub) {
      purchaseOptions.planIdentifier = planIdentifier;
      if (selectedOfferToken) {
        purchaseOptions.offerToken = selectedOfferToken;
      }
    }

    console.log("[Play IAP] Disparando Bottom Sheet da Google Play com:", purchaseOptions);
    const transaction = await NativePurchases.purchaseProduct(purchaseOptions);

    console.log("[Play IAP] Transação oficial retornada pela Google Play:", transaction);

    const purchaseToken = transaction.purchaseToken;
    if (!purchaseToken) {
      return {
        success: false,
        error: "Google Play concluiu a compra mas não gerou o token de autorização.",
      };
    }

    // 4. Se for consumível (créditos), consome na Google Play
    if (!isSub) {
      try {
        await NativePurchases.consumePurchase({ purchaseToken });
      } catch (consumeErr) {
        console.warn("[Play IAP] Aviso ao consumir produto:", consumeErr);
      }
    }

    // 5. Envia o token para validação no backend
    const verification = await verifyPurchaseOnBackend(finalProductId, purchaseToken, token);
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

    if (
      errorMessage.includes("Product not found") ||
      errorMessage.includes("ITEM_UNAVAILABLE") ||
      errorMessage.includes("not found")
    ) {
      return {
        success: false,
        error:
          "Produto não encontrado na Google Play Store. Verifique se o produto está ativo no Google Play Console e se a sua conta Google Play está cadastrada na faixa de testes do app.",
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
