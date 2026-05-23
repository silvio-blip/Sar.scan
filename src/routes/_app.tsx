import { createFileRoute, Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera,
  Search,
  History,
  User,
  MessagesSquare,
  BarChart3,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SarLogo } from "@/components/sar-logo";
import { IntroAnimation } from "@/components/intro-animation";

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
  const [showIntro, setShowIntro] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"buttons" | "infinite">("infinite");

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

    const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (isCapacitor) {
      const cap = (window as any).Capacitor;
      const { PushNotifications } = cap.Plugins || {};
      if (PushNotifications) {
        console.log("[Push] Inicializando registro de notificações no dispositivo...");
        PushNotifications.requestPermissions().then((result: any) => {
          if (result.receive === "granted") {
            PushNotifications.register();
          } else {
            console.warn("[Push] Permissões de notificação negadas.");
          }
        });

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
        });
      }
    }
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
