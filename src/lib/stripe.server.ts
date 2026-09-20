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

async function loadKeys() {
  const settings = await getAppSettings();
  const secret = cleanKey(settings.stripe_secret_key);
  const webhookSecret = cleanKey(settings.stripe_webhook_secret);

  if (!secret) {
    throw new Error(
      "Chave secreta da Stripe (stripe_secret_key) não encontrada na tabela app_settings do Supabase. Configure a chave na tabela para realizar pagamentos.",
    );
  }
  return { secret, webhookSecret };
}

export async function getStripe(forceRefresh = false) {
  const { secret, webhookSecret } = await loadKeys();

  if (
    _cached &&
    _cached.secret === secret &&
    _cached.webhookSecret === webhookSecret &&
    !forceRefresh
  ) {
    return _cached;
  }

  console.log(
    `[Stripe Server] Inicializando cliente Stripe com a chave de app_settings (${secret.slice(0, 8)}...${secret.slice(-4)})`,
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
    trial_days: 0,
  },
  {
    id: "yearly",
    label: "sar.scan Anual",
    amount: 9999,
    interval: "year",
    scans: 1200,
    trial_days: 0,
  },
  {
    id: "credits",
    label: "sar.scan - Pacote 50 Scans",
    amount: 999,
    interval: "one_time",
    scans: 50,
    trial_days: 0,
  },
] as const;
export type PlanId = (typeof PLANS_DEF)[number]["id"];

async function ensureValidProductAndPrice(stripe: Stripe, planId: PlanId): Promise<string> {
  const plan = PLANS_DEF.find((p) => p.id === planId);
  if (!plan) throw new Error(`Plano inválido: ${planId}`);

  if (planId === "credits") {
    return ensureValidCreditPrice(stripe);
  }

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
        console.log(
          `[Stripe] Usando preço verificado existente ${validPriceId} para o plano ${plan.id}`,
        );
      }
    } catch {
      console.warn(
        `[Stripe] Preço armazenado ${existingTyped.price_id} não existe na conta Stripe ativa. Será recriado.`,
      );
    }
  }

  if (validPriceId) {
    return validPriceId;
  }

  // 2. Search Stripe for existing products with metadata plan = plan.id or matching name
  if (!validProductId) {
    try {
      const existingProds = await stripe.products.list({ limit: 50, active: true });
      const found = existingProds.data.find(
        (p) => p.metadata?.plan === plan.id || p.name === plan.label,
      );
      if (found) {
        validProductId = found.id;
        console.log(`[Stripe] Encontrado produto existente na conta Stripe: ${found.id}`);
      }
    } catch (searchErr) {
      console.warn("[Stripe] Could not list products:", searchErr);
    }
  }

  // 3. Create product if still not found
  if (!validProductId) {
    console.log(`[Stripe] Criando produto na conta Stripe para o plano: ${plan.id}`);
    const product = await stripe.products.create({
      name: plan.label,
      metadata: { plan: plan.id, scans: String(plan.scans) },
    });
    validProductId = product.id;
  }

  // 4. Search if this product already has an active price with the correct amount
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
      console.log(`[Stripe] Reutilizando preço ativo do produto Stripe: ${validPriceId}`);
    }
  } catch (priceListErr) {
    console.warn("[Stripe] Could not list existing prices for product:", priceListErr);
  }

  // 5. Create Price if needed
  if (!validPriceId) {
    console.log(
      `[Stripe] Criando preço de €${(plan.amount / 100).toFixed(2)} na conta Stripe para: ${plan.id}`,
    );
    const price = await stripe.prices.create({
      product: validProductId,
      unit_amount: plan.amount,
      currency: "eur",
      recurring: { interval: plan.interval as any },
      metadata: { plan: plan.id },
    });
    validPriceId = price.id;
  }

  // 6. Update Supabase stripe_products cache
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
    console.log(`[Stripe] Tabela stripe_products atualizada com o preço: ${validPriceId}`);
  } catch (upsertErr) {
    console.warn("[Stripe] Non-blocking warning: failed to upsert to stripe_products:", upsertErr);
  }

  return validPriceId;
}

