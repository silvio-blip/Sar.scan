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

export const Route = createFileRoute("/_app/perfil/alterar-senha")({ component: AlterarSenha });

function AlterarSenha() {
  const { profile } = useAuth();
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
    // Re-autentica para validar a senha atual
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/perfil">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">Alterar Senha</h1>
      </div>
      <Card className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary-soft flex items-center justify-center">
          <Lock className="size-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold">Segurança da conta</div>
          <div className="text-xs text-muted-foreground">Use ao menos 6 caracteres</div>
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Senha atual</Label>
          <Input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Confirmar nova senha</Label>
          <Input type="password" value={conf} onChange={(e) => setConf(e.target.value)} />
        </div>
      </Card>
      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin mr-2" />}Atualizar Senha
      </Button>
    </div>
  );
}
