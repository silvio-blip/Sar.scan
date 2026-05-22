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
    // Se já temos stream e está ativa, não fazemos nada
    if (stream && stream.active) return;
    
    try {
      // Tentativa direta de acesso às media devices - simplificando restrições
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      setStream(mediaStream);
      setStreamOn(true);
    } catch (err) {
      console.error("Camera access error:", err);
      // Em apps nativas, se isto falhar é quase sempre configuração do WebChromeClient
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
