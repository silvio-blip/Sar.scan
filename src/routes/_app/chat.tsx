import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Crown,
  Lock,
  ArrowLeft,
  Sparkles,
  Send as SendIcon,
  Trash2,
  Bot,
  RotateCcw,
  CheckCheck,
  Zap,
  Flame,
  Salad,
  Apple,
  Dumbbell,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type Message = {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  is_sending?: boolean;
};

const QUICK_PROMPTS = [
  {
    icon: Flame,
    title: "Calcular meus macros",
    prompt: "Gostaria de calcular meus macronutrientes ideais para o meu objetivo atual.",
  },
  {
    icon: Dumbbell,
    title: "Pré e pós-treino",
    prompt: "Quais são as melhores opções de refeição para comer antes e depois do meu treino?",
  },
  {
    icon: Salad,
    title: "Almoço proteico",
    prompt: "Me dê uma sugestão de almoço proteico, saudável e fácil de preparar.",
  },
  {
    icon: Apple,
    title: "Dicas para secar",
    prompt:
      "Quais estratégias nutricionais você recomenda para queimar gordura mantendo massa magra?",
  },
];

export function ChatPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { user, profile, subscription, isAdmin } = useAuth();
  const qc = useQueryClient();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/buscar" });
    }
  };

  // Horizontal swipe gestures to go back (swipe right) or advance to next section (swipe left)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [role='dialog'], [data-no-swipe], .no-swipe")) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Swipe right (do lado esquerdo para o direito): vai para a sessão à esquerda no menu (Perfil)
    if (deltaX > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsed < 500) {
      navigate({ to: "/perfil" });
    }
    // Swipe left (do lado direito para o esquerdo): vai para a sessão à direita no menu (Scanner)
    else if (deltaX < -55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsed < 500) {
      navigate({ to: "/scanner" });
    }
  };

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usageLimit, setUsageLimit] = useState<{ count: number; limit: number }>({
    count: 0,
    limit: 0,
  });
  const [planStatuses, setPlanStatuses] = useState<Record<string, "accepted" | "rejected">>({});

  const parsePlanFromContent = (content: string) => {
    const match = content.match(/\[APLICAR_MELHORIAS:\s*(\{.*?\})\]/s);
    if (!match) return { cleanContent: content, plan: null };
    const cleanContent = content.replace(/\[APLICAR_MELHORIAS:\s*(\{.*?\})\]/s, "").trim();
    try {
      const plan = JSON.parse(match[1]);
      return { cleanContent, plan };
    } catch {
      return { cleanContent, plan: null };
    }
  };

  const handleAcceptPlan = async (msgId: string, plan: { meta?: string; dieta?: string }) => {
    if (!user) return;
    try {
      const updateData: any = {};
      if (plan.meta) updateData.meta = plan.meta;
      if (plan.dieta) updateData.dieta = plan.dieta;

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) throw error;

      setPlanStatuses((prev) => ({ ...prev, [msgId]: "accepted" }));
      toast.success("Plano nutricional aplicado com sucesso ao seu perfil!");
      await qc.invalidateQueries({ queryKey: ["user_profile", user.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aplicar plano.");
    }
  };

  const handleRejectPlan = (msgId: string) => {
    setPlanStatuses((prev) => ({ ...prev, [msgId]: "rejected" }));
    toast.info("Plano nutricional recusado.");
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscription validation: only monthly, yearly or admin can access AI chat
  const canAccessAI =
    isAdmin ||
    ((subscription?.status === "active" || subscription?.status === "trialing") &&
      (subscription?.plan === "monthly" ||
        subscription?.plan === "yearly" ||
        subscription?.plan === "annual" ||
        !subscription?.plan));

  // Query AI message history
  const { data: rawAiMsgs, isLoading: loadingMsgs } = useQuery({
    queryKey: ["ai_chat", user?.id],
    enabled: !!user && canAccessAI,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // Query usage count for limited plans
  const { data: usageInfo, refetch: refetchUsage } = useQuery({
    queryKey: ["chat_usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) return { count: 0, limit: -1, plan: "admin" };

      const planKey = subscription?.plan || "free";
      let limit = 0;
      if (subscription?.status === "active" || subscription?.status === "trialing") {
        if (planKey === "yearly" || planKey === "annual" || !subscription?.plan) {
          limit = -1; // unlimited
        } else if (planKey === "monthly") {
          limit = 50;
        } else if (planKey === "weekly") {
          limit = 0; // weekly has no access
        }
      }

      const { data: usageData } = await supabase
        .from("chat_usage")
        .select("usage_count, last_message_at")
        .eq("user_id", user!.id)
        .maybeSingle();

      let currentUsage = usageData?.usage_count ?? 0;

      if (usageData?.last_message_at) {
        const lastDate = new Date(usageData.last_message_at).toDateString();
        if (lastDate !== new Date().toDateString()) {
          currentUsage = 0;
        }
      }

      return { count: currentUsage, limit, plan: planKey };
    },
  });

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [rawAiMsgs?.length, optimisticMessages.length, sending]);

  // Send message to AI Nutritionist
  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!user || !text) return;

    if (!canAccessAI) {
      toast.error("Assine o plano Mensal ou Anual para conversar com a IA Nutricionista.");
      return;
    }

    // Check plan limits
    if (!isAdmin && usageInfo && usageInfo.limit !== -1) {
      if (usageInfo.count >= usageInfo.limit) {
        setUsageLimit({ count: usageInfo.count, limit: usageInfo.limit });
        setShowLimitModal(true);
        return;
      }
    }

    const tempId = `temp-${Math.random().toString(36).substring(7)}`;

    const optimisticMsg: Message = {
      id: tempId,
      user_id: user.id,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      is_sending: true,
    };

    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch(getApiUrl("/api/edge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "nutrition-chat",
          body: { message: text, user_id: user.id },
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Erro ao processar resposta da IA.");
      }

      // Increment usage count
      if (!isAdmin) {
        const { data: usageData } = await supabase
          .from("chat_usage")
          .select("usage_count, last_message_at")
          .eq("user_id", user.id)
          .maybeSingle();

        let currentCount = usageData?.usage_count ?? 0;
        if (usageData?.last_message_at) {
          const lastDate = new Date(usageData.last_message_at).toDateString();
          if (lastDate !== new Date().toDateString()) {
            currentCount = 0;
          }
        }

        await supabase.from("chat_usage").upsert(
          {
            user_id: user.id,
            usage_count: currentCount + 1,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        refetchUsage();
      }

      await qc.invalidateQueries({ queryKey: ["ai_chat", user.id] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar mensagem.";
      toast.error(msg);
    } finally {
      setSending(false);
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // Clear conversation history
  const handleClearHistory = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
      if (error) throw error;
      toast.success("Histórico da conversa limpo com sucesso.");
      setShowClearConfirm(false);
      await qc.invalidateQueries({ queryKey: ["ai_chat", user.id] });
    } catch {
      toast.error("Erro ao limpar histórico.");
    }
  };

  // Combine real and optimistic messages
  const allMessages: Message[] = [...(rawAiMsgs ?? [])];
  optimisticMessages.forEach((om) => {
    if (!allMessages.some((m) => m.id === om.id)) {
      allMessages.push(om);
    }
  });

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden"
    >
      {/* Header */}
      <header className="px-3 sm:px-4 py-3 bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between shrink-0 z-20 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
            className="size-9 sm:size-10 rounded-2xl bg-secondary/90 hover:bg-secondary text-foreground shrink-0 border border-border/70 active:scale-95 transition-transform"
            aria-label="Voltar para a tela anterior"
            title="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Button>

          <div className="size-9 sm:size-10 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center shadow-md shadow-primary/20 text-white shrink-0">
            <Sparkles className="size-4 sm:size-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-display font-black tracking-tight text-foreground truncate">
                Nutricionista IA
              </h1>
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-black px-1.5 py-0">
                PRO
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium truncate">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Online • Especialista em Nutrição
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {usageInfo && usageInfo.limit !== -1 ? (
            <div className="px-2.5 py-1 rounded-xl bg-secondary border border-border flex flex-col items-center">
              <span className="text-[8px] font-black tracking-widest text-muted-foreground uppercase leading-none mb-0.5">
                Uso Diário
              </span>
              <span className="text-[10px] font-black text-primary leading-none">
                {usageInfo.count} / {usageInfo.limit}
              </span>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-bold border-primary/30 text-primary"
            >
              <Zap className="size-3 mr-1 fill-primary" /> Ilimitado
            </Badge>
          )}

          {allMessages.length > 0 && canAccessAI && (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
              onClick={() => setShowClearConfirm(true)}
              title="Limpar histórico"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      {!canAccessAI ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Card className="p-8 text-center space-y-6 bg-gradient-to-br from-primary/10 via-background to-transparent border-primary/20 rounded-[36px] shadow-xl max-w-sm w-full">
            <div className="size-20 rounded-[28px] bg-gradient-to-tr from-primary to-emerald-500 mx-auto flex items-center justify-center shadow-xl shadow-primary/25 text-white">
              <Lock className="size-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-black text-foreground">
                Nutricionista IA Exclusivo
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                Tenha um especialista em nutrição disponível 24 horas por dia para tirar dúvidas,
                calcular macros, analisar pratos e montar estratégias alimentares personalizadas.
              </p>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest pt-1">
                Disponível nos planos Mensal e Anual
              </p>
            </div>
            <Button
              asChild
              className="w-full h-13 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 font-black uppercase tracking-wider shadow-lg shadow-primary/20"
            >
              <Link to="/premium">
                <Crown className="size-5 mr-2" /> Ativar Acesso Premium
              </Link>
            </Button>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden relative">
          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {allMessages.length === 0 && !loadingMsgs ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6 px-4 space-y-5 animate-in fade-in duration-300">
                <div className="size-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                  <Bot className="size-8" />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <h3 className="text-base font-black text-foreground">
                    Olá, {profile?.nome || "atleta"}! 👋
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sou o seu nutricionista com inteligência artificial. Como posso ajudar com a sua
                    alimentação e metas hoje?
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md pt-2">
                  {QUICK_PROMPTS.map((qp, idx) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => sendMessage(qp.prompt)}
                        className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-start gap-2.5 group shadow-sm active:scale-[0.98]"
                      >
                        <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {qp.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {qp.prompt}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              allMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-2.5 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="size-8 rounded-xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                        <Sparkles className="size-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 rounded-[22px] text-xs sm:text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-sm font-medium"
                          : "bg-card border border-border/80 text-foreground rounded-tl-sm"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        (() => {
                          const { cleanContent, plan } = parsePlanFromContent(msg.content);
                          const status = planStatuses[msg.id];
                          return (
                            <div className="space-y-3">
                              <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground">
                                <Markdown remarkPlugins={[remarkGfm]}>{cleanContent}</Markdown>
                              </div>

                              {plan && (
                                <div className="mt-3 p-3 rounded-xl bg-secondary/80 border border-primary/30 space-y-2">
                                  <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                                    <Sparkles className="size-3.5" /> Plano Nutricional Proposto
                                  </p>
                                  {plan.meta && (
                                    <p className="text-[11px] text-foreground">
                                      <span className="font-bold">Meta:</span> {plan.meta}
                                    </p>
                                  )}
                                  {plan.dieta && (
                                    <p className="text-[11px] text-foreground">
                                      <span className="font-bold">Dieta/Estratégia:</span>{" "}
                                      {plan.dieta}
                                    </p>
                                  )}

                                  {status === "accepted" ? (
                                    <div className="pt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">
                                      <span>✅ Plano Aceito e Aplicado ao Perfil</span>
                                    </div>
                                  ) : status === "rejected" ? (
                                    <div className="pt-1 flex items-center gap-1.5 text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-2 rounded-lg">
                                      <span>❌ Plano Recusado</span>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                      <Button
                                        size="sm"
                                        onClick={() => handleAcceptPlan(msg.id, plan)}
                                        className="h-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:bg-primary/95"
                                      >
                                        Aceitar Plano
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRejectPlan(msg.id)}
                                        className="h-8 rounded-lg border-border text-xs font-bold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                      >
                                        Recusar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}

                      <div
                        className={`flex items-center gap-1 mt-1 text-[9px] ${
                          isUser
                            ? "text-primary-foreground/70 justify-end"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isUser && <CheckCheck className="size-3" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start items-center gap-2.5"
              >
                <div className="size-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
                  <Sparkles className="size-4 animate-spin" />
                </div>
                <div className="bg-secondary/80 border border-border/80 rounded-[20px] rounded-tl-sm px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
                  <span className="size-1.5 bg-primary rounded-full animate-bounce" />
                  <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-muted-foreground font-semibold ml-1.5">
                    Nutricionista analisando...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Input Footer */}
          <div className="p-3 sm:p-4 bg-card/95 backdrop-blur-md border-t border-border/80 shrink-0 pb-[max(14px,env(safe-area-inset-bottom,14px))]">
            <div className="flex items-center gap-2 max-w-4xl mx-auto">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao seu nutricionista..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending}
                className="bg-secondary/40 border border-border/60 focus-visible:ring-2 focus-visible:ring-primary/20 text-foreground text-xs sm:text-sm h-12 rounded-2xl flex-1 px-4 placeholder:text-muted-foreground/60"
              />

              <Button
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                className="size-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
                aria-label="Enviar mensagem"
              >
                <SendIcon className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-xs bg-card border border-border rounded-[28px] p-6 text-foreground text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>Limpar histórico da conversa?</DialogTitle>
            <DialogDescription>Apagar todas as mensagens com o nutricionista IA.</DialogDescription>
          </DialogHeader>

          <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-2">
            <Trash2 className="size-6" />
          </div>

          <h3 className="text-base font-black tracking-tight">Limpar Histórico?</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Esta ação removerá todas as mensagens trocadas com o nutricionista IA.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              variant="outline"
              className="rounded-xl h-11 border-border"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl h-11 font-bold"
              onClick={handleClearHistory}
            >
              Apagar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Limit Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="max-w-xs bg-card border border-border rounded-[28px] p-6 text-foreground text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>Limite diário atingido</DialogTitle>
            <DialogDescription>
              Você atingiu o limite de mensagens diárias para seu plano.
            </DialogDescription>
          </DialogHeader>

          <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
            <Zap className="size-6" />
          </div>

          <h3 className="text-base font-black tracking-tight">Limite Diário Atingido</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Você utilizou todas as {usageLimit.limit} mensagens diárias do seu plano mensal. O
            limite será reiniciado amanhã.
          </p>

          <div className="space-y-2 mt-4">
            <Button
              asChild
              className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-black uppercase text-xs tracking-wider"
            >
              <Link to="/premium">
                <Crown className="size-4 mr-1.5" /> Migrar para Anual (Ilimitado)
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 border-border text-xs"
              onClick={() => setShowLimitModal(false)}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
