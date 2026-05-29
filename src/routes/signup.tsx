import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, User, Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";

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
      toast.error("A senha precisa ter no mínimo 6 caracteres");
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
    toast.success("Conta criada! Bem-vindo ao sar.scan.");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Premium organic liquid fluid decorative blobs */}
      <div className="absolute top-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md space-y-8 z-10"
      >
        {/* Logo and Greeting Header */}
        <div className="flex flex-col items-center gap-6 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="p-1"
          >
            <SarLogo size="lg" align="center" />
          </motion.div>
          <div className="space-y-1">
            <h2 className="text-xl font-display font-black tracking-tight text-primary">
              Comece a sua jornada
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Crie a sua conta gratuita hoje e tenha controle total do seu bem-estar.
            </p>
          </div>
        </div>

        {/* Auth Mode Toggle Pill */}
        <div className="bg-secondary border border-border/40 p-1.5 rounded-[22px] flex gap-1 shadow-sm max-w-xs mx-auto">
          <Link
            to="/login"
            className="flex-1 py-2.5 rounded-[16px] text-muted-foreground/60 text-center font-black text-[11px] tracking-[0.1em] hover:text-primary transition-all uppercase flex items-center justify-center"
          >
            Entrar
          </Link>
          <button className="flex-1 py-2.5 rounded-[16px] bg-card text-primary font-black text-[11px] tracking-[0.1em] shadow-sm uppercase">
            CRIAR CONTA
          </button>
        </div>

        {/* Credentials Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                Nome Completo
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <User className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome e sobrenome"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                E-mail
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Mail className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu melhor e-mail"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                Senha de Acesso
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Lock className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="text-primary/40 hover:text-primary transition-colors focus:outline-none"
                >
                  {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 mt-2 rounded-[22px] bg-primary text-primary-foreground hover:bg-primary/95 font-black tracking-[0.1em] text-[11px] shadow-md shadow-primary/10 transition-all duration-300 active:scale-98 flex items-center justify-center uppercase cursor-pointer"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="size-4.5 mr-2 stroke-[2.5]" />
                  Criar Minha Conta
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer info and Support Info */}
        <div className="text-center pt-2">
          <p className="text-[10px] tracking-wide text-muted-foreground/65">
            Ao se registrar, você concorda com nossos{" "}
            <Link
              to="/direitos-privacidade"
              className="text-primary hover:underline font-bold transition-all"
            >
              Termos de Uso
            </Link>{" "}
            e{" "}
            <Link
              to="/direitos-privacidade"
              className="text-primary hover:underline font-bold transition-all"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}
