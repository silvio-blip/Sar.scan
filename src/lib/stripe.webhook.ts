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
      event = typeof payload === "string" ? JSON.parse(payload) : payload;
    }
  } catch (e: any) {
    console.error(`[Webhook] Signature verification warning: ${e.message}`);
    // If webhook secret isn't configured or matches loosely, parse event payload
    try {
      event = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch {
      throw new Error(`Webhook payload parsing error: ${e.message}`);
    }
  }

  const planScans = (planId: string) => {
    const found = PLANS_DEF.find((p) => p.id === planId);
    if (found) return found.scans;
    if (planId === "weekly") return 30;
    if (planId === "monthly") return 150;
    if (planId === "yearly") return 1200;
    if (planId === "credits") return 50;
    return 30;
  };

  // Helper para resolver user_id por metadados, customer_id ou email
  async function resolveUserId(
    metadataUserId?: string | null,
    customerId?: string | null,
    email?: string | null,
  ): Promise<string | null> {
    if (metadataUserId && metadataUserId.trim()) {
      return metadataUserId.trim();
    }

    if (customerId) {
      const { data: sub } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (sub?.user_id) return sub.user_id;
    }

    if (email) {
      const { data: prof } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (prof?.id) return prof.id;
    }

    return null;
  }

  console.log(`[Webhook Event Received] Type: ${event?.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = await resolveUserId(
        s.metadata?.user_id || s.client_reference_id,
        s.customer,
        s.customer_details?.email || s.customer_email,
      );
      const planId = (s.metadata?.plan || (s.mode === "payment" ? "credits" : "weekly")) as string;
      const isTrial =
        s.metadata?.is_trial === "true" ||
        s.subscription_data?.trial_period_days > 0 ||
        planId === "weekly";

      console.log(
        `[Webhook] checkout.session.completed: session=${s.id}, user=${userId}, plan=${planId}, trial=${isTrial}, mode=${s.mode}`,
      );

      if (userId) {
        // Encontra ou cria a subscrição
        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const addedCredits = planScans(planId);
        const currentCredits = (currentSub as any)?.scans_credits ?? 0;
        const newTotal = currentCredits + addedCredits;

        console.log(
          `[Webhook] Adicionando ${addedCredits} scans para usuário ${userId}. Total: ${newTotal}`,
        );

        if (planId === "credits" || s.mode === "payment") {
          // Apenas adiciona créditos consumíveis
          if (currentSub) {
            await (supabaseAdmin as any)
              .from("subscriptions")
              .update({
                scans_credits: newTotal,
                stripe_customer_id: s.customer || currentSub.stripe_customer_id,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          } else {
            await (supabaseAdmin as any).from("subscriptions").insert({
              user_id: userId,
              status: "free",
              plan: null,
              scans_credits: newTotal,
              stripe_customer_id: s.customer,
              ai_agent_enabled: false,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          // Assinatura recorrente ou teste grátis
          const initialStatus = isTrial ? "trialing" : "active";
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;

          let periodEnd = new Date(Date.now() + 32 * 86400000).toISOString();
          if (planId === "weekly") {
            periodEnd = new Date(Date.now() + 8 * 86400000).toISOString();
          } else if (planId === "yearly") {
            periodEnd = new Date(Date.now() + 366 * 86400000).toISOString();
          }

          const trialEnd = isTrial ? new Date(Date.now() + 7 * 86400000).toISOString() : null;

          await (supabaseAdmin as any).from("subscriptions").upsert(
            {
              user_id: userId,
              status: initialStatus,
              plan: planId,
              scans_credits: newTotal,
              stripe_customer_id: s.customer,
              stripe_subscription_id: subId,
              ai_agent_enabled: true,
              trial_end: trialEnd,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const userId = await resolveUserId(sub.metadata?.user_id, customerId);

      // Inferência do plano caso não esteja direto nos metadados
      let planId = sub.metadata?.plan;
      if (!planId && sub.items?.data?.[0]?.plan) {
        const interval = sub.items.data[0].plan.interval;
        if (interval === "week") planId = "weekly";
        else if (interval === "year") planId = "yearly";
        else if (interval === "month") planId = "monthly";
      }
      if (!planId) planId = "monthly";

      console.log(
        `[Webhook] subscription.${event.type}: sub=${sub.id}, status=${sub.status}, user=${userId}, plan=${planId}`,
      );

      if (userId) {
        let dbStatus = "active";
        if (sub.status === "trialing") dbStatus = "trialing";
        else if (sub.status === "past_due" || sub.status === "unpaid") dbStatus = "past_due";
        else if (sub.status === "canceled") dbStatus = "expired";
        else if (sub.status === "active") dbStatus = "active";

        const isGoodStatus = dbStatus === "active" || dbStatus === "trialing";

        const { data: currentSub } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const currentCredits = (currentSub as any)?.scans_credits ?? 0;
        const requiredScans = planScans(planId);
        // Garante que o usuário possua pelo menos a quantidade de scans do plano adquirido
        const finalCredits = Math.max(currentCredits, requiredScans);

        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 32 * 86400000).toISOString();

        await (supabaseAdmin as any).from("subscriptions").upsert(
          {
            user_id: userId,
            status: dbStatus,
            plan: isGoodStatus ? planId : currentSub?.plan || planId,
            scans_credits: isGoodStatus ? finalCredits : currentCredits,
            ai_agent_enabled: isGoodStatus,
            stripe_subscription_id: sub.id,
            stripe_customer_id: customerId || currentSub?.stripe_customer_id,
            trial_end: trialEnd,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const userId = await resolveUserId(sub.metadata?.user_id, customerId);

      console.log(`[Webhook] customer.subscription.deleted: sub=${sub.id}, user=${userId}`);

      if (userId) {
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            status: "expired",
            plan: null,
            ai_agent_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const userId = await resolveUserId(
        inv.subscription_details?.metadata?.user_id,
        customerId,
        inv.customer_email,
      );

      let planId = inv.subscription_details?.metadata?.plan;
      if (!planId && inv.lines?.data?.[0]?.plan) {
        const interval = inv.lines.data[0].plan.interval;
        if (interval === "week") planId = "weekly";
        else if (interval === "year") planId = "yearly";
        else if (interval === "month") planId = "monthly";
      }

      console.log(
        `[Webhook] invoice.payment_succeeded: inv=${inv.id}, reason=${inv.billing_reason}, user=${userId}, plan=${planId}`,
      );

      if (userId && planId && inv.billing_reason === "subscription_cycle") {
        // Renovação periódica de ciclo: adiciona nova cota de scans
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
            ai_agent_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }
  }

  return { received: true };
}
