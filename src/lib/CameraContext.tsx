import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { isInstalledApp } from "@/lib/utils";

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

  const startCamera = async () => {
    if (stream) return;
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (e) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }
      setStream(mediaStream);
      setStreamOn(true);
    } catch (err) {
      console.error("Camera access error:", err);
      if (isInstalledApp()) {
        toast.error("Erro ao acessar câmara. Ative a permissão de Câmara nas Definições do seu telemóvel (Definições > Aplicações > sar.scan > Permissões).");
      } else {
        toast.error("Erro ao acessar a câmara. Verifique se o seu navegador não bloqueou o acesso.");
      }
      setStreamOn(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setStreamOn(false);
    }
  };

  useEffect(() => {
    startCamera();
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
