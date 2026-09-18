import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createStripeCheckout, syncStripePlans } from "@/lib/stripe.functions";
import {
  initializeGooglePlayIAP,
  requestGooglePlayPurchase,
  isCapacitor,
} from "@/lib/google-play.functions";
import { isInstalledApp } from "@/lib/utils";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useCallback } from "react";
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
    aiAgent: false,
    perks: [
      "30 scans / semana",
      "Banco de dados completo",
      "Edição de metas",
      "Suporte prioritário",
    ],
    missing: ["Agente IA Nutricional", "Chat com Nutricionista IA"],
  },
  {
    id: "monthly",
    label: "Mensal",
    price: "€19,99",
    priceNum: 19.99,
    cycle: "/mês",
    scans: 150,
    trialDays: 7,
    badge: "Popular",
    hint: "Mais escolhido",
    aiAgent: true,
    perks: [
      "150 scans / mês",
      "Agente IA Nutricional",
      "50 mensagens / dia",
      "Edição de metas",
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
    trialDays: 7,
    badge: "Melhor valor",
    hint: "Economize ~58%",
    aiAgent: true,
    perks: [
      "1200 scans / ano",
      "Nutricionista IA Full",
      "Chat ilimitado",
      "Suporte exclusivo",
      "Acesso antecipado",
    ],
    missing: [],
  },
];

