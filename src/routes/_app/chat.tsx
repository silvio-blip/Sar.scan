import { createFileRoute, Link } from "@tanstack/react-router";
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
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import Peer, { MediaConnection } from "peerjs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type ChatView = "list" | "dm" | "ai" | "find-friends" | "requests";
type Message = {
  id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  created_at: string;
  role?: string; // for AI
};

function ChatPage() {
  const { user, isPremium, subscription } = useAuth();
  const aiAgent = !!subscription?.ai_agent_enabled;
  const qc = useQueryClient();

  const [view, setView] = useState<ChatView>("list");
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

  // PeerJS State
  const [peer, setPeer] = useState<Peer | null>(null);
  const [call, setCall] = useState<MediaConnection | null>(null);
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize Peer
  useEffect(() => {
    if (!user) return;
    const newPeer = new Peer(user.id);
    setPeer(newPeer);

    newPeer.on("call", (incoming) => {
      setIncomingCall(incoming);
    });

    return () => {
      newPeer.destroy();
    };
  }, [user]);

  // Handle Audio Stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const startCall = async (targetId: string) => {
    if (!peer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);
      setIsCalling(true);

      const outgoingCall = peer.call(targetId, stream);
      setCall(outgoingCall);

      outgoingCall.on("stream", (remote) => {
        setRemoteStream(remote);
      });

      outgoingCall.on("close", () => endCall());
      outgoingCall.on("error", () => endCall());
    } catch (err) {
      toast.error("Erro ao acessar microfone");
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);
      setIsCalling(true);
      setIncomingCall(null);
      setCall(incomingCall);

      incomingCall.answer(stream);
      incomingCall.on("stream", (remote) => {
        setRemoteStream(remote);
      });
      incomingCall.on("close", () => endCall());
    } catch (err) {
      toast.error("Erro ao atender chamada");
    }
  };

  const endCall = () => {
    call?.close();
    localStream?.getTracks().forEach((t) => t.stop());
    setCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsCalling(false);
  };

  // Queries
  const { data: profiles, isLoading: loadingSearch } = useQuery({
    queryKey: ["profiles_search", search],
    enabled: !!user,
    queryFn: async () => {
      console.log("Searching profiles with query:", search);
      
      let query = supabase
        .from("profiles")
        .select("id, nome, avatar_url, email")
        .neq("id", user?.id);

      if (search && search.trim().length > 0) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
      } else {
        // Show any public users by default
        query = query.order('created_at', { ascending: false });
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
        .select(`
          id, 
          status,
          sender:profiles!friends_sender_id_fkey(id, nome, avatar_url)
        `)
        .eq("receiver_id", user!.id)
        .eq("status", "pending");
      return (data ?? []) as any[];
    },
  });

  const isFriendOrPending = (friendId: string) => {
    return myFriends?.some(
      (f) =>
        (f.sender_id === user?.id && f.receiver_id === friendId) ||
        (f.receiver_id === user?.id && f.sender_id === friendId)
    );
  };

  const { data: friendsList } = useQuery({
    queryKey: ["friends_list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("friends")
        .select(`
          id,
          sender_id,
          receiver_id,
          sender:profiles!friends_sender_id_fkey(id, nome, avatar_url, email),
          receiver:profiles!friends_receiver_id_fkey(id, nome, avatar_url, email)
        `)
        .eq("status", "accepted")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      
      return (data ?? [])
        .map(f => (f.sender_id === user!.id ? f.receiver : f.sender))
        .filter((other): other is { id: string; nome: string | null; avatar_url: string | null; email?: string } => !!other);
    },
  });

  const { data: recentChats } = useQuery({
    queryKey: ["recent_chats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("sender_id, receiver_id, content, created_at")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });

      const participants = new Set<string>();
      const list: {
        sender_id: string;
        receiver_id: string;
        content: string;
        created_at: string;
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

  const { data: aiMsgs } = useQuery({
    queryKey: ["ai_chat", user?.id],
    enabled: !!user && isPremium && view === "ai",
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      return data ?? [];
    },
  });

  // Realtime subscription for DM and Friends
  useEffect(() => {
    if (!user) return;
    
    // DM Channel
    const dmChannel = supabase
      .channel("dm_updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["dm"] });
          qc.invalidateQueries({ queryKey: ["recent_chats"] });
        },
      )
      .subscribe();

    // Friends Channel
    const friendsChannel = supabase
      .channel("friend_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends" },
        () => {
          qc.invalidateQueries({ queryKey: ["friend_requests"] });
          qc.invalidateQueries({ queryKey: ["friends_status"] });
          qc.invalidateQueries({ queryKey: ["friends_list"] });
          qc.invalidateQueries({ queryKey: ["recent_chats"] });
        },
      )
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

  const send = async () => {
    if (!user || !input.trim()) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    try {
      if (view === "ai") {
        if (!isPremium || !aiAgent) return;
        await supabase
          .from("chat_messages")
          .insert({ user_id: user.id, role: "user", content: text });
        const { data, error } = await supabase.functions.invoke("nutrition-chat", {
          body: { message: text, user_id: user.id },
        });
        if (error || (data as { error?: string })?.error)
          throw new Error((data as { error?: string })?.error ?? "Erro");
        qc.invalidateQueries({ queryKey: ["ai_chat"] });
      } else if (view === "dm" && selectedUser) {
        const isAccepted = friendsList?.some(f => f.id === selectedUser.id);
        if (!isAccepted) {
          toast.error("Você só pode enviar mensagens para amigos aceitos.");
          return;
        }

        await supabase.from("direct_messages").insert({
          sender_id: user.id,
          receiver_id: selectedUser.id,
          content: text,
        });
        qc.invalidateQueries({ queryKey: ["dm", user.id, selectedUser.id] });
        qc.invalidateQueries({ queryKey: ["recent_chats"] });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const openDm = (u: { id: string; nome: string | null; avatar_url: string | null }) => {
    setSelectedUser(u);
    setView("dm");
    setSearch("");
    setIsProfileModalOpen(false);
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
      const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", requestId);
      if (error) throw error;
      toast.success("Amigo adicionado!");
      qc.invalidateQueries({ queryKey: ["friend_requests"] });
      qc.invalidateQueries({ queryKey: ["friends_status"] });
    } catch (e) {
      toast.error("Erro ao aceitar pedido");
    }
  };

  if (isCalling) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-500">
        <div className="absolute top-8 right-8 z-10">
          <Button variant="ghost" size="icon" onClick={endCall} className="size-12 rounded-full bg-white/10 hover:bg-white/20">
            <X className="size-6" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <Avatar className="size-40 rounded-[40px] border-4 border-white/10 shadow-2xl animate-pulse">
              <AvatarImage src={selectedUser?.avatar_url || ""} />
              <AvatarFallback className="bg-zinc-900 text-6xl">
                {selectedUser?.nome?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -left-2 size-12 rounded-2xl bg-primary flex items-center justify-center animate-bounce">
              <Phone className="size-6 text-black" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-display font-black tracking-tight">{selectedUser?.nome || "Em chamada..."}</h2>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/30 animate-pulse">
              {remoteStream ? "Em conexão segura" : "Chamando..."}
            </p>
          </div>
          
          <audio ref={remoteAudioRef} autoPlay />

          <div className="mt-12">
            <Button
              size="lg"
              variant="destructive"
              onClick={endCall}
              className="size-20 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.3)] hover:scale-110 active:scale-95 transition-all"
            >
              <PhoneOff className="size-10" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white">
        <div className="size-24 rounded-full bg-primary flex items-center justify-center animate-bounce mb-6">
          <Phone className="size-10" />
        </div>
        <h2 className="text-2xl font-display font-black mb-2">Chamada Recebida</h2>
        <p className="text-white/60 mb-12">Alguém deseja falar com você</p>
        
        <div className="flex gap-6">
          <Button variant="destructive" size="lg" onClick={() => setIncomingCall(null)} className="h-16 px-8 rounded-2xl">
            Recusar
          </Button>
          <Button variant="default" size="lg" onClick={answerCall} className="h-16 px-8 rounded-2xl bg-green-500 hover:bg-green-600">
            Atender
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {view === "list" && (
        <>
          <div className="flex items-center justify-between px-1">
            <h1 className="text-3xl font-display font-black tracking-tight">Social</h1>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`relative rounded-full ${view === "requests" ? "bg-primary text-black" : "bg-white/5"}`} 
                onClick={() => setView(view === "requests" ? "list" : "requests")}
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

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/30 group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar usuários..."
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

          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">
              {search ? "Pessoas Encontradas" : "Descobrir Pessoas"}
            </h2>
            <div className="grid gap-2">
              {loadingSearch ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 w-full rounded-3xl bg-white/5 animate-pulse" />
                ))
              ) : (
                profiles?.map((p) => {
                  const friendData = myFriends?.find(f => f.sender_id === p.id || f.receiver_id === p.id);
                  const isAccepted = friendData?.status === 'accepted';
                  const isPending = friendData?.status === 'pending';

                  return (
                    <Card
                      key={p.id}
                      className="p-3 flex items-center gap-4 bg-white/5 border-white/5 hover:bg-white/10 cursor-pointer transition-all rounded-3xl group"
                      onClick={() => openProfile(p)}
                    >
                      <Avatar className="size-14 rounded-2xl border border-white/5 shadow-2xl group-hover:scale-105 transition-transform">
                        <AvatarImage src={p.avatar_url || ""} />
                        <AvatarFallback className="bg-white/10">{p.nome?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-black">{p.nome || "Usuário"}</p>
                        <p className="text-[10px] text-white/30 truncate max-w-[150px]">{p.email}</p>
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
                            <UserPlus className="size-4 text-black" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
            {!loadingSearch && !profiles?.length && (
              <div className="py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/20">Ninguém encontrado</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 px-1 custom-scrollbar pb-10">
            {/* AI Assistant Entry */}
            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Assistente</h2>
              <Card
                className="p-4 flex items-center gap-4 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-primary/20 hover:from-primary/30 cursor-pointer transition-all rounded-[32px] group"
                onClick={() => setView("ai")}
              >
                <div className="size-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                  <Crown className="size-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-tight">IA Nutricionista</p>
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-[8px] font-black text-primary uppercase">Expert</span>
                  </div>
                  <p className="text-[11px] text-white/60 line-clamp-1">Seu especialista pessoal 24/7</p>
                </div>
              </Card>
            </div>

            {/* Friends List - Always show if accepted */}
            {friendsList && friendsList.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40">Meus Amigos</h2>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{friendsList.length}</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 px-1 no-scrollbar">
              {friendsList.map((friend) => (
                <div 
                  key={friend.id} 
                  className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                  onClick={() => openDm(friend)}
                >
                  <div className="relative">
                    <Avatar className="size-16 rounded-2xl border-2 border-white/5 group-hover:border-primary/50 transition-all shadow-xl">
                      <AvatarImage src={friend.avatar_url || ""} />
                      <AvatarFallback className="bg-white/5 font-bold">{friend.nome?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 size-4 bg-green-500 rounded-full border-2 border-black shadow-lg" />
                  </div>
                  <p className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors truncate w-16 text-center">
                    {friend.nome?.split(' ')[0]}
                  </p>
                </div>
              ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Conversas Recentes</h2>
              
              {recentChats?.map((chat: any) => (
                <Card
                  key={chat.otherId}
                  className="p-4 flex items-center gap-4 bg-white/5 border-white/5 hover:bg-white/10 cursor-pointer transition-colors rounded-[32px]"
                  onClick={() => openDm({ id: chat.otherId, nome: chat.profile?.nome, avatar_url: chat.profile?.avatar_url })}
                >
                  <Avatar className="size-14 rounded-2xl">
                    <AvatarImage src={chat.profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-white/10">{chat.profile?.nome?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{chat.profile?.nome || "Usuário"}</p>
                    <p className="text-[11px] text-white/40 truncate">{chat.content}</p>
                  </div>
                  <p className="text-[9px] text-white/20 font-black uppercase">
                    {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Card>
              ))}

              {!recentChats?.length && !search && (!friendsList || friendsList.length === 0) && (
                <div className="py-20 text-center opacity-20">
                  <MessagesSquare className="size-12 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.2em]">Comece sua jornada social</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {view === "requests" && (
        <div className="flex-1 overflow-y-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
           <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" className="rounded-full bg-white/5" onClick={() => setView("list")}>
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
                <Avatar className="size-16 rounded-2xl border-2 border-white/5 shadow-2xl">
                  <AvatarImage src={r.sender?.avatar_url || ""} />
                  <AvatarFallback className="bg-white/10 text-xl">{r.sender?.nome?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-lg font-black tracking-tight leading-none mb-1">{r.sender?.nome || "Anônimo"}</p>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Deseja ser seu amigo</p>
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
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/20">Caixa de entrada vazia</p>
              <Button variant="ghost" className="text-[10px] font-black uppercase text-primary" onClick={() => setView("list")}>
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
              <h2 className="text-3xl font-display font-black tracking-tight text-white">{selectedUser?.nome || "Usuário"}</h2>
              <p className="text-xs font-black uppercase tracking-widest text-white/40">{selectedUser?.email}</p>
            </div>
          </div>

          <div className="p-8 pt-0 space-y-4">
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
              {myFriends?.find(f => f.sender_id === selectedUser?.id || f.receiver_id === selectedUser?.id)?.status === 'accepted' ? (
                <Button 
                  onClick={() => openDm(selectedUser!)}
                  className="h-16 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-wider"
                >
                  <MessagesSquare className="size-5 mr-3" /> Abrir Conversa
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    if (selectedUser) sendFriendRequest(selectedUser.id);
                  }}
                  disabled={!!myFriends?.find(f => f.sender_id === selectedUser?.id || f.receiver_id === selectedUser?.id)}
                  className="h-16 rounded-2xl bg-primary text-black hover:opacity-90 font-black uppercase tracking-wider"
                >
                  <UserPlus className="size-5 mr-3" /> 
                  {myFriends?.find(f => f.sender_id === selectedUser?.id || f.receiver_id === selectedUser?.id) ? "Pedido Pendente" : "Adicionar Amigo"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(view === "dm" || view === "ai") && (
        <div className="flex flex-col h-full fixed inset-0 z-50 bg-black pt-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4 mb-4 px-6">
            <Button variant="ghost" size="icon" onClick={() => setView("list")} className="rounded-full bg-white/5 h-10 w-10">
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3">
              {view === "ai" ? (
                <>
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
                    <Crown className="size-5 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-tight">IA Nutricionista</h2>
                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Ativa Agora</p>
                  </div>
                </>
              ) : (
                <>
                  <Avatar className="size-11 rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all" onClick={() => selectedUser && openProfile(selectedUser)}>
                    <AvatarImage src={selectedUser?.avatar_url || ""} />
                    <AvatarFallback className="bg-zinc-800">{selectedUser?.nome?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0" onClick={() => selectedUser && openProfile(selectedUser)}>
                    <h2 className="text-sm font-black tracking-tight truncate hover:text-primary transition-colors cursor-pointer">{selectedUser?.nome || "Usuário"}</h2>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-tighter">Social Match</p>
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
            {view === "ai" && !isPremium ? (
              <div className="my-auto">
                 <Card className="p-8 text-center space-y-6 bg-gradient-to-br from-primary/20 to-transparent border-primary/20 rounded-[40px]">
                  <div className="size-20 rounded-[32px] bg-white mx-auto flex items-center justify-center shadow-2xl shadow-white/20">
                    <Lock className="size-10 text-black" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display font-black">Recurso Premium</h2>
                    <p className="text-sm text-white/50 px-4">Tire dúvidas em tempo real com nosso especialista nutricional via IA.</p>
                  </div>
                  <Button asChild className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-wider">
                    <Link to="/premium">
                      <Crown className="size-5 mr-2" /> Assinar Premium
                    </Link>
                  </Button>
                </Card>
              </div>
            ) : view === "ai" && !aiAgent ? (
              <div className="my-auto">
                 <Card className="p-8 text-center space-y-6 bg-white/5 border-white/10 rounded-[40px]">
                  <div className="size-16 rounded-[24px] bg-white/10 mx-auto flex items-center justify-center">
                    <Lock className="size-8 text-white/30" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-black">Upgrade Necessário</h2>
                    <p className="text-sm text-white/40">O Agente IA está disponível apenas nos planos Mensal e Anual.</p>
                  </div>
                  <Button asChild className="w-full h-14 rounded-2xl bg-primary text-black hover:opacity-90 font-black uppercase tracking-wider">
                    <Link to="/premium">
                      <Crown className="size-5 mr-2" /> Fazer Upgrade
                    </Link>
                  </Button>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4 opacity-20">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] border border-white/10 inline-block px-4 py-1 rounded-full text-white">Início da Conversa</p>
                </div>
                {(view === "ai" ? aiMsgs : directMsgs)?.map((m: any) => {
                  const isMe = m.sender_id === user?.id || m.role === "user";
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[80%] rounded-[24px] px-5 py-3.5 text-sm shadow-xl border leading-relaxed ${
                        isMe
                          ? "bg-white text-black rounded-tr-none border-white/20 font-bold" 
                          : "bg-zinc-900 text-zinc-100 rounded-tl-none border-white/10 font-medium"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
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

          <div className="p-4 bg-zinc-900/50 backdrop-blur-2xl border-t border-white/5 mb-safe pb-4">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva algo..."
                onKeyDown={(e) => e.key === "Enter" && send()}
                className="bg-white/5 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-sm h-14 rounded-2xl flex-1 px-6 shadow-inner"
              />
              <Button 
                onClick={send} 
                disabled={sending || (view === "ai" && !aiAgent) || !input.trim()} 
                className="size-14 rounded-2xl bg-white text-black hover:bg-zinc-200 shadow-xl transition-all active:scale-95 disabled:opacity-20"
              >
                <Send className="size-6" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
