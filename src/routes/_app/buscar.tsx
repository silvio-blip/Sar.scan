import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Crown, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NutritionModal, type NutritionFood } from "@/components/nutrition-modal";
import { FoodImage } from "@/components/food-image";

export const Route = createFileRoute("/_app/buscar")({ component: BuscarPage });

type Food = NutritionFood & { porcao?: string };

export function BuscarPage() {
  const { user, isPremium } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
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
        .limit(100);
      if (cached && cached.length >= 50)
        return cached.map((c) => ({ ...c, porcao: "1 porção" })) as Food[];
      const { data, error } = await supabase.functions.invoke("search-food-ai", {
        body: { mode: "popular" },
      });
      if (error || data?.error) throw new Error(data?.error ?? "Erro ao carregar alimentos");
      return (data.alimentos ?? []) as Food[];
    },
  });

  const filtered = (popular ?? []).filter((f) => f.nome.toLowerCase().includes(q.toLowerCase()));
  const showList = useMemo(() => variants ?? filtered, [variants, filtered]);

  // Geração de imagens automáticas desativada nesta configuração.

  const adicionar = async (food: NutritionFood, p: number) => {
    if (!user) return;
    await supabase.from("food_entries").insert({
      user_id: user.id,
      nome: food.nome,
      porcoes: p,
      calorias: Number(food.cal) * p,
      carbs: Number(food.carb) * p,
      prot: Number(food.prot) * p,
      gord: Number(food.gord) * p,
      foto_url: food.foto_url ?? null,
    });
    qc.invalidateQueries();
    toast.success("Adicionado ao diário");
    setSelected(null);
  };

  const buscarIA = async () => {
    if (!q.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-food-ai", {
        body: { query: q, mode: "variants", user_id: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const alimentos = (data.alimentos ?? []) as Food[];
      if (alimentos.length === 0) {
        toast.message("Nenhum alimento encontrado", {
          description: "Tente usar termos diferentes para a busca.",
        });
      }
      setVariants(alimentos);
    } catch (e) {
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
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
            Buscar Alimento
          </h1>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
            {popular?.length ?? 0} alimentos na base local
          </p>
        </div>
      </div>

      <div className="bg-secondary rounded-[24px] flex items-center gap-4 px-5 py-3.5 border border-border/80 shadow-inner group focus-within:ring-2 ring-primary/20 transition-all">
        <Search
          className="size-5 text-muted-foreground group-focus-within:text-primary transition-colors"
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
      </div>

      {isPremium ? (
        q.trim() && (
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
        )
      ) : (
        <div className="bg-secondary/40 rounded-[20px] p-4 flex items-center gap-3 justify-center text-[10px] font-black uppercase tracking-widest border border-border/80 shadow-sm overflow-hidden relative">
          <Crown className="size-4 text-accent relative z-10 animate-pulse" />
          <span className="text-foreground/80 relative z-10 font-bold font-sans">
            Assine o Premium para buscar qualquer comida por IA
          </span>
        </div>
      )}

      {variants && (
        <button
          onClick={() => setVariants(null)}
          className="text-[10px] text-primary font-black uppercase tracking-widest hover:opacity-85 transition-opacity"
        >
          ← Voltar à lista popular
        </button>
      )}

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

      <div className="grid grid-cols-2 gap-4">
        {showList.map((f, i) => (
          <button
            key={`${f.nome}-${i}`}
            onClick={() => setSelected(f)}
            className="rounded-[28px] border border-border/50 bg-card p-3 text-left transition-all duration-300 hover:bg-secondary/20 hover:border-border active:scale-95 flex flex-col gap-2.5 shadow-sm group relative overflow-hidden"
          >
            <div className="relative aspect-square w-full rounded-[20px] overflow-hidden shadow-sm border border-border">
              <FoodImage
                src={f.foto_url}
                alt={f.nome}
                eager={i < 4}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-2 right-2 bg-white/95 px-2 py-0.5 rounded-full text-[9px] font-black text-zinc-900 border border-zinc-200">
                {Math.round(f.cal)} kcal
              </div>
            </div>
            <div className="px-1 pb-1 space-y-2 flex-1 flex flex-col justify-between">
              <div className="font-bold text-xs text-foreground line-clamp-2 tracking-tight leading-snug min-h-[2rem]">
                {f.nome}
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden">
                {[
                  { l: "P", v: f.prot },
                  { l: "C", v: f.carb },
                  { l: "G", v: f.gord },
                ].map((m) => (
                  <div
                    key={m.l}
                    className="flex-1 bg-secondary/30 py-1 rounded-lg border border-border/30 text-center"
                  >
                    <div className="text-[7.5px] font-black uppercase text-muted-foreground mb-0.5">
                      {m.l}
                    </div>
                    <div className="text-[10px] font-black text-foreground">{Math.round(m.v)}g</div>
                  </div>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!isLoading && showList.length === 0 && q.trim() && !variants && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Nada encontrado
          {isPremium ? ". Use a busca por IA acima." : ". Assine Premium para buscar com IA."}
        </p>
      )}

      <NutritionModal food={selected} onClose={() => setSelected(null)} onAdd={adicionar} />
    </div>
  );
}
