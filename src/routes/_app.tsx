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
import { PushNotifications } from "@capacitor/push-notifications";
import GlassSurface from "@/components/GlassSurface";
import { isNativePlatform, mergeFcmTokens, parseFcmTokens } from "@/lib/utils";
import { CallDiagnosticTerminal } from "@/components/CallDiagnosticTerminal";

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

      // 1. Solicitamos Notificações primeiro de forma segura para a plataforma
      const requestNotifications = async () => {
        if (localStorage.getItem("push_notifications_active") === "false") {
          return;
        }

        // Em ambiente nativo Android, o registo é gerido de forma dedicada pelo hook nativo de FCM
        if (isNativePlatform()) {
          return;
        }

        // Em ambiente Web (navegador), solicita permissão da Web Notification API se compatível
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "default"
        ) {
          try {
            await Notification.requestPermission();
          } catch (err) {
            console.warn("[Permissions] Notificações Web:", err);
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

  // =========================================================================
  // SISTEMA DE GERAÇÃO E SINCRONIZAÇÃO AUTOMÁTICA DE TOKEN FCM (ANDROID NATIVO)
  // =========================================================================
  useEffect(() => {
    if (!user?.id) return;

    // Apenas em ambiente nativo Android (Capacitor/APK)
    if (!isNativePlatform()) {
      return;
    }

    if (localStorage.getItem("push_notifications_active") === "false") {
      console.log("[Push FCM] Notificações desativadas nas configurações do usuário.");
      return;
    }

    const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
    const pushPlugin = PushNotifications || cap?.Plugins?.PushNotifications;

    if (!pushPlugin) {
      console.warn("[Push FCM] Plugin PushNotifications não disponível.");
      return;
    }

    console.log("[Push FCM] Inicializando gerenciador nativo de notificações FCM...");

    // 1. Criar canal de notificações de chamadas de alta prioridade no Android
    if (typeof pushPlugin.createChannel === "function") {
      pushPlugin
        .createChannel({
          id: "incoming_calls",
          name: "Chamadas Recebidas",
          description: "Canal de alta prioridade para alertas de chamadas em tempo real",
          importance: 5, // IMPORTANCE_HIGH (Faz soar o alarme e exibe pop-up no ecrã)
          visibility: 1, // VISIBILITY_PUBLIC (Aparece no ecrã de bloqueio)
          vibration: true,
          sound: "ringtone.wav",
          lights: true,
        })
        .catch((err: any) => console.warn("[Push FCM] Aviso ao criar canal incoming_calls:", err));

      pushPlugin
        .createChannel({
          id: "calls_channel",
          name: "Chamadas de Voz",
          description: "Toque e notificações de chamadas recebidas em tempo real estilo WhatsApp",
          importance: 5,
          visibility: 1,
          sound: "ringtone.wav",
          vibration: true,
          lights: true,
        })
        .catch((err: any) => console.warn("[Push FCM] Aviso ao criar canal calls_channel:", err));
    }

    // 2. Ouvinte de Registro: Captura o token gerado para este telemóvel Android
    const regHandle = pushPlugin.addListener("registration", async (token: any) => {
      const deviceToken = token?.value;
      if (!deviceToken) return;

      console.log(`[Push FCM] Token gerado para este telemóvel: ${deviceToken.slice(0, 15)}...`);
      localStorage.setItem("device_fcm_token", deviceToken);

      // Suporte Multi-Dispositivo: Adiciona este telemóvel à lista de tokens do utilizador sem apagar os outros
      if (user?.id) {
        const existingTokens = parseFcmTokens(profile?.fcm_token);
        if (!existingTokens.includes(deviceToken)) {
          const mergedTokens = mergeFcmTokens(profile?.fcm_token, deviceToken);
          console.log(
            `[Push FCM] Novo telemóvel adicionado! Total de telemóveis registados para esta conta: ${mergedTokens.split(",").length}. Atualizando banco...`,
          );
          const { error } = await supabase
            .from("profiles")
            .update({ fcm_token: mergedTokens })
            .eq("id", user.id);

          if (error) {
            console.error(
              "[Push FCM] Erro ao sincronizar tokens multi-dispositivo no banco:",
              error,
            );
          } else {
            console.log("[Push FCM] Telemóvel registado com sucesso para receber chamadas!");
          }
        } else {
          console.log(
            "[Push FCM] Este telemóvel já se encontra registado e ativo para esta conta.",
          );
        }
      }
    });

    const regErrHandle = pushPlugin.addListener("registrationError", (error: any) => {
      console.error("[Push FCM] Erro no registro de notificações no Android:", error);
    });

    const notifRecvHandle = pushPlugin.addListener(
      "pushNotificationReceived",
      (notification: any) => {
        console.log("[Push FCM] Notificação recebida em primeiro plano:", notification);
        const isCallNotification =
          notification.data?.type === "INCOMING_CALL" ||
          notification.data?.type === "incoming_call" ||
          notification.data?.channelId === "incoming_calls" ||
          notification.data?.android_channel_id === "incoming_calls" ||
          notification.title?.includes("Chamada");

        if (isCallNotification) {
          console.log("[Push FCM] Chamada recebida! Redirecionando para a chamada...");
          try {
            router.navigate({ to: "/chat" });
          } catch {
            window.location.href = "/chat";
          }
        } else {
          toast.message(`💬 ${notification.title || "Nova mensagem"}`, {
            description: notification.body || "Toque para visualizar",
          });
        }
      },
    );

    const notifActHandle = pushPlugin.addListener(
      "pushNotificationActionPerformed",
      (action: any) => {
        console.log("[Push FCM] Notificação clicada:", action);
        const notification = action?.notification;
        const isCallNotification =
          notification?.data?.type === "INCOMING_CALL" ||
          notification?.data?.type === "incoming_call" ||
          notification?.data?.channelId === "incoming_calls" ||
          notification?.data?.android_channel_id === "incoming_calls" ||
          notification?.title?.includes("Chamada");

        try {
          router.navigate({ to: "/chat" });
        } catch (routeErr) {
          console.error("[Push FCM] Erro ao redirecionar para o chat:", routeErr);
        }
      },
    );

    // 3. Função de verificação e geração de token no telemóvel
    const verifyAndRegisterDevice = async () => {
      try {
        // Se já temos um token deste telemóvel em cache que ainda não consta na lista do perfil, adicionamos imediatamente
        const cachedToken = localStorage.getItem("device_fcm_token");
        if (cachedToken && user?.id) {
          const currentTokens = parseFcmTokens(profile?.fcm_token);
          if (!currentTokens.includes(cachedToken)) {
            const mergedTokens = mergeFcmTokens(profile?.fcm_token, cachedToken);
            console.log(`[Push FCM] Adicionando token do dispositivo em cache à lista do banco...`);
            await supabase.from("profiles").update({ fcm_token: mergedTokens }).eq("id", user.id);
          }
        }

        // Verificar permissões no telemóvel
        let permStatus = await pushPlugin.checkPermissions();
        if (permStatus.receive !== "granted") {
          console.log("[Push FCM] Solicitando permissão para geração de token nativo...");
          permStatus = await pushPlugin.requestPermissions();
        }

        if (permStatus.receive === "granted") {
          console.log("[Push FCM] Registrando dispositivo para obter/verificar token FCM...");
          await pushPlugin.register();
        } else {
          console.warn("[Push FCM] Permissão de notificações não concedida neste telemóvel.");
        }
      } catch (err) {
        console.error("[Push FCM] Erro ao verificar registro do telemóvel:", err);
      }
    };

    // Executar verificação imediatamente na entrada do app
    verifyAndRegisterDevice();

    // Re-verificar quando o app volta do segundo plano para primeiro plano
    let appStateListener: any = null;
    try {
      appStateListener = App.addListener("appStateChange", (state) => {
        if (state.isActive) {
          console.log("[Push FCM] App reativado em primeiro plano. Re-verificando token...");
          verifyAndRegisterDevice();
        }
      });
    } catch (e) {
      void e;
    }

    return () => {
      try {
        regHandle?.remove?.();
        regErrHandle?.remove?.();
        notifRecvHandle?.remove?.();
        notifActHandle?.remove?.();
        appStateListener?.remove?.();
      } catch (cleanErr) {
        void cleanErr;
      }
    };
  }, [user?.id, profile?.fcm_token]);

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
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={44}
          borderWidth={0.025}
          distortionScale={-20}
          backgroundOpacity={0.7}
          brightness={85}
          opacity={0.8}
          blur={6}
          className="border border-white/60 dark:border-white/10"
        >
          <div className="w-full flex items-center justify-around">
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
        </GlassSurface>
      </nav>

      <CallDiagnosticTerminal />
    </div>
  );
}
