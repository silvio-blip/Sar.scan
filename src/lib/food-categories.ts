import { normalizeFoodText } from "./food-emoji";

export type FoodCategory =
  | "all"
  | "frutas"
  | "carnes"
  | "peixes"
  | "ovos_laticinios"
  | "paes_massas"
  | "saladas_legumes"
  | "lanches"
  | "bebidas"
  | "doces";

export interface CategoryOption {
  id: FoodCategory;
  label: string;
  emoji: string;
}

export const FOOD_CATEGORIES: CategoryOption[] = [
  { id: "all", label: "Todos", emoji: "✨" },
  { id: "frutas", label: "Frutas", emoji: "🍎" },
  { id: "carnes", label: "Carnes & Aves", emoji: "🍗" },
  { id: "peixes", label: "Peixes & Frutos do Mar", emoji: "🐟" },
  { id: "ovos_laticinios", label: "Ovos & Queijos", emoji: "🍳" },
  { id: "paes_massas", label: "Pães, Arroz & Massas", emoji: "🍞" },
  { id: "saladas_legumes", label: "Saladas & Legumes", emoji: "🥗" },
  { id: "lanches", label: "Lanches & Pizzas", emoji: "🍔" },
  { id: "bebidas", label: "Bebidas & Shakes", emoji: "🥤" },
  { id: "doces", label: "Doces & Sobremesas", emoji: "🍫" },
];

// Regras prioritárias para alimentos compostos ou ambíguos
const COMPOSITE_CATEGORY_RULES: Array<{ patterns: string[]; category: FoodCategory }> = [
  {
    patterns: [
      "arroz com feijao",
      "baiao de dois",
      "arroz carreteiro",
      "risoto",
      "lasanha",
      "espaguete",
      "macarrao",
      "nhoque",
      "panqueca",
      "crepioca",
      "tapioca",
      "cuscuz",
      "pure de batata",
      "batata doce",
      "mandioca",
      "aipim",
    ],
    category: "paes_massas",
  },
  {
    patterns: [
      "salada caesar",
      "salada verde",
      "salpicao",
      "vinagrete",
      "legumes no vapor",
      "legumes cozidos",
      "mix de folhas",
    ],
    category: "saladas_legumes",
  },
  {
    patterns: [
      "peito de frango",
      "frango grelhado",
      "frango desfiado",
      "frango a passarinho",
      "galinhada",
      "carne moida",
      "bife de patinho",
      "picanha grelhada",
      "costela de porco",
      "contra file",
      "file mignon",
    ],
    category: "carnes",
  },
  {
    patterns: [
      "salmao grelhado",
      "file de tilapia",
      "atum em lata",
      "atum fresco",
      "sardinha em conserva",
      "bacalhau a bras",
      "camarao alho e oleo",
      "sushi",
      "sashimi",
      "temaki",
    ],
    category: "peixes",
  },
  {
    patterns: [
      "ovo cozido",
      "ovo frito",
      "ovo mexido",
      "ovos mexidos",
      "omelete",
      "queijo minas",
      "queijo coalho",
      "queijo cottage",
      "queijo mussarela",
      "requeijao",
      "iogurte grego",
      "iogurte natural",
      "whey protein",
    ],
    category: "ovos_laticinios",
  },
  {
    patterns: [
      "cheeseburger",
      "hamburguer",
      "hot dog",
      "cachorro quente",
      "pizza de",
      "fatia de pizza",
      "coxinha de frango",
      "pastel de carne",
      "pastel de queijo",
      "batata frita",
      "nuggets",
    ],
    category: "lanches",
  },
  {
    patterns: [
      "suco de laranja",
      "suco de uva",
      "suco verde",
      "agua de coco",
      "cafe expresso",
      "cafe com leite",
      "cha verde",
      "refrigerante",
      "cerveja",
      "vitamina de banana",
    ],
    category: "bebidas",
  },
  {
    patterns: [
      "bolo de chocolate",
      "bolo de cenoura",
      "pudim de leite",
      "pastel de nata",
      "chocolate ao leite",
      "brigadeiro",
      "sorvete de",
      "doce de leite",
      "mousse de",
    ],
    category: "doces",
  },
];

