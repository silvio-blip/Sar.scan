import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  Pencil,
  Shield,
  Gift,
  Crown,
  Target,
  Activity,
  Lock,
  LogOut,
  Trash2,
  ChevronRight,
  History,
  Bell,
  Ruler,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRewardsRealtime } from "@/hooks/use-realtime-invalidate";
import { Switch } from "@/components/ui/switch";
import { WaterReminderScheduler } from "@/components/water-reminder-scheduler";
import { getSavedHandCalibration } from "@/lib/hand-calibration";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/")({ component: PerfilPage });

export function PerfilPage() {
  const { user, profile, subscription, isAdmin, isPremium, signOut } = useAuth();
  const { t, lang, setLanguage } = useTranslation();
  useRewardsRealtime(user?.id);

  const [pushActive, setPushActive] = useState(
    () => localStorage.getItem("push_notifications_active") !== "false",
  );

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [handCalibration, setHandCalibration] = useState(() => getSavedHandCalibration());

  useEffect(() => {
    setHandCalibration(getSavedHandCalibration());
  }, []);

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
    <div className="space-y-6 select-none transform-gpu pb-10">
      <h1 className="text-3xl font-display font-black tracking-tight text-foreground px-1">
        {t("profile.title")}
      </h1>

      {/* User Header Profile Card */}
      <Card className="bg-card rounded-[32px] p-6 border border-border shadow-sm flex flex-col items-center text-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />

        <Avatar className="size-24 ring-4 ring-primary/15 overflow-hidden shadow-md relative z-10">
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

        <div className="space-y-1 relative z-10">
          <div className="font-extrabold text-xl tracking-tight text-foreground">
            {profile?.nome ?? "—"}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {profile?.email}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap relative z-10">
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
          className="rounded-full border border-border bg-secondary hover:bg-muted font-bold px-6 h-9 transition-all text-foreground relative z-10"
          asChild
        >
          <Link to="/perfil/editar">
            <Pencil className="size-3.5 mr-2 text-primary" /> {t("profile.editProfile")}
          </Link>
        </Button>
      </Card>

      {isAdmin && (
        <Link to="/admin" className="block transform transition hover:scale-[1.02] active:scale-95">
          <Card className="p-4 bg-primary text-primary-foreground border-0 shadow-md rounded-[24px]">
            <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px]">
              <Shield className="size-4" /> {t("profile.adminPanel")}
            </div>
          </Card>
        </Link>
      )}

      {/* SEÇÃO 1: ASSINATURA & ATIVIDADE */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3">
          {t("profile.sectionSubscription")}
        </h2>
        <Card className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden divide-y divide-border/50">
          <Row
            to="/perfil/assinatura"
            Icon={Crown}
            label={t("profile.subscriptions")}
            sub={
              subscription?.plan && subscription.status === "active"
                ? `Plano ${subscription.plan === "weekly" ? "Semanal" : subscription.plan === "yearly" ? "Anual" : "Mensal"} · Ativo`
                : subscription?.status === "trialing"
                  ? "Teste Grátis (7 Dias) · Ativo"
                  : "Plano Gratuito · Ver Planos Premium"
            }
            badge={
              isPremium ? (subscription?.plan ? subscription.plan.toUpperCase() : "PRO") : undefined
            }
          />
          <Row
            to="/perfil/recompensas"
            Icon={Gift}
            label={t("profile.rewards")}
            sub="Reivindique scans bônus enviados pelo admin"
            badge={novas > 0 ? `${novas} nova(s)` : undefined}
            badgeColor="bg-accent text-white"
          />
          <Row
            to="/diario"
            Icon={History}
            label={t("profile.history")}
            sub="Veja seu histórico de leituras e registros salvos"
          />
        </Card>
      </div>

      {/* SEÇÃO 2: METAS & SAÚDE */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3">
          {t("profile.sectionGoals")}
        </h2>
        <Card className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden divide-y divide-border/50">
          <Row
            to="/perfil/metas"
            Icon={Crown}
            label={t("profile.goals")}
            sub={goals ? `${goals.calorias} cal · ${goals.proteina_g}g prot` : "Definir metas"}
            premium
          />
          <Row
            to="/perfil/objetivo"
            Icon={Target}
            label={t("profile.objective")}
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
            label={t("profile.physicalData")}
            sub={`${profile?.peso ?? "?"}kg · ${profile?.altura ?? "?"}cm · ${profile?.idade ?? "?"} anos`}
          />
          <Row
            to="/perfil/calibracao-mao"
            Icon={Ruler}
            label={t("profile.handCalibration")}
            sub={
              handCalibration
                ? `Calibrada: ${handCalibration.comprimento_cm} cm · Ativa`
                : "Calibre sua mão para dados mais precisos"
            }
          />
        </Card>
      </div>

      {/* SEÇÃO 3: PREFERÊNCIAS & NOTIFICAÇÕES */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3">
          {t("profile.sectionPreferences")}
        </h2>
        <Card className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden divide-y divide-border/50 p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground">{t("profile.notifications")}</div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {t("profile.notificationsSub")}
              </p>
            </div>
            <Switch
              checked={pushActive}
              onCheckedChange={(checked) => {
                setPushActive(checked);
                localStorage.setItem("push_notifications_active", checked ? "true" : "false");
              }}
            />
          </div>

          <div className="flex items-center gap-4 pt-3 border-t border-border/60">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg">🌐</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground">{t("profile.language")}</div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {lang === "pt" ? "Português (Brasil)" : lang === "en" ? "English" : "Español"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(["pt", "en", "es"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`size-8 rounded-xl text-[10px] font-black uppercase transition-all ${
                    lang === l
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border/60">
            <WaterReminderScheduler userId={user?.id} />
          </div>
        </Card>
      </div>

      {/* SEÇÃO 4: SEGURANÇA & CONTA */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3">
          {t("profile.sectionSecurity")}
        </h2>
        <Card className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden divide-y divide-border/50">
          <Row
            to="/perfil/alterar-senha"
            Icon={Lock}
            label={t("profile.changePassword")}
            sub="Atualize sua senha de acesso"
          />
          <Row
            to="/direitos-privacidade"
            Icon={Shield}
            label={t("profile.privacy")}
            sub="Termos de uso, limites de créditos e privacidade"
          />
          <Row
            to="/perfil/excluir-conta"
            Icon={Trash2}
            label={t("profile.deleteAccount")}
            sub="Remover todos os dados permanentemente"
            danger
          />
        </Card>
      </div>

      {/* Botão Sair */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full h-14 rounded-[28px] border border-red-500/20 bg-transparent hover:bg-red-500/5 text-red-500 hover:text-red-600 font-bold uppercase tracking-widest text-[10px] transition-all"
          onClick={() => setShowSignOutDialog(true)}
        >
          <LogOut className="size-4 mr-2" /> {t("profile.signOut")}
        </Button>
      </div>

      {/* Dialog Sair */}
      <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <DialogContent className="bg-card border border-border rounded-[32px] p-6 max-w-sm">
          <DialogHeader className="space-y-3">
            <div className="size-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
              <LogOut className="size-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-foreground">
              {t("profile.signOut")}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Tem certeza de que deseja sair? Você precisará entrar novamente na próxima vez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4 sm:justify-center">
            <Button
              variant="outline"
              disabled={signingOut}
              className="flex-1 h-12 rounded-2xl border-border font-bold text-xs"
              onClick={() => setShowSignOutDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={signingOut}
              className="flex-1 h-12 rounded-2xl font-bold text-xs flex items-center justify-center gap-2"
              onClick={async () => {
                setSigningOut(true);
                setShowSignOutDialog(false);
                await signOut();
              }}
            >
              {signingOut ? <Loader2 className="size-4 animate-spin" /> : "Sim, Sair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  to,
  Icon,
  label,
  sub,
  premium,
  badge,
  badgeColor = "bg-primary text-primary-foreground",
  danger,
}: {
  to: string;
  Icon: typeof Crown;
  label: string;
  sub: string;
  premium?: boolean;
  badge?: string;
  badgeColor?: string;
  danger?: boolean;
}) {
  return (
    <Link
      to={to}
      className="block group transition-colors hover:bg-secondary/40 active:bg-secondary/60"
    >
      <div className="p-4 flex items-center gap-3.5">
        <div
          className={`size-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
            danger
              ? "bg-red-500/10 text-red-500"
              : "bg-secondary text-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div
            className={`font-bold text-sm flex items-center gap-2 truncate ${
              danger ? "text-red-500" : "text-foreground"
            }`}
          >
            <span className="truncate">{label}</span>
            {premium && <Crown className="size-3.5 text-accent animate-pulse shrink-0" />}
            {badge && (
              <span
                className={`text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 shadow-sm shrink-0 ${badgeColor}`}
              >
                {badge}
              </span>
            )}
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground truncate mt-0.5">
            {sub}
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
    </Link>
  );
}
