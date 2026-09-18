import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Camera, Image as ImageIcon, Loader2, ArrowLeft } from "lucide-react";
import { FoodImage } from "@/components/food-image";
import { uploadFoodPhoto } from "@/lib/upload-food-photo";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { isInstalledApp, dataURLtoFile } from "@/lib/utils";

export const Route = createFileRoute("/_app/diario")({ component: DiarioPage });

const today = () => new Date().toISOString().slice(0, 10);

type Entry = {
  id: string;
  nome: string;
  calorias: number;
  prot: number;
  carbs: number;
  gord: number;
  porcoes: number;
  foto_url: string | null;
};

export function DiarioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Entry | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: entries } = useQuery({
    queryKey: ["entries", user?.id, today()],
    enabled: !!user,
    queryFn: async () => {
      const todayStr = today();
      const { data } = await supabase
        .from("food_entries")
        .select("*")
        .eq("user_id", user!.id)
        .or(`data.eq.${todayStr},created_at.gte.${todayStr}T00:00:00.000Z`)
        .order("created_at", { ascending: false });
      return (data ?? []) as Entry[];
    },
  });

  React.useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`realtime-diario-sync-${user.id}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "food_entries",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["entries"] });
          qc.invalidateQueries({ queryKey: ["weekly"] });
          qc.invalidateQueries({ queryKey: ["consumption"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "water_intake",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["water_history"] });
          qc.invalidateQueries({ queryKey: ["weekly_water"] });
          qc.invalidateQueries({ queryKey: ["water"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const { data: weekly } = useQuery({
    queryKey: ["weekly", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("food_entries")
        .select("data, calorias")
        .eq("user_id", user!.id)
        .gte("data", startStr);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        const cal = (data ?? [])
          .filter((r) => r.data === key)
          .reduce((s, r) => s + Number(r.calorias), 0);
        return { dia: format(d, "EEE", { locale: ptBR }).slice(0, 3), cal: Math.round(cal) };
      });
      return days;
    },
  });

  const { data: waterHistory } = useQuery({
    queryKey: ["water_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("water_intake")
        .select("*")
        .eq("user_id", user!.id)
        .eq("data", today());
      return (data ?? []).reduce((s, r) => s + r.ml, 0);
    },
  });

  const { data: weeklyWater } = useQuery({
    queryKey: ["weekly_water", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("water_intake")
        .select("data, ml")
        .eq("user_id", user!.id)
        .gte("data", startStr);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        const ml = (data ?? []).filter((r) => r.data === key).reduce((s, r) => s + Number(r.ml), 0);
        return { dia: format(d, "EEE", { locale: ptBR }).slice(0, 3), ml: Math.round(ml) };
      });
      return days;
    },
  });

  const totalCal = (entries ?? []).reduce((s, e) => s + Number(e.calorias), 0);

  const remover = async (id: string) => {
    await supabase.from("food_entries").delete().eq("id", id);
    qc.invalidateQueries();
    setOpen(null);
    toast.success("Removido");
  };

  const trocarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !open || !user) return;

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
        "Por favor, selecione um arquivo de imagem válido (PNG, JPEG, WEBP). Outros formatos não são permitidos.",
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const url = await uploadFoodPhoto(file, user.id, "edit");
      const { error } = await supabase
        .from("food_entries")
        .update({ foto_url: url })
        .eq("id", open.id);
      if (error) throw error;
      setOpen({ ...open, foto_url: url });
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Foto atualizada");
    } catch {
      toast.error("Falha ao salvar foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakeLivePhoto = async () => {
    if (isInstalledApp()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        try {
          const check = await Camera.checkPermissions();
          if (check.camera !== "granted") {
            await Camera.requestPermissions({ permissions: ["camera"] });
          }
        } catch (permErr) {
          console.warn("[Capacitor Permissions Error]", permErr);
        }

        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo.dataUrl && open && user) {
          setUploadingPhoto(true);
          try {
            const file = await dataURLtoFile(photo.dataUrl, `edited-live-${Date.now()}.jpg`);
            const url = await uploadFoodPhoto(file, user.id, "edit");
            const { error } = await supabase
              .from("food_entries")
              .update({ foto_url: url })
              .eq("id", open.id);
            if (error) throw error;
            setOpen({ ...open, foto_url: url });
            qc.invalidateQueries({ queryKey: ["entries"] });
            toast.success("Foto atualizada com sucesso");
          } catch (uploadErr) {
            console.error("Upload error of capacitor file:", uploadErr);
            toast.error("Falha ao salvar foto");
          } finally {
            setUploadingPhoto(false);
          }
        }
      } catch (err: any) {
        console.error("Capacitor camera error:", err);
        if (
          err?.message !== "User cancelled photos app" &&
          err?.message?.indexOf("cancelled") === -1
        ) {
          cameraRef.current?.click();
        }
      }
    } else {
      cameraRef.current?.click();
    }
  };

  const handleSelectPhoto = async () => {
    if (isInstalledApp()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        try {
          const check = await Camera.checkPermissions();
          if (check.photos !== "granted") {
            await Camera.requestPermissions({ permissions: ["photos"] });
          }
        } catch (permErr) {
          console.warn("[Capacitor Permissions Error]", permErr);
        }

        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });

        if (photo.dataUrl && open && user) {
          setUploadingPhoto(true);
          try {
            const file = await dataURLtoFile(photo.dataUrl, `edited-photo-${Date.now()}.jpg`);
            const url = await uploadFoodPhoto(file, user.id, "edit");
            const { error } = await supabase
              .from("food_entries")
              .update({ foto_url: url })
              .eq("id", open.id);
            if (error) throw error;
            setOpen({ ...open, foto_url: url });
            qc.invalidateQueries({ queryKey: ["entries"] });
            toast.success("Foto atualizada");
          } catch (uploadErr) {
            console.error("Upload error of capacitor file:", uploadErr);
            toast.error("Falha ao salvar foto");
          } finally {
            setUploadingPhoto(false);
          }
        }
      } catch (err: any) {
        console.error("Capacitor picker error:", err);
        if (
          err?.message !== "User cancelled photos app" &&
          err?.message?.indexOf("cancelled") === -1
        ) {
          fileRef.current?.click();
        }
      }
    } else {
      fileRef.current?.click();
    }
  };

  return (
    <div className="space-y-8 select-none pb-8 transform-gpu">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-4xl font-display font-black tracking-tight text-foreground">
            Diário
          </h1>
          <p className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.25em]">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Link
          to="/perfil"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground font-bold text-xs transition border border-border shadow-sm"
        >
          <ArrowLeft className="size-4" />
          <span>Perfil</span>
        </Link>
      </div>

      {/* Main Focus: Daily Total (Warm-Beige Glass Card) */}
      <div className="bg-secondary/40 rounded-[36px] p-8 text-center flex flex-col items-center gap-4 border border-border/60 shadow-sm relative overflow-hidden group transform-gpu">
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">
            Consumo de Hoje
          </div>
          <div className="text-6xl sm:text-7xl font-display font-black text-foreground tracking-tighter drop-shadow-sm">
            {Math.round(totalCal)}
          </div>
          <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.3em] mt-2">
            quilocalorias
          </div>
        </div>

        <div className="w-full h-[1px] bg-border/80 my-2 relative z-10" />

        <div className="grid grid-cols-3 w-full gap-3 relative z-10">
          {[
            {
              l: "Prot",
              v: entries?.reduce((s, e) => s + Number(e.prot), 0) ?? 0,
              color: "text-accent",
            },
            {
              l: "Carb",
              v: entries?.reduce((s, e) => s + Number(e.carbs), 0) ?? 0,
              color: "text-foreground",
            },
            {
              l: "Gord",
              v: entries?.reduce((s, e) => s + Number(e.gord), 0) ?? 0,
              color: "text-muted-foreground",
            },
          ].map((m) => (
            <div key={m.l} className="flex flex-col items-center">
              <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                {m.l}
              </div>
              <div className="text-sm font-black text-foreground">{Math.round(m.v)}g</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Refeições
          </h2>
          <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">
            {entries?.length ?? 0} {entries?.length === 1 ? "ITEM" : "ITENS"}
          </div>
        </div>

        <div className="grid gap-3">
          {entries && entries.length > 0 ? (
            entries.map((e, idx) => (
              <motion.button
                key={e.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * idx }}
                onClick={() => setOpen(e)}
                className="w-full text-left flex items-center gap-4 rounded-[28px] p-4 bg-card border border-border/50 hover:bg-secondary/20 hover:border-border transition-all group relative overflow-hidden shadow-sm"
              >
                <div className="size-16 rounded-2xl overflow-hidden shadow-sm border border-border shrink-0 group-hover:scale-105 transition-transform duration-500">
                  <FoodImage
                    src={e.foto_url}
                    alt={e.nome}
                    className="w-full h-full object-cover group-hover:brightness-105 transition-all"
                  />
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="font-bold text-base text-foreground truncate mb-1 tracking-tight">
                    {e.nome}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {Math.round(Number(e.calorias))} KCAL
                    </span>
                    <div className="size-1 rounded-full bg-border" />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      P{Math.round(Number(e.prot))} · C{Math.round(Number(e.carbs))}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="py-16 text-center bg-secondary/15 rounded-[36px] border border-border/40 flex flex-col items-center gap-3">
              <div className="size-10 rounded-full bg-primary-soft flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
                Nenhum registro hoje
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
          Performance (Calorias)
        </h2>
        <div className="bg-secondary/20 rounded-[36px] p-6 border border-border/40 shadow-sm relative overflow-hidden">
          <div className="h-44 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly ?? []}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="rgba(46,74,59,0.06)"
                />
                <XAxis
                  dataKey="dia"
                  tick={{
                    fontSize: 9,
                    fill: "var(--color-muted-foreground)",
                    fontWeight: "700",
                    letterSpacing: "0.5px",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(46,74,59,0.03)", radius: [8, 8, 8, 8] }}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderRadius: "16px",
                    border: "1px solid var(--color-border)",
                    fontSize: "10px",
                    color: "var(--color-foreground)",
                    boxShadow: "0 8px 24px rgba(46,74,59,0.06)",
                  }}
                />
                <Bar
                  dataKey="cal"
                  fill="var(--color-primary)"
                  radius={[8, 8, 8, 8]}
                  barSize={20}
                  className="opacity-90 hover:opacity-100 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
          Hidratação (ml)
        </h2>
        <div className="bg-secondary/20 rounded-[36px] p-6 border border-border/40 shadow-sm relative overflow-hidden">
          <div className="h-44 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyWater ?? []}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="rgba(46,74,59,0.06)"
                />
                <XAxis
                  dataKey="dia"
                  tick={{
                    fontSize: 9,
                    fill: "var(--color-muted-foreground)",
                    fontWeight: "700",
                    letterSpacing: "0.5px",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(46,74,59,0.03)", radius: [8, 8, 8, 8] }}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderRadius: "16px",
                    border: "1px solid var(--color-border)",
                    fontSize: "10px",
                    color: "var(--color-foreground)",
                    boxShadow: "0 8px 24px rgba(46,74,59,0.06)",
                  }}
                />
                <Bar
                  dataKey="ml"
                  fill="var(--color-water)"
                  radius={[8, 8, 8, 8]}
                  barSize={20}
                  className="opacity-90 hover:opacity-100 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-sm bg-card border border-border rounded-[36px] p-6 shadow-xl text-foreground">
          <DialogTitle className="text-xl font-display font-bold tracking-tight text-foreground">
            {open?.nome}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes nutricionais e ações do alimento salvo no diário
          </DialogDescription>
          {open && (
            <div className="space-y-6">
              <div className="relative group overflow-hidden rounded-[24px] border border-border">
                <FoodImage
                  src={open.foto_url}
                  alt={open.nome}
                  className="w-full h-44 object-cover group-hover:scale-105 transition-all duration-700"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.heic,.heif,image/*"
                  className="sr-only absolute pointer-events-none w-0 h-0"
                  onChange={trocarFoto}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only absolute pointer-events-none w-0 h-0"
                  onChange={trocarFoto}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-2xl bg-white/95 text-zinc-900 border border-zinc-200 shadow-sm gap-1.5 font-black text-[10px] uppercase tracking-widest h-9 px-3 active:scale-95 transition-all hover:bg-white"
                    onClick={handleTakeLivePhoto}
                    disabled={uploadingPhoto}
                    title="Tirar foto em tempo real agora"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="size-3.5 animate-spin text-zinc-900" />
                    ) : (
                      <Camera className="size-3.5 text-emerald-600" />
                    )}
                    <span>Tirar Foto</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-2xl bg-white/95 text-zinc-900 border border-zinc-200 shadow-sm gap-1.5 font-black text-[10px] uppercase tracking-widest h-9 px-3 active:scale-95 transition-all hover:bg-white"
                    onClick={handleSelectPhoto}
                    disabled={uploadingPhoto}
                    title="Escolher foto da galeria"
                  >
                    <ImageIcon className="size-3.5 text-sky-600" />
                    <span>Galeria</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border" />
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap">
                  Valores Totais
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Calorias", Math.round(Number(open.calorias)), "kcal"],
                  ["Proteínas", Math.round(Number(open.prot)), "g"],
                  ["Carbos", Math.round(Number(open.carbs)), "g"],
                  ["Gorduras", Math.round(Number(open.gord)), "g"],
                ].map(([k, v, u]) => (
                  <div
                    key={String(k)}
                    className="bg-secondary/30 rounded-[20px] p-4 text-center border border-border/80 shadow-inner"
                  >
                    <div className="font-display font-black text-2.5xl text-foreground tracking-tighter">
                      {v}
                      <span className="text-[10px] ml-0.5 text-muted-foreground tracking-widest">
                        {u}
                      </span>
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                      {k}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <div className="text-[10px] text-center font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {open.porcoes} porção{open.porcoes !== 1 ? "es" : ""} consumida
                  {open.porcoes !== 1 ? "s" : ""}
                </div>
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-500/5 font-black uppercase tracking-widest text-[10px] transition-all"
                  onClick={() => remover(open.id)}
                >
                  <Trash2 className="size-4 mr-2" /> Excluir do diário
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
