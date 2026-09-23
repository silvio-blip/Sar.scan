import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, useRef, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Search, User, Sparkles, ShoppingBag, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import GlassSurface from "@/components/GlassSurface";
import { App } from "@capacitor/app";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function usePrefetchPopularFoods(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      qc.prefetchQuery({
        queryKey: ["foods_popular"],
        staleTime: 1000 * 60 * 60 * 24,
        queryFn: async () => {
          const { data: cached } = await supabase
            .from("foods_basic")
            .select("nome, cal, carb, prot, gord, foto_url")
            .limit(100);
          if (cached && cached.length >= 50)
            return cached.map((c) => ({ ...c, porcao: "1 porção" }));
          const { data } = await supabase.functions.invoke("search-food-ai", {
            body: { mode: "popular" },
          });
          return data?.alimentos ?? [];
        },
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [enabled, qc]);
}

const tabs = [
  { to: "/scanner", label: "Scanner", Icon: Camera },
  { to: "/buscar", label: "Buscar", Icon: Search },
  { to: "/premium", label: "Loja", Icon: ShoppingBag },
  { to: "/perfil", label: "Perfil", Icon: User },
  { to: "/chat", label: "Nutricionista", Icon: Sparkles },
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

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  const router = useRouter();
  const navigate = useNavigate();

  const mainRef = useRef<HTMLElement>(null);
  const currentTabIdx = tabs.findIndex((t) => {
    if (t.to === "/perfil") {
      return loc.pathname.startsWith("/perfil") || loc.pathname.startsWith("/diario");
    }
    return loc.pathname.startsWith(t.to);
  });
  const isTopLevel = ROOT_ALLOWED_PATHS.has(loc.pathname);
  const isChatRoute = loc.pathname.startsWith("/chat");

  // Bottom navigation is hidden on chat page (which has its own back button)
  const isNavVisible = !isChatRoute;

  // Touch tracking for top-level tab horizontal swipe gestures
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || isChatRoute) return;
    if (document.querySelector("[role='dialog'], [data-state='open'], .fixed.inset-0")) {
      touchStartRef.current = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, canvas, video, [role='slider'], [data-no-swipe], .no-swipe, [data-category-bar], .overflow-x-auto, [class*='overflow-x']",
      )
    ) {
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
    if (!touchStartRef.current || isChatRoute) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, canvas, video, [role='slider'], [data-no-swipe], .no-swipe, [data-category-bar], .overflow-x-auto, [class*='overflow-x']",
      )
    ) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Top-level horizontal swipe between tabs (only when on exact root tabs)
    const isExactRoot = tabs.some((t) => t.to === loc.pathname || t.to + "/" === loc.pathname);
    if (isTopLevel && isExactRoot) {
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6 && elapsed < 450) {
        if (currentTabIdx !== -1) {
          if (deltaX < 0) {
            const nextIdx = (currentTabIdx + 1) % tabs.length;
            navigate({ to: tabs[nextIdx].to });
          } else if (deltaX > 0) {
            const prevIdx = (currentTabIdx - 1 + tabs.length) % tabs.length;
            navigate({ to: tabs[prevIdx].to });
          }
        }
      }
    }
  };

  useEffect(() => {
    let handle: any = null;
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      try {
        App.addListener("backButton", ({ canGoBack }: { canGoBack?: boolean }) => {
          if (canGoBack) {
            router.history.back();
          } else {
            App.exitApp();
          }
        })
          .then((h: any) => {
            handle = h;
          })
          .catch((err: any) => console.warn("Erro backButton listener:", err));
      } catch (e) {
        console.warn("Capacitor App listener não disponível:", e);
      }
    }
    return () => {
      if (handle && typeof handle.remove === "function") {
        handle.remove();
      }
    };
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

    const root = document.documentElement;
    if (mode === "buttons") {
      root.style.setProperty("--android-bottom-offset", "16px");
      root.style.setProperty("--android-nav-bottom", "16px");
      root.style.setProperty("--main-padding-bottom", "110px");
    } else {
      root.style.setProperty("--android-bottom-offset", "28px");
      root.style.setProperty("--android-nav-bottom", "28px");
      root.style.setProperty("--main-padding-bottom", "130px");
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const requestCorePermissions = async () => {
      const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      const cap = isCap ? (window as any).Capacitor : null;

      // Só tenta registrar notificações se o utilizador ativou explicitamente
      if (localStorage.getItem("push_notifications_active") !== "true") {
        return;
      }
      if (isCap) {
        const { PushNotifications } = cap.Plugins || {};
        if (PushNotifications && typeof PushNotifications.checkPermissions === "function") {
          try {
            const check = await PushNotifications.checkPermissions();
            if (check?.receive === "granted") {
              await PushNotifications.register().catch((err: any) => {
                console.warn("[Push] FCM registration skipped:", err);
              });
            }
          } catch (err) {
            console.warn("[Push] Notificações Push não configuradas:", err);
          }
        }
      }
    };

    requestCorePermissions();
  }, [user]);

  useEffect(() => {
    const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    let receivedHandle: any = null;
    let actionHandle: any = null;

    if (isCapacitor && localStorage.getItem("push_notifications_active") === "true") {
      const cap = (window as any).Capacitor;
      const { PushNotifications } = cap.Plugins || {};
      if (PushNotifications && typeof PushNotifications.addListener === "function") {
        PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          toast.message(`💬 ${notification.title || "Nova mensagem"}`, {
            description: notification.body || "Toque para visualizar",
          });
        })
          .then((h: any) => {
            receivedHandle = h;
          })
          .catch((err: any) => console.warn("[Push] listener error:", err));

        PushNotifications.addListener("pushNotificationActionPerformed", () => {
          try {
            router.navigate({ to: "/chat" });
          } catch (routeErr) {
            console.error("[Push] Erro ao redirecionar para o chat:", routeErr);
          }
        })
          .then((h: any) => {
            actionHandle = h;
          })
          .catch((err: any) => console.warn("[Push] action error:", err));
      }
    }

    return () => {
      if (receivedHandle && typeof receivedHandle.remove === "function") {
        receivedHandle.remove();
      }
      if (actionHandle && typeof actionHandle.remove === "function") {
        actionHandle.remove();
      }
    };
  }, [user, router]);

  usePrefetchPopularFoods(!!user && !!profile?.onboarding_done);

  useEffect(() => {
    const t = setTimeout(() => {
      router.preloadRoute({ to: "/buscar" }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [router]);

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
      <main
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          paddingTop: isChatRoute ? "0px" : "max(1.75rem, env(safe-area-inset-top, 28px))",
          paddingBottom: isChatRoute
            ? "0px"
            : "max(var(--main-padding-bottom, 120px), calc(var(--main-padding-bottom, 120px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className={`flex-1 w-full max-w-[480px] bg-card ${
          isChatRoute
            ? "pt-0 border-none shadow-none"
            : "pt-4 sm:pt-6 border-x border-border shadow-xl"
        } relative min-h-screen flex flex-col`}
      >
        <div
          className={`w-full flex-1 flex flex-col min-h-0 ${isChatRoute ? "px-0" : "px-4 sm:px-6"}`}
        >
          <Suspense
            fallback={
              <div className="flex-1 grid place-items-center py-24">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <motion.nav
        initial={false}
        animate={{
          y: isNavVisible ? 0 : 130,
          opacity: isNavVisible ? 1 : 0,
          pointerEvents: isNavVisible ? "auto" : "none",
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 32,
          mass: 0.45,
        }}
        style={{
          bottom:
            "max(var(--android-nav-bottom, 20px), calc(var(--android-nav-bottom, 20px) + env(safe-area-inset-bottom, 0px)))",
        }}
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[min(94vw,440px)] px-2 transform-gpu"
      >
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={32}
          backgroundOpacity={0.15}
          saturation={1.2}
          distortionScale={-80}
          className="w-full shadow-[0_16px_36px_-6px_rgba(0,0,0,0.18)] overflow-hidden"
        >
          <div className="w-full grid grid-cols-5 items-center p-1 relative z-10">
            {tabs.map(({ to, Icon, label }) => {
              const active =
                loc.pathname.startsWith(to) ||
                (to === "/perfil" && loc.pathname.startsWith("/diario"));
              return (
                <Link
                  key={to}
                  to={to}
                  preload="intent"
                  onMouseEnter={() => {
                    if (to === "/buscar") router.preloadRoute({ to: "/buscar" });
                  }}
                  onTouchStart={() => {
                    if (to === "/buscar") router.preloadRoute({ to: "/buscar" });
                  }}
                  aria-label={label}
                  className={`relative flex items-center justify-center h-12 rounded-[20px] transition-all duration-150 transform-gpu active:scale-95 ${
                    active
                      ? "text-white"
                      : "text-black dark:text-black opacity-75 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="active-navbar-indicator"
                      className="absolute inset-0 bg-primary rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                      transition={{
                        type: "spring",
                        stiffness: 460,
                        damping: 34,
                        mass: 0.4,
                      }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 size-5 transition-transform duration-150 ${
                      active ? "text-white" : "text-black dark:text-black"
                    }`}
                    strokeWidth={active ? 2.8 : 2.2}
                    color={active ? "#ffffff" : "#000000"}
                  />
                </Link>
              );
            })}
          </div>
        </GlassSurface>
      </motion.nav>
    </div>
  );
}
