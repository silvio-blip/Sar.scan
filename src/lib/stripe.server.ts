import Stripe from "stripe";
import { supabaseAdmin } from "../integrations/supabase/client.server.js";

import { getAppSettings } from "./settings.server.js";

let _cached: { stripe: Stripe; secret: string; webhookSecret: string } | null = null;

async function loadKeys() {
  const settings = await getAppSettings();
  const secret = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY || "";
  if (!secret) throw new Error("stripe_secret_key not set in app_settings or environment");
  return { secret, webhookSecret: settings.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || "" };
}

export async function getStripe() {
  if (_cached) return _cached;
  const { secret, webhookSecret } = await loadKeys();
  const stripe = new Stripe(secret, { apiVersion: "2025-09-30.clover" as any });
  _cached = { stripe, secret, webhookSecret };
  return _cached;
}

export const PLANS_DEF = [
  { id: "weekly", label: "sar.sacn Semanal", amount: 499, interval: "week", scans: 30, trial_days: 7 },
  { id: "monthly", label: "sar.sacn Mensal", amount: 1999, interval: "month", scans: 150, trial_days: 7 },
  { id: "yearly", label: "sar.sacn Anual", amount: 9900, interval: "year", scans: 1200, trial_days: 7 },
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

  const planDef = PLANS_DEF.find(p => p.id === data.plan);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    automatic_payment_methods: { enabled: true },
    customer: customerId,
    line_items: [{ price: prodTyped.price_id, quantity: 1 }],
    subscription_data: { 
      metadata: { user_id: user.id, plan: data.plan },
      trial_period_days: planDef?.trial_days ?? 0 
    },
    success_url: `${baseUrl}/premium?success=1`,
    cancel_url: `${baseUrl}/premium?canceled=1`,
    metadata: { user_id: user.id, plan: data.plan },
  });
  return { url: session.url };
}

async function authUser(token: string) {
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");
  return data.user as { id: string; email?: string };
}
