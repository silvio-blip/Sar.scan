import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let _cached: { stripe: Stripe; secret: string; webhookSecret: string } | null = null;

async function loadKeys() {
  const { data, error } = await (supabaseAdmin as any)
    .from("app_settings")
    .select("key, value")
    .in("key", ["stripe_secret_key", "stripe_webhook_secret"]);
  if (error) throw new Error(`app_settings read failed: ${error.message}`);
  const map = Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  );
  const secret = (map.stripe_secret_key as string) ?? "";
  if (!secret) throw new Error("stripe_secret_key not set in app_settings");
  return { secret, webhookSecret: (map.stripe_webhook_secret as string) ?? "" };
}

export async function getStripe() {
  if (_cached) return _cached;
  const { secret, webhookSecret } = await loadKeys();
  const stripe = new Stripe(secret, { apiVersion: "2025-09-30.clover" as any });
  _cached = { stripe, secret, webhookSecret };
  return _cached;
}

export const PLANS_DEF = [
  { id: "weekly", label: "sar.sacn Semanal", amount: 499, interval: "week", scans: 30 },
  { id: "monthly", label: "sar.sacn Mensal", amount: 1999, interval: "month", scans: 150 },
  { id: "yearly", label: "sar.sacn Anual", amount: 9900, interval: "year", scans: 1200 },
] as const;
export type PlanId = (typeof PLANS_DEF)[number]["id"];

export async function syncStripePlansInternal(data: { token: string }) {
  const user = await authUser(data.token);
  const { data: roles } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = !!(roles as { role: string }[] | null)?.some((r) => r.role === "admin");
  if (!isAdmin) throw new Error("Apenas admin pode sincronizar planos");

  const { stripe } = await getStripe();
  const results: { plan: string; productId: string; priceId: string }[] = [];
  for (const plan of PLANS_DEF) {
    const { data: existing } = await (supabaseAdmin as any)
      .from("stripe_products")
      .select("*")
      .eq("plan", plan.id)
      .maybeSingle();

    const existingTyped = existing as {
      product_id?: string;
      price_id?: string;
      amount?: number;
    } | null;
    let productId = existingTyped?.product_id;
    let priceId = existingTyped?.price_id;

    if (!productId) {
      const product = await stripe.products.create({
        name: plan.label,
        metadata: { plan: plan.id, scans: String(plan.scans) },
      });
      productId = product.id;
    }
    if (!priceId || existingTyped?.amount !== plan.amount) {
      const price = await stripe.prices.create({
        product: productId!,
        unit_amount: plan.amount,
        currency: "eur",
        recurring: { interval: plan.interval as any },
      });
      priceId = price.id;
    }
    await (supabaseAdmin as any).from("stripe_products").upsert({
      plan: plan.id,
      product_id: productId,
      price_id: priceId,
      amount: plan.amount,
      currency: "eur",
      interval: plan.interval,
      updated_at: new Date().toISOString(),
    });
    results.push({ plan: plan.id, productId: productId!, priceId: priceId! });
  }
  return { ok: true, results };
}

export async function createStripeCheckoutInternal(data: {
  token: string;
  plan: PlanId;
  origin?: string;
}) {
  const user = await authUser(data.token);
  const { stripe } = await getStripe();

  const { data: prod, error } = await (supabaseAdmin as any)
    .from("stripe_products")
    .select("*")
    .eq("plan", data.plan)
    .maybeSingle();

  const prodTyped = prod as { price_id: string } | null;
  if (error || !prodTyped)
    throw new Error(
      "Plano ainda não sincronizado. Peça ao admin para clicar em 'Sincronizar planos'.",
    );

  const { data: sub } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const subTyped = sub as { stripe_customer_id: string } | null;
  let customerId = subTyped?.stripe_customer_id;
  if (!customerId) {
    const cust = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = cust.id;
    await (supabaseAdmin as any).from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "free",
        scans_credits: 0,
      },
      { onConflict: "user_id" },
    );
  }

  const baseUrl = data.origin || "https://example.com";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: prodTyped.price_id, quantity: 1 }],
    success_url: `${baseUrl}/premium?success=1`,
    cancel_url: `${baseUrl}/premium?canceled=1`,
    metadata: { user_id: user.id, plan: data.plan },
    subscription_data: { metadata: { user_id: user.id, plan: data.plan } },
  });
  return { url: session.url };
}

async function authUser(token: string) {
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");
  return data.user as { id: string; email?: string };
}
