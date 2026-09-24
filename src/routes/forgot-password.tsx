import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { SarLogo } from "@/components/sar-logo";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/strings";
import { LanguageSelector } from "@/components/language-selector";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
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
        toast.error(error?.message || data?.error || t("common.error"));
        setLoading(false);
        return;
      }

      // Save email locally to auto-fill the confirm page
      sessionStorage.setItem("reset_email", email.trim());

      if (data && (data.warning === "smtp_missing" || data.warning === "smtp_failed")) {
        if (data.code) {
          sessionStorage.setItem("reset_code", data.code);
          try {
            await navigator.clipboard.writeText(data.code);
            toast.success(t("common.copied"));
          } catch (clipErr) {
            console.warn("Auto-copy blocked: ", clipErr);
          }
        }
        toast.info(`Código gerado: ${data.code || ""}`, {
          duration: 10000,
        });
      } else {
        sessionStorage.removeItem("reset_code");
        toast.success(t("auth.sendResetEmail"));
      }

      // Delay navigation slightly for a polished feel
      setTimeout(() => {
        nav({ to: "/reset-password" });
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Premium organic liquid fluid decorative blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

      {/* Top bar with back link and LanguageSelector */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-20">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 hover:text-primary transition-all"
        >
          <div className="size-8 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors">
            <ArrowLeft className="size-4 text-primary" />
          </div>
          {t("auth.backToLogin")}
        </Link>
        <LanguageSelector variant="compact" />
      </div>

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
              {t("auth.resetPasswordTitle")}
            </h2>
            <p className="text-xs text-muted-foreground/80 max-w-xs mx-auto">
              {t("auth.resetPasswordSubtitle")}
            </p>
          </div>
        </div>

        {/* Credentials Form Box */}
        <div className="bg-card border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-xl glow-soft">
          <form onSubmit={onSubmit} className="space-y-5">
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
                  <Send className="size-4 mr-2" />
                  {t("auth.sendResetEmail")}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
