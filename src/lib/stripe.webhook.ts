import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, PLANS_DEF } from "@/lib/stripe.server";

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
      console.log(`[Webhook] Checkout completed: ${s.id}, user: ${s.metadata?.user_id}`);
      const userId = s.metadata?.user_id;
      const planId = s.metadata?.plan;
      if (userId && planId) {
        // Obter créditos atuais para somar
        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("scans_credits")
          .eq("user_id", userId)
          .maybeSingle();
        
        const currentCredits = (currentSub as any)?.scans_credits ?? 0;
        const newCredits = currentCredits + planScans(planId);
        console.log(`[Webhook] Adding ${planScans(planId)} credits to user ${userId}. New total: ${newCredits}`);

        await (supabaseAdmin as any).from("subscriptions").upsert(
          {
            user_id: userId,
            status: s.subscription ? "active" : "free", // Se for checkout de sessão sem sub?? mas aqui é subscription mode
            plan: planId,
            scans_credits: newCredits,
            // IA apenas se não for semanal e NÃO estiver em trial (no checkout inicial pode estar trialing)
            // Mas o status real vem do evento customer.subscription.created/updated
            ai_agent_enabled: false, 
            stripe_customer_id: s.customer,
            stripe_subscription_id: s.subscription,
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      const planId = sub.metadata?.plan;
      if (userId && planId) {
        const isTrialing = sub.status === "trialing";
        const status = (sub.status === "active" || isTrialing) ? sub.status : "expired";
        
        // IA liberada apenas se for Plano Mensal/Anual E o status for 'active' (terminou trial)
        const canUseAi = (planId === "monthly" || planId === "yearly") && status === "active";

        await (supabaseAdmin as any).from("subscriptions").update(
          {
            status,
            plan: planId,
            ai_agent_enabled: canUseAi,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          }
        ).eq("user_id", userId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await (supabaseAdmin as any).from("subscriptions").update(
          {
            status: "expired",
            ai_agent_enabled: false,
          }
        ).eq("user_id", userId);
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
