import React from "react";
import { motion } from "framer-motion";
import { Users, Loader2, Sparkles, Clock, CheckCircle2 } from "lucide-react";

export interface QueueState {
  jobId: string;
  position: number;
  totalInQueue: number;
  status: "queued" | "processing" | "completed" | "failed";
  estimatedWaitSeconds?: number;
}

interface Props {
  queueState: QueueState | null;
  title?: string;
  subtitle?: string;
}

export const QueueStatusCard: React.FC<Props> = ({
  queueState,
  title = "Fila de Processamento Inteligente",
  subtitle = "Garantindo a máxima precisão da análise sem sobrecarga do servidor",
}) => {
  if (!queueState) return null;

  const { position, totalInQueue, status, estimatedWaitSeconds = 0 } = queueState;
  const isProcessing = status === "processing" || position === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="w-full rounded-2xl border border-primary/25 bg-primary/5 dark:bg-primary/10 p-4 shadow-lg backdrop-blur-md space-y-3"
    >
      {/* Header com badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 animate-pulse">
            <Users className="size-4" />
          </div>
          <div>
            <span className="font-bold text-xs text-foreground block">{title}</span>
            <span className="text-[10px] text-muted-foreground block">{subtitle}</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-background/80 border border-primary/30 text-primary px-2.5 py-1 rounded-full shadow-xs">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
          {isProcessing ? "Processando agora" : "Em espera"}
        </span>
      </div>

      {/* Cartão de Posição na Fila */}
      <div className="grid grid-cols-2 gap-2 bg-background/60 dark:bg-background/40 rounded-xl p-3 border border-border/50">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground font-medium">Sua Posição</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isProcessing ? (
              <span className="text-base font-extrabold text-emerald-500 flex items-center gap-1">
                <Sparkles className="size-4 animate-spin text-emerald-500" /> Sua vez!
              </span>
            ) : (
              <span className="text-lg font-black text-primary">#{position}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col border-l border-border/40 pl-3">
          <span className="text-[10px] text-muted-foreground font-medium">Pessoas na Fila</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-lg font-bold text-foreground">{totalInQueue}</span>
            <span className="text-[10px] text-muted-foreground">aguardando</span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso e Estimativa */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin text-primary" />
            {isProcessing
              ? "A IA está analisando a foto agora..."
              : `Aguardando ${position - 1} ${position - 1 === 1 ? "pessoa" : "pessoas"} à sua frente`}
          </span>
          {estimatedWaitSeconds > 0 && !isProcessing && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-foreground">
              <Clock className="size-3 text-muted-foreground" /> ~{estimatedWaitSeconds}s
            </span>
          )}
        </div>

        <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
            initial={{ width: "15%" }}
            animate={{
              width: isProcessing ? "92%" : `${Math.max(10, 100 - position * 25)}%`,
            }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
};
