import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
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
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: sub }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, trial_end, current_period_end, plan, scans_credits, ai_agent_enabled")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setSubscription(sub as Subscription | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
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
      if (s?.user) loadUserData(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.unsubscribe();
  }, []);

  // Realtime auto-refresh when subscription changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`auth-sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
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

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isPremiumBase =
    !!subscription &&
    (subscription.status === "active" ||
      (subscription.status === "trialing" &&
        !!subscription.trial_end &&
        new Date(subscription.trial_end) > new Date()));
  const isPremium = isAdmin || isPremiumBase;
  const isUnlimited = isAdmin;

  const value = useMemo(() => ({
    user,
    session,
    profile,
    subscription,
    isAdmin,
    isPremium,
    isUnlimited,
    loading,
    refresh,
    signOut,
  }), [user, session, profile, subscription, isAdmin, isPremium, isUnlimited, loading]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
