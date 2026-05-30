import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2, X } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/perfil/excluir-conta")({
  component: ExcluirContaPage,
});

export default function ExcluirContaPage() {
  const { profile, refresh, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const deletionRequestedAt = profile?.deletion_requested_at;
  const isPendingDeletion = !!deletionRequestedAt;

  const handleRequestDeletion = async () => {
    if (!profile) return;
    setLoading(true);
    try {
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
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Excluir Conta</h1>
      
      {isPendingDeletion ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="size-5" />
            <h2 className="font-semibold">Exclusão pendente</h2>
          </div>
          <p className="text-sm text-yellow-700">
            Sua conta será permanentemente excluída em {new Date(new Date(deletionRequestedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
            Se você mudar de ideia, pode cancelar a solicitação até lá.
          </p>
          <Button onClick={handleCancelDeletion} disabled={loading} variant="outline" className="w-full">
            <X className="size-4 mr-2" />
            Cancelar Exclusão
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Tem certeza de que deseja excluir sua conta? Esta ação removerá todos os seus dados permanentemente após 3 dias.
          </p>
          <Button onClick={handleRequestDeletion} disabled={loading} variant="destructive" className="w-full">
            <Trash2 className="size-4 mr-2" />
            Solicitar Exclusão
          </Button>
        </div>
      )}
    </div>
  );
}
