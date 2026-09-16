import { motion } from "motion/react";

interface GaugeProps {
  current: number;
  target: number;
  label?: string;
}

export function Gauge({ current, target, label = "Metas" }: GaugeProps) {
  const percentage = Math.min(100, Math.max(0, (current / target) * 100));
  const radius = 100;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // Semicircle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-72 h-40 overflow-hidden">
        <svg viewBox={`0 0 ${radius * 2} ${radius}`} className="w-full h-full transform">
          {/* Background track */}
          <path
            d={`M ${strokeWidth / 2},${radius} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 - strokeWidth / 2},${radius}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-secondary/50"
          />
          {/* Progress bar */}
          <motion.path
            d={`M ${strokeWidth / 2},${radius} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 - strokeWidth / 2},${radius}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-primary"
            style={{
              filter: "drop-shadow(0 4px 10px oklch(0.36 0.05 135 / 10%))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <span className="text-muted-foreground text-[8px] font-black uppercase tracking-[0.4em] mb-1">
            {label}
          </span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-4xl font-display font-black text-foreground tracking-tighter">
              {current}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">
              / {target} kcal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
