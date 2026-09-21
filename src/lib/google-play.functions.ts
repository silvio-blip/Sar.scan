import { useState, useEffect } from "react";
import { getApiUrl, isInstalledApp } from "./utils";
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
  "semanal",
  "mensal",
  "anual",
  "creditos",
  "credito",
  "sar_scan_pass_semanal",
  "sar_scan_pass_mensal",
  "sar_scan_pass_anual",
  "sar_scan_creditos",
  "sar_scan_credits",
  "sar_scan_50_creditos",
  "50_creditos",
  "creditos_50",
  // IDs legados para compatibilidade
  "sar_scan_assinatura_semanal",
  "sar_scan_assinatura",
  "sar_scan_assinatura_anual",
  "sar_scan_semanal",
  "sar_scan_mensal",
  "sar_scan_anual",
];

export const PLAY_PRODUCT_IDS = {
  weekly: "semanal",
  monthly: "mensal",
  yearly: "anual",
  credits: "creditos",
} as const;

export const PLAY_BASE_PLANS: Record<string, string> = {
  semanal: "semanal",
  mensal: "mensal",
  anual: "anual",
  creditos: "creditos",
  [PLAY_PRODUCT_IDS.weekly]: "semanal",
  [PLAY_PRODUCT_IDS.monthly]: "mensal",
  [PLAY_PRODUCT_IDS.yearly]: "anual",
  sar_scan_pass_semanal: "semanal",
  sar_scan_pass_mensal: "mensal",
  sar_scan_pass_anual: "anual",
  sar_scan_creditos: "creditos",
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
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return true;
  } catch (e) {
    console.debug("[Play IAP] isCapacitor detection exception:", e);
  }
  return false;
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

export function isUserCancellation(err: any): boolean {
  if (!err) return false;
  if (err.isCancelled === true) return true;
  if (
    err.code === 1 ||
    err.code === "1" ||
    err.responseCode === 1 ||
    err.responseCode === "1" ||
    err.errorCode === 1 ||
    err.errorCode === "1"
  ) {
    return true;
  }

  const str = (
    (typeof err === "string" ? err : "") +
    " " +
    (err.message || "") +
    " " +
    (err.errorMessage || "") +
    " " +
    (err.error || "") +
    " " +
    (err.code || "") +
    " " +
    (err.description || "") +
    " " +
    JSON.stringify(err)
  ).toLowerCase();

  return (
    str.includes("cancel") ||
    str.includes("user_canceled") ||
    str.includes("user_cancelled") ||
    str.includes("user canceled") ||
    str.includes("user cancelled") ||
    str.includes("user pressed back") ||
    str.includes("activity was cancelled") ||
    str.includes("activity was canceled") ||
    str.includes("result_canceled") ||
    str.includes("result_cancelled") ||
    str.includes("not purchased") ||
    str.includes("dismiss") ||
    str.includes("closed") ||
    str.includes("billingresponsecode.user_canceled") ||
    str.includes("responsecode: 1") ||
    str.includes('"code":1') ||
    str.includes('"code":"1"') ||
    str.includes('"responsecode":1')
  );
}

function isTrialOfferIdentifier(offerId?: string | null): boolean {
  if (!offerId) return false;
  return offerId.trim() === "7-dias-gratis";
}

/**
 * Consulta a Google Play Store em tempo real para obter os preços oficiais
 * definidos na Google Play Console do país/moeda da conta do utilizador.
 */
