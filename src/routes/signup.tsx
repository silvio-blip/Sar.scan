import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, UserPlus, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/strings";
import { LanguageSelector } from "@/components/language-selector";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error(t("auth.acceptTermsRequired"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (data?.user) {
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          nome,
          email,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Erro ao sincronizar nome do perfil:", err);
      }
    }

    setLoading(false);
    toast.success(t("auth.accountCreated"));
    nav({ to: "/onboarding" });
  };

  useEffect(() => {
    if (!authLoading && user) nav({ to: "/" });
  }, [user, authLoading, nav]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Premium organic liquid fluid decorative blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md space-y-5 z-10"
      >
        {/* Logo and Greeting Header */}
        <div className="flex flex-col items-center gap-4 text-center">
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
              {t("auth.signUpTitle")}
            </h2>
            <p className="text-xs text-muted-foreground/80">{t("auth.signUpSubtitle")}</p>
          </div>
        </div>

        {/* Centralized Language Selector directly centered between subtitle and auth toggle */}
        <div className="flex items-center justify-center w-full">
          <LanguageSelector variant="pills" />
        </div>

        {/* Auth Mode Toggle Pill */}
        <div className="bg-secondary border border-border/40 p-1.5 rounded-[22px] flex gap-1 shadow-sm max-w-xs mx-auto w-full">
          <Link
            to="/login"
            className="flex-1 py-2.5 rounded-[16px] text-muted-foreground/60 text-center font-black text-[11px] tracking-[0.1em] hover:text-primary transition-all uppercase flex items-center justify-center"
          >
            {t("auth.tabLogin")}
          </Link>
          <button className="flex-1 py-2.5 rounded-[16px] bg-card text-primary font-black text-[11px] tracking-[0.1em] shadow-sm uppercase">
            {t("auth.tabSignup")}
          </button>
        </div>

        {/* Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                {t("auth.name")}
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <User className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                {t("auth.email")}
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Mail className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/45 text-foreground font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-2">
                {t("auth.password")}
              </label>
              <div className="bg-secondary/40 border border-border/50 rounded-[18px] flex items-center gap-3.5 px-4.5 py-4 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Lock className="size-4.5 text-primary/45 shrink-0" />
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
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

            {/* Terms and Privacy Checkbox */}
            <div className="pt-2 px-1">
              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 size-4 rounded-md border-border/60 text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                />
                <span className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                  {t("auth.termsAgreement")}{" "}
                  <Link
                    to="/direitos-privacidade"
                    className="text-primary hover:underline font-bold transition-all"
                  >
                    {t("auth.termsLink")}
                  </Link>
                  .
                </span>
              </label>
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
                  {t("auth.signupButton")}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
