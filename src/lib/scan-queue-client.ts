import { getApiUrl } from "./utils";
import type { QueueState } from "@/components/queue-status-card";
import { sendNativePushNotification } from "./notifications";

export interface EnqueueOptions {
  type: "food_scan" | "calibrate_hand";
  payload: any;
  userId?: string | null;
  onQueueUpdate?: (state: QueueState) => void;
  pollIntervalMs?: number;
}

/**
 * Enfileira uma requisição de IA (scan de alimento ou calibração de mão)
 * e faz polling automático até a conclusão, disparando push nativo no APK ao finalizar.
 */
export async function submitToScanQueue<T = any>(options: EnqueueOptions): Promise<T> {
  const { type, payload, userId, onQueueUpdate, pollIntervalMs = 900 } = options;

  // 1. Enfileirar requisição
  const enqueueRes = await fetch(getApiUrl("/api/queue/enqueue"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload, user_id: userId }),
  });

  if (!enqueueRes.ok) {
    const errText = await enqueueRes.text();
    throw new Error(`Falha ao entrar na fila (${enqueueRes.status}): ${errText}`);
  }

  const enqueueData = await enqueueRes.json();
  const jobId = enqueueData.jobId;

  if (!jobId) {
    throw new Error("Identificador de fila não retornado pelo servidor.");
  }

  // Notifica estado inicial
  onQueueUpdate?.({
    jobId,
    position: enqueueData.position,
    totalInQueue: enqueueData.totalInQueue,
    status: "queued",
    estimatedWaitSeconds: enqueueData.position > 1 ? (enqueueData.position - 1) * 3 : 2,
  });

  // 2. Polling de status da fila até conclusão
  return new Promise<T>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 120; // 120 * 900ms = ~108s timeout

    const intervalId = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(intervalId);
        reject(new Error("Tempo limite de espera na fila excedido. Tente novamente."));
        return;
      }

      try {
        const statusRes = await fetch(getApiUrl(`/api/queue/status/${jobId}`));
        if (!statusRes.ok) {
          if (statusRes.status === 404) {
            clearInterval(intervalId);
            reject(new Error("Requisição na fila não encontrada."));
            return;
          }
          return; // ignora erros de rede momentâneos
        }

        const statusData = await statusRes.json();

        onQueueUpdate?.({
          jobId,
          position: statusData.position,
          totalInQueue: statusData.totalInQueue,
          status: statusData.status,
          estimatedWaitSeconds: statusData.estimatedWaitSeconds,
        });

        if (statusData.status === "completed") {
          clearInterval(intervalId);

          // Dispara notificação nativa no APK se estiver rodando no app instalado
          if (type === "food_scan") {
            sendNativePushNotification(
              "🔍 Análise Concluída!",
              "O escaneamento da sua refeição foi processado com sucesso.",
            );
          } else if (type === "calibrate_hand") {
            if (statusData.result?.sucesso === false) {
              sendNativePushNotification(
                "⚠️ Atenção na Verificação da Mão",
                statusData.result.titulo_erro ||
                  "A IA não conseguiu verificar a mão. Toque para ver o motivo e tentar novamente.",
              );
            } else {
              sendNativePushNotification(
                "🖐️ Calibração Concluída!",
                "A escala métrica da sua mão foi calculada com sucesso.",
              );
            }
          }

          resolve(statusData.result);
        } else if (statusData.status === "failed") {
          clearInterval(intervalId);
          reject(new Error(statusData.error || "Ocorreu um erro no processamento da imagem."));
        }
      } catch (pollErr) {
        console.warn("[Scan Queue Poll Warn]", pollErr);
      }
    }, pollIntervalMs);
  });
}
