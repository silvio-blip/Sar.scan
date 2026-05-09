export type Nutrition = {
  calorias: number;
  carboidratos_g: number;
  proteinas_g: number;
  gorduras_g: number;
  fibras_g?: number;
  sodio_mg?: number;
  acucares_g?: number;
};

type OpenFoodFactsMatch = {
  nome?: string;
  imagem?: string | null;
  nutricao?: Nutrition;
  score: number;
};

const OFF_ACCEPTANCE_SCORE = 8;
const DERIVED_PATTERNS = [
  /guacamole/i,
  /molho/i,
  /sauce/i,
  /oleo|óleo/i,
  /azeite/i,
  /suco/i,
  /juice/i,
  /bebida/i,
  /drink/i,
  /smoothie/i,
  /vitamina/i,
  /creme/i,
  /cream/i,
  /bolo/i,
  /cake/i,
  /biscoito|bolacha|cookie/i,
  /iogurte|yogurt/i,
  /sorvete|ice cream/i,
  /doce|jam|geleia/i,
  /snack/i,
];

export function isDerivedFoodName(value: string) {
  return hasDerivedMarker(value);
}

const PT_HINTS: Array<[RegExp, string]> = [
  [/abacate/i, "Avocado"],
  [/manga/i, "Mango"],
  [/banana/i, "Banana"],
  [/aca[ií]/i, "Açaí"],
  [/p[ãa]o de queijo/i, "Pão de queijo"],
  [/p[ãa]o/i, "Bread"],
  [/bolo/i, "Cake"],
  [/arroz/i, "Rice"],
  [/feij/i, "Common bean"],
  [/frango/i, "Chicken as food"],
  [/bife|carne bovina|picanha/i, "Beefsteak"],
  [/agua de coco|água de coco/i, "Coconut water"],
  [/castanha de caju/i, "Cashew"],
  [/tapioca/i, "Tapioca"],
  [/farofa/i, "Farofa"],
  [/cuscuz/i, "Couscous"],
  [/caja-?manga|cajamanga/i, "Spondias dulcis"],
];

export function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hasDerivedMarker(value: string) {
  return DERIVED_PATTERNS.some((pattern) => pattern.test(value));
}

function scoreOffCandidate(term: string, candidate: string) {
  const normalizedTerm = normalize(term);
  const normalizedCandidate = normalize(candidate);
  const queryTokens = tokenize(term);
  const candidateTokens = tokenize(candidate);
  const candidateSet = new Set(candidateTokens);

  let score = 0;

  if (normalizedCandidate === normalizedTerm) score += 22;
  if (normalizedCandidate.startsWith(normalizedTerm)) score += 10;
  if (normalizedCandidate.includes(normalizedTerm)) score += 6;

  let matched = 0;
  for (const token of queryTokens) {
    if (candidateSet.has(token)) {
      matched += 1;
      score += 4;
    }
  }

  if (matched === queryTokens.length && queryTokens.length > 0) score += 6;
  if (matched === 0) score -= 14;

  const queryHasDerived = hasDerivedMarker(normalizedTerm);
  const candidateHasDerived = hasDerivedMarker(normalizedCandidate);
  if (candidateHasDerived && !queryHasDerived) score -= 10;
  if (!candidateHasDerived && queryHasDerived) score -= 2;

  const extraTokens = Math.max(0, candidateTokens.length - queryTokens.length);
  if (extraTokens >= 4) score -= 2;

  return score;
}

