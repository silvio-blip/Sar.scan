import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { isInstalledApp } from "@/lib/utils";
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
  triggerVoicePermissionDialog?: () => void;
  triggerBrowserCallBlockDialog?: () => void;
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
  const [showVoicePermissionDialog, setShowVoicePermissionDialog] = useState(false);
  const [showBrowserCallBlockDialog, setShowBrowserCallBlockDialog] = useState(false);
  const activeNotificationRef = useRef<Notification | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

    if (activeNotificationRef.current) {
      activeNotificationRef.current.close();
      activeNotificationRef.current = null;
    }

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

  const [peerId, setPeerId] = useState<string | null>(null);
  const peerIdRef = useRef<string | null>(null);

  const sendCallSignal = useCallback(
    async (
      targetId: string,
      type: "REJECTED" | "ENDED" | "CALL_REQUEST" | "CALL_RESPONSE",
      additionalPayload: any = {},
    ) => {
      if (!user?.id) return;
      console.log(`Sending signal ${type} to ${targetId}`, additionalPayload);
      const channel = supabase.channel(`call_signals_${targetId}`);
      try {
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "call-signal",
              payload: { type, from: user.id, ...additionalPayload },
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
      // Normalize otherId in case it's a PeerJS ID with random suffix
      const normalizedId = otherId.includes("_") ? otherId.split("_")[0] : otherId;

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
        normalizedId,
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
      if (!skipSignal && normalizedId) {
        sendCallSignal(normalizedId, finalDuration > 0 ? "ENDED" : "REJECTED");
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

      if (user?.id && normalizedId) {
        saveCallLog(normalizedId, finalDuration, finalType);
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

  const startCall = useCallback(async (targetId: string) => {
    console.log("Chamadas de voz desativadas:", targetId);
    toast.info("As chamadas de voz foram desativadas.");
  }, []);

  const answerCall = useCallback(async () => {
    if (!incomingCallRef.current) {
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

      // Tentar obter acesso ao microfone no atendimento
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
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
      toast.error("Erro ao atender chamada. Verifique o microfone.");
      setShowVoicePermissionDialog(true);
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

  const showNotification = useCallback(async (callerId: string) => {
    // Se o aplicativo estiver aberto e visível (foreground), NÃO mostre a Notificação Web superior
    // para evitar de exibir dois modais ao mesmo tempo. O modal interativo do React já cuida disso!
    if (document.visibilityState === "visible") {
      console.log(
        "[Notification] App visível em primeiro plano. Omitindo notificação web de som duplicada.",
      );
      return;
    }

    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", callerId)
        .maybeSingle();
      const name = profile?.nome || "Utilizador";
      const icon = profile?.avatar_url || "/apple-touch-icon.png";
      const n = new Notification(`Chamada de ${name}`, {
        body: "Está a receber uma chamada de voz! Toque para atender.",
        icon,
        requireInteraction: true,
        tag: "incoming-voice-call",
        vibrate: [200, 100, 200, 100, 200],
      });
      n.onclick = () => {
        window.focus();
        if (answerCallRef.current) {
          answerCallRef.current();
        }
        n.close();
      };
      activeNotificationRef.current = n;
    } catch (e) {
      console.error("[Notification] Error creating notification:", e);
    }
  }, []);

  const fetchOtherUserProfileRef = useRef(fetchOtherUserProfile);
  const startVibrationRef = useRef(startVibration);
  const handleCallEndRef = useRef(handleCallEnd);
  const startCallRef = useRef(startCall);
  const showNotificationRef = useRef(showNotification);
  const answerCallRef = useRef(answerCall);

  useEffect(() => {
    fetchOtherUserProfileRef.current = fetchOtherUserProfile;
    startVibrationRef.current = startVibration;
    handleCallEndRef.current = handleCallEnd;
    startCallRef.current = startCall;
    showNotificationRef.current = showNotification;
    answerCallRef.current = answerCall;
  }, [
    fetchOtherUserProfile,
    startVibration,
    handleCallEnd,
    startCall,
    showNotification,
    answerCall,
  ]);

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
            dialingAudioRef.current
              ?.play()
              .catch((err) => console.warn("Autoplay audio blocked:", err));
          } else {
            setStatus({ type: "ringing" });
            ringingAudioRef.current
              ?.play()
              .catch((err) => console.warn("Autoplay audio blocked:", err));
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

  // Listen for active_calls database changes to synchronize call statuses in real-time across devices
  useEffect(() => {
    if (!user?.id) return;

    const activeCallsChannel = supabase
      .channel(`active_calls_sync_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_calls",
        },
        async (payload) => {
          const currentStatus = statusRef.current;

          if (payload.eventType === "INSERT") {
            const newRow = payload.new;
            if (newRow.receiver_id === user.id && currentStatus.type === "idle") {
              fetchOtherUserProfileRef.current(newRow.caller_id);
              setStatus({ type: "ringing" });
              ringingAudioRef.current
                ?.play()
                .catch((err) => console.warn("Autoplay audio blocked:", err));
              startVibrationRef.current();
              showNotificationRef.current(newRow.caller_id);
            }
          } else if (payload.eventType === "UPDATE") {
            const nextRow = payload.new;
            if (
              nextRow.receiver_id === user.id &&
              nextRow.status === "connected" &&
              currentStatus.type === "ringing"
            ) {
              ringingAudioRef.current?.pause();
              stopVibration();
              if (activeNotificationRef.current) {
                activeNotificationRef.current.close();
                activeNotificationRef.current = null;
              }
              setStatus({ type: "idle" });
              setIncomingCall(null);
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old;
            const targetId = otherUserRef.current?.id;
            if (
              targetId &&
              ((oldRow.caller_id === user.id && oldRow.receiver_id === targetId) ||
                (oldRow.caller_id === targetId && oldRow.receiver_id === user.id))
            ) {
              handleCallEndRef.current(targetId, true);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activeCallsChannel);
    };
  }, [user?.id]);

  // Listen for Supabase Signals
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`call_signals_${user.id}`);
    console.log(`Subscribed to signal channel: call_signals_${user.id}`);

    channel
      .on("broadcast", { event: "call-signal" }, ({ payload }) => {
        console.log("Received call signal:", payload);
        const { type, from, peerId: senderPeerId } = payload;
        // If we receive a rejection or end signal, clean up
        if (type === "REJECTED" || type === "ENDED") {
          handleCallEndRef.current(from, true, type); // true = skip sending signal back
        } else if (type === "CALL_REQUEST") {
          console.log("Blocking incoming CALL_REQUEST because calling is fully disabled");
          sendCallSignal(from, "REJECTED");
          return;
        } else if (type === "CALL_RESPONSE") {
          // Caller receives target's Peer ID and initiates the call
          if (
            statusRef.current.type === "calling" &&
            from === otherUserRef.current?.id &&
            senderPeerId
          ) {
            console.log("Received CALL_RESPONSE with peerId:", senderPeerId);
            const currentPeer = peerRef.current;
            const stream = localStreamRef.current;

            if (currentPeer && stream) {
              const call = currentPeer.call(senderPeerId, stream);
              setActiveCall(call);

              call.on("stream", (remote) => {
                dialingAudioRef.current?.pause();
                setStatus({ type: "connected" });
                setRemoteStream(remote);
                if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
              });

              call.on("close", () => {
                console.log("Call connection closed in active call (caller side)");
                handleCallEndRef.current(from, true);
              });

              call.on("error", (err) => {
                console.warn("Call error in active call (caller side):", err);
                handleCallEndRef.current(from, true);
              });
            }
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

    // Do not initialize PeerJS on a standard web browser because call features are blocked/disabled there
    if (!isInstalledApp()) {
      console.log(
        "[PeerJS] Skipping PeerJS initialization since we are not running inside the installed native app.",
      );
      return;
    }

    let isDestroyed = false;
    let peerInstance: Peer | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initPeer = (id: string, attempt = 0) => {
      if (isDestroyed) return;

      // Always randomize the PeerJS ID to avoid collisions on refresh
      // The handshake via CALL_REQUEST/CALL_RESPONSE will handle finding this ID
      const finalId = `${id}_${Math.random().toString(36).substring(2, 6)}`;

      console.log(
        `[PeerJS] Initializing for user ${id} with random PeerId: ${finalId} (attempt ${attempt + 1})`,
      );

      const newPeer = new Peer(finalId, {
        debug: 0, // Disable internal logging to prevent PeerJS console.error from triggering UI overlays
      });

      peerInstance = newPeer;
      setPeer(newPeer);
      peerRef.current = newPeer;
      setPeerId(finalId);
      peerIdRef.current = finalId;

      newPeer.on("open", (pId) => {
        console.log("Peer successfully open with ID:", pId);
        setPeerId(pId);
        peerIdRef.current = pId;
        // Se cair e voltar, forçamos um status idle se não estiver em chamada real
        if (statusRef.current.type === "ended") {
          resetCall();
        }
      });

      newPeer.on("call", (incoming) => {
        console.log("Incoming PeerJS call from:", incoming.peer);

        if (
          statusRef.current.type !== "idle" &&
          statusRef.current.type !== "ringing" &&
          statusRef.current.type !== "calling"
        ) {
          console.log("Busy, rejecting call. Current status:", statusRef.current.type);
          incoming.close();
          return;
        }

        setIncomingCall(incoming);
        setStatus({ type: "ringing" });
        // The sender's ID in PeerJS might be randomized, so we rely on the Supabase signal
        // to have already fetched the profile. Or we can try to parse the peer ID if it follows our pattern.
        const otherSupabaseId = incoming.peer.includes("_")
          ? incoming.peer.split("_")[0]
          : incoming.peer;
        fetchOtherUserProfileRef.current(otherSupabaseId);
        showNotificationRef.current(otherSupabaseId);

        incoming.on("stream", (remote) => {
          // This is useful if the caller already established the stream
          console.log("Stream received on incoming call listener");
        });

        incoming.on("close", () => {
          console.log("Incoming call connection closed automatically");
          handleCallEndRef.current(otherSupabaseId, true);
        });

        incoming.on("error", (err) => {
          console.warn("Incoming call error:", err);
          handleCallEndRef.current(otherSupabaseId, true);
        });

        // Receiver hears the ringing sound
        ringingAudioRef.current
          ?.play()
          .catch((err) => console.warn("Autoplay audio blocked:", err));
        startVibrationRef.current();
      });

      newPeer.on("error", (err) => {
        const errorType = (err as { type: string }).type;
        console.warn("Peer root error:", errorType, err?.message || err);

        if (errorType === "unavailable-id") {
          console.warn("Peer ID already taken, trying with randomized suffix...");
          if (attempt < 5 && !isDestroyed) {
            newPeer.destroy();
            const delay = 500 + attempt * 500; // shorter wait if we are randomizing anyway
            retryTimeout = setTimeout(() => {
              if (!isDestroyed) initPeer(id, attempt + 1);
            }, delay);
          } else {
            toast.error("Erro de conexão persistente. Tente recarregar a página.");
          }
        } else if (errorType === "peer-unavailable") {
          // This happens if the handshake target went offline
          console.log("Target peer unavailable");
        } else if (errorType === "disconnected" || errorType === "network") {
          console.log("Peer disconnected, attempting to reconnect...");
          if (!newPeer.destroyed) {
            try {
              if (newPeer.disconnected) {
                newPeer.reconnect();
              } else {
                // Se recebemos erro de rede mas o PeerJS ainda acha que está conectado,
                // forçamos uma desconexão controlada antes de tentar reconectar
                // para evitar o erro "cannot reconnect because it is not disconnected".
                newPeer.disconnect();
                setTimeout(() => {
                  if (!newPeer.destroyed) newPeer.reconnect();
                }, 100);
              }
            } catch (reconnectErr) {
              console.warn("Reconnection failed:", reconnectErr);
            }
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
        try {
          peerInstance.destroy();
        } catch (e) {
          console.warn("Error destroying PeerJS instance:", e);
        }
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
    triggerVoicePermissionDialog: () => setShowVoicePermissionDialog(true),
    triggerBrowserCallBlockDialog: () => setShowBrowserCallBlockDialog(true),
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Microphone Permission Help Dialog */}
      <Dialog open={showVoicePermissionDialog} onOpenChange={setShowVoicePermissionDialog}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-[340px] rounded-[32px] p-6 flex flex-col items-center gap-4">
          <DialogHeader>
            <DialogTitle className="text-center font-black uppercase tracking-widest text-[10px] text-zinc-400">
              Permissão do Microfone
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="mx-auto size-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400 font-bold text-lg">
              🎙️
            </div>
            <h3 className="text-base font-black">Acesso Bloqueado</h3>
            {isInstalledApp() ? (
              <>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  O aplicativo não conseguiu acessar o microfone. Ative a permissão nas Definições
                  do seu dispositivo móvel:
                </p>
                <div className="text-left text-xs text-zinc-300 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
                  <p>
                    🟢 <b>1.</b> Vá às <b>Definições / Ajustes</b> do seu dispositivo móvel.
                  </p>
                  <p>
                    🟢 <b>2.</b> Aceda a <b>Aplicações / Gestor de Apps</b>.
                  </p>
                  <p>
                    🟢 <b>3.</b> Selecione este aplicativo na lista.
                  </p>
                  <p>
                    🟢 <b>4.</b> Clique em <b>Permissões</b> e ative o acesso ao <b>Microfone</b>.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  O seu navegador bloqueou o microfone. Para fazer ou receber chamadas, siga estes
                  passos no Android/iOS:
                </p>
                <div className="text-left text-xs text-zinc-300 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
                  <p>
                    🟢 <b>1.</b> No topo esquerdo (junto ao link do site), clique no símbolo de{" "}
                    <b>Definições de Site / Cadeado / Info</b>.
                  </p>
                  <p>
                    🟢 <b>2.</b> Localize a opção <b>Microfone</b>.
                  </p>
                  <p>
                    🟢 <b>3.</b> Altere a definição para <b>Permitir</b>.
                  </p>
                  <p>
                    🟢 <b>4.</b> Se estiver na app, autorize o microfone quando solicitado pelo
                    telemóvel.
                  </p>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={() => {
              setShowVoicePermissionDialog(false);
              navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
            }}
            className="w-full h-11 rounded-2xl bg-white text-black font-black hover:bg-zinc-200"
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      {/* Browser Call Block Dialog */}
      <Dialog open={showBrowserCallBlockDialog} onOpenChange={setShowBrowserCallBlockDialog}>
        <DialogContent className="bg-zinc-950/98 border-white/10 text-white max-w-[340px] rounded-[32px] p-6 flex flex-col items-center gap-4 text-center shadow-2xl backdrop-blur-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Funcionalidade de Chamada Bloqueada</DialogTitle>
          </DialogHeader>
          <div className="size-16 rounded-3xl bg-amber-500/10 border border-amber-500/10 flex items-center justify-center text-amber-500">
            <PhoneOff className="size-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-white">
              Ligar só na App Instalada
            </h3>
            <p className="text-sm font-semibold text-rose-400">
              A única forma de utilizador conseguir utilizar o aplicativo é só instalando.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O seu navegador não suporta a receção e transmissão de chamadas fiáveis em standby de
              forma nativa. Por favor, instale a aplicação oficial em formato APK para usufruir de
              todas as funcionalidades de voz e chat nativos em segundo plano.
            </p>
          </div>
          <Button
            onClick={() => setShowBrowserCallBlockDialog(false)}
            className="w-full h-11 rounded-2xl bg-white text-black font-black hover:bg-zinc-200 transition-colors uppercase tracking-wider text-xs"
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
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
