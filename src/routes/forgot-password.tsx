import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Invoke custom Supabase Edge Function
      const { data, error } = await supabase.functions.invoke("password-reset", {
        body: { action: "request", email: email.trim() },
      });

      if (error || (data && !data.success)) {
        toast.error(error?.message || data?.error || "Erro ao solicitar recuperação de senha.");
        setLoading(false);
        return;
      }

      toast.success("Código de recuperação de 15 dígitos enviado ao seu e-mail!");
      // Save email locally to auto-fill the confirm page
      sessionStorage.setItem("reset_email", email.trim());

      // Delay navigation slightly for a polished feel
      setTimeout(() => {
        nav({ to: "/reset-password" });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
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
        {/* Navigation Back Link */}
        <div className="flex justify-start">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-all"
          >
            <div className="size-8 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors">
              <ArrowLeft className="size-4 text-primary" />
            </div>
            Voltar para Login
          </Link>
        </div>

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
              Recuperar Senha
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Inicie a recuperação de acesso para o seu utilizador.
            </p>
          </div>
        </div>

        {/* Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-6">
            <p className="text-xs text-muted-foreground/90 leading-relaxed text-center">
              Insira o e-mail associado à sua conta para receber um código de segurança e redefinir o seu acesso.
            </p>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                E-mail Cadastrado
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Mail className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: joao@gmail.com"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-[22px] bg-primary text-primary-foreground hover:bg-primary/95 font-black tracking-[0.1em] text-[11px] shadow-md shadow-primary/10 transition-all duration-300 active:scale-98 flex items-center justify-center uppercase cursor-pointer"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Send className="size-4 mr-2 stroke-[2.5]" />
                  Enviar Código Seguro
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center pt-2">
          <span className="text-[10px] text-muted-foreground/60">
            A segurança da sua conta é nossa prioridade absoluta.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
