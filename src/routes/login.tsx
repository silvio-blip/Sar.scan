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
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) nav({ to: "/" });
  }, [user, authLoading, nav]);

  const onGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await handleGoogleSignIn();
      if (error) {
        if (error.message !== "cancelled") {
          toast.error(error.message || "Erro ao autenticar com o Google.");
        }
      } else {
        toast.success("Autenticação com o Google realizada com sucesso!");
        nav({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao conectar com o Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

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
              disabled={loading || googleLoading}
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

            {/* Separador */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <span className="relative bg-card px-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                ou continue com
              </span>
            </div>

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              disabled={loading || googleLoading}
              onClick={onGoogleLogin}
              className="w-full h-14 rounded-[22px] border-border/60 bg-secondary/30 hover:bg-secondary/70 text-foreground font-black tracking-[0.05em] text-xs transition-all duration-300 active:scale-98 flex items-center justify-center gap-3 cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <>
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continuar com o Google
                </>
              )}
            </Button>
          </form>
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
