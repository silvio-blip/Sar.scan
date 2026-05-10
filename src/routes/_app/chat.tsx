import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Crown,
  Send,
  Loader2,
  Lock,
  Search,
  Phone,
  ArrowLeft,
  User,
  MessagesSquare,
  X,
  PhoneOff,
  UserPlus,
  Check,
  CheckCheck,
  Clock,
  Share2,
  UserMinus,
  PlusCircle,
  Undo2,
  Trash2,
  Sparkles,
  ChevronRight,
  Send as SendIcon,
  Mic,
  MicOff,
  Play,
  Pause,
  Trash,
} from "lucide-react";
import { motion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Peer, { MediaConnection } from "peerjs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCall } from "@/lib/CallContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type ChatView = "list" | "dm" | "ai" | "find-friends" | "requests";
type Message = {
  id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  created_at: string;
  is_read?: boolean;
  role?: string; // for AI
};

// Helper component for messages with long-press and reply logic
// Visualizador de voz para gravação e mensagens
const AudioWaveform = ({
  isPlaying = false,
  progress = 0,
  playbackRate = 1,
  color = "#10b981",
}: {
  isPlaying: boolean;
  progress: number;
  playbackRate?: number;
  color?: string;
}) => {
  const bars = 20;
  return (
    <div className="flex items-center gap-[2px] h-6 px-1">
      {Array.from({ length: bars }).map((_, i) => {
        const isPast = (i / bars) * 100 <= progress;
        const height = 20 + Math.sin(i * 1.5) * 15 + Math.cos(i * 0.5) * 5;
        return (
          <motion.div
            key={i}
            className="w-[2px] rounded-full"
            initial={{ height: 4 }}
            animate={{
              height: isPlaying ? [height * 0.5, height, height * 0.5] : height * 0.8,
              backgroundColor: isPast ? color : "rgba(255,255,255,0.1)",
            }}
            transition={{
              height: {
                duration: isPlaying ? 0.5 / playbackRate : 0,
                repeat: Infinity,
                delay: i * 0.05,
              },
              backgroundColor: { duration: 0.1 },
            }}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = 3;
      const barPadding = 2;
      const totalBarWidth = barWidth + barPadding;
      const xStart = (canvas.width - 12 * totalBarWidth) / 2;

      for (let i = 0; i < 12; i++) {
        const value = dataArray[i * 2] || 0;
        const height = (value / 255) * canvas.height * 1.5;
        ctx.fillStyle = "#10b981"; // emerald-500
        
        const x = xStart + i * totalBarWidth;
        const y = (canvas.height - height) / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, height, 2);
        } else {
          ctx.rect(x, y, barWidth, height);
        }
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={60} height={32} className="opacity-100" />;
};

function MessageCard({
  m,
  isMe,
  time,
  isSending,
  repliedTo,
  onReply,
  onDelete,
  onScrollToReply,
  view,
  isSelected,
  isSelectionMode,
  onToggleSelection,
}: {
  m: any;
  isMe: boolean;
  time: string;
  isSending?: boolean;
  repliedTo?: any;
  onReply: () => void;
  onDelete: () => void;
  onScrollToReply: (id: string) => void;
  view: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelection: () => void;
}) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cycleRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [0.5, 1, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatAudioDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (progress >= 100) {
        audioRef.current.currentTime = 0;
        setProgress(0);
      }
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setProgress(100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isHoldingRef.current = false;
    timerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      if (!isSelectionMode) {
        onToggleSelection();
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 600);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;

      if (!isHoldingRef.current) {
        if (isSelectionMode) {
          onToggleSelection();
        } else if (m.reply_to_id) {
          onScrollToReply(m.reply_to_id);
        }
      }
    }
  };

  const handlePointerLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    // If user is pressing down and slides over this message while selection is active
    if (e.buttons === 1 && isSelectionMode && !isSelected) {
      onToggleSelection();
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  return (
    <motion.div
      id={`msg-${m.id}`}
      className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300 w-full group relative mb-2 items-center gap-3`}
      drag={isSelectionMode ? false : "x"}
      dragConstraints={{ left: -80, right: 0 }}
      dragElastic={0.1}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (info.offset.x < -40 && !isSelectionMode) {
          onReply();
        }
      }}
      onPointerEnter={handlePointerEnter}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {isSelectionMode && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={onToggleSelection}
          className={`size-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isSelected
              ? "bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              : "border-white/20 bg-white/5"
          }`}
        >
          {isSelected && <Check className="size-3.5 text-black" strokeWidth={4} />}
        </motion.div>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{ touchAction: "pan-y" }}
        className={`max-w-[70%] md:max-w-[85%] rounded-[18px] px-3.5 py-2 text-sm shadow-xl border backdrop-blur-xl relative overflow-hidden transition-all active:scale-[0.98] cursor-pointer select-none ${
          isSelected ? "ring-2 ring-emerald-500/50 border-emerald-500/50 bg-emerald-500/10" : ""
        } ${
          isMe
            ? "bg-white/10 text-white rounded-tr-none border-white/20 font-medium"
            : "bg-zinc-900/20 text-zinc-100 rounded-tl-none border-white/10 font-medium"
        }`}
      >
        {/* Visual selection indicator (colored bar on the side) */}
        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

        <div className="flex flex-col gap-0.5 max-w-full">
          {m.type === "call_log" ? (
            <div className="flex items-center gap-2 py-1">
              <div className="size-8 rounded-full bg-white/5 flex items-center justify-center">
                <Phone className="size-4 text-emerald-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider text-white/90">
                  Chamada
                </span>
                <span className="text-[10px] text-white/40">{m.content}</span>
              </div>
            </div>
          ) : m.audio_url ? (
            <div className="flex flex-col gap-1 min-w-[140px] max-w-[220px] py-0.5">
              {repliedTo && (
                <div className="bg-white/5 rounded-lg p-2 border-l-2 border-primary mb-1 text-[11px] opacity-60 truncate">
                  {repliedTo.content || "Voz"}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAudio();
                  }}
                >
                  {isPlaying ? (
                    <Pause className="size-4 fill-white" />
                  ) : (
                    <Play className="size-4 fill-white translate-x-[1px]" />
                  )}
                </Button>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <AudioWaveform
                    isPlaying={isPlaying}
                    progress={progress}
                    playbackRate={playbackRate}
                    color={isMe ? "#10b981" : "#10b981"}
                  />
                  <div className="flex justify-between items-center px-1 mt-1">
                    <span className="text-[8px] font-black opacity-60 uppercase tracking-tighter tabular-nums">
                      {formatAudioDuration(m.audio_duration || 0)}
                    </span>
                    <button
                      onClick={cycleRate}
                      className="text-[9px] font-black bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-md transition-colors border border-white/5"
                    >
                      {playbackRate}x
                    </button>
                  </div>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={m.audio_url}
                onEnded={handleAudioEnded}
                onTimeUpdate={handleTimeUpdate}
                className="hidden"
              />
            </div>
          ) : (
            <>
              {repliedTo && (
                <div className="bg-white/5 rounded-lg p-2 border-l-2 border-primary mb-1 text-[11px] opacity-60 truncate">
                  {repliedTo.content || "Voz"}
                </div>
              )}
              <div className="break-words whitespace-pre-wrap leading-snug">{m.content}</div>
            </>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5 text-[8px] font-black tracking-tight self-end opacity-40">
            <span>{time}</span>
            {isMe && view !== "ai" && (
              <div className="flex ml-0.5">
                {m.is_sending ? (
                  <Check className="size-2.5 text-white/40" strokeWidth={3} />
                ) : m.is_read ? (
                  <CheckCheck className="size-2.5 text-emerald-500" strokeWidth={3} />
                ) : (
                  <CheckCheck className="size-2.5 text-white/20" strokeWidth={2} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatPage() {
  const { user, isPremium, canAccessAI, subscription } = useAuth();
  const navigate = useNavigate();
  const {
    startCall,
    isCalling,
    incomingCall,
    activeCall,
    endCall,
    callDuration,
    remoteAudioRef,
    answerCall,
  } = useCall();
  const aiAgent = !!subscription?.ai_agent_enabled;
  const qc = useQueryClient();

  const [view, setView] = useState<ChatView>("list");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usageLimit, setUsageLimit] = useState<{ count: number; limit: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    nome: string | null;
    avatar_url: string | null;
    email?: string;
  } | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Erro ao acessar microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = null; // Don't set blob
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setAudioBlob(null);
    }
  };

  const sendAudio = async () => {
    if (!user || !audioBlob || !selectedUser) return;
    setSending(true);

    try {
      const fileName = `${user.id}_${Date.now()}.ogg`;
      const { data, error: uploadError } = await supabase.storage
        .from("audio-messages")
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("audio-messages")
        .getPublicUrl(fileName);

      const payload: any = {
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: "[Voz]",
        audio_url: publicUrlData.publicUrl,
        audio_duration: recordingTime,
      };

      if (replyTo?.id) {
        payload.reply_to_id = replyTo.id;
      }

      const { error: insertError } = await supabase.from("direct_messages").insert(payload);
      if (insertError) throw insertError;

      setAudioBlob(null);
      setIsPreviewing(false);
      qc.invalidateQueries({ queryKey: ["dm", user.id, selectedUser.id] });
      qc.invalidateQueries({ queryKey: ["recent_chats"] });
    } catch (err) {
      console.error("Error sending audio:", err);
      toast.error("Erro ao enviar áudio");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const remoteAudioRefLocal = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate(
        [
          { backgroundColor: "transparent" },
          { backgroundColor: "rgba(255, 255, 255, 0.1)" },
          { backgroundColor: "transparent" },
        ],
        { duration: 2000, iterations: 1 },
      );
    }
  };

  // Peer initialization logic moved to CallContext

  // Queries
  const { data: profiles, isLoading: loadingSearch } = useQuery({
    queryKey: ["profiles_search", search],
    enabled: !!user && view === "find-friends",
    queryFn: async () => {
      console.log("Searching profiles with query:", search);

      let query = supabase
        .from("profiles")
        .select("id, nome, avatar_url, email")
        .neq("id", user?.id);

      if (search && search.trim().length > 0) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error("Profiles search error:", error);
        toast.error("Erro ao pesquisar usuários: " + error.message);
      }
      return data ?? [];
    },
  });

  const { data: myFriends } = useQuery({
    queryKey: ["friends_status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friends")
        .select("sender_id, receiver_id, status")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      return data ?? [];
    },
  });

  const { data: friendRequests } = useQuery({
    queryKey: ["friend_requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friends")
        .select(
          `
          id, 
          status,
          sender:profiles!friends_sender_id_fkey(id, nome, avatar_url)
        `,
        )
        .eq("receiver_id", user!.id)
        .eq("status", "pending");
      return (data ?? []) as any[];
    },
  });

  const isFriendOrPending = (friendId: string) => {
    return myFriends?.some(
      (f) =>
        (f.sender_id === user?.id && f.receiver_id === friendId) ||
        (f.receiver_id === user?.id && f.sender_id === friendId),
    );
  };

  const { data: friendsList } = useQuery({
    queryKey: ["friends_list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friends")
        .select(
          `
          id,
          sender_id,
          receiver_id,
          sender:profiles!friends_sender_id_fkey(id, nome, avatar_url, email),
          receiver:profiles!friends_receiver_id_fkey(id, nome, avatar_url, email)
        `,
        )
        .eq("status", "accepted")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);

      return (data ?? [])
        .map((f) => (f.sender_id === user!.id ? f.receiver : f.sender))
        .filter(
          (
            other,
          ): other is {
            id: string;
            nome: string | null;
            avatar_url: string | null;
            email?: string;
          } => !!other,
        );
    },
  });

  const { data: recentChats } = useQuery({
    queryKey: ["recent_chats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("sender_id, receiver_id, content, created_at, is_read")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });

      const participants = new Set<string>();
      const list: {
        sender_id: string;
        receiver_id: string;
        content: string;
        created_at: string;
        is_read: boolean;
        otherId: string;
        profile?: { id: string; nome: string | null; avatar_url: string | null };
      }[] = [];
      const msgs = data ?? [];

      for (const m of msgs) {
        const otherId = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
        if (!participants.has(otherId)) {
          participants.add(otherId);
          list.push({ ...m, otherId });
        }
      }

      if (list.length > 0) {
        const { data: fetchedProfiles } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", Array.from(participants));

        return list.map((l) => ({
          ...l,
          profile: fetchedProfiles?.find((p) => p.id === l.otherId),
        }));
      }
      return [];
    },
  });

  const { data: directMsgs, isLoading: loadingDm } = useQuery({
    queryKey: ["dm", user?.id, selectedUser?.id],
    enabled: !!user && !!selectedUser && view === "dm",
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${selectedUser!.id}),and(sender_id.eq.${selectedUser!.id},receiver_id.eq.${user!.id})`,
        )
        .order("created_at");
      return (data ?? []) as Message[];
    },
  });

  // Mark messages as read when viewing DM
  useEffect(() => {
    if (view === "dm" && selectedUser && user && directMsgs) {
      const unread = directMsgs.filter(
        (m: Message) => m.sender_id === selectedUser.id && !m.is_read,
      );
      if (unread.length > 0) {
        supabase
          .from("direct_messages")
          .update({ is_read: true })
          .eq("sender_id", selectedUser.id)
          .eq("receiver_id", user.id)
          .eq("is_read", false)
          .then(() => {
            qc.invalidateQueries({ queryKey: ["recent_chats"] });
          });
      }
    }
  }, [view, selectedUser, user, directMsgs, qc]);

  const { data: aiMsgs } = useQuery({
    queryKey: ["ai_chat", user?.id],
    enabled: !!user && canAccessAI && view === "ai",
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: usageInfo, refetch: refetchUsage } = useQuery({
    queryKey: ["chat_usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const planKey = subscription?.plan || "free";
      const [{ data: limitData }, { data: usageData }] = await Promise.all([
        supabase.from("plan_limits").select("chat_limit").eq("plan", planKey).single(),
        supabase.from("chat_usage").select("usage_count, last_message_at").eq("user_id", user!.id).maybeSingle()
      ]);

      const limit = limitData?.chat_limit ?? 0;
      let currentUsage = usageData?.usage_count ?? 0;

      if (usageData?.last_message_at) {
        const lastDate = new Date(usageData.last_message_at).toDateString();
        if (lastDate !== new Date().toDateString()) {
          currentUsage = 0;
        }
      }

      return { count: currentUsage, limit, plan: planKey };
    }
  });

  // Realtime subscription for DM and Friends
  useEffect(() => {
    if (!user) return;

    // DM Channel
    const dmChannel = supabase
      .channel("dm_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["dm"] });
        qc.invalidateQueries({ queryKey: ["recent_chats"] });
      })
      .subscribe();

    // Friends Channel
    const friendsChannel = supabase
      .channel("friend_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "friends" }, () => {
        qc.invalidateQueries({ queryKey: ["friend_requests"] });
        qc.invalidateQueries({ queryKey: ["friends_status"] });
        qc.invalidateQueries({ queryKey: ["friends_list"] });
        qc.invalidateQueries({ queryKey: ["recent_chats"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(friendsChannel);
    };
  }, [user, qc]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [aiMsgs?.length, directMsgs?.length, sending, view]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMessageIds.size > 0;

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedMessageIds(new Set());
  };

  const deleteSelectedMessages = async (forAll: boolean) => {
    if (!user || selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);

    setSending(true);
    try {
      if (forAll) {
        // Double check ownership
        const canDeleteForAll = ids.every((id) => {
          const m = (view === "ai" ? aiMsgs : directMsgs)?.find((msg: any) => msg.id === id);
          return m?.sender_id === user.id;
        });

        if (!canDeleteForAll) {
          toast.error("Você só pode remover para todos as suas próprias mensagens");
          return;
        }

        const { error } = await supabase
          .from("direct_messages")
          .update({ is_deleted_for_all: true })
          .in("id", ids)
          .eq("sender_id", user.id);
        if (error) throw error;
      } else {
        // Batch append to deleted_by
        for (const id of ids) {
          await supabase.rpc("append_to_deleted_by", { msg_id: id, user_id: user.id });
        }
      }
      toast.success(ids.length === 1 ? "Mensagem apagada" : `${ids.length} mensagens apagadas`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["dm", user.id, selectedUser?.id] });
    } catch (error) {
      console.error("Erro ao apagar mensagens selecionadas:", error);
      toast.error("Erro ao apagar mensagens");
    } finally {
      setSending(false);
    }
  };

  const canDeleteAllSelectedForAll = () => {
    if (selectedMessageIds.size === 0) return false;
    const ids = Array.from(selectedMessageIds);
    return ids.every((id) => {
      const m = (view === "ai" ? aiMsgs : directMsgs)?.find((msg: any) => msg.id === id);
      return m?.sender_id === user?.id;
    });
  };

  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  useEffect(() => {
    if (!isSelectionMode) setShowDeleteOptions(false);
  }, [isSelectionMode]);

  // Optimized message rendering logic
  const renderMessages = () => {
    const baseMsgs = (view === "ai" ? aiMsgs : directMsgs) || [];
    const currentOptimistic = optimisticMessages.filter((om) =>
      view === "ai" ? om.role === "user" : om.receiver_id === selectedUser?.id,
    );

    // Merge messages without duplicates
    const allMsgs = [...baseMsgs];
    currentOptimistic.forEach((om) => {
      const exists = baseMsgs.some(
        (bm: any) =>
          bm.id === om.id ||
          (bm.content === om.content &&
            bm.sender_id === om.sender_id &&
            Math.abs(new Date(bm.created_at).getTime() - new Date(om.created_at).getTime()) < 5000),
      );
      if (!exists) allMsgs.push(om);
    });

    return allMsgs
      .filter((m: any) => !m.deleted_by_users?.includes(user?.id))
      .map((m: any) => {
        const isMe = m.sender_id === user?.id || m.role === "user";
        const time = new Date(m.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const isSending = m.is_sending;
        const repliedTo = baseMsgs.find((dm: any) => dm.id === m.reply_to_id);

        if (m.is_deleted_for_all) {
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
              <div className="text-[11px] text-white/20 italic bg-white/5 px-3 py-1 rounded-full border border-white/5">
                Esta mensagem foi apagada
              </div>
            </div>
          );
        }

        return (
          <MessageCard
            key={m.id}
            m={m}
            isMe={isMe}
            time={time}
            isSending={isSending}
            repliedTo={repliedTo}
            isSelected={selectedMessageIds.has(m.id)}
            isSelectionMode={isSelectionMode}
            onToggleSelection={() => toggleMessageSelection(m.id)}
            onReply={() => {
              setReplyTo(m);
              if (inputRef.current) inputRef.current.focus();
            }}
            onDelete={deleteMessage}
            onScrollToReply={scrollToMessage}
            view={view}
          />
        );
      });
  };

  // Auto-focus input when replying
  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const send = async () => {
    if (!user || !input.trim()) return;
    const text = input.trim();
    const currentReplyTo = replyTo;

    // Optimistic message
    const tempId = Math.random().toString(36).substring(7);
    const optimisticMsg = {
      id: tempId,
      sender_id: user.id,
      receiver_id: selectedUser?.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      is_sending: true,
      reply_to_id: currentReplyTo?.id,
    };

    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setReplyTo(null);
    setSending(true);

    try {
      if (view === "ai") {
        if (!canAccessAI) return;

        // Check limits for non-admins
        if (!isAdmin) {
          const planKey = subscription?.plan || "free";
          
          const [{ data: limitData }, { data: usageData }] = await Promise.all([
            supabase.from("plan_limits").select("chat_limit").eq("plan", planKey).single(),
            supabase.from("chat_usage").select("usage_count, last_message_at").eq("user_id", user.id).maybeSingle()
          ]);

          const limit = limitData?.chat_limit ?? 0;
          let currentUsage = usageData?.usage_count ?? 0;

          // Daily reset logic for monthly plan (or anyone with a limit)
          if (usageData?.last_message_at) {
            const lastDate = new Date(usageData.last_message_at).toDateString();
            const today = new Date().toDateString();
            if (lastDate !== today) {
              currentUsage = 0;
            }
          }

          if (limit !== -1 && currentUsage >= limit) {
            setUsageLimit({ count: currentUsage, limit });
            setShowLimitModal(true);
            setSending(false);
            setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
            return;
          }
        }

        await supabase
          .from("chat_messages")
          .insert({ user_id: user.id, role: "user", content: text });
        
        const { data, error } = await supabase.functions.invoke("nutrition-chat", {
          body: { message: text, user_id: user.id },
        });

        if (error || (data as { error?: string })?.error)
          throw new Error((data as { error?: string })?.error ?? "Erro");

        // Increment usage
        if (!isAdmin) {
          const { data: usageData } = await supabase
            .from("chat_usage")
            .select("usage_count, last_message_at")
            .eq("user_id", user.id)
            .maybeSingle();

          let currentCount = usageData?.usage_count ?? 0;

          // Check for daily reset
          if (usageData?.last_message_at) {
            const lastDate = new Date(usageData.last_message_at).toDateString();
            const today = new Date().toDateString();
            if (lastDate !== today) {
              currentCount = 0;
            }
          }

          await supabase.from("chat_usage").upsert({ 
            user_id: user.id, 
            usage_count: currentCount + 1,
            last_message_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
          refetchUsage();
        }

        qc.invalidateQueries({ queryKey: ["ai_chat"] });
      } else if (view === "dm" && selectedUser) {
        const payload: any = {
          sender_id: user.id,
          receiver_id: selectedUser.id,
          content: text,
        };

        if (currentReplyTo?.id) {
          payload.reply_to_id = currentReplyTo.id;
        }

        const { error } = await supabase.from("direct_messages").insert(payload);

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        // Trigger queries immediately
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["dm", user.id, selectedUser.id] }),
          qc.invalidateQueries({ queryKey: ["recent_chats"] }),
        ]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(msg);
    } finally {
      setSending(false);
      // Faster cleanup of optimistic message to prevent duplication
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const deleteMessage = async (msgId: string, forAll: boolean) => {
    if (!user) return;
    try {
      if (forAll) {
        await supabase
          .from("direct_messages")
          .update({ is_deleted_for_all: true })
          .eq("id", msgId)
          .eq("sender_id", user.id);
      } else {
        await supabase.rpc("append_to_deleted_by", { msg_id: msgId, user_id: user.id });
      }
      qc.invalidateQueries({ queryKey: ["dm", user.id, selectedUser?.id] });
    } catch (error) {
      console.error("Erro ao apagar:", error);
    }
  };

  const openDm = (u: { id: string; nome: string | null; avatar_url: string | null }) => {
    setSelectedUser(u);
    setView("dm");
    setSearch("");
    setIsProfileModalOpen(false);

    if (user) {
      supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("sender_id", u.id)
        .eq("receiver_id", user.id)
        .eq("is_read", false)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["recent_chats"] });
        });
    }
  };

  const openProfile = (u: any) => {
    setSelectedUser(u);
    setIsProfileModalOpen(true);
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      const { error } = await supabase.from("friends").insert({
        sender_id: user!.id,
        receiver_id: friendId,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Pedido de amizade enviado!");
      qc.invalidateQueries({ queryKey: ["friends_status"] });
    } catch (e) {
      toast.error("Erro ao enviar pedido");
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friends")
        .update({ status: "accepted" })
        .eq("id", requestId);
      if (error) throw error;
      toast.success("Amigo adicionado!");
      qc.invalidateQueries({ queryKey: ["friend_requests"] });
      qc.invalidateQueries({ queryKey: ["friends_status"] });
    } catch (e) {
      toast.error("Erro ao aceitar pedido");
    }
  };

  const inviteFriends = () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({
        title: "Venha treinar comigo!",
        text: "Estou usando este app incrível para nutrição e treinos. Vem conferir!",
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado! Compartilhe com seus amigos.");
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user!.id})`,
        );

      if (error) throw error;

      toast.success("Amigo removido");
      qc.invalidateQueries({ queryKey: ["friends_list"] });
      qc.invalidateQueries({ queryKey: ["friends_status"] });
      setIsProfileModalOpen(false);
    } catch (e) {
      toast.error("Erro ao remover amigo");
    }
  };

  const filteredFriends = friendsList?.filter(
    (f) =>
      !search ||
      f.nome?.toLowerCase().includes(search.toLowerCase()) ||
      f.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="flex flex-col h-full gap-4">
      {view === "list" && (
        <>
          <div className="flex items-center justify-between px-1">
            <h1 className="text-3xl font-display font-black tracking-tight">Social</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full bg-white/5 hover:bg-white/10"
                onClick={inviteFriends}
              >
                <Share2 className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`relative size-11 rounded-full ${view === "requests" ? "bg-primary text-black" : "bg-white/5"}`}
                onClick={() => setView("requests")}
              >
                <UserPlus className="size-5" />
                {friendRequests && friendRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 size-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-black border-2 border-black animate-bounce text-white shadow-lg">
                    {friendRequests.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar Amigos..."
                className="pl-12 h-14 rounded-2xl bg-white/5 border-white/5 focus:ring-2 ring-primary/20"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button
              className="size-14 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black animate-in zoom-in duration-300"
              onClick={() => {
                setView("find-friends");
                setSearch("");
              }}
            >
              <UserPlus className="size-6 transition-transform group-hover:scale-110" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 px-1 custom-scrollbar pb-10">
            {/* Unified Chat List */}
            <div className="space-y-6">
              {search ? (
                <div className="space-y-4">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                    Resultados da Busca
                  </h2>
                  {filteredFriends && filteredFriends.length > 0 ? (
                    filteredFriends.map((p: any) => {
                      const friendData = myFriends?.find(
                        (f) => f.sender_id === p.id || f.receiver_id === p.id,
                      );
                      const isAccepted = friendData?.status === "accepted";

                      return (
                        <Card
                          key={p.id}
                          className="p-4 flex items-center justify-between bg-white/[0.03] backdrop-blur-sm border-white/[0.05] hover:bg-white/[0.08] cursor-pointer transition-all rounded-[32px] group"
                          onClick={() => openDm(p)}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <Avatar className="size-14 aspect-square rounded-2xl shrink-0">
                              <AvatarImage src={p.avatar_url || ""} className="object-cover" />
                              <AvatarFallback className="bg-white/10">
                                {p.nome?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate text-white/90 group-hover:text-primary">
                                {p.nome || "Usuário"}
                              </p>
                              <p className="text-[11px] text-white/40 truncate">
                                {isAccepted ? "Amigo" : "Expandir rede"}
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-white/20">
                      <Search className="size-12 mb-4 opacity-10" />
                      <p className="text-sm font-medium">Nenhum usuário encontrado</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Recentes / Conversas Ativas */}
                  {recentChats && recentChats.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                        Conversas Recentes
                      </h2>
                      {recentChats.map((chat: any) => {
                        const isMe = chat.sender_id === user?.id;
                        const isUnread = !isMe && !chat.is_read;
                        return (
                          <Card
                            key={chat.otherId}
                            className={`p-4 flex items-center gap-4 border-white/[0.05] backdrop-blur-sm cursor-pointer transition-colors rounded-[32px] group ${
                              isUnread
                                ? "bg-white/[0.08] border-white/10 shadow-lg shadow-white/5"
                                : "bg-white/[0.03] hover:bg-white/[0.08]"
                            }`}
                            onClick={() =>
                              openDm({
                                id: chat.otherId,
                                nome: chat.profile?.nome,
                                avatar_url: chat.profile?.avatar_url,
                              })
                            }
                          >
                            <div className="relative">
                              <Avatar className="size-14 aspect-square rounded-2xl shrink-0">
                                <AvatarImage
                                  src={chat.profile?.avatar_url || ""}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-white/10">
                                  {chat.profile?.nome?.[0] || "?"}
                                </AvatarFallback>
                              </Avatar>
                              {isUnread && (
                                <div className="absolute -top-1 -right-1 size-4 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p
                                  className={`text-sm truncate transition-colors ${isUnread ? "font-black text-white" : "font-bold text-white/90 group-hover:text-primary"}`}
                                >
                                  {chat.profile?.nome || "Usuário"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isMe && (
                                  <div className="flex shrink-0">
                                    {chat.is_read ? (
                                      <CheckCheck
                                        className="size-3 text-emerald-500"
                                        strokeWidth={3}
                                      />
                                    ) : (
                                      <CheckCheck
                                        className="size-3 text-white/20"
                                        strokeWidth={2}
                                      />
                                    )}
                                  </div>
                                )}
                                <p
                                  className={`text-[11px] truncate max-w-[200px] ${isUnread ? "text-white font-bold" : "text-white/40 font-medium"}`}
                                >
                                  {chat.content.length > 40
                                    ? chat.content.substring(0, 40) + "..."
                                    : chat.content}
                                </p>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Amigos sem conversa ainda */}
                  {filteredFriends?.filter((f) => !recentChats?.some((c) => c.otherId === f.id))
                    .length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                        Amigos
                      </h2>
                      {filteredFriends
                        ?.filter((f) => !recentChats?.some((c) => c.otherId === f.id))
                        .map((friend: any) => (
                          <Card
                            key={friend.id}
                            className="p-4 flex items-center gap-4 bg-white/[0.03] backdrop-blur-sm border-white/[0.05] hover:bg-white/[0.08] cursor-pointer transition-colors rounded-[28px] group"
                            onClick={() => openDm(friend)}
                          >
                            <Avatar className="size-12 rounded-xl shrink-0">
                              <AvatarImage src={friend.avatar_url || ""} className="object-cover" />
                              <AvatarFallback className="bg-white/10">
                                {friend.nome?.[0] || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                                {friend.nome || "Usuário"}
                              </p>
                              <p className="text-[10px] text-white/30 truncate">
                                Começar nova conversa
                              </p>
                            </div>
                          </Card>
                        ))}
                    </div>
                  )}

                  {/* Empty State */}
                  {!recentChats?.length && !filteredFriends?.length && (
                    <div className="py-20 text-center opacity-40 bg-zinc-900/50 rounded-[40px] border border-dashed border-white/10">
                      <MessagesSquare className="size-16 mx-auto mb-4 text-white/20" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        Sua lista está vazia
                      </p>
                      <Button
                        variant="link"
                        className="mt-2 text-primary text-[11px]"
                        onClick={() => setView("find-friends")}
                      >
                        LOCALIZAR NOVOS USUÁRIOS
                      </Button>
                    </div>
                  )}

                  {/* AI Meet-ups Always Last */}
                  <div className="space-y-3">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                      Assistente
                    </h2>
                    <Card
                      className={`p-4 flex items-center gap-4 border-white/[0.05] backdrop-blur-sm cursor-pointer transition-all rounded-[32px] group ${
                        view === "ai"
                          ? "bg-primary/20 border-primary/30"
                          : "bg-white/[0.03] hover:bg-white/[0.08]"
                      }`}
                      onClick={() => {
                        if (canAccessAI) setView("ai");
                        else navigate({ to: "/premium" });
                      }}
                    >
                      <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Sparkles className="size-7 text-white fill-white/20" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-white">MEET-UP AI</p>
                          <Badge
                            variant="secondary"
                            className="text-[8px] bg-primary/20 text-primary border-none"
                          >
                            PREMIUM
                          </Badge>
                        </div>
                        <p className="text-[11px] text-white/40">Assistente pessoal de network</p>
                      </div>
                      <ChevronRight className="size-5 text-white/20 group-hover:text-primary transition-colors" />
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {view === "find-friends" && (
        <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4 px-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/5"
              onClick={() => {
                setView("list");
                setSearch("");
              }}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-3xl font-display font-black tracking-tight">Novos Amigos</h1>
          </div>

          <div className="relative group px-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-white/30 group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou e-mail..."
              className="pl-12 h-14 rounded-2xl bg-white/5 border-white/5 focus:ring-2 ring-primary/20"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-1 custom-scrollbar pb-10">
            {/* Invite Section */}
            {!search && (
              <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-dashed border-primary/20 rounded-[32px] text-center space-y-4 mb-6">
                <div className="size-16 rounded-full bg-primary/20 mx-auto flex items-center justify-center">
                  <Share2 className="size-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight">Convidar Amigos</h3>
                  <p className="text-xs text-white/40 px-6">
                    Compartilhe o FitTrack AI e treine junto com seus amigos!
                  </p>
                </div>
                <Button
                  onClick={inviteFriends}
                  className="w-full h-12 rounded-2xl bg-primary text-black font-black uppercase tracking-wider text-[11px]"
                >
                  Compartilhar Link
                </Button>
              </Card>
            )}

            {loadingSearch
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 w-full rounded-3xl bg-white/5 animate-pulse" />
                ))
              : profiles?.map((p) => {
                  const friendData = myFriends?.find(
                    (f) => f.sender_id === p.id || f.receiver_id === p.id,
                  );
                  const isAccepted = friendData?.status === "accepted";
                  const isPending = friendData?.status === "pending";

                  return (
                    <Card
                      key={p.id}
                      className="p-3 flex items-center gap-4 bg-white/5 border-white/5 hover:bg-white/10 cursor-pointer transition-all rounded-3xl group"
                      onClick={() => openProfile(p)}
                    >
                      <Avatar className="size-14 aspect-square rounded-2xl border border-white/5 shadow-2xl group-hover:scale-105 transition-transform shrink-0">
                        <AvatarImage src={p.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="bg-white/10">
                          {p.nome?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate">{p.nome || "Usuário"}</p>
                        <p className="text-[10px] text-white/30 truncate">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAccepted ? (
                          <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <Check className="size-4 text-green-500" />
                          </div>
                        ) : isPending ? (
                          <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center">
                            <Clock className="size-4 text-white/20" />
                          </div>
                        ) : (
                          <Button
                            variant="default"
                            size="icon"
                            className="size-10 rounded-xl bg-primary hover:bg-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendFriendRequest(p.id);
                            }}
                          >
                            <PlusCircle className="size-4 text-black" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}

            {!loadingSearch && (!profiles || profiles.length === 0) && (
              <div className="py-20 text-center opacity-40">
                <Search className="size-12 mx-auto mb-4 text-white/20" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">Ninguém encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "requests" && (
        <div className="flex-1 overflow-y-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/5"
              onClick={() => setView("list")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-3xl font-display font-black tracking-tight">Convites</h1>
          </div>

          <div className="grid gap-3">
            {friendRequests?.map((r: any) => (
              <Card
                key={r.id}
                className="p-5 flex items-center gap-4 bg-white/5 border-white/10 hover:bg-white/10 transition-all rounded-[32px] group"
              >
                <Avatar className="size-16 aspect-square rounded-2xl border-2 border-white/5 shadow-2xl shrink-0">
                  <AvatarImage src={r.sender?.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-xl font-bold">
                    {r.sender?.nome?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-lg font-black tracking-tight leading-none mb-1">
                    {r.sender?.nome || "Anônimo"}
                  </p>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">
                    Deseja ser seu amigo
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-10 rounded-xl bg-white text-black hover:bg-zinc-200 font-black text-[11px] uppercase tracking-wider"
                      onClick={() => acceptFriendRequest(r.id)}
                    >
                      Aceitar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 rounded-xl bg-white/5 hover:bg-white/10"
                      onClick={async () => {
                        await supabase.from("friends").delete().eq("id", r.id);
                        qc.invalidateQueries({ queryKey: ["friend_requests"] });
                        toast.success("Convite removido");
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {!friendRequests?.length && (
            <div className="py-32 text-center space-y-4">
              <div className="size-20 rounded-full bg-white/5 mx-auto flex items-center justify-center opacity-20">
                <UserPlus className="size-10" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/20">
                Caixa de entrada vazia
              </p>
              <Button
                variant="ghost"
                className="text-[10px] font-black uppercase text-primary"
                onClick={() => setView("list")}
              >
                Explorar usuários
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Profile Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-[40px] p-0 overflow-hidden sm:max-w-[400px]">
          <DialogTitle className="sr-only">Perfil de {selectedUser?.nome}</DialogTitle>
          <div className="relative aspect-square w-full">
            <Avatar className="size-full rounded-none">
              <AvatarImage src={selectedUser?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="bg-zinc-900 text-6xl font-display font-black">
                {selectedUser?.nome?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-6 right-6 size-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white"
            >
              <X className="size-5" />
            </button>

            <div className="absolute bottom-8 left-8 right-8 space-y-1">
              <h2 className="text-3xl font-display font-black tracking-tight text-white">
                {selectedUser?.nome || "Usuário"}
              </h2>
              <p className="text-xs font-black uppercase tracking-widest text-white/40">
                {selectedUser?.email}
              </p>
            </div>
          </div>

          <div className="p-8 pt-0 space-y-6">
            <div className="grid grid-cols-2 gap-4 py-8">
              <div className="bg-white/5 rounded-3xl p-4 text-center border border-white/5">
                <p className="text-[10px] font-black uppercase text-white/30 mb-1">Status</p>
                <p className="text-xs font-bold text-white/70">Online</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-4 text-center border border-white/5">
                <p className="text-[10px] font-black uppercase text-white/30 mb-1">Social</p>
                <p className="text-xs font-bold text-white/70">Ativo</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {friendsList?.some((f) => f.id === selectedUser?.id) ? (
                <>
                  <Button
                    className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-[11px]"
                    onClick={() => openDm(selectedUser!)}
                  >
                    Enviar Mensagem
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none"
                    onClick={() => removeFriend(selectedUser!.id)}
                  >
                    <UserMinus className="size-4 mr-2" />
                    Remover Amigo
                  </Button>
                </>
              ) : isFriendOrPending(selectedUser?.id || "") ? (
                <Button
                  disabled
                  className="w-full h-14 rounded-2xl bg-white/5 text-white/20 font-black uppercase tracking-widest text-[11px]"
                >
                  Pedido Pendente
                </Button>
              ) : (
                <Button
                  className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-[11px] hover:bg-primary/90"
                  onClick={() => sendFriendRequest(selectedUser!.id)}
                >
                  <UserPlus className="size-4 mr-2" />
                  Adicionar Amigo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(view === "dm" || view === "ai") && (
        <div className="flex flex-col h-full fixed inset-0 z-50 bg-black pt-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4 mb-4 px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("list")}
              className="rounded-full bg-white/5 h-10 w-10"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3">
              {view === "ai" ? (
                <>
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
                    <Crown className="size-5 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-tight">
                      IA Nutricionista
                    </h2>
                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">
                      Ativa Agora
                    </p>
                  </div>
                  {usageInfo && usageInfo.limit !== -1 && (
                    <div className="ml-auto flex flex-col items-end">
                      <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex flex-col items-center">
                        <span className="text-[8px] font-black tracking-widest text-white/30 uppercase leading-none mb-0.5">Uso Diário</span>
                        <span className="text-[10px] font-bold text-white leading-none">
                          {usageInfo.count} / {usageInfo.limit}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Avatar
                    className="size-11 aspect-square rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all shrink-0"
                    onClick={() => selectedUser && openProfile(selectedUser)}
                  >
                    <AvatarImage src={selectedUser?.avatar_url || ""} className="object-cover" />
                    <AvatarFallback className="bg-zinc-800">
                      {selectedUser?.nome?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => selectedUser && openProfile(selectedUser)}
                  >
                    <h2 className="text-sm font-black tracking-tight truncate hover:text-primary transition-colors cursor-pointer">
                      {selectedUser?.nome || "Usuário"}
                    </h2>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-tighter">
                      Social Match
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5"
                      onClick={() => startCall(selectedUser!.id)}
                    >
                      <Phone className="size-5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-6 mb-2 custom-scrollbar flex flex-col pt-4 overscroll-behavior-contain">
            {view === "ai" && !canAccessAI ? (
              <div className="my-auto">
                <Card className="p-8 text-center space-y-6 bg-gradient-to-br from-primary/20 to-transparent border-primary/20 rounded-[40px]">
                  <div className="size-20 rounded-[32px] bg-white mx-auto flex items-center justify-center shadow-2xl shadow-white/20">
                    <Lock className="size-10 text-black" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display font-black">Recurso Premium</h2>
                    <p className="text-sm text-white/50 px-4">
                      Tire dúvidas em tempo real com nosso especialista nutricional via IA.
                    </p>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-2">
                      Exclusivo para planos Mensal e Anual
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-wider"
                  >
                    <Link to="/premium">
                      <Crown className="size-5 mr-2" /> Assinar Premium
                    </Link>
                  </Button>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4 opacity-20">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] border border-white/10 inline-block px-4 py-1 rounded-full text-white">
                    Início da Conversa
                  </p>
                </div>
                {renderMessages()}
                {sending && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl px-5 py-3">
                      <div className="flex gap-1.5 items-center">
                        <div className="size-1.5 bg-white/30 rounded-full animate-bounce" />
                        <div className="size-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="size-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-900/50 backdrop-blur-2xl border-t border-white/5 mb-safe pb-4 relative">
            {isSelectionMode ? (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="flex items-center justify-center absolute inset-x-0 -top-20 px-4 pointer-events-none"
              >
                <div className="bg-zinc-900/95 backdrop-blur-3xl border border-white/10 h-16 rounded-full shadow-2xl flex items-center px-2 gap-1 pointer-events-auto ring-1 ring-white/5 max-w-full overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearSelection}
                    className="size-12 rounded-full hover:bg-white/5"
                  >
                    <X className="size-5" />
                  </Button>

                  <div className="px-4 h-10 flex items-center bg-white/5 rounded-full border border-white/5">
                    <p className="text-sm font-black text-white whitespace-nowrap">
                      {selectedMessageIds.size}
                    </p>
                  </div>

                  {!showDeleteOptions ? (
                    <>
                      {selectedMessageIds.size === 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-12 rounded-full hover:bg-white/5 text-primary"
                          onClick={() => {
                            const id = Array.from(selectedMessageIds)[0];
                            const m = (view === "ai" ? aiMsgs : directMsgs)?.find(
                              (msg: any) => msg.id === id,
                            );
                            if (m) {
                              setReplyTo(m);
                              clearSelection();
                            }
                          }}
                        >
                          <Undo2 className="size-5" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-12 rounded-full hover:bg-rose-500/10 text-rose-500"
                        onClick={() => setShowDeleteOptions(true)}
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 overflow-x-auto pr-2"
                    >
                      <Button
                        size="sm"
                        className="bg-white/5 hover:bg-white/10 text-white rounded-full px-4 h-10 font-bold text-[10px] uppercase tracking-wider"
                        onClick={() => deleteSelectedMessages(false)}
                      >
                        Só para mim
                      </Button>
                      {canDeleteAllSelectedForAll() && (
                        <Button
                          size="sm"
                          className="bg-rose-500 text-white hover:bg-rose-600 rounded-full px-4 h-10 font-black text-[10px] uppercase tracking-wider shadow-lg shadow-rose-500/20"
                          onClick={() => deleteSelectedMessages(true)}
                        >
                          Para todos
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full"
                        onClick={() => setShowDeleteOptions(false)}
                      >
                        <ArrowLeft className="size-4 opacity-40" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              replyTo && (
                <div className="flex items-center justify-between bg-zinc-800/80 backdrop-blur-md p-3 rounded-t-2xl border-x border-t border-white/10 mb-[-1px] animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3">
                    <Undo2 className="size-4 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase">Respondendo</p>
                      <p className="text-xs text-white/60 truncate max-w-[200px]">
                        {replyTo.content}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-white/40"
                    onClick={() => setReplyTo(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )
            )}
            <div className="flex gap-2 max-w-4xl mx-auto items-center">
              {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-zinc-900 rounded-2xl h-14 px-4 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black mono tabular-nums opacity-60">
                      {formatTime(recordingTime)}
                    </span>
                    <AudioVisualizer stream={mediaRecorderRef.current?.stream || null} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 rounded-full text-white/40 hover:text-white"
                      onClick={cancelRecording}
                    >
                      <Trash className="size-5" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary text-black rounded-xl px-4 h-10 font-bold text-[10px] uppercase tracking-wider"
                      onClick={stopRecording}
                    >
                      Parar
                    </Button>
                  </div>
                </div>
              ) : audioBlob ? (
                <div className="flex-1 flex items-center justify-between bg-zinc-900 rounded-2xl h-14 px-4 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 rounded-full bg-white/5 border border-white/5"
                      onClick={() => {
                        if (isPreviewing) {
                          previewAudioRef.current?.pause();
                          setIsPreviewing(false);
                        } else {
                          const url = URL.createObjectURL(audioBlob);
                          const audio = new Audio(url);
                          previewAudioRef.current = audio;
                          audio.play();
                          setIsPreviewing(true);
                          audio.onended = () => setIsPreviewing(false);
                        }
                      }}
                    >
                      {isPreviewing ? <Pause className="size-5" /> : <Play className="size-5" />}
                    </Button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      Áudio Pronto
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 rounded-full text-white/40 hover:text-white"
                      onClick={() => setAudioBlob(null)}
                    >
                      <X className="size-5" />
                    </Button>
                    <Button
                      size="icon"
                      className="size-10 rounded-full bg-emerald-500 text-black hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                      onClick={sendAudio}
                      disabled={sending}
                    >
                      <SendIcon className="size-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escreva algo..."
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    className="bg-white/5 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-sm h-14 rounded-2xl flex-1 px-6 shadow-inner"
                  />
                  {input.trim() ? (
                    <Button
                      onClick={send}
                      disabled={sending || (view === "ai" && !aiAgent)}
                      className="size-14 rounded-2xl bg-white text-black hover:bg-zinc-200 shadow-xl transition-all active:scale-95 disabled:opacity-20"
                    >
                      <SendIcon className="size-6" />
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      disabled={sending || (view === "ai" && !aiAgent)}
                      className="size-14 rounded-2xl bg-white/5 text-white hover:bg-white/10 border border-white/10 shadow-xl transition-all active:scale-95"
                    >
                      <Mic className="size-6" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10 p-0 overflow-hidden rounded-[32px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Limite de Chat Atingido</DialogTitle>
          </DialogHeader>
          <div className="relative p-8 flex flex-col items-center text-center">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative z-10 size-20 rounded-[24px] bg-white text-black flex items-center justify-center mb-6 shadow-2xl"
            >
              <Lock className="size-10" />
            </motion.div>

            <h2 className="text-2xl font-display font-black tracking-tight text-white mb-2 uppercase">
              Limite Atingido
            </h2>
            <p className="text-white/60 text-sm font-medium mb-8">
              Você atingiu o limite de {usageLimit?.limit} interações mensais do seu plano. 
              {subscription?.plan === "monthly" ? " Faça o upgrade para o plano Anual e tenha acesso ilimitado!" : " Assine o Premium para continuar conversando."}
            </p>

            <div className="w-full space-y-3 mb-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-left">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center">
                    <Sparkles className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Seu Plano</p>
                    <p className="text-sm font-bold text-white uppercase">{subscription?.plan || "Gratuito"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Uso</p>
                  <p className="text-sm font-bold text-white">{usageLimit?.count} / {usageLimit?.limit}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full gap-3">
              <Button
                onClick={() => {
                  setShowLimitModal(false);
                  navigate({ to: "/premium" });
                }}
                className="w-full h-14 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-sm shadow-xl transition-all group"
              >
                Ver Planos Ilimitados
                <Crown className="ml-2 size-4 text-black group-hover:scale-110 transition-transform" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLimitModal(false)}
                className="w-full h-12 text-white/40 hover:text-white hover:bg-white/5 font-bold text-xs"
              >
                Entendi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
