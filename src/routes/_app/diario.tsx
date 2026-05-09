import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Camera, Loader2 } from "lucide-react";
import { FoodImage } from "@/components/food-image";
import { uploadFoodPhoto } from "@/lib/upload-food-photo";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

function DiarioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Entry | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: entries } = useQuery({
    queryKey: ["entries", user?.id, today()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("food_entries")
        .select("*")
        .eq("user_id", user!.id)
        .eq("data", today())
        .order("created_at", { ascending: false });
      return (data ?? []) as Entry[];
    },
  });

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

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-display font-black tracking-tight text-white">Diário</h1>
        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em]">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Main Focus: Daily Total */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-[56px] p-12 text-center flex flex-col items-center gap-4 border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.4)] relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
        <div className="absolute -top-20 -right-20 size-60 bg-white/5 blur-[100px] rounded-full group-hover:bg-white/10 transition-all duration-1000" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">
            Consumo do Dia
          </div>
          <div className="text-7xl font-display font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            {Math.round(totalCal)}
          </div>
          <div className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mt-2">
            quilocalorias
          </div>
        </div>

        <div className="w-full h-[1px] bg-white/10 my-4 relative z-10" />

        <div className="grid grid-cols-3 w-full gap-4 relative z-10">
          {[
            { l: "Prot", v: entries?.reduce((s, e) => s + Number(e.prot), 0) ?? 0 },
            { l: "Carb", v: entries?.reduce((s, e) => s + Number(e.carbs), 0) ?? 0 },
            { l: "Gord", v: entries?.reduce((s, e) => s + Number(e.gord), 0) ?? 0 },
          ].map((m) => (
            <div key={m.l} className="flex flex-col items-center">
              <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">
                {m.l}
              </div>
              <div className="text-sm font-black text-white">{Math.round(m.v)}g</div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
            Refeições
          </h2>
          <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">
            {entries?.length ?? 0} ITENS
          </div>
        </div>

        <div className="grid gap-3">
          {entries && entries.length > 0 ? (
            entries.map((e, idx) => (
              <motion.button
                key={e.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                onClick={() => setOpen(e)}
                className="w-full text-left flex items-center gap-5 rounded-[32px] p-4 glass border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/[0.01]" />
                <div className="size-16 rounded-[22px] overflow-hidden shadow-2xl border border-white/10 shrink-0 group-hover:scale-110 transition-transform duration-700">
                  <FoodImage
                    src={e.foto_url}
                    alt={e.nome}
                    className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all"
                  />
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="font-bold text-base text-white truncate mb-1 tracking-tight">
                    {e.nome}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      {Math.round(Number(e.calorias))} KCAL
                    </span>
                    <div className="size-1 rounded-full bg-white/10" />
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                      P{Math.round(Number(e.prot))} · C{Math.round(Number(e.carbs))}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="py-20 text-center glass rounded-[40px] border-white/5 flex flex-col items-center gap-4">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-white/20 animate-pulse" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
                Nenhum registro hoje
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="px-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
          Performance (Calorias)
        </h2>
        <div className="glass rounded-[48px] p-8 border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent" />
          <div className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly ?? []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.03)"
                />
                <XAxis
                  dataKey="dia"
                  tick={{
                    fontSize: 9,
                    fill: "rgba(255,255,255,0.3)",
                    fontWeight: "900",
                    letterSpacing: "1px",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)", radius: [12, 12, 12, 12] }}
                  contentStyle={{
                    backgroundColor: "rgba(10,10,10,0.95)",
                    borderRadius: "24px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "10px",
                    color: "#fff",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                  }}
                />
                <Bar
                  dataKey="cal"
                  fill="#FFFFFF"
                  radius={[12, 12, 12, 12]}
                  barSize={32}
                  className="opacity-90 hover:opacity-100 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="px-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
          Hidratação (ml)
        </h2>
        <div className="glass rounded-[48px] p-8 border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/[0.05] to-transparent" />
          <div className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyWater ?? []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.03)"
                />
                <XAxis
                  dataKey="dia"
                  tick={{
                    fontSize: 9,
                    fill: "rgba(255,255,255,0.3)",
                    fontWeight: "900",
                    letterSpacing: "1px",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)", radius: [12, 12, 12, 12] }}
                  contentStyle={{
                    backgroundColor: "rgba(10,10,10,0.95)",
                    borderRadius: "24px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "10px",
                    color: "#fff",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                  }}
                />
                <Bar
                  dataKey="ml"
                  fill="#3b82f6"
                  radius={[12, 12, 12, 12]}
                  barSize={32}
                  className="opacity-80 hover:opacity-100 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-sm glass border-white/10 rounded-[40px] p-6 shadow-2xl">
          <DialogTitle className="text-xl font-display font-black tracking-tight text-white">
            {open?.nome}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes nutricionais e ações do alimento salvo no diário
          </DialogDescription>
          {open && (
            <div className="space-y-6">
              <div className="relative group">
                <FoodImage
                  src={open.foto_url}
                  alt={open.nome}
                  className="w-full h-48 rounded-[32px] object-cover shadow-2xl grayscale-[30%] group-hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-t from-black/40 to-transparent opacity-60" />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={trocarFoto}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-3 right-3 rounded-2xl glass-strong border-white/20 shadow-2xl gap-2 font-black text-[10px] uppercase tracking-widest h-10 px-4 active:scale-95 transition-all text-white"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  {open.foto_url ? "Mudar foto" : "Adicionar foto"}
                </Button>
              </div>

              <div className="flex items-center gap-2 px-2">
                <div className="h-0.5 flex-1 bg-white/5" />
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                  Valores Totais
                </div>
                <div className="h-0.5 flex-1 bg-white/5" />
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
                    className="bg-white/5 rounded-[24px] p-4 text-center border border-white/5 shadow-inner"
                  >
                    <div className="font-display font-black text-2xl text-white tracking-tighter">
                      {v}
                      <span className="text-[10px] ml-0.5 text-white/30 tracking-widest">{u}</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">
                      {k}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <div className="text-[10px] text-center font-black uppercase tracking-[0.2em] text-white/20">
                  {open.porcoes} porção{open.porcoes !== 1 ? "es" : ""} consumida
                  {open.porcoes !== 1 ? "s" : ""}
                </div>
                <Button
                  variant="ghost"
                  className="w-full h-14 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-400/5 font-black uppercase tracking-widest text-[10px] transition-all"
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
