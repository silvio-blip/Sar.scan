import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface CreditDisplayProps {
  value: number | string;
}

export function CreditDisplay({ value }: CreditDisplayProps) {
  const [prevValue, setPrevValue] = useState<number | string>(value);
  const [animating, setAnimating] = useState(false);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setPrevValue(value);
      return;
    }

    if (value !== prevValue) {
      const diff =
        typeof value === "number" && typeof prevValue === "number" ? value - prevValue : 0;
      // Se a diferença for grande (ex: +30, +150), não mostramos a animação flutuante
      // mas ainda atualizamos o número com a animação de troca.
      setAnimating(Math.abs(diff) > 0 && Math.abs(diff) < 10);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setAnimating(false);
        setPrevValue(value);
      }, 1000);
    }
  }, [value, prevValue]);

  const isUnlimited = value === Infinity || value === "∞";
  const numValue = typeof value === "number" ? value : 0;
  const numPrev = typeof prevValue === "number" ? prevValue : 0;
  const diff = typeof value === "number" && typeof prevValue === "number" ? value - prevValue : 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={String(value)}
          initial={{ y: diff < 0 ? -10 : 10, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: diff < 0 ? 10 : -10, opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-inherit font-inherit"
        >
          {isUnlimited ? "∞" : value}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {animating && diff !== 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 1, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 2], y: diff < 0 ? 20 : -20 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute pointer-events-none whitespace-nowrap font-black text-[10px] ${
              diff < 0 ? "text-red-500" : "text-green-500"
            }`}
          >
            {diff < 0 ? `${diff}` : `+${diff}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
