import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Shield,
  Users,
  Zap,
  Gift,
  Loader2,
  Crown,
  Activity,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const today = () => new Date().toISOString().slice(0, 10);

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rewardFor, setRewardFor] = useState<{ id: string; nome: string } | null>(null);
  const [rTitulo, setRTitulo] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rBonus, setRBonus] = useState(0);
  const [rSending, setRSending] = useState(false);

  const [campEnabled, setCampEnabled] = useState(false);
  const [campStart, setCampStart] = useState("");
  const [campEnd, setCampEnd] = useState("");
  const [campScans, setCampScans] = useState(0);
  const [campAiDays, setCampAiDays] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);

  const { isLoading: loadingSettings } = useQuery({
    queryKey: ["admin_campaign_settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "campaign_enabled",
          "campaign_start_date",
          "campaign_end_date",
          "campaign_bonus_scans",
          "campaign_free_ai_days",
        ]);
      if (data) {
        data.forEach((row) => {
          if (row.key === "campaign_enabled") setCampEnabled(row.value === "true");
          if (row.key === "campaign_start_date") setCampStart(row.value || "");
          if (row.key === "campaign_end_date") setCampEnd(row.value || "");
          if (row.key === "campaign_bonus_scans") setCampScans(parseInt(row.value) || 0);
          if (row.key === "campaign_free_ai_days") setCampAiDays(parseInt(row.value) || 0);
        });
      }
      return data ?? [];
    },
  });

  const saveCampaignSettings = async () => {
    setSavingSettings(true);
    try {
      const rows = [
        { key: "campaign_enabled", value: String(campEnabled) },
        { key: "campaign_start_date", value: campStart },
        { key: "campaign_end_date", value: campEnd },
        { key: "campaign_bonus_scans", value: String(campScans) },
        { key: "campaign_free_ai_days", value: String(campAiDays) },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin_campaign_settings"] });
      toast.success("Configurações da campanha salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar configurações: " + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const { data: users, isLoading: queryLoading } = useQuery({
    queryKey: ["admin_users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .order("nome");
      const ids = (profiles ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const [{ data: subs }, { data: usage }] = await Promise.all([
        supabase.from("subscriptions").select("user_id, status").in("user_id", ids),
        supabase
          .from("scan_usage")
          .select("user_id, count, bonus")
          .in("user_id", ids)
          .eq("data", today()),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        premium:
          subs?.find((s) => s.user_id === p.id)?.status === "active" ||
          subs?.find((s) => s.user_id === p.id)?.status === "trialing",
        scans: usage?.find((u) => u.user_id === p.id)?.count ?? 0,
        bonus: usage?.find((u) => u.user_id === p.id)?.bonus ?? 0,
      }));
    },
  });

  const totalUsers = users?.length ?? 0;
  const totalPremium = users?.filter((u) => u.premium).length ?? 0;
  const totalScansToday = users?.reduce((s, u) => s + (u.scans ?? 0), 0) ?? 0;

  if (loading)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold uppercase tracking-wider">
          Verificando credenciais...
        </p>
      </div>
    );

  if (!user || !isAdmin) return <Navigate to="/" />;

  const togglePremium = async (uid: string, on: boolean) => {
    await supabase.from("subscriptions").upsert(
      {
        user_id: uid,
        status: on ? "active" : "free",
        plan: on ? "monthly" : null,
        ai_agent_enabled: on ? true : false,
        current_period_end: on ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    qc.invalidateQueries({ queryKey: ["admin_users"] });
    toast.success(on ? "Premium ativado (Mensal + IA)" : "Premium removido");
  };

  const addBonus = async (uid: string, n: number) => {
    const { data: existing } = await supabase
      .from("scan_usage")
      .select("bonus, count")
      .eq("user_id", uid)
      .eq("data", today())
      .maybeSingle();
    await supabase.from("scan_usage").upsert(
      {
        user_id: uid,
        data: today(),
        count: existing?.count ?? 0,
        bonus: (existing?.bonus ?? 0) + n,
      },
      { onConflict: "user_id,data" },
    );
    toast.success(n > 0 ? `+${n} scans creditados` : `${n} scans removidos`);
    qc.invalidateQueries({ queryKey: ["admin_users"] });
  };

  const openReward = (u: { id: string; nome?: string | null; email?: string | null }) => {
    setRewardFor({ id: u.id, nome: u.nome ?? u.email ?? "Usuário" });
    setRTitulo("");
    setRDesc("");
    setRBonus(0);
  };

  const submitReward = async () => {
    if (!rewardFor || !rTitulo.trim()) {
      toast.error("Por favor, informe um título para a recompensa");
      return;
    }
    setRSending(true);
    try {
      await supabase.from("rewards").insert({
        user_id: rewardFor.id,
        titulo: rTitulo.trim(),
        descricao: rDesc.trim(),
        bonus_scans: rBonus,
      });
      toast.success(
        rBonus > 0
          ? `Recompensa enviada! O usuário receberá +${rBonus} scans ao reivindicar.`
          : "Recompensa enviada",
      );
      setRewardFor(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar recompensa");
    } finally {
      setRSending(false);
    }
  };

  const filtered = (users ?? []).filter(
    (u) =>
      u.email?.toLowerCase().includes(q.toLowerCase()) ||
      u.nome?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Premium Sticky Header */}
      <header className="bg-card/90 backdrop-blur-md border-b border-border/50 sticky top-0 z-50 px-5 py-4 flex items-center gap-4 shadow-sm">
        <Link
          to="/perfil"
          className="size-10 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="size-5 text-primary stroke-[2.5]" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Shield className="size-4.5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-display font-black tracking-tight text-primary leading-none">
              Painel Admin
            </h1>
            <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/85 font-black">
              Controle Geral
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-4 py-6 space-y-6">
        {/* Statistics Widgets */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card rounded-[24px] p-3.5 text-center border border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/30" />
            <Users className="size-4.5 mx-auto text-primary mb-1.5" />
            <div className="text-xl font-display font-black text-foreground">{totalUsers}</div>
            <div className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-0.5">
              Usuários
            </div>
          </Card>

          <Card className="bg-card rounded-[24px] p-3.5 text-center border border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
            <Crown className="size-4.5 mx-auto text-accent mb-1.5" />
            <div className="text-xl font-display font-black text-foreground">{totalPremium}</div>
            <div className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-0.5">
              Premium
            </div>
          </Card>

          <Card className="bg-card rounded-[24px] p-3.5 text-center border border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-water/40" />
            <Activity className="size-4.5 mx-auto text-water mb-1.5" />
            <div className="text-xl font-display font-black text-foreground">{totalScansToday}</div>
            <div className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-0.5">
              Scans Hoje
            </div>
          </Card>
        </div>

        {/* Campaign Settings Dashboard */}
        <Card className="bg-card rounded-[28px] p-6 space-y-5 border border-border/45 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-accent" />

          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Gift className="size-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-display font-black text-foreground uppercase tracking-wider">
                Campanha de Boas-Vindas
              </h2>
              <p className="text-[10px] text-muted-foreground font-semibold">
                Ofereça bônus de scans e acesso ao Chatbot IA para novos utilizadores
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Enabled Switch */}
            <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-2xl border border-border/30">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-foreground">Campanha Ativa</span>
                <p className="text-[9px] text-muted-foreground font-semibold leading-none">
                  Ativar bônus para registos novos
                </p>
              </div>
              <Switch checked={campEnabled} onCheckedChange={setCampEnabled} />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                Data de Início da Campanha
              </Label>
              <Input
                type="datetime-local"
                value={campStart}
                onChange={(e) => setCampStart(e.target.value)}
                className="h-11 rounded-xl bg-secondary/40 border-border/60 text-xs font-semibold focus-visible:ring-primary/20 text-foreground"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                Data de Fim da Campanha
              </Label>
              <Input
                type="datetime-local"
                value={campEnd}
                onChange={(e) => setCampEnd(e.target.value)}
                className="h-11 rounded-xl bg-secondary/40 border-border/60 text-xs font-semibold focus-visible:ring-primary/20 text-foreground"
              />
            </div>

            {/* Bonus Scans */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                Scans Extra Recebidos (Além dos 3 base)
              </Label>
              <Input
                type="number"
                min={0}
                value={campScans}
                onChange={(e) => setCampScans(parseInt(e.target.value) || 0)}
                className="h-11 rounded-xl bg-secondary/40 border-border/60 text-xs font-semibold focus-visible:ring-primary/20 text-foreground"
              />
            </div>

            {/* AI Agent Duration Days */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                Dias de Acesso Gratuito à IA
              </Label>
              <Input
                type="number"
                min={0}
                value={campAiDays}
                onChange={(e) => setCampAiDays(parseInt(e.target.value) || 0)}
                className="h-11 rounded-xl bg-secondary/40 border-border/60 text-xs font-semibold focus-visible:ring-primary/20 text-foreground"
              />
            </div>

            <Button
              onClick={saveCampaignSettings}
              disabled={savingSettings}
              className="w-full h-11.5 mt-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-black uppercase tracking-wider text-[10px] flex items-center justify-center shadow-md cursor-pointer"
            >
              {savingSettings ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Salvar Configurações da Campanha"
              )}
            </Button>
          </div>
        </Card>

        {/* Search Panel */}
        <Card className="bg-card rounded-[28px] p-5 space-y-3.5 border border-border/45 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-primary/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              Procurar utilizadores
            </span>
          </div>
          <div className="relative">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por e-mail ou nome..."
              className="h-12 pl-11 pr-4 rounded-xl bg-secondary/50 border-border/60 text-sm placeholder:text-muted-foreground/60 text-foreground font-medium focus-visible:ring-primary/25"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
              <Search className="size-4" />
            </div>
          </div>
        </Card>

        {/* User Management List */}
        <div className="space-y-4">
          {queryLoading && (
            <div className="text-center py-8">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Buscando tabela de usuários...
              </p>
            </div>
          )}

          {!queryLoading && filtered.length === 0 && (
            <div className="text-center py-10 bg-card rounded-[28px] border border-border/30 p-6">
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum utilizador encontrado com este termo.
              </p>
            </div>
          )}

          {filtered.map((u, idx) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.45) }}
            >
              <Card className="bg-card rounded-[32px] p-5.5 space-y-4 border border-border/45 shadow-md hover:shadow-lg transition-all relative overflow-hidden">
                {/* Visual Accent for Premiums */}
                {u.premium && (
                  <div className="absolute top-0 right-0 bg-accent/15 text-accent text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-[16px] flex items-center gap-1 shadow-sm">
                    <Crown className="size-2.5" />
                    Premium
                  </div>
                )}

                {/* Profile Header */}
                <div className="flex items-center gap-3.5">
                  <Avatar className="size-13 ring-2 ring-primary/10 shadow-sm overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <AvatarImage src={u.avatar_url} alt={u.nome ?? ""} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                      {(u.nome ?? u.email ?? "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 pr-12">
                    <div className="font-bold text-sm tracking-tight truncate text-foreground leading-tight">
                      {u.nome ?? "Sem Nome"}
                    </div>
                    <div className="text-[10px] font-semibold text-muted-foreground/80 truncate mt-0.5 font-mono">
                      {u.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                        Hoje: {u.scans} scans
                      </span>
                      {u.bonus > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full inline-block">
                          +{u.bonus} bônus
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Premium Switch Control */}
                <div className="flex items-center justify-between py-2.5 px-3 bg-secondary/50 rounded-2xl border border-border/30">
                  <div className="flex items-center gap-2">
                    <Crown className="size-4 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                      Acesso Vitalício / Manual
                    </span>
                  </div>
                  <Switch
                    checked={u.premium}
                    onCheckedChange={(v) => togglePremium(u.id, v)}
                    className="data-[state=checked]:bg-accent"
                  />
                </div>

                {/* Scan Actions & Rewards Trigger */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl bg-secondary/60 hover:bg-muted border border-border/50 text-[10px] font-black uppercase tracking-wider text-primary cursor-pointer active:scale-98"
                      onClick={() => addBonus(u.id, 3)}
                    >
                      <Zap className="size-3 mr-1 text-primary stroke-[2.5]" /> +3 Scans
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl bg-secondary/60 hover:bg-muted border border-border/50 text-[10px] font-black uppercase tracking-wider text-destructive cursor-pointer active:scale-98"
                      onClick={() => addBonus(u.id, -3)}
                    >
                      <Zap className="size-3 mr-1 text-destructive stroke-[2.5] rotate-180" /> -3
                      Scans
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl bg-secondary/60 hover:bg-muted border border-border/50 text-[10px] font-black uppercase tracking-wider text-primary cursor-pointer active:scale-98"
                      onClick={() => addBonus(u.id, 10)}
                    >
                      <Zap className="size-3 mr-1 text-primary stroke-[2.5]" /> +10 Scans
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl bg-secondary/60 hover:bg-muted border border-border/50 text-[10px] font-black uppercase tracking-wider text-destructive cursor-pointer active:scale-98"
                      onClick={() => addBonus(u.id, -10)}
                    >
                      <Zap className="size-3 mr-1 text-destructive stroke-[2.5] rotate-180" /> -10
                      Scans
                    </Button>
                  </div>

                  <Button
                    className="w-full h-11.5 mt-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-98 flex items-center justify-center shadow-sm"
                    onClick={() => openReward(u)}
                  >
                    <Gift className="size-3.5 mr-1.5 stroke-[2.5]" /> Enviar Recompensa Especial
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reward Modal Dialog */}
      <AnimatePresence>
        {rewardFor && (
          <Dialog open={!!rewardFor} onOpenChange={(o) => !o && setRewardFor(null)}>
            <DialogContent className="bg-card border-border/50 rounded-[32px] max-w-[92vw] sm:max-w-sm p-6 shadow-2xl">
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2 text-primary font-display font-black text-lg">
                  <Gift className="size-5.5 text-accent stroke-[2]" /> Enviar Recompensa
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground/85 mt-1">
                  Enviando bônus para: <b className="text-foreground">{rewardFor.nome}</b>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4.5">
                {/* Title Input */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                    Título do Alerta
                  </Label>
                  <Input
                    value={rTitulo}
                    onChange={(e) => setRTitulo(e.target.value)}
                    placeholder="Ex: Presente do Nutricionista!"
                    className="h-12 rounded-xl bg-secondary/40 border-border/60 text-sm font-medium focus-visible:ring-primary/20"
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                    Mensagem de Descrição
                  </Label>
                  <Textarea
                    value={rDesc}
                    onChange={(e) => setRDesc(e.target.value)}
                    placeholder="Explique o motivo do prêmio ou dê conselhos nutricionais..."
                    rows={3}
                    className="rounded-xl bg-secondary/40 border-border/60 text-sm font-medium focus-visible:ring-primary/20 resize-none"
                  />
                </div>

                {/* Scan Count Input */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                    Quantidade de Scans de Bônus
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={rBonus}
                    onChange={(e) => setRBonus(parseInt(e.target.value) || 0)}
                    className="h-12 rounded-xl bg-secondary/40 border-border/60 text-sm font-medium focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col gap-2.5 sm:flex-col mt-2">
                <Button
                  className="w-full h-13.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-black uppercase tracking-wider text-xs cursor-pointer active:scale-98 flex items-center justify-center shadow-md shadow-primary/10"
                  onClick={submitReward}
                  disabled={rSending}
                >
                  {rSending ? (
                    <Loader2 className="size-4.5 animate-spin" />
                  ) : (
                    <>
                      <Gift className="size-4.5 mr-2 stroke-[2.5]" />
                      Confirmar Envio
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-11 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 font-black uppercase tracking-wider text-[10px] cursor-pointer"
                  onClick={() => setRewardFor(null)}
                >
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
