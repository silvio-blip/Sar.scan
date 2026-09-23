import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Minus,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { FoodImage } from "@/components/food-image";
import { uploadFoodPhoto } from "@/lib/upload-food-photo";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { isInstalledApp, dataURLtoFile } from "@/lib/utils";
import { getFoodEmoji } from "@/lib/food-emoji";
import { stopSpeech } from "@/lib/tts";

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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

    if (!hasValidExtension && !hasValidMime) {
      toast.error(
        "Por favor, envie um arquivo de imagem válido (PNG, JPEG, WEBP). Outros formatos não são permitidos.",
      );
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFoodPhoto(file, user.id, "manual");
      setPhotoUrl(url);
      toast.success("Foto carregada com sucesso!");
    } catch {
      toast.error("Falha ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleTakeLivePhoto = async () => {
    if (isInstalledApp()) {
      try {
        const {
          Camera: CapCamera,
          CameraResultType,
          CameraSource,
        } = await import("@capacitor/camera");
        try {
          const check = await CapCamera.checkPermissions();
          if (check.camera !== "granted") {
            await CapCamera.requestPermissions({ permissions: ["camera"] });
          }
        } catch (permErr) {
          console.warn("[Capacitor Permissions Error]", permErr);
        }

        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo.dataUrl && user) {
          setUploading(true);
          try {
            const file = await dataURLtoFile(photo.dataUrl, `camera-photo-${Date.now()}.jpg`);
            const url = await uploadFoodPhoto(file, user.id, "manual");
            setPhotoUrl(url);
            toast.success("Foto em tempo real capturada!");
          } catch (uploadErr) {
            console.error("Capacitor camera upload error in dialog:", uploadErr);
            toast.error("Falha ao salvar foto");
          } finally {
            setUploading(false);
          }
        }
      } catch (err: any) {
        console.error("Capacitor camera error in modal:", err);
        if (
          err?.message !== "User cancelled photos app" &&
          err?.message?.indexOf("cancelled") === -1
        ) {
          cameraInputRef.current?.click();
        }
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleSelectGalleryPhoto = async () => {
    if (isInstalledApp()) {
      try {
        const {
          Camera: CapCamera,
          CameraResultType,
          CameraSource,
        } = await import("@capacitor/camera");
        try {
          const check = await CapCamera.checkPermissions();
          if (check.photos !== "granted") {
            await CapCamera.requestPermissions({ permissions: ["photos"] });
          }
        } catch (permErr) {
          console.warn("[Capacitor Permissions Error]", permErr);
        }

        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });

        if (photo.dataUrl && user) {
          setUploading(true);
          try {
            const file = await dataURLtoFile(photo.dataUrl, `gallery-photo-${Date.now()}.jpg`);
            const url = await uploadFoodPhoto(file, user.id, "manual");
            setPhotoUrl(url);
            toast.success("Foto selecionada da galeria!");
          } catch (uploadErr) {
            console.error("Capacitor gallery upload error in dialog:", uploadErr);
            toast.error("Falha ao salvar foto");
          } finally {
            setUploading(false);
          }
        }
      } catch (err: any) {
        console.error("Capacitor gallery picker error in modal:", err);
        if (
          err?.message !== "User cancelled photos app" &&
          err?.message?.indexOf("cancelled") === -1
        ) {
          galleryInputRef.current?.click();
        }
      }
    } else {
      galleryInputRef.current?.click();
    }
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

  const handleClose = () => {
    stopSpeech();
    onClose();
  };

  const foodEmoji = food ? getFoodEmoji(food.nome) : "🍽️";

  return (
    <Dialog open={!!food} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm rounded-[32px] border border-border bg-card p-0 overflow-hidden shadow-xl text-foreground">
        <DialogTitle className="sr-only">Adicionar alimento</DialogTitle>
        <DialogDescription className="sr-only">Ajuste a porção e adicione</DialogDescription>
        {food && (
          <div className="space-y-0 relative">
            <div className="relative h-60 w-full overflow-hidden bg-secondary/25 border-b border-border/40 flex items-center justify-center">
              <FoodImage
                src={photoUrl ?? food.foto_url}
                alt={food.nome}
                foodName={food.nome}
                emoji={foodEmoji}
                textSizeClass="text-7xl sm:text-8xl drop-shadow-sm transition-transform duration-300 select-none"
                eager
                className="h-full w-full object-cover"
                roundedPlaceholder={false}
              />

              {/* Status se foto foi personalizada */}
              {photoUrl && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  Foto pronta para salvar
                </div>
              )}

              {/* Action Buttons: Tirar Foto & Galeria */}
              <div className="absolute bottom-3 right-3 left-3 z-20 flex items-center justify-end gap-2">
                {photoUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-8 rounded-full bg-zinc-900/80 text-white hover:bg-zinc-900 border border-white/20 shadow-md active:scale-95 transition-transform shrink-0"
                    onClick={() => setPhotoUrl(null)}
                    disabled={uploading}
                    title="Remover foto personalizada"
                  >
                    <X className="size-4" />
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full h-8 bg-background/90 text-foreground hover:bg-background border border-border/80 shadow-sm gap-1.5 px-3 active:scale-95 transition-all text-xs font-semibold backdrop-blur-md"
                  onClick={handleTakeLivePhoto}
                  disabled={uploading}
                  title="Tirar foto em tempo real agora"
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin text-foreground" />
                  ) : (
                    <Camera className="size-3.5 text-emerald-600" />
                  )}
                  <span>Tirar Foto</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full h-8 bg-background/90 text-foreground hover:bg-background border border-border/80 shadow-sm gap-1.5 px-3 active:scale-95 transition-all text-xs font-semibold backdrop-blur-md"
                  onClick={handleSelectGalleryPhoto}
                  disabled={uploading}
                  title="Escolher foto da galeria"
                >
                  <ImageIcon className="size-3.5 text-sky-600" />
                  <span>Galeria</span>
                </Button>
              </div>

              {/* Hidden file inputs para Câmera ao vivo e Galeria */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only absolute pointer-events-none w-0 h-0"
                onChange={handleFile}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.heic,.heif,image/*"
                className="sr-only absolute pointer-events-none w-0 h-0"
                onChange={handleFile}
              />
            </div>

            <div className="space-y-6 p-6 relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                  Resumo Nutricional
                </p>
                <h3 className="text-2xl font-display font-black tracking-tight text-foreground flex items-center gap-2.5">
                  <span className="text-2xl shrink-0 leading-none">{foodEmoji}</span>
                  <span className="truncate">{food.nome}</span>
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
                  onClick={handleClose}
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
