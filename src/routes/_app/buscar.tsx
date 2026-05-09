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
        body: { query: q, mode: "variants" },
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
          <h1 className="text-2xl font-display font-black tracking-tight">Buscar Alimento</h1>
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider opacity-60">
            {popular?.length ?? 0} alimentos na base local
          </p>
        </div>
      </div>

      <div className="glass rounded-[28px] flex items-center gap-4 px-6 py-4 border-white/10 shadow-inner group focus-within:ring-2 ring-white/10 transition-all">
        <Search className="size-5 text-muted-foreground group-focus-within:text-white transition-colors" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setVariants(null);
          }}
          placeholder="O que você comeu?"
          className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground/30"
        />
      </div>

      {isPremium ? (
        q.trim() && (
          <Button
            onClick={buscarIA}
            disabled={aiBusy}
            className="w-full h-14 rounded-[24px] bg-white text-black hover:bg-zinc-200 font-black shadow-lg shadow-white/10 border border-white/10"
          >
            {aiBusy ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="size-5 mr-2" />
            )}
            Analisar "{q}" com IA
          </Button>
        )
      ) : (
        <div className="glass rounded-[24px] p-4 flex items-center gap-3 justify-center text-[10px] font-black uppercase tracking-widest border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 bg-white/5" />
          <Crown className="size-4 text-white relative z-10" />
          <span className="text-muted-foreground relative z-10">
            Premium busca qualquer alimento com IA
          </span>
        </div>
      )}

      {variants && (
        <button
          onClick={() => setVariants(null)}
          className="text-[10px] text-white font-black uppercase tracking-widest hover:opacity-100 opacity-70 transition-opacity"
        >
          ← Voltar à lista popular
        </button>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass rounded-[32px] p-4 space-y-3 animate-pulse border-white/5"
            >
              <div className="aspect-square rounded-[24px] bg-white/5" />
              <div className="h-4 bg-white/5 rounded-full w-3/4" />
              <div className="h-3 bg-white/5 rounded-full w-1/2" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {showList.map((f, i) => (
          <button
            key={`${f.nome}-${i}`}
            onClick={() => setSelected(f)}
            className="rounded-[40px] border border-white/5 bg-white/[0.03] backdrop-blur-2xl p-3 text-left transition-all duration-500 hover:bg-white/[0.08] hover:-translate-y-1 active:scale-95 flex flex-col gap-3 shadow-2xl group relative overflow-hidden"
          >
            <div className="relative aspect-square w-full rounded-[32px] overflow-hidden shadow-inner">
              <FoodImage
                src={f.foto_url}
                alt={f.nome}
                eager={i < 4}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out grayscale-[20%] group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-3 right-3 glass-strong px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-xl border border-white/10">
                {Math.round(f.cal)} kcal
              </div>
            </div>
            <div className="px-2 pb-2 space-y-1.5 flex-1 flex flex-col justify-between">
              <div className="font-bold text-sm text-foreground line-clamp-2 tracking-tight leading-snug min-h-[2.5rem]">
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
                    className="flex-1 bg-white/[0.04] py-1.5 rounded-xl border border-white/5 text-center"
                  >
                    <div className="text-[8px] font-black uppercase text-white/30 mb-0.5">
                      {m.l}
                    </div>
                    <div className="text-[10px] font-black text-white/80">{Math.round(m.v)}g</div>
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
