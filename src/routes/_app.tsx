import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera,
  Search,
  History,
  User,
  MessagesSquare,
  BarChart3,
  Loader2,
  ArrowLeft,
  Smartphone,
  Mic,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SarLogo } from "@/components/sar-logo";
import { IntroAnimation } from "@/components/intro-animation";
import { App } from "@capacitor/app";
import GlassSurface from "@/components/GlassSurface";
import { ScannerPage } from "./_app/scanner";
import { BuscarPage } from "./_app/buscar";
import { ChatPage } from "./_app/chat";
import { DiarioPage } from "./_app/diario";
import { PerfilPage } from "./_app/perfil/index";
import { PremiumPage } from "./_app/premium";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const TAB_PAGES = [ScannerPage, BuscarPage, ChatPage, DiarioPage, PerfilPage, PremiumPage];

function usePrefetchPopularFoods(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    qc.prefetchQuery({
      queryKey: ["foods_popular"],
      staleTime: 1000 * 60 * 60 * 24,
      queryFn: async () => {
        const { data: cached } = await supabase
          .from("foods_basic")
          .select("nome, cal, carb, prot, gord, foto_url")
          .limit(100);
        if (cached && cached.length >= 50) return cached.map((c) => ({ ...c, porcao: "1 porção" }));
        const { data } = await supabase.functions.invoke("search-food-ai", {
          body: { mode: "popular" },
        });
        return data?.alimentos ?? [];
      },
    });
  }, [enabled, qc]);
}

const tabs = [
  { to: "/scanner", label: "Scanner", Icon: Camera },
  { to: "/buscar", label: "Buscar", Icon: Search },
  { to: "/chat", label: "Social", Icon: MessagesSquare },
  { to: "/diario", label: "Diário", Icon: History },
  { to: "/perfil", label: "Perfil", Icon: User },
  { to: "/premium", label: "Premium", Icon: BarChart3 },
] as const;

const ROOT_ALLOWED_PATHS = new Set([
  "/scanner",
  "/scanner/",
  "/buscar",
  "/buscar/",
  "/chat",
  "/chat/",
  "/diario",
  "/diario/",
  "/perfil",
  "/perfil/",
  "/premium",
  "/premium/",
]);

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
    opacity: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
      opacity: { duration: 0.15 },
    },
  },
};

