// Cache-first food image resolver.
// 1. Reads from public.food_images cache.
// 2. Falls back to Wikipedia REST summary thumbnail (free, no key, fast CDN).
// 3. Persists the resolved URL so future calls are instant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PT_TO_EN: Record<string, string> = {
  arroz: "Rice",
  feijao: "Beans",
  feijão: "Beans",
  frango: "Chicken",
  ovo: "Egg",
  ovos: "Egg",
  banana: "Banana",
  maca: "Apple",
  maçã: "Apple",
  laranja: "Orange (fruit)",
  uva: "Grape",
  melancia: "Watermelon",
  abacaxi: "Pineapple",
  manga: "Mango (fruit)",
  mamao: "Papaya",
  mamão: "Papaya",
  pera: "Pear",
  morango: "Strawberry",
  carne: "Beef",
  boi: "Beef",
  peixe: "Fish as food",
  salmao: "Salmon as food",
  salmão: "Salmon as food",
  atum: "Tuna",
  camarao: "Shrimp",
  camarão: "Shrimp",
  porco: "Pork",
  bacon: "Bacon",
  presunto: "Ham",
  queijo: "Cheese",
  leite: "Milk",
  iogurte: "Yogurt",
  manteiga: "Butter",
  pao: "Bread",
  pão: "Bread",
  macarrao: "Pasta",
  macarrão: "Pasta",
  massa: "Pasta",
  batata: "Potato",
  "batata-doce": "Sweet potato",
  mandioca: "Cassava",
  milho: "Maize",
  cenoura: "Carrot",
  tomate: "Tomato",
  alface: "Lettuce",
  brocolis: "Broccoli",
  brócolis: "Broccoli",
  couve: "Kale",
  espinafre: "Spinach",
  abobrinha: "Zucchini",
  pepino: "Cucumber",
  cebola: "Onion",
  alho: "Garlic",
  azeite: "Olive oil",
  oleo: "Vegetable oil",
  óleo: "Vegetable oil",
  aveia: "Oat",
  granola: "Granola",
  cafe: "Coffee",
  café: "Coffee",
  suco: "Juice",
  refrigerante: "Soft drink",
  cerveja: "Beer",
  vinho: "Wine",
  chocolate: "Chocolate",
  bolo: "Cake",
  biscoito: "Biscuit",
  açúcar: "Sugar",
  acucar: "Sugar",
  sal: "Salt",
  pizza: "Pizza",
  hamburguer: "Hamburger",
  hambúrguer: "Hamburger",
  sanduiche: "Sandwich",
  sanduíche: "Sandwich",
  lasanha: "Lasagne",
  sopa: "Soup",
  salada: "Salad",
  arroz_branco: "White rice",
  "feijão preto": "Black turtle bean",
  "feijão carioca": "Common bean",
  tapioca: "Tapioca",
  cuscuz: "Couscous",
  farofa: "Farofa",
  picanha: "Picanha",
  açaí: "Açaí palm",
  acai: "Açaí palm",
};

