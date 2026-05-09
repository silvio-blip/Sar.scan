import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  Search,
  History,
  Crown,
  X,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ScannedFood } from "@/components/multi-food-modal";
import { SarLogo } from "@/components/sar-logo";
import { FoodImage } from "@/components/food-image";
import type { NutritionFood } from "@/components/nutrition-modal";
import { useSubscriptionRealtime, useRewardsRealtime } from "@/hooks/use-realtime-invalidate";
import { Gauge } from "@/components/gauge";
import { WaterTracker } from "@/components/water-tracker";

export const Route = createFileRoute("/_app/scanner")({ component: ScannerPage });

const today = () => new Date().toISOString().slice(0, 10);

function ScannerPage() {
  const { user, isPremium, isUnlimited, subscription, refresh, profile } = useAuth();
  const qc = useQueryClient();
  useSubscriptionRealtime(user?.id);
  useRewardsRealtime(user?.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [streamOn, setStreamOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<ScannedFood[] | null>(null);
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const [picked, setPicked] = useState<NutritionFood | null>(null);

  const { data: usage } = useQuery({
    queryKey: ["scan_usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("scan_usage")
        .select("count, bonus")
        .eq("user_id", user!.id)
        .eq("data", today())
        .maybeSingle();
      return data ?? { count: 0, bonus: 0 };
    },
  });

  const { data: water } = useQuery({
    queryKey: ["water", user?.id, today()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("water_intake")
        .select("ml")
        .eq("user_id", user!.id)
        .eq("data", today());
      return (data ?? []).reduce((s, r) => s + r.ml, 0);
    },
  });

  const { data: consumption } = useQuery({
    queryKey: ["consumption", user?.id, today()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("food_entries")
        .select("calorias")
        .eq("user_id", user!.id)
        .gte("created_at", today());
      return (data ?? []).reduce((s, r) => s + r.calorias, 0);
    },
  });

  const { data: sugestoes } = useQuery({
    queryKey: ["foods_sugestoes"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data } = await supabase
        .from("foods_basic")
        .select("nome, cal, carb, prot, gord, foto_url")
        .order("nome")
        .limit(30);
      return (data ?? []) as NutritionFood[];
    },
  });

  const baseScans = isUnlimited ? Infinity : isPremium ? (subscription?.scans_credits ?? 0) : 3;
  const remaining = isUnlimited
    ? Infinity
    : Math.max(0, baseScans + (usage?.bonus ?? 0) - (usage?.count ?? 0));

  useEffect(() => {
    // Midnight reset notification logic
    const lastVisit = localStorage.getItem("last_visit");
    const now = today();
    if (lastVisit && lastVisit !== now) {
      toast("Novo dia iniciado!", {
        description: "Suas metas e consumo de água foram reinicializados para hoje.",
      });
    }
    localStorage.setItem("last_visit", now);

    // Goal Deadline Check
    if (profile?.meta_prazo && new Date(profile.meta_prazo) <= new Date()) {
      const alerted = localStorage.getItem(`goal_alert_${profile.meta_prazo}`);
      if (!alerted) {
        toast.success("🎯 Meta Atingida!", {
          description: "O prazo da sua meta chegou! Confira seu progresso no perfil.",
          duration: 10000,
        });
        localStorage.setItem(`goal_alert_${profile.meta_prazo}`, "true");
      }
    }
  }, [profile?.meta_prazo]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamOn(true);
        }
      } catch {
        setStreamOn(false);
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const addWater = async (ml: number) => {
    if (!user) return;
    if (ml < 0) {
      const { data: rows } = await supabase
        .from("water_intake")
        .select("id")
        .eq("user_id", user.id)
        .eq("data", today())
        .order("created_at", { ascending: false })
        .limit(1);
      if (rows?.[0]) await supabase.from("water_intake").delete().eq("id", rows[0].id);
    } else {
      await supabase.from("water_intake").insert({ user_id: user.id, ml, data: today() });
    }
    qc.invalidateQueries({ queryKey: ["water"] });
  };

  const runScan = async (dataUrl: string) => {
    if (!user) return;
    if (remaining <= 0) {
      toast.error(
        isPremium
          ? "Créditos do plano esgotados. Faça upgrade ou aguarde a renovação."
          : "Limite diário atingido. Assine Premium!",
      );
      return;
    }
    setScanning(true);
    setScanPhoto(dataUrl);
    try {
      const { data, error } = await supabase.functions.invoke("scan-food", {
        body: { image: dataUrl },
      });
      if (error) throw error;
      if (data?.ok === false || !data?.itens?.length) {
        toast.message("Alimento não identificado", {
          description: data?.error ?? "Não conseguimos identificar um alimento nessa imagem.",
        });
        setScanPhoto(null);
        return;
      }
      if (isUnlimited) {
        // no-op
      } else if (isPremium) {
        const newCredits = Math.max(0, (subscription?.scans_credits ?? 0) - 1);
        await supabase
          .from("subscriptions")
          .update({ scans_credits: newCredits })
          .eq("user_id", user.id);
        await refresh();
      } else {
        await supabase.from("scan_usage").upsert(
          {
            user_id: user.id,
            data: today(),
            count: (usage?.count ?? 0) + 1,
            bonus: usage?.bonus ?? 0,
          },
          { onConflict: "user_id,data" },
        );
        qc.invalidateQueries({ queryKey: ["scan_usage"] });
      }
      setDetected(data.itens as ScannedFood[]);
    } catch (e) {
      console.error("Scan error:", e);
      toast.error(
        e instanceof Error 
          ? `Erro na identificação: ${e.message}` 
          : "Erro ao processar imagem. Tente novamente."
      );
      setScanPhoto(null);
    } finally {
      setScanning(false);
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !streamOn) {
      toast.error("Câmera indisponível — use Galeria");
      return;
    }
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    runScan(canvas.toDataURL("image/jpeg", 0.7));
  };

  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runScan(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const confirmar = async (items: (ScannedFood & { porcoes: number })[]) => {
    if (!user || items.length === 0) return;
    let uploadedPhotoUrl: string | null = null;
    if (scanPhoto?.startsWith("data:")) {
      try {
        const blob = await (await fetch(scanPhoto)).blob();
        const path = `${user.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("scan-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("scan-photos").getPublicUrl(path);
          uploadedPhotoUrl = pub.publicUrl;
        }
      } catch {
        /* ignore */
      }
    }
    const rows = items.map((it) => ({
      user_id: user.id,
      nome: it.nome,
      porcoes: it.porcoes,
      calorias: it.cal * it.porcoes,
      carbs: it.carb * it.porcoes,
      prot: it.prot * it.porcoes,
      gord: it.gord * it.porcoes,
      foto_url: uploadedPhotoUrl,
    }));
    await supabase.from("food_entries").insert(rows);
    qc.invalidateQueries();
    toast.success(`${items.length} alimento(s) adicionado(s)`);
    setDetected(null);
    setScanPhoto(null);
  };

  const adicionarSugestao = async (food: NutritionFood, p: number, fotoUrl: string | null) => {
    if (!user) return;
    await supabase.from("food_entries").insert({
      user_id: user.id,
      nome: food.nome,
      porcoes: p,
      calorias: Number(food.cal) * p,
      carbs: Number(food.carb) * p,
      prot: Number(food.prot) * p,
      gord: Number(food.gord) * p,
      foto_url: fotoUrl,
    });
    qc.invalidateQueries();
    toast.success("Adicionado ao diário");
    setPicked(null);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-1000">
      {/* Top Header */}
      <header className="flex items-center justify-between px-2 pt-2">
        <SarLogo size="sm" align="left" />
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
            Scans
          </div>
          <div className="text-sm font-display font-black text-white mt-0.5">
            {remaining === Infinity ? "∞" : remaining}
          </div>
        </div>
      </header>

      {/* Main Container - Flat background as requested */}
      <section className="p-2 pb-8 flex flex-col items-center gap-6 relative overflow-hidden">
        {/* No explicit border/background for the container, just the elements on the black bg */}

        {/* Metas Gauge - Smallized */}
        <div className="w-full flex flex-col items-center transform scale-[0.8] mt-2 relative z-10">
          <Gauge
            current={Math.round(consumption ?? 0)}
            target={profile?.meta_calorias ?? 2000}
            label="Metas"
          />
        </div>

        {/* Water Tracker - Integrated */}
        <div className="w-full relative z-10 -mt-6">
          <WaterTracker
            currentMl={water ?? 0}
            targetMl={profile?.meta_agua ?? 2000}
            onAdd={addWater}
          />
        </div>

        {/* Camera/Results View Area */}
        <div className="w-full relative min-h-[400px]">
          {!detected && !picked && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full aspect-square rounded-[40px] bg-black/40 overflow-hidden border border-white/5 shadow-inner group"
            >
              {scanning && scanPhoto ? (
                <motion.img
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={scanPhoto}
                  className="absolute inset-0 w-full h-full object-cover grayscale-[20%]"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-300"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20" />

              {/* Brackets */}
              <div className="absolute inset-4 pointer-events-none z-20">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-3xl opacity-40" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-3xl opacity-40" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-3xl opacity-40" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-3xl opacity-40" />

                {/* Scanning Line */}
                <motion.div
                  animate={{ top: scanning ? ["10%", "90%", "10%"] : ["35%", "65%", "35%"] }}
                  transition={{ duration: scanning ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute left-4 right-4 h-[2px] transition-all duration-500 ${scanning ? "bg-white shadow-[0_0_20px_white] opacity-100" : "bg-white opacity-20"} blur-[1px]`}
                />
              </div>

              {scanning && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] flex items-center justify-center z-30">
                  <div className="flex flex-col items-center gap-4">
                    <div className="size-16 rounded-full border-4 border-white/10 border-t-white animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                      Analisando Imagem
                    </span>
                  </div>
                </div>
              )}

              {!streamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 text-center px-10 leading-loose">
                    Ative a câmera nas
                    <br />
                    configurações do navegador
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {(detected || picked) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full bg-black/40 rounded-[40px] border border-white/10 overflow-hidden"
            >
              {/* Results Content */}
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">
                      {detected ? "Itens Detectados" : "Nutrição"}
                    </p>
                    <h3 className="text-2xl font-display font-black tracking-tight text-white leading-none">
                      {detected ? `${detected.length} itens encontrados` : picked?.nome}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setDetected(null);
                      setPicked(null);
                      setScanPhoto(null);
                    }}
                    className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <X className="size-5 text-white/40" />
                  </button>
                </div>

                {scanPhoto && (
                  <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl">
                    <img
                      src={scanPhoto}
                      alt="scan"
                      className="w-full h-full object-cover grayscale-[30%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}

                <div className="space-y-4">
                  {detected?.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.03] border border-white/5"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-base text-white">{it.nome}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/20">
                          {Math.round(it.cal)} kcal
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-black/40 rounded-2xl p-1 px-3">
                        <span className="text-xs font-black text-white/60">1x</span>
                      </div>
                    </div>
                  ))}

                  {picked && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Calorias", val: Math.round(picked.cal), icon: Flame },
                        { label: "Carbos", val: Math.round(picked.carb), icon: Wheat },
                        { label: "Prots", val: Math.round(picked.prot), icon: Beef },
                        { label: "Gordura", val: Math.round(picked.gord), icon: Droplet },
                      ].map((b) => (
                        <div
                          key={b.label}
                          className="p-4 rounded-3xl bg-white/[0.02] border border-white/5"
                        >
                          <b.icon className="size-4 text-white/20 mb-2" />
                          <div className="text-[9px] font-black uppercase tracking-widest text-white/20">
                            {b.label}
                          </div>
                          <div className="text-xl font-display font-black text-white">{b.val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    if (detected) confirmar(detected.map((d) => ({ ...d, porcoes: 1 })));
                    if (picked) adicionarSugestao(picked, 1, picked.foto_url ?? null);
                  }}
                  className="w-full h-16 rounded-[28px] bg-white text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-zinc-200 shadow-2xl shadow-white/5"
                >
                  Adicionar ao Diário
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Capture Button container - Only show when no results */}
        {!detected && !picked && (
          <div className="flex flex-col items-center gap-4 mt-2">
            <button
              onClick={captureAndScan}
              disabled={scanning || !streamOn}
              className="group relative size-24 rounded-full flex items-center justify-center transition-all duration-700 active:scale-90 disabled:opacity-30"
            >
              <div className="absolute inset-0 rounded-full bg-white/20 blur-2xl group-hover:scale-110 transition-transform opacity-0 group-hover:opacity-100" />
              <div className="size-20 rounded-full bg-[#E0E0E0] shadow-2xl flex items-center justify-center z-10 transition-transform group-hover:scale-105 active:scale-95">
                <div className="size-16 rounded-full border-4 border-white/40" />
              </div>
            </button>
          </div>
        )}
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickGallery}
      />

      {/* Suggested Section */}
      <section className="w-full space-y-10 pt-10 border-t border-white/10">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-display font-black text-2xl text-white tracking-tight">Sugestões</h2>
          <Link
            to="/buscar"
            className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] hover:text-white transition-all"
          >
            Explorar tudo
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {sugestoes?.slice(0, 4).map((f, i) => (
            <motion.button
              key={`${f.nome}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              onClick={() => setPicked(f)}
              className="glass rounded-[40px] p-3 text-left hover:bg-white/5 transition-all duration-500 flex flex-col gap-4 group border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/[0.01]" />
              <div className="relative aspect-square w-full rounded-[32px] overflow-hidden shadow-inner">
                <FoodImage
                  src={f.foto_url}
                  alt={f.nome}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out grayscale-[20%] group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-3 right-3 glass-strong px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-xl border border-white/10">
                  {Math.round(f.cal)} kcal
                </div>
              </div>
              <div className="px-2 pb-2">
                <div className="font-bold text-sm text-white line-clamp-2 tracking-tight leading-snug min-h-[2.5rem]">
                  {f.nome}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mt-2">
                  Toque para adicionar
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
