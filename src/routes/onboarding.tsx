import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, Minus, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";

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
  const { user, profile, refresh, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [idade, setIdade] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [objetivo, setObjetivo] = useState<"perder" | "manter" | "ganhar">("manter");
  const [loading, setLoading] = useState(false);

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
    </div>
  );
}