export async function fetchGooglePlayPrices(): Promise<Record<string, PlayProductDetails>> {
  if (!isCapacitor()) {
    return cachedPlayPrices;
  }

  try {
    if (!Capacitor.isNativePlatform()) {
      return cachedPlayPrices;
    }
  } catch {
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
    } catch (subErr: any) {
      if (
        !subErr?.message?.includes("mocked in web") &&
        !JSON.stringify(subErr || "").includes("mocked in web")
      ) {
        console.warn("[Play IAP] Erro ao consultar preços de assinaturas na Google Play:", subErr);
      }
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

          const lowerId = (prod.identifier || "").toLowerCase();
          if (
            lowerId === PLAY_PRODUCT_IDS.weekly.toLowerCase() ||
            lowerId.includes("pass_semanal") ||
            lowerId.includes("semanal")
          ) {
            results["weekly"] = details;
            results["semanal"] = details;
          } else if (
            lowerId === PLAY_PRODUCT_IDS.yearly.toLowerCase() ||
            lowerId.includes("pass_anual") ||
            lowerId.includes("anual")
          ) {
            results["yearly"] = details;
            results["anual"] = details;
          } else if (
            lowerId === PLAY_PRODUCT_IDS.monthly.toLowerCase() ||
            lowerId.includes("pass_mensal") ||
            lowerId.includes("mensal")
          ) {
            results["monthly"] = details;
            results["mensal"] = details;
          } else if (
            lowerId.includes("credito") ||
            lowerId.includes("credit") ||
            lowerId === "sar_scan_creditos"
          ) {
            results["credits"] = details;
          }
        }
      }
    } catch (inAppErr: any) {
      if (
        !inAppErr?.message?.includes("mocked in web") &&
        !JSON.stringify(inAppErr || "").includes("mocked in web")
      ) {
        console.warn("[Play IAP] Erro ao consultar consumíveis na Google Play:", inAppErr);
      }
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
  appAccountToken?: string;
  userId?: string;
  obfuscatedAccountId?: string;
  setObfuscatedAccountId?: string;
  obfuscatedProfileId?: string;
  setObfuscatedProfileId?: string;
}

/**
 * Obfuscates the internal user account ID for Google Play Billing Flow
 * (setObfuscatedAccountId / setObfuscatedProfileId) complying with Google Play's 64-character limit.
 */
export function getObfuscatedAccountId(rawUserId?: string): string | undefined {
  if (!rawUserId || typeof rawUserId !== "string") return undefined;
  const clean = rawUserId.trim();
  if (!clean) return undefined;
  // Formata/ofusca o identificador único do utilizador respeitando o limite máximo de 64 caracteres da Google Play
  return clean.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

/**
 * Helper to extract user identifier from JWT without external libraries.
 */
function getUserIdFromToken(token?: string): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.sub || payload.user_id || payload.id;
    }
  } catch (err) {
    console.debug("[Play IAP] Falha ao extrair payload JWT:", err);
  }
  return undefined;
}

/**
 * Checks if the error message or error code indicates ITEM_ALREADY_OWNED from Google Play.
 */
export function isItemAlreadyOwnedError(err: any): boolean {
  if (!err) return false;
  if (
    err.code === 7 ||
    err.code === "7" ||
    err.responseCode === 7 ||
    err.responseCode === "7" ||
    err.errorCode === 7 ||
    err.errorCode === "7" ||
    err.billingResponseCode === 7 ||
    err.billingResponseCode === "7"
  ) {
    return true;
  }
  const msg =
    typeof err === "string"
      ? err
      : err?.message || err?.error || err?.errorMessage || JSON.stringify(err);
  const normalized = String(msg).toLowerCase();
  return (
    normalized.includes("item_already_owned") ||
    normalized.includes("already owned") ||
    normalized.includes("already_owned") ||
    normalized.includes("already subscribed") ||
    normalized.includes("already_subscribed") ||
    normalized.includes("already purchased") ||
    normalized.includes("já possui este item") ||
    normalized.includes("ja possui este item") ||
    normalized.includes("já possui") ||
    normalized.includes("ja possui") ||
    normalized.includes("já subscreveu") ||
    normalized.includes("ja subscreveu") ||
    normalized.includes("já tem uma assinatura") ||
    normalized.includes("ja tem uma assinatura") ||
    normalized.includes("já é assinante") ||
    normalized.includes("ja e assinante") ||
    normalized.includes("subscreveu") ||
    normalized.includes("gerir subscrições") ||
    normalized.includes("gerir subscricoes") ||
    normalized.includes("gerenciar assinaturas") ||
    normalized.includes("gerir assinaturas") ||
    normalized.includes("billingresponsecode.item_already_owned") ||
    normalized.includes("response code: 7") ||
    normalized.includes("responsecode: 7") ||
    normalized.includes("code: 7") ||
    normalized.includes("code 7") ||
    normalized.includes('code":7') ||
    normalized.includes('code": 7')
  );
}

