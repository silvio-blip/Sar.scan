import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createStripeCheckout, syncStripePlans } from "@/lib/stripe.functions";
import {
  initializeGooglePlayIAP,
  requestGooglePlayPurchase,
  fetchGooglePlayPrices,
  useGooglePlayPrices,
  restoreGooglePlayPurchases,
  PLAY_PRODUCT_IDS,
  type PlayProductDetails,
  isCapacitor,
  syncSubscriptionStatusOnBackend,
} from "@/lib/google-play.functions";
import { Browser } from "@capacitor/browser";

import { isInstalledApp, getApiUrl } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Sparkles,
  Target,
  Search,
  MessageSquare,
  Gift,
  Check,
  X,
  Bot,
  CircleAlert,
  Loader2,
  RefreshCw,
  CircleCheckBig,
  ArrowRight,
  Zap,
  ShieldQuestion,
  CreditCard,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/premium")({ component: PremiumPage });

type PlanId = "weekly" | "monthly" | "yearly";

const PLAN_TIERS: Record<PlanId, number> = {
  weekly: 1,
  monthly: 2,
  yearly: 3,
};

type PlanDef = {
  id: PlanId;
  label: string;
  price: string;
  priceNum: number;
  cycle: string;
  scans: number;
  trialDays: number;
  badge?: string;
  hint: string;
  aiAgent: boolean;
  perks: string[];
  missing: string[];
};

const PLANS: PlanDef[] = [
  {
    id: "weekly",
    label: "Semanal",
    price: "€4,99",
    priceNum: 4.99,
    cycle: "/semana",
    scans: 30,
    trialDays: 7,
    hint: "Ideal para experimentar",
    aiAgent: true,
    perks: [
      "30 scans / semana",
      "Chat IA Nutricionista (50 mensagens)",
      "Edição de metas",
      "Suporte prioritário",
    ],
    missing: [],
  },
  {
    id: "monthly",
    label: "Mensal",
    price: "€19,99",
    priceNum: 19.99,
    cycle: "/mês",
    scans: 150,
    trialDays: 0,
    badge: "Popular",
    hint: "Mais escolhido",
    aiAgent: true,
    perks: [
      "150 scans / mês",
      "Chat IA Nutricionista (50 mensagens / dia)",
      "Edição de metas",
      "Suporte prioritário",
      "Histórico estendido",
    ],
    missing: [],
  },
  {
    id: "yearly",
    label: "Anual",
    price: "€99,99",
    priceNum: 99.99,
    cycle: "/ano",
    scans: 1200,
    trialDays: 0,
    badge: "Melhor valor",
    hint: "Economize ~58%",
    aiAgent: true,
    perks: [
      "1200 scans / ano",
      "Chat IA Nutricionista (150 mensagens / dia)",
      "Edição de metas",
      "Suporte prioritário",
      "Acesso antecipado",
    ],
    missing: [],
  },
];

