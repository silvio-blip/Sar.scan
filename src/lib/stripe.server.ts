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
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  _cached = { stripe, secret, webhookSecret };
  return _cached;
}

export const PLANS_DEF = [
  { id: "weekly", label: "sar.scan Semanal", amount: 499, interval: "week", scans: 30, trial_days: 7 },
  { id: "monthly", label: "sar.scan Mensal", amount: 1999, interval: "month", scans: 150, trial_days: 7 },
  { id: "yearly", label: "sar.scan Anual", amount: 9900, interval: "year", scans: 1200, trial_days: 7 },
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

  console.log("[Stripe] Creating checkout session for user:", user.id, "plan:", data.plan, "customerId:", customerId);
  const planDef = PLANS_DEF.find((p) => p.id === data.plan);
  
  try {
    // Configuração base da sessão
    const sessionOptions: any = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: prodTyped.price_id, quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id, plan: data.plan },
        trial_period_days: planDef?.trial_days ?? 0,
      },
      billing_address_collection: "auto",
      success_url: `${baseUrl}/premium?success=1`,
      cancel_url: `${baseUrl}/premium?canceled=1`,
      metadata: { user_id: user.id, plan: data.plan },
    };

    // Lista exaustiva de métodos habilitados na imagem do usuário
    // Note: Stripe Checkout validará a compatibilidade com o modo 'subscription' e a moeda (EUR)
    // Alguns métodos da imagem (PIX, Multibanco, BLIK) podem ser filtrados pela Stripe se incompatíveis com recorrência.
    const allEnabledMethods = [
      "card",
      "paypal",
      "klarna",
      "bancontact",
      "ideal",
      "sepa_debit",
      "link",
      "revolut_pay",
      "mb_way",
      "multibanco", // Pode falhar em assinaturas, mas o usuário insistiu
      "mobilepay",
      "blik",
      "p24",
      "eps",
      "giropay",
      "twint",
      "pix", // Geralmente requer BRL, mas vamos incluir
      "upi",
    ];

    try {
      console.log("[Stripe] Attempting session creation with all methods...");
      const session = await stripe.checkout.sessions.create({
        ...sessionOptions,
        // Tentamos automatic_payment_methods primeiro, pois é o padrão moderno
        automatic_payment_methods: { enabled: true },
        // Se quisermos forçar a Stripe a mostrar tudo que pode, usamos as configurações do dashboard
      });
      console.log("[Stripe] Session created successfully (automatic):", session.id);
      return { url: session.url };
    } catch (e: any) {
      console.warn("[Stripe] automatic_payment_methods failed, falling back to manual list:", e.message);
      
      try {
        const session = await stripe.checkout.sessions.create({
          ...sessionOptions,
          payment_method_types: allEnabledMethods.filter(m => {
             // Opcional: filtrar métodos sabidamente incompatíveis com assinaturas se o erro for específico
             return true;
          }) as any,
        });
        console.log("[Stripe] Session created successfully (manual list):", session.id);
        return { url: session.url };
      } catch (err2: any) {
        console.warn("[Stripe] Manual list also failed, falling back to safe subscription methods:", err2.message);
        // Fallback final para o que é GARANTIDO funcionar em assinaturas EUR
        const session = await stripe.checkout.sessions.create({
          ...sessionOptions,
          payment_method_types: [
            "card",
            "paypal",
            "klarna",
            "sepa_debit",
            "bancontact",
            "ideal",
            "revolut_pay",
            "link"
          ],
        });
        console.log("[Stripe] Session created successfully (safe fallback):", session.id);
        return { url: session.url };
      }
    }
  } catch (stripeErr: any) {
    console.error("[Stripe] Critical failure creating session:", stripeErr);
    if (stripeErr.raw) {
      console.error("[Stripe] Raw error details:", JSON.stringify(stripeErr.raw, null, 2));
    }
    throw new Error(stripeErr.message || "Erro na Stripe ao criar sessão");
  }
}

async function authUser(token: string) {
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");
  return data.user as { id: string; email?: string };
}
