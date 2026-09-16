import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X, Loader2, Flame, Wheat, Beef, Droplet } from "lucide-react";
import { useState, useEffect } from "react";
import { FoodImage } from "@/components/food-image";

export type ScannedFood = {
  nome: string;
  quantidade: string;
  cal: number;
  carb: number;
  prot: number;
  gord: number;
  foto_url?: string | null;
};

type Props = {
  items: ScannedFood[] | null;
  photo?: string | null;
  onClose: () => void;
  onConfirm: (items: (ScannedFood & { porcoes: number })[]) => Promise<void> | void;
};

const NUTRIENT_BLOCKS = [
  { key: "cal", label: "Calorias", unit: "", Icon: Flame, color: "text-orange-300" },
  { key: "carb", label: "Carbos", unit: "g", Icon: Wheat, color: "text-amber-300" },
  { key: "prot", label: "Proteína", unit: "g", Icon: Beef, color: "text-rose-300" },
  { key: "gord", label: "Gordura", unit: "g", Icon: Droplet, color: "text-sky-300" },
] as const;

export function MultiFoodModal({ items, photo, onClose, onConfirm }: Props) {
  const [list, setList] = useState<(ScannedFood & { porcoes: number })[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (items) setList(items.map((i) => ({ ...i, porcoes: 1 })));
  }, [items]);

  const setPorc = (idx: number, v: number) => {
    setList((prev) => prev.map((it, i) => (i === idx ? { ...it, porcoes: Math.max(0.5, v) } : it)));
  };
  const remove = (idx: number) => setList((prev) => prev.filter((_, i) => i !== idx));

  const total = list.reduce(
    (a, i) => ({
      cal: a.cal + i.cal * i.porcoes,
      carb: a.carb + i.carb * i.porcoes,
      prot: a.prot + i.prot * i.porcoes,
      gord: a.gord + i.gord * i.porcoes,
    }),
    { cal: 0, carb: 0, prot: 0, gord: 0 },
  );

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm(list);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!items} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto rounded-[28px] border border-border bg-background/96 p-0 shadow-2xl">
        <div className="p-5 pb-4 space-y-4">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <span className="size-2 rounded-full bg-sage" /> Itens detectados
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirme as porções e adicione ao diário
          </DialogDescription>

          {photo && (
            <div className="relative rounded-2xl overflow-hidden border border-border">
              <img src={photo} alt="scan" className="w-full h-36 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/85 to-transparent" />
            </div>
          )}

          <div className="space-y-3">
            {list.map((it, idx) => (
              <div key={idx} className="rounded-2xl border border-border bg-card/65 p-3 space-y-3">
                <div className="flex gap-3 items-center">
                  <FoodImage
                    src={it.foto_url}
                    alt={it.nome}
                    eager
                    priority
                    className="size-16 rounded-2xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight">{it.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{it.quantidade}</div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    onClick={() => remove(idx)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {NUTRIENT_BLOCKS.map(({ key, label, unit, Icon, color }) => {
                    const v = (it as Record<string, unknown>)[key] as number;
                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-background/55 border border-border p-2 text-center"
                      >
                        <Icon className={`size-3 mx-auto mb-0.5 ${color}`} />
                        <div className="text-sm font-bold">
                          {Math.round(v * it.porcoes)}
                          {unit}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-[0.16em] mt-0.5">
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between bg-background/60 rounded-2xl p-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-xl"
                    onClick={() => setPorc(idx, it.porcoes - 0.5)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="text-xs font-semibold tracking-[0.16em] uppercase">
                    {it.porcoes}× porção
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-xl"
                    onClick={() => setPorc(idx, it.porcoes + 0.5)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-5 rounded-2xl border border-border bg-card/70 p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.22em] mb-2 text-center">
              Total da refeição
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {NUTRIENT_BLOCKS.map(({ key, label, unit, Icon, color }) => {
                const v = (total as Record<string, number>)[key];
                return (
                  <div key={key}>
                    <Icon className={`size-4 mx-auto mb-1 ${color}`} />
                    <div className="font-bold text-base text-foreground">
                      {Math.round(v)}
                      {unit}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-5 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="h-11 rounded-2xl border-border bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              onClick={handle}
              disabled={busy || list.length === 0}
              className="h-11 rounded-2xl bg-sage text-background hover:bg-sage/90"
            >
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
