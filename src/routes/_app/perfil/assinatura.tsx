import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Crown,
  Check,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import {
  isCapacitor,
  useGooglePlayPrices,
  cancelSubscriptionOnBackend,
  reactivateSubscriptionOnBackend,
  syncSubscriptionStatusOnBackend,
  PLAY_PRODUCT_IDS,
} from "@/lib/google-play.functions";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/assinatura")({
  component: AssinaturaPage,
});

export function AssinaturaPage() {
  const { session, subscription, refresh } = useAuth();
  const { t, lang } = useTranslation();
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [remoteCancelled, setRemoteCancelled] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { prices: playPrices } = useGooglePlayPrices();

  // Sincroniza o status mais recente junto à Play Store / Stripe ao carregar a página
  useEffect(() => {
    if (session?.access_token) {
      setSyncing(true);
      syncSubscriptionStatusOnBackend(session.access_token)
        .then((res) => {
          if (res?.data?.isCancelled) {
            setRemoteCancelled(true);
          }
          return refresh();
        })
        .catch((err) => {
          console.debug("[Assinatura] Falha silenciosa ao sincronizar:", err);
        })
        .finally(() => setSyncing(false));
    }
  }, [session?.access_token, refresh]);

  const hasActiveSub = useMemo(() => {
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

  const isTrial = subscription?.status === "trialing";
  const rawPlan = subscription?.plan || null;
  const planType = rawPlan ? rawPlan.replace("_cancelled", "") : null;
  const isCancelled = Boolean(
    remoteCancelled ||
    (subscription as any)?.cancel_at_period_end ||
    rawPlan?.includes("cancelled"),
  );

  // Uma assinatura ativa só é Stripe se tiver um ID recorrente real na Stripe (sub_...)
  const hasActiveStripeSub = Boolean(
    hasActiveSub &&
    subscription?.stripe_subscription_id &&
    typeof subscription.stripe_subscription_id === "string" &&
    subscription.stripe_subscription_id.trim().startsWith("sub_"),
  );

  const isStripeSub = hasActiveStripeSub;

  // Se tem plano ativo e NÃO é uma assinatura recorrente Stripe, trata-se de um Pacote Google Play (sem botão de cancelamento)
  const isGooglePlaySub = Boolean(hasActiveSub && !hasActiveStripeSub);

  // Informações amigáveis do plano
  const planDetails = useMemo(() => {
    if (!planType || subscription?.status === "free") {
      return {
        title: lang === "pt" ? "Plano Gratuito" : lang === "fr" ? "Forfait Gratuit" : "Free Plan",
        description:
          lang === "pt"
            ? "Acesso diário a 3 scans nutricionais."
            : lang === "fr"
              ? "Accès quotidien à 3 scans nutritionnels."
              : "Daily access to 3 nutrition scans.",
        priceText: lang === "pt" ? "Grátis" : lang === "fr" ? "Gratuit" : "Free",
        period: lang === "pt" ? "Sem custo" : lang === "fr" ? "Sans frais" : "No cost",
        badge: lang === "pt" ? "Básico" : lang === "fr" ? "Basique" : "Basic",
        color: "text-muted-foreground",
      };
    }

    const weeklyPrice =
      (isCapacitor() &&
        (playPrices["weekly"]?.formattedPrice ||
          playPrices["semanal"]?.formattedPrice ||
          playPrices[PLAY_PRODUCT_IDS.weekly]?.formattedPrice)) ||
      "€4,99";

    const yearlyPrice =
      (isCapacitor() &&
        (playPrices["yearly"]?.formattedPrice ||
          playPrices["anual"]?.formattedPrice ||
          playPrices[PLAY_PRODUCT_IDS.yearly]?.formattedPrice)) ||
      "€99,99";

    const monthlyPrice =
      (isCapacitor() &&
        (playPrices["monthly"]?.formattedPrice ||
          playPrices["mensal"]?.formattedPrice ||
          playPrices[PLAY_PRODUCT_IDS.monthly]?.formattedPrice ||
          playPrices["sar_scan_assinatura"]?.formattedPrice)) ||
      "€19,99";

    if (planType === "weekly") {
      return {
        title: "Sar scan " + t("shop.weekly"),
        description: t("shop.pWeekly1") + " + " + t("shop.pWeekly2"),
        priceText: `${weeklyPrice}${t("shop.cycleWeekly")}`,
        period: t("shop.weekly"),
        badge: t("shop.weekly"),
        color: "text-primary",
      };
    }

    if (planType === "yearly") {
      return {
        title: "Sar scan " + t("shop.yearly"),
        description: t("shop.pYearly1") + " + " + t("shop.pYearly2"),
        priceText: `${yearlyPrice}${t("shop.cycleYearly")}`,
        period: t("shop.yearly"),
        badge: t("shop.popularBadge"),
        color: "text-primary",
      };
    }

    // Mensal padrão
    return {
      title: "Sar scan " + t("shop.monthly"),
      description: t("shop.pMonthly1") + " + " + t("shop.pMonthly2"),
      priceText: `${monthlyPrice}${t("shop.cycleMonthly")}`,
      period: t("shop.monthly"),
      badge: t("shop.monthly"),
      color: "text-primary",
    };
  }, [planType, subscription?.status, playPrices, t, lang]);

  // Formatação de datas
  const periodEndFormatted = useMemo(() => {
    const end = subscription?.current_period_end || subscription?.trial_end;
    if (!end) return null;
    try {
      const locale = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "pt-BR";
      return new Date(end).toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [subscription?.current_period_end, subscription?.trial_end, lang]);

  // Função para cancelar assinatura
  const handleCancelSubscription = async (immediate: boolean = false) => {
    if (!session?.access_token) {
      toast.error(t("common.error"));
      return;
    }

    setCancelling(true);
    try {
      const res = await cancelSubscriptionOnBackend(session.access_token, immediate);
      if (res.success) {
        toast.success(res.message || t("common.success"));
        setShowCancelDialog(false);
        setRemoteCancelled(true);
        await refresh();
      } else {
        toast.error(res.message || t("common.error"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setCancelling(false);
    }
  };

  // Função para reativar assinatura
  const handleReactivateSubscription = async () => {
    if (!session?.access_token) {
      toast.error(t("common.error"));
      return;
    }

    setReactivating(true);
    try {
      const res = await reactivateSubscriptionOnBackend(session.access_token);
      if (res.success) {
        toast.success(res.message || t("common.success"));
        setRemoteCancelled(false);
        await refresh();
      } else {
        toast.error(res.message || t("common.error"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setReactivating(false);
    }
  };

  // Função de ressincronização manual
  const handleManualSync = async () => {
    if (syncing || !session?.access_token) return;
    setSyncing(true);
    try {
      const res = await syncSubscriptionStatusOnBackend(session.access_token);
      await refresh();
      if (res.success) {
        toast.success(t("common.success"));
      } else {
        toast.info(t("common.active"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/perfil"
            className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
              {t("subpages.subscriptions.title")}
            </h1>
            <p className="text-xs text-muted-foreground font-semibold">
              {t("subpages.subscriptions.subtitle")}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={syncing}
          className="rounded-full border border-border bg-secondary hover:bg-muted font-bold text-xs h-9 px-3 gap-1.5"
        >
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <RefreshCw className="size-3.5 text-primary" />
          )}
          <span className="hidden sm:inline">{t("common.active")}</span>
        </Button>
      </div>

      {/* Card Principal de Assinatura */}
      <Card className="bg-card rounded-[32px] p-6 border border-border shadow-md space-y-6 relative overflow-hidden">
        {/* Glow de fundo */}
        {hasActiveSub && (
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-0 pointer-events-none" />
        )}

        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                {planDetails.badge}
              </span>
              {isTrial && (
                <span className="text-xs font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  {t("shop.freeTrialBadge")}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-foreground pt-1">{planDetails.title}</h2>
            <p className="text-xs text-muted-foreground font-medium">{planDetails.description}</p>
          </div>

          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-sm border border-primary/20">
            <Crown className="size-7" />
          </div>
        </div>

        {/* Detalhes de Preço e Vigência */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("shop.totalToday")}
            </div>
            <div className="text-sm font-extrabold text-foreground">{planDetails.priceText}</div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("shop.subStatus")}
            </div>
            <div className="text-sm font-extrabold flex items-center gap-1.5">
              {hasActiveSub ? (
                isCancelled ? (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="size-4" /> {t("common.cancel")}
                  </span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <ShieldCheck className="size-4" /> {t("shop.statusActive")}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">{planDetails.badge}</span>
              )}
            </div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("home.remainingScans")}
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {subscription?.scans_credits ?? 0} scans
            </div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isTrial ? t("shop.freeTrialBadge") : t("shop.validUntil")}
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {periodEndFormatted || t("shop.noExpiryCredits")}
            </div>
          </div>
        </div>

        {/* Provedor de Pagamento e Plataforma de Origem */}
        <div className="bg-secondary/30 rounded-2xl p-3 flex items-center justify-between border border-border/40 text-xs">
          <span className="text-muted-foreground font-semibold">{t("shop.accountDetails")}</span>
          <span className="font-bold text-foreground flex items-center gap-1">
            {isGooglePlaySub
              ? "Google Play Billing"
              : isStripeSub
                ? "Stripe / Card"
                : isTrial
                  ? t("shop.freeTrialBadge")
                  : planDetails.badge}
          </span>
        </div>
      </Card>

      {/* Benefícios Inclusos */}
      <Card className="bg-card rounded-[32px] p-6 border border-border shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> {t("shop.planPerksTitle")}
        </h3>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">{t("shop.why1Desc")}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              {subscription?.plan === "yearly" || subscription?.plan === "annual"
                ? t("shop.pYearly2")
                : subscription?.plan === "monthly"
                  ? t("shop.pMonthly2")
                  : t("shop.pWeekly2")}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              {t("shop.pMonthly3")} · {t("shop.pMonthly4")}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">{t("shop.why4Desc")}</div>
          </div>
        </div>
      </Card>

      {/* Ações de Gestão */}
      <div className="space-y-3 pt-2">
        <Button
          className="w-full h-14 rounded-[28px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider text-xs shadow-md"
          asChild
        >
          <Link to="/premium">
            <Zap className="size-4 mr-2" />
            {hasActiveSub ? t("shop.upgradePlan") : t("shop.subscribeNow")}
          </Link>
        </Button>

        {/* Informação para usuários com pacote da Google Play */}
        {isGooglePlaySub && hasActiveSub && (
          <div className="rounded-[24px] bg-secondary/40 border border-border p-4 text-center space-y-1.5">
            <div className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" /> Google Play
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("shop.activePerksNote")} ({periodEndFormatted || ""})
            </p>
          </div>
        )}

        {/* Botão de Cancelamento ou Reativação apenas para assinaturas Stripe recorrentes */}
        {isStripeSub &&
          hasActiveSub &&
          (isCancelled ? (
            <Button
              variant="outline"
              onClick={handleReactivateSubscription}
              disabled={reactivating}
              className="w-full h-14 rounded-[28px] border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold uppercase tracking-wider text-xs transition-all gap-2"
            >
              {reactivating ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="size-4 text-primary" />
              )}
              {t("shop.subscribeNow")}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              className="w-full h-14 rounded-[28px] border border-red-500/20 bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-600 font-bold uppercase tracking-wider text-xs transition-all"
            >
              <XCircle className="size-4 mr-2" /> {t("common.cancel")}
            </Button>
          ))}
      </div>

      {/* Diálogo de Confirmação de Cancelamento */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-card border border-border rounded-[32px] p-6 max-w-sm">
          <DialogHeader className="space-y-3">
            <div className="size-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
              <AlertTriangle className="size-7" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-foreground">
              {t("common.cancel")}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
              {t("shop.trialCancelNote")} ({periodEndFormatted || ""}).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col gap-2 pt-4 sm:flex-col">
            <Button
              variant="destructive"
              disabled={cancelling}
              className="w-full h-12 rounded-2xl font-bold text-xs"
              onClick={() => handleCancelSubscription(false)}
            >
              {cancelling ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Check className="size-4 mr-2" />
              )}
              {t("common.confirm")}
            </Button>

            <Button
              variant="outline"
              disabled={cancelling}
              className="w-full h-12 rounded-2xl border-border font-bold text-xs"
              onClick={() => setShowCancelDialog(false)}
            >
              {t("shop.maybeLater")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
