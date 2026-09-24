import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Crown,
  Gift,
  Lock,
  ArrowLeft,
  Sparkles,
  Send as SendIcon,
  Trash2,
  RotateCcw,
  CheckCheck,
  Zap,
  Flame,
  Salad,
  Apple,
  Dumbbell,
  Image as ImageIcon,
  X as XIcon,
} from "lucide-react";
import { SarAiAvatar } from "@/components/sar-ai-avatar";
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
import { useTranslation } from "@/lib/strings";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type Message = {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  is_sending?: boolean;
};

interface ChatMessageItemProps {
  msg: Message;
  planStatus?: "accepted" | "rejected";
  onAcceptPlan: (
    msgId: string,
    msgContent: string,
    plan: { meta?: string; dieta?: string },
  ) => void;
  onRejectPlan: (msgId: string, msgContent: string) => void;
}

const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  planStatus,
  onAcceptPlan,
  onRejectPlan,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const { t } = useTranslation();

  const { cleanContent, plan, status } = useMemo(() => {
    if (isUser) return { cleanContent: msg.content, plan: null, status: null };

    const statusMatch = msg.content.match(/\[PLAN_STATUS:(accepted|rejected)\]/);
    const parsedStatus = statusMatch ? (statusMatch[1] as "accepted" | "rejected") : null;
    const finalStatus = planStatus || parsedStatus;

    const match = msg.content.match(/\[APLICAR_MELHORIAS:\s*(\{.*?\})\]/s);
    if (!match) {
      const clean = msg.content.replace(/\[PLAN_STATUS:[^\]]+\]/g, "").trim();
      return { cleanContent: clean, plan: null, status: finalStatus };
    }
    const clean = msg.content
      .replace(/\[APLICAR_MELHORIAS:\s*(\{.*?\})\]/s, "")
      .replace(/\[PLAN_STATUS:[^\]]+\]/g, "")
      .trim();
    try {
      const p = JSON.parse(match[1]);
      return { cleanContent: clean, plan: p, status: finalStatus };
    } catch {
      return { cleanContent: clean, plan: null, status: finalStatus };
    }
  }, [msg.content, isUser, planStatus]);

  return (
    <div
      className={`content-auto-msg flex items-start gap-2.5 gpu-fast ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && <SarAiAvatar size={34} className="shrink-0 mt-0.5" />}

      <div
        className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 rounded-[22px] text-xs sm:text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm font-medium"
            : "bg-card border border-border/80 text-foreground rounded-tl-sm"
        }`}
      >
        {isUser ? (
          <div className="space-y-2">
            {(() => {
              const imgMatch = msg.content.match(/\[IMAGE:(data:image\/[^\]]+)\]/);
              const cleanText = msg.content
                .replace(/\[IMAGE:data:image\/[^\]]+\]/g, "")
                .replace("📷 [Imagem enviada]", "")
                .trim();
              return (
                <>
                  {imgMatch && (
                    <img
                      src={imgMatch[1]}
                      alt="Prato enviado"
                      className="rounded-xl max-h-52 w-full object-cover shadow-sm border border-white/20 mb-1"
                      loading="lazy"
                    />
                  )}
                  {cleanText && <p className="whitespace-pre-wrap">{cleanText}</p>}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground">
              <Markdown remarkPlugins={[remarkGfm]}>{cleanContent}</Markdown>
            </div>

            {plan && (
              <div className="mt-3 p-3 rounded-xl bg-secondary/80 border border-primary/30 space-y-2">
                <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> {t("chat.planProposed")}
                </p>
                {plan.meta && (
                  <p className="text-[11px] text-foreground">
                    <span className="font-bold">{t("chat.planGoal")}</span> {plan.meta}
                  </p>
                )}
                {plan.dieta && (
                  <p className="text-[11px] text-foreground">
                    <span className="font-bold">{t("chat.planStrategy")}</span> {plan.dieta}
                  </p>
                )}

                {status === "accepted" ? (
                  <div className="pt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">
                    <span>{t("chat.planAcceptedBadge")}</span>
                  </div>
                ) : status === "rejected" ? (
                  <div className="pt-1 flex items-center gap-1.5 text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-2 rounded-lg">
                    <span>{t("chat.planRejectedBadge")}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => onAcceptPlan(msg.id, msg.content, plan)}
                      className="h-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:bg-primary/95"
                    >
                      {t("chat.acceptPlan")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectPlan(msg.id, msg.content)}
                      className="h-8 rounded-lg border-border text-xs font-bold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    >
                      {t("chat.rejectPlan")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={`flex items-center gap-1 mt-1 text-[9px] ${
            isUser ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
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
    </div>
  );
});

export function ChatPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    user,
    profile,
    subscription,
    isAdmin,
    canAccessAI,
    isCampaignAiActive,
    campaignAiExpirationDate,
  } = useAuth();
  const qc = useQueryClient();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/buscar" });
    }
  };

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

    if (deltaX > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsed < 500) {
      navigate({ to: "/perfil" });
    } else if (deltaX < -55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsed < 500) {
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

  const handleAcceptPlan = useCallback(
    async (msgId: string, _msgContent: string, plan: { meta?: string; dieta?: string }) => {
      if (!user) return;
      try {
        setPlanStatuses((prev) => ({ ...prev, [msgId]: "accepted" }));

        let objetivoValue: "perder" | "manter" | "ganhar" | undefined;
        const metaLower = (plan.meta || "").toLowerCase();
        if (
          metaLower.includes("perder") ||
          metaLower.includes("emagrecer") ||
          metaLower.includes("secar") ||
          metaLower.includes("gordura")
        ) {
          objetivoValue = "perder";
        } else if (
          metaLower.includes("ganhar") ||
          metaLower.includes("massa") ||
          metaLower.includes("hipertrofia") ||
          metaLower.includes("superávit") ||
          metaLower.includes("superavit")
        ) {
          objetivoValue = "ganhar";
        } else if (metaLower.includes("manter") || metaLower.includes("manutenção")) {
          objetivoValue = "manter";
        }

        if (objetivoValue) {
          await supabase.from("profiles").update({ objetivo: objetivoValue }).eq("id", user.id);
        }

        const res = await fetch(getApiUrl("/api/edge"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "update-plan-status",
            body: { msg_id: msgId, status: "accepted", user_id: user.id },
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Erro ao salvar status do plano");

        toast.success(t("chat.planAppliedToast"));
        await qc.invalidateQueries({ queryKey: ["ai_chat", user.id] });
        await qc.invalidateQueries({ queryKey: ["user_profile", user.id] });
      } catch (e: any) {
        toast.error(e?.message || "Erro ao aplicar plano.");
      }
    },
    [user, qc, t],
  );

  const handleRejectPlan = useCallback(
    async (msgId: string, _msgContent: string) => {
      if (!user) return;
      try {
        setPlanStatuses((prev) => ({ ...prev, [msgId]: "rejected" }));

        const res = await fetch(getApiUrl("/api/edge"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "update-plan-status",
            body: { msg_id: msgId, status: "rejected", user_id: user.id },
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Erro ao salvar status do plano");

        toast.info(t("chat.planRejectedToast"));
        await qc.invalidateQueries({ queryKey: ["ai_chat", user.id] });
      } catch (e: any) {
        toast.error(e?.message || "Erro ao recusar plano.");
      }
    },
    [user, qc, t],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Query AI message history
  const { data: rawAiMsgs, isLoading: loadingMsgs } = useQuery({
    queryKey: ["ai_chat", user?.id],
    enabled: !!user,
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

  const planKey = (subscription?.plan || "free").replace("_cancelled", "").toLowerCase();

  // Query usage count for limited plans
  const { data: usageInfo, refetch: refetchUsage } = useQuery({
    queryKey: ["chat_usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) return { count: 0, limit: -1, plan: "admin" };

      let limit = 30;
      if (planKey === "yearly" || planKey === "annual") {
        limit = 100;
      } else if (planKey === "monthly") {
        limit = 50;
      } else if (planKey === "weekly") {
        limit = 30;
      } else {
        limit = 30;
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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>("image/jpeg");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error(t("chat.imageFormatError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setSelectedImageMime(file.type);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [rawAiMsgs?.length, optimisticMessages.length, sending]);

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!user || (!text && !selectedImage)) return;

    if (!canAccessAI) {
      toast.error(t("chat.exclusiveTitle"));
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
      content: text + (selectedImage ? `\n[IMAGE:${selectedImage}]` : ""),
      created_at: new Date().toISOString(),
      is_sending: true,
    };

    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    const imgToSend = selectedImage;
    const mimeToSend = selectedImageMime;
    setSelectedImage(null);
    setSending(true);

    try {
      const bodyPayload: any = {
        message: text || "Analise esta imagem de prato ou alimento.",
        user_id: user.id,
      };
      if (imgToSend) {
        bodyPayload.image = imgToSend;
        bodyPayload.imageMimeType = mimeToSend;
      }

      const response = await fetch(getApiUrl("/api/edge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "nutrition-chat",
          body: bodyPayload,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Erro ao processar resposta da IA.");
      }

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

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
      if (error) throw error;
      toast.success(t("chat.historyClearedSuccess"));
      setShowClearConfirm(false);
      await qc.invalidateQueries({ queryKey: ["ai_chat", user.id] });
    } catch {
      toast.error("Erro ao limpar histórico.");
    }
  };

  const allMessages: Message[] = [...(rawAiMsgs ?? [])];
  optimisticMessages.forEach((om) => {
    if (!allMessages.some((m) => m.id === om.id)) {
      allMessages.push(om);
    }
  });

  const quickPrompts = [
    {
      icon: Flame,
      title: t("chat.promptCalcMacrosTitle"),
      prompt: t("chat.promptCalcMacrosText"),
    },
    {
      icon: Dumbbell,
      title: t("chat.promptWorkoutTitle"),
      prompt: t("chat.promptWorkoutText"),
    },
    {
      icon: Salad,
      title: t("chat.promptLunchTitle"),
      prompt: t("chat.promptLunchText"),
    },
    {
      icon: Apple,
      title: t("chat.promptFatLossTitle"),
      prompt: t("chat.promptFatLossText"),
    },
  ];

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden"
    >
      {/* Header */}
      <header
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 24px))",
        }}
        className="px-3 sm:px-4 pb-3 bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between shrink-0 z-20 gap-2"
      >
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

          <SarAiAvatar size={38} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-display font-black tracking-tight text-foreground truncate">
                {t("chat.title")}
              </h1>
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-black px-1.5 py-0">
                PRO
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium truncate">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {t("chat.statusOnline")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {usageInfo && usageInfo.limit !== -1 ? (
            <div className="px-2.5 py-1 rounded-xl bg-secondary border border-border flex flex-col items-center">
              <span className="text-[8px] font-black tracking-widest text-muted-foreground uppercase leading-none mb-0.5">
                {t("chat.dailyUsage")}
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
              <Zap className="size-3 mr-1 fill-primary" /> {t("chat.unlimited")}
            </Badge>
          )}

          {allMessages.length > 0 && canAccessAI && (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
              onClick={() => setShowClearConfirm(true)}
              title={t("chat.clearChat")}
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Campaign Expiry Banner */}
      {isCampaignAiActive && campaignAiExpirationDate && (
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/5 border-b border-primary/25 px-4 py-2.5 flex items-center justify-between gap-3 text-xs z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Gift className="size-4 text-primary shrink-0 animate-bounce" />
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">
              {t("chat.campaignActive")}{" "}
              <strong className="text-foreground font-bold">
                {campaignAiExpirationDate.toLocaleString("pt-PT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </p>
          </div>
          <Badge className="bg-primary/20 hover:bg-primary/35 text-primary text-[10px] font-black border-none shrink-0 py-0.5 px-2">
            {t("chat.campaignBadge")}
          </Badge>
        </div>
      )}

      {/* Main Container */}
      {!canAccessAI ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Card className="p-8 text-center space-y-6 bg-gradient-to-br from-primary/10 via-background to-transparent border-primary/20 rounded-[36px] shadow-xl max-w-sm w-full">
            <div className="size-20 rounded-[28px] bg-gradient-to-tr from-primary to-emerald-500 mx-auto flex items-center justify-center shadow-xl shadow-primary/25 text-white">
              <Lock className="size-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-black text-foreground">
                {t("chat.exclusiveTitle")}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                {t("chat.exclusiveDesc")}
              </p>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest pt-1">
                {t("chat.exclusivePlans")}
              </p>
            </div>
            <Button
              asChild
              className="w-full h-13 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 font-black uppercase tracking-wider shadow-lg shadow-primary/20"
            >
              <Link to="/premium">
                <Crown className="size-5 mr-2" /> {t("chat.unlockPremium")}
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
                <SarAiAvatar size={84} withAura className="mx-auto drop-shadow-xl" />
                <div className="space-y-1.5 max-w-xs">
                  <h3 className="text-base font-black text-foreground">
                    {t("chat.helloUser", { name: profile?.nome || "atleta" })}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("chat.welcomeIntro")}
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md pt-2">
                  {quickPrompts.map((qp, idx) => {
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
              allMessages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  planStatus={planStatuses[msg.id]}
                  onAcceptPlan={handleAcceptPlan}
                  onRejectPlan={handleRejectPlan}
                />
              ))
            )}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start items-center gap-2.5"
              >
                <SarAiAvatar size={34} isThinking={true} className="shrink-0" />
                <div className="bg-secondary/80 border border-border/80 rounded-[20px] rounded-tl-sm px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
                  <span className="size-1.5 bg-primary rounded-full animate-bounce" />
                  <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-muted-foreground font-semibold ml-1.5">
                    {t("chat.analyzing")}
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Input Footer */}
          <div className="p-3 sm:p-4 bg-card/95 backdrop-blur-md border-t border-border/80 shrink-0 pb-[max(14px,env(safe-area-inset-bottom,14px))]">
            <div className="max-w-4xl mx-auto space-y-2">
              {selectedImage && (
                <div className="relative inline-block">
                  <img
                    src={selectedImage}
                    alt="Preview"
                    className="size-16 rounded-xl object-cover border border-border shadow-sm"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 size-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="size-12 rounded-2xl border-border/60 bg-secondary/40 shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/80 cursor-pointer"
                  title="Enviar foto (PNG ou JPEG)"
                >
                  <ImageIcon className="size-5" />
                </Button>

                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("chat.placeholder")}
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
                  disabled={sending || (!input.trim() && !selectedImage)}
                  className="size-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
                  aria-label={t("chat.send")}
                >
                  <SendIcon className="size-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-xs bg-card border border-border rounded-[28px] p-6 text-foreground text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("chat.clearChatTitle")}</DialogTitle>
            <DialogDescription>{t("chat.clearChatDesc")}</DialogDescription>
          </DialogHeader>

          <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-2">
            <Trash2 className="size-6" />
          </div>

          <h3 className="text-base font-black tracking-tight">{t("chat.clearChatTitle")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("chat.clearChatDesc")}</p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              variant="outline"
              className="rounded-xl h-11 border-border"
              onClick={() => setShowClearConfirm(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl h-11 font-bold"
              onClick={handleClearHistory}
            >
              {t("chat.clearConfirmBtn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Limit Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="max-w-xs bg-card border border-border rounded-[28px] p-6 text-foreground text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("chat.limitReachedTitle")}</DialogTitle>
            <DialogDescription>
              {t("chat.limitReachedDesc", { limit: usageLimit.limit })}
            </DialogDescription>
          </DialogHeader>

          <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
            <Zap className="size-6" />
          </div>

          <h3 className="text-base font-black tracking-tight">{t("chat.limitReachedTitle")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("chat.limitReachedDesc", { limit: usageLimit.limit })}
          </p>

          <div className="space-y-2 mt-4">
            <Button
              asChild
              className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-black uppercase text-xs tracking-wider"
            >
              <Link to="/premium">
                <Crown className="size-4 mr-1.5" /> {t("chat.upgradeUnlimited")}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 border-border text-xs"
              onClick={() => setShowLimitModal(false)}
            >
              {t("chat.understood")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
