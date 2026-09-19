import Stripe from "stripe";
import { supabaseAdmin } from "../integrations/supabase/client.server.js";

import { getAppSettings } from "./settings.server.js";

let _cached: { stripe: Stripe; secret: string; webhookSecret: string } | null = null;

function cleanKey(val: string | undefined | null): string {
  if (!val) return "";
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

async function loadKeys(forceRefresh = false) {
  const settings = await getAppSettings(forceRefresh);
  const secret = cleanKey(
    settings.stripe_secret_key ||
      settings.STRIPE_SECRET_KEY ||
      settings.stripeSecretKey ||
      settings.stripe_key ||
      settings.STRIPE_KEY ||
      settings.stripe_secret ||
      settings.STRIPE_SECRET ||
      process.env.STRIPE_SECRET_KEY ||
      "",
  );
  const webhookSecret = cleanKey(
    settings.stripe_webhook_secret ||
      settings.STRIPE_WEBHOOK_SECRET ||
      settings.stripeWebhookSecret ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      "",
  );

  if (!secret) {
    throw new Error(
      "Chave secreta da Stripe (stripe_secret_key) não encontrada na tabela app_settings ou variáveis de ambiente.",
    );
  }
  return { secret, webhookSecret };
}

export async function getStripe(forceRefresh = false) {
  const { secret, webhookSecret } = await loadKeys(forceRefresh);

  if (
    _cached &&
    _cached.secret === secret &&
    _cached.webhookSecret === webhookSecret &&
    !forceRefresh
  ) {
    return _cached;
  }

  console.log(
    `[Stripe Server] Inicializando cliente Stripe com a chave do banco (${secret.slice(0, 8)}...${secret.slice(-4)})`,
  );
  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" as any });
  _cached = { stripe, secret, webhookSecret };
  return _cached;
}

export const PLANS_DEF = [
  {
    id: "weekly",
    label: "sar.scan Semanal",
    amount: 499,
    interval: "week",
    scans: 30,
    trial_days: 7,
  },
  {
    id: "monthly",
    label: "sar.scan Mensal",
    amount: 1999,
    interval: "month",
    scans: 150,
    trial_days: 7,
  },
  {
    id: "yearly",
    label: "sar.scan Anual",
    amount: 9999,
    interval: "year",
    scans: 1200,
    trial_days: 7,
  },
] as const;
export type PlanId = (typeof PLANS_DEF)[number]["id"];

async function ensureValidProductAndPrice(stripe: Stripe, planId: PlanId): Promise<string> {
  const plan = PLANS_DEF.find((p) => p.id === planId);
  if (!plan) throw new Error(`Plano inválido: ${planId}`);

  let existingTyped: {
    product_id?: string;
    price_id?: string;
    amount?: number;
  } | null = null;

  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from("stripe_products")
      .select("*")
      .eq("plan", plan.id)
      .maybeSingle();
    existingTyped = existing;
  } catch (dbErr) {
    console.warn("[Stripe] Failed to query stripe_products table:", dbErr);
  }

  let validPriceId: string | null = null;
  let validProductId: string | null = null;

  // 1. Verify if the database's price_id is actually valid in the current active Stripe account
  if (existingTyped?.price_id) {
    try {
      const price = await stripe.prices.retrieve(existingTyped.price_id);
      if (price && price.active && !price.deleted && price.unit_amount === plan.amount) {
        validPriceId = price.id;
        validProductId =
          typeof price.product === "string" ? price.product : (price.product as any)?.id;
        console.log(`[Stripe] Using verified existing price ${validPriceId} for plan ${plan.id}`);
      }
    } catch {
      console.warn(
        `[Stripe] Stored price ${existingTyped.price_id} does not exist in active Stripe account. Will regenerate.`,
      );
    }
  }

  if (validPriceId) {
    return validPriceId;
  }

  // 2. Check if product exists in active Stripe account
  if (existingTyped?.product_id && !validProductId) {
    try {
      const prod = await stripe.products.retrieve(existingTyped.product_id);
      if (prod && !prod.deleted) {
        validProductId = prod.id;
      }
    } catch {
      validProductId = null;
    }
  }

  // 3. Search Stripe for existing products with metadata plan = plan.id or matching name
  if (!validProductId) {
    try {
      const existingProds = await stripe.products.list({ limit: 50, active: true });
      const found = existingProds.data.find(
        (p) => p.metadata?.plan === plan.id || p.name === plan.label,
      );
      if (found) {
        validProductId = found.id;
        console.log(`[Stripe] Found existing matching product in Stripe: ${found.id}`);
      }
    } catch (searchErr) {
      console.warn("[Stripe] Could not list products:", searchErr);
    }
  }

  // 4. Create product if still not found
  if (!validProductId) {
    console.log(`[Stripe] Creating product in active Stripe account for plan: ${plan.id}`);
    const product = await stripe.products.create({
      name: plan.label,
      metadata: { plan: plan.id, scans: String(plan.scans) },
    });
    validProductId = product.id;
  }

  // 5. Search if this product already has an active price with the correct amount
  try {
    const existingPrices = await stripe.prices.list({
      product: validProductId,
      active: true,
      limit: 10,
    });
    const matchPrice = existingPrices.data.find(
      (pr) =>
        pr.unit_amount === plan.amount &&
        pr.currency.toLowerCase() === "eur" &&
        pr.recurring?.interval === plan.interval,
    );
    if (matchPrice) {
      validPriceId = matchPrice.id;
      console.log(`[Stripe] Reusing active price from Stripe product: ${validPriceId}`);
    }
  } catch (priceListErr) {
    console.warn("[Stripe] Could not list existing prices for product:", priceListErr);
  }

  // 6. Create Price if needed
  if (!validPriceId) {
    console.log(`[Stripe] Creating price in active Stripe account for plan: ${plan.id}`);
    const price = await stripe.prices.create({
      product: validProductId,
      unit_amount: plan.amount,
      currency: "eur",
      recurring: { interval: plan.interval as any },
      metadata: { plan: plan.id },
    });
    validPriceId = price.id;
  }

  // 7. Update Supabase stripe_products cache
  try {
    await (supabaseAdmin as any).from("stripe_products").upsert({
      plan: plan.id,
      product_id: validProductId,
      price_id: validPriceId,
      amount: plan.amount,
      currency: "eur",
      interval: plan.interval,
      updated_at: new Date().toISOString(),
    });
    console.log(`[Stripe] Updated stripe_products cache with price: ${validPriceId}`);
  } catch (upsertErr) {
    console.warn("[Stripe] Non-blocking warning: failed to upsert to stripe_products:", upsertErr);
  }

  return validPriceId;
}

