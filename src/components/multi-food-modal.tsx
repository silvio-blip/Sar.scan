import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Minus,
  X,
  Loader2,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState, useEffect } from "react";
import { speakText, stopSpeech } from "@/lib/tts";
import { FoodImage } from "@/components/food-image";
import { useTranslation } from "@/lib/strings";
import { SarAiAvatar } from "@/components/sar-ai-avatar";

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
  feedbackMeta?: string | null;
  calibratedByHand?: boolean;
  onClose: () => void;
  onConfirm: (items: (ScannedFood & { porcoes: number })[]) => Promise<void> | void;
};

export function MultiFoodModal({
  items,
  photo,
  feedbackMeta,
  calibratedByHand,
  onClose,
  onConfirm,
}: Props) {
  const { t, lang, translateFoodName } = useTranslation();
  const [list, setList] = useState<(ScannedFood & { porcoes: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const nutrientBlocks = [
    {
      key: "cal",
      label: t("home.caloriesToday"),
      unit: " kcal",
      Icon: Flame,
      color: "text-orange-400",
    },
    { key: "carb", label: t("home.carbs"), unit: "g", Icon: Wheat, color: "text-amber-400" },
    { key: "prot", label: t("home.protein"), unit: "g", Icon: Beef, color: "text-rose-400" },
    { key: "gord", label: t("home.fats"), unit: "g", Icon: Droplet, color: "text-sky-400" },
  ] as const;

  useEffect(() => {
    if (items) setList(items.map((i) => ({ ...i, porcoes: 1 })));
    return () => {
      stopSpeech();
      setIsPlayingAudio(false);
    };
  }, [items]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleClose = () => {
    stopSpeech();
    setIsPlayingAudio(false);
    onClose();
  };

  const speakFeedback = async () => {
    if (!feedbackMeta) return;

    if (isPlayingAudio) {
      await stopSpeech();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    await speakText(feedbackMeta, () => setIsPlayingAudio(false));
  };

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
      await stopSpeech();
      await onConfirm(list);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!items} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto rounded-[28px] border border-border bg-background/96 p-0 shadow-2xl">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg sm:text-xl flex items-center gap-2">
              <span className="size-2 rounded-full bg-sage" /> {t("scanner.recentScans")}
            </DialogTitle>
            {calibratedByHand && (
              <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                🖐️ {t("calibration.profileActive")}
              </span>
            )}
          </div>
          <DialogDescription className="sr-only">
            {t("scanner.calibrateHandDesc")}
          </DialogDescription>

          {photo && (
            <div className="relative rounded-2xl overflow-hidden border border-border">
              <img src={photo} alt="scan" className="w-full h-36 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/85 to-transparent" />
            </div>
          )}

          {feedbackMeta && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary tracking-wide uppercase">
                  <SarAiAvatar size={24} className="shrink-0" /> {t("scanner.detected")}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={speakFeedback}
                  className="h-7 px-2.5 rounded-xl text-xs gap-1.5 border-primary/30 bg-background hover:bg-primary/10 text-primary transition-all"
                  title={isPlayingAudio ? t("diario.stopAudio") : t("diario.speakNutrients")}
                >
                  {isPlayingAudio ? (
                    <>
                      <VolumeX className="size-3.5 animate-pulse text-destructive" />{" "}
                      {t("diario.stopAudio")}
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-3.5" /> {t("diario.speakNutrients")}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                {feedbackMeta}
              </p>
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
                    className="size-14 sm:size-16 rounded-2xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight truncate">
                      {translateFoodName(it.nome, lang)}
                    </div>
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
                  {nutrientBlocks.map(({ key, label, unit, Icon, color }) => {
                    const v = (it as Record<string, unknown>)[key] as number;
                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-background/55 border border-border p-1.5 sm:p-2 text-center"
                      >
                        <Icon className={`size-3 mx-auto mb-0.5 ${color}`} />
                        <div className="text-xs sm:text-sm font-bold">
                          {Math.round(v * it.porcoes)}
                          {unit}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-[0.1em] truncate mt-0.5">
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
                    {it.porcoes}× {t("scanner.portion")}
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

          <div className="rounded-2xl border border-border bg-card/70 p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.22em] mb-2 text-center">
              {t("diario.mealDetails")}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {nutrientBlocks.map(({ key, label, unit, Icon, color }) => {
                const v = (total as Record<string, number>)[key];
                return (
                  <div key={key}>
                    <Icon className={`size-4 mx-auto mb-1 ${color}`} />
                    <div className="font-bold text-sm sm:text-base text-foreground">
                      {Math.round(v)}
                      {unit}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.1em] truncate">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={busy}
              className="h-11 rounded-2xl border-border bg-transparent text-xs font-bold"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handle}
              disabled={busy || list.length === 0}
              className="h-11 rounded-2xl bg-sage text-background hover:bg-sage/90 text-xs font-bold"
            >
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {t("scanner.adjust")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
