import React from "react";
import { useTranslation, SUPPORTED_LANGUAGES, type Language } from "@/lib/strings";

interface LanguageSelectorProps {
  variant?: "compact" | "full" | "dropdown" | "pills";
  showGlobe?: boolean;
  className?: string;
}

export function LanguageSelector({
  variant = "pills",
  showGlobe = false,
  className = "",
}: LanguageSelectorProps) {
  const { lang, setLanguage } = useTranslation();

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-1 bg-secondary/70 backdrop-blur-md p-1 rounded-2xl border border-border/50 ${className}`}
      >
        {SUPPORTED_LANGUAGES.map((item) => {
          const langId = item.id || item.code;
          return (
            <button
              key={langId}
              type="button"
              onClick={() => setLanguage(langId)}
              title={item.label}
              className={`px-2 py-1 rounded-xl text-xs font-black uppercase transition-all duration-200 flex items-center gap-1 ${
                lang === langId
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>{item.flag}</span>
              <span className="text-[10px]">{(langId || "").toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={`grid grid-cols-3 gap-2 w-full ${className}`}>
        {SUPPORTED_LANGUAGES.map((item) => {
          const langId = item.id || item.code;
          const active = lang === langId;
          return (
            <button
              key={langId}
              type="button"
              onClick={() => setLanguage(langId)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${
                active
                  ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/20 shadow-sm"
                  : "bg-secondary/40 border-border/50 text-foreground hover:bg-secondary/70"
              }`}
            >
              <span className="text-xl mb-1">{item.flag}</span>
              <span className="text-xs font-black tracking-tight">{item.label}</span>
              <span className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">
                {(langId || "").toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default pills (no globe icon, country/language names displayed)
  return (
    <div
      className={`inline-flex items-center justify-center gap-1 p-1 bg-secondary/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((item) => {
        const langId = item.id || item.code;
        const active = lang === langId;
        return (
          <button
            key={langId}
            type="button"
            onClick={() => setLanguage(langId)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              active
                ? "bg-card text-primary shadow-sm font-black ring-1 ring-primary/20 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            <span className="text-sm">{item.flag}</span>
            <span className="text-[11px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
