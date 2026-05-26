import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  Navigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_app")({ component: AppLayout });

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

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"buttons" | "infinite">("infinite");

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
            if ("Notification" in window) {
              if (Notification.permission === "granted") {
                new Notification(`💬 ${senderName}`, {
                  body: notificationBody,
                  icon: "/favicon.ico",
                });
              } else if (Notification.permission === "default") {
                Notification.requestPermission().then((permission) => {
                  if (permission === "granted") {
                    new Notification(`💬 ${senderName}`, {
                      body: notificationBody,
                      icon: "/favicon.ico",
                    });
                  }
                });
              }
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center font-sans tracking-tight antialiased selection:bg-primary/20">
      {showIntro && <IntroAnimation onDone={handleIntroDone} />}

      <main
        style={{
          paddingBottom:
            "max(var(--main-padding-bottom, 160px), calc(var(--main-padding-bottom, 160px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className="flex-1 w-full max-w-[480px] bg-card px-6 pt-12 overflow-hidden relative shadow-xl border-x border-border"
      >
        {/* Delicate organic glow at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/5 blur-[80px] pointer-events-none" />

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Outlet />
        </div>
      </main>

      <nav
        style={{
          bottom:
            "max(var(--android-nav-bottom, 32px), calc(var(--android-nav-bottom, 32px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[min(94vw,440px)] px-4 transition-all duration-300"
      >
        <div className="glass-strong rounded-[44px] px-2 py-2 flex items-center justify-around shadow-[0_16px_40px_rgba(46,74,59,0.08)] border border-border">
          {tabs.map(({ to, Icon, label }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={`relative flex items-center justify-center size-13 rounded-[28px] transition-all duration-300 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(46,74,59,0.25)] scale-105 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Icon className="size-5.5" strokeWidth={active ? 2.5 : 2} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