export function PremiumPage() {
  const { user, session, isPremium, isAdmin, subscription, refresh } = useAuth();
  const [confirmedCredits, setConfirmedCredits] = useState<number | null>(null);
  const [selected, setSelected] = useState<PlanId>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [purchasedPlan, setPurchasedPlan] = useState<PlanDef | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<PlanDef | null>(null);
  const [showExternalRedirectOverlay, setShowExternalRedirectOverlay] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Preços dinâmicos da Google Play Store (atualizados em tempo real do Google Play Console)
  const { prices: playPrices, isScanning: isScanningPlayPrices } = useGooglePlayPrices();

  // Planos em tempo real com preços dinâmicos da Google Play (no APK) ou Stripe (na Web)
  const displayPlans = useMemo(() => {
    return PLANS.map((p) => {
      let playData: PlayProductDetails | undefined;

      if (p.id === "weekly") {
        playData =
          playPrices["weekly"] ||
          playPrices["semanal"] ||
          playPrices[PLAY_PRODUCT_IDS.weekly] ||
          playPrices["sar_scan_assinatura_semanal"] ||
          playPrices["sar_scan_semanal"];
      } else if (p.id === "yearly") {
        playData =
          playPrices["yearly"] ||
          playPrices["anual"] ||
          playPrices[PLAY_PRODUCT_IDS.yearly] ||
          playPrices["sar_scan_assinatura_anual"] ||
          playPrices["sar_scan_anual"];
      } else {
        playData =
          playPrices["monthly"] ||
          playPrices["mensal"] ||
          playPrices[PLAY_PRODUCT_IDS.monthly] ||
          playPrices["sar_scan_assinatura"] ||
          playPrices["sar_scan_assinatura_mensal"] ||
          playPrices["sar_scan_mensal"];
      }

      if (isCapacitor() && playData && playData.formattedPrice) {
        return {
          ...p,
          price: playData.formattedPrice,
          priceNum: playData.price || p.priceNum,
        };
      }
      return p;
    });
  }, [playPrices]);

  // Preço do pacote de 50 scans (consumível)
  const displayCreditsPrice = useMemo(() => {
    const creditsData =
      playPrices["credits"] ||
      playPrices[PLAY_PRODUCT_IDS.credits] ||
      playPrices["sar_scan_creditos"] ||
      playPrices["sar_scan_credits"] ||
      playPrices["creditos"] ||
      playPrices["sar_scan_50_creditos"];
    if (isCapacitor() && creditsData?.formattedPrice) {
      return creditsData.formattedPrice;
    }
    return "€9,99";
  }, [playPrices]);

  // Verifica se o usuário possui alguma assinatura ativa no momento e que esteja dentro do prazo de validade
  const hasActiveSubscription = useMemo(() => {
    if (!subscription) return false;
    const now = new Date();
    if (subscription.status === "trialing") {
      return Boolean(subscription.trial_end && new Date(subscription.trial_end) > now);
    }
    if (subscription.status === "active") {
      if (subscription.current_period_end) {
        return new Date(subscription.current_period_end) > now;
      }
      return true;
    }
    return false;
  }, [subscription]);

  // ID do plano atualmente ativo
  const activePlanId = useMemo(() => {
    if (!hasActiveSubscription || !subscription?.plan) return null;
    return subscription.plan as PlanId;
  }, [hasActiveSubscription, subscription?.plan]);

  // Verifica se o usuário já utilizou o teste grátis ou já fez alguma compra (na Stripe ou Google Play)
  const hasUsedTrial = useMemo(() => {
    if (!user || !subscription) return false;
    return Boolean(
      subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "expired" ||
      Boolean(subscription.trial_end) ||
      Boolean(subscription.stripe_subscription_id) ||
      Boolean(subscription.play_purchase_token) ||
      (subscription.plan !== null &&
        subscription.plan !== undefined &&
        subscription.plan !== "free"),
    );
  }, [user, subscription]);

  // Elegível para teste grátis apenas se nunca usou teste, não tem assinatura ativa e não é premium
  const isEligibleForTrial = !hasUsedTrial && !hasActiveSubscription && !isPremium;

  const activateFreeTrial = async (planId?: PlanId) => {
    if (!user) {
      toast.error("Por favor, faça autenticação antes de ativar o teste.");
      return;
    }

    if (hasUsedTrial) {
      toast.error("Você já utilizou o seu teste gratuito de 7 dias.");
      return;
    }

    const chosenPlan = planId || "weekly";
    setLoading(chosenPlan);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const { error } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        status: "trialing",
        trial_end: trialEnd.toISOString(),
        plan: chosenPlan,
        ai_agent_enabled: true,
        scans_credits: 30,
      });

      if (error) throw error;

      toast.success("Teste grátis de 7 dias ativado! Você recebeu 30 scans gratuitos.");
      if (refresh) await refresh();
      navigate({ to: "/scanner" });
    } catch (e: any) {
      toast.error(e.message || "Erro ao ativar teste grátis.");
    } finally {
      setLoading(null);
    }
  };

  const triggerAppReturnDeepLinks = useCallback(() => {
    console.log("[DeepLink] Iniciando redirecionamento para o App...");
    try {
      window.close();
    } catch (e) {
      console.log("window.close() ignorado pelo navegador:", e);
    }

    const planParam = purchasedPlan?.id || selected;
    const isTrial = location.search.includes("trial=1");

    // Lista de deep links com maior probabilidade de correspondência
    const customSchemes = [
      `sarscan://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}`,
      `sar-scan://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}`,
      `foodscanner://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}`,
      `com.sarscan.new://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}`,
    ];

    // Android Intent seguro que força abertura direta da aplicação com Package com.sarscan.new
    const androidIntent = `intent://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}#Intent;scheme=sarscan;package=com.sarscan.new;S.browser_fallback_url=${encodeURIComponent(window.location.origin + "/premium?success=1")};end`;

    // Navegar de forma não obstrutiva através de frames ocultos nos esquemas customizados
    let idx = 0;
    const attemptNextOption = () => {
      if (idx < customSchemes.length) {
        const urlToTry = customSchemes[idx];
        console.log("[DeepLink] Tentando esquema customizado:", urlToTry);
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = urlToTry;
        document.body.appendChild(iframe);
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 200);
        idx++;
        setTimeout(attemptNextOption, 250);
      } else {
        console.log("[DeepLink] Utilizando Intent do Android como recurso final:", androidIntent);
        window.location.href = androidIntent;
      }
    };

    attemptNextOption();
  }, [purchasedPlan, selected, location.search]);

  useEffect(() => {
    if (showExternalRedirectOverlay) {
      const timer = setTimeout(() => {
        triggerAppReturnDeepLinks();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showExternalRedirectOverlay, triggerAppReturnDeepLinks]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const success = search.get("success");
    const canceled = search.get("canceled");
    const planFromUrl = search.get("plan") as PlanId | "credits" | null;
    const sessionId = search.get("session_id");

    if (success) {
      const likelyPlanId = planFromUrl || selected;
      const likelyPlan =
        displayPlans.find((p) => p.id === likelyPlanId) ||
        (planFromUrl === "credits"
          ? {
              id: "credits" as any,
              label: "Pacote de 50 Scans",
              price: "€9,99",
              cycle: "único",
              scans: 50,
              trialDays: 0,
              perks: [
                "50 Scans adicionais",
                "Sem expiração",
                "Scanner de alimentos",
                "Detecção por IA",
              ],
            }
          : displayPlans[1]);

      setPurchasedPlan(likelyPlan);

      const verifyAndActivate = async () => {
        try {
          if (sessionId) {
            console.log("[Stripe Return] Enviando sessionId para verificação:", sessionId);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (session?.access_token) {
              headers.Authorization = `Bearer ${session.access_token}`;
            }

            const res = await fetch(getApiUrl("/api/stripe/verify-session"), {
              method: "POST",
              headers,
              body: JSON.stringify({ sessionId }),
            });

            if (res.ok) {
              const data = await res.json();
              console.log("[Stripe Return] Sessão confirmada com sucesso:", data);
              if (data.credits !== undefined && data.credits !== null) {
                setConfirmedCredits(data.credits);
              }
              if (data.plan) {
                const foundPlan = displayPlans.find((p) => p.id === data.plan);
                if (foundPlan) setPurchasedPlan(foundPlan);
              }
              toast.success("Pagamento confirmado! Plano e créditos ativados.");
            } else {
              const errData = await res.json().catch(() => ({}));
              console.warn("[Stripe Return] Erro na resposta da verificação:", errData);
            }
          }

          if (session?.access_token) {
            await syncSubscriptionStatusOnBackend(session.access_token).catch(() => {});
          }

          if (refresh) {
            await refresh();
          }
        } catch (err) {
          console.warn("[Stripe Return] Exceção ao verificar sessão na volta:", err);
          if (refresh) await refresh();
        } finally {
          setShowSuccessModal(true);
          navigate({ to: "/premium", search: {}, replace: true });
        }
      };

      verifyAndActivate();
    }

    if (canceled) {
      setShowCancelModal(true);
      navigate({ to: "/premium", search: {}, replace: true });
    }
  }, [location.search, refresh, navigate, selected, displayPlans, session?.access_token]);

  // Sincroniza ativamente o status da assinatura de forma garantida e em tempo real ao entrar no ecrã Premium
  useEffect(() => {
    if (session?.access_token) {
      syncSubscriptionStatusOnBackend(session.access_token)
        .then(() => {
          if (refresh) refresh();
        })
        .catch((err) => {
          console.warn("[Premium] Falha ao sincronizar ativamente no carregamento:", err);
        });
    }
  }, [session?.access_token, refresh]);

  const current = displayPlans.find((p) => p.id === selected)!;
  const [buyingCredits, setBuyingCredits] = useState(false);

  const startCheckout = async (planId: PlanId, trial = false) => {
    if (!user || !session?.access_token) {
      toast.error("Por favor, faça autenticação antes de prosseguir com a compra.");
      return;
    }

    // Se o usuário já possui exatamente este plano ativo, bloqueia compra duplicada
    if (hasActiveSubscription && activePlanId === planId) {
      toast.info(
        `Você já possui o plano ${displayPlans.find((p) => p.id === planId)?.label || planId} ativo!`,
      );
      return;
    }

    // Se o usuário tentar fazer downgrade para um plano inferior ao ativo atual
    if (hasActiveSubscription && activePlanId && PLAN_TIERS[planId] < PLAN_TIERS[activePlanId]) {
      const activePlanLabel =
        displayPlans.find((p) => p.id === activePlanId)?.label || activePlanId;
      toast.error(
        `Você já possui um plano superior ativo (${activePlanLabel}). Não é permitido fazer downgrade enquanto sua assinatura atual estiver ativa.`,
      );
      return;
    }

    setLoading(planId);
    try {
      if (isCapacitor()) {
        const playProductId =
          planId === "weekly"
            ? PLAY_PRODUCT_IDS.weekly
            : planId === "yearly"
              ? PLAY_PRODUCT_IDS.yearly
              : PLAY_PRODUCT_IDS.monthly;
        const basePlan = planId === "weekly" ? "semanal" : planId === "yearly" ? "anual" : "mensal";

        // Invoca a Bottom Sheet oficial da Google Play Store no celular (com oferta de 7 dias grátis se trial=true)
        const res = await requestGooglePlayPurchase(playProductId, session.access_token, {
          isTrial: trial,
          customPlanId: basePlan,
        });
        if (res.success) {
          toast.success(
            trial
              ? "Teste gratuito de 7 dias ativado com sucesso pela Google Play!"
              : "Assinatura ativada com sucesso pela Google Play!",
          );
          if (refresh) await refresh();
          const planDef = displayPlans.find((p) => p.id === planId) || displayPlans[1];
          setPurchasedPlan(planDef);
          setShowSuccessModal(true);
          return;
        } else if (!res.isCancelled) {
          toast.error(res.error || "Não foi possível concluir a transação na Google Play.");
        }
        return;
      }

      // No site Web (Navegador): se for ativação de Teste Grátis de 7 dias, ativa na Web
      if (trial) {
        await activateFreeTrial(planId);
        return;
      }

      // No site Web (Navegador): Redireciona para o Stripe Checkout Real
      const res = await createStripeCheckout({
        token: session.access_token,
        plan: planId,
        trial,
      });

      if (res && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error("URL de checkout do Stripe inválida.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar o checkout.");
    } finally {
      setLoading(null);
    }
  };

  const startCreditsCheckout = async () => {
    if (!user || !session?.access_token) {
      toast.error("Por favor, faça autenticação antes de comprar créditos.");
      return;
    }

    setBuyingCredits(true);
    try {
      if (isCapacitor()) {
        // Invoca a Bottom Sheet oficial da Google Play Store para o pacote de 50 scans (consumível)
        const res = await requestGooglePlayPurchase(PLAY_PRODUCT_IDS.credits, session.access_token);
        if (res.success) {
          toast.success("Pacote de 50 Scans creditado com sucesso via Google Play!");
          if (refresh) await refresh();
          setPurchasedPlan({
            id: "monthly",
            label: "50 Scans",
            price: displayCreditsPrice,
            priceNum: 9.99,
            cycle: "único",
            scans: 50,
            trialDays: 0,
            hint: "50 Scans",
            aiAgent: true,
            perks: ["50 Scans adicionados imediatamente"],
            missing: [],
          });
          setShowSuccessModal(true);
          return;
        } else if (!res.isCancelled) {
          toast.error(
            res.error || "Não foi possível concluir a compra de créditos na Google Play.",
          );
        }
        return;
      }

      // No site Web (Navegador): Redireciona para o Stripe Checkout
      const res = await createStripeCheckout({
        token: session.access_token,
        plan: "credits",
      });

      if (res && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error("URL de checkout do Stripe inválida.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao comprar créditos.");
    } finally {
      setBuyingCredits(false);
    }
  };

  const syncPlans = async () => {
    if (!session?.access_token) return;
    setSyncing(true);
    try {
      const r = await syncStripePlans({ token: session.access_token });
      toast.success(`Planos sincronizados (${r.results?.length ?? 0})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handlePlanAction = (p: PlanDef) => {
    if (loading) return;

    // Se é exatamente o plano ativo atual, avisa o usuário e não deixa assinar novamente
    if (hasActiveSubscription && activePlanId === p.id) {
      const expirationDate = subscription?.current_period_end || subscription?.trial_end;
      const formattedDate = expirationDate
        ? new Date(expirationDate).toLocaleDateString("pt-PT")
        : "";
      toast.info(
        `Você já possui o plano ${p.label} ativo${formattedDate ? ` até ${formattedDate}` : ""}.`,
      );
      return;
    }

    // Se é um plano inferior ao ativo atual, impede downgrade direto
    if (hasActiveSubscription && activePlanId && PLAN_TIERS[p.id] < PLAN_TIERS[activePlanId]) {
      const activeLabel = displayPlans.find((dp) => dp.id === activePlanId)?.label || activePlanId;
      toast.error(
        `Você já possui um plano superior ativo (${activeLabel}). Não é permitido fazer downgrade enquanto sua assinatura atual estiver ativa.`,
      );
      return;
    }

    // Só mostra o modal de 7 dias se o usuário for elegível (primeira vez absoluta)
    if (isEligibleForTrial && p.trialDays > 0) {
      setConfirmingPlan(p);
    } else {
      // Caso contrário (já comprou, já usou teste ou está alterando plano), abre o checkout direto
      startCheckout(p.id, false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col items-center text-center gap-6 pt-8">
        <div className="relative size-24 rounded-full bg-white flex items-center justify-center shadow-[0_20px_50px_rgba(255,255,255,0.2)] ring-8 ring-white/5">
          <Crown className="size-12 text-black" />
          <div className="absolute -top-1 -right-1 size-8 rounded-full bg-black border-2 border-white flex items-center justify-center">
            <Sparkles className="size-4 text-white animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-display font-black tracking-tighter text-white">
            sar.scan Premium
          </h1>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em]">
            Architecture of Nutri Intelligence
          </p>
        </div>

        {isEligibleForTrial && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm"
          >
            <Button
              onClick={() => {
                const weeklyPlan = displayPlans.find((p) => p.id === "weekly") || displayPlans[0];
                setConfirmingPlan(weeklyPlan);
              }}
              className="w-full h-16 rounded-full bg-gradient-to-r from-zinc-100 to-white text-black hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-black flex flex-col items-center justify-center gap-0 shadow-[0_20px_50px_rgba(255,255,255,0.15)] ring-1 ring-white/50 group"
            >
              <div className="flex items-center gap-2 text-sm uppercase tracking-wider">
                Ativar 7 Dias Grátis
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
              <span className="text-[9px] font-bold text-black/50 uppercase tracking-[0.1em]">
                30 scans total por 7 dias
              </span>
            </Button>
          </motion.div>
        )}
      </div>

      {hasActiveSubscription && (
        <div className="bg-secondary/40 rounded-[32px] p-6 border border-border flex items-center gap-5 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent" />
          <div className="size-16 rounded-[24px] bg-primary text-primary-foreground flex items-center justify-center shadow-md relative z-10 transition-transform group-hover:scale-105 shrink-0">
            <Crown className="size-8" strokeWidth={2.5} />
          </div>
          <div className="flex-1 relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">
              Status da Assinatura
            </div>
            <div className="font-display font-black text-xl text-foreground uppercase tracking-tight flex items-center gap-2">
              Ativa <div className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <div className="text-xs text-muted-foreground font-semibold mt-1">
              Plano{" "}
              {subscription?.plan
                ? displayPlans.find((p) => p.id === subscription.plan)?.label || subscription.plan
                : "Premium"}{" "}
              · {subscription?.scans_credits ?? 0} créditos
              {subscription?.current_period_end && (
                <span className="block text-[11px] text-muted-foreground/80 mt-0.5">
                  Válido até {new Date(subscription.current_period_end).toLocaleDateString("pt-PT")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Escolha sua jornada
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {displayPlans.map((p) => {
            const active = selected === p.id;
            const isCurrentActivePlan = hasActiveSubscription && activePlanId === p.id;
            const isDowngrade =
              hasActiveSubscription && activePlanId && PLAN_TIERS[p.id] < PLAN_TIERS[activePlanId];

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (loading) return;
                  if (selected !== p.id) {
                    setSelected(p.id);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-[32px] border p-6 text-left transition-all duration-500 w-full ${
                  isCurrentActivePlan
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm ring-1 ring-emerald-500/30"
                    : active
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                      : "border-border bg-card hover:bg-secondary/40"
                }`}
              >
                {isCurrentActivePlan ? (
                  <span className="absolute top-0 right-0 rounded-bl-[16px] bg-emerald-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm font-sans">
                    Plano Ativo
                  </span>
                ) : p.badge ? (
                  <span className="absolute top-0 right-0 rounded-bl-[16px] bg-accent px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm font-sans">
                    {p.badge}
                  </span>
                ) : null}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div
                      className={`text-xs font-black uppercase tracking-tighter ${
                        isCurrentActivePlan
                          ? "text-emerald-400 font-bold"
                          : active
                            ? "text-primary font-bold"
                            : "text-muted-foreground"
                      }`}
                    >
                      {p.label}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-display font-black tracking-tighter text-foreground">
                        {p.price}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{p.cycle}</span>
                    </div>
                  </div>
                  {isCurrentActivePlan ? (
                    <div className="size-8 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm text-white">
                      <Check className="size-5" strokeWidth={4} />
                    </div>
                  ) : active ? (
                    <div className="size-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-primary-foreground">
                      <Check className="size-5" strokeWidth={4} />
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  {p.perks.slice(0, 4).map((pk) => (
                    <div
                      key={pk}
                      className="flex items-center gap-2 text-[11px] font-medium text-foreground/85"
                    >
                      <div
                        className={`size-1.5 rounded-full ${isCurrentActivePlan ? "bg-emerald-500" : "bg-primary/40"}`}
                      />
                      <span className="line-clamp-1">{pk}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    {isCurrentActivePlan
                      ? subscription?.current_period_end
                        ? `Válido até ${new Date(subscription.current_period_end).toLocaleDateString("pt-PT")}`
                        : "Assinatura ativa"
                      : isEligibleForTrial && p.trialDays > 0
                        ? `${p.trialDays} dias grátis · Cancele quando quiser`
                        : "Renovação automática · Cancele quando quiser"}
                  </span>

                  {isCurrentActivePlan ? (
                    <Button
                      disabled
                      className="h-11 px-6 rounded-full font-black text-[11px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-not-allowed opacity-90"
                    >
                      <Check className="size-4 mr-1.5 text-emerald-400" />
                      Plano Atual
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      disabled
                      className="h-11 px-6 rounded-full font-black text-[11px] uppercase tracking-wider bg-secondary text-muted-foreground border border-border cursor-not-allowed opacity-60"
                    >
                      Plano Superior Ativo
                    </Button>
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlanAction(p);
                      }}
                      disabled={loading === p.id}
                      className={`h-11 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all duration-300 shadow-sm ${
                        active
                          ? "bg-primary text-primary-foreground hover:bg-primary/95"
                          : "bg-secondary text-foreground hover:bg-muted"
                      }`}
                    >
                      {loading === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : hasActiveSubscription ? (
                        "Upgrade de Plano"
                      ) : isEligibleForTrial && p.trialDays > 0 ? (
                        "Testar 7 Dias"
                      ) : (
                        "Assinar Agora"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          Pacotes de Créditos (Consumível)
        </h2>
        <div className="bg-card rounded-[32px] border border-border p-6 text-left relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-black uppercase text-primary font-bold">
                Pacote de 50 Scans
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-display font-black tracking-tighter text-foreground">
                  {displayCreditsPrice}
                </span>
                <span className="text-xs font-medium text-muted-foreground">/ pagamento único</span>
              </div>
            </div>
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shadow-sm text-primary">
              <Zap className="size-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Perfeito se você já atingiu o limite semanal ou mensal ou prefere não utilizar uma
            assinatura premium recorrente neste momento. Adiciona 50 scans definitivos ao seu
            utilizador.
          </p>
          <div className="flex justify-end pt-2">
            <Button
              onClick={startCreditsCheckout}
              disabled={buyingCredits}
              className="h-11 px-8 rounded-full font-black text-[11px] uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 shadow-sm"
            >
              {buyingCredits ? <Loader2 className="size-4 animate-spin" /> : "Comprar 50 Scans"}
            </Button>
          </div>
        </div>
      </div>

      {/* Deleted main subscribe/sync UI block */}

      <div className="space-y-4">
        <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          Por que ser Premium?
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              Icon: Sparkles,
              t: "Scans com Super IA",
              d: "Identificação ultra detalhada e imediata",
            },
            {
              Icon: Bot,
              t: "Nutricionista IA 24/7",
              d: "Tire dúvidas e peça receitas a qualquer hora",
            },
            {
              Icon: MessageSquare,
              t: "Análise de Sentimento",
              d: "Entendemos como sua dieta afeta seu humor",
            },
            {
              Icon: Target,
              t: "Metas Dinâmicas",
              d: "Ajuste seus objetivos conforme sua evolução",
            },
          ].map(({ Icon, t, d }) => (
            <div
              key={t}
              className="bg-card rounded-[24px] p-4 flex items-center gap-4 border border-border shadow-sm group"
            >
              <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Icon className="size-6 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-foreground tracking-tight">{t}</div>
                <div className="text-[11px] font-medium text-muted-foreground line-clamp-1">
                  {d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Opção para restaurar compras existentes da Google Play / Stripe */}
      <div className="flex flex-col items-center justify-center gap-2 pt-2">
        <Button
          variant="ghost"
          disabled={restoringPurchases}
          onClick={async () => {
            if (restoringPurchases) return;
            setRestoringPurchases(true);
            try {
              if (isCapacitor() && session?.access_token) {
                const res = await restoreGooglePlayPurchases(session.access_token);
                if (res.success) {
                  toast.success(res.message);
                  await refresh();
                } else {
                  toast.error(res.message);
                }
              } else {
                await refresh();
                toast.success("Assinaturas e créditos sincronizados com a conta!");
              }
            } catch (err: any) {
              toast.error(err?.message || "Erro ao restaurar compras.");
            } finally {
              setRestoringPurchases(false);
            }
          }}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-2 h-10 px-6 rounded-full hover:bg-secondary/40 transition-colors"
        >
          {restoringPurchases ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Restaurar Compras Anteriores
        </Button>
      </div>

      <Dialog open={!!confirmingPlan} onOpenChange={(open) => !open && setConfirmingPlan(null)}>
        <DialogContent className="max-w-md bg-card border border-border p-0 overflow-hidden rounded-[32px] text-foreground">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Ativação de Teste Grátis</DialogTitle>
          </DialogHeader>

          <div className="relative p-8 flex flex-col items-center text-center">
            <div className="absolute inset-x-0 top-0 h-40 bg-secondary/50" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative z-10 size-20 rounded-[24px] bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-md"
            >
              <Gift className="size-10" />
            </motion.div>

            <h2 className="text-2xl font-display font-black tracking-tight text-foreground mb-2 uppercase">
              Comece 7 dias grátis
            </h2>
            <p className="text-muted-foreground text-sm font-medium mb-6">
              Experimente todos os benefícios do plano {confirmingPlan?.label} totalmente grátis por{" "}
              {confirmingPlan?.trialDays} dias!
            </p>

            {/* List of perks for the plan */}
            <div className="w-full text-left space-y-2 mb-6 p-4 rounded-2xl bg-secondary/20 border border-border">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Benefícios do plano:
              </p>
              {confirmingPlan?.perks.map((pk) => (
                <div
                  key={pk}
                  className="flex items-center gap-2 text-xs font-semibold text-foreground/90"
                >
                  <div className="size-1.5 rounded-full bg-primary" />
                  <span>{pk}</span>
                </div>
              ))}
            </div>

            <div className="w-full space-y-3 mb-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/40 border border-border">
                <div className="text-left">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Total Hoje
                  </p>
                  <p className="text-lg font-display font-black text-foreground">€0,00</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Após 7 dias
                  </p>
                  <p className="text-lg font-display font-black text-foreground">
                    {confirmingPlan?.price}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full gap-3">
              <Button
                onClick={() => {
                  const targetPlan = confirmingPlan?.id || "weekly";
                  setConfirmingPlan(null);
                  startCheckout(targetPlan, true);
                }}
                disabled={!!loading}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/95 font-black text-sm shadow-md transition-all"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Ativar Teste Grátis"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmingPlan(null)}
                className="w-full h-12 text-muted-foreground hover:text-foreground hover:bg-secondary/40 font-bold text-xs"
              >
                Talvez depois
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10 p-0 overflow-hidden rounded-[32px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Plano Ativado com Sucesso</DialogTitle>
          </DialogHeader>
          <div className="relative p-8 flex flex-col items-center text-center">
            {/* Background elements */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="absolute top-10 size-40 bg-white/5 rounded-full blur-3xl" />

            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="relative z-10 size-20 rounded-[24px] bg-white text-black flex items-center justify-center shadow-2xl mb-6 font-display font-black text-2xl"
            >
              {purchasedPlan?.trialDays ? (
                "7"
              ) : (
                <CircleCheckBig className="size-10" strokeWidth={2.5} />
              )}
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative z-10 w-full"
            >
              <h2 className="text-2xl font-display font-black tracking-tight text-white mb-2 uppercase">
                {purchasedPlan?.trialDays
                  ? "Teste Grátis Ativado!"
                  : purchasedPlan?.id === "credits"
                    ? "50 Scans Adicionados!"
                    : `Plano ${purchasedPlan?.label || "Premium"} Ativado!`}
              </h2>
              <p className="text-white/60 text-sm font-medium mb-6">
                {purchasedPlan?.trialDays
                  ? "Você tem 7 dias de acesso com créditos para escanear seus alimentos."
                  : purchasedPlan?.id === "credits"
                    ? "Os 50 scans foram creditados e já estão prontos para você utilizar."
                    : "Parabéns! Sua assinatura está confirmada e o acesso foi liberado em tempo real."}
              </p>

              <div className="space-y-2.5 mb-8 text-left">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-2 px-1">
                  DETALHES DA SUA CONTA:
                </div>
                {[
                  {
                    icon: Sparkles,
                    text: `${confirmedCredits ?? subscription?.scans_credits ?? purchasedPlan?.scans ?? 50} scans totais disponíveis`,
                  },
                  {
                    icon: Bot,
                    text:
                      purchasedPlan?.id === "credits"
                        ? "Créditos sem data de expiração"
                        : "Detecção e análise por IA liberada",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/5"
                  >
                    <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <item.icon className="size-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white/90">{item.text}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate({ to: "/scanner" });
                  }}
                  className="w-full h-14 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-sm shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-all group"
                >
                  Começar a escanear agora
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Button>

                {!isInstalledApp() && (
                  <button
                    type="button"
                    onClick={triggerAppReturnDeepLinks}
                    className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors py-1 underline underline-offset-4"
                  >
                    Abrir no aplicativo Android instalado
                  </button>
                )}

                <p className="text-[10px] text-white/30 font-medium">
                  {purchasedPlan?.trialDays
                    ? "Cancele a qualquer momento no seu perfil se mudar de ideia."
                    : "Suas vantagens já estão ativas na sua conta."}
                </p>
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10 p-0 overflow-hidden rounded-[32px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Pagamento Interrompido</DialogTitle>
          </DialogHeader>
          <div className="relative p-8 flex flex-col items-center text-center">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative z-10 size-20 rounded-[24px] bg-zinc-800 text-white/50 flex items-center justify-center mb-6"
            >
              <CircleAlert className="size-10" />
            </motion.div>

            <h2 className="text-2xl font-display font-black tracking-tight text-white mb-2">
              Pagamento não finalizado
            </h2>
            <p className="text-white/60 text-sm font-medium mb-8">
              Parece que o processo foi interrompido. Sem problemas, seus dados estão seguros e nada
              foi cobrado.
            </p>

            <div className="w-full space-y-3 mb-8">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-left">
                <ShieldQuestion className="size-5 text-white/40 shrink-0" />
                <div className="text-xs">
                  <p className="text-white/80 font-bold mb-0.5">Dúvida sobre o plano?</p>
                  <p className="text-white/40 font-medium">Fale conosco se precisar de ajuda.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-left">
                <CreditCard className="size-5 text-white/40 shrink-0" />
                <div className="text-xs">
                  <p className="text-white/80 font-bold mb-0.5">Problema no cartão?</p>
                  <p className="text-white/40 font-medium">Tente outro método de pagamento.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full gap-3">
              <Button
                onClick={() => {
                  setShowCancelModal(false);
                  toast.info("Escolha um plano abaixo para completar sua assinatura");
                }}
                className="w-full h-14 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-sm shadow-xl transition-all group"
              >
                Tentar novamente
                <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCancelModal(false);
                  navigate({ to: "/" });
                }}
                className="w-full h-12 text-white/40 hover:text-white hover:bg-white/5 font-bold text-xs"
              >
                Voltar para o Início
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
