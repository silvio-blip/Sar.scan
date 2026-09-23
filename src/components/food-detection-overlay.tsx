import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DetectedFoodTarget } from "@/lib/local-food-detector";

type Props = {
  targets: DetectedFoodTarget[];
  onTargetClick?: (target: DetectedFoodTarget) => void;
};

/**
 * Overlay de Delineamento Físico de Alimentos em Tempo Real
 *
 * Traça o contorno exato da estrutura física/silhueta do alimento (recorte orgânico),
 * sem retângulos e sem nomes, proporcionando feedback visual imediato de que a câmera
 * reconheceu e fixou naquele alimento específico.
 */
export function FoodDetectionOverlay({ targets, onTargetClick }: Props) {
  if (!targets || targets.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          {/* Filtro de Brilho Neon Fluorescente para o Contorno Físico */}
          <filter id="food-silhouette-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.8" result="blur1" />
            <feGaussianBlur stdDeviation="1.8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradiente de iluminação orgânica */}
          <linearGradient id="food-stroke-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>
        </defs>

        <AnimatePresence>
          {targets.map((target) => {
            if (!target.svgPath) return null;

            return (
              <g
                key={target.id}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onTargetClick?.(target)}
              >
                {/* 1. Preenchimento de realce sutil na silhueta interna do alimento */}
                <motion.path
                  d={target.svgPath}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  fill="rgba(16, 185, 129, 0.12)"
                />

                {/* 2. Delineado Externo com Glow (Linha de Contorno Físico Real) */}
                <motion.path
                  d={target.svgPath}
                  initial={{ opacity: 0, pathLength: 0.8 }}
                  animate={{ opacity: 1, pathLength: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  stroke="url(#food-stroke-grad)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  filter="url(#food-silhouette-glow)"
                />

                {/* 3. Linha Fina Central de Alta Definição */}
                <motion.path
                  d={target.svgPath}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  stroke="#ffffff"
                  strokeWidth="0.3"
                  strokeOpacity="0.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />

                {/* 4. Ponto Central de Bloqueio Óptico no Alimento */}
                <circle
                  cx={target.center.x}
                  cy={target.center.y}
                  r="1.2"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="0.3"
                  filter="url(#food-silhouette-glow)"
                />
              </g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
