import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Senhas não conferem");
      return;
    }
    if (password.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada!");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in duration-700">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-black tracking-tight text-white text-center">
            Nova Senha
          </h1>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/40 text-center">
            Escolha sua nova credencial de acesso
          </p>
        </div>

        <Card className="glass rounded-[32px] p-8 border-white/5 shadow-2xl relative overflow-hidden">
          <form onSubmit={onSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="p1" className="text-[10px] font-black uppercase tracking-widest ml-1">
                Nova Senha
              </Label>
              <Input
                id="p1"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2" className="text-[10px] font-black uppercase tracking-widest ml-1">
                Confirmar Senha
              </Label>
              <Input
                id="p2"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-14 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black tracking-[0.2em] text-[11px] shadow-xl shadow-white/5 transition-all active:scale-95"
            >
              {loading && <Loader2 className="size-5 animate-spin mr-2" />}ALTERAR SENHA
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
