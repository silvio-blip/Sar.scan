import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createStripeCheckout, syncStripePlans } from "@/lib/stripe.functions";
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
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

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
      "Chat básico de nutrição",
      "Banco de dados completo",
      "Edição de metas",
    ],
    missing: ["Agente IA avançado"],
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
      "Agente IA Nutricional completo",
      "Chat ilimitado",
      "Edição de metas",
      "Histórico estendido",
    ],
    missing: [],
  },
  {
    id: "yearly",
    label: "Anual",
    price: "€99,00",
    priceNum: 99.0,
    cycle: "/ano",
    scans: 1200,
    trialDays: 7,
    badge: "Melhor valor",
    hint: "Economize ~58%",
    aiAgent: true,
    perks: [
      "1200 scans / ano",
      "Agente IA Nutricional completo",
      "Chat ilimitado",
      "Suporte prioritário",
      "Acesso antecipado a novidades",
    ],
    missing: [],
  },
];

function PremiumPage() {
  const { user, session, isPremium, isAdmin, subscription } = useAuth();
  const [selected, setSelected] = useState<PlanId>("monthly");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const current = PLANS.find((p) => p.id === selected)!;
  const subscribePlan = async (planId: PlanId) => {
    if (!user || !session?.access_token) return;
    setLoading(true);
    try {
      const { url } = await createStripeCheckout({ token: session.access_token, plan: planId });
      if (url) window.location.href = url;
      else throw new Error("URL de checkout não retornada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar checkout");
    } finally {
      setLoading(false);
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
      </div>

      {isPremium && subscription?.plan && (
        <div className="glass rounded-[32px] p-4 border-white/20 bg-white/5 flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
            <Crown className="size-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-white uppercase tracking-wider">
              Seu Plano: {subscription.plan}
            </div>
            <div className="text-xs text-white/60 font-semibold">
              {subscription.scans_credits} créditos disponíveis
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
                className={`group relative overflow-hidden rounded-[32px] border p-6 text-left transition-all duration-500 w-full ${
                  active
                    ? "border-white bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.05)] ring-1 ring-white/40"
                    : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {p.badge && (
                  <span className="absolute top-0 right-0 rounded-bl-[16px] bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-black shadow-lg">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div
                      className={`text-xs font-black uppercase tracking-tighter ${active ? "text-white" : "text-muted-foreground"}`}
                    >
                      {p.label}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-display font-black tracking-tighter text-white">
                        {p.price}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{p.cycle}</span>
                    </div>
                  </div>
                  {active && (
                    <div className="size-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                      <Check className="size-5 text-black" strokeWidth={4} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  {p.perks.slice(0, 4).map((pk) => (
                    <div
                      key={pk}
                      className="flex items-center gap-2 text-[11px] font-medium text-white/70"
                    >
                      <div className="size-1.5 rounded-full bg-white/40" />
                      <span className="line-clamp-1">{pk}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    <span>{p.scans} scans inclusos</span>
                  </div>
                  <Button
                    className="h-10 px-6 rounded-full bg-white text-black hover:bg-zinc-200 font-bold text-xs shadow-lg transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      subscribePlan(p.id);
                    }}
                    disabled={loading || (isPremium && subscription?.plan === p.id)}
                  >
                    {loading && selected === p.id ? <Loader2 className="size-4 animate-spin" /> : "Assinar agora"}
                  </Button>
                </div>
              </div>
            );
          })}
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
              className="glass rounded-[24px] p-4 flex items-center gap-4 border-white/5 shadow-lg group"
            >
              <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                <Icon className="size-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white tracking-tight">{t}</div>
                <div className="text-[11px] font-medium text-muted-foreground line-clamp-1">
                  {d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
