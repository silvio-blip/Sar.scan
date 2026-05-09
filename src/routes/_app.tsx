import { createFileRoute, Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Search, History, User, MessagesSquare, BarChart3, Loader2, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("sar_scan_intro_done");
    }
    return true;
  });

  const handleIntroDone = () => {
    setShowIntro(false);
    sessionStorage.setItem("sar_scan_intro_done", "true");
  };

  usePrefetchPopularFoods(!!user && !!profile?.onboarding_done);

  if (loading)
    return (
      <div className="min-h-screen bg-black grid place-items-center">
        <Loader2 className="size-12 animate-spin text-white" />
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (profile && !profile.onboarding_done) return <Navigate to="/onboarding" />;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center">
      {showIntro && <IntroAnimation onDone={handleIntroDone} />}

      <main className="flex-1 w-full max-w-[480px] bg-black/40 px-6 pt-12 pb-40 overflow-hidden relative shadow-2xl border-x border-white/5">
        {/* Subtle monochrome glow at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-white/5 blur-[100px] pointer-events-none" />

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,420px)] px-4">
        <div className="glass-strong rounded-[40px] px-3 py-3 flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
          {tabs.map(({ to, Icon, label }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={`relative flex items-center justify-center size-14 rounded-2xl transition-all duration-500 ${
                  active
                    ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-110"
                    : "text-white/20 hover:text-white/60"
                }`}
              >
                <Icon className="size-6" strokeWidth={active ? 3 : 2} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
