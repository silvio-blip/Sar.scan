import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import Peer, { MediaConnection } from "peerjs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CallOverlay } from "@/components/CallOverlay";
import { isNativePlatform, getApiUrl } from "@/lib/utils";
import { Smartphone, BellRing, PhoneIncoming, Download } from "lucide-react";

export interface CallStatus {
  type: "idle" | "calling" | "ringing" | "connected" | "ended" | "missed" | "rejected" | "offline";
  startTime?: number;
  offlineReason?: string;
}

export interface UserProfile {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  email?: string;
  fcm_token?: string | null;
}

export interface CallContextType {
  peer: Peer | null;
  activeCall: MediaConnection | null;
  incomingCall: MediaConnection | null;
  isCalling: boolean;
  status: CallStatus;
  callDuration: number;
  otherUser: UserProfile | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isMinimized: boolean;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleMinimize: () => void;
  startCall: (targetId: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
  isNativeApp: boolean;
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
  const [, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>({ type: "idle" });
  const [callDuration, setCallDuration] = useState(0);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showWebBlockedDialog, setShowWebBlockedDialog] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const reachabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const offlineAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const isMutedRef = useRef(isMuted);
  const isSpeakerOnRef = useRef(isSpeakerOn);
  const onlineUsersRef = useRef(onlineUsers);
  const [showVoicePermissionDialog, setShowVoicePermissionDialog] = useState(false);
  const activeNotificationRef = useRef<Notification | null>(null);

  const [, setPeerId] = useState<string | null>(null);
  const peerIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);
  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  const stopOfflineSound = useCallback(() => {
    if (offlineAudioCtxRef.current) {
      try {
        offlineAudioCtxRef.current.close();
      } catch (err) {
        void err;
      }
      offlineAudioCtxRef.current = null;
    }
  }, []);

