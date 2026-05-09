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
      const userId = s.metadata?.user_id;
      const plan = s.metadata?.plan;
      if (userId && plan) {
        await (supabaseAdmin as any).from("subscriptions").upsert(
          {
            user_id: userId,
            status: "active",
            plan,
            scans_credits: planScans(plan),
            ai_agent_enabled: plan !== "weekly",
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
      const plan = sub.metadata?.plan;
      if (userId && plan) {
        const status =
          sub.status === "active" || sub.status === "trialing" ? sub.status : "expired";
        await (supabaseAdmin as any).from("subscriptions").upsert(
          {
            user_id: userId,
            status,
            plan,
            scans_credits: planScans(plan),
            ai_agent_enabled: plan !== "weekly",
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await (supabaseAdmin as any).from("subscriptions").upsert(
          {
            user_id: userId,
            status: "expired",
            scans_credits: 0,
            ai_agent_enabled: false,
          },
          { onConflict: "user_id" },
        );
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object;
      const userId = inv.subscription_details?.metadata?.user_id;
      const plan = inv.subscription_details?.metadata?.plan;
      if (userId && plan) {
        // Renova créditos no início de cada ciclo
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: "active",
            scans_credits: planScans(plan),
          })
          .eq("user_id", userId);
      }
      break;
    }
  }

  return "ok";
}
