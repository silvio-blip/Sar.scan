import React, { useEffect, useState } from "react";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(false);

  const handleSkip = () => {
    setGone(true);
    setTimeout(onDone, 300);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setGone(true);
      setTimeout(onDone, 500);
    }, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      onClick={handleSkip}
      style={{ perspective: "2000px" }}
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-emerald-950 via-zinc-950 to-black flex items-center justify-center cursor-pointer select-none transition-opacity duration-700 overflow-hidden ${
        gone ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <style>{`
        @keyframes introCardFly {
          0% {
            transform: translate3d(var(--startX, 0px), var(--startY, 0px), -1500px) rotateX(15deg) rotateY(25deg) scale(0);
            opacity: 0;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translate3d(0, 0, 0) rotateX(0) rotateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>

      {/* Background ambient light */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15),transparent_70%)] pointer-events-none" />

      {/* Floating 3D Cards Storm Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { text: "🥗 Nutrição Inteligente", startX: "-400px", startY: "-300px", delay: "0s" },
          { text: "⚡ IA Personalizada", startX: "400px", startY: "-250px", delay: "0.1s" },
          { text: "📊 Diário & Metas", startX: "-500px", startY: "300px", delay: "0.2s" },
          { text: "🌿 Receitas Saudáveis", startX: "450px", startY: "350px", delay: "0.3s" },
        ].map((item, idx) => (
          <div
            key={idx}
            style={
              {
                animation: `introCardFly 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                animationDelay: item.delay,
                "--startX": item.startX,
                "--startY": item.startY,
              } as React.CSSProperties
            }
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-white/90 text-sm font-semibold shadow-2xl"
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* Main Logo Card */}
      <div
        style={
          {
            animation: "introCardFly 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            animationDelay: "0.15s",
            "--startX": "0px",
            "--startY": "100px",
          } as React.CSSProperties
        }
        className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-[36px] bg-white/10 dark:bg-zinc-900/80 border border-white/20 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-center max-w-sm mx-4"
      >
        <div className="size-20 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)]">
          <span className="text-4xl font-black text-white">s</span>
        </div>
        <div className="space-y-1">
          <div className="text-4xl md:text-5xl font-black text-white tracking-tighter">
            sar<span className="text-emerald-400">.</span>scan
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-400/90 font-extrabold">
            Nutrição Inteligente
          </p>
        </div>
        <div className="pt-2 text-[11px] text-zinc-400 font-medium animate-pulse">
          Toque para entrar
        </div>
      </div>
    </div>
  );
}
