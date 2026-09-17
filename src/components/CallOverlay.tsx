import React from "react";
import { useCall } from "@/lib/CallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Volume2, Volume1, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const CallOverlay: React.FC = () => {
  const {
    status,
    callDuration,
    otherUser,
    isMuted,
    isSpeakerOn,
    isMinimized,
    toggleMute,
    toggleSpeaker,
    toggleMinimize,
    answerCall,
    rejectCall,
    endCall,
  } = useCall();

  if (status.type === "idle") return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Se o utilizador minimizou a chamada ativa
  if (isMinimized && status.type === "connected") {
    return (
      <div
        onClick={toggleMinimize}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900/95 border border-emerald-500/30 text-white shadow-2xl px-4 py-2.5 rounded-full flex items-center gap-3 backdrop-blur-xl cursor-pointer hover:bg-zinc-850 transition-all select-none animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <Avatar className="size-7 rounded-full border border-white/20">
          <AvatarImage src={otherUser?.avatar_url || ""} />
          <AvatarFallback className="text-[10px] bg-zinc-800 text-white">
            {otherUser?.nome?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold truncate max-w-[120px]">
            {otherUser?.nome || "Em chamada"}
          </span>
          <span className="text-xs font-mono font-medium text-emerald-400">
            {formatTime(callDuration)}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          className="size-7 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white ml-1 transition-colors"
          title="Terminar chamada"
        >
          <PhoneOff className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur-3xl text-white flex flex-col items-center justify-between p-6 sm:p-10 select-none"
      >
        {/* Top Header */}
        <div className="w-full max-w-md flex items-center justify-between pt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
            {isSpeakerOn ? (
              <Volume2 className="size-3.5 text-emerald-400" />
            ) : (
              <Volume1 className="size-3.5 text-zinc-300" />
            )}
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-300">
              {isSpeakerOn ? "Altifalante Ativo" : "Auscultador"}
            </span>
          </div>

          {status.type === "connected" && (
            <button
              onClick={toggleMinimize}
              className="size-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors"
              title="Minimizar chamada"
            >
              <Minimize2 className="size-4" />
            </button>
          )}
        </div>

        {/* Center Content: Avatar, Name, Status */}
        <div className="flex flex-col items-center justify-center text-center my-auto space-y-6">
          {/* Avatar with animated rings */}
          <div className="relative">
            {status.type === "calling" && (
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            )}
            {status.type === "ringing" && (
              <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-pulse" />
            )}
            {status.type === "connected" && (
              <div className="absolute -inset-3 rounded-full bg-emerald-500/15" />
            )}
            {status.type === "offline" && (
              <div className="absolute -inset-2 rounded-full bg-amber-500/20" />
            )}

            <Avatar className="size-32 sm:size-36 rounded-full border-4 border-white/15 shadow-2xl relative z-10">
              <AvatarImage src={otherUser?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="bg-zinc-800 text-4xl font-bold text-white">
                {otherUser?.nome?.[0] || "U"}
              </AvatarFallback>
            </Avatar>

            {status.type === "offline" && (
              <div className="absolute -bottom-2 -right-2 z-20 size-10 rounded-full bg-amber-600 border-2 border-zinc-950 flex items-center justify-center shadow-lg">
                <WifiOff className="size-5 text-white" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {otherUser?.nome || "Utilizador"}
            </h2>

            {/* Status Display */}
            {status.type === "calling" && (
              <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />A chamar...
              </p>
            )}

            {status.type === "ringing" && (
              <p className="text-sm font-semibold text-amber-400 flex items-center justify-center gap-2">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                Chamada a entrar...
              </p>
            )}

            {status.type === "connected" && (
              <div className="flex flex-col items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold tracking-widest">
                  {formatTime(callDuration)}
                </span>
                {/* Audio wave simulation bars */}
                <div className="flex items-center gap-1 h-5 pt-1">
                  <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="w-1 h-5 bg-emerald-400 rounded-full animate-pulse [animation-delay:150ms]" />
                  <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse [animation-delay:300ms]" />
                  <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:75ms]" />
                </div>
              </div>
            )}

            {status.type === "offline" && (
              <div className="flex flex-col items-center gap-1.5 max-w-xs mx-auto">
                <p className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1.5">
                  <WifiOff className="size-4" />
                  Sem ligação à internet
                </p>
                <p className="text-xs text-zinc-400 leading-tight">
                  {status.offlineReason ||
                    "O utilizador está offline ou sem conexão à internet no momento."}
                </p>
              </div>
            )}

            {status.type === "ended" && (
              <p className="text-sm font-semibold text-zinc-400">Chamada terminada</p>
            )}

            {status.type === "rejected" && (
              <p className="text-sm font-semibold text-rose-400">Chamada recusada ou ocupada</p>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full max-w-sm flex items-center justify-around pb-8 px-4">
          {/* Outgoing call or connected: show Mute, Speaker, and End Call buttons */}
          {(status.type === "calling" || status.type === "connected") && (
            <>
              {/* Botão de Microfone / Mutar */}
              <button
                onClick={toggleMute}
                className="flex flex-col items-center gap-2 group transition-colors"
                title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
              >
                <div
                  className={`size-14 rounded-full flex items-center justify-center transition-all ${
                    isMuted
                      ? "bg-amber-500/25 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                      : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                  }`}
                >
                  {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {isMuted ? "Mutado" : "Silenciar"}
                </span>
              </button>

              {/* Botão de Desligar / Cancelar */}
              <button
                onClick={endCall}
                className="flex flex-col items-center gap-2 group"
                title="Desligar chamada"
              >
                <div className="size-16 rounded-full bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-600/40 flex items-center justify-center text-white transition-all transform active:scale-95 group-hover:scale-105">
                  <PhoneOff className="size-7" />
                </div>
                <span className="text-[11px] font-bold text-zinc-300">
                  {status.type === "calling" ? "Cancelar" : "Desligar"}
                </span>
              </button>

              {/* Botão de Altifalante / Som Alto vs Som Baixo */}
              <button
                onClick={toggleSpeaker}
                className="flex flex-col items-center gap-2 group transition-colors"
                title={isSpeakerOn ? "Mudar para auscultador" : "Mudar para altifalante (som alto)"}
              >
                <div
                  className={`size-14 rounded-full flex items-center justify-center transition-all ${
                    isSpeakerOn
                      ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                      : "bg-white/10 text-zinc-300 hover:bg-white/20 border border-white/10"
                  }`}
                >
                  {isSpeakerOn ? <Volume2 className="size-6" /> : <Volume1 className="size-6" />}
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {isSpeakerOn ? "Som Alto" : "Som Baixo"}
                </span>
              </button>
            </>
          )}

          {/* Incoming call state */}
          {status.type === "ringing" && (
            <>
              <button onClick={rejectCall} className="flex flex-col items-center gap-2 group">
                <div className="size-16 rounded-full bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-600/30 flex items-center justify-center text-white transition-all transform active:scale-95 group-hover:scale-105">
                  <PhoneOff className="size-7" />
                </div>
                <span className="text-xs font-bold text-zinc-400">Recusar</span>
              </button>

              <button onClick={answerCall} className="flex flex-col items-center gap-2 group">
                <div className="size-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 flex items-center justify-center text-white transition-all transform active:scale-95 group-hover:scale-105 animate-bounce">
                  <Phone className="size-7" />
                </div>
                <span className="text-xs font-bold text-emerald-400">Atender</span>
              </button>
            </>
          )}

          {/* Offline or ended state: close button */}
          {(status.type === "offline" || status.type === "ended" || status.type === "rejected") && (
            <button onClick={endCall} className="flex flex-col items-center gap-2 group">
              <div className="size-14 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-white/10 shadow-xl flex items-center justify-center text-white transition-all transform active:scale-95 group-hover:scale-105">
                <PhoneOff className="size-6 text-zinc-400" />
              </div>
              <span className="text-[11px] font-bold text-zinc-400">Fechar</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
