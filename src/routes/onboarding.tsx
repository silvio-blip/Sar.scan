import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import React, { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingDown,
  Minus,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Gift,
  Crown,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion, AnimatePresence } from "motion/react";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

const objetivos = [
  {
    id: "perder",
    label: "Perder Peso",
    desc: "Déficit moderado (-500 kcal/dia)",
    Icon: TrendingDown,
  },
  { id: "manter", label: "Manter Peso", desc: "Equilíbrio calórico e manutenção", Icon: Minus },
  {
    id: "ganhar",
    label: "Ganhar Massa",
    desc: "Superávit e hipertrofia (+300 kcal/dia)",
    Icon: TrendingUp,
  },
] as const;

function OnboardingPage() {
  const { user, profile, refresh, loading: authLoading, campaignSettings } = useAuth();
  const nav = useNavigate();
  const [idade, setIdade] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [objetivo, setObjetivo] = useState<"perder" | "manter" | "ganhar">("manter");
  const [loading, setLoading] = useState(false);

  // Inicialização instantânea a partir do cache local para resposta imediata
  const getInitialCampaignState = () => {
    if (typeof window === "undefined") return { active: false, bonus: 10, aiDays: 7 };
    try {
      const cached = localStorage.getItem("sar_scan_campaign_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.enabled) {
          return {
            active: true,
            bonus: parsed.bonusScans || 10,
            aiDays: parsed.freeAiDays || 7,
          };
        }
      }
    } catch (e) {
      console.debug("[Onboarding] Erro ao carregar cache de campanha:", e);
    }
    return { active: false, bonus: 10, aiDays: 7 };
  };

  const initialSettings = getInitialCampaignState();
  const [isCampaignActive, setIsCampaignActive] = useState(initialSettings.active);
  const [bonusScansCount, setBonusScansCount] = useState(initialSettings.bonus);
  const [freeAiDaysCount, setFreeAiDaysCount] = useState(initialSettings.aiDays);
  const [showCelebration, setShowCelebration] = useState(initialSettings.active);

  // Sincroniza e reage instantaneamente ao campaignSettings do AuthContext
  useEffect(() => {
    if (campaignSettings?.enabled && campaignSettings.bonusScans > 0) {
      setIsCampaignActive(true);
      setBonusScansCount(campaignSettings.bonusScans);
      setFreeAiDaysCount(campaignSettings.freeAiDays || 7);
      setShowCelebration(true);
    }
  }, [campaignSettings?.enabled, campaignSettings?.bonusScans, campaignSettings?.freeAiDays]);

  // Busca em background apenas se não houver configurações ativas
  useEffect(() => {
    if (campaignSettings?.enabled) return;

    let isMounted = true;
    const fetchCampaign = async () => {
      try {
        const { data: settings } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", ["campaign_enabled", "campaign_bonus_scans", "campaign_free_ai_days"]);
        if (settings && isMounted) {
          let enabled = false;
          let bonus = 10;
          let aiDays = 7;
          settings.forEach((r) => {
            if (r.key === "campaign_enabled") enabled = r.value === "true";
            if (r.key === "campaign_bonus_scans") bonus = parseInt(r.value) || 0;
            if (r.key === "campaign_free_ai_days") aiDays = parseInt(r.value) || 0;
          });
          setIsCampaignActive(enabled);
          setBonusScansCount(bonus);
          setFreeAiDaysCount(aiDays);

          if (enabled && bonus > 0) {
            setShowCelebration(true);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch campaign settings directly in onboarding:", e);
      }
    };
    fetchCampaign();
    return () => {
      isMounted = false;
    };
  }, [campaignSettings?.enabled]);

  if (authLoading)
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (profile?.onboarding_done) return <Navigate to="/scanner" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const i = parseInt(idade),
      p = parseFloat(peso),
      a = parseFloat(altura);
    if (!i || !p || !a) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (i < 10 || i > 120) {
      toast.error("Insira uma idade válida.");
      return;
    }
    if (p < 20 || p > 350) {
      toast.error("Insira um peso válido (kg).");
      return;
    }
    if (a < 50 || a > 250) {
      toast.error("Insira uma altura válida (cm).");
      return;
    }

    setLoading(true);
    const tmb = 10 * p + 6.25 * a - 5 * i;
    const base = Math.round(tmb * 1.4);
    const cal = objetivo === "perder" ? base - 500 : objetivo === "ganhar" ? base + 300 : base;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase
        .from("profiles")
        .update({ idade: i, peso: p, altura: a, objetivo, onboarding_done: true })
        .eq("id", user.id),
      supabase.from("daily_goals").upsert({
        user_id: user.id,
        calorias: cal,
        proteina_g: Math.round(p * 2),
        carbs_g: Math.round((cal * 0.45) / 4),
        gordura_g: Math.round((cal * 0.25) / 9),
      }),
    ]);
    setLoading(false);
    if (e1 || e2) {
      toast.error("Erro ao salvar dados do perfil.");
      return;
    }
    await refresh();
    toast.success("Metas calculadas com sucesso!");
    nav({ to: "/scanner" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Organic fluid decorative ambient background */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md space-y-6 z-10"
      >
        {/* Logo and Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="p-1"
          >
            <SarLogo size="lg" align="center" />
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-primary">
              Vamos te conhecer
            </h1>
            <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto">
              Informe seus dados básicos para calcularmos suas metas nutricionais diárias
              personalizadas.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-7 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* 3 Metric Inputs: Idade, Peso, Altura */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1 block">
                Suas Medidas
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "idade", val: idade, set: setIdade, ph: "28", lbl: "Idade", unit: "anos" },
                  { id: "peso", val: peso, set: setPeso, ph: "75", lbl: "Peso", unit: "kg" },
                  {
                    id: "altura",
                    val: altura,
                    set: setAltura,
                    ph: "175",
                    lbl: "Altura",
                    unit: "cm",
                  },
                ].map((f) => (
                  <div
                    key={f.id}
                    className="bg-secondary/40 border border-border/60 rounded-[20px] p-3 text-center focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all hover:bg-secondary/60"
                  >
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 block truncate">
                      {f.lbl}
                    </label>
                    <div className="flex items-baseline justify-center gap-0.5 mt-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        required
                        value={f.val}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder={f.ph}
                        className="w-full bg-transparent outline-none text-xl font-display font-black text-foreground text-center placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight block">
                      {f.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Objective Selection */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1 block">
                Escolha o seu Objetivo
              </label>
              <div className="space-y-2">
                {objetivos.map(({ id, label, desc, Icon }) => {
                  const active = objetivo === id;
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setObjetivo(id)}
                      className={`w-full flex items-center gap-3.5 rounded-[22px] p-3.5 text-left transition-all duration-300 border ${
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                          : "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-border"
                      }`}
                    >
                      <div
                        className={`size-11 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-card text-muted-foreground border border-border/40"
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-display font-black text-sm tracking-tight ${
                            active ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {label}
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground truncate">
                          {desc}
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border flex items-center justify-center transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/80 bg-card"
                        }`}
                      >
                        {active && <div className="size-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/95 font-black tracking-[0.15em] text-xs uppercase shadow-lg shadow-primary/10 transition-all active:scale-[0.98] group flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <span>Calcular Metas & Continuar</span>
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md bg-card border border-border/60 rounded-[32px] p-8 shadow-2xl overflow-hidden flex flex-col items-center text-center z-50"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-accent" />

              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                className="size-20 rounded-[24px] bg-primary/15 text-primary flex items-center justify-center mb-6 shadow-inner"
              >
                <Gift className="size-10 text-primary" />
              </motion.div>

              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground uppercase mb-2">
                Conseguiu a tempo! 🎉
              </h2>
              <p className="text-xs text-muted-foreground font-semibold leading-relaxed max-w-sm mb-6">
                Parabéns! O seu registo foi realizado durante o nosso período de campanha especial
                de boas-vindas. Ativámos bónus exclusivos na sua conta:
              </p>

              {/* Bonus highlights container */}
              <div className="w-full space-y-3.5 mb-8 text-left">
                {/* Extra Scans */}
                <div className="bg-secondary/40 border border-border/40 rounded-2xl p-4 flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-foreground">
                      Scans de Alimentos Ativados
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      Recebeu{" "}
                      <strong className="text-foreground font-bold">
                        +{bonusScansCount} scans de bónus
                      </strong>{" "}
                      além dos 3 de oferta base. Começa com{" "}
                      <strong className="text-primary font-extrabold">
                        {3 + bonusScansCount} scans!
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Free AI chat agent */}
                <div className="bg-secondary/40 border border-border/40 rounded-2xl p-4 flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Crown className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-foreground">
                      Acesso Gratuito ao Chatbot IA
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      Desbloqueámos o Nutricionista IA por{" "}
                      <strong className="text-foreground font-bold">
                        {freeAiDaysCount} dias grátis
                      </strong>{" "}
                      (até 30 mensagens diárias) para guiar a sua alimentação saudável!
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowCelebration(false)}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/95 font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
              >
                Garantir Bónus & Definir Metas
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
