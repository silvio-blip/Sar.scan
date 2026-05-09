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
} from "lucide-react";
import { toast } from "sonner";

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

  const { data: users } = useQuery({
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
      <div className="min-h-screen bg-black grid place-items-center">
        <Loader2 className="size-12 animate-spin text-white" />
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
    toast.success(`+${n} scans adicionados`);
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
      toast.error("Informe um título");
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
          ? `Recompensa enviada. O usuário receberá +${rBonus} scans ao reivindicar.`
          : "Recompensa enviada",
      );
      setRewardFor(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
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
    <div className="min-h-screen bg-black">
      <div className="bg-white text-black p-5 flex items-center gap-4 sticky top-0 z-50 shadow-2xl">
        <Link to="/perfil" className="p-1 hover:bg-black/5 rounded-lg transition-colors">
          <ArrowLeft className="size-6" />
        </Link>
        <Shield className="size-6" />
        <h1 className="text-xl font-display font-black tracking-tight">Painel Admin</h1>
      </div>

      <div className="mx-auto max-w-[480px] p-6 space-y-6 animate-in fade-in duration-700">
        <div className="grid grid-cols-3 gap-3">
          <Card className="glass rounded-[24px] p-4 text-center border-white/5 shadow-xl">
            <Users className="size-5 mx-auto text-white/40 mb-2" />
            <div className="text-2xl font-display font-black text-white">{totalUsers}</div>
            <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">
              Usuários
            </div>
          </Card>
          <Card className="glass rounded-[24px] p-4 text-center border-white/5 shadow-xl">
            <Crown className="size-5 mx-auto text-white mb-2" />
            <div className="text-2xl font-display font-black text-white">{totalPremium}</div>
            <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">
              Premium
            </div>
          </Card>
          <Card className="glass rounded-[24px] p-4 text-center border-white/5 shadow-xl">
            <Activity className="size-5 mx-auto text-white/40 mb-2" />
            <div className="text-2xl font-display font-black text-white">{totalScansToday}</div>
            <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">
              Scans hoje
            </div>
          </Card>
        </div>

        <Card className="glass rounded-[32px] p-6 space-y-4 border-white/5 shadow-xl">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-white/40" />
            <b className="text-[11px] font-black uppercase tracking-widest">Gerenciar Usuários</b>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por email ou nome..."
            className="h-12 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
          />
        </Card>


        {filtered.map((u) => (
          <Card
            key={u.id}
            className="glass rounded-[32px] p-6 space-y-4 border-white/5 shadow-xl group"
          >
            <div className="flex items-center gap-4">
              <Avatar className="size-14 ring-2 ring-white/5 shadow-xl overflow-hidden">
                {u.avatar_url && (
                  <AvatarImage src={u.avatar_url} alt={u.nome ?? ""} className="object-cover" />
                )}
                <AvatarFallback className="bg-white/10 text-white font-black">
                  {(u.nome ?? u.email ?? "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base tracking-tight truncate text-white">
                  {u.nome ?? "Sem Nome"}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 truncate">
                  {u.email}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">
                  Hoje: {u.scans} scans · +{u.bonus} bônus
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-y border-white/5">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
                Acesso Premium
              </span>
              <Switch checked={u.premium} onCheckedChange={(v) => togglePremium(u.id, v)} />
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => addBonus(u.id, 3)}
                  >
                    <Zap className="size-3 mr-1.5" /> +3 Scans
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => addBonus(u.id, -3)}
                  >
                    <Zap className="size-3 mr-1.5 opacity-40 rotate-180" /> -3 Scans
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => addBonus(u.id, 10)}
                  >
                    <Zap className="size-3 mr-1.5" /> +10 Scans
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => addBonus(u.id, -10)}
                  >
                    <Zap className="size-3 mr-1.5 opacity-40 rotate-180" /> -10 Scans
                  </Button>
                </div>
              </div>
              <Button
                className="w-full h-12 rounded-xl bg-white text-black hover:bg-zinc-200 text-[10px] font-black uppercase tracking-widest"
                onClick={() => openReward(u)}
              >
                <Gift className="size-4 mr-2" /> Enviar Recompensa
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!rewardFor} onOpenChange={(o) => !o && setRewardFor(null)}>
        <DialogContent className="glass border-white/10 rounded-[32px] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white font-black">
              <Gift className="size-5" /> Enviar Recompensa
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Para: <b className="text-white">{rewardFor?.nome}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                Título
              </Label>
              <Input
                value={rTitulo}
                onChange={(e) => setRTitulo(e.target.value)}
                placeholder="Ex: Parabéns pelo progresso!"
                className="h-12 rounded-2xl bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                Descrição
              </Label>
              <Textarea
                value={rDesc}
                onChange={(e) => setRDesc(e.target.value)}
                placeholder="Mensagem para o usuário"
                rows={3}
                className="rounded-2xl bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                Bônus de scans
              </Label>
              <Input
                type="number"
                min={0}
                value={rBonus}
                onChange={(e) => setRBonus(parseInt(e.target.value) || 0)}
                className="h-12 rounded-2xl bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              className="w-full h-14 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-xs"
              onClick={submitReward}
              disabled={rSending}
            >
              {rSending ? (
                <Loader2 className="size-5 animate-spin mr-2" />
              ) : (
                <Gift className="size-5 mr-2" />
              )}
              Enviar
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12 rounded-2xl text-white/40 font-black uppercase tracking-widest text-[10px]"
              onClick={() => setRewardFor(null)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
