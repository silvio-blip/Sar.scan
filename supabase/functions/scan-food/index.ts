import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. Interceção do Preflight (OPTIONS) - Isto resolve o erro de CORS!
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Chave GEMINI_API_KEY não encontrada nos Secrets do Supabase.");
    }

    const body = await req.json();
    const imagemBase64 = body.image || body.image_base64; 

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const promptDefinitivo = "Analisa esta imagem de comida e diz-me o que é e as suas calorias aproximadas.";
    const result = await model.generateContent([
      promptDefinitivo,
      { inlineData: { data: imagemBase64, mimeType: "image/jpeg" } }
    ]);

    const textoResposta = await result.response.text();

    return new Response(
      JSON.stringify({ sucesso: true, resultado: textoResposta }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
