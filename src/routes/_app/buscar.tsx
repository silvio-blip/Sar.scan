import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NutritionModal, type NutritionFood } from "@/components/nutrition-modal";
import { getApiUrl } from "@/lib/utils";
import { FoodIcon } from "@/components/food-icon";
import { WORLD_FOOD_DATABASE } from "@/data/foodDatabase";
import { FOOD_CATEGORIES, matchesCategory, type FoodCategory } from "@/lib/food-categories";

export const Route = createFileRoute("/_app/buscar")({ component: BuscarPage });

const today = () => new Date().toISOString().slice(0, 10);

type Food = NutritionFood & { porcao?: string };

export function BuscarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>("all");
  const [selected, setSelected] = useState<Food | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [variants, setVariants] = useState<Food[] | null>(null);

  const { data: popular, isLoading } = useQuery({
    queryKey: ["foods_popular"],
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data: cached } = await supabase
        .from("foods_basic")
        .select("nome, cal, carb, prot, gord, foto_url")
        .order("nome")
        .limit(1000);
      if (cached && cached.length > 0)
        return cached.map((c) => ({ ...c, porcao: "1 porção" })) as Food[];

      return WORLD_FOOD_DATABASE as Food[];
    },
  });

  const allFoods = useMemo(() => {
    const map = new Map<string, Food>();
    WORLD_FOOD_DATABASE.forEach((f) => map.set(f.nome.toLowerCase().trim(), f as Food));
    (popular ?? []).forEach((f) => map.set(f.nome.toLowerCase().trim(), f));
    try {
      const cachedAi = JSON.parse(localStorage.getItem("sar_ai_search_cache") || "{}");
      Object.values(cachedAi)
        .flat()
        .forEach((f: any) => {
          if (f && f.nome) map.set(f.nome.toLowerCase().trim(), f);
        });
    } catch {
      // ignore cache read failure
    }
    return Array.from(map.values());
  }, [popular]);

  const filtered = useMemo(() => {
    let list = allFoods;

    // Filtra pela categoria selecionada
    if (selectedCategory !== "all") {
      list = list.filter((f) => matchesCategory(f.nome, selectedCategory));
    }

    // Filtra pela busca textual
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      list = list.filter(
        (f) => f.nome.toLowerCase().includes(query) || f.porcao?.toLowerCase().includes(query),
      );
    }
    return list;
  }, [allFoods, selectedCategory, q]);

  const showList = useMemo(() => variants ?? filtered, [variants, filtered]);

  const adicionar = async (food: NutritionFood, p: number, fotoUrl?: string | null) => {
    if (!user) return;
    const finalPhoto = fotoUrl !== undefined ? fotoUrl : (food.foto_url ?? null);
    const todayStr = today();
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("food_entries").insert({
      user_id: user.id,
      nome: food.nome,
      porcoes: p,
      calorias: Number(food.cal) * p,
      carbs: Number(food.carb) * p,
      prot: Number(food.prot) * p,
      gord: Number(food.gord) * p,
      foto_url: finalPhoto,
      data: todayStr,
      created_at: nowIso,
    });
    if (error) {
      console.error("Erro ao salvar alimento no diário:", error);
      toast.error("Erro ao salvar alimento no diário");
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["entries"] }),
      qc.invalidateQueries({ queryKey: ["consumption"] }),
      qc.invalidateQueries({ queryKey: ["weekly"] }),
    ]);
    toast.success("Adicionado ao diário!");
    setSelected(null);
  };

  const buscarIA = async () => {
    const queryTrim = q.trim();
    if (!queryTrim) return;

    // Check localStorage cache first
    try {
      const cachedAi = JSON.parse(localStorage.getItem("sar_ai_search_cache") || "{}");
      if (cachedAi[queryTrim.toLowerCase()]) {
        setVariants(cachedAi[queryTrim.toLowerCase()]);
        return;
      }
    } catch {
      // ignore cache read failure
    }

    setAiBusy(true);
    try {
      const response = await fetch(getApiUrl("/api/edge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "search-food-ai",
          body: { query: queryTrim, mode: "variants", user_id: user?.id },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) throw new Error(data.error || "Erro ao realizar busca");

      const alimentos = (data.alimentos ?? []) as Food[];
      if (alimentos.length === 0) {
        toast.message("Nenhum alimento encontrado", {
          description: "Tente usar termos diferentes para a busca.",
        });
      } else {
        try {
          const cachedAi = JSON.parse(localStorage.getItem("sar_ai_search_cache") || "{}");
          cachedAi[queryTrim.toLowerCase()] = alimentos;
          localStorage.setItem("sar_ai_search_cache", JSON.stringify(cachedAi));
        } catch {
          // ignore
        }
        // Invalida a query do banco para refletir os novos itens inseridos pela IA
        await qc.invalidateQueries({ queryKey: ["foods_popular"] });
      }
      setVariants(alimentos);
    } catch (e: any) {
      console.error("AI Search error:", e);
      toast.error(
        e instanceof Error
          ? `Erro na busca por IA: ${e.message}`
          : "Erro ao realizar busca com IA. Tente novamente.",
      );
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 select-none transform-gpu pt-safe pt-3">
      {/* Sticky Top Header & Search Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-4 space-y-4 border-b border-border/40">
        <div className="flex flex-col gap-1.5 px-4 sm:px-6">
          <h1 className="text-3xl font-display font-black tracking-tight text-foreground">
            Buscar Alimento
          </h1>
          <p className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.25em]">
            {popular?.length ?? allFoods.length} alimentos cadastrados • {filtered.length} exibidos
          </p>
        </div>

        {/* Search Input Box */}
        <div className="mx-4 sm:mx-6 bg-secondary/60 rounded-[24px] flex items-center gap-3.5 px-4 py-3.5 border border-border/80 shadow-inner group focus-within:ring-2 ring-primary/20 transition-all">
          <Search
            className="size-5 text-muted-foreground group-focus-within:text-primary transition-colors shrink-0"
            strokeWidth={2.5}
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setVariants(null);
            }}
            placeholder="O que você comeu?"
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-foreground placeholder:text-muted-foreground/60"
          />
          {q.trim() && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setVariants(null);
              }}
              className="text-xs font-bold text-muted-foreground hover:text-foreground px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Category Chips with gesture stop propagation */}
        <div
          data-no-swipe="true"
          data-category-bar="true"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="no-swipe flex items-center gap-2 overflow-x-auto no-scrollbar px-4 sm:px-6 pb-1 -mt-1 touch-pan-x"
        >
          {FOOD_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setVariants(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                    : "bg-secondary/60 hover:bg-secondary text-foreground/80 border-border/60"
                }`}
              >
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {q.trim() && (
          <Button
            onClick={buscarIA}
            disabled={aiBusy}
            className="w-full h-12 rounded-[20px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold shadow-sm transition-all"
          >
            {aiBusy ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="size-5 mr-2" />
            )}
            Analisar com IA: "{q}"
          </Button>
        )}

        {variants && (
          <button
            onClick={() => setVariants(null)}
            className="text-[10px] text-primary font-black uppercase tracking-widest hover:opacity-85 transition-opacity block"
          >
            ← Voltar à lista por categorias
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-secondary/30 rounded-[28px] p-4 space-y-3 animate-pulse border border-border/40"
            >
              <div className="aspect-square rounded-[20px] bg-secondary/50" />
              <div className="h-4 bg-secondary/50 rounded-full w-3/4" />
              <div className="h-3 bg-secondary/50 rounded-full w-1/2" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {showList.map((f, i) => {
          return (
            <button
              key={`${f.nome}-${i}`}
              onClick={() => setSelected(f)}
              className="w-full bg-card rounded-[22px] p-3 hover:bg-secondary/20 active:scale-[0.99] border border-border/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-300 flex items-center gap-3.5 group relative overflow-hidden text-left"
            >
              {/* Left Side: Soft circle with centered large Emoji */}
              <div className="size-12 shrink-0 rounded-2xl bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center text-2xl shadow-inner border border-primary/5 transition-colors">
                <FoodIcon name={f.nome} sizeClassName="text-2xl" />
              </div>

              {/* Center Side: Food Name & Highlighted Calories */}
              <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
                <span className="font-bold text-sm tracking-tight text-foreground truncate block leading-tight">
                  {f.nome}
                </span>
                <span className="text-xs font-black text-rose-500/90 mt-1 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                  {Math.round(f.cal)} kcal
                </span>
              </div>

              {/* Right Side: Cleanly mapped macronutrient values */}
              <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                <div className="bg-emerald-500/5 px-2 py-1.5 rounded-xl border border-emerald-500/10 text-center min-w-[34px] sm:min-w-[40px]">
                  <span className="block text-[8px] font-black uppercase text-emerald-600/80 tracking-wide">
                    P
                  </span>
                  <span className="block text-[11px] font-black leading-none text-emerald-700 mt-0.5">
                    {Math.round(f.prot)}g
                  </span>
                </div>
                <div className="bg-amber-500/5 px-2 py-1.5 rounded-xl border border-amber-500/10 text-center min-w-[34px] sm:min-w-[40px]">
                  <span className="block text-[8px] font-black uppercase text-amber-600/80 tracking-wide">
                    C
                  </span>
                  <span className="block text-[11px] font-black leading-none text-amber-700 mt-0.5">
                    {Math.round(f.carb)}g
                  </span>
                </div>
                <div className="bg-indigo-500/5 px-2 py-1.5 rounded-xl border border-indigo-500/10 text-center min-w-[34px] sm:min-w-[40px]">
                  <span className="block text-[8px] font-black uppercase text-indigo-600/80 tracking-wide">
                    G
                  </span>
                  <span className="block text-[11px] font-black leading-none text-indigo-700 mt-0.5">
                    {Math.round(f.gord)}g
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!isLoading && showList.length === 0 && q.trim() && !variants && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Nada encontrado. Use a busca por IA acima.
        </p>
      )}

      <NutritionModal food={selected} onClose={() => setSelected(null)} onAdd={adicionar} />
    </div>
  );
}