export function PremiumPage() {
  const { user, session, isPremium, isAdmin, subscription, refresh } = useAuth();
  const [selected, setSelected] = useState<PlanId>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [purchasedPlan, setPurchasedPlan] = useState<PlanDef | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<PlanDef | null>(null);
  const [showExternalRedirectOverlay, setShowExternalRedirectOverlay] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activateFreeTrial = async () => {
    if (!user) return;
    setLoading("monthly"); // Reutilizar estado de carga
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const { error } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        status: "trialing",
        trial_end: trialEnd.toISOString(),
        plan: "monthly",
        ai_agent_enabled: true,
        scans_credits: 30,
      });

      if (error) throw error;

      toast.success("Teste grátis de 7 dias ativado!");
      if (refresh) await refresh();

      const likelyPlan = { ...(PLANS.find((p) => p.id === "monthly")! || PLANS[1]), scans: 30 };
      setPurchasedPlan(likelyPlan);
      setShowSuccessModal(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao ativar o teste grátis.");
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
      `com.sarscacan.new://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}`,
    ];

    // Android Intent seguro que força abertura direta da aplicação com Package com.sarscacan.new
    const androidIntent = `intent://premium?success=1&plan=${planParam}${isTrial ? "&trial=1" : ""}#Intent;scheme=sarscan;package=com.sarscacan.new;S.browser_fallback_url=${encodeURIComponent(window.location.origin + "/premium?success=1")};end`;

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
    const planFromUrl = search.get("plan") as PlanId | null;

    if (success) {
      // Find what plan we bought from URL first, then fallback to state
      const likelyPlanId = planFromUrl || selected;
      const likelyPlan = PLANS.find((p) => p.id === likelyPlanId) || PLANS[1];
      setPurchasedPlan(likelyPlan);

      if (refresh) refresh();

      // Se o utilizador finalizou o checkout num navegador de telemóvel externo (não instalado WebView)
      // Mostramos o overlay animado para reabrir a aplicação nativa de forma mágica.
      if (!isInstalledApp()) {
        setShowExternalRedirectOverlay(true);
      } else {
        setShowSuccessModal(true);
      }

      // Limpamos a URL para não disparar de novo, mas mantemos o estado do modal
      navigate({ to: "/premium", search: {}, replace: true });
    }

    if (canceled) {
      setShowCancelModal(true);
      navigate({ to: "/premium", search: {}, replace: true });
    }
  }, [location.search, refresh, navigate, selected]);

  const current = PLANS.find((p) => p.id === selected)!;
  const [buyingCredits, setBuyingCredits] = useState(false);

  useEffect(() => {
    initializeGooglePlayIAP().catch(console.error);
  }, []);

  const startCheckout = async (planId: PlanId, trial = false) => {
    if (!user || !session?.access_token) {
      toast.error("Por favor, faça autenticação antes de prosseguir com a compra.");
      return;
    }
    setLoading(planId);
    try {
      if (isCapacitor()) {
        const playProductId =
          planId === "weekly"
            ? "sar_scan_assinatura_semanal"
            : planId === "yearly"
              ? "sar_scan_assinatura_anual"
              : "sar_scan_assinatura";

        const res = await requestGooglePlayPurchase(playProductId, session.access_token);
        if (res.success) {
          toast.success("Assinatura ativada com sucesso através da Google Play!");
          if (refresh) await refresh();
        } else {
          toast.error(res.error || "A transação falhou ou foi cancelada na Google Play.");
        }
        return;
      }

      const res = await createStripeCheckout({
        token: session.access_token,
        plan: planId,
        trial,
      });

      if (res && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error("URL de checkout inválida");
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
      const res = await requestGooglePlayPurchase("sar_scan_creditos", session.access_token);

      if (res.success) {
        toast.success("Pacote de 50 Scans creditado com sucesso via Google Play!");
        if (refresh) await refresh();
      } else {
        toast.error(res.error || "A transação de créditos falhou ou foi rejeitada pela Google.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar com Google Play Store.");
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

        {!isPremium && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm"
          >
            <Button
              onClick={() => activateFreeTrial()} // Activate trial directly
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

      {isPremium && (
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
              Plano {subscription?.plan || "Premium"} · {subscription?.scans_credits} créditos
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          Escolha sua jornada
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {PLANS.map((p) => {
            const active = selected === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  if (loading) return;
                  console.log("[PremiumPage] Card clicked:", p.id);
                  if (selected !== p.id) {
                    setSelected(p.id);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-[32px] border p-6 text-left transition-all duration-500 w-full ${
                  active
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-border bg-card hover:bg-secondary/40"
                }`}
              >
                {p.badge && (
                  <span className="absolute top-0 right-0 rounded-bl-[16px] bg-accent px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm font-sans">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div
                      className={`text-xs font-black uppercase tracking-tighter ${active ? "text-primary font-bold" : "text-muted-foreground"}`}
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
                  {active && (
                    <div className="size-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-primary-foreground">
                      <Check className="size-5" strokeWidth={4} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  {p.perks.slice(0, 4).map((pk) => (
                    <div
                      key={pk}
                      className="flex items-center gap-2 text-[11px] font-medium text-foreground/85"
                    >
                      <div className="size-1.5 rounded-full bg-primary/40" />
                      <span className="line-clamp-1">{pk}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    {p.trialDays} dias grátis · Cancele quando quiser
                  </span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (loading) return;
                      setConfirmingPlan(p);
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
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
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
                  €9,99
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
            <p className="text-muted-foreground text-sm font-medium mb-8">
              30 scans totais gratuitos para escanear alimentos por 7 dias.
            </p>

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
                  if (confirmingPlan) startCheckout(confirmingPlan.id, true);
                  setConfirmingPlan(null);
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
              className="relative z-10"
            >
              <h2 className="text-2xl font-display font-black tracking-tight text-white mb-2 uppercase">
                {purchasedPlan?.trialDays
                  ? "Teste Grátis Ativado!"
                  : `Plano ${purchasedPlan?.label} Ativado!`}
              </h2>
              <p className="text-white/60 text-sm font-medium mb-8">
                {purchasedPlan?.trialDays
                  ? `Você tem 7 dias com 30 scans totais para escanear alimentos.`
                  : "Parabéns! Você acaba de desbloquear o acesso total ao sar.scan."}
              </p>

              <div className="space-y-3 mb-8 text-left">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-2 px-1">
                  SEUS NOVOS PODERES:
                </div>
                {[
                  {
                    icon: Sparkles,
                    text: `${purchasedPlan?.scans} créditos para o scanner de alimentos`,
                  },
                  { icon: Bot, text: "Acesso ao scanner por 7 dias" },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <item.icon className="size-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white/80">{item.text}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate({ to: "/" });
                  }}
                  className="w-full h-14 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-sm shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-all group"
                >
                  Começar a usar agora
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Button>

                <p className="text-[10px] text-white/20 font-medium">
                  {purchasedPlan?.trialDays
                    ? "Cancele a qualquer momento no seu perfil se mudar de ideia."
                    : "Suas vantagens já estão disponíveis em tempo real."}
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
                  // Optional: highlight the selected plan or scrolls to it
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

      {/* Overlay de Redirecionamento Automático para o App com.sarscacan.new */}
      <AnimatePresence>
        {showExternalRedirectOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/98 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <div className="absolute top-10 size-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-md w-full flex flex-col items-center gap-6 relative z-10">
              <motion.div
                initial={{ scale: 0.8, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative size-24 rounded-[32px] bg-white text-black flex items-center justify-center shadow-[0_20px_50px_rgba(255,255,255,0.15)]"
              >
                <Crown className="size-12 animate-pulse" strokeWidth={2.5} />
                <div className="absolute -top-1.5 -right-1.5 size-7 rounded-xl bg-black text-white flex items-center justify-center border-2 border-white text-[10px] font-black font-sans">
                  PRO
                </div>
              </motion.div>

              <div className="space-y-3">
                <h1 className="text-3xl font-display font-black tracking-tighter text-white uppercase">
                  Pagamento Concluído! 🎉
                </h1>
                <p className="text-sm font-semibold text-zinc-300 max-w-xs mx-auto leading-relaxed">
                  Obrigado pela sua assinatura! Estamos a redirecionar de volta para o aplicativo
                  sar.scan...
                </p>
              </div>

              {/* Loader visual minimalista */}
              <div className="flex flex-col items-center gap-2 mt-4">
                <Loader2 className="size-8 text-white animate-spin" />
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] animate-pulse">
                  Conectando ao App Seguro
                </span>
              </div>

              {/* Botões de fallback se o auto deep link não disparou */}
              <div className="w-full flex flex-col gap-3 mt-8">
                <Button
                  onClick={triggerAppReturnDeepLinks}
                  className="w-full h-14 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                >
                  <RefreshCw className="size-4 animate-spin" />
                  Abrir o Aplicativo Agora
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setShowExternalRedirectOverlay(false);
                    setShowSuccessModal(true);
                  }}
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors py-2 underline underline-offset-4"
                >
                  Continuar no navegador Web
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
