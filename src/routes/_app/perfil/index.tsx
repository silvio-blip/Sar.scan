import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
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
  Smartphone,
} from "lucide-react";
import { useRewardsRealtime } from "@/hooks/use-realtime-invalidate";

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

      {/* FCM Device Notification Token Block */}
      <Card className="bg-card rounded-[32px] p-5 border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground">Dispositivo & Firebase (FCM)</div>
            <p className="text-[11px] text-muted-foreground font-semibold">
              {profile?.fcm_token
                ? "Token FCM registrado com sucesso!"
                : "Aguardando registro no APK..."}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] uppercase font-black tracking-wider text-primary hover:bg-primary/5 rounded-xl h-8"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? "Ocultar" : "Exibir"}
          </Button>
        </div>

        {showToken && (
          <div className="pt-2 border-t border-border space-y-3">
            {profile?.fcm_token ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Firebase Cloud Messaging Token:
                </p>
                <div className="bg-secondary p-3 rounded-2xl text-[10px] font-mono break-all relative border border-border flex items-start gap-2 pr-10">
                  <span className="flex-1 text-foreground/80 leading-relaxed select-all">
                    {profile.fcm_token}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 absolute right-1.5 top-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.fcm_token || "");
                      setCopied(true);
                      toast.success("Token copiado para a área de transferência!");
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground leading-normal mt-1">
                  Este token identifica seu celular único e é atualizado automaticamente pelo
                  aplicativo ao entrar no APK.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-500 font-bold leading-relaxed">
                  ⚠️ Nenhum token registrado ainda no seu perfil.
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Para registrar o token push dinâmico e receber as notificações push em standby:
                </p>
                <ol className="text-[10px] text-muted-foreground list-decimal pl-4 space-y-1">
                  <li>Instale e abra o aplicativo compile em formato APK no Android Studio.</li>
                  <li>
                    O APK pedirá permissão de notificações nativas. Escolha{" "}
                    <strong>"Permitir"</strong>.
                  </li>
                  <li>
                    O token será obtido via plugin Capacitor e enviado ao banco automaticamente.
                  </li>
                </ol>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px] uppercase font-bold tracking-wider rounded-xl h-8 border-dashed"
                    onClick={async () => {
                      const mockToken = `fcm_mock_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
                      try {
                        const { error } = await supabase
                          .from("profiles")
                          .update({ fcm_token: mockToken })
                          .eq("id", user!.id);
                        if (error) throw error;
                        toast.success("Token Mock ativado para teste local!");
                        window.location.reload();
                      } catch (err: any) {
                        toast.error("Erro ao simular fcm_token " + err.message);
                      }
                    }}
                  >
                    Simular Token Local para Teste
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

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