/**
 * Inicia o fluxo nativo oficial de faturamento da Google Play Store no Android
 * com isolamento estrito de conta (cada conta de utilizador é 100% individual).
 */
export async function requestGooglePlayPurchase(
  productId: string,
  token: string,
  options?: GooglePlayPurchaseOptions | string,
): Promise<{ success: boolean; data?: any; error?: string; isCancelled?: boolean }> {
  const purchaseOpts: GooglePlayPurchaseOptions =
    typeof options === "string" ? { customPlanId: options } : options || {};

  const rawUserId =
    purchaseOpts.userId ||
    purchaseOpts.appAccountToken ||
    purchaseOpts.obfuscatedAccountId ||
    purchaseOpts.setObfuscatedAccountId ||
    getUserIdFromToken(token);

  const obfuscatedAccountId = getObfuscatedAccountId(rawUserId);

  console.log(
    `[Play IAP] Invocando compra nativa Google Play para o produto: ${productId}, userId: ${rawUserId}, obfuscatedAccountId: ${obfuscatedAccountId}, options:`,
    purchaseOpts,
  );

  if (!isCapacitor()) {
    return {
      success: false,
      error: "Google Play só está disponível dentro do aplicativo Android.",
    };
  }

  try {
    let targetPlan = (purchaseOpts.customPlanId || getBasePlanId(productId)).toLowerCase();
    let finalProductId = productId;

    // Mapeia para os novos IDs de produtos únicos (Passe Semanal, Mensal, Anual e Créditos)
    if (productId === "weekly" || productId.includes("semanal") || targetPlan === "semanal") {
      finalProductId = PLAY_PRODUCT_IDS.weekly; // "sar_scan_pass_semanal"
      targetPlan = "semanal";
    } else if (productId === "yearly" || productId.includes("anual") || targetPlan === "anual") {
      finalProductId = PLAY_PRODUCT_IDS.yearly; // "sar_scan_pass_anual"
      targetPlan = "anual";
    } else if (
      productId === "credits" ||
      productId.includes("credito") ||
      productId.includes("credit")
    ) {
      finalProductId = PLAY_PRODUCT_IDS.credits; // "sar_scan_creditos"
      targetPlan = "credits";
    } else if (productId === "monthly" || productId.includes("mensal") || targetPlan === "mensal") {
      finalProductId = PLAY_PRODUCT_IDS.monthly; // "sar_scan_pass_mensal"
      targetPlan = "mensal";
    }

    // Identifica se é Produto Único (INAPP: Passes de Acesso ou Créditos) ou Subscrição Legada
    const isOneTimeProduct =
      finalProductId.startsWith("sar_scan_pass_") ||
      finalProductId.includes("pass_") ||
      finalProductId.includes("credito") ||
      finalProductId.includes("credit") ||
      finalProductId === "sar_scan_creditos" ||
      !finalProductId.includes("assinatura");

    let transaction: any = null;
    const successfulProductId: string = finalProductId;

    if (isOneTimeProduct) {
      // Modelo Free Fire: Produto único consumível com acesso temporal gerenciado pelo backend
      console.log(
        `[Play IAP - Free Fire Model] Iniciando compra de produto único: ${finalProductId}, accountId: ${obfuscatedAccountId || "NENHUM"}`,
      );

      // Limpeza preventiva de transações não consumidas no dispositivo para evitar 'ITEM_ALREADY_OWNED'
      try {
        const { purchases } = await NativePurchases.getPurchases({
          productType: PURCHASE_TYPE.INAPP,
        });
        if (purchases && Array.isArray(purchases)) {
          for (const p of purchases) {
            if (
              p.purchaseToken &&
              (p.productIdentifier === finalProductId || !p.productIdentifier)
            ) {
              console.log(
                "[Play IAP] Consumindo pendência prévia de produto único no aparelho:",
                p.productIdentifier,
              );
              await NativePurchases.consumePurchase({ purchaseToken: p.purchaseToken });
            }
          }
        }
      } catch (cleanPendingErr) {
        console.debug("[Play IAP] Nota na limpeza preventiva de produtos in-app:", cleanPendingErr);
      }

      // Monta os parâmetros de compra in-app com conta ofuscada
      const purchaseOptions: any = {
        productIdentifier: finalProductId,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: true,
        autoAcknowledgePurchases: true,
      };

      if (obfuscatedAccountId) {
        purchaseOptions.setObfuscatedAccountId = obfuscatedAccountId;
        purchaseOptions.obfuscatedAccountId = obfuscatedAccountId;
        purchaseOptions.setObfuscatedProfileId = obfuscatedAccountId;
        purchaseOptions.obfuscatedProfileId = obfuscatedAccountId;
        purchaseOptions.appAccountToken = obfuscatedAccountId;
        purchaseOptions.accountId = obfuscatedAccountId;
      }

      console.log("[Play IAP] Chamando NativePurchases.purchaseProduct (INAPP):", purchaseOptions);

      try {
        transaction = await NativePurchases.purchaseProduct(purchaseOptions);
      } catch (inAppErr: any) {
        console.log("[Play IAP] Retorno/Erro da chamada de produto único:", inAppErr);
        if (isUserCancellation(inAppErr)) {
          return {
            success: false,
            error: "A compra não foi concluída.",
            isCancelled: true,
          };
        }

        // Se porventura a Google Play indicar que já foi adquirido no dispositivo, consome e tenta mais uma vez
        if (isItemAlreadyOwnedError(inAppErr)) {
          console.log("[Play IAP] Item já adquirido detectado. Forçando consumo de liberação...");
          try {
            const { purchases } = await NativePurchases.getPurchases({
              productType: PURCHASE_TYPE.INAPP,
            });
            let consumedAny = false;
            for (const p of purchases || []) {
              if (p.purchaseToken) {
                await NativePurchases.consumePurchase({ purchaseToken: p.purchaseToken });
                consumedAny = true;
              }
            }
            if (consumedAny) {
              console.log("[Play IAP] Retentando compra após consumo de liberação...");
              transaction = await NativePurchases.purchaseProduct(purchaseOptions);
            }
          } catch (retryErr: any) {
            console.warn("[Play IAP] Falha na retentativa pós-consumo:", retryErr);
            if (isUserCancellation(retryErr)) {
              return { success: false, error: "A compra não foi concluída.", isCancelled: true };
            }
            throw retryErr;
          }
        } else {
          throw inAppErr;
        }
      }
    } else {
      // Subscrições Legadas (SUBS)
      let planIdentifier: string = targetPlan;
      let selectedOfferToken: string | undefined = purchaseOpts.offerToken;
      const eligibleForTrial = Boolean(purchaseOpts.isTrial);

      try {
        const prodQuery = await NativePurchases.getProducts({
          productIdentifiers: [finalProductId],
          productType: PURCHASE_TYPE.SUBS,
        });

        if (
          prodQuery?.products &&
          Array.isArray(prodQuery.products) &&
          prodQuery.products.length > 0
        ) {
          const candidates = prodQuery.products;
          const baseOffer =
            candidates.find((p) => !(p.offerId || "").toLowerCase()) || candidates[0];
          if (baseOffer) {
            selectedOfferToken = baseOffer.offerToken || selectedOfferToken;
            planIdentifier = baseOffer.planIdentifier || planIdentifier;
          }
        }
      } catch (queryErr) {
        console.warn("[Play IAP] Aviso ao consultar ofertas de assinatura legada:", queryErr);
      }

      const purchaseOptions: any = {
        productIdentifier: finalProductId,
        productType: PURCHASE_TYPE.SUBS,
        planIdentifier: planIdentifier,
        autoAcknowledgePurchases: true,
      };
      if (selectedOfferToken) {
        purchaseOptions.offerToken = selectedOfferToken;
      }
      if (obfuscatedAccountId) {
        purchaseOptions.setObfuscatedAccountId = obfuscatedAccountId;
        purchaseOptions.obfuscatedAccountId = obfuscatedAccountId;
        purchaseOptions.setObfuscatedProfileId = obfuscatedAccountId;
        purchaseOptions.obfuscatedProfileId = obfuscatedAccountId;
        purchaseOptions.appAccountToken = obfuscatedAccountId;
        purchaseOptions.accountId = obfuscatedAccountId;
      }

      try {
        transaction = await NativePurchases.purchaseProduct(purchaseOptions);
      } catch (attemptErr: any) {
        if (isUserCancellation(attemptErr)) {
          return { success: false, error: "O plano não foi concluído.", isCancelled: true };
        }
        if (isItemAlreadyOwnedError(attemptErr)) {
          return {
            success: false,
            error:
              "Esta conta da Google Play no seu aparelho já possui uma assinatura ativa deste plano. Para assinar nesta conta, selecione outro plano ou adquira um passe de acesso.",
          };
        }
        throw attemptErr;
      }
    }

    if (!transaction) {
      return {
        success: false,
        error: "O plano não foi concluído.",
        isCancelled: true,
      };
    }

    console.log("[Play IAP] Transação oficial retornada pela Google Play:", transaction);

    const purchaseToken = transaction?.purchaseToken;
    if (!purchaseToken) {
      return {
        success: false,
        error: "Google Play concluiu a compra mas não gerou o token de autorização.",
      };
    }

    // Para produtos únicos (Passes de Acesso e Créditos), consome imediatamente na Google Play (Modelo Free Fire)
    if (isOneTimeProduct) {
      try {
        console.log(
          "[Play IAP] Consumindo produto único para liberar inventário na Google Play Store...",
        );
        await NativePurchases.consumePurchase({ purchaseToken });
        console.log("[Play IAP] Produto consumido com sucesso na Google Play!");
      } catch (consumeErr) {
        console.warn("[Play IAP] Aviso ao consumir produto pós-compra:", consumeErr);
      }
    }

    // Validação Server-to-Server com Supabase
    const verification = await verifyPurchaseOnBackend(successfulProductId, purchaseToken, token);
    return verification;
  } catch (err: any) {
    console.error("[Play IAP] Erro na Google Play Billing:", err);
    const errorMessage = err?.message || err?.error || String(err);

    if (isUserCancellation(err)) {
      return { success: false, error: "O plano não foi concluído.", isCancelled: true };
    }

    if (isItemAlreadyOwnedError(err)) {
      return {
        success: false,
        error:
          "Esta assinatura já está ativa na conta da Google Play deste dispositivo (pertencente a outra conta). Como cada conta no aplicativo é única, para assinar nesta conta escolha outro plano (Semanal, Mensal ou Anual), compre créditos de scans, ou assine com Cartão / Stripe.",
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

    let restoredCount = 0;

    // 1. Tenta restaurar recibos nativos
    try {
      await NativePurchases.restorePurchases();
    } catch (restErr) {
      console.warn("[Play IAP] Aviso em restorePurchases:", restErr);
    }

    // 2. Consulta assinaturas ativas na Google Play do dispositivo
    try {
      const { purchases } = await NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.SUBS,
      });

      if (purchases && purchases.length > 0) {
        console.log("[Play IAP] Assinaturas ativas detectadas na Play Store:", purchases);
        for (const p of purchases) {
          if (p.purchaseToken && p.productIdentifier) {
            const verifyRes = await verifyPurchaseOnBackend(
              p.productIdentifier,
              p.purchaseToken,
              token,
            );
            if (verifyRes.success) {
              restoredCount++;
            }
          }
        }
      }
    } catch (getPurchasesErr) {
      console.warn("[Play IAP] Aviso ao consultar getPurchases subs:", getPurchasesErr);
    }

    // 3. Sincroniza status no backend
    await syncSubscriptionStatusOnBackend(token);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:refresh"));
    }

    return {
      success: true,
      message:
        restoredCount > 0
          ? `Sucesso! ${restoredCount} assinatura(s) ativa(s) da Google Play sincronizada(s) com a sua conta.`
          : "Sincronização com a Google Play concluída.",
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
