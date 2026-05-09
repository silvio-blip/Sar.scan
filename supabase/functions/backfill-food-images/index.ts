// Batch backfill: resolves images for foods_basic rows whose foto_url is
// missing or known-bad (unsplash/weserv/placeholder). Uses Wikipedia/Wikimedia
// via the food-image resolver logic, then writes results to foods_basic and
// the food_images cache. Idempotent — safe to call repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!res.ok) {
      const pt = await fetch(
        `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
        { headers: { "User-Agent": "sar-sacn/1.0" } },
      );
      if (!pt.ok) return null;
      const j = await pt.json();
      const url = j?.thumbnail?.source ?? j?.originalimage?.source ?? null;
      return url ? url.replace(/\/(\d+)px-/, "/320px-") : null;
    }
    const j = await res.json();
    const url = j?.thumbnail?.source ?? j?.originalimage?.source ?? null;
    return url ? url.replace(/\/(\d+)px-/, "/320px-") : null;
  } catch {
    return null;
  }
}

const PT_HINTS: Array<[RegExp, string]> = [
  [/bife|carne bovina|picanha/i, "Beefsteak"],
  [/frango/i, "Chicken as food"],
  [/empad/i, "Empanada"],
  [/pudim/i, "Crème caramel"],
  [/agua de coco|água de coco/i, "Coconut water"],
  [/castanha de caju/i, "Cashew"],
  [/castanha do par/i, "Brazil nut"],
  [/caldo de feij/i, "Bean soup"],
  [/cural|curau|canjica/i, "Canjica"],
  [/abacate/i, "Avocado"],
  [/manga/i, "Mango"],
  [/banana/i, "Banana"],
  [/arroz/i, "Rice"],
  [/feij/i, "Common bean"],
  [/p[ãa]o de queijo/i, "Pão de queijo"],
  [/p[ãa]o/i, "Bread"],
  [/bolo/i, "Cake"],
  [/aca[ií]/i, "Açaí"],
];

async function resolveOne(nome: string): Promise<string | null> {
  const key = normalize(nome);
  const tries: string[] = [];
  for (const [re, en] of PT_HINTS) if (re.test(nome)) tries.push(en);
  tries.push(nome, key, key.split(/\s+/).slice(0, 2).join(" "), key.split(/\s+/)[0]);
  for (const t of Array.from(new Set(tries.filter(Boolean)))) {
    const u = await wikiThumb(t);
    if (u) return u;
  }
  return null;
}

const BAD = /(unsplash|weserv|placeholder)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find candidates: missing or bad foto_url
    const { data: foods, error } = await supabase.from("foods_basic").select("id, nome, foto_url");
    if (error) throw error;

    const targets = (foods ?? []).filter(
      (f) => !f.foto_url || f.foto_url.trim() === "" || BAD.test(f.foto_url),
    );

    let updated = 0;
    let skipped = 0;
    for (const f of targets) {
      const url = await resolveOne(f.nome);
      if (!url) {
        skipped++;
        continue;
      }
      await supabase.from("foods_basic").update({ foto_url: url }).eq("id", f.id);
      await supabase
        .from("food_images")
        .upsert({ nome: normalize(f.nome), url, updated_at: new Date().toISOString() });
      updated++;
      // small delay to be polite
      await new Promise((r) => setTimeout(r, 120));
    }

    return new Response(JSON.stringify({ scanned: targets.length, updated, skipped }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
