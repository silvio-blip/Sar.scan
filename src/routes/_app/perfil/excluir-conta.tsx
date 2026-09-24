import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Trash2, X, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/excluir-conta")({
  component: ExcluirContaPage,
});

export default function ExcluirContaPage() {
  const { user, profile, refresh } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const deletionRequestedAt = profile?.deletion_requested_at;
  const isPendingDeletion = !!deletionRequestedAt;

  const handleRequestDeletion = async () => {
    if (!profile || !user?.email) return;

    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user to verify password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (verifyError) {
        toast.error("Senha incorreta.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ deletion_requested_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success(t("subpages.deleteAccount.warning"));
      await refresh();
    } catch (err) {
      toast.error(t("common.error"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ deletion_requested_at: null })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success(t("common.success"));
      await refresh();
    } catch (err) {
      toast.error(t("common.error"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 p-6 max-w-md mx-auto">
      <div className="flex items-center gap-4">
        <Link
          to="/perfil"
          className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
          {t("subpages.deleteAccount.title")}
        </h1>
      </div>

      {isPendingDeletion ? (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="size-5 shrink-0" />
            <h2 className="font-semibold text-sm">{t("subpages.deleteAccount.title")}</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("subpages.deleteAccount.warning")}
          </p>
          <Button
            onClick={handleCancelDeletion}
            disabled={loading}
            variant="outline"
            className="w-full rounded-xl border-yellow-500/30 text-xs font-bold"
          >
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="size-5 shrink-0" />
              <h2 className="font-semibold text-sm">{t("common.error")}</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("subpages.deleteAccount.warning")}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">
                {t("auth.password")}
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground">
                {t("auth.confirmPassword")}
              </Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth.confirmPasswordPlaceholder")}
                className="rounded-xl mt-1"
              />
            </div>

            <Button
              onClick={handleRequestDeletion}
              disabled={loading || !password || !confirmPassword}
              variant="destructive"
              className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-wider mt-4"
            >
              <Trash2 className="size-4 mr-2" />
              {t("subpages.deleteAccount.confirmButton")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