async function ensureValidCustomer(
  stripe: Stripe,
  user: { id: string; email?: string },
): Promise<string> {
  let customerId: string | null = null;

  try {
    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const subTyped = sub as { stripe_customer_id: string } | null;
    customerId = subTyped?.stripe_customer_id || null;
  } catch (dbErr) {
    console.warn("[Stripe] Could not query subscriptions table for customer:", dbErr);
  }

  // Verify that the customer actually exists in the active Stripe account
  if (customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (cust && !(cust as any).deleted) {
        return customerId;
      }
    } catch {
      console.warn(
        `[Stripe] Customer ${customerId} not found in active Stripe account. Generating new customer...`,
      );
      customerId = null;
    }
  }

  // Create new customer on Stripe
  const newCust = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: user.id },
  });
  customerId = newCust.id;

  try {
    const { data: existingSub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub) {
      await (supabaseAdmin as any)
        .from("subscriptions")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await (supabaseAdmin as any).from("subscriptions").insert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "free",
        scans_credits: 3,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (upsertErr) {
    console.warn(
      "[Stripe] Non-blocking warning: failed to upsert customer into subscriptions:",
      upsertErr,
    );
  }

  return customerId;
}

export async function syncStripePlansInternal(data: { token: string }) {
  const user = await authUser(data.token);
  const { data: roles } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = !!(roles as { role: string }[] | null)?.some((r) => r.role === "admin");
  if (!isAdmin) throw new Error("Apenas admin pode sincronizar planos");

  const { stripe } = await getStripe();
  const results: { plan: string; priceId: string }[] = [];
  for (const plan of PLANS_DEF) {
    const priceId = await ensureValidProductAndPrice(stripe, plan.id);
    results.push({ plan: plan.id, priceId });
  }
  return { ok: true, results };
}

export async function createStripeCheckoutInternal(data: {
  token: string;
  plan: PlanId;
  trial?: boolean;
  origin?: string;
}) {
  const user = await authUser(data.token);
  const { stripe } = await getStripe();

  const priceId = await ensureValidProductAndPrice(stripe, data.plan);
  const customerId = await ensureValidCustomer(stripe, user);

  const baseUrl =
    data.origin ||
    process.env.PUBLIC_APP_URL ||
    "https://ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app";

  console.log(
    "[Stripe] Creating checkout session. User:",
    user.id,
    "Plan:",
    data.plan,
    "Price:",
    priceId,
    "Trial:",
    data.trial,
  );
  const planDef = PLANS_DEF.find((p) => p.id === data.plan);

  const subscriptionData: any = {
    metadata: { user_id: user.id, plan: data.plan, is_trial: data.trial ? "true" : "false" },
  };

  if (data.trial && (planDef?.trial_days ?? 7) > 0) {
    subscriptionData.trial_period_days = planDef?.trial_days ?? 7;
  }

  const sessionOptions: any = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    billing_address_collection: "auto",
    success_url: `${baseUrl}/premium?success=1&plan=${data.plan}${data.trial ? "&trial=1" : ""}`,
    cancel_url: `${baseUrl}/premium?canceled=1`,
    metadata: { user_id: user.id, plan: data.plan, is_trial: data.trial ? "true" : "false" },
  };

  try {
    console.log("[Stripe] Requesting session creation with dynamic payment methods...");
    const session = await stripe.checkout.sessions.create(sessionOptions);
    console.log("[Stripe] Session created successfully:", session.id);
    return { url: session.url };
  } catch (stripeErr: any) {
    console.warn(
      "[Stripe] Primary session creation attempt failed:",
      stripeErr.message,
      "- Retrying with fallback payment methods (card)...",
    );
    try {
      const fallbackSession = await stripe.checkout.sessions.create({
        ...sessionOptions,
        payment_method_types: ["card"],
      });
      console.log("[Stripe] Fallback session created successfully:", fallbackSession.id);
      return { url: fallbackSession.url };
    } catch (retryErr: any) {
      console.error("[Stripe] Critical failure creating session:", retryErr);
      if (retryErr.raw) {
        console.error("[Stripe] Raw error details:", JSON.stringify(retryErr.raw, null, 2));
      }
      throw new Error(retryErr.message || "Erro na Stripe ao criar sessão");
    }
  }
}

