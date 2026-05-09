import { useEffect } from "react";

export function ScanningOverlay({ photo, onCancel }: { photo: string; onCancel?: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 bg-[#023b12]/95 backdrop-blur-2xl flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
      <style>{`
        @keyframes scan-line {
          0% { top: 0%; opacity: 0.5; }
          50% { top: calc(100% - 2px); opacity: 1; }
          100% { top: 0%; opacity: 0.5; }
        }
      `}</style>

      <div className="w-full max-w-sm space-y-8 flex flex-col items-center">
        <div className="text-center space-y-2">
          <h2 className="font-display text-3xl font-black text-white">Analisando...</h2>
          <p className="text-[10px] text-sage tracking-[0.25em] uppercase font-bold">
            Identificando Nutrientes
          </p>
        </div>

        <div className="relative aspect-[4/5] w-full rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
          <img
            src={photo}
            alt="scan"
            className="absolute inset-0 w-full h-full object-cover grayscale-[0.3]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

          {/* Brackets */}
          <div className="absolute inset-8 pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-white rounded-tl-2xl opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-white rounded-tr-2xl opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-white rounded-bl-2xl opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-white rounded-br-2xl opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
          </div>

          {/* Scan line */}
          <div
            className="absolute left-0 right-0 h-[3px] bg-white shadow-[0_0_25px_#fff,0_0_50px_#fff] z-10"
            style={{
              animation: "scan-line 3s ease-in-out infinite",
            }}
          />
        </div>

        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-2 rounded-full bg-sage"
              style={{ animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
