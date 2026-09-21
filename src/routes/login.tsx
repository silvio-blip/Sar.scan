import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";
import { handleGoogleSignIn } from "@/lib/google-signin";

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
    toast.success("Bem-vindo de volta!");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Premium organic liquid fluid decorative blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

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
              Alimente as suas metas
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Faça login para continuar gerenciando sua nutrição e saúde.
            </p>
          </div>
        </div>

        {/* Auth Mode Toggle Pill */}
        <div className="bg-secondary border border-border/40 p-1.5 rounded-[22px] flex gap-1 shadow-sm max-w-xs mx-auto">
          <button className="flex-1 py-2.5 rounded-[16px] bg-card text-primary font-black text-[11px] tracking-[0.1em] shadow-sm uppercase">
            ENTRAR
          </button>
          <Link
            to="/signup"
            className="flex-1 py-2.5 rounded-[16px] text-muted-foreground/60 text-center font-black text-[11px] tracking-[0.1em] hover:text-primary transition-all uppercase flex items-center justify-center"
          >
            Criar Conta
          </Link>
        </div>

        {/* Credentials Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-5">
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
                  placeholder="Seu e-mail de acesso"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[9px] font-semibold text-accent hover:underline uppercase tracking-wider"
                >
                  Esqueceu?
                </Link>
              </div>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Lock className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Insira sua senha"
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
                  <LogIn className="size-4.5 mr-2 stroke-[2.5]" />
                  Entrar no Aplicativo
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold">
              <span className="bg-card px-3 text-muted-foreground/60 tracking-widest">ou</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <Button
            type="button"
            onClick={async () => {
              try {
                const { error } = await handleGoogleSignIn();
                if (error) throw error;
              } catch (err: any) {
                toast.error(err.message || "Erro ao entrar com Google");
              }
            }}
            className="w-full h-14 rounded-[22px] bg-secondary/80 hover:bg-secondary text-foreground border border-border/80 font-bold tracking-[0.05em] text-[12px] shadow-sm transition-all duration-300 active:scale-98 flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.14C3.15 21.32 7.22 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.24c-.25-.72-.38-1.5-.38-2.24s.13-1.52.38-2.24V6.62H1.18C.43 8.14 0 9.87 0 12s.43 3.86 1.18 5.38l4.09-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.15 2.68 1.18 6.62l4.09 3.14c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continuar com o Google
          </Button>
        </div>

        {/* Footer info and Support Info */}
        <div className="text-center pt-2">
          <p className="text-[10px] tracking-wide text-muted-foreground/65">
            Ao autenticar, você concorda com os nossos{" "}
            <Link
              to="/direitos-privacidade"
              className="text-primary hover:underline font-bold transition-all"
            >
              Termos de Uso e Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}