// Substring patterns: if normalized name CONTAINS the key, use the value
const PT_CONTAINS: Array<[string, string]> = [
  ["caja-manga", "Spondias dulcis"],
  ["caja manga", "Spondias dulcis"],
  ["cajamanga", "Spondias dulcis"],
  ["caja", "Spondias mombin"],
  ["acai", "Açaí"],
  ["açaí", "Açaí"],
  ["pao de queijo", "Pão de queijo"],
  ["pão de queijo", "Pão de queijo"],
  ["pao frances", "Baguette"],
  ["pão francês", "Baguette"],
  ["pao integral", "Whole wheat bread"],
  ["pão integral", "Whole wheat bread"],
  ["pao de forma", "Sliced bread"],
  ["pão de forma", "Sliced bread"],
  ["pao", "Bread"],
  ["pão", "Bread"],
  ["bolo de chocolate", "Chocolate cake"],
  ["bolo de cenoura", "Carrot cake"],
  ["bolo de fuba", "Cornmeal cake"],
  ["bolo de rolo", "Bolo de rolo"],
  ["bolo", "Cake"],
  ["arroz branco", "White rice"],
  ["arroz integral", "Brown rice"],
  ["arroz", "Rice"],
  ["feijao preto", "Black turtle bean"],
  ["feijao carioca", "Carioca bean"],
  ["feijao", "Common bean"],
  ["feijão", "Common bean"],
  ["frango grelhado", "Grilled chicken"],
  ["frango assado", "Roast chicken"],
  ["frango", "Chicken as food"],
  ["bife", "Beefsteak"],
  ["picanha", "Picanha"],
  ["churrasco", "Churrasco"],
  ["salmao", "Salmon as food"],
  ["salmão", "Salmon as food"],
  ["camarao", "Shrimp"],
  ["camarão", "Shrimp"],
  ["ovo cozido", "Boiled egg"],
  ["ovo frito", "Fried egg"],
  ["ovo mexido", "Scrambled eggs"],
  ["ovos", "Egg as food"],
  ["ovo", "Egg as food"],
  ["batata doce", "Sweet potato"],
  ["batata-doce", "Sweet potato"],
  ["batata frita", "French fries"],
  ["batata", "Potato"],
  ["mandioca", "Cassava"],
  ["aipim", "Cassava"],
  ["macaxeira", "Cassava"],
  ["banana prata", "Banana"],
  ["banana nanica", "Cavendish banana"],
  ["banana", "Banana"],
  ["maca", "Apple"],
  ["maçã", "Apple"],
  ["laranja", "Orange (fruit)"],
  ["limao", "Lemon"],
  ["limão", "Lemon"],
  ["uva", "Grape"],
  ["pera", "Pear"],
  ["morango", "Strawberry"],
  ["abacaxi", "Pineapple"],
  ["mamao", "Papaya"],
  ["mamão", "Papaya"],
  ["manga", "Mango"],
  ["abacate", "Avocado"],
  ["melancia", "Watermelon"],
  ["melao", "Melon"],
  ["melão", "Melon"],
  ["kiwi", "Kiwifruit"],
  ["coco", "Coconut"],
  ["maracuja", "Passion fruit"],
  ["maracujá", "Passion fruit"],
  ["goiaba", "Guava"],
  ["caju", "Cashew apple"],
  ["tapioca", "Tapioca"],
  ["cuscuz", "Couscous"],
  ["farofa", "Farofa"],
  ["acaraje", "Acarajé"],
  ["acarajé", "Acarajé"],
  ["coxinha", "Coxinha"],
  ["pastel", "Pastel (food)"],
  ["empada", "Empanada"],
  ["brigadeiro", "Brigadeiro"],
  ["beijinho", "Beijinho"],
  ["cocada", "Cocada"],
  ["pudim", "Crème caramel"],
  ["doce de leite", "Dulce de leche"],
  ["sorvete", "Ice cream"],
  ["chocolate", "Chocolate"],
  ["pizza", "Pizza"],
  ["hamburguer", "Hamburger"],
  ["hambúrguer", "Hamburger"],
  ["lasanha", "Lasagne"],
  ["macarrao", "Pasta"],
  ["macarrão", "Pasta"],
  ["espaguete", "Spaghetti"],
  ["nhoque", "Gnocchi"],
  ["queijo", "Cheese"],
  ["leite", "Milk"],
  ["iogurte", "Yogurt"],
  ["manteiga", "Butter"],
  ["cafe", "Coffee"],
  ["café", "Coffee"],
  ["suco de laranja", "Orange juice"],
  ["suco", "Juice"],
  ["refrigerante", "Soft drink"],
  ["agua de coco", "Coconut water"],
  ["água de coco", "Coconut water"],
  ["cerveja", "Beer"],
  ["vinho", "Wine"],
  ["alface", "Lettuce"],
  ["tomate", "Tomato"],
  ["cenoura", "Carrot"],
  ["brocolis", "Broccoli"],
  ["brócolis", "Broccoli"],
  ["couve", "Kale"],
  ["espinafre", "Spinach"],
  ["pepino", "Cucumber"],
  ["abobrinha", "Zucchini"],
  ["cebola", "Onion"],
  ["alho", "Garlic"],
  ["pimentao", "Bell pepper"],
  ["pimentão", "Bell pepper"],
  ["beterraba", "Beetroot"],
  ["amendoim", "Peanut"],
  ["castanha de caju", "Cashew"],
  ["castanha do para", "Brazil nut"],
  ["nozes", "Walnut"],
  ["amendoa", "Almond"],
  ["amêndoa", "Almond"],
  ["aveia", "Oat"],
  ["granola", "Granola"],
  ["chia", "Salvia hispanica"],
  ["linhaca", "Flax"],
  ["linhaça", "Flax"],
  ["quinoa", "Quinoa"],
  ["salada", "Salad"],
  ["sopa", "Soup"],
  ["sanduiche", "Sandwich"],
  ["sanduíche", "Sandwich"],
  ["pao de mel", "Honey bread"],
  ["bauru", "Bauru (sandwich)"],
  ["misto quente", "Toasted sandwich"],
  ["torrada", "Toast"],
  ["biscoito", "Biscuit"],
  ["bolacha", "Cookie"],
  ["azeite", "Olive oil"],
  ["oleo", "Vegetable oil"],
  ["óleo", "Vegetable oil"],
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function wikiThumb(term: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
      { headers: { "User-Agent": "sar-sacn/1.0" } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const url = j?.thumbnail?.source ?? j?.originalimage?.source ?? null;
    if (!url) return null;
    // upscale to 320px via the wiki CDN URL
    return url.replace(/\/(\d+)px-/, "/320px-");
  } catch {
    return null;
  }
}

async function resolveImage(nome: string): Promise<string> {
  const key = normalize(nome);
  // 1. Substring match on PT_CONTAINS (most specific first, since the array is ordered specific→generic by category we keep first-match)
  let candidate: string | null = null;
  for (const [pat, en] of PT_CONTAINS) {
    if (key.includes(pat)) {
      candidate = en;
      break;
    }
  }
  // 2. Exact map fallback
  if (!candidate) candidate = PT_TO_EN[key] ?? PT_TO_EN[key.replace(/\s+/g, "_")] ?? null;
  // 3. First word fallback
  if (!candidate) {
    const first = key.split(/\s+/)[0];
    candidate = PT_TO_EN[first] ?? first;
  }
  const tries = Array.from(
    new Set(
      [
        candidate,
        key,
        key.replace(/\s+/g, "_"),
        key.split(/\s+/).slice(0, 2).join(" "),
        key.split(/\s+/)[0],
      ].filter(Boolean),
    ),
  );

  let url: string | null = null;
  for (const term of tries) {
    url = await wikiThumb(term);
    if (url) break;
  }
  if (!url) {
    // try the first word in PT (sometimes the wiki has a PT page)
    const first = key.split(/\s+/)[0];
    if (first && first !== candidate) url = await wikiThumb(first);
  }
  // No bad fallback — return empty so frontend shows neutral placeholder instead of wrong image.
  return url ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    let nome = (url.searchParams.get("nome") ?? "").trim();
    if (!nome && req.method === "POST") {
      try {
        const body = await req.json();
        nome = (body?.nome ?? "").trim();
      } catch {
        /* ignore */
      }
    }
    if (!nome)
      return new Response(JSON.stringify({ error: "nome required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const key = normalize(nome);
    const { data: cached } = await supabase
      .from("food_images")
      .select("url")
      .eq("nome", key)
      .maybeSingle();
    if (cached?.url) {
      return new Response(JSON.stringify({ url: cached.url, cached: true }), {
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const resolved = await resolveImage(nome);
    if (resolved) {
      await supabase
        .from("food_images")
        .upsert({ nome: key, url: resolved, updated_at: new Date().toISOString() });
    }

    return new Response(JSON.stringify({ url: resolved || null, cached: false }), {
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
