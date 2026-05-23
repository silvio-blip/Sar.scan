import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface CameraContextType {
  stream: MediaStream | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  streamOn: boolean;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamOn, setStreamOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep ref synchronized with state to avoid dependency arrays re-triggering hooks
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      console.log("[CameraContext] Parando câmera...");
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error("Erro ao parar track:", e);
        }
      });
      setStream(null);
      setStreamOn(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    // Se já temos stream ativo, não iniciamos novamente para evitar travar a câmera
    if (streamRef.current && streamRef.current.active) {
      console.log("[CameraContext] Câmera já ativa.");
      return;
    }

    try {
      console.log("[CameraContext] Iniciando câmera (apenas traseira)...");

      // Se já houver um stream inativo ou antigo, limpamos antes de abrir o novo
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            /* ignore */
          }
        });
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("O navegador não suporta acesso à câmera (MediaDevices não disponível).");
      }

      // 1. Tenta obter uma lista de dispositivos de vídeo para identificar o ID da câmera traseira
      let targetDeviceId = "";
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        console.log("[CameraContext] Dispositivos de vídeo detectados:", videoDevices);

        if (videoDevices.length > 0) {
          // Palavras-chave associadas a câmeras traseiras (trás, traseira, back, rear, etc.)
          const rearKeywords = [
            "back",
            "rear",
            "traseira",
            "trás",
            "main",
            "principal",
            "environment",
            "0",
            "1",
          ];

          const matchedDevice = videoDevices.find((device) => {
            const label = device.label.toLowerCase();
            const isRearLabel = rearKeywords.some((kw) => label.includes(kw));
            const isFrontLabel =
              label.includes("front") ||
              label.includes("frontal") ||
              label.includes("user") ||
              label.includes("selfie");
            return isRearLabel && !isFrontLabel;
          });

          if (matchedDevice) {
            targetDeviceId = matchedDevice.deviceId;
            console.log(
              "[CameraContext] Câmera traseira identificada por rótulo:",
              matchedDevice.label,
              "ID:",
              targetDeviceId,
            );
          } else {
            // Caso contrário, tenta qualquer câmera que não contenha "front/frontal/user/selfie"
            const nonFrontDevice = videoDevices.find((device) => {
              const label = device.label.toLowerCase();
              return (
                !label.includes("front") &&
                !label.includes("frontal") &&
                !label.includes("user") &&
                !label.includes("selfie")
              );
            });
            if (nonFrontDevice) {
              targetDeviceId = nonFrontDevice.deviceId;
              console.log(
                "[CameraContext] Câmera não-frontal genérica encontrada ID:",
                targetDeviceId,
              );
            }
          }
        }
      } catch (e) {
        console.warn(
          "[CameraContext] Erro ao enumerar dispositivos (pode ser antes da permissão):",
          e,
        );
      }

      // Prepara lista de restrições em ordem de preferência para a câmera traseira
      const constraintsList = [];

      // Preferência 1: Se identificamos uma câmera traseira específica pelo deviceId
      if (targetDeviceId) {
        constraintsList.push({
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        constraintsList.push({
          video: {
            deviceId: targetDeviceId,
          },
        });
      }

      // Preferência 2: Restrição moderna padrão para câmera traseira
      constraintsList.push({
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Preferência 3: facingMode "environment" sem exact (menos restritivo, excelente suporte)
      constraintsList.push({
        video: {
          facingMode: "environment",
        },
      });

      // Preferência 4: facingMode "environment" com ideal
      constraintsList.push({
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      // Último fallback para garantir que funcione em qualquer dispositivo (e.g. desktop)
      constraintsList.push({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      let mediaStream: MediaStream | null = null;
      let lastError: unknown = null;

      // Executa as tentativas sequencialmente
      for (const constraints of constraintsList) {
        try {
          console.log("[CameraContext] Tentando getUserMedia com:", constraints);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (mediaStream) {
            console.log("[CameraContext] Sucesso em obter stream da câmera traseira!");
            break;
          }
        } catch (err) {
          console.warn(
            "[CameraContext] Falha com as restrições anteriores, tentando próxima...",
            err,
          );
          lastError = err;
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        setStreamOn(true);
      } else {
        throw lastError || new Error("Nenhuma câmera traseira disponível ou acessível.");
      }
    } catch (error) {
      const err = error as Record<string, any> | null;
      console.error("[CameraContext] Erro final de acesso à câmera:", err);
      let userFriendlyMessage = "Não foi possível acessar a câmera traseira do dispositivo.";

      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        userFriendlyMessage =
          "Permissão de câmera negada. Ative o acesso à câmera nas Definições do seu telemóvel.";
      } else if (
        err?.name === "NotReadableError" ||
        err?.name === "TrackStartError" ||
        err?.message?.includes("Could not start video source")
      ) {
        userFriendlyMessage =
          "A câmera já está em uso por outro aplicativo. Feche outras apps e tente novamente.";
      }

      toast.error(userFriendlyMessage);
      setStream(null);
      setStreamOn(false);
    }
  }, []);

  return (
    <CameraContext.Provider value={{ stream, startCamera, stopCamera, streamOn }}>
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => {
  const context = useContext(CameraContext);
  if (!context) throw new Error("useCamera must be used within CameraProvider");
  return context;
};
