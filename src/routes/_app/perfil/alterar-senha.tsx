import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/perfil/alterar-senha")({ component: AlterarSenha });

function AlterarSenha() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (nova.length < 6) return toast.error("A nova senha deve ter ao menos 6 caracteres");
    if (nova !== conf) return toast.error("As senhas não coincidem");
    if (!profile?.email) return toast.error("Sessão inválida");
    setSaving(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: atual,
    });
    if (signErr) {
      setSaving(false);
      return toast.error("Senha atual incorreta");
    }
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha alterada com sucesso");
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
          {t("subpages.changePassword.title")}
        </h1>
      </div>
      <Card className="bg-card rounded-[24px] p-5 flex items-center gap-4 border border-border shadow-sm text-foreground">
        <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center">
          <Lock className="size-5 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-bold text-base text-foreground">
            {t("subpages.changePassword.cardTitle")}
          </div>
          <div className="text-xs text-muted-foreground/80">
            {t("subpages.changePassword.cardSub")}
          </div>
        </div>
      </Card>
      <Card className="bg-card rounded-[32px] p-6 space-y-5 border border-border shadow-sm text-foreground">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
            {t("subpages.changePassword.current")}
          </Label>
          <Input
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
            {t("subpages.changePassword.new")}
          </Label>
          <Input
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
            {t("subpages.changePassword.confirm")}
          </Label>
          <Input
            type="password"
            value={conf}
            onChange={(e) => setConf(e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
      </Card>
      <Button
        className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95"
        onClick={submit}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin mr-2" />}
        {t("subpages.changePassword.button")}
      </Button>
    </div>
  );
}
