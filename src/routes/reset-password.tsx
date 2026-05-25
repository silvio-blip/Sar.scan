import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, ShieldAlert, KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion, AnimatePresence } from "motion/react";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("reset_email");
    if (savedEmail) {
      setEmail(savedEmail);
    } else {
      // If no email, send them back to start
      toast.error("Por favor, inicie a solicitação informando seu e-mail.");
      nav({ to: "/forgot-password" });
    }
  }, [nav]);

  const onVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 15) {
      toast.error("O código de segurança precisa ter exatamente 15 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("password-reset", {
        body: {
          action: "verify",
          email: email.trim(),
          code: code.trim(),
        },
      });

      if (error || (data && !data.success)) {
        toast.error(error?.message || data?.error || "Código inválido ou expirado.");
        setLoading(false);
        return;
      }

      toast.success("Código de segurança validado com sucesso!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem!");
      return;
    }
    if (password.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("password-reset", {
        body: {
          action: "confirm",
          email: email.trim(),
          code: code.trim(),
          password: password,
        },
      });

      if (error || (data && !data.success)) {
        toast.error(error?.message || data?.error || "Erro ao redefinir a senha.");
        setLoading(false);
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      sessionStorage.removeItem("reset_email");

      setTimeout(() => {
        nav({ to: "/login" });
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative blobs */}
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
              {step === 1 ? "Inserir Código" : "Nova Senha"}
            </h2>
            <p className="text-xs text-muted-foreground/80">
              {step === 1
                ? "Digite o código de 15 dígitos enviado ao seu e-mail."
                : "Selecione uma senha segura de acesso."}
            </p>
          </div>
        </div>

        {/* Email read-only badge indicating locked target account */}
        <div className="bg-secondary/30 ring-1 ring-border/40 rounded-[20px] p-4 text-center space-y-1 animate-in fade-in duration-300">
          <span className="text-[10px] uppercase font-black tracking-widest text-primary/60 block">
            Conta em recuperação
          </span>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-secondary border border-border/80 rounded-full font-bold text-xs text-foreground shrink-0 select-none cursor-not-allowed">
            <Mail className="size-3.5 text-primary/60 shrink-0" />
            <span>{email || "carregando..."}</span>
          </div>
        </div>

        {/* Credentials Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft min-h-[220px] transition-all relative">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step-code"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
                onSubmit={onVerifyCode}
                className="space-y-5"
              >
                {/* 15-character Secure Code */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                    Código de Segurança
                  </label>
                  <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <ShieldAlert className="size-4.5 text-primary/45 shrink-0" />
                    <input
                      type="text"
                      required
                      maxLength={15}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Insira o código de 15 dígitos"
                      className="flex-1 bg-transparent outline-none text-sm font-mono tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/45 text-foreground font-bold text-center uppercase"
                    />
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
                      <KeyRound className="size-4.5 mr-2 stroke-[2.5]" />
                      Validar Código
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="step-password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
                onSubmit={onResetPassword}
                className="space-y-5"
              >
                {/* New Password Field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                    Nova Senha
                  </label>
                  <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <Lock className="size-4.5 text-primary/45 shrink-0" />
                    <input
                      type={show ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <Lock className="size-4.5 text-primary/45 shrink-0" />
                    <input
                      type={show ? "text" : "password"}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                    />
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
                      <CheckCircle className="size-4.5 mr-2 stroke-[2.5]" />
                      Salvar Nova Senha
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info/Resend */}
        {step === 1 && (
          <div className="text-center pt-2 flex flex-col items-center gap-1.5 animate-in fade-in duration-300">
            <p className="text-[10px] tracking-wide text-muted-foreground/65">
              Não recebeu o código? Verifique sua caixa de spam ou tente reenviar.
            </p>
            <Link
              to="/forgot-password"
              className="text-[9px] font-black uppercase tracking-wider text-accent hover:underline"
            >
              Pedir novo código
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