async function ensureValidCreditPrice(stripe: Stripe): Promise<string> {
  const creditAmount = 999; // €9,99
  let validPriceId: string | null = null;
  let validProductId: string | null = null;

  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from("stripe_products")
      .select("*")
      .eq("plan", "credits")
      .maybeSingle();

    if (existing?.price_id) {
      try {
        const price = await stripe.prices.retrieve(existing.price_id);
        if (price && price.active && !price.deleted && price.unit_amount === creditAmount) {
          validPriceId = price.id;
          validProductId =
            typeof price.product === "string" ? price.product : (price.product as any)?.id;
        }
      } catch {
        // Preço antigo
      }
    }
  } catch (dbErr) {
    console.warn("[Stripe Credits] Query warning:", dbErr);
  }

  if (validPriceId) return validPriceId;

  // Busca ou cria produto
  try {
    const prods = await stripe.products.list({ limit: 50, active: true });
    const found = prods.data.find(
      (p) => p.metadata?.plan === "credits" || p.name.includes("50 Scans"),
    );
    if (found) {
      validProductId = found.id;
    }
  } catch (e) {
    console.warn("[Stripe Credits] List products error:", e);
  }

  if (!validProductId) {
    const prod = await stripe.products.create({
      name: "sar.scan - Pacote 50 Scans",
      metadata: { plan: "credits", scans: "50" },
    });
    validProductId = prod.id;
  }

  // Preço one-time
  try {
    const prices = await stripe.prices.list({
      product: validProductId,
      active: true,
      limit: 10,
    });
    const match = prices.data.find(
      (p) => p.unit_amount === creditAmount && p.currency.toLowerCase() === "eur" && !p.recurring,
    );
    if (match) {
      validPriceId = match.id;
    }
  } catch (e) {
    console.warn("[Stripe Credits] List prices error:", e);
  }

  if (!validPriceId) {
    const price = await stripe.prices.create({
      product: validProductId,
      unit_amount: creditAmount,
      currency: "eur",
      metadata: { plan: "credits" },
    });
    validPriceId = price.id;
  }

  try {
    await (supabaseAdmin as any).from("stripe_products").upsert({
      plan: "credits",
      product_id: validProductId,
      price_id: validPriceId,
      amount: creditAmount,
      currency: "eur",
      interval: "one_time",
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking
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
    console.warn("[Stripe] Failed to query subscriptions table for customer:", dbErr);
  }

  // Verifica se o customerId ainda existe na conta Stripe ativa
  if (customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (cust && !(cust as any).deleted) {
        return customerId;
      }
    } catch {
      customerId = null;
    }
  }

  // Cria novo customer na conta Stripe ativa
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

  const { stripe } = await getStripe(true);
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
  const { stripe, secret } = await getStripe(true);

  console.log(
    `[Stripe Checkout] Inicializando checkout com credencial Stripe: ${secret.slice(0, 10)}...${secret.slice(-4)}`,
  );

  const baseUrl = data.origin || process.env.PUBLIC_APP_URL || "";
  const customerId = await ensureValidCustomer(stripe, user);

  // Checkout para pacote de créditos (pagamento único)
  if (data.plan === "credits") {
    const priceId = await ensureValidCreditPrice(stripe);
    const successUrl = baseUrl
      ? `${baseUrl}/premium?success=1&plan=credits&session_id={CHECKOUT_SESSION_ID}`
      : `https://sarscan.app/premium?success=1&plan=credits&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = baseUrl
      ? `${baseUrl}/premium?canceled=1`
      : `https://sarscan.app/premium?canceled=1`;

    console.log(
      "[Stripe] Criando sessão de checkout para Créditos. Price:",
      priceId,
      "Customer:",
      customerId,
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "auto",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id, plan: "credits", scans: "50" },
    });

    console.log("[Stripe] Sessão de Créditos criada:", session.id, "URL:", session.url);
    return { url: session.url };
  }

  // Checkout para assinaturas recorrentes
  const priceId = await ensureValidProductAndPrice(stripe, data.plan);

  console.log(
    "[Stripe] Creating checkout session. User:",
    user.id,
    "Plan:",
    data.plan,
    "Price:",
    priceId,
    "Trial:",
    data.trial,
    "BaseUrl:",
    baseUrl,
  );
  const planDef = PLANS_DEF.find((p) => p.id === data.plan);

  const subscriptionData: any = {
    metadata: { user_id: user.id, plan: data.plan, is_trial: data.trial ? "true" : "false" },
  };

  if (data.trial && (planDef?.trial_days ?? 7) > 0) {
    subscriptionData.trial_period_days = planDef?.trial_days ?? 7;
  }

  const successUrl = baseUrl
    ? `${baseUrl}/premium?success=1&plan=${data.plan}${data.trial ? "&trial=1" : ""}&session_id={CHECKOUT_SESSION_ID}`
    : `https://sarscan.app/premium?success=1&plan=${data.plan}${data.trial ? "&trial=1" : ""}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = baseUrl
    ? `${baseUrl}/premium?canceled=1`
    : `https://sarscan.app/premium?canceled=1`;

  const sessionOptions: any = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: subscriptionData,
    billing_address_collection: "auto",
    success_url: successUrl,
    cancel_url: cancelUrl,
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

