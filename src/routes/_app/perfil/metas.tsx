import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Crown,
  TrendingDown,
  Minus,
  TrendingUp,
  Target,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/metas")({
  component: MetasPage,
});

type Objetivo = "perder" | "manter" | "ganhar";

function calcMeta(peso: number, altura: number, idade: number, objetivo: Objetivo) {
  if (!peso || !altura || !idade) return 2000;
  const tmb = 10 * peso + 6.25 * altura - 5 * idade + 5;
  const total = tmb * 1.4;
  const adj = objetivo === "perder" ? -500 : objetivo === "ganhar" ? 300 : 0;
  return Math.round(total + adj);
}

function MetasPage() {
  const { user, profile, isPremium, refresh } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();

  const { data: goals } = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_goals")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [idade, setIdade] = useState<number>(profile?.idade ?? 28);
  const [peso, setPeso] = useState<number>(Number(profile?.peso ?? 70));
  const [altura, setAltura] = useState<number>(Number(profile?.altura ?? 170));
  const [objetivo, setObjetivo] = useState<Objetivo>((profile?.objetivo as Objetivo) ?? "manter");
  const [manualMeta, setManualMeta] = useState<number | null>(null);
  const [metaAgua, setMetaAgua] = useState<number>(profile?.meta_agua ?? 2000);
  const [metaPrazo, setMetaPrazo] = useState<string>(profile?.meta_prazo ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setIdade(profile.idade ?? 28);
      setPeso(Number(profile.peso ?? 70));
      setAltura(Number(profile.altura ?? 170));
      setObjetivo((profile.objetivo as Objetivo) ?? "manter");
      if (profile.meta_calorias) setManualMeta(profile.meta_calorias);
      if (profile.meta_agua) setMetaAgua(profile.meta_agua);
      if (profile.meta_prazo) setMetaPrazo(profile.meta_prazo);
    }
  }, [profile]);

  const calculatedMeta = calcMeta(peso, altura, idade, objetivo);
  const meta = isPremium && manualMeta !== null ? manualMeta : calculatedMeta;

  const save = async () => {
    if (!user) return;
    if (!isPremium) {
      toast.error(t("shop.subtitle"));
      nav({ to: "/premium" });
      return;
    }
    setSaving(true);
    try {
      const prot = Math.round(peso * 1.8);
      const gord = Math.round((meta * 0.25) / 9);
      const carb = Math.round((meta - prot * 4 - gord * 9) / 4);
      await supabase
        .from("profiles")
        .update({
          idade,
          peso,
          altura,
          objetivo,
          meta_calorias: meta,
          meta_agua: metaAgua,
          meta_prazo: metaPrazo || null,
        })
        .eq("id", user.id);
      await supabase.from("daily_goals").upsert(
        {
          user_id: user.id,
          calorias: meta,
          proteina_g: prot,
          carbs_g: carb,
          gordura_g: gord,
        },
        { onConflict: "user_id" },
      );
      await refresh();
      toast.success(t("subpages.goals.success"));
      nav({ to: "/perfil" });
    } catch (e) {
      toast.error(t("common.error"));
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const objs: {
    id: Objetivo;
    label: string;
    sub: string;
    Icon: typeof TrendingDown;
  }[] = [
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

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Link
          to="/perfil"
          className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
            {t("subpages.goals.title")}
          </h1>
          <div className="text-[10px] text-primary/80 flex items-center gap-1 font-black uppercase tracking-widest">
            <Crown className="size-3" /> Premium
          </div>
        </div>
      </div>

      {!isPremium ? (
        <Card className="bg-card rounded-[24px] p-6 border border-border text-center space-y-4 text-foreground shadow-sm">
          <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">{t("shop.featuresTitle")}</h3>
            <p className="text-xs text-muted-foreground/80 leading-relaxed px-4">
              {t("shop.subtitle")}
            </p>
          </div>
          <Button
            asChild
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm"
          >
            <Link to="/premium">{t("shop.subscribeNow")}</Link>
          </Button>
        </Card>
      ) : (
        <Card className="bg-card rounded-[32px] p-6 space-y-4 border border-border shadow-sm text-foreground">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              {t("subpages.goals.title")}
            </h2>
            <Crown className="size-4 text-primary" />
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                {t("subpages.goals.calories")}
              </Label>
              <Input
                type="number"
                value={manualMeta ?? calculatedMeta}
                onChange={(e) => setManualMeta(+e.target.value)}
                className="h-14 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-2xl font-display font-black text-foreground"
                placeholder={calculatedMeta.toString()}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                {t("home.water")} (ml)
              </Label>
              <Input
                type="number"
                value={metaAgua}
                onChange={(e) => setMetaAgua(+e.target.value)}
                className="h-14 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-2xl font-display font-black text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                {t("common.optional")}
              </Label>
              <Input
                type="date"
                value={metaPrazo}
                onChange={(e) => setMetaPrazo(e.target.value)}
                className="h-14 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-lg font-bold text-foreground"
              />
            </div>
          </div>
        </Card>
      )}

      <div className={isPremium ? "opacity-100" : "opacity-30 pointer-events-none"}>
        <Card className="bg-card rounded-[32px] p-6 space-y-4 border border-border shadow-sm text-foreground mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            {t("profile.physicalData")}
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                {t("subpages.physicalData.age")}
              </Label>
              <Input
                type="number"
                value={idade}
                onChange={(e) => setIdade(+e.target.value)}
                className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                  {t("subpages.physicalData.weight")}
                </Label>
                <Input
                  type="number"
                  value={peso}
                  onChange={(e) => setPeso(+e.target.value)}
                  className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
                  {t("subpages.physicalData.height")}
                </Label>
                <Input
                  type="number"
                  value={altura}
                  onChange={(e) => setAltura(+e.target.value)}
                  className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-card rounded-[32px] p-6 space-y-4 border border-border shadow-sm text-foreground mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            {t("profile.objective")}
          </h2>
          <div className="space-y-2">
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
                  <div>
                    <div className="font-bold text-sm tracking-tight text-foreground">{label}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-card rounded-[32px] p-8 flex items-center gap-6 border border-border shadow-sm relative overflow-hidden mb-6 text-foreground">
          <div className="size-16 rounded-full bg-secondary flex items-center justify-center relative z-10 text-primary">
            <Target className="size-8 text-primary" strokeWidth={2.5} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
              {t("subpages.goals.title")}
            </div>
            <div className="text-4xl font-display font-black text-foreground tracking-tighter">
              {meta}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 truncate mt-1">
              {t("common.kcal")}
            </div>
          </div>
        </Card>
      </div>

      <Button
        className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : t("subpages.goals.save")}
      </Button>
    </div>
  );
}
