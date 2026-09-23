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
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QueueStatusCard, type QueueState } from "@/components/queue-status-card";
import { submitToScanQueue } from "@/lib/scan-queue-client";
import { getApiUrl } from "@/lib/utils";
import { optimizeImageForUpload } from "@/lib/image-optimizer";
import { safeFetchJson } from "@/lib/safe-fetch";

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

  const [savedCalibration, setSavedCalibration] = useState<HandCalibrationData | null>(() =>
    getSavedHandCalibration(),
  );

  const [selectedReference, setSelectedReference] = useState<ReferenceObjectType>("card");
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

  // Parar câmera ao desmontar
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Garantir que o elemento de vídeo recebe o stream assim que renderiza
  useEffect(() => {
    if (step === "camera" && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [step, cameraStream]);

  // Iniciar câmera quando entrar no passo de câmera
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
      // Fallback para input de arquivo
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
      // Otimização de imagem ultra-leve (elimina 413 Entity Too Large e previne crash de memória)
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
        const errorMsg =
          data?.erro ||
          "Não foi possível identificar com nitidez a sua mão e o objeto de referência.";
        setErrorInfo({
          titulo: data?.titulo_erro || "Verificação Incompleta",
          motivo: data?.motivo_falha || "objeto_ou_mao_ausente",
          mensagem: errorMsg,
          dica:
            data?.dica_correcao ||
            "Certifique-se de apoiar a mão aberta ao lado do objeto numa superfície plana com boa iluminação.",
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

      // Salvar calibração
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
      toast.success("Mão calibrada com sucesso!");
    } catch (err: any) {
      console.error("Erro na calibração:", err);
      setErrorInfo({
        titulo: "Não foi possível analisar a foto",
        motivo: "falha_processamento",
        mensagem:
          err.message ||
          "Ocorreu uma instabilidade na conexão ou na análise óptica da imagem enviada.",
        dica: "Tente novamente posicionando a mão aberta bem ao lado do objeto com a câmera de cima para baixo.",
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
    toast.info("Calibração biométrica removida.");
    setStep("intro");
  };

  const currentReferenceObj = REFERENCE_OBJECTS.find((o) => o.id === selectedReference);

  return (
    <div className="space-y-6 pb-20 max-w-xl mx-auto">
      {/* Header com Voltar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/perfil" })}
          className="size-10 rounded-2xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary transition active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black font-display tracking-tight text-foreground flex items-center gap-2">
            Calibração Biométrica <Sparkles className="size-5 text-amber-500 fill-amber-500/20" />
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Escala métrica de alta precisão para porções e gramas
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
            className="space-y-6"
          >
            <Card className="p-6 rounded-[32px] border border-border bg-card shadow-sm space-y-5">
              <div className="size-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                <Ruler className="size-8" />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-lg font-black text-foreground">
                  Como funciona a Alta Precisão?
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao calibrar as dimensões da sua mão uma única vez, a Inteligência Artificial passa
                  a usá-la como uma <strong>régua 3D no espaço</strong> toda vez que você apontar a
                  câmera para o prato com a mão por perto, calculando gramas reais com precisão
                  cirúrgica!
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-7 rounded-xl bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-foreground">Escolha um item de referência</span>
                    <p className="text-muted-foreground mt-0.5">
                      Pode ser qualquer cartão bancário padrão, moeda comum ou régua.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-7 rounded-xl bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-foreground">Foto da mão com o objeto</span>
                    <p className="text-muted-foreground mt-0.5">
                      Coloque a mão aberta na mesa ao lado do objeto e tire uma foto de cima.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/50 border border-border/60">
                  <div className="size-7 rounded-xl bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-foreground">
                      Scans com dados e porções mais precisos
                    </span>
                    <p className="text-muted-foreground mt-0.5">
                      Pronto! Ao escanear seus pratos de comida, coloque a mão ao lado para obter
                      dados muito mais precisos.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("select_object")}
                className="w-full h-13 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                Iniciar Calibração da Mão <ChevronRight className="size-4" />
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
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-black text-foreground">Escolha o Objeto de Referência</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Selecione o objeto que você tem ao seu alcance agora para colocar ao lado da mão:
              </p>
            </div>

            <div className="space-y-2.5">
              {REFERENCE_OBJECTS.map((obj) => {
                const isSelected = selectedReference === obj.id;
                return (
                  <Card
                    key={obj.id}
                    onClick={() => setSelectedReference(obj.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3.5 active:scale-[0.99] ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-border bg-card hover:bg-secondary/40"
                    }`}
                  >
                    <div className="text-2xl size-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      {obj.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{obj.label}</span>
                        {isSelected && (
                          <div className="size-5 rounded-full bg-primary text-white flex items-center justify-center">
                            <Check className="size-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {obj.description}
                      </p>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md inline-block mt-1">
                        {obj.realSizeDescription}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-3">
              <Info className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Dica de fotografia:</strong> Coloque o(a) {currentReferenceObj?.label} sobre
                a mesa ao lado da sua mão aberta com os dedos retos e tire a foto de cima para
                baixo.
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(savedCalibration ? "result" : "intro")}
                className="flex-1 h-12 rounded-2xl font-bold text-xs"
              >
                Voltar
              </Button>
              <Button
                onClick={startCamera}
                className="flex-[2] h-12 rounded-2xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Camera className="size-4" /> Abrir Câmera & Fotografar
              </Button>
            </div>

            <div className="text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold underline underline-offset-4"
              >
                Ou enviar foto da galeria
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
            <div className="relative aspect-[3/4] w-full bg-black rounded-[32px] overflow-hidden border border-border shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Grid / Overlay Guia */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-white text-center text-xs font-semibold">
                  Posicione a mão aberta à esquerda e o(a) {currentReferenceObj?.label} à direita
                </div>

                {/* Linhas guias visuais */}
                <div className="flex-1 border-2 border-dashed border-white/30 rounded-2xl my-4 flex items-center justify-around p-4">
                  <div className="w-1/2 h-full border border-white/20 rounded-xl flex items-center justify-center text-white/50 text-[11px] font-bold">
                    🖐️ Mão Aberta
                  </div>
                  <div className="w-1/3 h-1/2 border border-amber-400/40 rounded-xl flex items-center justify-center text-amber-300 text-[10px] font-bold text-center p-1">
                    {currentReferenceObj?.emoji} {currentReferenceObj?.label.split("/")[0]}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      stopCamera();
                      setStep("select_object");
                    }}
                    className="bg-black/50 text-white border-white/20 rounded-2xl h-12 px-4 text-xs font-bold"
                  >
                    Cancelar
                  </Button>

                  <button
                    onClick={takePhoto}
                    className="size-16 rounded-full bg-white border-4 border-primary shadow-xl flex items-center justify-center active:scale-90 transition transform"
                  >
                    <div className="size-12 rounded-full bg-primary" />
                  </button>

                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-black/50 text-white border-white/20 rounded-2xl h-12 px-3 text-xs font-bold"
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
            className="text-center py-6 space-y-6 max-w-sm mx-auto"
          >
            {queueState ? (
              <QueueStatusCard
                queueState={queueState}
                title="Fila de Calibração Biométrica"
                subtitle="Calculando as proporções anatômicas exatas da sua mão"
              />
            ) : (
              <div className="relative size-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Ruler className="size-10 text-primary animate-pulse" />
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">
                Calculando Escala Biométrica...
              </h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                A IA está localizando o objeto de referência ({currentReferenceObj?.label}), medindo
                os pixels por milímetro e deduzindo as dimensões anatômicas exatas da sua mão.
              </p>
            </div>

            {capturedImage && (
              <div className="size-32 rounded-2xl overflow-hidden mx-auto border-2 border-primary/30 shadow-lg">
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
            className="space-y-6"
          >
            {/* Cartão de Identidade Biométrica */}
            <Card className="relative overflow-hidden p-6 rounded-[32px] border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                      Perfil Biométrico Ativo
                    </span>
                    <h3 className="font-black text-base text-foreground mt-0.5">
                      Escala Calibrada
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-muted-foreground">Precisão</span>
                  <div className="text-sm font-black text-emerald-500">
                    {calibrationResult?.confianca_percentual ||
                      savedCalibration?.confianca_percentual ||
                      96}
                    %
                  </div>
                </div>
              </div>

              {/* Grid de Medidas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-secondary/60 border border-border space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Ruler className="size-3.5 text-primary" /> Comprimento da Mão
                  </span>
                  <div className="text-2xl font-black text-foreground">
                    {calibrationResult?.comprimento_cm || savedCalibration?.comprimento_cm || 18.5}
                    <span className="text-sm font-bold text-muted-foreground ml-1">cm</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Do punho ao dedo médio</span>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/60 border border-border space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    🖐️ Largura da Palma
                  </span>
                  <div className="text-2xl font-black text-foreground">
                    {calibrationResult?.largura_palma_cm ||
                      savedCalibration?.largura_palma_cm ||
                      8.2}
                    <span className="text-sm font-bold text-muted-foreground ml-1">cm</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Transversal da base</span>
                </div>
              </div>

              {/* Mensagem e Dicas */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Como usar nos seus scans diários:
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao apontar a câmera para qualquer alimento ou refeição no scanner, coloque sua mão
                  ao lado do prato. A IA detectará automaticamente sua mão e usará a escala de{" "}
                  <strong>
                    {calibrationResult?.comprimento_cm || savedCalibration?.comprimento_cm || 18.5}{" "}
                    cm
                  </strong>{" "}
                  para calcular as gramas exatas com precisão cirúrgica!
                </p>
              </div>

              {/* Ações */}
              <div className="space-y-2.5 pt-2">
                <Button
                  onClick={() => navigate({ to: "/scanner" })}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Camera className="size-4" /> Ir para o Scanner de Alimentos
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRecalibrate}
                    className="flex-1 h-11 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="size-3.5" /> Recalibrar Mão
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleRemoveCalibration}
                    className="h-11 rounded-2xl font-semibold text-xs text-destructive hover:bg-destructive/10"
                  >
                    Remover
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
            className="space-y-5"
          >
            <Card className="relative overflow-hidden p-6 rounded-[32px] border border-destructive/30 bg-gradient-to-br from-card via-card to-destructive/5 shadow-xl space-y-5">
              {/* Cabeçalho do Erro */}
              <div className="flex items-start gap-3.5">
                <div className="size-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-wider mb-1">
                    <XCircle className="size-3" /> Verificação Não Concluída
                  </div>
                  <h3 className="text-base font-black text-foreground tracking-tight">
                    {errorInfo?.titulo || "Não foi possível calibrar a mão"}
                  </h3>
                </div>
              </div>

              {/* Foto enviada com Badge */}
              {errorInfo?.imagemUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-destructive/20 bg-black/40 aspect-[16/9] max-h-48 flex items-center justify-center">
                  <img
                    src={errorInfo.imagemUrl}
                    alt="Foto enviada"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                      <Camera className="size-3 text-destructive" /> Foto analisada pela IA
                    </span>
                  </div>
                </div>
              )}

              {/* Explicação Clara do Motivo */}
              <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/15 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" /> Motivo da Análise
                </span>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {errorInfo?.mensagem ||
                    "A inteligência artificial não conseguiu encontrar todos os pontos de referência necessários para deduzir a medida real da mão."}
                </p>
              </div>

              {/* Dicas e Ação Corretiva */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Lightbulb className="size-4 shrink-0" /> Como resolver na próxima foto:
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed font-normal">
                  {errorInfo?.dica ||
                    `Coloque o(a) ${currentReferenceObj?.label} sobre a mesa ao lado da sua mão aberta e fotografe com boa iluminação.`}
                </p>

                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>Mantenha a mão espalmada com dedos retos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>
                      Encoste ou aproxime o(a) {currentReferenceObj?.label} ao lado da mão
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>Fotografe de cima para baixo com luz clara</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleRetrySameObject}
                  className="w-full h-12 rounded-2xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Camera className="size-4" /> Tirar Nova Foto Agora
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border-border"
                  >
                    <Upload className="size-3.5" /> Enviar da Galeria
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleSelectDifferentObject}
                    className="flex-1 h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border-border"
                  >
                    <RefreshCw className="size-3.5" /> Trocar Objeto
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
