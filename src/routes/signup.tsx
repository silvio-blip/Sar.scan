import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, User, Eye, EyeOff, Camera, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha precisa ter no mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { nome } },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Bem-vindo.");
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
          <Link
            to="/login"
            className="flex-1 py-3 rounded-[22px] text-white/40 text-center font-black text-[10px] tracking-[0.2em] hover:text-white transition-all uppercase"
          >
            Entrar
          </Link>
          <button className="flex-1 py-3 rounded-[22px] bg-white text-black font-black text-[10px] tracking-[0.2em] shadow-xl">
            CRIAR CONTA
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="glass rounded-[24px] flex items-center gap-4 px-5 py-4 border-white/5 focus-within:ring-2 ring-white/10 transition-all shadow-inner">
            <User className="size-5 text-white/30 shrink-0" />
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu Nome"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/20 font-medium"
            />
          </div>
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
              placeholder="Senha (mín. 6)"
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
              <UserPlus className="size-5 mr-2" />
            )}
            CRIAR CONTA
          </Button>
        </form>
      </div>
    </div>
  );
}
