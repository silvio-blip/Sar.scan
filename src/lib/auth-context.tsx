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
import { getApiUrl } from "./utils";

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
  campaign_applied?: boolean;
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
  isCampaignAiActive: boolean;
  campaignAiExpirationDate: Date | null;
  campaignSettings: {
    enabled: boolean;
    startDate: string;
    endDate: string;
    bonusScans: number;
    freeAiDays: number;
  };
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const expiredUpdatesInProgress = new Set<string>();

const CAMPAIGN_STORAGE_KEY = "sar_scan_campaign_cache";

function getCachedCampaignSettings() {
  if (typeof window === "undefined") {
    return {
      enabled: false,
      startDate: "",
      endDate: "",
      bonusScans: 0,
      freeAiDays: 0,
    };
  }
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.debug("[Auth] Erro ao ler cache de campanha:", e);
  }
  return {
    enabled: false,
    startDate: "",
    endDate: "",
    bonusScans: 0,
    freeAiDays: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [campaignSettings, setCampaignSettings] = useState(getCachedCampaignSettings);
  const [loading, setLoading] = useState(true);

  const lastSyncTimeRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const isExecutingRef = useRef<boolean>(false);
  const hasPendingRef = useRef<boolean>(false);

  const loadUserData = async (uid: string) => {
    if (isExecutingRef.current) {
      hasPendingRef.current = true;
      return;
    }
    isExecutingRef.current = true;

    try {
      // Carrega dados essenciais do usuário e configurações de campanha em paralelo com máxima velocidade
      const [sessionRes, profRes, subRes, rolesRes, settingsRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase
          .from("app_settings")
          .select("key, value")
          .in("key", [
            "campaign_enabled",
            "campaign_start_date",
            "campaign_end_date",
            "campaign_bonus_scans",
            "campaign_free_ai_days",
          ]),
      ]);

      const currentToken = sessionRes.data?.session?.access_token || session?.access_token;
      const prof = profRes.data;
      const sub = subRes.data;
      const roles = rolesRes.data;
      const settings = settingsRes.data;

      // Executa sincronização de status em background se necessário sem bloquear a UI inicial
      const nowTime = Date.now();
      if (currentToken && !isSyncingRef.current && nowTime - lastSyncTimeRef.current > 30000) {
        isSyncingRef.current = true;
        syncSubscriptionStatusOnBackend(currentToken)
          .then(() => {
            lastSyncTimeRef.current = Date.now();
          })
          .catch((syncErr) => {
            console.warn("[Auth] Falha ao sincronizar assinatura de forma ativa:", syncErr);
          })
          .finally(() => {
            isSyncingRef.current = false;
          });
      }

      let typedSub = sub as Subscription | null;

      // Buscar e persistir configurações da Campanha
      let campEnabled = false;
      let campStart = "";
      let campEnd = "";
      let campBonus = 0;
      let campAiDays = 0;

      if (settings) {
        settings.forEach((r) => {
          if (r.key === "campaign_enabled") campEnabled = r.value === "true";
          if (r.key === "campaign_start_date") campStart = r.value;
          if (r.key === "campaign_end_date") campEnd = r.value;
          if (r.key === "campaign_bonus_scans") campBonus = parseInt(r.value) || 0;
          if (r.key === "campaign_free_ai_days") campAiDays = parseInt(r.value) || 0;
        });

        const newCampSettings = {
          enabled: campEnabled,
          startDate: campStart,
          endDate: campEnd,
          bonusScans: campBonus,
          freeAiDays: campAiDays,
        };

        setCampaignSettings(newCampSettings);
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(newCampSettings));
          }
        } catch (saveErr) {
          console.debug("[Auth] Erro ao salvar cache de campanha:", saveErr);
        }
      }

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

      // 1.5. Se o registro gratuito já existe (criado pelo trigger do DB), mas o utilizador é novo e tem 0 créditos, inicializar com 3
      if (
        typedSub &&
        (!typedSub.plan || typedSub.status === "free") &&
        typedSub.scans_credits === 0
      ) {
        try {
          const { data: usages } = await supabase
            .from("scan_usage")
            .select("count")
            .eq("user_id", uid);
          const totalScansMade = usages?.reduce((sum, item) => sum + (item.count || 0), 0) ?? 0;

          if (totalScansMade === 0) {
            console.log(
              "[Auth] Novo utilizador com 0 scans detetado. Inicializando com 3 scans de boas-vindas...",
            );
            await supabase
              .from("subscriptions")
              .update({ scans_credits: 3, updated_at: new Date().toISOString() })
              .eq("user_id", uid);
            typedSub.scans_credits = 3;
          }
        } catch (initErr) {
          console.error("[Auth] Erro ao inicializar 3 scans do utilizador novo:", initErr);
        }
      }

      // 1.7. Verificar e aplicar de forma atômica o bônus de campanha no servidor
      if (typedSub && campEnabled && campStart && campEnd && campBonus > 0 && currentToken) {
        try {
          const campRes = await fetch(getApiUrl("/api/campaign/apply"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentToken}`,
            },
          });
          if (campRes.ok) {
            const campData = await campRes.json();
            if (campData.totalCredits !== undefined) {
              typedSub.scans_credits = campData.totalCredits;
            }
            if (campData.applied) {
              typedSub.campaign_applied = true;
            } else if (campData.alreadyApplied) {
              typedSub.campaign_applied = true;
            }
          }
        } catch (campErr) {
          console.warn("[Auth] Aviso ao sincronizar bônus de campanha:", campErr);
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
    } finally {
      isExecutingRef.current = false;
      if (hasPendingRef.current) {
        hasPendingRef.current = false;
        setTimeout(() => {
          loadUserData(uid);
        }, 150);
      }
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

    // 2. Trigger Supabase server signout asynchronously (do not await to prevent blocking/hanging if offline or in-flight)
    try {
      supabase.auth.signOut().catch((e) => {
        console.warn("[Auth] Background SignOut call error:", e);
      });
    } catch (e) {
      console.warn("[Auth] SignOut trigger error:", e);
    }

    // 3. Clear Supabase auth keys from localStorage synchronously
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

    // 4. Clean redirect to /login via full page navigation to reset state instantly
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

  // Verify if campaign-based free AI is active for this user
  const isCampaignAiActive = useMemo(() => {
    if (!profile || !campaignSettings.enabled) return false;
    if (!campaignSettings.startDate || !campaignSettings.endDate) return false;

    const parseDateResilient = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 0;
      if (
        dateStr.includes("T") &&
        !dateStr.endsWith("Z") &&
        !dateStr.includes("+") &&
        !dateStr.includes("-")
      ) {
        return new Date(dateStr + ":00Z").getTime();
      }
      return new Date(dateStr).getTime();
    };

    const regTime = parseDateResilient(profile.created_at);
    const startTime = parseDateResilient(campaignSettings.startDate);
    const endTime = parseDateResilient(campaignSettings.endDate);

    if (regTime >= startTime && regTime <= endTime) {
      const msSinceReg = Date.now() - regTime;
      const daysSinceReg = msSinceReg / (1000 * 60 * 60 * 24);
      return daysSinceReg <= (campaignSettings.freeAiDays || 7);
    }
    return false;
  }, [profile, campaignSettings]);

  // Calculate precise expiration date of campaign free AI access
  const campaignAiExpirationDate = useMemo(() => {
    if (!profile || !campaignSettings.enabled) return null;
    if (!campaignSettings.startDate || !campaignSettings.endDate) return null;

    const parseDateResilient = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 0;
      if (
        dateStr.includes("T") &&
        !dateStr.endsWith("Z") &&
        !dateStr.includes("+") &&
        !dateStr.includes("-")
      ) {
        return new Date(dateStr + ":00Z").getTime();
      }
      return new Date(dateStr).getTime();
    };

    const regTime = parseDateResilient(profile.created_at);
    const startTime = parseDateResilient(campaignSettings.startDate);
    const endTime = parseDateResilient(campaignSettings.endDate);

    if (regTime >= startTime && regTime <= endTime) {
      const expiryTime = regTime + (campaignSettings.freeAiDays || 7) * 24 * 60 * 60 * 1000;
      return new Date(expiryTime);
    }
    return null;
  }, [profile, campaignSettings]);

  // AI Chat is gated for free users, UNLESS they are Admin, have an active Premium plan, or are in an active Campaign Free AI window
  const hasPlan =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    (subscription.plan === "weekly" ||
      subscription.plan === "monthly" ||
      subscription.plan === "yearly" ||
      subscription.plan === "semanal" ||
      subscription.plan === "mensal" ||
      subscription.plan === "anual");

  const canAccessAI = Boolean(isAdmin || hasPlan || isCampaignAiActive);

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
      isCampaignAiActive,
      campaignAiExpirationDate,
      campaignSettings,
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
      isCampaignAiActive,
      campaignAiExpirationDate,
      campaignSettings,
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
