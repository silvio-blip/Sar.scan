import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Pencil,
  Shield,
  Gift,
  Crown,
  Target,
  Activity,
  Lock,
  LogOut,
  ChevronRight,
  Search,
  History,
} from "lucide-react";
import { useRewardsRealtime } from "@/hooks/use-realtime-invalidate";

import { CreditDisplay } from "@/components/credit-display";

export const Route = createFileRoute("/_app/perfil/")({ component: PerfilPage });

function PerfilPage() {
  const { user, profile, isAdmin, isPremium, signOut } = useAuth();
  useRewardsRealtime(user?.id);

  const { data: rewards } = useQuery({
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

  const novas = rewards?.filter((r) => !r.lida).length ?? 0;
  const initials = (profile?.nome ?? profile?.email ?? "U").slice(0, 2).toUpperCase();

  const { subscription } = useAuth();
  const { data: usage } = useQuery({
    queryKey: ["scan_usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("scan_usage")
        .select("count, bonus")
        .eq("user_id", user!.id)
        .eq("data", today)
        .maybeSingle();
      return data ?? { count: 0, bonus: 0 };
    },
  });

  const baseScans = isAdmin ? Infinity : isPremium ? (subscription?.scans_credits ?? 0) : 3;
  const remaining = isAdmin
    ? Infinity
    : Math.max(0, baseScans + (usage?.bonus ?? 0) - (usage?.count ?? 0));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <h1 className="text-3xl font-display font-black tracking-tight">Perfil</h1>

      <div className="flex flex-col items-center text-center gap-4">
        <Avatar className="size-24 ring-4 ring-white/5 overflow-hidden shadow-2xl">
          {profile?.avatar_url && (
            <AvatarImage
              src={profile.avatar_url}
              alt="avatar"
              className="object-cover w-full h-full"
            />
          )}
          <AvatarFallback className="bg-white/10 text-white text-xl font-black">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="font-black text-xl tracking-tight">{profile?.nome ?? "—"}</div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
            {profile?.email}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-4 w-full max-w-[200px] mt-2 shadow-xl backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-1">
            Scans Disponíveis
          </div>
          <div className="text-3xl font-display font-black text-white">
            <CreditDisplay value={remaining} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap pb-2 mt-2">
          {isPremium && (
            <span className="text-[10px] bg-white/10 text-white border border-white/10 font-black uppercase tracking-widest rounded-full px-3 py-1 flex items-center gap-1.5 shadow-lg">
              <Crown className="size-3" /> Premium
            </span>
          )}
          {isAdmin && (
            <span className="text-[10px] bg-white/10 text-white border border-white/10 font-black uppercase tracking-widest rounded-full px-3 py-1 flex items-center gap-1.5 shadow-lg">
              <Shield className="size-3" /> Admin
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-white/10 bg-white/5 font-bold px-6 h-9 transition-all hover:bg-white/10"
          asChild
        >
          <Link to="/perfil/editar">
            <Pencil className="size-3.5 mr-2" /> Editar Perfil
          </Link>
        </Button>
      </div>

      {isAdmin && (
        <Link to="/admin" className="block transform transition hover:scale-[1.02] active:scale-95">
          <Card className="p-4 bg-gradient-to-r from-zinc-300 to-zinc-600 text-black border-0 shadow-xl rounded-[24px]">
            <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px]">
              <Shield className="size-4" /> Painel de Administração
            </div>
          </Card>
        </Link>
      )}

      <Link
        to="/perfil/recompensas"
        className="block transform transition hover:scale-[1.02] active:scale-95"
      >
        <Card className="glass rounded-[32px] p-5 flex items-center gap-4 border-white/5 shadow-xl">
          <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center">
            <Gift className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm flex items-center gap-2">
              Recompensas{" "}
              {novas > 0 && (
                <span className="text-[9px] bg-white text-black font-black uppercase tracking-widest rounded-full px-2 py-1 shadow-lg">
                  {novas} nova(s)
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium opacity-60">
              Reivindique scans bônus enviados pelo admin
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      <div className="border-t border-white/5" />

      <div className="space-y-3">
        <Row
          to="/perfil/metas"
          Icon={Crown}
          label="Metas Diárias"
          sub={goals ? `${goals.calorias} cal · ${goals.proteina_g}g prot` : "—"}
          premium
        />
        <Row
          to="/perfil/objetivo"
          Icon={Target}
          label="Objetivo"
          sub={
            profile?.objetivo === "perder"
              ? "Perder peso"
              : profile?.objetivo === "ganhar"
                ? "Ganhar massa"
                : "Manter peso"
          }
        />
        <Row
          to="/perfil/dados-fisicos"
          Icon={Activity}
          label="Dados Físicos"
          sub={`${profile?.peso ?? "?"}kg · ${profile?.altura ?? "?"}cm · ${profile?.idade ?? "?"} anos`}
        />
      </div>

      <div className="border-t border-white/5" />

      <Link
        to="/perfil/alterar-senha"
        className="block transform transition hover:scale-[1.02] active:scale-95"
      >
        <Card className="glass rounded-[32px] p-5 flex items-center gap-4 border-white/5 shadow-xl">
          <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center">
            <Lock className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm">Alterar Senha</div>
            <div className="text-[11px] text-muted-foreground font-medium opacity-60">
              Mudar sua senha de acesso
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      <Button
        variant="outline"
        className="w-full h-14 rounded-[28px] border-white/10 bg-white/0 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 font-bold uppercase tracking-widest text-[10px] transition-all"
        onClick={signOut}
      >
        <LogOut className="size-4 mr-2" /> Sair da Conta
      </Button>
    </div>
  );
}

function ShortcutCard({ to, Icon, label }: { to: string; Icon: typeof Crown; label: string }) {
  return (
    <Link to={to} className="transform transition hover:scale-105 active:scale-95">
      <Card className="glass rounded-[28px] p-4 flex flex-col items-center gap-2 text-center hover:bg-white/5 transition-all border-white/5 border shadow-xl">
        <div className="size-11 rounded-2xl bg-white/5 flex items-center justify-center">
          <Icon className="size-5 text-white" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </Card>
    </Link>
  );
}

function Row({
  to,
  Icon,
  label,
  sub,
  premium,
}: {
  to: string;
  Icon: typeof Crown;
  label: string;
  sub: string;
  premium?: boolean;
}) {
  return (
    <Link to={to} className="block transform transition hover:scale-[1.01] active:scale-[0.99]">
      <Card className="glass rounded-[32px] p-5 flex items-center gap-4 border-white/5 shadow-xl">
        <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center">
          <Icon className="size-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm flex items-center gap-2 text-white">
            {label}
            {premium && <Crown className="size-4 text-zinc-400 animate-pulse" />}
          </div>
          <div className="text-[11px] font-medium text-muted-foreground opacity-60 line-clamp-1">
            {sub}
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/40" />
      </Card>
    </Link>
  );
}
