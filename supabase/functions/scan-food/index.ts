// Scan food image — detects multiple foods, returns each + total
import { resolveFoodDetails } from "../_shared/food-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) return json({ error: "missing image" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em visão computacional nutricional. Analise a imagem cuidadosamente. Identifique todos os alimentos ou itens comestíveis visíveis, mesmo que em pequenas quantidades ou obscurecidos. Estime os macronutrientes para cada item encontrado. Seja preciso na identificação e estimativa.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Liste cada alimento separadamente (ex: arroz, feijão, frango, salada). Para cada um: nome em português, quantidade visível estimada (ex: '100g', '1 unidade'), calorias e macros dessa quantidade. Não invente URL de imagem; deixe foto_url vazia quando não tiver certeza. Some os totais.",
              },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_refeicao",
              description: "Registra alimentos detectados na imagem",
              parameters: {
                type: "object",
                properties: {
                  itens: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string" },
                        quantidade: { type: "string" },
                        cal: { type: "number" },
                        carb: { type: "number" },
                        prot: { type: "number" },
                        gord: { type: "number" },
                        foto_url: { type: "string" },
                      },
                      required: ["nome", "quantidade", "cal", "carb", "prot", "gord"],
                    },
                  },
                },
                required: ["itens"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_refeicao" } },
      }),
    });

    if (resp.status === 429)
      return json({ error: "Limite de uso atingido. Tente novamente em alguns instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos esgotados." }, 402);
    if (!resp.ok) return json({ error: `AI error ${resp.status}: ${await resp.text()}` }, 500);

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return json({ error: "Resposta inválida do modelo" }, 500);
    const args = JSON.parse(call.function.arguments);
    const itens = await Promise.all(
      (args.itens ?? []).map(async (i: any) => {
        const nome = String(i.nome ?? "Alimento");
        const resolved = await resolveFoodDetails(nome, { skipAi: false });

        return {
          nome,
          quantidade: String(i.quantidade ?? "1 porção"),
          cal: Number(i.cal ?? 0),
          carb: Number(i.carb ?? 0),
          prot: Number(i.prot ?? 0),
          gord: Number(i.gord ?? 0),
          foto_url: resolved.urlImagemValidada,
        };
      }),
    );
    if (itens.length === 0) {
      // Return ok:false so the client can show a friendly message
      // and NOT consume a scan from the user's daily quota.
      return json(
        {
          ok: false,
          reason: "no_food",
          error:
            "Não conseguimos identificar um alimento nessa imagem. Tente outra foto, com melhor iluminação e enquadramento.",
        },
        200,
      );
    }
    const total = itens.reduce(
      (a: any, i: any) => ({
        cal: a.cal + i.cal,
        carb: a.carb + i.carb,
        prot: a.prot + i.prot,
        gord: a.gord + i.gord,
      }),
      { cal: 0, carb: 0, prot: 0, gord: 0 },
    );

    return json({ ok: true, itens, total });
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
