import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { initAppNotifications } from "./notifications";

interface CameraContextType {
  stream: MediaStream | null;
  startCamera: (preferredFacing?: "environment" | "user") => Promise<void>;
  startCameraWithId: (deviceId: string) => Promise<void>;
  stopCamera: (keepState?: boolean) => void;
  streamOn: boolean;
  facingMode: "environment" | "user";
  toggleCamera: () => Promise<void>;
  logs: string[];
  devicesList: MediaDeviceInfo[];
  clearLogs: () => void;
  refreshDevices: () => Promise<void>;
  isSwitching: boolean;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamOn, setStreamOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [logs, setLogs] = useState<string[]>([]);
  const [devicesList, setDevicesList] = useState<MediaDeviceInfo[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const facingModeRef = useRef<"environment" | "user">("environment");
  const permissionCheckedRef = useRef<boolean>(false);
  const devicesListRef = useRef<MediaDeviceInfo[]>([]);
  const isSwitchingRef = useRef<boolean>(false);

  const addLog = useCallback((msg: string, extra?: unknown) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}${extra ? " | " + JSON.stringify(extra) : ""}`;
    console.log(formatted);
    setLogs((prev) => [...prev, formatted].slice(-150));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog("Logs limpos.");
  }, [addLog]);

  const setStreamAndRef = (s: MediaStream | null) => {
    streamRef.current = s;
    setStream(s);
  };

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      devicesListRef.current = videoDevices;
      setDevicesList(videoDevices);
      addLog(
        `refreshDevices: Encontrados ${videoDevices.length} dispositivos de vídeo.`,
        videoDevices.map((d) => ({ label: d.label || "Sem rótulo", id: d.deviceId })),
      );
    } catch (e) {
      addLog("Erro no refreshDevices:", e);
    }
  }, [addLog]);

  const ensurePermissions = useCallback(async () => {
    if (permissionCheckedRef.current) return;
    try {
      await initAppNotifications();
      const cap = typeof window !== "undefined" && (window as any).Capacitor;
      if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
        const { Camera } = cap.Plugins || {};
        if (Camera && typeof Camera.checkPermissions === "function") {
          const check = await Camera.checkPermissions();
          if (check?.camera !== "granted" && typeof Camera.requestPermissions === "function") {
            addLog("[CameraContext] Solicitando permissão nativa inicial de câmera...");
            await Camera.requestPermissions({ permissions: ["camera"] });
          } else {
            addLog("[CameraContext] Permissão nativa de câmera já concedida.");
          }
        }
      }
      permissionCheckedRef.current = true;
    } catch (e) {
      addLog("[CameraContext] Erro na verificação inicial de permissão nativa:", e);
      permissionCheckedRef.current = true;
    }
  }, [addLog]);

  const findCameraId = (
    devices: MediaDeviceInfo[],
    mode: "environment" | "user",
  ): string | null => {
    const videoDevices = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
    if (videoDevices.length === 0) return null;

    const hasLabels = videoDevices.some((d) => d.label && d.label.trim().length > 0);
    if (!hasLabels) return null;

    const rearKeywords = [
      "back",
      "rear",
      "traseira",
      "trás",
      "main",
      "principal",
      "environment",
      "traseiro",
      "external",
    ];
    const frontKeywords = ["front", "frontal", "user", "selfie", "cara", "anterior"];

    const targetKeywords = mode === "environment" ? rearKeywords : frontKeywords;
    const oppositeKeywords = mode === "environment" ? frontKeywords : rearKeywords;

    const scored = videoDevices.map((device) => {
      const label = (device.label || "").toLowerCase();
      let score = 0;
      if (targetKeywords.some((kw) => label.includes(kw))) score += 100;
      if (oppositeKeywords.some((kw) => label.includes(kw))) score -= 200;

      if (mode === "environment") {
        if (label.includes("camera 0") || label.includes("device 0") || label.includes("id 0")) {
          score += 500;
        }
        if (label.includes("camera 2") || label.includes("camera 4")) {
          score -= 100;
        }
      } else {
        if (label.includes("camera 1") || label.includes("device 1") || label.includes("id 1")) {
          score += 500;
        }
        if (label.includes("camera 3") || label.includes("camera 5")) {
          score -= 100;
        }
      }
      return { device, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score > -150) {
      return scored[0].device.deviceId;
    }
    return null;
  };

  const stopCamera = useCallback(
    (keepState = false) => {
      if (streamRef.current) {
        addLog(`Parando câmera ativa (keepState: ${keepState})...`);
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            addLog("Erro ao parar track:", e);
          }
        });
        setStreamAndRef(null);
        if (!keepState) {
          setStreamOn(false);
        }
      }
    },
    [addLog],
  );

  const startCameraWithId = useCallback(
    async (deviceId: string) => {
      addLog(`startCameraWithId: Solicitado ID específico: ${deviceId}`);
      stopCamera(true);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Suporte para getUserMedia indisponível no navegador.");
        }

        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStreamAndRef(mediaStream);
        setStreamOn(true);
        toast.success("Câmera conectada com sucesso!");
        await refreshDevices();
      } catch (error) {
        addLog(`startCameraWithId: Falha ao abrir ID ${deviceId}`, error);
        toast.error(`Falha ao carregar câmera por ID: ${(error as Error)?.message || error}`);
      }
    },
    [stopCamera, addLog, refreshDevices],
  );

  const startCamera = useCallback(
    async (preferredFacing?: "environment" | "user") => {
      if (startPromiseRef.current) {
        addLog("Inicialização de câmera já em andamento, aguardando...");
        return startPromiseRef.current;
      }

      const runStart = async () => {
        // Validação estrita para evitar SyntheticEvents ou tipos inválidos
        const activeMode: "environment" | "user" =
          preferredFacing === "environment" || preferredFacing === "user"
            ? preferredFacing
            : facingModeRef.current;

        facingModeRef.current = activeMode;
        setFacingMode(activeMode);
        addLog(`startCamera acionado. Modo pretendido: ${activeMode}`);

        // 1. Checa se a câmera atual já está ativa e correspondente
        if (streamRef.current && streamRef.current.active) {
          const currentTrack = streamRef.current.getVideoTracks()[0];
          if (currentTrack) {
            const settings = currentTrack.getSettings?.() || {};
            const label = (currentTrack.label || "").toLowerCase();
            const looksRear = ["back", "rear", "traseira", "trás", "main", "environment"].some(
              (k) => label.includes(k),
            );
            const looksFront = ["front", "frontal", "user", "selfie"].some((k) =>
              label.includes(k),
            );
            const inferred = looksRear ? "environment" : looksFront ? "user" : settings.facingMode;
            if (inferred === activeMode) {
              addLog(`Câmera já ativa no modo ${activeMode}. Nenhuma recriação necessária.`);
              return;
            }
          }
        }

        // 2. Garante permissão nativa inicial apenas se ainda não verificada
        await ensurePermissions();

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Suporte a getUserMedia indisponível no dispositivo.");
        }

        // 3. Libera o hardware da câmera anterior imediatamente!
        // No Android e WebViews, a câmera anterior precisa ter os tracks liberados
        // para que o hardware/HAL libere o sensor instantaneamente sem esperar timeout.
        if (streamRef.current) {
          addLog("Liberando sensor da câmera anterior para virar de imediato...");
          streamRef.current.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch (e) {
              /* ignore */
            }
          });
          streamRef.current = null;
        }

        // 4. Busca dispositivo específico se disponível no cache de dispositivos
        const targetId = findCameraId(devicesListRef.current, activeMode);
        addLog(
          `Alvo de câmera: ${targetId ? `deviceId ${targetId}` : `facingMode ideal: ${activeMode}`}`,
        );

        // 5. Restrições otimizadas para comutação instantânea
        const constraintsToTry: MediaStreamConstraints[] = [];

        if (targetId) {
          constraintsToTry.push({
            video: {
              deviceId: { exact: targetId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        }

        // Ideal para a grande maioria dos navegadores e WebViews Android/iOS
        constraintsToTry.push({
          video: {
            facingMode: { ideal: activeMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        // Fallbacks rápidos
        constraintsToTry.push({
          video: {
            facingMode: activeMode,
          },
        });

        constraintsToTry.push({
          video: true,
        });

        let newStream: MediaStream | null = null;
        let lastError: unknown = null;

        for (const constraints of constraintsToTry) {
          try {
            newStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (newStream) {
              addLog("Câmera conectada com sucesso!");
              break;
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (!newStream) {
          throw lastError || new Error("Falha ao inicializar o vídeo da câmera.");
        }

        setStreamAndRef(newStream);
        setStreamOn(true);

        // Atualiza a lista de dispositivos em segundo plano
        refreshDevices().catch(() => {});
      };

      startPromiseRef.current = runStart();
      try {
        await startPromiseRef.current;
      } catch (err) {
        addLog("Erro ao inicializar câmera:", err);
        const errorObj = err as Record<string, unknown> | null;
        if (errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError") {
          toast.error("Permissão de câmera negada. Ative o acesso nas Definições.");
        } else {
          toast.error("Não foi possível acessar a câmera do dispositivo.");
        }
        setStreamAndRef(null);
        setStreamOn(false);
      } finally {
        startPromiseRef.current = null;
      }
    },
    [addLog, refreshDevices, ensurePermissions],
  );

  const toggleCamera = useCallback(async () => {
    if (isSwitchingRef.current) {
      addLog("[CameraContext] Troca de câmera já em andamento, ignorando toque repetido.");
      return;
    }
    isSwitchingRef.current = true;
    setIsSwitching(true);

    try {
      const current = facingModeRef.current;
      const next: "environment" | "user" = current === "environment" ? "user" : "environment";
      addLog(`[CameraContext] Virando câmera de ${current} para ${next}...`);
      facingModeRef.current = next;
      setFacingMode(next);
      await startCamera(next);
    } catch (err) {
      addLog("[CameraContext] Erro ao alternar câmera:", err);
    } finally {
      isSwitchingRef.current = false;
      setIsSwitching(false);
    }
  }, [startCamera, addLog]);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [refreshDevices]);

  useEffect(() => {
    const handleResume = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && streamOn) {
        if (!streamRef.current || !streamRef.current.active) {
          addLog("[CameraContext] Retornando ao app: reativando câmera...");
          await startCamera(facingModeRef.current);
        }
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [streamOn, startCamera, addLog]);

  return (
    <CameraContext.Provider
      value={{
        stream,
        startCamera,
        startCameraWithId,
        stopCamera,
        streamOn,
        facingMode,
        toggleCamera,
        logs,
        devicesList,
        clearLogs,
        refreshDevices,
        isSwitching,
      }}
    >
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => {
  const context = useContext(CameraContext);
  if (!context) throw new Error("useCamera must be used within CameraProvider");
  return context;
};
