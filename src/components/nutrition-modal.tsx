import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Flame, Wheat, Beef, Droplet, Camera, X, Loader2 } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { FoodImage } from "@/components/food-image";
import { uploadFoodPhoto } from "@/lib/upload-food-photo";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { isInstalledApp, dataURLtoFile } from "@/lib/utils";

export type NutritionFood = {
  nome: string;
  cal: number;
  carb: number;
  prot: number;
  gord: number;
  foto_url?: string | null;
};

type Props = {
  food: NutritionFood | null;
  onClose: () => void;
  onAdd: (food: NutritionFood, porcoes: number, fotoUrl: string | null) => Promise<void> | void;
};

const BLOCKS = [
  { key: "cal", label: "Calorias", unit: "", Icon: Flame, color: "text-accent" },
  { key: "carb", label: "Carbos", unit: "g", Icon: Wheat, color: "text-amber-600" },
  { key: "prot", label: "Proteína", unit: "g", Icon: Beef, color: "text-primary" },
  { key: "gord", label: "Gordura", unit: "g", Icon: Droplet, color: "text-sky-500" },
] as const;

export function NutritionModal({ food, onClose, onAdd }: Props) {
  const { user } = useAuth();
  const [porcoes, setPorcoes] = useState(1);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (food) {
      setPorcoes(1);
      setPhotoUrl(null);
    }
  }, [food]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    const name = file.name ? file.name.toLowerCase() : "";
    const mimeType = file.type ? file.type.toLowerCase() : "";
    const extMatch = name.match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : "";

    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

    const hasValidExtension = allowedExtensions.includes(ext);
    const hasValidMime =
      allowedMimeTypes.includes(mimeType) ||
      (mimeType.startsWith("image/") &&
        !mimeType.includes("svg") &&
        !mimeType.includes("html") &&
        !mimeType.includes("xml"));

    if (!hasValidExtension || !hasValidMime) {
      toast.error(
        "Por favor, envie um arquivo de imagem válido (PNG, JPEG, WEBP). Outros formatos não são permitidos.",
      );
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFoodPhoto(file, user.id, "manual");
      setPhotoUrl(url);
    } catch {
      toast.error("Falha ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectCapacitorPhoto = () => {
    fileRef.current?.click();
  };

  const handleAdd = async () => {
    if (!food) return;
    setBusy(true);
    try {
      await onAdd(food, porcoes, photoUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!food} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-[32px] border border-border bg-card p-0 overflow-hidden shadow-xl text-foreground">
        <DialogTitle className="sr-only">Adicionar alimento</DialogTitle>
        <DialogDescription className="sr-only">Ajuste a porção e adicione</DialogDescription>
        {food && (
          <div className="space-y-0 relative">
            <div className="relative h-60 w-full overflow-hidden">
              <FoodImage
                src={photoUrl ?? food.foto_url}
                alt={food.nome}
                eager
                className="h-full w-full object-cover"
                roundedPlaceholder={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only absolute pointer-events-none w-0 h-0"
                onChange={handleFile}
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                {photoUrl && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-10 rounded-full bg-white/90 text-zinc-900 border border-zinc-200 hover:bg-white shadow-md"
                    onClick={() => setPhotoUrl(null)}
                    disabled={uploading}
                  >
                    <X className="size-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full h-10 bg-white/90 text-zinc-900 border border-zinc-200 hover:bg-white shadow-md gap-2 px-4"
                  onClick={handleSelectCapacitorPhoto}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin text-zinc-900" />
                  ) : (
                    <Camera className="size-4 text-zinc-900" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                    {photoUrl ? "Trocar" : "Adicionar foto"}
                  </span>
                </Button>
              </div>
            </div>

            <div className="space-y-6 p-6 -mt-6 relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                  Resumo Nutricional
                </p>
                <h3 className="text-2xl font-display font-black tracking-tight text-foreground">
                  {food.nome}
                </h3>
              </div>

              <div className="flex items-center justify-between rounded-[24px] bg-secondary border border-border p-2 text-foreground">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-2xl size-12 hover:bg-secondary-foreground/10 text-foreground"
                  onClick={() => setPorcoes(Math.max(0.5, porcoes - 0.5))}
                >
                  <Minus className="size-5" />
                </Button>
                <div className="text-center px-4">
                  <div className="text-2.5xl font-black tabular-nums tracking-tighter text-foreground">
                    {porcoes}×
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
                    porção
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-2xl size-12 hover:bg-secondary-foreground/10 text-foreground"
                  onClick={() => setPorcoes(porcoes + 0.5)}
                >
                  <Plus className="size-5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-foreground">
                {BLOCKS.map(({ key, label, unit, Icon, color }) => {
                  const v = (food as Record<string, unknown>)[key] as number;
                  return (
                    <div
                      key={key}
                      className="rounded-[24px] border border-border/80 bg-secondary/30 p-4 group transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                          <Icon className={`size-5 ${color}`} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                            {label}
                          </div>
                          <div className="font-display font-black text-lg tabular-nums tracking-tight text-foreground group-hover:scale-105 transition-transform origin-left">
                            {Math.round(v * porcoes)}
                            {unit}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  className="h-14 rounded-[24px] border border-border bg-secondary font-bold uppercase tracking-widest text-[10px] hover:bg-muted text-foreground"
                  onClick={onClose}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button
                  className="h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm"
                  onClick={handleAdd}
                  disabled={busy}
                >
                  {busy ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
