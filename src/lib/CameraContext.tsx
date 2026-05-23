import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

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
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamOn, setStreamOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [logs, setLogs] = useState<string[]>([]);
  const [devicesList, setDevicesList] = useState<MediaDeviceInfo[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const facingModeRef = useRef<"environment" | "user">("environment");

  const addLog = useCallback((msg: string, extra?: unknown) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}${extra ? " | " + JSON.stringify(extra) : ""}`;
    console.log(formatted);
    setLogs((prev) => [...prev, formatted].slice(-150));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog("Logs limpos pelo usuário.");
  }, [addLog]);

  const setStreamAndRef = (s: MediaStream | null) => {
    streamRef.current = s;
    setStream(s);
  };

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        addLog("Navegador não possui enumerateDevices!");
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setDevicesList(videoDevices);
      addLog(
        `refreshDevices: Encontrados ${videoDevices.length} dispositivos de vídeo.`,
        videoDevices.map((d) => ({ label: d.label || "Sem label", id: d.deviceId })),
      );
    } catch (e) {
      addLog("Erro ao listar dispositivos no refreshDevices:", e);
    }
  }, [addLog]);

  const stopCamera = useCallback(
    (keepState = false) => {
      if (streamRef.current) {
        addLog(`Parando câmera ativa (keepState: ${keepState})...`);
        streamRef.current.getTracks().forEach((track) => {
          try {
            addLog(`Parando track de vídeo: ${track.label}`);
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
      stopCamera();
      // Espera liberar recurso
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Suporte para getUserMedia indisponível no navegador.");
        }

        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        addLog("startCameraWithId: Solicitando stream...", constraints);
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStreamAndRef(mediaStream);
        setStreamOn(true);
        addLog("startCameraWithId: Câmera iniciada com sucesso via ID!");
        toast.success("Câmera conectada com sucesso!");

        // Atualiza lista de dispositivos agora que a permissão foi obtida
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
      // Se já está inicializando, aguarda a promessa ativa para evitar paralelismo
      if (startPromiseRef.current) {
        addLog("Inicialização de câmera já em andamento, aguardando...");
        return startPromiseRef.current;
      }

      const runStart = async () => {
        const activeMode = preferredFacing || facingModeRef.current;
        facingModeRef.current = activeMode;
        setFacingMode(activeMode);

        addLog(`Chamada startCamera iniciada. Modo atual: ${activeMode}`);

        // Se já temos stream ativo, não iniciamos novamente para evitar travar a câmera
        if (streamRef.current && streamRef.current.active) {
          addLog("Câmera já está ativa e funcionando.");
          return;
        }

        try {
          addLog(`Iniciando câmera padrão (modo: ${activeMode})...`);

          // Se já houver um stream inativo ou antigo, limpamos antes de abrir o novo
          if (streamRef.current) {
            addLog("Limpando track antiga antes de iniciar a nova...");
            streamRef.current.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (e) {
                /* ignore */
              }
            });
          }

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
              "O navegador não suporta acesso à câmera (MediaDevices não disponível).",
            );
          }

          // Função auxiliar para procurar um deviceId de câmera ativa na lista de dispositivos
          const findCameraId = (devices: MediaDeviceInfo[], mode: "environment" | "user") => {
            const videoDevices = devices.filter(
              (device) => device.kind === "videoinput" && device.deviceId,
            );
            addLog(
              `findCameraId para modo "${mode}". Mapeando dispositivos para rankear:`,
              videoDevices.map((d) => ({ label: d.label, id: d.deviceId })),
            );

            if (videoDevices.length === 0) {
              addLog("Nenhum dispositivo de vídeo físico encontrado.");
              return null;
            }

            const hasLabels = videoDevices.some((d) => d.label && d.label.trim().length > 0);
            if (!hasLabels) {
              addLog(
                "Dispositivos listados sem labels (rótulos vazios). Usando seleção nativa por enquadramento.",
              );
              return null;
            }

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

            // Calcula o score de adequabilidade para cada câmera física do dispositivo
            const scoredDevices = videoDevices.map((device) => {
              const label = (device.label || "").toLowerCase();
              let score = 0;

              const hasTarget = targetKeywords.some((kw) => label.includes(kw));
              const hasOpposite = oppositeKeywords.some((kw) => label.includes(kw));

              if (hasTarget) score += 100;
              if (hasOpposite) score -= 200;

              // Em dispositivos Android/WebView/APKs, "camera 0" é a traseira principal e "camera 1" a frontal principal.
              // Auxiliares ou lentes macro/wide inválidas são "camera 2", "camera 3", etc.
              if (mode === "environment") {
                if (
                  label.includes("camera 0") ||
                  label.includes("device 0") ||
                  label.includes("id 0")
                ) {
                  score += 500; // Preferência prioritária para a lente traseira principal (camera 0)
                }
                // Penaliza auxiliares que podem retornar imagem travada ou preta
                if (
                  label.includes("camera 2") ||
                  label.includes("camera 4") ||
                  label.includes("camera 6")
                ) {
                  score -= 100;
                }
              } else {
                if (
                  label.includes("camera 1") ||
                  label.includes("device 1") ||
                  label.includes("id 1")
                ) {
                  score += 500; // Preferência prioritária para a lente frontal principal (camera 1)
                }
                // Penaliza auxiliares frontais
                if (label.includes("camera 3") || label.includes("camera 5")) {
                  score -= 100;
                }
              }

              return { device, score };
            });

            // Ordena decrescentemente por score
            scoredDevices.sort((a, b) => b.score - a.score);

            addLog(
              `Rankings calculados para modo "${mode}":`,
              scoredDevices.map((sd) => ({
                label: sd.device.label,
                score: sd.score,
                id: sd.device.deviceId,
              })),
            );

            const bestDevice = scoredDevices[0];
            if (bestDevice && bestDevice.score > -150) {
              addLog(
                `Selecionando câmera com maior score (${bestDevice.score}): "${bestDevice.device.label}"`,
              );
              return bestDevice.device.deviceId;
            }

            addLog(
              "Nenhum par compatível bem pontuado, fallback para o primeiro dispositivo disponível.",
            );
            return videoDevices[0]?.deviceId || null;
          };

          // Tenta obter os dispositivos inicialmente para ver se já temos permissão
          let initialDevices: MediaDeviceInfo[] = [];
          try {
            initialDevices = await navigator.mediaDevices.enumerateDevices();
            addLog(
              "enumerateDevices inicial concluído.",
              initialDevices.map((d) => ({ label: d.label, kind: d.kind })),
            );
          } catch (e) {
            addLog("Falha inicial ao obter enumerateDevices:", e);
          }

          const targetDeviceId = findCameraId(initialDevices, activeMode);
          addLog(`ID de câmera candidato selecionado: ${targetDeviceId || "Nenhum"}`);

          // Vamos montar a lista ideal de restrições (constraints)
          const getConstraintsForIdOrFacingMode = (
            deviceId: string | null,
            mode: "environment" | "user",
          ) => {
            const list = [];

            if (deviceId) {
              list.push({
                video: {
                  deviceId: { exact: deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: { ideal: mode },
                },
              });
              list.push({
                video: {
                  deviceId: { exact: deviceId },
                },
              });
              list.push({
                video: {
                  deviceId: deviceId,
                },
              });
            }

            list.push({
              video: {
                facingMode: { exact: mode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });

            list.push({
              video: {
                facingMode: mode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });

            list.push({
              video: {
                facingMode: { ideal: mode },
              },
            });

            list.push({
              video: {
                facingMode: mode,
              },
            });

            list.push({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });

            list.push({
              video: true,
            });

            return list;
          };

          const constraintsList = getConstraintsForIdOrFacingMode(targetDeviceId, activeMode);
          let mediaStream: MediaStream | null = null;
          let lastError: unknown = null;

          addLog(
            `Iniciando varredura sequencial de ${constraintsList.length} formatos de restrições...`,
          );

          // Executa as tentativas com as restrições sequencialmente
          for (let idx = 0; idx < constraintsList.length; idx++) {
            const constraints = constraintsList[idx];
            try {
              addLog(`Tentativa #${idx + 1}/${constraintsList.length} com restrição:`, constraints);
              mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
              if (mediaStream) {
                addLog(`Sucesso na tentativa #${idx + 1}! Câmera ativada.`);
                break;
              }
            } catch (err) {
              addLog(`Falha na tentativa #${idx + 1} com restrição anterior. Detalhe do erro:`, {
                name: (err as Error)?.name,
                message: (err as Error)?.message,
              });
              lastError = err;
            }
          }

          if (!mediaStream) {
            throw (
              lastError || new Error("Não foi possível acessar nenhuma câmera deste dispositivo.")
            );
          }

          // Agora que temos um stream iniciado, a permissão está PROVADO que foi concedida pelo usuário.
          // Isso significa que enumerateDevices() agora retornará com labels válidas de maneira 100%!
          // Vamos validar se a track iniciada é realmente do tipo que queremos ou se caiu no fallback do lado oposto.
          let finalStream = mediaStream;
          try {
            const activeTrack = finalStream.getVideoTracks()[0];
            if (activeTrack) {
              const settings = activeTrack.getSettings();
              const trackLabel = (activeTrack.label || "").toLowerCase();
              const activeFacingMode = settings.facingMode || "";

              addLog("Validação pós-inicialização de track ativa:", {
                label: trackLabel,
                facingMode: activeFacingMode,
                deviceId: settings.deviceId,
                settings,
              });

              const frontKeywords = ["front", "frontal", "user", "selfie", "cara", "anterior"];
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

              const isActiveOpposite =
                activeMode === "environment"
                  ? activeFacingMode === "user" ||
                    frontKeywords.some((kw) => trackLabel.includes(kw))
                  : activeFacingMode === "environment" ||
                    rearKeywords.some((kw) => trackLabel.includes(kw));

              if (isActiveOpposite) {
                addLog(
                  `Parece ter iniciado no modo oposto do pretendido (${activeMode}). Buscando ID alternativo...`,
                );

                // Re-obtém os dispositivos agora que as labels estão desbloqueadas!
                const freshDevices = await navigator.mediaDevices.enumerateDevices();
                const realCameraId = findCameraId(freshDevices, activeMode);

                if (realCameraId && realCameraId !== settings.deviceId) {
                  addLog(
                    `Encontrado ID real compatível com ${activeMode} diferente de ${settings.deviceId}. Tentando comutar para ID: ${realCameraId}`,
                  );

                  // Liga a câmera específica
                  const exactConstraints = {
                    video: {
                      deviceId: { exact: realCameraId },
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    },
                  };

                  addLog("Solicitando stream exato da câmera alternativa...", exactConstraints);

                  try {
                    const customStream =
                      await navigator.mediaDevices.getUserMedia(exactConstraints);
                    if (customStream) {
                      addLog(
                        "Conseguimos abrir stream exato alternativo com sucesso! Parando track anterior...",
                      );
                      finalStream.getTracks().forEach((track) => {
                        try {
                          track.stop();
                        } catch (stopErr) {
                          /* ignore */
                        }
                      });
                      finalStream = customStream;
                      addLog(`Troca para câmera ${activeMode} concluída com sucesso absoluto!`);
                    }
                  } catch (getUserMediaError) {
                    addLog(
                      "Falha ao abrir câmera exata alternativa. Continuaremos com a atual para evitar tela preta.",
                      getUserMediaError,
                    );
                  }
                }
              }
            }
          } catch (switchError) {
            addLog("Erro na etapa de verificação/comutação fina pós-permissão:", switchError);
          }

          setStreamAndRef(finalStream);
          setStreamOn(true);
          // Atualiza a lista geral de dispositivos do Context
          await refreshDevices();
        } catch (error) {
          addLog("Erro fatal de acesso à câmera no startCamera:", error);
          const err = error as Record<string, unknown> | null;
          let userFriendlyMessage = "Não foi possível acessar a câmera do dispositivo.";

          if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
            userFriendlyMessage =
              "Permissão de câmera negada. Ative o acesso à câmera nas Definições do seu telemóvel.";
          } else if (
            err?.name === "NotReadableError" ||
            err?.name === "TrackStartError" ||
            err?.message?.includes("Could not start video source")
          ) {
            userFriendlyMessage =
              "A câmera já está em uso por outro aplicativo ou falhou em ser re-iniciada pelo sistema operacional. Tente fechar outras apps.";
          }

          toast.error(userFriendlyMessage);
          setStreamAndRef(null);
          setStreamOn(false);
        }
      };

      startPromiseRef.current = runStart();
      try {
        await startPromiseRef.current;
      } finally {
        startPromiseRef.current = null;
      }
    },
    [addLog, refreshDevices],
  );

  const toggleCamera = useCallback(async () => {
    const nextMode = facingModeRef.current === "environment" ? "user" : "environment";
    addLog(`Soliticação de alternar câmera de ${facingModeRef.current} para ${nextMode}`);
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);

    if (streamRef.current) {
      stopCamera(true); // Mantém streamOn como true durante a transição
      // Pequeno tempo para liberar a track anterior de forma segura
      await new Promise((resolve) => setTimeout(resolve, 250));
      await startCamera(nextMode);
    } else {
      await startCamera(nextMode);
    }
  }, [stopCamera, startCamera, addLog]);

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
