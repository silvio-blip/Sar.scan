import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";

const NUTRITION_TIPS = [
  "Beba água antes das refeições para auxiliar na digestão e aumentar a sensação de saciedade.",
  "Priorize alimentos inteiros e minimamente processados em vez de ultraprocessados e empacotados.",
  "Mastigue devagar: o cérebro leva cerca de 20 minutos para perceber que você está satisfeito.",
  "Inclua fontes de fibras saudáveis como aveia, chia ou linhaça no seu pequeno-almoço.",
  "Adicione cor ao seu prato: diferentes cores nas verduras indicam uma maior variedade de nutrientes e antioxidantes.",
  "A gordura boa faz bem! Consuma fontes saudáveis como abacate, azeite virgem extra e frutos secos com moderação.",
  "Evite açúcar refinado e refrigerantes; prefira sumos naturais de fruta diluídos ou águas aromatizadas.",
  "A proteína é essencial para a massa muscular e saciedade. Garanta uma porção nas suas refeições principais.",
  "Substitua os cereais refinados (como arroz branco e massas tradicionais) pelas suas versões integrais.",
  "Não confunda sede com fome: quando sentir um desejo repentino, beba um copo de água primeiro.",
  "Prepare as suas próprias refeições sempre que possível para ter total controle sobre os ingredientes.",
  "A qualidade do sono afeta a regulação do apetite e hormonas de saciedade. Durma pelo menos 7 a 8 horas.",
  "Evite comer a assistir televisão ou a mexer no telemóvel: a distração sabota a percepção de saciedade.",
  "Planeie as suas refeições da semana para evitar escolhas impulsivas e compras desnecessárias no supermercado.",
];

export function NutritionTip() {
  const [tipIndex, setTipIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    // Seed standard of the day so it changes daily, but stays consistent on that day
    const todayNum = new Date().getDate();
    const initialIndex = todayNum % NUTRITION_TIPS.length;
    setTipIndex(initialIndex);
  }, []);

  const handleNextTip = () => {
    setIsRotating(true);
    setTimeout(() => {
      setTipIndex((prev) => (prev + 1) % NUTRITION_TIPS.length);
      setIsRotating(false);
    }, 440);
  };

  return (
    <div className="w-full bg-primary/5 hover:bg-primary/[0.08] border border-primary/10 rounded-[28px] p-5 transition-all duration-300 relative overflow-hidden group/tip">
      {/* Decorative background glow */}
      <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-primary/5 blur-xl rounded-full pointer-events-none group-hover/tip:bg-primary/10 transition-colors" />

      <div className="flex items-start justify-between gap-3 relative z-10 w-full">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary p-2 rounded-xl flex items-center justify-center shrink-0">
            <Lightbulb className="size-4 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
              Nutrição do Dia
            </span>
            <span className="text-xs font-bold text-foreground">Dica Saudável</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextTip}
          className="p-1.5 hover:bg-primary/15 active:scale-90 text-primary/60 hover:text-primary rounded-lg transition-all flex items-center justify-center"
          title="Ver outra dica"
        >
          <RefreshCw className={`size-3.5 ${isRotating ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-4 relative z-10 min-h-[52px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] leading-relaxed text-muted-foreground font-medium italic"
          >
            "{NUTRITION_TIPS[tipIndex]}"
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[9px] font-black text-primary/60 tracking-wider uppercase relative z-10">
        <Sparkles className="size-3 shrink-0 text-amber-500 animate-bounce" />
        <span>Viver melhor começa no prato</span>
      </div>
    </div>
  );
}
