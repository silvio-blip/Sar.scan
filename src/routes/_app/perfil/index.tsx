import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
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
  Copy,
  Check,
  Bell,
} from "lucide-react";
import { useRewardsRealtime } from "@/hooks/use-realtime-invalidate";
import { isInstalledApp } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { WaterReminderScheduler } from "@/components/water-reminder-scheduler";

export const Route = createFileRoute("/_app/perfil/")({ component: PerfilPage });

function PerfilPage() {
  const { user, profile, isAdmin, isPremium, signOut } = useAuth();
  useRewardsRealtime(user?.id);

  const [pushActive, setPushActive] = useState(
    () => localStorage.getItem("push_notifications_active") !== "false",
  );
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions) {
      navigator.permissions
        .query({ name: "camera" as any })
        .then((result) => {
          setCameraGranted(result.state === "granted");
          result.onchange = () => {
            setCameraGranted(result.state === "granted");
          };
        })
        .catch(() => {});

      navigator.permissions
        .query({ name: "microphone" as any })
        .then((result) => {
          setMicGranted(result.state === "granted");
          result.onchange = () => {
            setMicGranted(result.state === "granted");
          };
        })
        .catch(() => {});
    }
  }, []);
  const [hasSchemaError, setHasSchemaError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <h1 className="text-3xl font-display font-black tracking-tight text-foreground">Perfil</h1>

      <div className="flex flex-col items-center text-center gap-4">
        <Avatar className="size-24 ring-4 ring-primary/15 overflow-hidden shadow-md">
          {profile?.avatar_url && (
            <AvatarImage
              src={profile.avatar_url}
              alt="avatar"
              className="object-cover w-full h-full"
            />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="font-extrabold text-xl tracking-tight text-foreground">
            {profile?.nome ?? "—"}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {profile?.email}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap pb-2 mt-1">
          {isPremium && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-black uppercase tracking-widest rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
              <Crown className="size-3" /> Premium
            </span>
          )}
          {isAdmin && (
            <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 font-black uppercase tracking-widest rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
              <Shield className="size-3" /> Admin
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border border-border bg-secondary hover:bg-muted font-bold px-6 h-9 transition-all text-foreground"
          asChild
        >
          <Link to="/perfil/editar">
            <Pencil className="size-3.5 mr-2 text-primary" /> Editar Perfil
          </Link>
        </Button>
      </div>

      {isAdmin && (
        <Link to="/admin" className="block transform transition hover:scale-[1.02] active:scale-95">
          <Card className="p-4 bg-primary text-primary-foreground border-0 shadow-md rounded-[24px]">
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
        <Card className="bg-card rounded-[32px] p-5 flex items-center gap-4 border border-border shadow-sm">
          <div className="size-12 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Gift className="size-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground flex items-center gap-2">
              Recompensas{" "}
              {novas > 0 && (
                <span className="text-[9px] bg-accent text-white font-black uppercase tracking-widest rounded-full px-2 py-1 shadow-sm font-sans">
                  {novas} nova(s)
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              Reivindique scans bônus enviados pelo admin
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      <div className="border-t border-border" />

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

      <div className="border-t border-border" />

      <Link
        to="/perfil/alterar-senha"
        className="block transform transition hover:scale-[1.02] active:scale-95"
      >
        <Card className="bg-card rounded-[32px] p-5 flex items-center gap-4 border border-border shadow-sm">
          <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center">
            <Lock className="size-5 text-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground">Alterar Senha</div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              Mudar sua senha de acesso
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      <div className="border-t border-border" />

      {/* Configurações de Notificação Component */}
      <Card className="bg-card rounded-[32px] p-5 border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground">Configurações de Notificação</div>
            <p className="text-[11px] text-muted-foreground font-medium leading-normal">
              Ativar ou desativar o recebimento de notificações.
            </p>
          </div>
          <Switch
            checked={pushActive}
            onCheckedChange={async (checked) => {
              setPushActive(checked);
              localStorage.setItem("push_notifications_active", checked ? "true" : "false");
              // A lógica de notificação simplificada ou removida conforme necessário
            }}
          />
        </div>
      </Card>

      <div className="border-t border-border" />

      {/* Agendador de Lembrete de Água */}
      <WaterReminderScheduler userId={user?.id} />

      <div className="border-t border-border" />

      {/* Direitos e Privacidade link */}
      <Link
        to="/direitos-privacidade"
        className="block transform transition hover:scale-[1.02] active:scale-95"
      >
        <Card className="bg-card rounded-[32px] p-5 flex items-center gap-4 border border-border shadow-sm">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground">Direitos e Privacidade</div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              Termos de uso, limites de créditos e privacidade de dados
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      <Button
        variant="outline"
        className="w-full h-14 rounded-[28px] border border-red-500/20 bg-transparent hover:bg-red-500/5 text-red-500 hover:text-red-600 font-bold uppercase tracking-widest text-[10px] transition-all"
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
      <Card className="bg-card rounded-[28px] p-4 flex flex-col items-center gap-2 text-center hover:bg-secondary/40 transition-all border border-border shadow-sm">
        <div className="size-11 rounded-2xl bg-secondary flex items-center justify-center">
          <Icon className="size-5 text-foreground" />
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
      <Card className="bg-card rounded-[32px] p-5 flex items-center gap-4 border border-border shadow-sm">
        <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center">
          <Icon className="size-5 text-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm flex items-center gap-2 text-foreground">
            {label}
            {premium && <Crown className="size-4 text-accent animate-pulse" />}
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground line-clamp-1">{sub}</div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/50" />
      </Card>
    </Link>
  );
}
