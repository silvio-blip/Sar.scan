import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import Peer, { MediaConnection } from "peerjs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CallStatus {
  type: "idle" | "calling" | "ringing" | "connected" | "ended" | "missed" | "rejected";
  startTime?: number;
}

interface UserProfile {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  email?: string;
}

interface CallContextType {
  peer: Peer | null;
  activeCall: MediaConnection | null;
  incomingCall: MediaConnection | null;
  isCalling: boolean;
  status: CallStatus;
  callDuration: number;
  startCall: (targetId: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const RINGING_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3";
const DIALING_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>({ type: "idle" });
  const [callDuration, setCallDuration] = useState(0);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialingAudioRef = useRef<HTMLAudioElement | null>(null);

  const statusRef = useRef(status);
  const durationRef = useRef(callDuration);
  const vibeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const incomingCallRef = useRef<MediaConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const otherUserRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    durationRef.current = callDuration;
  }, [callDuration]);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  useEffect(() => {
    otherUserRef.current = otherUser;
  }, [otherUser]);

  const stopVibration = useCallback(() => {
    if (vibeIntervalRef.current) {
      clearInterval(vibeIntervalRef.current);
      vibeIntervalRef.current = null;
    }
    if ("vibrate" in navigator) navigator.vibrate(0);
  }, []);

  const startVibration = useCallback(() => {
    stopVibration();
    if ("vibrate" in navigator) {
      const pattern = [500, 500];
      navigator.vibrate(pattern);
      vibeIntervalRef.current = setInterval(() => {
        navigator.vibrate(pattern);
      }, 1000);
    }
  }, [stopVibration]);

  // Initialize sounds
  useEffect(() => {
    ringingAudioRef.current = new Audio(RINGING_SOUND_URL);
    ringingAudioRef.current.loop = true;
    dialingAudioRef.current = new Audio(DIALING_SOUND_URL);
    dialingAudioRef.current.loop = true;

    return () => {
      ringingAudioRef.current?.pause();
      dialingAudioRef.current?.pause();
    };
  }, []);

  const resetCall = useCallback(async () => {
    console.log("resetCall executed");
    // Stop all media and close connections
    activeCallRef.current?.close();
    incomingCallRef.current?.close();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    ringingAudioRef.current?.pause();
    dialingAudioRef.current?.pause();
    stopVibration();

    // Remove from active_calls table if any
    if (user?.id) {
      try {
        await supabase
          .from("active_calls")
          .delete()
          .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);
      } catch (err) {
        console.error("Error clearing active_calls:", err);
      }
    }

    setActiveCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setStatus({ type: "idle" });
    setCallDuration(0);
    setOtherUser(null);
  }, [stopVibration, user?.id]);

  const sendCallSignal = useCallback(
    async (targetId: string, type: "REJECTED" | "ENDED" | "CALL_REQUEST") => {
      if (!user?.id) return;
      console.log(`Sending signal ${type} to ${targetId}`);
      const channel = supabase.channel(`call_signals_${targetId}`);
      try {
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "call-signal",
              payload: { type, from: user.id },
            });
            // Don't remove immediately to ensure broadcast delivery
            setTimeout(() => {
              supabase.removeChannel(channel);
            }, 1000);
          }
        });
      } catch (err) {
        console.error("Error sending call signal:", err);
      }
    },
    [user?.id],
  );

  const saveCallLog = useCallback(
    async (receiverId: string, duration: number, type: "missed" | "rejected" | "ended") => {
      if (!user || !receiverId) return;

      let content = "";
      if (type === "ended") {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        content = `Chamada de voz terminada (${durationStr})`;
      } else if (type === "missed") {
        content = "Chamada não atendida";
      } else if (type === "rejected") {
        content = "Chamada recusada";
      }

      await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        type: "call_log",
      });

      qc.invalidateQueries({ queryKey: ["dm"] });
      qc.invalidateQueries({ queryKey: ["recent_chats"] });
    },
    [user, qc],
  );

  const handleCallEnd = useCallback(
    (otherId: string, skipSignal = false, signalType?: "REJECTED" | "ENDED") => {
      const currentStatus = statusRef.current;
      if (currentStatus.type === "idle" || currentStatus.type === "ended") return;

      const finalDuration = durationRef.current;

      // Determine the log type
      let finalType: "missed" | "rejected" | "ended" = "ended";
      if (finalDuration > 0) {
        finalType = "ended";
      } else if (signalType === "REJECTED" || currentStatus.type === "rejected") {
        finalType = "rejected";
      } else if (currentStatus.type === "calling" || currentStatus.type === "ringing") {
        finalType = "missed";
      }

      console.log(
        "handleCallEnd called for:",
        otherId,
        "finalType:",
        finalType,
        "skipSignal:",
        skipSignal,
      );

      // Close PeerJS connections immediately
      activeCallRef.current?.close();
      incomingCallRef.current?.close();

      ringingAudioRef.current?.pause();
      dialingAudioRef.current?.pause();
      stopVibration();

      // Send signal to other peer if needed
      if (!skipSignal && otherId) {
        sendCallSignal(otherId, finalDuration > 0 ? "ENDED" : "REJECTED");
      }

      // Update UI Status
      if (finalDuration > 0 || signalType === "ENDED") {
        setStatus({ type: "ended" });
        setTimeout(() => resetCall(), 3000);
      } else if (signalType === "REJECTED" || finalType === "rejected") {
        setStatus({ type: "rejected" });
        setTimeout(() => resetCall(), 2000);
      } else {
        resetCall();
      }

      if (user?.id && otherId) {
        saveCallLog(otherId, finalDuration, finalType);
      }
    },
    [resetCall, saveCallLog, stopVibration, user?.id, sendCallSignal],
  );

  const fetchOtherUserProfile = useCallback(async (id: string | undefined) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url, email")
      .eq("id", id)
      .single();
    if (data) {
      setOtherUser(data as UserProfile);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startCall = useCallback(
    async (targetId: string) => {
      const currentPeer = peerRef.current || peer;
      if (!currentPeer) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        setStatus({ type: "calling" });
        fetchOtherUserProfile(targetId);

        // Persistence
        if (user?.id) {
          await supabase.from("active_calls").insert({
            caller_id: user.id,
            receiver_id: targetId,
            status: "ringing",
          });
        }

        // Wakeup signal
        sendCallSignal(targetId, "CALL_REQUEST");

        const call = currentPeer.call(targetId, stream);
        setActiveCall(call);

        call.on("stream", (remote) => {
          dialingAudioRef.current?.pause();
          setStatus({ type: "connected" });
          setRemoteStream(remote);
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
        });

        call.on("close", () => {
          console.log("Call connection closed in startCall");
          if (statusRef.current.type === "calling") {
            setStatus({ type: "rejected" });
            setTimeout(() => resetCall(), 2000);
          } else {
            handleCallEnd(targetId, true);
          }
        });

        call.on("error", (err) => {
          console.error("Call error in startCall:", err);
          handleCallEnd(targetId, true);
        });
      } catch (err) {
        toast.error("Erro ao acessar microfone");
        resetCall();
      }
    },
    [peer, user?.id, fetchOtherUserProfile, sendCallSignal, resetCall, handleCallEnd],
  );

  const answerCall = useCallback(async () => {
    if (!incomingCallRef.current) {
      // If we recovered from refresh, we don't have incomingCallRef yet.
      // We signal the caller we are back so they might retry
      if (status.type === "ringing" && otherUser) {
        sendCallSignal(otherUser.id, "CALL_REQUEST");
      }
      return;
    }
    try {
      ringingAudioRef.current?.pause();
      stopVibration();

      // Persistence update
      if (user?.id && otherUser?.id) {
        await supabase
          .from("active_calls")
          .update({ status: "connected" })
          .match({ caller_id: otherUser.id, receiver_id: user.id });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setStatus({ type: "connected" });

      const currentIncoming = incomingCallRef.current;
      setIncomingCall(null);
      setActiveCall(currentIncoming);

      currentIncoming.answer(stream);
      currentIncoming.on("stream", (remote) => {
        console.log("Remote stream received in answerCall");
        setRemoteStream(remote);
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
      });

      currentIncoming.on("close", () => {
        console.log("Call connection closed in answerCall");
        handleCallEnd(currentIncoming.peer, true);
      });
    } catch (err) {
      console.error("Error in answerCall:", err);
      toast.error("Erro ao atender chamada");
      resetCall();
    }
  }, [user?.id, otherUser, stopVibration, resetCall, handleCallEnd, sendCallSignal, status.type]);

  const rejectCall = useCallback(() => {
    if (incomingCallRef.current) {
      const otherId = incomingCallRef.current.peer;
      console.log("Rejecting call from:", otherId);
      sendCallSignal(otherId, "REJECTED");
      incomingCallRef.current.close();
      saveCallLog(otherId, 0, "rejected");
    }
    resetCall();
  }, [sendCallSignal, saveCallLog, resetCall]);

  const endCall = useCallback(() => {
    handleCallEnd(otherUser?.id || "");
  }, [handleCallEnd, otherUser?.id]);

  const fetchOtherUserProfileRef = useRef(fetchOtherUserProfile);
  const startVibrationRef = useRef(startVibration);
  const handleCallEndRef = useRef(handleCallEnd);
  const startCallRef = useRef(startCall);

  useEffect(() => {
    fetchOtherUserProfileRef.current = fetchOtherUserProfile;
    startVibrationRef.current = startVibration;
    handleCallEndRef.current = handleCallEnd;
    startCallRef.current = startCall;
  }, [fetchOtherUserProfile, startVibration, handleCallEnd, startCall]);

  // Restore active calls on mount or when user changes
  useEffect(() => {
    if (!user?.id) return;

    const restoreCall = async () => {
      const { data, error } = await supabase
        .from("active_calls")
        .select("*")
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .maybeSingle();

      if (data) {
        const isCaller = data.caller_id === user.id;
        const otherId = isCaller ? data.receiver_id : data.caller_id;
        fetchOtherUserProfileRef.current(otherId);

        if (data.status === "ringing") {
          if (isCaller) {
            setStatus({ type: "calling" });
            dialingAudioRef.current?.play().catch(console.error);
          } else {
            setStatus({ type: "ringing" });
            ringingAudioRef.current?.play().catch(console.error);
            startVibrationRef.current();
          }
        } else if (data.status === "connected") {
          // If was connected, we show "ended" because PeerJS connection is lost
          setStatus({ type: "idle" });
          await supabase.from("active_calls").delete().eq("id", data.id);
        }
      }
    };

    restoreCall();
  }, [user?.id]);

  // Listen for Supabase Signals
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`call_signals_${user.id}`);
    console.log(`Subscribed to signal channel: call_signals_${user.id}`);

    channel
      .on("broadcast", { event: "call-signal" }, ({ payload }) => {
        console.log("Received call signal:", payload);
        const { type, from } = payload;
        // If we receive a rejection or end signal, clean up
        if (type === "REJECTED" || type === "ENDED") {
          handleCallEndRef.current(from, true, type); // true = skip sending signal back
        } else if (type === "CALL_REQUEST") {
          if (statusRef.current.type === "idle") {
            fetchOtherUserProfileRef.current(from);
          } else if (statusRef.current.type === "calling" && from === otherUserRef.current?.id) {
            // If we are calling and receive a CALL_REQUEST from the same person,
            // it means they refreshed and lost the incoming call. We re-initiate PeerJS call.
            console.log("Receiver refreshed, re-initiating PeerJS call...");
            startCallRef.current(from);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Initialize Peer - Strictly dependent on user.id to prevent recreation during calls
  useEffect(() => {
    if (!user?.id) return;

    let isDestroyed = false;
    let peerInstance: Peer | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initPeer = (id: string, attempt = 0) => {
      if (isDestroyed) return;

      console.log(`Initializing Peer with ID: ${id} (attempt ${attempt + 1})`);

      const newPeer = new Peer(id, {
        debug: 1, // Only errors
      });

      peerInstance = newPeer;
      setPeer(newPeer);
      peerRef.current = newPeer;

      newPeer.on("open", (peerId) => {
        console.log("Peer successfully open with ID:", peerId);
      });

      newPeer.on("call", (incoming) => {
        console.log("Incoming PeerJS call from:", incoming.peer);

        if (statusRef.current.type !== "idle" && statusRef.current.type !== "ringing") {
          console.log("Busy, rejecting call. Current status:", statusRef.current.type);
          incoming.close();
          return;
        }

        setIncomingCall(incoming);
        setStatus({ type: "ringing" });
        fetchOtherUserProfileRef.current(incoming.peer);

        incoming.on("close", () => {
          console.log("Incoming call connection closed automatically");
          handleCallEndRef.current(incoming.peer, true);
        });

        incoming.on("error", (err) => {
          console.error("Incoming call error:", err);
          handleCallEndRef.current(incoming.peer, true);
        });

        // Receiver hears the ringing sound
        ringingAudioRef.current?.play().catch(console.error);
        startVibrationRef.current();
      });

      newPeer.on("error", (err) => {
        const errorType = (err as { type: string }).type;
        console.error("Peer root error:", errorType, err);

        if (errorType === "unavailable-id") {
          console.warn("Peer ID already taken, delaying retry...");
          if (attempt < 5 && !isDestroyed) {
            newPeer.destroy();
            const delay = 3000 + attempt * 2000; // increasing delay 3s, 5s, 7s...
            retryTimeout = setTimeout(() => {
              if (!isDestroyed) initPeer(id, attempt + 1);
            }, delay);
          } else {
            toast.error("Erro de conexão persistente. Tente recarregar a página.");
          }
        } else if (errorType === "peer-unavailable") {
          toast.error("O utilizador não está disponível");
          if (statusRef.current.type === "calling" || statusRef.current.type === "ringing") {
            handleCallEndRef.current(
              incomingCallRef.current?.peer || activeCallRef.current?.peer || "",
              true,
            );
          }
        } else if (errorType === "disconnected" || errorType === "network") {
          console.log("Peer disconnected, attempting to reconnect...");
          if (!newPeer.destroyed) {
            newPeer.reconnect();
          }
        }
      });
    };

    initPeer(user.id);

    return () => {
      isDestroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      console.log("Cleaning up Peer instance");
      if (peerInstance) {
        peerInstance.destroy();
      }
      peerRef.current = null;
    };
  }, [user?.id]);

  // Calling timeout
  useEffect(() => {
    if (status.type === "calling") {
      const timeout = setTimeout(() => {
        handleCallEnd(otherUser?.id || "");
        toast.info("O utilizador não atendeu");
      }, 45000);
      return () => clearTimeout(timeout);
    }
  }, [status.type, otherUser?.id, handleCallEnd]);

  // Timer logic
  useEffect(() => {
    if (status.type === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status.type]);

  const isCalling = status.type !== "idle";

  const value: CallContextType = {
    peer,
    activeCall,
    incomingCall,
    isCalling,
    status,
    callDuration,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    remoteAudioRef,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Incoming Call Dialog */}
      <Dialog open={status.type === "ringing"} onOpenChange={(open) => !open && rejectCall()}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-[320px] rounded-[32px] p-8 flex flex-col items-center gap-6">
          <DialogHeader>
            <DialogTitle className="text-center font-black uppercase tracking-widest text-[10px] opacity-40">
              Chamada de Voz a Receber
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="relative"
            >
              <Avatar className="size-24 border-4 border-emerald-500/20">
                <AvatarImage src={otherUser?.avatar_url} />
                <AvatarFallback className="bg-zinc-800 text-2xl font-black">
                  {otherUser?.nome?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 size-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-zinc-900">
                <Phone className="size-4 text-black fill-current" />
              </div>
            </motion.div>
            <div className="text-center">
              <h3 className="text-xl font-black">{otherUser?.nome || "Utilizador"}</h3>
              <p className="text-xs font-bold text-emerald-500">Está a ligar-lhe...</p>
            </div>
          </div>

          <div className="flex gap-4 w-full justify-center mt-4">
            <Button
              onClick={() => rejectCall()}
              variant="destructive"
              size="icon"
              className="size-14 rounded-full shadow-lg shadow-rose-500/20 hover:scale-105 transition-transform"
            >
              <PhoneOff className="size-6" />
            </Button>
            <Button
              onClick={() => answerCall()}
              className="size-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"
            >
              <Phone className="size-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Call Overlay / Screen */}
      {(status.type === "calling" ||
        status.type === "connected" ||
        status.type === "ended" ||
        status.type === "rejected") && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-between p-12 pb-20 overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-20">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{ repeat: Infinity, duration: 5 }}
              className="absolute top-1/4 -left-1/4 size-[500px] bg-emerald-500 rounded-full blur-[120px]"
            />
            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 7 }}
              className="absolute bottom-1/4 -right-1/4 size-[500px] bg-emerald-600 rounded-full blur-[120px]"
            />
          </div>

          <div className="relative z-10 w-full flex flex-col items-center gap-8">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 transition-all duration-500">
                {status.type === "calling"
                  ? "A Ligar..."
                  : status.type === "connected"
                    ? "Em Chamada"
                    : status.type === "rejected"
                      ? "Chamada Recusada"
                      : "Chamada Terminada"}
              </p>
              {status.type === "connected" && (
                <p className="text-2xl font-mono font-black text-white tabular-nums tracking-tighter">
                  {formatTime(callDuration)}
                </p>
              )}
              {status.type === "ended" && (
                <p className="text-emerald-500 font-bold uppercase text-[10px]">
                  Duração: {formatTime(callDuration)}
                </p>
              )}
            </div>

            <div className="relative">
              <motion.div
                animate={
                  status.type === "calling"
                    ? {
                        scale: [1, 1.1, 1],
                        opacity: [1, 0.8, 1],
                      }
                    : {}
                }
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Avatar className="size-40 border-4 border-white/5 ring-8 ring-white/[0.02]">
                  <AvatarImage src={otherUser?.avatar_url} />
                  <AvatarFallback className="bg-zinc-900 text-4xl font-black">
                    {otherUser?.nome?.[0]}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              {status.type === "connected" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-2 -right-2 size-12 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-zinc-950"
                >
                  <div className="size-3 bg-black rounded-full animate-ping" />
                </motion.div>
              )}
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight">
                {otherUser?.nome || "Utilizador"}
              </h2>
              <p className="text-white/40 font-bold text-sm">{otherUser?.email}</p>
            </div>
          </div>

          <div className="relative z-10 w-full flex items-center justify-center gap-8">
            {status.type !== "ended" && status.type !== "rejected" && (
              <Button
                onClick={() => handleCallEnd(otherUser?.id || "")}
                variant="destructive"
                size="icon"
                className="size-20 rounded-full shadow-2xl shadow-rose-500/40 hover:scale-110 active:scale-95 transition-all"
              >
                <PhoneOff className="size-8" />
              </Button>
            )}

            {(status.type === "ended" || status.type === "rejected") && (
              <Button
                onClick={() => resetCall()}
                variant="outline"
                className="bg-white/5 border-white/10 text-white rounded-full px-8 py-6 font-black uppercase tracking-widest text-xs hover:bg-white/10"
              >
                Fechar
              </Button>
            )}
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
