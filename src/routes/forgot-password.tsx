import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Email enviado!");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in duration-700">
        <Link
          to="/login"
          className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
        >
          <div className="size-10 rounded-xl glass flex items-center justify-center border-white/5 shadow-xl">
            <ArrowLeft className="size-4" />
          </div>
          Voltar para login
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-display font-black tracking-tight text-white">
            Recuperar Senha
          </h1>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
            Enviaremos um link para resetar sua senha
          </p>
        </div>

        {sent ? (
          <Card className="glass rounded-[32px] p-8 border-white/5 shadow-2xl text-center space-y-4">
            <div className="size-16 rounded-full bg-white/10 mx-auto flex items-center justify-center">
              <ArrowLeft className="size-8 text-white rotate-180" />
            </div>
            <p className="text-sm font-medium text-white/70 leading-relaxed">
              Se o email existir na nossa base, você receberá um link em breve.
            </p>
          </Card>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[10px] font-black uppercase tracking-widest ml-1"
              >
                Email Cadastrado
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black tracking-[0.2em] text-[11px] shadow-xl shadow-white/5 transition-all active:scale-95"
            >
              {loading && <Loader2 className="size-5 animate-spin mr-2" />}ENVIAR LINK
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
