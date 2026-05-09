import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";

interface WaterTrackerProps {
  currentMl: number;
  targetMl: number;
  onAdd: (ml: number) => void;
}

export function WaterTracker({ currentMl, targetMl, onAdd }: WaterTrackerProps) {
  const [unit, setUnit] = useState<"litro" | "ml">("ml");
  const [incrementIndex, setIncrementIndex] = useState(1); // Default to 250
  const increments = [100, 250, 500, 1000];
  const currentIncrement = increments[incrementIndex];

  const segments = 10; // 10 liters capacity for the bar? Or standard target?
  // Each segment = 1000ml (1L) as requested.
  const currentSegments = Math.floor(currentMl / 1000);

  const cycleParams = (dir: "left" | "right") => {
    if (dir === "left") {
      setIncrementIndex((prev) => (prev - 1 + increments.length) % increments.length);
    } else {
      setIncrementIndex((prev) => (prev + 1) % increments.length);
    }
  };

  const toggleUnit = () => {
    setUnit(unit === "litro" ? "ml" : "litro");
  };

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      {/* Unit & Increment Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => cycleParams("left")}
          className="text-white/20 hover:text-white transition active:scale-95 p-1"
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          onClick={toggleUnit}
          className="bg-white/90 rounded-full px-4 py-1 flex items-center justify-center min-w-[100px] shadow-lg active:scale-95 transition-transform"
        >
          <span className="text-black font-black text-[10px] uppercase tracking-widest">
            {currentIncrement >= 1000 ? (currentIncrement / 1000).toFixed(1) : currentIncrement}
            {currentIncrement >= 1000 ? "L" : "ml"}
          </span>
        </button>

        <button
          onClick={() => cycleParams("right")}
          className="text-white/20 hover:text-white transition active:scale-95 p-1"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Control Bar - Each segment = 1 Liter */}
      <div className="flex items-center gap-4 w-full px-4">
        <button
          onClick={() => onAdd(-currentIncrement)}
          className="text-white/40 hover:text-white active:scale-75 transition-all p-1"
        >
          <Minus className="size-5" strokeWidth={4} />
        </button>

        <div className="flex gap-1 items-center h-4 flex-1 justify-center">
          {Array.from({ length: 8 }).map(
            (
              _,
              i, // Show 8 Liters capacity
            ) => (
              <div
                key={i}
                className={`h-full w-2 rounded-full transition-all duration-700 ${
                  i < currentSegments
                    ? "bg-gradient-to-t from-[#00FF00] to-[#00CC00] shadow-[0_0_10px_rgba(0,255,0,0.5)]"
                    : "bg-white/10"
                }`}
              />
            ),
          )}
        </div>

        <button
          onClick={() => onAdd(currentIncrement)}
          className="text-white/40 hover:text-white active:scale-75 transition-all p-1"
        >
          <Plus className="size-5" strokeWidth={4} />
        </button>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black text-white/40 mb-1">
          {(currentMl / 1000).toFixed(1)}L Consumidos
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10">Água</span>
      </div>
    </div>
  );
}