  // Som diferenciado / esquisito quando utilizador está offline (Special Information Tone ITU-T telecom reorder)
  const playOfflineWeirdSound = useCallback(
    (volumeMultiplier = 1.0) => {
      stopOfflineSound();
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        offlineAudioCtxRef.current = ctx;

        const playTone = (
          f1: number,
          f2: number,
          start: number,
          dur: number,
          type: OscillatorType = "sine",
          gainVal = 0.25,
        ) => {
          const o1 = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          const g = ctx.createGain();

          o1.type = type;
          o2.type = type;
          o1.frequency.setValueAtTime(f1, start);
          o2.frequency.setValueAtTime(f2, start);

          const effectiveGain = Math.min(0.4, gainVal * volumeMultiplier);
          g.gain.setValueAtTime(effectiveGain, start);
          g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

          o1.connect(g);
          o2.connect(g);
          g.connect(ctx.destination);

          o1.start(start);
          o2.start(start);
          o1.stop(start + dur);
          o2.stop(start + dur);
        };

        const now = ctx.currentTime;
        // Três tons dissonantes característicos de número sem rede / indisponível (SIT)
        playTone(950, 914, now, 0.28, "sawtooth", 0.16);
        playTone(1400, 1370, now + 0.32, 0.28, "sawtooth", 0.16);
        playTone(1800, 1776, now + 0.64, 0.35, "sawtooth", 0.16);

        // Sequência rápida de batimentos estranhos (tu-tu-tu-tu)
        playTone(480, 620, now + 1.1, 0.18, "sine", 0.2);
        playTone(480, 620, now + 1.35, 0.18, "sine", 0.2);
        playTone(480, 620, now + 1.6, 0.18, "sine", 0.2);
        playTone(480, 620, now + 1.85, 0.28, "sine", 0.2);
      } catch (err) {
        console.warn("Could not play offline sound:", err);
      }
    },
    [stopOfflineSound],
  );

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      const vol = next ? 1.0 : 0.25;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = vol;
      }
      if (dialingAudioRef.current) {
        dialingAudioRef.current.volume = vol;
      }
      if (ringingAudioRef.current) {
        ringingAudioRef.current.volume = vol;
      }
      return next;
    });
  }, []);

  const isUserOnline = useCallback(
    (userId: string) => {
      if (!userId) return false;
      const cleanId = userId.includes("_") ? userId.split("_")[0] : userId;
      return onlineUsers.has(cleanId);
    },
    [onlineUsers],
  );

  // Monitorização de presença global no Supabase
  useEffect(() => {
    if (!user?.id) return;

    const presenceChannel = supabase.channel("global_presence", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set<string>();
        Object.keys(state).forEach((key) => {
          ids.add(key);
          const entries = state[key] as any[];
          if (Array.isArray(entries)) {
            entries.forEach((item) => {
              if (item?.user_id) ids.add(item.user_id);
            });
          }
        });
        setOnlineUsers(ids);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.add(key);
          newPresences?.forEach((p: any) => {
            if (p?.user_id) next.add(p.user_id);
          });
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.id]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
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

  // Sons de chamada
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
    console.log("[Call] Executing resetCall");
    if (reachabilityTimerRef.current) {
      clearTimeout(reachabilityTimerRef.current);
      reachabilityTimerRef.current = null;
    }
    stopOfflineSound();

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
    setIsMuted(false);
    setIsMinimized(false);
  }, [stopOfflineSound, stopVibration, user?.id]);

  const resetCallRef = useRef(resetCall);
  useEffect(() => {
    resetCallRef.current = resetCall;
  }, [resetCall]);

  const sendCallSignal = useCallback(
    async (
      targetId: string,
      type:
        | "REJECTED"
        | "ENDED"
        | "CALL_REQUEST"
        | "CALL_RESPONSE"
        | "CALL_ACCEPTED"
        | "PING"
        | "PONG",
      additionalPayload: Record<string, unknown> = {},
    ) => {
      if (!user?.id) return;
      console.log(`[Call] Sending signal ${type} to ${targetId}`, additionalPayload);
      const channel = supabase.channel(`call_signals_${targetId}`);
      try {
        await channel.subscribe(async (chStatus) => {
          if (chStatus === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "call-signal",
              payload: { type, from: user.id, ...additionalPayload },
            });
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

  const sendCallSignalRef = useRef(sendCallSignal);
  useEffect(() => {
    sendCallSignalRef.current = sendCallSignal;
  }, [sendCallSignal]);

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

      try {
        await supabase.from("direct_messages").insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content,
          type: "call_log",
        });

        qc.invalidateQueries({ queryKey: ["dm"] });
        qc.invalidateQueries({ queryKey: ["recent_chats"] });
      } catch (err) {
        console.error("Error saving call log:", err);
      }
    },
    [user, qc],
  );

  const handleCallEnd = useCallback(
    (otherId: string, skipSignal = false, signalType?: "REJECTED" | "ENDED") => {
      const normalizedId = otherId.includes("_") ? otherId.split("_")[0] : otherId;

      const currentStatus = statusRef.current;
      if (currentStatus.type === "idle" || currentStatus.type === "ended") return;

      const finalDuration = durationRef.current;

      let finalType: "missed" | "rejected" | "ended" = "ended";
      if (finalDuration > 0) {
        finalType = "ended";
      } else if (signalType === "REJECTED" || currentStatus.type === "rejected") {
        finalType = "rejected";
      } else if (currentStatus.type === "calling" || currentStatus.type === "ringing") {
        finalType = "missed";
      }

      console.log("[Call] handleCallEnd for:", normalizedId, "finalType:", finalType);

      activeCallRef.current?.close();
      incomingCallRef.current?.close();

      ringingAudioRef.current?.pause();
      dialingAudioRef.current?.pause();
      stopVibration();

      if (!skipSignal && normalizedId) {
        sendCallSignalRef.current(normalizedId, finalDuration > 0 ? "ENDED" : "REJECTED");
      }

      if (finalDuration > 0 || signalType === "ENDED") {
        setStatus({ type: "ended" });
        setTimeout(() => resetCallRef.current(), 2500);
      } else if (signalType === "REJECTED" || finalType === "rejected") {
        setStatus({ type: "rejected" });
        setTimeout(() => resetCallRef.current(), 2000);
      } else {
        resetCallRef.current();
      }

      if (user?.id && normalizedId) {
        saveCallLog(normalizedId, finalDuration, finalType);
      }
    },
    [saveCallLog, stopVibration, user?.id],
  );

  const fetchOtherUserProfile = useCallback(async (id: string | undefined) => {
    if (!id) return null;
    const cleanId = id.includes("_") ? id.split("_")[0] : id;
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url, email, fcm_token")
      .eq("id", cleanId)
      .maybeSingle();
    if (data) {
      setOtherUser(data as UserProfile);
      return data as UserProfile;
    }
    return null;
  }, []);

  const showNotification = useCallback(async (callerId: string) => {
    if (document.visibilityState === "visible") {
      return;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const cleanId = callerId.includes("_") ? callerId.split("_")[0] : callerId;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", cleanId)
        .maybeSingle();
      const name = profile?.nome || "Utilizador";
      const icon = profile?.avatar_url || "/favicon.ico";
      const n = new Notification(`Chamada de ${name}`, {
        body: "Está a receber uma chamada de voz! Toque para atender.",
        icon,
        requireInteraction: true,
        tag: "incoming-voice-call",
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

  const startCall = useCallback(
    async (targetId: string) => {
      if (!user?.id) {
        toast.error("Inicie sessão para fazer chamadas.");
        return;
      }
      if (user.id === targetId) {
        toast.error("Não pode ligar para si mesmo.");
        return;
      }

      // Barramento de chamada na Web:
      // Conforme o fluxo nativo (Estilo WhatsApp), chamadas com notificações de alta prioridade
      // exigem a aplicação Android (APK) instalada nativamente. Na web o acesso é barrado.
      if (!isNativePlatform()) {
        setShowWebBlockedDialog(true);
        try {
          if (typeof window !== "undefined") {
            window.alert(
              "Para fazer ou receber chamadas com notificações em tempo real, descarrega a nossa aplicação!",
            );
          }
        } catch (alertErr) {
          void alertErr;
        }
        toast.warning(
          "Para fazer ou receber chamadas com notificações em tempo real, descarrega a nossa aplicação!",
        );
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.error("Sem ligação à internet. Verifique a sua conexão.");
        return;
      }

      if (reachabilityTimerRef.current) {
        clearTimeout(reachabilityTimerRef.current);
        reachabilityTimerRef.current = null;
      }
      stopOfflineSound();

      try {
        // Pedir permissão e obter áudio do microfone
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (mediaErr) {
          console.error("Erro no microfone:", mediaErr);
          setShowVoicePermissionDialog(true);
          return;
        }

        // Se o utilizador já mutou o microfone, aplicar ao stream
        if (isMutedRef.current) {
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        }

        setLocalStream(stream);
        localStreamRef.current = stream;

        // Buscar dados do outro utilizador
        const cleanTargetId = targetId.includes("_") ? targetId.split("_")[0] : targetId;
        const targetProfile = await fetchOtherUserProfile(targetId);

        setStatus({ type: "calling" });
        setIsMinimized(false);

        if (dialingAudioRef.current) {
          dialingAudioRef.current.volume = isSpeakerOnRef.current ? 1.0 : 0.25;
          dialingAudioRef.current.play().catch((e) => console.warn("Dialing sound error:", e));
        }

        // Registrar em active_calls (dispara notificações Google/FCM e listeners em tempo real)
        try {
          await supabase
            .from("active_calls")
            .delete()
            .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);

          await supabase.from("active_calls").insert({
            caller_id: user.id,
            receiver_id: targetId,
            status: "ringing",
          });
        } catch (dbErr) {
          console.error("Erro ao registrar active_calls:", dbErr);
        }

        // Enviar notificação FCM de alta prioridade para acordar o dispositivo caso esteja fora da app
        try {
          fetch(getApiUrl("/api/notifications/send"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetUserId: cleanTargetId,
              title: `Chamada de ${user.user_metadata?.nome || "Amigo"}`,
              body: "Chamada de voz a entrar... Toque para atender.",
              data: {
                type: "INCOMING_CALL",
                callerId: user.id,
                callerName: user.user_metadata?.nome || "Amigo",
                callerAvatar: user.user_metadata?.avatar_url || "",
                roomId: user.id,
                callId: user.id,
              },
            }),
          }).catch((pushErr) => console.warn("[Call] Push dispatch warning:", pushErr));
        } catch (e) {
          console.warn("[Call] Push dispatch error:", e);
        }

        const myPeerId = peerIdRef.current || peerRef.current?.id;
        console.log(`[Call] Enviando CALL_REQUEST para ${targetId} com PeerID: ${myPeerId}`);
        await sendCallSignalRef.current(targetId, "CALL_REQUEST", {
          peerId: myPeerId,
        });
        await sendCallSignalRef.current(targetId, "PING");

        // Sistema de deteção se o utilizador está online com conexão à internet:
        const isTargetInPresence = onlineUsersRef.current.has(cleanTargetId);
        const hasFcmToken = !!targetProfile?.fcm_token;

        // Se o utilizador não está presente no Supabase e não tem token FCM,
        // ele não possui qualquer dispositivo com internet ativo!
        // Detecta offline rapidamente (1.8s para feedback visual suave) e toca o som esquisito.
        // Se possui FCM, aguarda até 4.5s pela resposta PING/PONG do dispositivo conectado à internet.
        if (!isTargetInPresence) {
          const probeMs = !hasFcmToken ? 1800 : 4500;
          reachabilityTimerRef.current = setTimeout(() => {
            if (statusRef.current.type === "calling") {
              console.log(`[Call] Reachability timeout: ${cleanTargetId} is offline.`);
              dialingAudioRef.current?.pause();
              stopVibration();

              setStatus({
                type: "offline",
                offlineReason:
                  "O utilizador não tem ligação à internet no momento ou está indisponível.",
              });
              playOfflineWeirdSound(isSpeakerOnRef.current ? 1.0 : 0.3);
              toast.error("O utilizador não tem ligação à internet no momento.");

              if (user?.id) {
                saveCallLog(cleanTargetId, 0, "missed");
              }

              supabase
                .from("active_calls")
                .delete()
                .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);

              setTimeout(() => {
                if (statusRef.current.type === "offline") {
                  resetCallRef.current();
                }
              }, 4500);
            }
          }, probeMs);
        }
      } catch (err) {
        console.error("Erro ao iniciar chamada:", err);
        toast.error("Não foi possível iniciar a chamada.");
        resetCallRef.current();
      }
    },
    [
      user?.id,
      user?.user_metadata?.nome,
      fetchOtherUserProfile,
      playOfflineWeirdSound,
      stopOfflineSound,
      stopVibration,
      saveCallLog,
    ],
  );

  const answerCall = useCallback(async () => {
    try {
      ringingAudioRef.current?.pause();
      stopVibration();

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(stream);
          localStreamRef.current = stream;
        } catch (mediaErr) {
          console.error("Erro no microfone ao atender:", mediaErr);
          setShowVoicePermissionDialog(true);
          resetCallRef.current();
          return;
        }
      }

      if (user?.id && otherUser?.id) {
        try {
          await supabase
            .from("active_calls")
            .update({ status: "connected" })
            .match({ caller_id: otherUser.id, receiver_id: user.id });
        } catch (err) {
          console.error("Erro ao atualizar active_calls status:", err);
        }
      }

      setStatus({ type: "connected" });
      setIsMinimized(false);

      if (incomingCallRef.current) {
        const currentIncoming = incomingCallRef.current;
        setIncomingCall(null);
        setActiveCall(currentIncoming);
        activeCallRef.current = currentIncoming;

        currentIncoming.answer(stream);
        currentIncoming.on("stream", (remote) => {
          console.log("[Call] Remote stream received on receiver side");
          setRemoteStream(remote);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
            remoteAudioRef.current.play().catch((e) => console.warn("Remote audio play error:", e));
          }
        });

        currentIncoming.on("close", () => {
          console.log("[Call] Connection closed on receiver side");
          handleCallEnd(currentIncoming.peer, true);
        });

        currentIncoming.on("error", (err) => {
          console.warn("[Call] Error on receiver side:", err);
          handleCallEnd(currentIncoming.peer, true);
        });
      } else if (otherUser?.id) {
        sendCallSignalRef.current(otherUser.id, "CALL_ACCEPTED", {
          peerId: peerIdRef.current,
        });
      }
    } catch (err) {
      console.error("Error in answerCall:", err);
      toast.error("Erro ao atender chamada.");
      resetCallRef.current();
    }
  }, [user?.id, otherUser, stopVibration, handleCallEnd]);

  const rejectCall = useCallback(() => {
    const otherId = otherUserRef.current?.id || incomingCallRef.current?.peer;
    if (otherId) {
      const cleanId = otherId.includes("_") ? otherId.split("_")[0] : otherId;
      sendCallSignalRef.current(cleanId, "REJECTED");
      saveCallLog(cleanId, 0, "rejected");
    }
    resetCallRef.current();
  }, [saveCallLog]);

  const endCall = useCallback(() => {
    handleCallEnd(otherUserRef.current?.id || "");
  }, [handleCallEnd]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getAudioTracks();
        tracks.forEach((t) => {
          t.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
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

  // Recuperar chamada ativa na montagem
  useEffect(() => {
    if (!user?.id) return;

    const restoreCall = async () => {
      const { data } = await supabase
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
              .catch((err) => console.warn("Dialing audio blocked:", err));
          } else {
            setStatus({ type: "ringing" });
            ringingAudioRef.current
              ?.play()
              .catch((err) => console.warn("Ringing audio blocked:", err));
            startVibrationRef.current();
          }
        } else if (data.status === "connected") {
          setStatus({ type: "idle" });
          await supabase.from("active_calls").delete().eq("id", data.id);
        }
      }
    };

    restoreCall();
  }, [user?.id]);

  // Ouvir mudanças na tabela active_calls via Supabase Realtime
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
            const newRow = payload.new as any;
            if (newRow.receiver_id === user.id && currentStatus.type === "idle") {
              fetchOtherUserProfileRef.current(newRow.caller_id);
              setStatus({ type: "ringing" });
              ringingAudioRef.current
                ?.play()
                .catch((err) => console.warn("Ringing audio blocked:", err));
              startVibrationRef.current();
              showNotificationRef.current(newRow.caller_id);
            }
          } else if (payload.eventType === "UPDATE") {
            const nextRow = payload.new as any;
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
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as any;
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
  }, [user?.id, stopVibration]);

  // Ouvir sinais de broadcast via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`call_signals_${user.id}`);
    console.log(`[Call] Subscribed to broadcast: call_signals_${user.id}`);

    channel
      .on("broadcast", { event: "call-signal" }, ({ payload }) => {
        console.log("[Call] Broadcast signal received:", payload);
        const { type, from, peerId: senderPeerId } = payload;

        if (type === "REJECTED" || type === "ENDED") {
          handleCallEndRef.current(from, true, type);
        } else if (type === "PING") {
          console.log("[Call] Received PING from:", from, "- replying PONG");
          sendCallSignalRef.current(from, "PONG");
        } else if (type === "PONG") {
          console.log("[Call] Received PONG from:", from, "- recipient is online!");
          if (reachabilityTimerRef.current) {
            clearTimeout(reachabilityTimerRef.current);
            reachabilityTimerRef.current = null;
          }
        } else if (type === "CALL_REQUEST") {
          if (statusRef.current.type !== "idle" && statusRef.current.type !== "ringing") {
            console.log("[Call] Busy, rejecting incoming request from:", from);
            sendCallSignalRef.current(from, "REJECTED");
            return;
          }

          fetchOtherUserProfileRef.current(from);
          setStatus({ type: "ringing" });
          setIsMinimized(false);
          ringingAudioRef.current
            ?.play()
            .catch((err) => console.warn("Ringing audio blocked:", err));
          startVibrationRef.current();
          showNotificationRef.current(from);

          // Enviar resposta com o nosso PeerID para o chamador conseguir ligar
          const myPeerId = peerIdRef.current || peerRef.current?.id;
          if (myPeerId) {
            sendCallSignalRef.current(from, "CALL_RESPONSE", {
              peerId: myPeerId,
            });
          }
        } else if (type === "CALL_RESPONSE") {
          if (reachabilityTimerRef.current) {
            clearTimeout(reachabilityTimerRef.current);
            reachabilityTimerRef.current = null;
          }

          if (
            statusRef.current.type === "calling" &&
            from === otherUserRef.current?.id &&
            senderPeerId
          ) {
            console.log("[Call] Received CALL_RESPONSE with peerId:", senderPeerId);
            const currentPeer = peerRef.current;
            const stream = localStreamRef.current;

            if (currentPeer && stream) {
              const call = currentPeer.call(senderPeerId, stream);
              setActiveCall(call);
              activeCallRef.current = call;

              call.on("stream", (remote) => {
                dialingAudioRef.current?.pause();
                setStatus({ type: "connected" });
                setRemoteStream(remote);
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = remote;
                  remoteAudioRef.current.play().catch((e) => console.warn("Audio play error:", e));
                }
              });

              call.on("close", () => {
                console.log("[Call] Active call closed (caller)");
                handleCallEndRef.current(from, true);
              });

              call.on("error", (err) => {
                console.warn("[Call] Error in active call (caller):", err);
                handleCallEndRef.current(from, true);
              });
            }
          }
        } else if (type === "CALL_ACCEPTED") {
          console.log("[Call] Remote user accepted call:", from);
          dialingAudioRef.current?.pause();
          setStatus({ type: "connected" });

          if (senderPeerId && peerRef.current && localStreamRef.current && !activeCallRef.current) {
            const call = peerRef.current.call(senderPeerId, localStreamRef.current);
            setActiveCall(call);
            activeCallRef.current = call;

            call.on("stream", (remote) => {
              setRemoteStream(remote);
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remote;
                remoteAudioRef.current
                  .play()
                  .catch((e) => console.warn("Remote audio play error:", e));
              }
            });

            call.on("close", () => handleCallEndRef.current(from, true));
            call.on("error", () => handleCallEndRef.current(from, true));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Inicializar PeerJS para qualquer utilizador autenticado
  useEffect(() => {
    if (!user?.id) return;

    let isDestroyed = false;
    let peerInstance: Peer | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initPeer = (id: string, attempt = 0) => {
      if (isDestroyed) return;

      const finalId = `${id}_${Math.random().toString(36).substring(2, 6)}`;
      console.log(
        `[PeerJS] Initializing for user ${id} with PeerID: ${finalId} (attempt ${attempt + 1})`,
      );

      const newPeer = new Peer(finalId, {
        debug: 0,
      });

      peerInstance = newPeer;
      setPeer(newPeer);
      peerRef.current = newPeer;
      setPeerId(finalId);
      peerIdRef.current = finalId;

      newPeer.on("open", (pId) => {
        console.log("[PeerJS] Peer open with ID:", pId);
        setPeerId(pId);
        peerIdRef.current = pId;
        if (statusRef.current.type === "ended") {
          resetCallRef.current();
        }
      });

      newPeer.on("call", (incoming) => {
        console.log("[PeerJS] Incoming call from peer:", incoming.peer);

        if (
          statusRef.current.type !== "idle" &&
          statusRef.current.type !== "ringing" &&
          statusRef.current.type !== "calling"
        ) {
          console.log("[PeerJS] Busy, rejecting call");
          incoming.close();
          return;
        }

        setIncomingCall(incoming);
        incomingCallRef.current = incoming;
        setStatus({ type: "ringing" });
        setIsMinimized(false);

        const otherSupabaseId = incoming.peer.includes("_")
          ? incoming.peer.split("_")[0]
          : incoming.peer;
        fetchOtherUserProfileRef.current(otherSupabaseId);
        showNotificationRef.current(otherSupabaseId);

        incoming.on("stream", (remote) => {
          console.log("[PeerJS] Stream received on incoming listener");
          setRemoteStream(remote);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
            remoteAudioRef.current.play().catch((e) => console.warn("Remote audio play error:", e));
          }
        });

        incoming.on("close", () => {
          console.log("[PeerJS] Incoming call closed automatically");
          handleCallEndRef.current(otherSupabaseId, true);
        });

        incoming.on("error", (err) => {
          console.warn("[PeerJS] Incoming call error:", err);
          handleCallEndRef.current(otherSupabaseId, true);
        });

        ringingAudioRef.current
          ?.play()
          .catch((err) => console.warn("Autoplay audio blocked:", err));
        startVibrationRef.current();
      });

      newPeer.on("error", (err) => {
        const errorType = (err as { type: string }).type;
        console.warn("[PeerJS] Root error:", errorType, err?.message || err);

        if (errorType === "unavailable-id") {
          if (attempt < 5 && !isDestroyed) {
            newPeer.destroy();
            const delay = 500 + attempt * 500;
            retryTimeout = setTimeout(() => {
              if (!isDestroyed) initPeer(id, attempt + 1);
            }, delay);
          }
        } else if (errorType === "disconnected" || errorType === "network") {
          if (!newPeer.destroyed) {
            try {
              if (newPeer.disconnected) {
                newPeer.reconnect();
              } else {
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
      console.log("[PeerJS] Cleaning up Peer instance");
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

  // Tempo limite para chamadas não atendidas (45 segundos)
  useEffect(() => {
    if (status.type === "calling") {
      const timeout = setTimeout(() => {
        handleCallEnd(otherUser?.id || "");
        toast.info("O utilizador não atendeu");
      }, 45000);
      return () => clearTimeout(timeout);
    }
  }, [status.type, otherUser?.id, handleCallEnd]);

  // Contador de duração da chamada
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
    otherUser,
    isMuted,
    isSpeakerOn,
    isMinimized,
    isNativeApp: isNativePlatform(),
    toggleMute,
    toggleSpeaker,
    toggleMinimize,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    remoteAudioRef,
    onlineUsers,
    isUserOnline,
    triggerVoicePermissionDialog: () => setShowVoicePermissionDialog(true),
    triggerBrowserCallBlockDialog: () => setShowWebBlockedDialog(true),
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Interface Visual Completa da Chamada */}
      <CallOverlay />

      {/* Diálogo de Bloqueio da Web - Notificação Nativa Estilo WhatsApp Requer APK */}
      <Dialog open={showWebBlockedDialog} onOpenChange={setShowWebBlockedDialog}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-[360px] rounded-[32px] p-6 flex flex-col items-center gap-4 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center font-black uppercase tracking-widest text-[10px] text-emerald-400 flex items-center justify-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Notificações de Alta Prioridade (FCM)
            </DialogTitle>
          </DialogHeader>

          <div className="text-center space-y-3">
            <div className="mx-auto size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Smartphone className="size-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black tracking-tight text-white">
                Chamadas Nativas no Android
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para fazer ou receber chamadas com notificações em tempo real estilo WhatsApp (mesmo
                com o ecrã bloqueado ou com a aplicação fechada), descarrega a nossa aplicação
                oficial!
              </p>
            </div>

            <div className="text-left text-xs text-zinc-300 space-y-2.5 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold shrink-0">📲</span>
                <div>
                  <b className="text-white">Push FCM de Alta Prioridade:</b> Acorda o dispositivo do
                  amigo mesmo com o app fechado em segundo plano.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold shrink-0">🔔</span>
                <div>
                  <b className="text-white">Ecrã de Chamada a Tocar:</b> Notificação nativa com
                  botões de Atender ou Recusar.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold shrink-0">🎙️</span>
                <div>
                  <b className="text-white">Áudio WebRTC Cristalino:</b> Conecta a sala de voz
                  imediatamente ao aceitar.
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-2 pt-1">
            <Button
              onClick={() => {
                setShowWebBlockedDialog(false);
                window.open("/download", "_blank");
              }}
              className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Download className="size-4" />
              Descarregar Aplicação Android
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowWebBlockedDialog(false)}
              className="w-full h-9 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold text-xs"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Ajuda com Permissões de Microfone */}
      <Dialog open={showVoicePermissionDialog} onOpenChange={setShowVoicePermissionDialog}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-[340px] rounded-[32px] p-6 flex flex-col items-center gap-4">
          <DialogHeader>
            <DialogTitle className="text-center font-black uppercase tracking-widest text-[10px] text-zinc-400">
              Permissão do Microfone
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="mx-auto size-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 font-bold text-lg">
              🎙️
            </div>
            <h3 className="text-base font-black">Acesso ao Microfone</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Para efetuar ou receber chamadas de voz, permita o acesso ao microfone nas definições
              do seu navegador ou dispositivo móvel.
            </p>
            <div className="text-left text-xs text-zinc-300 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5 font-medium leading-relaxed">
              <p>
                🟢 <b>1.</b> Verifique o ícone de permissão ou cadeado na barra de navegação.
              </p>
              <p>
                🟢 <b>2.</b> Localize a opção <b>Microfone</b> e escolha <b>Permitir</b>.
              </p>
              <p>
                🟢 <b>3.</b> Na aplicação Android/APK, aceda a{" "}
                <b>Definições &gt; Aplicações &gt; Permissões</b> e ative o microfone.
              </p>
            </div>
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
