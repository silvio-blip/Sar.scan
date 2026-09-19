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
  ExternalLink,
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
  getStoredPlayPrices,
  syncGooglePlayPrices,
  cancelSubscriptionOnBackend,
  reactivateSubscriptionOnBackend,
  syncSubscriptionStatusOnBackend,
  openPlayStoreSubscriptionManager,
  PLAY_PRODUCT_IDS,
  type PlayProductDetails,
} from "@/lib/google-play.functions";

export const Route = createFileRoute("/_app/perfil/assinatura")({
  component: AssinaturaPage,
});

export function AssinaturaPage() {
  const { user, session, subscription, isPremium, isUnlimited, refresh } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [playPrices, setPlayPrices] = useState<Record<string, PlayProductDetails>>(() =>
    getStoredPlayPrices(),
  );

  // Revarredura de preços em segundo plano
  useEffect(() => {
    if (isCapacitor()) {
      syncGooglePlayPrices().then((p) => {
        if (p && Object.keys(p).length > 0) {
          setPlayPrices(p);
        }
      });
    }

    const handlePricesUpdated = (e: any) => {
      if (e.detail) {
        setPlayPrices(e.detail);
      }
    };
    window.addEventListener("sar_play_prices_updated", handlePricesUpdated);
    return () => {
      window.removeEventListener("sar_play_prices_updated", handlePricesUpdated);
    };
  }, []);

  // Sincroniza o status mais recente junto à Play Store / Stripe ao carregar a página
  useEffect(() => {
    if (session?.access_token) {
      setSyncing(true);
      syncSubscriptionStatusOnBackend(session.access_token)
        .then(() => refresh())
        .catch((err) => {
          console.debug("[Assinatura] Falha silenciosa ao sincronizar:", err);
        })
        .finally(() => setSyncing(false));
    }
  }, [session?.access_token, refresh]);

  const hasActiveSub = Boolean(
    subscription &&
    (subscription.status === "active" ||
      (subscription.status === "trialing" &&
        subscription.trial_end &&
        new Date(subscription.trial_end) > new Date())),
  );

  const isTrial = subscription?.status === "trialing";
  const rawPlan = subscription?.plan || null;
  const planType = rawPlan ? rawPlan.replace("_cancelled", "") : null;
  const isCancelled = Boolean(
    (subscription as any)?.cancel_at_period_end || rawPlan?.includes("cancelled"),
  );

  // Informações amigáveis do plano
  const planDetails = useMemo(() => {
    if (!planType || subscription?.status === "free") {
      return {
        title: "Plano Gratuito",
        description: "Acesso diário a 3 scans nutricionais.",
        priceText: "Grátis",
        period: "Sem custo",
        badge: "Básico",
        color: "text-muted-foreground",
      };
    }

    if (planType === "weekly") {
      const price = playPrices["weekly"]?.formattedPrice || "€4,99";
      return {
        title: "sar.scan Semanal",
        description: "30 scans por semana + registro rápido.",
        priceText: `${price}/semana`,
        period: "Renovação semanal",
        badge: "Semanal",
        color: "text-primary",
      };
    }

    if (planType === "yearly") {
      const price = playPrices["yearly"]?.formattedPrice || "€99,99";
      return {
        title: "sar.scan Anual",
        description: "1.200 scans por ano + IA Nutricionista liberada.",
        priceText: `${price}/ano`,
        period: "Renovação anual",
        badge: "Mais Popular",
        color: "text-primary",
      };
    }

    // Mensal padrão
    const price = playPrices["monthly"]?.formattedPrice || "€19,99";
    return {
      title: "sar.scan Mensal",
      description: "150 scans por mês + IA Nutricionista liberada.",
      priceText: `${price}/mês`,
      period: "Renovação mensal",
      badge: "Mensal",
      color: "text-primary",
    };
  }, [planType, subscription?.status, playPrices]);

  // Formatação de datas
  const periodEndFormatted = useMemo(() => {
    const end = subscription?.current_period_end || subscription?.trial_end;
    if (!end) return null;
    try {
      return new Date(end).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [subscription?.current_period_end, subscription?.trial_end]);

  // Função para cancelar assinatura
  const handleCancelSubscription = async (immediate: boolean = false) => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setCancelling(true);
    try {
      const res = await cancelSubscriptionOnBackend(session.access_token, immediate);
      if (res.success) {
        toast.success(res.message);
        setShowCancelDialog(false);
        await refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar cancelamento.");
    } finally {
      setCancelling(false);
    }
  };

  // Função para reativar assinatura
  const handleReactivateSubscription = async () => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setReactivating(true);
    try {
      const res = await reactivateSubscriptionOnBackend(session.access_token);
      if (res.success) {
        toast.success(res.message);
        await refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao reativar assinatura.");
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
        toast.success("Status da assinatura sincronizado com sucesso!");
      } else {
        toast.info("Status verificado.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar status.");
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
              Minha Assinatura
            </h1>
            <p className="text-xs text-muted-foreground font-semibold">
              Gerencie seus planos, status e renovações
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
          <span className="hidden sm:inline">Sincronizar</span>
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
                  Teste Grátis (7 Dias)
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
              Valor
            </div>
            <div className="text-sm font-extrabold text-foreground">{planDetails.priceText}</div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Status
            </div>
            <div className="text-sm font-extrabold flex items-center gap-1.5">
              {hasActiveSub ? (
                isCancelled ? (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="size-4" /> Cancelada
                  </span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <ShieldCheck className="size-4" /> Ativa
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">Gratuito</span>
              )}
            </div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Créditos Disponíveis
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {subscription?.scans_credits ?? 0} scans
            </div>
          </div>

          <div className="bg-secondary/60 rounded-2xl p-3 space-y-0.5 border border-border/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isTrial ? "Término do Teste" : "Válido até"}
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {periodEndFormatted || "Sem limite de tempo"}
            </div>
          </div>
        </div>

        {/* Provedor de Pagamento (Discreto e em conformidade com as políticas) */}
        <div className="bg-secondary/30 rounded-2xl p-3 flex items-center justify-between border border-border/40 text-xs">
          <span className="text-muted-foreground font-semibold">Status do Faturamento:</span>
          <span className="font-bold text-foreground flex items-center gap-1">
            Faturamento Digital Verificado
          </span>
        </div>
      </Card>

      {/* Benefícios Inclusos */}
      <Card className="bg-card rounded-[32px] p-6 border border-border shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Benefícios do seu plano
        </h3>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              Reconhecimento instantâneo de calorias e macros por imagem
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              {subscription?.plan === "yearly" || subscription?.plan === "annual"
                ? "Chat com Nutricionista IA (150 mensagens / dia)"
                : subscription?.plan === "monthly"
                  ? "Chat com Nutricionista IA (50 mensagens / dia)"
                  : "Chat com Nutricionista IA (50 mensagens)"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              Edição de metas e suporte prioritário inclusos
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Check className="size-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              Histórico detalhado e exportação de dados de nutrição
            </div>
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
            {hasActiveSub ? "Alterar / Fazer Upgrade de Plano" : "Ver Todos os Planos Premium"}
          </Link>
        </Button>

        {/* Botão de Cancelamento ou Reativação */}
        {hasActiveSub &&
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
              Ativar Novamente a Assinatura
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              className="w-full h-14 rounded-[28px] border border-red-500/20 bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-600 font-bold uppercase tracking-wider text-xs transition-all"
            >
              <XCircle className="size-4 mr-2" /> Cancelar Assinatura
            </Button>
          ))}

        {/* Opção nativa de abrir gerenciador da Google Play */}
        {isCapacitor() && (
          <Button
            variant="ghost"
            onClick={() => {
              const sku = planType
                ? PLAY_PRODUCT_IDS[planType as keyof typeof PLAY_PRODUCT_IDS]
                : undefined;
              openPlayStoreSubscriptionManager(sku);
            }}
            className="w-full h-12 rounded-[24px] text-muted-foreground hover:text-foreground font-semibold text-xs gap-1.5"
          >
            <ExternalLink className="size-3.5" /> Gerenciar na Google Play Store
          </Button>
        )}
      </div>

      {/* Diálogo de Confirmação de Cancelamento */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-card border border-border rounded-[32px] p-6 max-w-sm">
          <DialogHeader className="space-y-3">
            <div className="size-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
              <AlertTriangle className="size-7" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-foreground">
              Cancelar Assinatura?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
              Você continuará com acesso integral a todos os seus benefícios e créditos de scans até
              o final do período contratado ({periodEndFormatted || "vigência atual"}). Nenhuma nova
              cobrança automática será efetuada.
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
              Confirmar Cancelamento
            </Button>

            <Button
              variant="outline"
              disabled={cancelling}
              className="w-full h-12 rounded-2xl border-border font-bold text-xs"
              onClick={() => setShowCancelDialog(false)}
            >
              Voltar e Manter Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
