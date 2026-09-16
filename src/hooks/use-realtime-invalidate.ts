import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRewardsRealtime(userId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`rewards-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rewards", filter: `user_id=eq.${userId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["rewards", userId] });
          qc.invalidateQueries({ queryKey: ["scan_usage", userId] });
          if (payload.eventType === "INSERT") {
            const r = payload.new as { titulo?: string; bonus_scans?: number };
            toast.success(`🎁 Nova recompensa: ${r.titulo ?? "Parabéns!"}`, {
              description: r.bonus_scans ? `+${r.bonus_scans} scans bônus` : undefined,
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
}

export function useSubscriptionRealtime(userId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`subs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["auth-subscription", userId] });
          window.dispatchEvent(new CustomEvent("auth:refresh"));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_usage", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["scan_usage"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
}
