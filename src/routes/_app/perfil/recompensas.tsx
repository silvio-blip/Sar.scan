import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gift, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useRewardsRealtime } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/_app/perfil/recompensas")({ component: RecompensasPage });

function RecompensasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  useRewardsRealtime(user?.id);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const claim = async (id: string, bonus: number) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("claim_reward", { _reward_id: id });
      if (error) throw error;
      const added = Array.isArray(data)
        ? ((data[0] as { scans_added?: number })?.scans_added ?? bonus)
        : bonus;
      toast.success(added > 0 ? `🎉 +${added} scans creditados` : "Recompensa reivindicada!");
      qc.invalidateQueries({ queryKey: ["rewards", user?.id] });
      qc.invalidateQueries({ queryKey: ["scan_usage"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao reivindicar";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
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
        <h1 className="text-2xl font-display font-black tracking-tight text-foreground flex items-center gap-2">
          <Gift className="size-6 text-primary" /> Recompensas
        </h1>
      </div>

      {isLoading && <Loader2 className="size-6 animate-spin mx-auto text-primary" />}
      {!isLoading && (!rewards || rewards.length === 0) && (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-2xl shadow-sm">
          Nenhuma recompensa por enquanto. Continue ativo para ganhar bônus!
        </Card>
      )}
      {rewards?.map((r) => {
        const claimed = !!(r as { bonus_aplicado?: boolean }).bonus_aplicado;
        return (
          <Card
            key={r.id}
            className={`p-5 rounded-[24px] border bg-card transition-all ${claimed ? "opacity-60 border-border/40" : "border-border shadow-sm text-foreground"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-foreground flex items-center gap-2">
                  {r.titulo}
                  {!r.lida && (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-accent text-accent-foreground rounded-full px-2 py-0.5">
                      NOVA
                    </span>
                  )}
                </div>
                {r.descricao && (
                  <div className="text-xs text-muted-foreground/95 mt-1 leading-relaxed">
                    {r.descricao}
                  </div>
                )}
                {r.bonus_scans > 0 && (
                  <div className="text-xs text-primary font-bold mt-1">
                    🎁 +{r.bonus_scans} scans bônus
                  </div>
                )}
              </div>
              {claimed ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 mt-1">
                  <Check className="size-3" /> Reivindicada
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={busyId === r.id}
                  onClick={() => claim(r.id, r.bonus_scans ?? 0)}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] uppercase font-bold tracking-wider rounded-xl h-9 px-4 shrink-0 transition-transform active:scale-95 mt-1"
                >
                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : "Reivindicar"}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
