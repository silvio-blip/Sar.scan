import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldAlert,
  FileText,
  Shield,
  ArrowLeft,
  Copy,
  Check,
  Scale,
  Database,
  Lock,
  UserCheck,
  AlertOctagon,
  LifeBuoy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/direitos-privacidade")({
  component: DireitosPrivacidadePage,
});

function DireitosPrivacidadePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"termos" | "privacidade">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "privacidade" || tab === "termos") {
        return tab;
      }
    }
    return "termos";
  });
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t("direitos.copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBack = () => {
    if (user) {
      navigate({ to: "/perfil" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start px-4 py-8 md:py-12 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-3xl space-y-6 md:space-y-8 z-10">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full bg-card/65 border border-border shadow-sm hover:bg-secondary size-10 flex items-center justify-center transition-all"
            id="back-button"
          >
            <ArrowLeft className="size-5" />
          </Button>

          <div className="flex items-center gap-2">
            <img
              src="https://i.imgur.com/pwXdv52.png"
              alt="Logo"
              className="size-6 rounded-full object-cover shadow-sm"
            />
            <span
              className="font-black text-xs uppercase tracking-[0.2em] text-primary"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif" }}
            >
              Sar scan
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="rounded-full bg-card border border-border shadow-sm hover:bg-secondary h-10 px-4 flex items-center gap-2 text-xs font-bold transition-all text-primary"
            id="copy-link-button"
          >
            {copied ? (
              <>
                <Check className="size-4 text-emerald-500 animate-pulse" />
                <span>{t("direitos.copied")}</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>{t("direitos.copyLink")}</span>
              </>
            )}
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-3 py-4">
          <h1
            className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif" }}
          >
            {t("direitos.title")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto font-medium leading-relaxed">
            {activeTab === "termos" ? t("direitos.rightsTitle") : t("direitos.privacyTitle")}
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-secondary/80 rounded-[28px] border border-border mt-2 shadow-inner">
          <button
            onClick={() => setActiveTab("termos")}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-[22px] text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "termos"
                ? "bg-card text-foreground shadow-[0_4px_16px_rgba(46,74,59,0.06)] scale-[1.01] font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
            id="tab-terms"
          >
            <FileText className={`size-4.5 ${activeTab === "termos" ? "text-primary" : ""}`} />
            {t("direitos.termsTab")}
          </button>
          <button
            onClick={() => setActiveTab("privacidade")}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-[22px] text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "privacidade"
                ? "bg-card text-foreground shadow-[0_4px_16px_rgba(46,74,59,0.06)] scale-[1.01] font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
            id="tab-privacy"
          >
            <Shield className={`size-4.5 ${activeTab === "privacidade" ? "text-primary" : ""}`} />
            {t("direitos.privacyTab")}
          </button>
        </div>

        {/* Interactive Documents */}
        <AnimatePresence mode="wait">
          {activeTab === "termos" ? (
            <motion.div
              key="termos"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Alert Warning box */}
              <Card className="bg-amber-500/5 rounded-[28px] p-5 border border-amber-500/15 flex items-start gap-4">
                <ShieldAlert className="size-6 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-amber-800">
                    {t("direitos.terms.disclaimerTitle")}
                  </h4>
                  <p className="text-[11px] font-semibold text-amber-700/95 leading-relaxed">
                    {t("direitos.terms.disclaimerText")}
                  </p>
                </div>
              </Card>

              {/* Terms Details */}
              <Card className="bg-card rounded-[36px] p-6 md:p-8 space-y-6 md:space-y-8 border border-border shadow-sm">
                <div className="space-y-6 text-sm font-medium leading-relaxed text-muted-foreground">
                  {/* Section 1 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Scale className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.terms.introTitle")}
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">{t("direitos.terms.introText")}</p>
                  </div>

                  {/* Section 2 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Database className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.terms.serviceTitle")}
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>{t("direitos.terms.serviceText")}</p>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <AlertOctagon className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.terms.accountTitle")}
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>{t("direitos.terms.accountText")}</p>
                    </div>
                  </div>

                  {/* Section 4 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <LifeBuoy className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.terms.ipTitle")}
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">{t("direitos.terms.ipText")}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 text-[10px] md:text-xs text-center font-bold text-muted-foreground flex justify-between items-center px-2">
                  <span>{t("direitos.lastUpdated")}</span>
                  <span className="text-primary font-black">SAR SCAN</span>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="privacidade"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="bg-card rounded-[36px] p-6 md:p-8 space-y-6 md:space-y-8 border border-border shadow-sm">
                <div className="space-y-6 text-sm font-medium leading-relaxed text-muted-foreground">
                  {/* Secao 1 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Database className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.privacy.introTitle")}
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>{t("direitos.privacy.introText")}</p>
                    </div>
                  </div>

                  {/* Secao 2 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Lock className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.privacy.processingTitle")}
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>{t("direitos.privacy.processingText")}</p>
                    </div>
                  </div>

                  {/* Secao 3 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCheck className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.privacy.storageTitle")}
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">{t("direitos.privacy.storageText")}</p>
                  </div>

                  {/* Secao 4 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        {t("direitos.privacy.rightsTitle")}
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">{t("direitos.privacy.rightsText")}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 text-[10px] md:text-xs text-center font-bold text-muted-foreground flex justify-between items-center px-2">
                  <span>{t("direitos.lastUpdated")}</span>
                  <span className="text-primary font-black font-display text-[9px] uppercase tracking-wider">
                    SAR SCAN SECURITY
                  </span>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to Profile bottom button */}
        <div className="w-full text-center pt-2">
          <Button
            onClick={handleBack}
            className="rounded-[28px] h-12 w-full max-w-sm font-bold uppercase tracking-widest text-[10px] bg-primary text-primary-foreground hover:scale-[1.02] active:scale-95 transition-all shadow-[0_8px_20px_rgba(46,74,59,0.15)]"
            id="back-profile-btn"
          >
            {t("direitos.backToProfile")}
          </Button>
        </div>
      </div>
    </div>
  );
}
