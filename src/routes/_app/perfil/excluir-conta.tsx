import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Trash2, X, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/perfil/excluir-conta")({
  component: ExcluirContaPage,
});

export default function ExcluirContaPage() {
  const { user, profile, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const deletionRequestedAt = profile?.deletion_requested_at;
  const isPendingDeletion = !!deletionRequestedAt;

  const handleRequestDeletion = async () => {
    if (!profile || !user?.email) return;

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
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
      toast.success("Solicitação de exclusão recebida. Você tem 3 dias para cancelar.");
      await refresh();
    } catch (err) {
      toast.error("Erro ao solicitar exclusão.");
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
      toast.success("Solicitação de exclusão cancelada.");
      await refresh();
    } catch (err) {
      toast.error("Erro ao cancelar exclusão.");
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
          Excluir Conta
        </h1>
      </div>

      {isPendingDeletion ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="size-5" />
            <h2 className="font-semibold">Exclusão pendente</h2>
          </div>
          <p className="text-sm text-yellow-700">
            Sua conta será permanentemente excluída em{" "}
            {new Date(
              new Date(deletionRequestedAt).getTime() + 3 * 24 * 60 * 60 * 1000,
            ).toLocaleDateString()}
            . Se você mudar de ideia, pode cancelar a solicitação até lá.
          </p>
          <Button
            onClick={handleCancelDeletion}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            <X className="size-4 mr-2" />
            Cancelar Exclusão
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Tem certeza de que deseja excluir sua conta? Esta ação removerá todos os seus dados
            permanentemente após 3 dias.
          </p>

          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Insira sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirmar Senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua senha"
            />
          </div>

          <Button
            onClick={handleRequestDeletion}
            disabled={loading}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="size-4 mr-2" />
            Solicitar Exclusão
          </Button>
        </div>
      )}
    </div>
  );
}
