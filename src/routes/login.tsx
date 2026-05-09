import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, LogIn, Eye, EyeOff, Camera } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) nav({ to: "/" });
  }, [user, authLoading, nav]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo!");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex flex-col items-center gap-6">
          <div className="size-20 rounded-3xl glass flex items-center justify-center shadow-2xl shadow-white/5 border-white/10 border relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <Camera className="size-10 text-white relative z-10" />
          </div>
          <SarLogo />
        </div>

        <div className="glass-strong rounded-[28px] p-1.5 flex gap-1 border-white/5 shadow-2xl">
          <button className="flex-1 py-3 rounded-[22px] bg-white text-black font-black text-[10px] tracking-[0.2em] shadow-xl">
            ENTRAR
          </button>
          <Link
            to="/signup"
            className="flex-1 py-3 rounded-[22px] text-white/40 text-center font-black text-[10px] tracking-[0.2em] hover:text-white transition-all uppercase"
          >
            Criar Conta
          </Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="glass rounded-[24px] flex items-center gap-4 px-5 py-4 border-white/5 focus-within:ring-2 ring-white/10 transition-all shadow-inner">
            <Mail className="size-5 text-white/30 shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/20 font-medium"
            />
          </div>
          <div className="glass rounded-[24px] flex items-center gap-4 px-5 py-4 border-white/5 focus-within:ring-2 ring-white/10 transition-all shadow-inner">
            <Lock className="size-5 text-white/30 shrink-0" />
            <input
              type={show ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/20 font-medium"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="text-white/30 hover:text-white transition-colors"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black tracking-[0.2em] text-[11px] shadow-xl shadow-white/5 transition-all active:scale-95"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <LogIn className="size-5 mr-2" />
            )}
            AUTENTICAR
          </Button>
        </form>

        <div className="text-center pt-2">
          <Link
            to="/forgot-password"
            size="sm"
            className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
