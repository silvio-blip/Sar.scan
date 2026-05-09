// Nutrition chat with Lovable AI Gateway, scoped to the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (!message) return json({ error: "missing message" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    // Context: profile + today's entries + daily goals
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: profile }, { data: goals }, { data: entries }] = await Promise.all([
      supabase
        .from("profiles")
        .select("nome,idade,peso,altura,objetivo")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("daily_goals")
        .select("calorias,proteina_g,carbs_g,gordura_g")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("food_entries")
        .select("nome,calorias,prot,carbs,gord,porcoes")
        .eq("user_id", user.id)
        .eq("data", today),
    ]);

    const totals = (entries ?? []).reduce(
      (a, e: any) => ({
        cal: a.cal + Number(e.calorias) * Number(e.porcoes),
        prot: a.prot + Number(e.prot) * Number(e.porcoes),
        carbs: a.carbs + Number(e.carbs) * Number(e.porcoes),
        gord: a.gord + Number(e.gord) * Number(e.porcoes),
      }),
      { cal: 0, prot: 0, carbs: 0, gord: 0 },
    );

    // Persist user message
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, role: "user", content: message });

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recent = (history ?? []).reverse();

    const systemPrompt = `Você é um nutricionista especialista, formado e experiente, atendendo em português brasileiro.
Sua missão: ajudar o usuário a comer melhor, atingir metas e tirar dúvidas sobre alimentação, macros, suplementos, hidratação e hábitos.
Seja claro, prático, empático e baseado em ciência. Evite jargão. Dê exemplos concretos com alimentos brasileiros.
Quando relevante, use os dados reais abaixo do usuário; nunca invente valores.

Perfil: ${JSON.stringify(profile ?? {})}
Metas diárias: ${JSON.stringify(goals ?? {})}
Consumo de hoje (${today}): ${JSON.stringify(totals)}
Refeições registradas hoje: ${JSON.stringify(entries ?? [])}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...recent],
      }),
    });

    if (resp.status === 429)
      return json({ error: "Limite de uso atingido. Tente novamente em alguns instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos esgotados." }, 402);
    if (!resp.ok) return json({ error: `AI error ${resp.status}: ${await resp.text()}` }, 500);

    const data = await resp.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "Sem resposta.";

    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, role: "assistant", content: reply });

    return json({ reply });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
