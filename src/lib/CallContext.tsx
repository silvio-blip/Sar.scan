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
    async (targetId: string, type: "REJECTED" | "ENDED" | "CALL_REQUEST" | "CALL_RESPONSE", additionalPayload: any = {}) => {
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

  const startCall = useCallback(
    async (targetId: string) => {
      const currentPeer = peerRef.current || peer;
      if (!currentPeer) {
        toast.error("Conexão de áudio ainda não está pronta. Aguarde um momento.");
        return;
      }
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

        // Wakeup signal - include our peerId if we want them to call us back (not used here yet but good practice)
        sendCallSignal(targetId, "CALL_REQUEST", { peerId: peerIdRef.current });

        // Note: Actual peer.call will happen when we receive CALL_RESPONSE from the target
        // But for backward compatibility or if they use the direct user.id peerId, we can try to call directly after a small delay
        // However, with the new handshake, we should wait for CALL_RESPONSE.
        
        // For now, let's also try calling the direct user.id as a fallback
        // const call = currentPeer.call(targetId, stream);
        // ... (this part will be handled in the signal listener)
      } catch (err) {
        console.error("Error starting call:", err);
        toast.error("Erro ao acessar microfone. Verifique as suas permissões.");
        setShowVoicePermissionDialog(true);
        resetCall();
      }
    },
    [peer, user?.id, fetchOtherUserProfile, sendCallSignal, resetCall],
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
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", callerId)
        .maybeSingle();
      const name = profile?.nome || "Utilizador";
      const icon = profile?.avatar_url || "https://sar-scan.vercel.app/apple-touch-icon.png";
      const n = new Notification(`Chamada de ${name}`, {
        body: "Está a receber uma chamada de voz! Toque para atender.",
        icon,
        requireInteraction: true,
        tag: "incoming-voice-call",
        vibrate: [200, 100, 200, 100, 200]
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
  }, [fetchOtherUserProfile, startVibration, handleCallEnd, startCall, showNotification, answerCall]);

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

  // Listen for active_calls database changes to synchronize call statuses in real-time across devices
  useEffect(() => {
    if (!user?.id) return;

    const activeCallsChannel = supabase.channel(`active_calls_sync_${user.id}`)
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
              ringingAudioRef.current?.play().catch(console.error);
              startVibrationRef.current();
              showNotificationRef.current(newRow.caller_id);
            }
          } else if (payload.eventType === "UPDATE") {
            const nextRow = payload.new;
            if (nextRow.receiver_id === user.id && nextRow.status === "connected" && currentStatus.type === "ringing") {
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
            if (targetId && (
              (oldRow.caller_id === user.id && oldRow.receiver_id === targetId) ||
              (oldRow.caller_id === targetId && oldRow.receiver_id === user.id)
            )) {
              handleCallEndRef.current(targetId, true);
            }
          }
        }
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
          // Send back our peer ID so the caller can call us
          if (peerIdRef.current) {
            sendCallSignal(from, "CALL_RESPONSE", { peerId: peerIdRef.current });
          }
          
          if (statusRef.current.type === "idle") {
            fetchOtherUserProfileRef.current(from);
          } else if (statusRef.current.type === "calling" && from === otherUserRef.current?.id) {
            // Re-initiate if they refreshed
            console.log("Receiver refreshed, re-requesting call...");
            sendCallSignal(from, "CALL_REQUEST", { peerId: peerIdRef.current });
          }
        } else if (type === "CALL_RESPONSE") {
          // Caller receives target's Peer ID and initiates the call
          if (statusRef.current.type === "calling" && from === otherUserRef.current?.id && senderPeerId) {
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
                console.error("Call error in active call (caller side):", err);
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

    let isDestroyed = false;
    let peerInstance: Peer | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initPeer = (id: string, attempt = 0) => {
      if (isDestroyed) return;

      // Always randomize the PeerJS ID to avoid collisions on refresh
      // The handshake via CALL_REQUEST/CALL_RESPONSE will handle finding this ID
      const finalId = `${id}_${Math.random().toString(36).substring(2, 6)}`;
      
      console.log(`[PeerJS] Initializing for user ${id} with random PeerId: ${finalId} (attempt ${attempt + 1})`);

      const newPeer = new Peer(finalId, {
        debug: 1, // Only errors
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

        if (statusRef.current.type !== "idle" && statusRef.current.type !== "ringing" && statusRef.current.type !== "calling") {
          console.log("Busy, rejecting call. Current status:", statusRef.current.type);
          incoming.close();
          return;
        }

        setIncomingCall(incoming);
        setStatus({ type: "ringing" });
        // The sender's ID in PeerJS might be randomized, so we rely on the Supabase signal 
        // to have already fetched the profile. Or we can try to parse the peer ID if it follows our pattern.
        const otherSupabaseId = incoming.peer.includes("_") ? incoming.peer.split("_")[0] : incoming.peer;
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
          console.error("Incoming call error:", err);
          handleCallEndRef.current(otherSupabaseId, true);
        });

        // Receiver hears the ringing sound
        ringingAudioRef.current?.play().catch(console.error);
        startVibrationRef.current();
      });

      newPeer.on("error", (err) => {
        const errorType = (err as { type: string }).type;
        console.error("Peer root error:", errorType, err);

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
              console.error("Reconnection failed:", reconnectErr);
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

      {/* WhatsApp-style floating heads-up call banner at the top of the screen */}
      {status.type === "ringing" && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 w-[min(92vw,400px)] z-[99999] bg-zinc-950/98 border border-white/10 p-4 rounded-[24px] shadow-2xl backdrop-blur-3xl flex items-center justify-between gap-3 text-white ring-1 ring-white/5 transition-all"
        >
          <div className="flex items-center gap-3 min-w-0" onClick={() => answerCall()}>
            <div className="relative shrink-0">
              <Avatar className="size-11 border border-white/10">
                <AvatarImage src={otherUser?.avatar_url} />
                <AvatarFallback className="bg-zinc-800 text-sm font-black text-white">
                  {otherUser?.nome?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 size-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-zinc-900">
                <Phone className="size-2 text-black fill-current animate-bounce" />
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full inline-block mb-1">
                Chamada de Voz
              </span>
              <p className="text-sm font-black text-white truncate leading-none mb-0.5">
                {otherUser?.nome || "Utilizador"}
              </p>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">
                Toque para atender a chamada...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                rejectCall();
              }}
              variant="destructive"
              size="icon"
              className="size-9 rounded-full bg-rose-500 hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-rose-500/20"
            >
              <PhoneOff className="size-4" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                answerCall();
              }}
              size="icon"
              className="size-9 rounded-full bg-emerald-500 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all text-black flex items-center justify-center shadow-lg shadow-emerald-500/20"
            >
              <Phone className="size-4" />
            </Button>
          </div>
        </motion.div>
      )}

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
                  O aplicativo não conseguiu acessar o microfone.
                  Ative a permissão nas Definições do seu dispositivo móvel:
                </p>
                <div className="text-left text-xs text-zinc-300 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
                  <p>🟢 <b>1.</b> Vá às <b>Definições / Ajustes</b> do seu dispositivo móvel.</p>
                  <p>🟢 <b>2.</b> Aceda a <b>Aplicações / Gestor de Apps</b>.</p>
                  <p>🟢 <b>3.</b> Selecione este aplicativo na lista.</p>
                  <p>🟢 <b>4.</b> Clique em <b>Permissões</b> e ative o acesso ao <b>Microfone</b>.</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  O seu navegador bloqueou o microfone.
                  Para fazer ou receber chamadas, siga estes passos no Android/iOS:
                </p>
                <div className="text-left text-xs text-zinc-300 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
                  <p>🟢 <b>1.</b> No topo esquerdo (junto ao link do site), clique no símbolo de <b>Definições de Site / Cadeado / Info</b>.</p>
                  <p>🟢 <b>2.</b> Localize a opção <b>Microfone</b>.</p>
                  <p>🟢 <b>3.</b> Altere a definição para <b>Permitir</b>.</p>
                  <p>🟢 <b>4.</b> Se estiver na app, autorize o microfone quando solicitado pelo telemóvel.</p>
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
