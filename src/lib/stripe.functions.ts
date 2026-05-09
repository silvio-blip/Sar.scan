import { type PlanId } from "./stripe.server";

/** Sincroniza planos com Stripe. Apenas admin. */
export const syncStripePlans = async (data: { token: string }) => {
  const res = await fetch("/api/stripe/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || "Erro ao sincronizar planos");
  }
  return res.json();
};

/** Cria a Checkout Session do Stripe pra um plano e devolve a URL. */
export const createStripeCheckout = async (data: { token: string; plan: PlanId }) => {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, origin: window.location.origin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || "Erro ao criar checkout");
  }
  return res.json();
};