// Palavras-chave por categoria
const CATEGORY_KEYWORDS: Record<Exclude<FoodCategory, "all">, string[]> = {
  frutas: [
    "banana",
    "maca",
    "morango",
    "laranja",
    "limao",
    "abacaxi",
    "melancia",
    "melao",
    "kiwi",
    "uva",
    "pessego",
    "manga",
    "abacate",
    "pera",
    "mirtilo",
    "ameixa",
    "caju",
    "goiaba",
    "mamao",
    "acai",
    "cereja",
    "framboesa",
    "amora",
    "figo",
    "tangerina",
    "mexerica",
    "bergamota",
    "maracuja",
    "graviola",
    "pitanga",
    "jabuticaba",
    "damasco",
    "tamara",
    "papaya",
    "fruta",
    "frutas",
  ],
  carnes: [
    "frango",
    "peito de frango",
    "coxa",
    "sobrecoxa",
    "galinha",
    "peru",
    "chester",
    "carne",
    "bife",
    "picanha",
    "alcatra",
    "maminha",
    "patinho",
    "moida",
    "acem",
    "costela",
    "fraldinha",
    "contrafile",
    "file mignon",
    "lagarto",
    "musculo",
    "cupim",
    "cordeiro",
    "carneiro",
    "cabrito",
    "vitela",
    "porco",
    "bisteca",
    "lombo",
    "pernil",
    "bacon",
    "toucinho",
    "linguica",
    "calabresa",
    "chourico",
    "presunto",
    "salame",
    "mortadela",
    "churrasco",
  ],
  peixes: [
    "peixe",
    "salmao",
    "atum",
    "bacalhau",
    "tilapia",
    "sardinha",
    "pescada",
    "robalo",
    "dourada",
    "merluza",
    "anchova",
    "truta",
    "badejo",
    "cacao",
    "camarao",
    "lagosta",
    "caranguejo",
    "siri",
    "polvo",
    "lula",
    "ostra",
    "marisco",
    "mexilhao",
    "sushi",
    "sashimi",
    "temaki",
    "ceviche",
    "frutos do mar",
  ],
  ovos_laticinios: [
    "ovo",
    "ovos",
    "omelete",
    "clara",
    "gema",
    "queijo",
    "mussarela",
    "mozzarella",
    "parmesao",
    "cheddar",
    "prato",
    "minas",
    "coalho",
    "cottage",
    "ricota",
    "requeijao",
    "catupiry",
    "provolone",
    "gorgonzola",
    "brie",
    "gouda",
    "iogurte",
    "yogurt",
    "leite",
    "nata",
    "manteiga",
    "ghee",
    "margarina",
    "skyr",
    "kefir",
    "coalhada",
    "whey",
  ],
  paes_massas: [
    "pao",
    "paes",
    "torrada",
    "tosta",
    "baguete",
    "ciabatta",
    "brioche",
    "croissant",
    "arroz",
    "feijao",
    "grao de bico",
    "lentilha",
    "ervilha",
    "soja",
    "macarrao",
    "espaguete",
    "penne",
    "fusilli",
    "lasanha",
    "nhoque",
    "canelone",
    "ravioli",
    "ramen",
    "lamen",
    "noodles",
    "miojo",
    "aveia",
    "granola",
    "cereal",
    "muesli",
    "quinoa",
    "chia",
    "tapioca",
    "crepioca",
    "cuscuz",
    "batata",
    "mandioca",
    "aipim",
    "macaxeira",
    "inhame",
    "polenta",
    "farofa",
    "panqueca",
    "waffle",
  ],
  saladas_legumes: [
    "salada",
    "alface",
    "rucula",
    "agriao",
    "espinafre",
    "couve",
    "repolho",
    "acelga",
    "chicoria",
    "escarola",
    "tomate",
    "cenoura",
    "pepino",
    "brocolis",
    "brocolos",
    "couve flor",
    "abobrinha",
    "berinjela",
    "beringela",
    "abobora",
    "moranga",
    "chuchu",
    "quiabo",
    "vagem",
    "pimentao",
    "pimento",
    "beterraba",
    "palmito",
    "aspargo",
    "alcachofra",
    "alho",
    "cebola",
    "cogumelo",
    "shimeji",
    "shiitake",
    "champignon",
    "rabanete",
  ],
  lanches: [
    "hamburguer",
    "burger",
    "cheeseburger",
    "pizza",
    "calzone",
    "hot dog",
    "cachorro quente",
    "sanduiche",
    "sandwich",
    "wrap",
    "taco",
    "burrito",
    "quesadilla",
    "nachos",
    "coxinha",
    "pastel",
    "kibe",
    "quibe",
    "esfiha",
    "empada",
    "empadao",
    "croquete",
    "rissole",
    "nuggets",
    "batata frita",
    "pipoca",
    "salgadinho",
  ],
  bebidas: [
    "suco",
    "sumo",
    "agua",
    "cafe",
    "cappuccino",
    "espresso",
    "cha",
    "refrigerante",
    "soda",
    "coca",
    "guarana",
    "pepsi",
    "cerveja",
    "chopp",
    "vinho",
    "smoothie",
    "vitamina",
    "shake",
    "isotonico",
    "energetico",
    "kombucha",
    "coco",
    "bebida",
  ],
  doces: [
    "chocolate",
    "cacau",
    "bolo",
    "torta",
    "pudim",
    "flan",
    "brigadeiro",
    "beijinho",
    "paçoca",
    "pacoca",
    "trufa",
    "bombom",
    "sorvete",
    "gelado",
    "picole",
    "cookie",
    "biscoito",
    "bolacha",
    "brownie",
    "cheesecake",
    "tiramisu",
    "mousse",
    "donut",
    "rosquinha",
    "doce de leite",
    "mel",
    "goiabada",
    "rapadura",
    "bala",
    "pirulito",
  ],
};

/**
 * Categoriza um alimento de forma determinística
 */
export function categorizeFood(name: string): Exclude<FoodCategory, "all"> {
  if (!name) return "paes_massas";
  const normalized = normalizeFoodText(name);

  // 1. Regras prioritárias para pratos compostos
  for (const rule of COMPOSITE_CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (normalized.includes(pattern)) {
        return rule.category as Exclude<FoodCategory, "all">;
      }
    }
  }

  // 2. Busca pelas listas de palavras-chave com pontuação de relevância
  const categories = Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<FoodCategory, "all">>;
  let bestCategory: Exclude<FoodCategory, "all"> | null = null;
  let bestScore = 0;

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat];
    for (const kw of keywords) {
      if (normalized === kw) {
        return cat; // match exato
      }
      const regex = new RegExp(`(^|\\s)${kw}(\\s|$)`, "i");
      if (regex.test(normalized)) {
        const score = kw.length * 2;
        if (score > bestScore) {
          bestScore = score;
          bestCategory = cat;
        }
      } else if (normalized.includes(kw)) {
        const score = kw.length;
        if (score > bestScore) {
          bestScore = score;
          bestCategory = cat;
        }
      }
    }
  }

  if (bestCategory) return bestCategory;

  // Fallback padrão
  return "paes_massas";
}

/**
 * Verifica se um alimento pertence à categoria selecionada
 */
export function matchesCategory(foodName: string, category: FoodCategory): boolean {
  if (category === "all") return true;
  return categorizeFood(foodName) === category;
}
