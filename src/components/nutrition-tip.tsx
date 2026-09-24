import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useTranslation, type SupportedLang } from "@/lib/strings";

const NUTRITION_TIPS_BY_LANG: Record<SupportedLang, string[]> = {
  pt: [
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
  ],
  en: [
    "Drink water before meals to support digestion and increase feelings of fullness.",
    "Prioritize whole, minimally processed foods over ultra-processed and packaged goods.",
    "Chew slowly: it takes about 20 minutes for your brain to realize you are satisfied.",
    "Include healthy fiber sources like oats, chia, or flaxseed in your breakfast.",
    "Add color to your plate: different veggie colors signify a wider variety of antioxidants and vitamins.",
    "Healthy fats are beneficial! Enjoy avocados, extra virgin olive oil, and nuts in moderation.",
    "Avoid refined sugar and soda; choose diluted fresh fruit juice or infused water instead.",
    "Protein is essential for muscle mass and satiety. Include a source in your main meals.",
    "Replace refined carbs (white rice, standard pasta) with whole grain alternatives.",
    "Do not confuse thirst with hunger: drink a glass of water first when sudden cravings strike.",
    "Cook your own meals whenever possible to maintain full control over ingredients.",
    "Sleep quality directly impacts appetite and fullness hormones. Aim for 7 to 8 hours.",
    "Avoid eating while watching TV or using your phone: distraction leads to overeating.",
    "Plan your weekly meals ahead of time to prevent impulsive snack choices and food waste.",
  ],
  fr: [
    "Buvez de l'eau avant les repas pour faciliter la digestion et favoriser la satiété.",
    "Privilégiez les aliments bruts et peu transformés plutôt que les produits ultra-transformés.",
    "Mangez lentement : le cerveau met environ 20 minutes pour ressentir la satiété.",
    "Ajoutez des fibres saines comme l'avoine, le chia ou le lin à votre petit-déjeuner.",
    "Mettez de la couleur dans votre assiette : des légumes variés apportent plus d'antioxydants.",
    "Les bonnes graisses sont précieuses ! Consommez avocat, huile d'olive et oléagineux avec modération.",
    "Évitez le sucre raffiné et les sodas ; préférez l'eau infusée ou les jus de fruits frais.",
    "Les protéines sont essentielles pour la masse musculaire et la satiété à chaque repas principal.",
    "Remplacez les féculents raffinés par des versions complètes riches en nutriments.",
    "Ne confondez pas soif et faim : buvez un grand verre d'eau dès qu'une envie soudaine apparaît.",
    "Cuisinez vous-même autant que possible pour contrôler parfaitement vos ingrédients.",
    "La qualité du sommeil régule l'appétit et les hormones de satiété. Dormez 7 à 8 heures par nuit.",
    "Évitez de manger devant les écrans : la distraction nuit aux signaux naturels de satiété.",
    "Planifiez vos repas de la semaine pour éviter les impulsions et le gaspillage alimentaire.",
  ],
};

export function NutritionTip() {
  const { t, lang } = useTranslation();
  const [tipIndex, setTipIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const tips = NUTRITION_TIPS_BY_LANG[lang] || NUTRITION_TIPS_BY_LANG.pt;

  useEffect(() => {
    // Seed standard of the day so it changes daily, but stays consistent on that day
    const todayNum = new Date().getDate();
    const initialIndex = todayNum % tips.length;
    setTipIndex(initialIndex);
  }, [tips.length, lang]);

  const handleNextTip = () => {
    setIsRotating(true);
    setTimeout(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
      setIsRotating(false);
    }, 440);
  };

  const currentTip = tips[tipIndex % tips.length] || tips[0];

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
              {t("home.tipOfDay")}
            </span>
            <span className="text-xs font-bold text-foreground">{t("home.healthyTip")}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextTip}
          className="p-1.5 hover:bg-primary/15 active:scale-90 text-primary/60 hover:text-primary rounded-lg transition-all flex items-center justify-center"
          title={t("home.anotherTip")}
        >
          <RefreshCw className={`size-3.5 ${isRotating ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-4 relative z-10 min-h-[52px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${lang}-${tipIndex}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] leading-relaxed text-muted-foreground font-medium italic"
          >
            "{currentTip}"
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[9px] font-black text-primary/60 tracking-wider uppercase relative z-10">
        <Sparkles className="size-3 shrink-0 text-amber-500 animate-bounce" />
        <span>{t("home.tipMotto")}</span>
      </div>
    </div>
  );
}