async function searchOpenFoodFacts(term: string): Promise<OpenFoodFactsMatch | null> {
  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(term)}` +
      `&search_simple=1&action=process&json=1&page_size=8&lc=pt`;
    const res = await fetch(url, { headers: { "User-Agent": "sar-sacn/1.0" } });
    if (!res.ok) return null;

    const payload = await res.json();
    const products: any[] = payload?.products ?? [];
    if (!products.length) return null;

    const ranked = products
      .map((product) => {
        const nome =
          product.product_name_pt ||
          product.product_name ||
          product.generic_name_pt ||
          product.generic_name ||
          "";
        const score = scoreOffCandidate(term, nome);
        const nutriments = product.nutriments ?? {};

        return {
          nome,
          imagem: product.image_front_url || product.image_url || null,
          nutricao: nutriments["energy-kcal_100g"]
            ? {
                calorias: Number(nutriments["energy-kcal_100g"]) || 0,
                carboidratos_g: Number(nutriments["carbohydrates_100g"]) || 0,
                proteinas_g: Number(nutriments["proteins_100g"]) || 0,
                gorduras_g: Number(nutriments["fat_100g"]) || 0,
                fibras_g:
                  nutriments["fiber_100g"] != null ? Number(nutriments["fiber_100g"]) : undefined,
                sodio_mg:
                  nutriments["sodium_100g"] != null
                    ? Number(nutriments["sodium_100g"]) * 1000
                    : undefined,
                acucares_g:
                  nutriments["sugars_100g"] != null ? Number(nutriments["sugars_100g"]) : undefined,
              }
            : undefined,
          score:
            score +
            (product.image_front_url || product.image_url ? 2 : 0) +
            (nutriments["energy-kcal_100g"] ? 2 : 0),
        } satisfies OpenFoodFactsMatch;
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < OFF_ACCEPTANCE_SCORE) return null;
    return best;
  } catch {
    return null;
  }
}

function shouldUseNaturalHints(term: string) {
  return !hasDerivedMarker(term);
}

async function wikiThumb(term: string): Promise<string | null> {
  for (const lang of ["en", "pt"]) {
    try {
      const response = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
        { headers: { "User-Agent": "sar-sacn/1.0" } },
      );
      if (!response.ok) continue;

      const payload = await response.json();
      const image = payload?.thumbnail?.source ?? payload?.originalimage?.source ?? null;
      if (image) return String(image).replace(/\/(\d+)px-/, "/320px-");
    } catch {
      // ignore
    }
  }

  return null;
}

async function resolveWikimedia(term: string): Promise<string | null> {
  const tries: string[] = [];

  if (shouldUseNaturalHints(term)) {
    for (const [pattern, englishTerm] of PT_HINTS) {
      if (pattern.test(term)) tries.push(englishTerm);
    }
  }

  const key = normalize(term);
  const keyParts = key.split(/\s+/).filter(Boolean);
  tries.push(term, key, keyParts.slice(0, 2).join(" "));
  if (shouldUseNaturalHints(term)) tries.push(keyParts[0] ?? "");

  for (const candidate of Array.from(new Set(tries.filter(Boolean)))) {
    const image = await wikiThumb(candidate);
    if (image) return image;
  }

  return null;
}

async function aiValidate(
  term: string,
  imageUrl: string,
): Promise<{ valid: boolean; reason?: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { valid: true, reason: "ai_unavailable" };

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              'Você é um validador estrito. Responda APENAS com JSON {"valid":boolean,"reason":string}. valid=true se a imagem mostra principalmente o alimento solicitado em forma reconhecível. valid=false se mostra um prato diferente, embalagem errada, pessoa, objeto não alimentar, ou um derivado que não corresponde ao termo pedido.',
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Alimento solicitado: "${term}". A imagem corresponde exatamente a esse alimento?`,
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return { valid: true, reason: `ai_status_${response.status}` };
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    return { valid: !!parsed.valid, reason: parsed.reason };
  } catch (error) {
    return { valid: true, reason: `ai_error_${String(error)}` };
  }
}

export async function resolveFoodDetails(term: string, options?: { skipAi?: boolean }) {
  const skipAi = !!options?.skipAi;
  const sources: string[] = [];

  const off = await searchOpenFoodFacts(term);
  if (off) sources.push("open_food_facts");

  let image = off?.imagem ?? null;
  let imageSource: "open_food_facts" | "wikimedia" | null = image ? "open_food_facts" : null;

  if (!image) {
    image = await resolveWikimedia(term);
    imageSource = image ? "wikimedia" : null;
    if (image && !sources.includes("wikimedia")) sources.push("wikimedia");
  }

  let validation: { valid: boolean; reason?: string } = { valid: !!image };
  if (image && !skipAi) {
    validation = await aiValidate(term, image);
    if (!validation.valid && imageSource === "open_food_facts") {
      const wikiFallback = await resolveWikimedia(term);
      if (wikiFallback && wikiFallback !== image) {
        const fallbackValidation = await aiValidate(term, wikiFallback);
        if (fallbackValidation.valid) {
          image = wikiFallback;
          imageSource = "wikimedia";
          validation = fallbackValidation;
          if (!sources.includes("wikimedia")) sources.push("wikimedia");
        } else {
          image = null;
        }
      } else {
        image = null;
      }
    }

    if (!sources.includes("ai_validation")) sources.push("ai_validation");
  }

  return {
    nomeProduto: off?.nome || term,
    urlImagemValidada: image,
    tabelaNutricionalOficial: off?.nutricao ? { ...off.nutricao, base: "100g/100ml" } : null,
    origemDosDados: sources,
    validacao: validation,
  };
}

export function matchesRequestedFood(requested: string, candidate: string) {
  return scoreOffCandidate(requested, candidate) >= OFF_ACCEPTANCE_SCORE;
}
