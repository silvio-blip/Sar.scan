import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, Minus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

const objetivos = [
  { id: "perder", label: "Perder Peso", desc: "-500 cal/dia", Icon: TrendingDown },
  { id: "manter", label: "Manter Peso", desc: "Manutenção", Icon: Minus },
  { id: "ganhar", label: "Ganhar Massa", desc: "+300 cal/dia", Icon: TrendingUp },
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
      <div className="min-h-screen bg-black grid place-items-center">
        <Loader2 className="size-12 animate-spin text-white" />
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
      toast.error("Preencha todos os campos");
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
      supabase
        .from("daily_goals")
        .update({
          calorias: cal,
          proteina_g: Math.round(p * 2),
          carbs_g: Math.round((cal * 0.45) / 4),
          gordura_g: Math.round((cal * 0.25) / 9),
        })
        .eq("user_id", user.id),
    ]);
    setLoading(false);
    if (e1 || e2) {
      toast.error("Erro ao salvar");
      return;
    }
    await refresh();
    nav({ to: "/scanner" });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="flex flex-col items-center gap-6">
          <SarLogo />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-black tracking-tight text-white">
            Vamos te conhecer
          </h1>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
            Para calcular suas metas diárias
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "idade", val: idade, set: setIdade, ph: "28", lbl: "Idade" },
              { id: "peso", val: peso, set: setPeso, ph: "75", lbl: "Peso (kg)" },
              { id: "altura", val: altura, set: setAltura, ph: "175", lbl: "Alt. (cm)" },
            ].map((f) => (
              <div
                key={f.id}
                className="glass rounded-[24px] px-4 py-3.5 space-y-1 border-white/5 shadow-xl"
              >
                <label className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate block">
                  {f.lbl}
                </label>
                <input
                  type="number"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="w-full bg-transparent outline-none text-base font-black text-white placeholder:text-white/10"
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 px-2">
              Escolha seu Objetivo
            </label>
            {objetivos.map(({ id, label, desc, Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setObjetivo(id)}
                className={`w-full flex items-center gap-4 rounded-[28px] p-4 text-left transition-all duration-300 border ${objetivo === id ? "border-white bg-white/10 ring-1 ring-white/40 shadow-xl shadow-white/5" : "border-white/5 glass hover:bg-white/5"}`}
              >
                <div
                  className={`size-12 rounded-2xl flex items-center justify-center transition-colors ${objetivo === id ? "bg-white text-black" : "bg-white/5 text-white/40"}`}
                >
                  <Icon className="size-6" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm tracking-tight text-white">{label}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30">
                    {desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black tracking-[0.2em] text-[11px] shadow-xl shadow-white/5 transition-all active:scale-95"
          >
            {loading && <Loader2 className="size-5 animate-spin mr-2" />}CONTINUAR
          </Button>
        </form>
      </div>
    </div>
  );
}
