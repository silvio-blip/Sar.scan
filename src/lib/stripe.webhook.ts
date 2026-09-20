import { supabaseAdmin } from "../integrations/supabase/client.server.js";
import { getStripe, PLANS_DEF } from "./stripe.server.js";

console.log("[Webhook] Module Loading...");

export async function handleStripeWebhook(payload: string, signature: string | null) {
  const { stripe, webhookSecret } = await getStripe();

  let event: any;
  try {
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    } else {
      event = JSON.parse(payload);
    }
  } catch (e: any) {
    throw new Error(`Webhook signature error: ${e.message}`);
  }

  const planScans = (planId: string) => PLANS_DEF.find((p) => p.id === planId)?.scans ?? 0;

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = s.metadata?.user_id;
      const planId = s.metadata?.plan;
      console.log(`[Webhook] Session Completed: ${s.id}, user: ${userId}, plan: ${planId}`);

      if (userId && planId) {
        // Encontra ou cria a subscrição
        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const addedCredits = planScans(planId) || (planId === "credits" ? 50 : 0);
        const currentCredits = (currentSub as any)?.scans_credits ?? 0;
        const newTotal = currentCredits + addedCredits;

        console.log(
          `[Webhook] Adding ${addedCredits} credits to user ${userId}. Total: ${newTotal}`,
        );

        if (planId === "credits") {
          // Apenas adiciona créditos sem sobrescrever o plano principal
          if (currentSub) {
            await (supabaseAdmin as any)
              .from("subscriptions")
              .update({
                scans_credits: newTotal,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          } else {
            await (supabaseAdmin as any).from("subscriptions").insert({
              user_id: userId,
              status: "free",
              plan: "free",
              scans_credits: newTotal,
              stripe_customer_id: s.customer,
              ai_agent_enabled: false,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          // Assinatura recorrente
          const initialStatus = "active";
          await (supabaseAdmin as any).from("subscriptions").upsert(
            {
              user_id: userId,
              status: initialStatus,
              plan: planId,
              scans_credits: newTotal,
              stripe_customer_id: s.customer,
              stripe_subscription_id: s.subscription,
              ai_agent_enabled: planId === "monthly" || planId === "yearly",
              current_period_end: new Date(Date.now() + 32 * 86400000).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        }
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      const planId = sub.metadata?.plan;

      console.log(
        `[Webhook] Subscription Update: ${sub.id}, status: ${sub.status}, user: ${userId}`,
      );

      if (userId && planId) {
        let dbStatus = "active";
        if (sub.status === "trialing") dbStatus = "trialing";
        else if (sub.status === "past_due" || sub.status === "unpaid") dbStatus = "past_due";
        else if (sub.status === "canceled") dbStatus = "expired";
        else if (sub.status === "active") dbStatus = "active";

        const canUseAi =
          (planId === "monthly" || planId === "yearly") &&
          (dbStatus === "active" || dbStatus === "trialing");

        console.log(`[Webhook] Updating DB Status: ${dbStatus}, AI: ${canUseAi}`);

        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: dbStatus,
            plan: planId,
            ai_agent_enabled: canUseAi,
            stripe_subscription_id: sub.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: "expired",
            ai_agent_enabled: false,
          })
          .eq("user_id", userId);
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object;
      // billing_reason indicate recurring payment?
      const userId = inv.subscription_details?.metadata?.user_id;
      const planId = inv.subscription_details?.metadata?.plan;

      // Se for pagamento recorrente (não o primeiro que já foi tratado no checkout), adicionamos créditos
      if (userId && planId && inv.billing_reason === "subscription_cycle") {
        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("scans_credits")
          .eq("user_id", userId)
          .maybeSingle();

        const currentCredits = (currentSub as any)?.scans_credits ?? 0;
        const addedScans = planScans(planId);

        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: "active",
            scans_credits: currentCredits + addedScans,
            ai_agent_enabled: planId === "monthly" || planId === "yearly", // Renovação de ciclo = active
          })
          .eq("user_id", userId);
      }
      break;
    }
  }

  return "ok";
}
