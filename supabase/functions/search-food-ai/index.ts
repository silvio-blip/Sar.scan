// Search food via Lovable AI — modes: "popular" (cached 100 foods) or "variants" (search query)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isDerivedFoodName,
  matchesRequestedFood,
  normalize,
  resolveFoodDetails,
} from "../_shared/food-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, mode = "variants" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const isPopular = mode === "popular";

    // Popular mode: serve from cache if available
    if (isPopular) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: cached, count } = await admin
        .from("foods_basic")
        .select("nome, cal, carb, prot, gord, foto_url", { count: "exact" })
        .limit(100);
      if ((count ?? 0) >= 50) {
        return json({ alimentos: (cached ?? []).map((c) => ({ ...c, porcao: "1 porção" })) });
      }
      // else fall through and seed
    }

    if (!isPopular && (!query || typeof query !== "string"))
      return json({ error: "missing query" }, 400);

    const userPrompt = isPopular
      ? "Liste 60 alimentos brasileiros populares e variados (frutas, legumes, carnes, grãos, laticínios, snacks, pratos prontos). Para cada um: nome curto, porção comum, e macros (cal, carb, prot, gord). Para foto_url retorne string vazia (será preenchida depois)."
      : `Liste até 6 variantes comuns do alimento "${query}". Para cada um: nome, porção, macros. Para foto_url retorne string vazia.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content:
              "Você é um nutricionista brasileiro. Responda em português, de forma compacta.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "listar_alimentos",
              description: "Lista alimentos com seus dados nutricionais",
              parameters: {
                type: "object",
                properties: {
                  alimentos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string" },
                        porcao: { type: "string" },
                        cal: { type: "number" },
                        carb: { type: "number" },
                        prot: { type: "number" },
                        gord: { type: "number" },
                        foto_url: { type: "string" },
                      },
                      required: ["nome", "porcao", "cal", "carb", "prot", "gord"],
                    },
                  },
                },
                required: ["alimentos"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "listar_alimentos" } },
      }),
    });

    if (resp.status === 429)
      return json({ error: "Limite de uso atingido. Tente novamente em alguns instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos esgotados." }, 402);
    if (!resp.ok) return json({ error: `AI error ${resp.status}: ${await resp.text()}` }, 500);

    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    let argsRaw = call?.function?.arguments;
    if (!argsRaw && typeof msg?.content === "string") {
      // Some models return JSON in content instead of tool_calls
      const m = msg.content.match(/\{[\s\S]*\}/);
      if (m) argsRaw = m[0];
    }
    if (!argsRaw) {
      console.error(
        "No tool call. finish_reason:",
        data.choices?.[0]?.finish_reason,
        "data:",
        JSON.stringify(data).slice(0, 800),
      );
      return json({ error: "Resposta inválida do modelo", alimentos: [] }, 200);
    }
    let args: any;
    try {
      args = JSON.parse(argsRaw);
    } catch (e) {
      console.error("JSON parse failed:", e, "raw:", argsRaw.slice(0, 500));
      return json({ error: "Resposta truncada", alimentos: [] }, 200);
    }
    let alimentos = (args.alimentos ?? []).map((a: any) => ({
      nome: String(a.nome ?? ""),
      porcao: String(a.porcao ?? "1 porção"),
      cal: Number(a.cal ?? 0),
      carb: Number(a.carb ?? 0),
      prot: Number(a.prot ?? 0),
      gord: Number(a.gord ?? 0),
      foto_url:
        a.foto_url && String(a.foto_url).includes("upload.wikimedia.org")
          ? String(a.foto_url)
          : null,
    }));

    if (!isPopular) {
      const queryNormalized = String(query ?? "").trim();
      const queryIsDerived = isDerivedFoodName(queryNormalized);
      alimentos = alimentos.filter((food: any) => {
        if (!food.nome) return false;
        if (!matchesRequestedFood(queryNormalized, food.nome)) return false;
        if (!queryIsDerived && isDerivedFoodName(food.nome)) return false;
        return true;
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    alimentos = await Promise.all(
      alimentos.map(async (food: any) => {
        const resolved = await resolveFoodDetails(food.nome, { skipAi: false });
        const fotoUrl = resolved.urlImagemValidada ?? food.foto_url ?? null;

        if (fotoUrl) {
          await admin.from("food_images").upsert({
            nome: normalize(food.nome),
            url: fotoUrl,
            updated_at: new Date().toISOString(),
          });

          await admin.from("foods_basic").update({ foto_url: fotoUrl }).ilike("nome", food.nome);
        }

        return {
          ...food,
          nome: resolved.nomeProduto || food.nome,
          foto_url: fotoUrl,
          cal:
            resolved.tabelaNutricionalOficial?.calorias != null && food.cal <= 0
              ? Number(resolved.tabelaNutricionalOficial.calorias)
              : food.cal,
          carb:
            resolved.tabelaNutricionalOficial?.carboidratos_g != null && food.carb <= 0
              ? Number(resolved.tabelaNutricionalOficial.carboidratos_g)
              : food.carb,
          prot:
            resolved.tabelaNutricionalOficial?.proteinas_g != null && food.prot <= 0
              ? Number(resolved.tabelaNutricionalOficial.proteinas_g)
              : food.prot,
          gord:
            resolved.tabelaNutricionalOficial?.gorduras_g != null && food.gord <= 0
              ? Number(resolved.tabelaNutricionalOficial.gorduras_g)
              : food.gord,
        };
      }),
    );

    // Persist popular results to the shared cache
    if (isPopular && alimentos.length > 0) {
      await admin.from("foods_basic").insert(
        alimentos.map((a: any) => ({
          nome: a.nome,
          cal: a.cal,
          carb: a.carb,
          prot: a.prot,
          gord: a.gord,
          foto_url: a.foto_url,
        })),
      );
    }

    return json({ alimentos });
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
