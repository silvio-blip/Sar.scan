import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  const loadUserData = async (uid: string) => {
    try {
      const [{ data: prof }, { data: sub }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status, trial_end, current_period_end, plan, scans_credits, ai_agent_enabled")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      let typedSub = sub as Subscription | null;

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

      // Daily credits reset for free users (to exactly 3, once per day)
      if (uid && typedSub && (!typedSub.plan || typedSub.status === "free")) {
        const lastResetKey = `sar_last_reset_${uid}`;
        const today = new Date().toDateString();
        const lastReset = localStorage.getItem(lastResetKey);

        if (lastReset !== today) {
          console.log("[Auth] Daily credit reset triggered for user:", uid);
          localStorage.setItem(lastResetKey, today);
          if (typedSub.scans_credits < 3) {
            try {
              await supabase.from("subscriptions").update({ scans_credits: 3 }).eq("user_id", uid);
              typedSub.scans_credits = 3;
            } catch (err) {
              console.error("[Auth] Daily reset update error:", err);
            }
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

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error("[Auth] Get session error:", err);
      setLoading(false);
    });

    return () => sub.unsubscribe();
  }, []);

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
    await supabase.auth.signOut();
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
  const canAccessAI =
    isAdmin ||
    (isPremiumBase &&
      subscription?.plan !== "weekly" &&
      (subscription?.plan === "monthly" ||
        subscription?.plan === "yearly" ||
        subscription?.ai_agent_enabled ||
        !subscription?.plan)); // Allow access if plan is missing but status is active (admin manual toggle)

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