function isSceneEligibleForSwipe(pathname: string): boolean {
  if (typeof document === "undefined") return false;

  // 1. Strict Path Check: Only root primary tab URLs allow tab swipe
  const isRootPath = ROOT_ALLOWED_PATHS.has(pathname);
  if (!isRootPath) return false;

  // 2. Chat / Sub-view dataset check
  if (document.body.dataset.inChat === "true") return false;
  if (document.body.style.pointerEvents === "none") return false;
  if (document.body.classList.contains("overflow-hidden")) return false;

  // 3. Dialog, sheet, modal, drawer, popover, radix portal check
  const modalOrOverlay = document.querySelector(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-in-chat="true"], [data-state="open"], [data-radix-portal] > *, [data-modal-open="true"], [data-subview="true"]',
  );
  if (modalOrOverlay) return false;

  // 4. Fixed overlay check (excluding navigation)
  const overlays = document.querySelectorAll('.fixed.inset-0, [class*="z-50"], [class*="z-[999]"]');
  for (let i = 0; i < overlays.length; i++) {
    const el = overlays[i] as HTMLElement;
    if (el.tagName === "NAV" || el.closest("nav")) continue;
    if (
      el.getAttribute("role") === "dialog" ||
      el.classList.contains("bg-black/80") ||
      el.classList.contains("backdrop-blur-sm") ||
      el.getAttribute("data-state") === "open"
    ) {
      return false;
    }
  }

  return true;
}

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  const router = useRouter();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"buttons" | "infinite">("infinite");

  const mainRef = useRef<HTMLElement>(null);
  const currentTabIdx = tabs.findIndex((t) => loc.pathname.startsWith(t.to));
  const isTopLevel =
    currentTabIdx >= 0 &&
    (loc.pathname === tabs[currentTabIdx].to || loc.pathname === `${tabs[currentTabIdx].to}/`);
  const [direction, setDirection] = useState(0);
  const prevTabIdxRef = useRef(currentTabIdx >= 0 ? currentTabIdx : 0);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animatingTo, setAnimatingTo] = useState<{
    target: number;
    nextTabTo?: string;
    direction?: number;
  } | null>(null);

  const touchTrackingRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isLockedVertical: boolean;
    isLockedHorizontal: boolean;
    target: EventTarget | null;
  } | null>(null);

  useEffect(() => {
    if (currentTabIdx >= 0 && currentTabIdx !== prevTabIdxRef.current) {
      setDirection(currentTabIdx > prevTabIdxRef.current ? 1 : -1);
      prevTabIdxRef.current = currentTabIdx;
    }
  }, [currentTabIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    if (!isSceneEligibleForSwipe(loc.pathname)) {
      touchTrackingRef.current = null;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        "input, textarea, select, canvas, video, [role='slider'], [data-no-swipe], [data-in-chat='true'], .no-swipe",
      )
    ) {
      touchTrackingRef.current = null;
      return;
    }

    const touch = e.touches[0];
    touchTrackingRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isLockedVertical: false,
      isLockedHorizontal: false,
      target: e.target,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTrackingRef.current || e.touches.length !== 1) return;

    if (!isSceneEligibleForSwipe(loc.pathname)) {
      touchTrackingRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      setAnimatingTo(null);
      return;
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchTrackingRef.current.startX;
    const deltaY = touch.clientY - touchTrackingRef.current.startY;

    // Determine lock direction if not locked yet
    if (
      !touchTrackingRef.current.isLockedHorizontal &&
      !touchTrackingRef.current.isLockedVertical
    ) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        // Natural vertical scroll - allow uninterrupted browser scrolling
        touchTrackingRef.current.isLockedVertical = true;
        return;
      }
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
        // Predominantly horizontal swipe - lock to horizontal drag
        touchTrackingRef.current.isLockedHorizontal = true;
        setIsDragging(true);
      }
    }

    if (touchTrackingRef.current.isLockedHorizontal) {
      const idx = currentTabIdx;
      let effectiveDeltaX = deltaX;
      // Resistance at first/last tab boundaries
      if (idx === 0 && deltaX > 0) {
        effectiveDeltaX = deltaX * 0.22;
      } else if (idx === tabs.length - 1 && deltaX < 0) {
        effectiveDeltaX = deltaX * 0.22;
      }
      setDragOffset(effectiveDeltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!touchTrackingRef.current) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const isHoriz = touchTrackingRef.current.isLockedHorizontal;
    const elapsed = Date.now() - touchTrackingRef.current.startTime;
    const currentOffset = dragOffset;

    touchTrackingRef.current = null;
    setIsDragging(false);

    const screenW =
      mainRef.current?.clientWidth ||
      (typeof window !== "undefined" ? Math.min(window.innerWidth, 480) : 380);

    if (isHoriz && Math.abs(currentOffset) > 0) {
      const distanceThreshold = screenW * 0.35;
      const isFastFlick = Math.abs(currentOffset) > 35 && elapsed < 350;

      const idx = currentTabIdx;
      if (idx !== -1) {
        if (
          (currentOffset < -distanceThreshold || (currentOffset < -35 && isFastFlick)) &&
          idx < tabs.length - 1
        ) {
          // Dragged left past threshold -> Transition forward to next tab
          setAnimatingTo({
            target: -screenW,
            nextTabTo: tabs[idx + 1].to,
            direction: 1,
          });
          return;
        } else if (
          (currentOffset > distanceThreshold || (currentOffset > 35 && isFastFlick)) &&
          idx > 0
        ) {
          // Dragged right past threshold -> Transition back to previous tab
          setAnimatingTo({
            target: screenW,
            nextTabTo: tabs[idx - 1].to,
            direction: -1,
          });
          return;
        }
      }
    }

    // Less than threshold: smoothly return to original position
    if (Math.abs(currentOffset) > 0) {
      setAnimatingTo({ target: 0 });
    } else {
      setDragOffset(0);
      setAnimatingTo(null);
    }
  };

  const handleTouchCancel = () => {
    touchTrackingRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
    setAnimatingTo(null);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      App.addListener("backButton", () => {
        router.history.back();
      });
    }
  }, [router]);

  useEffect(() => {
    const testDiv = document.createElement("div");
    testDiv.style.position = "fixed";
    testDiv.style.bottom = "env(safe-area-inset-bottom, 0px)";
    document.body.appendChild(testDiv);
    const bottomVal = window.getComputedStyle(testDiv).bottom;
    document.body.removeChild(testDiv);

    const parsed = parseFloat(bottomVal) || 0;

    const aspectRatio = window.screen.height / window.screen.width;
    const isTall = aspectRatio >= 2.05;

    let mode: "buttons" | "infinite" = "infinite";
    if (parsed > 0) {
      mode = "infinite";
    } else if (/Android/i.test(navigator.userAgent)) {
      mode = isTall ? "infinite" : "buttons";
    }

    setLayoutMode(mode);

    const root = document.documentElement;
    if (mode === "buttons") {
      root.style.setProperty("--android-bottom-offset", "16px");
      root.style.setProperty("--android-nav-bottom", "16px");
      root.style.setProperty("--main-padding-bottom", "120px");
    } else {
      root.style.setProperty("--android-bottom-offset", "32px");
      root.style.setProperty("--android-nav-bottom", "32px");
      root.style.setProperty("--main-padding-bottom", "160px");
    }
  }, []);

  const handleIntroDone = () => {
    setShowIntro(false);
  };

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    console.log(`[AppLayout] Running as standalone: ${isStandalone}`);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Proactively request notifications, microphone, and camera permissions sequentially at startup
    // so standard browser/device dialogs get prompted cleanly without block conflicts.
    const requestCorePermissions = async () => {
      const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      const cap = isCap ? (window as any).Capacitor : null;

      // 1. Solicitamos Notificações (Super Crítico!) primeiro de forma isolada
      const requestNotifications = async () => {
        if (localStorage.getItem("push_notifications_active") === "false") {
          console.log(
            "[Push] Ignorando permissão de notificações push automática conforme preferências do perfil do utilizador.",
          );
          return;
        }
        console.log("[Permissions] Solicitando permissão de notificações...");
        if (isCap) {
          const { PushNotifications } = cap.Plugins || {};
          if (PushNotifications) {
            try {
              const check = await PushNotifications.checkPermissions();
              if (check?.receive !== "granted") {
                const result = await PushNotifications.requestPermissions();
                if (result?.receive === "granted") {
                  console.log("[Push] Permissões nativas de notificação concedidas pelo clique.");
                  PushNotifications.register();
                } else {
                  console.warn("[Push] Permissões nativas recusadas ou ignoradas.");
                }
              } else {
                console.log("[Push] Permissão nativa já concedida, registrando dispositivo...");
                PushNotifications.register();
              }
            } catch (err) {
              console.error("[Push] Erro na requisição de Push nativo:", err);
            }
          }
        } else {
          if ("Notification" in window && Notification.permission === "default") {
            try {
              await Notification.requestPermission();
            } catch (err) {
              console.warn("[Permissions] Erro na notificação Web:", err);
            }
          }
        }
      };

      // 2. Solicitamos Câmera de forma independente
      const requestCamera = async () => {
        console.log("[Permissions] Câmera não é solicitada automaticamente.");
      };

      // 3. Solicitamos Microfone de forma independente
      const requestMicrophone = async () => {
        console.log("[Permissions] Microfone não é solicitado automaticamente.");
      };

      // Executa de forma sequencial com pequenos intervalos para não atropelar diálogos do SO, de forma segura
      try {
        await requestNotifications();
      } catch (e) {
        console.error("Erro na etapa de Notificações:", e);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      try {
        await requestCamera();
      } catch (e) {
        console.error("Erro na etapa de Câmera:", e);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      try {
        await requestMicrophone();
      } catch (e) {
        console.error("Erro na etapa de Microfone:", e);
      }
    };

    // Execute sequential request flow on user mount automatically!
    if (!showIntro) {
      requestCorePermissions();
    }
  }, [user, showIntro]);

  useEffect(() => {
    const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (isCapacitor) {
      const cap = (window as any).Capacitor;
      const { PushNotifications } = cap.Plugins || {};
      if (PushNotifications) {
        console.log("[Push] Inicializando ouvintes adicionais de notificações...");

        PushNotifications.addListener("registration", async (token: any) => {
          console.log("[Push] Registro efetuado com sucesso. Token:", token.value);
          const { error } = await supabase
            .from("profiles")
            .update({ fcm_token: token.value })
            .eq("id", user.id);
          if (error) {
            console.error("[Push] Erro ao sincronizar token com o banco:", error);
          }
        });

        PushNotifications.addListener("registrationError", (error: any) => {
          console.error("[Push] Erro no registro de notificações:", error);
        });

        PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          console.log("[Push] Notificação em primeiro plano (In-App):", notification);
          // Toque interativo do Sonner para o usuário saber de novas conversas ou ligações no foreground
          const isCallNotification =
            notification.data?.type === "incoming_call" || notification.title?.includes("Chamada");

          if (isCallNotification) {
            // Toast suprimido para chamadas, reliance total no listener em tempo real do CallContext!
            console.log(
              "[Push] Notificação de chamada recebida. Omitindo toast, CallContext lidará com isso.",
            );
            return;
          } else {
            toast.message(`💬 ${notification.title || "Nova mensagem"}`, {
              description: notification.body || "Toque para visualizar",
            });
          }
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
          console.log("[Push] Ação de notificação realizada (clique):", action);
          // Redirecionar para o ecrã do chat
          try {
            router.navigate({ to: "/chat" });
          } catch (routeErr) {
            console.error("[Push] Erro ao redirecionar para o chat:", routeErr);
          }
        });
      }
    }
  }, [user]);

  // Monitor e auto-registro para garantir que o utilizador NUNCA fique sem o token FCM real
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem("push_notifications_active") === "false") {
      console.log(
        "[Push] Ignorando monitoramento e auto-registro FCM: usuário desativou em suas definições de perfil.",
      );
      return;
    }
    const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (isCap) {
      const cap = (window as any).Capacitor;
      const { PushNotifications } = cap.Plugins || {};
      if (PushNotifications) {
        const isMockToken = profile?.fcm_token?.startsWith("fcm_mock_");
        const hasNoToken = !profile?.fcm_token;

        console.log(`[Push] Sincronização de Token FCM. Atual no banco: ${profile?.fcm_token}`);

        PushNotifications.checkPermissions().then((permResult: any) => {
          if (permResult.receive === "granted") {
            // Sempre registramos nativamente se já tivermos permissão, para atualizar o de forma fidedigna o token real no banco (sobrescrevendo mocks!)
            console.log(
              "[Push] Permissão já concedida, registrando dispositivo para obter token real...",
            );
            PushNotifications.register();
          } else if (hasNoToken || isMockToken) {
            // Se as permissões não estiverem concedidas e não tivermos token válido (ou for mock simulado!), solicitamos de forma ativa
            console.log(
              "[Push] Token de notificações em falta ou simulado na conta, solicitando permissões nativas para registro real...",
            );
            PushNotifications.requestPermissions().then((reqResult: any) => {
              if (reqResult.receive === "granted") {
                PushNotifications.register();
              }
            });
          }
        });
      }
    }
  }, [user, profile?.fcm_token]);

  // Sincronização global e notificações Web para mensagens de chat recebidas no browser
  useEffect(() => {
    if (!user) return;
    const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;

    const dmChannel = supabase
      .channel("global_dm_receiver")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          // Obter dados do emissor
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", newMsg.sender_id)
            .maybeSingle();

          const senderName = senderProfile?.nome || "Utilizador";
          const notificationBody = newMsg.audio_url
            ? "🎙️ Enviou uma mensagem de voz"
            : newMsg.content;

          // Se a janela estiver em segundo plano ou minimizada, disparar notificação nativa HTML5
          if (document.hidden) {
            try {
              if ("Notification" in window) {
                if (Notification.permission === "granted") {
                  try {
                    new Notification(`💬 ${senderName}`, {
                      body: notificationBody,
                      icon: "/favicon.ico",
                    });
                  } catch {
                    // Ignore notification creation errors
                  }
                } else if (
                  Notification.permission === "default" &&
                  typeof Notification.requestPermission === "function"
                ) {
                  Notification.requestPermission()
                    .then((permission) => {
                      if (permission === "granted") {
                        try {
                          new Notification(`💬 ${senderName}`, {
                            body: notificationBody,
                            icon: "/favicon.ico",
                          });
                        } catch {
                          // Ignore notification creation errors
                        }
                      }
                    })
                    .catch(() => {});
                }
              }
            } catch {
              // Ignore sandboxed iframe notification errors
            }
          } else {
            // Se estiver em primeiro plano, mas não no ecrã de chat, apresentar toast
            const isAtChat = window.location.pathname.includes("/chat");
            if (!isAtChat) {
              toast.message(`💬 ${senderName}`, {
                description: notificationBody,
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
    };
  }, [user]);

  usePrefetchPopularFoods(!!user && !!profile?.onboarding_done);

  if (loading)
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (profile && !profile.onboarding_done) return <Navigate to="/onboarding" />;

  const screenW =
    mainRef.current?.clientWidth ||
    (typeof window !== "undefined" ? Math.min(window.innerWidth, 480) : 380);
  const currentEffectiveX = animatingTo !== null ? animatingTo.target : isDragging ? dragOffset : 0;
  const normRatio = Math.max(-1, Math.min(1, currentEffectiveX / (screenW || 1)));
  const nextRatio = Math.max(0, Math.min(1, (screenW + currentEffectiveX) / (screenW || 1)));
  const prevRatio = Math.max(-1, Math.min(0, (-screenW + currentEffectiveX) / (screenW || 1)));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center font-sans tracking-tight antialiased selection:bg-primary/20">
      {showIntro && <IntroAnimation onDone={handleIntroDone} />}

      <main
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          paddingBottom:
            "max(var(--main-padding-bottom, 160px), calc(var(--main-padding-bottom, 160px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className="flex-1 w-full max-w-[480px] bg-card px-6 pt-12 relative shadow-xl border-x border-border min-h-screen overflow-x-hidden"
      >
        <motion.div
          key={loc.pathname.split("/")[1] || "home"}
          custom={direction}
          variants={pageVariants}
          initial={isDragging || animatingTo !== null ? false : "enter"}
          animate={
            isDragging || animatingTo !== null
              ? {
                  x: currentEffectiveX,
                  scale: 1 - Math.abs(normRatio) * 0.03,
                  opacity: 1 - Math.abs(normRatio) * 0.12,
                }
              : "center"
          }
          transition={
            isDragging
              ? { type: "tween", duration: 0 }
              : {
                  x: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                  scale: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                  opacity: { duration: 0.15 },
                }
          }
          onAnimationComplete={() => {
            if (animatingTo) {
              if (animatingTo.nextTabTo) {
                setDirection(animatingTo.direction || 1);
                navigate({ to: animatingTo.nextTabTo });
              }
              setAnimatingTo(null);
              setDragOffset(0);
            }
          }}
          style={{ willChange: "transform, opacity" }}
          className="w-full min-h-full"
        >
          <Outlet />
        </motion.div>

        {isTopLevel &&
          (isDragging || animatingTo !== null) &&
          (dragOffset < 0 || (animatingTo && animatingTo.target < 0)) &&
          currentTabIdx < tabs.length - 1 && (
            <motion.div
              key={`incoming-next-${currentTabIdx + 1}`}
              className="absolute inset-0 px-6 pt-12 w-full min-h-full pointer-events-none overflow-y-auto"
              style={{
                willChange: "transform, opacity",
              }}
              animate={{
                x: screenW + currentEffectiveX,
                scale: 0.97 + (1 - nextRatio) * 0.03,
                opacity: 0.6 + (1 - nextRatio) * 0.4,
              }}
              transition={
                isDragging
                  ? { type: "tween", duration: 0 }
                  : {
                      x: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                      scale: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                      opacity: { duration: 0.15 },
                    }
              }
            >
              {(() => {
                const NextPage = TAB_PAGES[currentTabIdx + 1];
                return <NextPage />;
              })()}
            </motion.div>
          )}

        {isTopLevel &&
          (isDragging || animatingTo !== null) &&
          (dragOffset > 0 || (animatingTo && animatingTo.target > 0)) &&
          currentTabIdx > 0 && (
            <motion.div
              key={`incoming-prev-${currentTabIdx - 1}`}
              className="absolute inset-0 px-6 pt-12 w-full min-h-full pointer-events-none overflow-y-auto"
              style={{
                willChange: "transform, opacity",
              }}
              animate={{
                x: -screenW + currentEffectiveX,
                scale: 0.97 + (1 - Math.abs(prevRatio)) * 0.03,
                opacity: 0.6 + (1 - Math.abs(prevRatio)) * 0.4,
              }}
              transition={
                isDragging
                  ? { type: "tween", duration: 0 }
                  : {
                      x: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                      scale: { type: "spring", stiffness: 450, damping: 40, mass: 0.4 },
                      opacity: { duration: 0.15 },
                    }
              }
            >
              {(() => {
                const PrevPage = TAB_PAGES[currentTabIdx - 1];
                return <PrevPage />;
              })()}
            </motion.div>
          )}
      </main>

      <nav
        style={{
          bottom:
            "max(var(--android-nav-bottom, 24px), calc(var(--android-nav-bottom, 24px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[min(94vw,440px)] px-3 transform-gpu pointer-events-auto"
      >
        <div className="w-full bg-white/95 dark:bg-[#151c18]/95 backdrop-blur-lg rounded-[32px] p-1.5 shadow-[0_12px_32px_rgba(46,74,59,0.12)] border border-black/5 dark:border-white/10 flex items-center justify-around transform-gpu">
          {tabs.map(({ to, Icon, label }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                preload="intent"
                aria-label={label}
                onClick={() => {
                  const targetIdx = tabs.findIndex((t) => t.to === to);
                  if (targetIdx !== -1 && targetIdx !== currentTabIdx) {
                    setDirection(targetIdx > currentTabIdx ? 1 : -1);
                  }
                }}
                className={`relative flex items-center justify-center size-12 rounded-[24px] transition-all duration-200 transform-gpu active:scale-95 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md scale-105 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
