import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isInstalledApp, getFoodEmoji } from "@/lib/utils";
import { useCamera } from "@/lib/CameraContext";
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
  RefreshCw,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { ScannedFood } from "@/components/multi-food-modal";
import { MultiFoodModal } from "@/components/multi-food-modal";
import { SarLogo } from "@/components/sar-logo";
import { FoodImage } from "@/components/food-image";
import { NutritionModal } from "@/components/nutrition-modal";
import type { NutritionFood } from "@/components/nutrition-modal";
import { useSubscriptionRealtime, useRewardsRealtime } from "@/hooks/use-realtime-invalidate";
import { Gauge } from "@/components/gauge";
import { WaterTracker } from "@/components/water-tracker";
import { NutritionTip } from "@/components/nutrition-tip";

import { CreditDisplay } from "@/components/credit-display";

export const Route = createFileRoute("/_app/scanner")({ component: ScannerPage });

const today = () => new Date().toISOString().slice(0, 10);

function cleanApiKey(val: string | undefined | null): string | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.trim();
  if (
    !cleaned ||
    cleaned === "undefined" ||
    cleaned === "null" ||
    cleaned === '""' ||
    cleaned === "''"
  ) {
    return null;
  }
  return cleaned;
}

function ScannerPage() {
  const { user, isPremium, isUnlimited, subscription, refresh, profile } = useAuth();
  const qc = useQueryClient();
  const { stream, streamOn, startCamera, stopCamera, facingMode, toggleCamera } = useCamera();
  useSubscriptionRealtime(user?.id);
  useRewardsRealtime(user?.id);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<ScannedFood[] | null>(null);
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const [picked, setPicked] = useState<NutritionFood | null>(null);

  useEffect(() => {
    startCamera("environment");
    return () => {
      // stopCamera(); // Persistindo câmera ao mudar de aba
    };
  }, [startCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      return;
    }

    // Apenas atribui se for um stream diferente para evitar cintilação, reinicializações e congelamentos
    if (video.srcObject !== stream) {
      console.log("[ScannerPage] Associando stream ao elemento de vídeo de forma otimizada...");
      video.srcObject = stream;
    }

    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;

    const playVideo = () => {
      video.play().catch((err) => {
        console.warn("[ScannerPage] Falha ao iniciar vídeo via evento 'loadedmetadata':", err);
      });
    };

    video.addEventListener("loadedmetadata", playVideo);

    // Forçar início também imediatamente por segurança
    video.play().catch((err) => {
      console.warn("[ScannerPage] Falha ao iniciar reprodução imediata de vídeo:", err);
    });

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
    };
  }, [stream]);

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

  const dailyFreeRemaining = Math.max(0, 3 - (usage?.count ?? 0));
  const remaining = isUnlimited
    ? Infinity
    : dailyFreeRemaining + (subscription?.scans_credits ?? 0) + (usage?.bonus ?? 0);

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

  const resizeAndCompressImage = (url: string, maxDim = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w <= maxDim && h <= maxDim) {
          resolve(url);
          return;
        }
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(url);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        resolve(url);
      };
    });
  };

  const runScan = async (rawUrl: string) => {
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
    try {
      const dataUrl = await resizeAndCompressImage(rawUrl);
      setScanPhoto(dataUrl);

      // --- DIAGNÓSTICO / HEALTH CHECK COORDENADO ---
      const supabaseUrl = (supabase as any).supabaseUrl || "";
      const supabaseKey = (supabase as any).supabaseKey || "";
      const maskedKey = supabaseKey
        ? supabaseKey.slice(0, 12) + "..." + supabaseKey.slice(-6)
        : "ausente";

      console.log("=== [Sar.scan Diagnóstico de Rede] ===");
      console.log("📍 Supabase URL:", supabaseUrl);
      console.log("🔑 Supabase Key (Mascarada):", maskedKey);

      if (!supabaseUrl) {
        throw new Error(
          "A URL do Supabase é indefinida no frontend. Verifique suas variáveis de ambiente.",
        );
      }

      if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
        console.warn(
          "⚠️ ATENÇÃO: A URL aponta para localhost! Em emuladores Android, use 'http://10.0.2.2:54321' em vez de localhost/127.0.0.1 para acessar as funções locais.",
        );
      }

      const rawClientApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const clientApiKey = cleanApiKey(rawClientApiKey);
      let textoFinal = "";

      const callServerProxy = async (imageStr: string) => {
        console.log("🔌 A usar proxy de servidor...");
        const response = await fetch("/api/gemini-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data: imageStr }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }

        const responseData = await response.json();
        return responseData.result;
      };

      if (clientApiKey && clientApiKey.startsWith("AIzaSy")) {
        console.log("🚀 A iniciar scan direto de IA no Frontend (REST API compatível)...");
        try {
          const parts = dataUrl.split(",");
          const base64Data = parts.length > 1 ? parts[1] : parts[0];
          const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

          const promptText = `Analisa esta imagem de comida.
Retorna UM OBJETO JSON ESTRITAMENTE, sem texto extra, markdown, ou explicações.
O formato deve ser exatamente:
{
  "itens": [
    { 
      "nome": "string",
      "quantidade": "string (ex: 100g, 1 unidade)",
      "cal": number, 
      "carb": number, 
      "prot": number, 
      "gord": number 
    }
  ]
}`;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(clientApiKey)}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API do Gemini (${response.status}): ${errorText}`);
          }

          const responseData = await response.json();
          textoFinal = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          console.log("✅ Sucesso em scan direto de IA!");
        } catch (erroDireto: any) {
          console.warn(
            "💥 Erro no scan direto de IA, a tentar proxy do servidor como fallback:",
            erroDireto,
          );
          textoFinal = await callServerProxy(dataUrl);
        }
      } else {
        textoFinal = await callServerProxy(dataUrl);
      }

      console.log("✅ RAW DATA RECEIVED:", textoFinal);

      // Parse o JSON retornado pela IA
      let parsedResult;
      try {
        // Limpeza básica se a IA retornar markdown code blocks
        const jsonStr = textoFinal.replace(/```json\n?|\n?```/g, "").trim();
        parsedResult = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Erro ao fazer parse do resultado:", e);
        throw new Error(
          "Não foi possível processar a resposta da IA. O formato de resposta retornado pela IA está incorreto ou incompleto.",
        );
      }

      const itens = parsedResult.itens || [];

      if (itens.length === 0) {
        toast.info("Nenhum alimento identificado.", {
          description:
            "Tente tirar outra foto mais de perto, com melhor enquadramento e sob boa iluminação.",
        });
        setDetected(null);
        setScanPhoto(null);
        setScanning(false);
        return;
      }

      setDetected(itens as ScannedFood[]);

      // Seguir com a lógica de sucesso (refresh etc)
      await refresh();
      qc.invalidateQueries({ queryKey: ["scan_usage"] });
      return;
    } catch (e: any) {
      console.error("Detalhes do erro:", e);
      toast.error(
        e instanceof Error
          ? `Erro na identificação: ${e.message}`
          : "Erro ao processar imagem. Tente novamente.",
      );
      setScanPhoto(null);
    } finally {
      setScanning(false);
    }
  };

  const captureAndScan = async () => {
    const v = videoRef.current;
    if (!v || !streamOn || !stream) {
      toast.error("Câmera indisponível — use Galeria");
      return;
    }
    const width = v.videoWidth || 1280;
    const height = v.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    runScan(canvas.toDataURL("image/jpeg", 0.7));
  };

  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        "Por favor, selecione um arquivo de imagem válido (PNG, JPEG, WEBP). Outros formatos não são permitidos por segurança.",
      );
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => runScan(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGalleryUpload = async () => {
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

        if (photo.dataUrl) {
          runScan(photo.dataUrl);
        }
      } catch (err: any) {
        console.error("Capacitor gallery pick error:", err);
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
    <div className="flex flex-col gap-4 animate-in fade-in duration-1000 select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-2 pt-2">
        <SarLogo size="sm" align="left" />
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
            Scans Restantes
          </div>
          <div className="text-sm font-display font-black text-foreground mt-0.5">
            <CreditDisplay value={remaining} />
          </div>
        </div>
      </header>

      {/* Main Container - Warm sand aesthetic */}
      <section className="p-2 pb-6 flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Metas Gauge - Smaller and warm */}
        <div className="w-full flex flex-col items-center transform scale-[0.85] mt-1 relative z-10">
          <Gauge
            current={Math.round(consumption ?? 0)}
            target={profile?.meta_calorias ?? 2000}
            label="Kcal de Hoje"
          />
        </div>

        {/* Water Tracker */}
        <div className="w-full relative z-10 -mt-4">
          <WaterTracker
            currentMl={water ?? 0}
            targetMl={profile?.meta_agua ?? 2000}
            onAdd={addWater}
          />
        </div>

        {/* Tip of the Day */}
        <div className="w-full relative z-10">
          <NutritionTip />
        </div>

        {/* Camera/Results View Area */}
        <div className="w-full relative min-h-[360px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full aspect-square rounded-[36px] bg-secondary/35 overflow-hidden border border-border shadow-inner group"
          >
            {/* Camera View */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                (scanning && scanPhoto) || (detected && scanPhoto)
                  ? "opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
            />

            {/* Alternar Câmera Button Overlay */}
            {streamOn && !scanning && !detected && (
              <button
                type="button"
                onClick={toggleCamera}
                className="absolute top-4 right-4 z-30 p-3 bg-zinc-950/75 hover:bg-zinc-950 backdrop-blur-md rounded-full border border-white/20 text-white transition-all active:scale-90 duration-200 cursor-pointer shadow-lg flex items-center justify-center group/btn"
                title="Alternar câmera frontal/traseira"
              >
                <RefreshCw className="size-5 transition-transform duration-500 group-hover/btn:rotate-180" />
              </button>
            )}

            {/* Static Result Image */}
            {(scanning || detected) && scanPhoto && (
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={scanPhoto}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-black/20" />

            {/* Brackets (Organic Green instead of cold white) */}
            <div className="absolute inset-5 pointer-events-none z-20">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-2xl opacity-60" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-2xl opacity-60" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-2xl opacity-60" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-2xl opacity-60" />

              {/* Scanning Green Line */}
              <motion.div
                animate={{ top: scanning ? ["10%", "90%", "10%"] : ["35%", "65%", "35%"] }}
                transition={{ duration: scanning ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute left-4 right-4 h-[2px] transition-all duration-500 ${scanning ? "bg-primary shadow-[0_0_15px_var(--color-primary)] opacity-100" : "bg-primary opacity-20"} blur-[0.5px]`}
              />
            </div>

            {scanning && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] flex items-center justify-center z-30">
                <div className="flex flex-col items-center gap-4">
                  <div className="size-12 rounded-full border-4 border-white/10 border-t-white animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                    Analisando Alimento...
                  </span>
                </div>
              </div>
            )}

            {!streamOn && (
              <div
                onClick={startCamera}
                className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-sm z-10 cursor-pointer active:bg-zinc-950 transition-all duration-300 group"
                title="Clique para tentar ativar a câmera"
              >
                <Camera className="size-10 text-accent mb-3 animate-pulse group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FAF7F2]/60 text-center px-8 leading-loose">
                  {isInstalledApp()
                    ? "Câmera indisponível. Verifique as permissões de câmara nas Definições do telemóvel."
                    : "Câmera Desabilitada"}
                  <br />
                  <span className="text-accent font-black text-xs">
                    {isInstalledApp() ? "Toque aqui" : "Clique aqui"}
                  </span>{" "}
                  para {isInstalledApp() ? "tentar reativar" : "tentar reativar o acesso"}
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Capture Buttons */}
        {!detected && !picked && (
          <div className="flex items-center justify-center gap-8 mt-1">
            <button
              onClick={handleGalleryUpload}
              disabled={scanning}
              className="size-13 rounded-[20px] bg-secondary hover:bg-muted border border-border flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
              title="Upload da Galeria"
            >
              <Upload className="size-5 text-muted-foreground" />
            </button>

            <button
              onClick={captureAndScan}
              disabled={scanning || !streamOn}
              className="group relative size-20 rounded-full flex items-center justify-center transition-all duration-500 active:scale-95 disabled:opacity-30"
            >
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl group-hover:scale-110 transition-transform opacity-100" />
              <div className="size-18 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-105">
                <div className="size-14 rounded-full border-2 border-primary-foreground/30" />
              </div>
            </button>

            <Link
              to="/diario"
              className="size-13 rounded-[20px] bg-secondary hover:bg-muted border border-border flex items-center justify-center transition-all active:scale-90"
              title="Registros Recentes"
            >
              <History className="size-5 text-muted-foreground" />
            </Link>
          </div>
        )}
      </section>

      {/* Modals for Results */}
      <MultiFoodModal
        items={detected}
        photo={scanPhoto}
        onClose={() => {
          setDetected(null);
          setScanPhoto(null);
        }}
        onConfirm={confirmar}
      />

      <NutritionModal food={picked} onClose={() => setPicked(null)} onAdd={adicionarSugestao} />

      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
        className="sr-only absolute pointer-events-none w-0 h-0"
        onChange={onPickGallery}
      />

      <input
        ref={cameraRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
        capture="environment"
        className="sr-only absolute pointer-events-none w-0 h-0"
        onChange={onPickGallery}
      />

      {/* Suggested Section - Humanized Journal lists */}
      <section className="w-full space-y-5 pt-8 border-t border-border">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-display font-black text-2xl text-foreground tracking-tight">
            Sugestões
          </h2>
          <Link
            to="/buscar"
            className="text-[10px] text-primary font-black uppercase tracking-[0.2em] hover:opacity-80 transition-all"
          >
            Ver tudo
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {sugestoes?.slice(0, 5).map((f, i) => {
            const emoji = getFoodEmoji(f.nome);
            return (
              <motion.button
                key={`${f.nome}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.04 }}
                onClick={() => setPicked(f)}
                className="w-full bg-card rounded-[22px] p-3 hover:bg-secondary/20 active:scale-[0.99] border border-border/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-300 flex items-center gap-3.5 group relative overflow-hidden text-left"
              >
                {/* Left Side: Soft circle with centered large Emoji */}
                <div className="size-12 shrink-0 rounded-2xl bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center text-2xl shadow-inner border border-primary/5 transition-colors">
                  {emoji}
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
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
