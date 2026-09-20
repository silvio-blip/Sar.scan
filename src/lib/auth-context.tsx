import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  isCapacitor,
  syncGooglePlayPrices,
  syncSubscriptionStatusOnBackend,
} from "./google-play.functions";

type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  peso: number | null;
  altura: number | null;
  idade: number | null;
  objetivo: "perder" | "manter" | "ganhar" | null;
  onboarding_done: boolean;
  meta_calorias: number | null;
  meta_agua: number | null;
  meta_prazo: string | null;
  fcm_token: string | null;
};

type Subscription = {
  status: "free" | "trialing" | "active" | "expired";
  trial_end: string | null;
  current_period_end: string | null;
  plan: "weekly" | "monthly" | "yearly" | null;
  scans_credits: number;
  ai_agent_enabled: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  isPremium: boolean;
  isUnlimited: boolean;
  canAccessAI: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const expiredUpdatesInProgress = new Set<string>();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const lastSyncTimeRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  const loadUserData = async (uid: string) => {
    try {
      // Evita loops infinitos e garante sincronização ativa direta (máximo uma chamada ativa a cada 30 segundos)
      const nowTime = Date.now();
      if (
        session?.access_token &&
        !isSyncingRef.current &&
        nowTime - lastSyncTimeRef.current > 30000
      ) {
        isSyncingRef.current = true;
        try {
          await syncSubscriptionStatusOnBackend(session.access_token);
          lastSyncTimeRef.current = Date.now();
        } catch (syncErr) {
          console.warn("[Auth] Falha ao sincronizar assinatura de forma ativa:", syncErr);
        } finally {
          isSyncingRef.current = false;
        }
      }

      const [{ data: prof }, { data: sub }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      let typedSub = sub as Subscription | null;

      // 1. Novo utilizador logado pela primeira vez: criar registro gratuito
      if (!typedSub) {
        console.log(
          "[Auth] Novo utilizador detectado. Criando conta inicial gratuita (3 scans diários)...",
        );
        const initialFreeSub = {
          user_id: uid,
          status: "free",
          trial_end: null,
          plan: null,
          ai_agent_enabled: false,
          scans_credits: 3,
        };

        try {
          const { data: created, error: createErr } = await supabase
            .from("subscriptions")
            .upsert(initialFreeSub)
            .select("status, trial_end, current_period_end, plan, scans_credits, ai_agent_enabled")
            .single();

          if (!createErr && created) {
            typedSub = created as Subscription;
          } else {
            typedSub = initialFreeSub as Subscription;
          }
        } catch (initErr) {
          console.error("[Auth] Erro ao criar registro inicial:", initErr);
          typedSub = initialFreeSub as Subscription;
        }
      }

      // 2. Verificar se o período de teste de 7 dias expirou
      if (typedSub && typedSub.status === "trialing" && typedSub.trial_end) {
        const trialExpired = new Date(typedSub.trial_end) < new Date();
        if (trialExpired) {
          console.log("[Auth] Teste grátis de 7 dias expirou. Migrando para status free...");
          try {
            await supabase
              .from("subscriptions")
              .update({ status: "free", plan: null, ai_agent_enabled: false })
              .eq("user_id", uid);
            typedSub = {
              ...typedSub,
              status: "free",
              plan: null,
              ai_agent_enabled: false,
            };
          } catch (err) {
            console.error("[Auth] Erro ao expirar teste grátis:", err);
          }
        }
      }

      // 3. Verificar se assinatura ativa expirou
      if (typedSub && typedSub.status === "active" && typedSub.current_period_end) {
        const expired = new Date(typedSub.current_period_end) < new Date();
        if (expired) {
          if (!expiredUpdatesInProgress.has(uid)) {
            expiredUpdatesInProgress.add(uid);
            console.log("[Auth] Subscription has expired dynamically. Updating database state...");
            try {
              await supabase
                .from("subscriptions")
                .update({ status: "free", plan: null, ai_agent_enabled: false })
                .eq("user_id", uid);
            } catch (err) {
              console.error("[Auth] Fail to update expired subscription in database:", err);
            } finally {
              expiredUpdatesInProgress.delete(uid);
            }
          }
          typedSub = {
            ...typedSub,
            status: "free",
            plan: null,
            ai_agent_enabled: false,
            scans_credits: typedSub.scans_credits,
          };
        }
      }

      setProfile(prof as Profile | null);
      setSubscription(typedSub);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));

      // Daily credits reset for free users (to exactly 3, once per day based on DB updated_at)
      if (uid && typedSub && (!typedSub.plan || typedSub.status === "free")) {
        const today = new Date().toDateString();
        const lastDbDate = typedSub.updated_at ? new Date(typedSub.updated_at).toDateString() : "";

        if (lastDbDate !== today && typedSub.scans_credits < 3) {
          console.log("[Auth] Daily credit reset triggered from DB state for user:", uid);
          try {
            await supabase
              .from("subscriptions")
              .update({ scans_credits: 3, updated_at: new Date().toISOString() })
              .eq("user_id", uid);
            typedSub.scans_credits = 3;
          } catch (err) {
            console.error("[Auth] Daily reset update error:", err);
          }
        }
      }
    } catch (err) {
      console.error("[Auth] Error loading user data:", err);
    }
  };

  useEffect(() => {
    const {
      data: { subscription: sub },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null);
        setSubscription(null);
        setIsAdmin(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadUserData(s.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Auth] Get session error:", err);
        setLoading(false);
      });

    return () => sub.unsubscribe();
  }, []);

  // Automatic background price re-scanning (Google Play) & subscription status verification
  useEffect(() => {
    if (isCapacitor()) {
      syncGooglePlayPrices().catch((e) =>
        console.warn("[Auth] Background Play Store price scan:", e),
      );
    }
    if (session?.access_token) {
      syncSubscriptionStatusOnBackend(session.access_token).catch((e) =>
        console.warn("[Auth] Background subscription status check:", e),
      );
    }
  }, [session?.access_token]);

  // Realtime auto-refresh when subscription or profile changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`auth-sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => loadUserData(user.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => loadUserData(user.id),
      )
      .subscribe();
    const onRefresh = () => loadUserData(user.id);
    window.addEventListener("auth:refresh", onRefresh);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("auth:refresh", onRefresh);
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (user) await loadUserData(user.id);
  }, [user]);

  const signOut = useCallback(async () => {
    // 1. Instantly unlock DOM and pointer events in case modal dialogs were open
    if (typeof document !== "undefined") {
      document.body.style.pointerEvents = "auto";
      document.body.removeAttribute("data-scroll-locked");
      const root = document.getElementById("root");
      if (root) {
        root.removeAttribute("aria-hidden");
        root.style.pointerEvents = "auto";
      }
    }

    // 2. Clear Supabase auth keys from localStorage synchronously
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase.auth"))) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (storageErr) {
      console.warn("[Auth] Error clearing storage on signOut:", storageErr);
    }

    // 3. Trigger Supabase server signout
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[Auth] SignOut call error:", e);
    }

    // 4. Clean redirect to /login via full page navigation to reset state
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const isPremiumBase =
    !!subscription &&
    (subscription.status === "active" ||
      (subscription.status === "trialing" &&
        !!subscription.trial_end &&
        new Date(subscription.trial_end) > new Date()));

  // Admin always premium and unlimited
  const isPremium = isAdmin || isPremiumBase;
  const isUnlimited = isAdmin;

  // New logic: Weekly plan does NOT get AI Agent access. Only Monthly and Yearly (or manual enabled)
  const rawPlan = subscription?.plan || null;
  const plan = rawPlan ? rawPlan.replace("_cancelled", "") : null;
  const canAccessAI = true;

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      subscription,
      isAdmin,
      isPremium,
      isUnlimited,
      canAccessAI,
      loading,
      refresh,
      signOut,
    }),
    [
      user,
      session,
      profile,
      subscription,
      isAdmin,
      isPremium,
      isUnlimited,
      canAccessAI,
      loading,
      refresh,
      signOut,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
