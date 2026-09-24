import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  REFERENCE_OBJECTS,
  ReferenceObjectType,
  HandCalibrationData,
  getSavedHandCalibration,
  saveHandCalibration,
  clearHandCalibration,
} from "@/lib/hand-calibration";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowLeft,
  RotateCcw,
  Ruler,
  Info,
  ChevronRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Upload,
  AlertTriangle,
  Lightbulb,
  XCircle,
  Coins,
  CreditCard,
  Grid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QueueStatusCard, type QueueState } from "@/components/queue-status-card";
import { submitToScanQueue } from "@/lib/scan-queue-client";
import { getApiUrl } from "@/lib/utils";
import { optimizeImageForUpload } from "@/lib/image-optimizer";
import { safeFetchJson } from "@/lib/safe-fetch";
import { useTranslation } from "@/lib/strings";

export interface CalibrationErrorInfo {
  titulo: string;
  motivo?: string;
  mensagem: string;
  dica?: string;
  imagemUrl?: string | null;
}

export const Route = createFileRoute("/_app/perfil/calibracao-mao")({
  component: CalibracaoMaoPage,
});

export function CalibracaoMaoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [savedCalibration, setSavedCalibration] = useState<HandCalibrationData | null>(() =>
    getSavedHandCalibration(),
  );

  const [selectedReference, setSelectedReference] = useState<ReferenceObjectType>("card");
  const [activeTab, setActiveTab] = useState<"cards" | "coins" | "all">("cards");
  const [step, setStep] = useState<
    "intro" | "select_object" | "camera" | "analyzing" | "result" | "error"
  >(() => (savedCalibration ? "result" : "intro"));

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [errorInfo, setErrorInfo] = useState<CalibrationErrorInfo | null>(null);
  const [calibrationResult, setCalibrationResult] = useState<{
    comprimento_cm: number;
    largura_palma_cm: number;
    largura_indicador_cm?: number;
    confianca_percentual?: number;
    objeto_detectado?: string;
    mensagem?: string;
    dicas?: string[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Attach stream to video element
  useEffect(() => {
    if (step === "camera" && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [step, cameraStream]);

  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      setCameraStream(stream);
      setStep("camera");
    } catch (err: any) {
      console.warn("Erro ao acessar câmera frontal/traseira:", err);
      toast.info("Acesso à câmera não disponível diretamente. Pode carregar uma foto da galeria.");
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    processCalibrationImage(dataUrl);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImageForUpload(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.82,
      });
      setCapturedImage(optimized);
      stopCamera();
      processCalibrationImage(optimized);
    } catch {
      toast.error("Erro ao carregar a imagem da galeria.");
    }
  };

  const processCalibrationImage = async (base64Image: string) => {
    setStep("analyzing");
    setAnalyzing(true);

    try {
      const optimizedImage = await optimizeImageForUpload(base64Image, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.82,
      });

      let data: any = null;
      try {
        data = await submitToScanQueue({
          type: "calibrate_hand",
          payload: {
            base64Data: optimizedImage,
            reference_type: selectedReference,
          },
          userId: user?.id,
          onQueueUpdate: (qs) => setQueueState(qs),
        });
      } catch (queueErr: any) {
        console.warn("[Calibracao] Erro na fila, tentando requisição direta segura:", queueErr);
        const fallbackRes = await safeFetchJson<any>(getApiUrl("/api/calibrate-hand"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data: optimizedImage,
            reference_type: selectedReference,
            user_id: user?.id,
          }),
        });

        if (fallbackRes.ok && fallbackRes.data) {
          data = fallbackRes.data;
        } else {
          throw new Error(fallbackRes.error || queueErr?.message || "Falha na análise da imagem.");
        }
      }

      if (!data || !data.sucesso) {
        const errorMsg = data?.erro || t("calibration.analysisReasonDesc");
        setErrorInfo({
          titulo: data?.titulo_erro || t("calibration.errorTitle"),
          motivo: data?.motivo_falha || "objeto_ou_mao_ausente",
          mensagem: errorMsg,
          dica: data?.dica_correcao || t("calibration.howToResolveDesc"),
          imagemUrl: optimizedImage || base64Image,
        });
        setStep("error");
        return;
      }

      const result = {
        comprimento_cm: Number(data.comprimento_cm || 18.5),
        largura_palma_cm: Number(data.largura_palma_cm || 8.2),
        largura_indicador_cm: data.largura_indicador_cm
          ? Number(data.largura_indicador_cm)
          : undefined,
        confianca_percentual: Number(data.confianca_percentual || 95),
        objeto_detectado: data.objeto_detectado,
        mensagem: data.mensagem,
        dicas: data.dicas,
      };

      setErrorInfo(null);
      setCalibrationResult(result);

      const newCalibration: HandCalibrationData = {
        userId: user?.id,
        comprimento_cm: result.comprimento_cm,
        largura_palma_cm: result.largura_palma_cm,
        largura_indicador_cm: result.largura_indicador_cm,
        objeto_referencia: selectedReference,
        calibrado_em: new Date().toISOString(),
        confianca_percentual: result.confianca_percentual,
      };

      await saveHandCalibration(newCalibration, user?.id);
      setSavedCalibration(newCalibration);
      setStep("result");
      toast.success(t("calibration.scaleCalibrated"));
    } catch (err: any) {
      console.error("Erro na calibração:", err);
      setErrorInfo({
        titulo: t("calibration.errorTitle"),
        motivo: "falha_processamento",
        mensagem: err.message || t("calibration.analysisReasonDesc"),
        dica: t("calibration.howToResolveDesc"),
        imagemUrl: base64Image,
      });
      setStep("error");
    } finally {
      setAnalyzing(false);
      setQueueState(null);
    }
  };

  const handleRetrySameObject = () => {
    setErrorInfo(null);
    startCamera();
  };

  const handleSelectDifferentObject = () => {
    setErrorInfo(null);
    setCapturedImage(null);
    setStep("select_object");
  };

  const handleRecalibrate = () => {
    setCalibrationResult(null);
    setCapturedImage(null);
    setStep("select_object");
  };

  const handleRemoveCalibration = () => {
    clearHandCalibration();
    setSavedCalibration(null);
    setCalibrationResult(null);
    toast.info("Calibração removida.");
    setStep("intro");
  };

  const getObjectInfo = (id: ReferenceObjectType) => {
    switch (id) {
      case "card":
        return {
          label: t("calibration.creditCard"),
          desc: t("calibration.creditCardDesc"),
        };
      case "coin_2eur":
        return {
          label: t("calibration.coin2eur"),
          desc: t("calibration.coin2eurDesc"),
        };
      case "coin_1real":
        return {
          label: t("calibration.coin1real"),
          desc: t("calibration.coin1realDesc"),
        };
      case "coin_1eur":
        return {
          label: t("calibration.coin1eur"),
          desc: t("calibration.coin1eurDesc"),
        };
      case "bottle_cap":
        return {
          label: t("calibration.bottleCap"),
          desc: t("calibration.bottleCapDesc"),
        };
      case "ruler":
        return {
          label: t("calibration.ruler"),
          desc: t("calibration.rulerDesc"),
        };
      default:
        return {
          label: t("calibration.creditCard"),
          desc: t("calibration.creditCardDesc"),
        };
    }
  };

  const currentObjInfo = getObjectInfo(selectedReference);
  const currentReferenceObj = REFERENCE_OBJECTS.find((o) => o.id === selectedReference);

  // Filter objects by active tab
  const filteredObjects = REFERENCE_OBJECTS.filter((obj) => {
    if (activeTab === "cards") {
      return obj.id === "card" || obj.id === "ruler";
    }
    if (activeTab === "coins") {
      return (
        obj.id === "coin_2eur" ||
        obj.id === "coin_1real" ||
        obj.id === "coin_1eur" ||
        obj.id === "bottle_cap"
      );
    }
    return true;
  });

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 pb-24 px-1 sm:px-0">
      {/* Header com Voltar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/perfil" })}
          className="size-10 rounded-2xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary transition active:scale-95 shrink-0"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground flex items-center gap-2 truncate">
            {t("calibration.title")}{" "}
            <Sparkles className="size-5 text-amber-500 fill-amber-500/20 shrink-0" />
          </h1>
          <p className="text-xs text-muted-foreground font-medium truncate">
            {t("calibration.subtitle")}
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* RENDERIZAÇÃO DOS PASSOS */}
      <AnimatePresence mode="wait">
        {/* PASSO 1: INTRODUÇÃO */}
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <Card className="p-4 sm:p-6 rounded-[28px] border border-border bg-card shadow-sm space-y-4">
              <div className="size-14 sm:size-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                <Ruler className="size-7 sm:size-8" />
              </div>

              <div className="text-center space-y-1.5">
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {t("calibration.howItWorks")}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                  {t("calibration.howItWorksDesc")}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-6 rounded-lg bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {t("calibration.step1Title")}
                    </span>
                    <p className="text-muted-foreground mt-0.5">{t("calibration.step1Desc")}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-6 rounded-lg bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {t("calibration.step2Title")}
                    </span>
                    <p className="text-muted-foreground mt-0.5">{t("calibration.step2Desc")}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-6 rounded-lg bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="font-bold text-foreground block truncate">
                      {t("calibration.step3Title")}
                    </span>
                    <p className="text-muted-foreground mt-0.5">{t("calibration.step3Desc")}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("select_object")}
                className="w-full h-12 rounded-2xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                {t("calibration.startCalibration")} <ChevronRight className="size-4" />
              </Button>
            </Card>
          </motion.div>
        )}

        {/* PASSO 2: ESCOLHER OBJETO DE REFERÊNCIA */}
        {step === "select_object" && (
          <motion.div
            key="select_object"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black text-foreground">
                {t("calibration.selectObject")}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {t("calibration.selectObjectDesc")}
              </p>
            </div>

            {/* Responsive Category Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/60 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab("cards")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "cards"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="size-3.5 shrink-0" />
                <span className="truncate">{t("calibration.tabCards")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("coins")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "coins"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Coins className="size-3.5 shrink-0" />
                <span className="truncate">{t("calibration.tabCoins")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid className="size-3.5 shrink-0" />
                <span className="truncate">{t("calibration.tabAll")}</span>
              </button>
            </div>

            {/* List of Reference Objects */}
            <div className="space-y-2">
              {filteredObjects.map((obj) => {
                const isSelected = selectedReference === obj.id;
                const info = getObjectInfo(obj.id);

                return (
                  <Card
                    key={obj.id}
                    onClick={() => setSelectedReference(obj.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center gap-3 active:scale-[0.99] ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-secondary/40"
                    }`}
                  >
                    <div className="text-2xl size-11 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0">
                      {obj.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {info.label}
                        </span>
                        {isSelected && (
                          <div className="size-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                            <Check className="size-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {info.desc}
                      </p>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md inline-block mt-1">
                        {obj.realSizeDescription}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <Info className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>{t("calibration.photoTip")}</strong> {t("calibration.photoTipDesc")} (
                {currentObjInfo.label})
              </span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep(savedCalibration ? "result" : "intro")}
                className="flex-1 h-11 rounded-2xl font-bold text-xs"
              >
                {t("common.back")}
              </Button>
              <Button
                onClick={startCamera}
                className="flex-[2] h-11 rounded-2xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Camera className="size-4" /> {t("calibration.openCamera")}
              </Button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold underline underline-offset-4"
              >
                {t("calibration.orUpload")}
              </button>
            </div>
          </motion.div>
        )}

        {/* PASSO 3: CÂMERA AO VIVO */}
        {step === "camera" && (
          <motion.div
            key="camera"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            <div className="relative aspect-[3/4] w-full bg-black rounded-[28px] overflow-hidden border border-border shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Grid / Overlay Guia */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
                <div className="bg-black/70 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-white text-center text-xs font-semibold">
                  {t("calibration.cameraGuide")}
                </div>

                {/* Linhas guias visuais */}
                <div className="flex-1 border-2 border-dashed border-white/30 rounded-2xl my-3 flex items-center justify-around p-3">
                  <div className="w-1/2 h-full border border-white/20 rounded-xl flex items-center justify-center text-white/60 text-[11px] font-bold">
                    🖐️ {t("calibration.handGuide")}
                  </div>
                  <div className="w-1/3 h-1/2 border border-amber-400/50 rounded-xl flex items-center justify-center text-amber-300 text-[10px] font-bold text-center p-1 bg-black/30">
                    {currentReferenceObj?.emoji} {currentObjInfo.label}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      stopCamera();
                      setStep("select_object");
                    }}
                    className="bg-black/60 text-white border-white/20 rounded-2xl h-11 px-3 text-xs font-bold pointer-events-auto"
                  >
                    {t("common.cancel")}
                  </Button>

                  <button
                    onClick={takePhoto}
                    className="size-14 sm:size-16 rounded-full bg-white border-4 border-primary shadow-xl flex items-center justify-center active:scale-90 transition transform pointer-events-auto"
                  >
                    <div className="size-10 sm:size-12 rounded-full bg-primary" />
                  </button>

                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-black/60 text-white border-white/20 rounded-2xl h-11 px-3 text-xs font-bold pointer-events-auto"
                  >
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* PASSO 4: ANALISANDO COM VISÃO COMPUTACIONAL */}
        {step === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-6 space-y-5 max-w-sm mx-auto"
          >
            {queueState ? (
              <QueueStatusCard
                queueState={queueState}
                title={t("calibration.calculating")}
                subtitle={t("calibration.subtitle")}
              />
            ) : (
              <div className="relative size-20 sm:size-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Ruler className="size-8 sm:size-10 text-primary animate-pulse" />
              </div>
            )}

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-black text-foreground">
                {t("calibration.calculating")}
              </h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {t("calibration.calculatingDesc")}
              </p>
            </div>

            {capturedImage && (
              <div className="size-28 sm:size-32 rounded-2xl overflow-hidden mx-auto border-2 border-primary/30 shadow-lg">
                <img src={capturedImage} alt="Amostra" className="w-full h-full object-cover" />
              </div>
            )}
          </motion.div>
        )}

        {/* PASSO 5: RESULTADO DA CALIBRAÇÃO */}
        {step === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            {/* Cartão de Identidade Biométrica */}
            <Card className="relative overflow-hidden p-4 sm:p-6 rounded-[28px] border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 sm:size-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-5 sm:size-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                      {t("calibration.profileActive")}
                    </span>
                    <h3 className="font-black text-sm sm:text-base text-foreground mt-0.5 truncate">
                      {t("calibration.scaleCalibrated")}
                    </h3>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground block">
                    {t("calibration.accuracy")}
                  </span>
                  <div className="text-xs sm:text-sm font-black text-emerald-500">
                    {calibrationResult?.confianca_percentual ||
                      savedCalibration?.confianca_percentual ||
                      96}
                    %
                  </div>
                </div>
              </div>

              {/* Grid de Medidas */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 sm:p-4 rounded-2xl bg-secondary/60 border border-border space-y-0.5">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1 truncate">
                    <Ruler className="size-3 text-primary shrink-0" /> {t("calibration.handLength")}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-foreground">
                    {calibrationResult?.comprimento_cm || savedCalibration?.comprimento_cm || 18.5}
                    <span className="text-xs font-bold text-muted-foreground ml-1">cm</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground line-clamp-1">
                    {t("calibration.wristToMiddleFinger")}
                  </span>
                </div>

                <div className="p-3 sm:p-4 rounded-2xl bg-secondary/60 border border-border space-y-0.5">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1 truncate">
                    🖐️ {t("calibration.palmWidth")}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-foreground">
                    {calibrationResult?.largura_palma_cm ||
                      savedCalibration?.largura_palma_cm ||
                      8.2}
                    <span className="text-xs font-bold text-muted-foreground ml-1">cm</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground line-clamp-1">
                    {t("calibration.palmTransversal")}
                  </span>
                </div>
              </div>

              {/* Mensagem e Dicas */}
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1.5">
                <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5 shrink-0" /> {t("calibration.howToUseDaily")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("calibration.howToUseDailyDesc", {
                    length: String(
                      calibrationResult?.comprimento_cm || savedCalibration?.comprimento_cm || 18.5,
                    ),
                  })}
                </p>
              </div>

              {/* Ações */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => navigate({ to: "/scanner" })}
                  className="w-full h-11 sm:h-12 rounded-2xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Camera className="size-4" /> {t("calibration.goToScanner")}
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRecalibrate}
                    className="flex-1 h-10 sm:h-11 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="size-3.5" /> {t("calibration.recalibrate")}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleRemoveCalibration}
                    className="h-10 sm:h-11 rounded-2xl font-semibold text-xs text-destructive hover:bg-destructive/10"
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PASSO 6: TRATAMENTO DE ERRO E DIAGNÓSTICO DETALHADO */}
        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            <Card className="relative overflow-hidden p-4 sm:p-6 rounded-[28px] border border-destructive/30 bg-gradient-to-br from-card via-card to-destructive/5 shadow-xl space-y-4">
              {/* Cabeçalho do Erro */}
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-wider mb-0.5">
                    <XCircle className="size-3" /> {t("calibration.errorTitle")}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                    {errorInfo?.titulo || t("calibration.errorTitle")}
                  </h3>
                </div>
              </div>

              {/* Foto enviada com Badge */}
              {errorInfo?.imagemUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-destructive/20 bg-black/40 aspect-[16/9] max-h-40 flex items-center justify-center">
                  <img
                    src={errorInfo.imagemUrl}
                    alt="Foto enviada"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                    <span className="text-[10px] sm:text-[11px] font-bold text-white flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                      <Camera className="size-3 text-destructive" />{" "}
                      {t("calibration.analyzedPhoto")}
                    </span>
                  </div>
                </div>
              )}

              {/* Explicação Clara do Motivo */}
              <div className="p-3.5 rounded-2xl bg-destructive/5 border border-destructive/15 space-y-1.5">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" /> {t("calibration.analysisReason")}
                </span>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {errorInfo?.mensagem || t("calibration.analysisReasonDesc")}
                </p>
              </div>

              {/* Dicas e Ação Corretiva */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <Lightbulb className="size-3.5 shrink-0" /> {t("calibration.howToResolve")}
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed font-normal">
                  {errorInfo?.dica || t("calibration.howToResolveDesc")}
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleRetrySameObject}
                  className="w-full h-11 sm:h-12 rounded-2xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Camera className="size-4" /> {t("calibration.takeNewPhoto")}
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-10 sm:h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border-border"
                  >
                    <Upload className="size-3.5" /> {t("calibration.sendGallery")}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleSelectDifferentObject}
                    className="flex-1 h-10 sm:h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border-border"
                  >
                    <RefreshCw className="size-3.5" /> {t("calibration.changeObject")}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