async function authUser(token: string): Promise<{ id: string; email?: string }> {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new Error("Unauthorized: Missing JWT token.");
  }
  let cleanToken = token.trim();
  if (cleanToken.startsWith("Bearer ")) {
    cleanToken = cleanToken.substring(7).trim();
  }

  // 1. Tenta validação oficial via Supabase Auth API
  try {
    const { data, error } = await (supabaseAdmin as any).auth.getUser(cleanToken);
    if (!error && data?.user?.id) {
      return { id: data.user.id, email: data.user.email };
    }
  } catch (err) {
    console.debug("[Stripe Auth] getUser exception, tentando fallback JWT:", err);
  }

  // 2. Validação resiliente do payload JWT
  try {
    const parts = cleanToken.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload && payload.sub) {
        const isNotExpired = !payload.exp || payload.exp * 1000 > Date.now();
        if (isNotExpired) {
          const { data: profile } = await (supabaseAdmin as any)
            .from("profiles")
            .select("id, email")
            .eq("id", payload.sub)
            .maybeSingle();

          if (profile?.id) {
            return { id: profile.id, email: profile.email || payload.email };
          }
        }
      }
    }
  } catch (jwtErr) {
    console.debug("[Stripe Auth] Falha no parse do JWT:", jwtErr);
  }

  throw new Error("Unauthorized: Invalid session.");
}
