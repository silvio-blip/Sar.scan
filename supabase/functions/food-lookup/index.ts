import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalize, resolveFoodDetails } from "../_shared/food-resolver.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const nome = String(body?.nome ?? url.searchParams.get("nome") ?? "").trim();
    const skipAi = !!body?.skip_ai;
    if (!nome) return json({ error: "nome required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const resolved = await resolveFoodDetails(nome, { skipAi });
    const imagem = resolved.urlImagemValidada;

    // 4. Persist (cache + foods_basic)
    if (imagem) {
      await supabase
        .from("food_images")
        .upsert({ nome: normalize(nome), url: imagem, updated_at: new Date().toISOString() });
      // Update foods_basic if a row exists with this nome
      await supabase.from("foods_basic").update({ foto_url: imagem }).ilike("nome", nome);
    }

    return json({
      nome_produto: resolved.nomeProduto,
      url_imagem_validada: resolved.urlImagemValidada,
      tabela_nutricional_oficial: resolved.tabelaNutricionalOficial,
      origem_dos_dados: resolved.origemDosDados,
      validacao: resolved.validacao,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
