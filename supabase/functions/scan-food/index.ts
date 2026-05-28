import { resolveFoodDetails } from "../_shared/food-resolver.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Manejo de Preflight OPTIONS requests para evitar erros de CORS no Capacitor/Móvel
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return json({ error: "missing image" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json(
        { error: "A chave GEMINI_API_KEY não foi configurada nas Edge Functions do Supabase" },
        500,
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Configura o modelo de forma explícita com o Gemini Flash-Lite mais recente
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-lite-latest",
    });

    const prompt = `Você é um especialista em visão computacional nutricional. 
Analise a imagem de comida a seguir cuidadosamente. 
Identifique todos os alimentos ou itens comestíveis visíveis. 
Liste cada alimento separadamente em português técnico ou comum (ex: "arroz branco", "feijão preto", "frango grelhado"). 
Para cada um estime a quantidade visível (ex: '100g', '1 colher de sopa', '1 unidade'), calorias (cal), carboidratos (carb), proteínas (prot) e gorduras (gord).
Some os totais também. 

Responda ESTRITAMENTE em formato JSON puro, sem textos adicionais antes ou depois, seguindo esta exata estrutura:
{
  "itens": [
    {
      "nome": "nome do alimento em português",
      "quantidade": "quantidade estimada",
      "cal": 150,
      "carb": 20,
      "prot": 15,
      "gord": 2
    }
  ]
}`;

    // Extrai os dados em formato base64 caso venham com prefixo data:image/jpeg;base64,
    let base64Data = image;
    if (image.includes(",")) {
      base64Data = image.split(",")[1];
    }

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      },
    ]);

    const textResponse = result.response.text();

    // Limpeza de marcações Markdown que o modelo possa devolver
    const cleanJsonText = textResponse.replace(/```json\n?|\n?```/g, "").trim();

    let data;
    try {
      data = JSON.parse(cleanJsonText);
    } catch (parseErr) {
      console.error("Erro ao fazer parse do JSON gerado:", cleanJsonText);
      return json({ error: "O modelo retornou uma resposta inválida. Tente novamente." }, 500);
    }

    const itens = await Promise.all(
      (data.itens ?? []).map(async (i: any) => {
        const nome = String(i.nome ?? "Alimento");
        const resolved = await resolveFoodDetails(nome, { skipAi: false });

        return {
          nome,
          quantidade: String(i.quantidade ?? "1 porção"),
          cal: Number(i.cal ?? 0),
          carb: Number(i.carb ?? 0),
          prot: Number(i.prot ?? 0),
          gord: Number(i.gord ?? 0),
          foto_url: resolved.urlImagemValidada || "",
        };
      }),
    );

    if (itens.length === 0) {
      return json(
        {
          ok: false,
          reason: "no_food",
          error: "Não conseguimos identificar nenhum alimento nesta imagem.",
        },
        250,
      );
    }

    const total = itens.reduce(
      (acc: any, item: any) => ({
        cal: acc.cal + item.cal,
        carb: acc.carb + item.carb,
        prot: acc.prot + item.prot,
        gord: acc.gord + item.gord,
      }),
      { cal: 0, carb: 0, prot: 0, gord: 0 },
    );

    return json({ ok: true, itens, total });
  } catch (e: any) {
    console.error("Erro interno no scan-food:", e);
    return json({ error: "Erro ao processar imagem: " + (e.message || String(e)) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
