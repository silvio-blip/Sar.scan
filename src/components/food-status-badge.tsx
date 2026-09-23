import React from "react";
import { motion } from "motion/react";
import type { FoodDetectionStatus } from "@/lib/local-food-detector";

type Props = {
  status: FoodDetectionStatus | null;
  scanning: boolean;
};

/**
 * Micro Indicador de Detecção de Alimentos
 *
 * Bolinha ultra-compacta no canto superior esquerdo da área da câmera:
 * - Verde Ativado (Micro LED Verde com pulso sutil): Alimento detectado.
 * - Cinza Desativado (Micro LED Cinza neutro): Nenhum alimento detectado.
 */
export function FoodDetectionStatusBadge({ status, scanning }: Props) {
  const isFoodDetected = !scanning && !!status?.hasFood;

  return (
    <div className="absolute top-3.5 left-3.5 z-30 pointer-events-none">
      <div
        className={`relative flex items-center justify-center p-1 rounded-full backdrop-blur-md border transition-all duration-300 ${
          isFoodDetected
            ? "bg-emerald-950/70 border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            : "bg-zinc-950/40 border-white/10"
        }`}
        title={isFoodDetected ? "Alimento detectado" : "Nenhum alimento detectado"}
      >
        {isFoodDetected ? (
          <motion.div
            key="active-micro-dot"
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            className="relative flex size-2 items-center justify-center"
          >
            {/* Pulso Verde Compacto */}
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          </motion.div>
        ) : (
          <div className="size-2 rounded-full bg-zinc-400/40 transition-colors duration-300" />
        )}
      </div>
    </div>
  );
}

export default FoodDetectionStatusBadge;
