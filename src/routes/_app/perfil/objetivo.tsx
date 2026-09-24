import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown, Minus, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/objetivo")({ component: ObjetivoPage });

type Objetivo = "perder" | "manter" | "ganhar";

function ObjetivoPage() {
  const { user, profile, refresh } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [objetivo, setObjetivo] = useState<Objetivo>((profile?.objetivo as Objetivo) ?? "manter");
  const [saving, setSaving] = useState(false);

  const objs: { id: Objetivo; label: string; sub: string; Icon: typeof TrendingDown }[] = [
    {
      id: "perder",
      label: t("subpages.objective.lose"),
      sub: t("subpages.objective.loseDesc"),
      Icon: TrendingDown,
    },
    {
      id: "manter",
      label: t("subpages.objective.maintain"),
      sub: t("subpages.objective.maintainDesc"),
      Icon: Minus,
    },
    {
      id: "ganhar",
      label: t("subpages.objective.gain"),
      sub: t("subpages.objective.gainDesc"),
      Icon: TrendingUp,
    },
  ];

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ objetivo }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success(t("subpages.objective.success"));
    nav({ to: "/perfil" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Link
          to="/perfil"
          className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
          {t("subpages.objective.title")}
        </h1>
      </div>

      <Card className="bg-card rounded-[32px] p-6 space-y-4 border border-border shadow-sm text-foreground">
        {objs.map(({ id, label, sub, Icon }) => {
          const active = objetivo === id;
          return (
            <button
              key={id}
              onClick={() => setObjetivo(id)}
              className={`w-full text-left rounded-2xl border p-4 flex items-center gap-4 transition-all duration-300 ${
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary/25 shadow-sm"
                  : "border-border/60 bg-secondary/20 hover:bg-secondary/40"
              }`}
            >
              <div
                className={`size-12 rounded-2xl flex items-center justify-center transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm tracking-tight text-foreground">{label}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {sub}
                </div>
              </div>
            </button>
          );
        })}
      </Card>

      <Button
        className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : t("subpages.objective.save")}
      </Button>
    </div>
  );
}