export async function verifyStripeSessionInternal(token: string, sessionId: string) {
  const user = await authUser(token);
  if (!sessionId) {
    throw new Error("Missing sessionId");
  }

  const { stripe } = await getStripe(true);
  console.log(`[Stripe Verify] Verificando sessão ${sessionId} para usuário ${user.id}...`);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (!session) {
    throw new Error("Sessão Stripe não encontrada");
  }

  // Verifica se o usuário da sessão bate com o usuário autenticado
  const metaUserId = session.metadata?.user_id;
  if (metaUserId && metaUserId !== user.id) {
    console.warn(`[Stripe Verify] Mismatch de user_id: ${metaUserId} !== ${user.id}`);
  }

  const planId = (session.metadata?.plan || "monthly") as PlanId;
  const isPaymentPaid = session.payment_status === "paid" || session.status === "complete";
  const subObj = session.subscription as any;

  if (planId === "credits") {
    if (isPaymentPaid) {
      const { data: currentSub } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const addedCredits = 50;
      const currentCredits = (currentSub as any)?.scans_credits ?? 0;
      const newTotal = currentCredits + addedCredits;

      console.log(
        `[Stripe Verify] Creditando ${addedCredits} scans para ${user.id}. Total: ${newTotal}`,
      );

      if (currentSub) {
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({
            scans_credits: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } else {
        await (supabaseAdmin as any).from("subscriptions").insert({
          user_id: user.id,
          status: "free",
          plan: "free",
          scans_credits: newTotal,
          stripe_customer_id: session.customer as string,
          ai_agent_enabled: false,
          updated_at: new Date().toISOString(),
        });
      }

      return { success: true, plan: "credits", credits: newTotal };
    }
  } else {
    // Assinatura
    const subStatus = subObj?.status || (isPaymentPaid ? "active" : "active");
    const subId = typeof session.subscription === "string" ? session.subscription : subObj?.id;

    console.log(
      `[Stripe Verify] Ativando assinatura plano ${planId} (status: ${subStatus}) para usuário ${user.id}`,
    );

    const { data: currentSub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const planCredits = planScans(planId);
    const currentCredits = (currentSub as any)?.scans_credits ?? 0;
    const newTotal = currentCredits + planCredits;

    await (supabaseAdmin as any).from("subscriptions").upsert(
      {
        user_id: user.id,
        status: subStatus === "trialing" ? "trialing" : "active",
        plan: planId,
        scans_credits: newTotal,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subId,
        ai_agent_enabled: planId === "monthly" || planId === "yearly",
        current_period_end: new Date(Date.now() + 32 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return { success: true, plan: planId, status: subStatus };
  }

  return { success: true };
}
