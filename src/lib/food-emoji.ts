/**
 * Biblioteca Extensiva de Emojis para Alimentos, Bebidas e Pratos Mundiais
 * Cobre milhares de termos em português, inglês e nomes internacionais com
 * normalização fonética e de acentuação automática.
 */

// Normaliza texto removendo acentos, pontuações e convertendo para minúsculas
export function normalizeFoodText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ") // remove pontuações
    .replace(/\s+/g, " ")
    .trim();
}

// 1. Mapeamento de pratos e termos compostos específicos (maior prioridade)
const EXACT_OR_COMPOSITE_MATCHES: Array<{ patterns: string[]; emoji: string }> = [
  // Pratos Tradicionais Brasileiros & Portugueses
  {
    patterns: [
      "arroz com feijao",
      "arroz e feijao",
      "feijao com arroz",
      "baiao de dois",
      "arroz carreteiro",
    ],
    emoji: "🍛",
  },
  { patterns: ["arroz de marisco", "paella de marisco", "paella valenciana"], emoji: "🥘" },
  { patterns: ["feijoada", "feijao tropeiro", "cassoulet"], emoji: "🍲" },
  { patterns: ["pastel de nata", "pastel de belem"], emoji: "🥧" },
  {
    patterns: ["caldo verde", "canja de galinha", "sopa de legumes", "creme de legumes"],
    emoji: "🍲",
  },
  {
    patterns: ["francesinha", "prego no pao", "bifana", "tosta mista", "misto quente", "bauru"],
    emoji: "🥪",
  },
  {
    patterns: ["bacalhau a bras", "bacalhau com natas", "polvo a lagareiro", "arroz de marisco"],
    emoji: "🥘",
  },
  { patterns: ["pao de queijo"], emoji: "🧀" },
  { patterns: ["pao de alho"], emoji: "🧄" },
  {
    patterns: ["acai na tigela", "acai com granola", "acai bowl", "creme de acai", "polpa de acai"],
    emoji: "🫐",
  },
  { patterns: ["tapioca", "crepioca", "beiju", "arepa"], emoji: "🫓" },
  {
    patterns: [
      "picanha grelhada",
      "picanha na brasa",
      "churrasco",
      "espetinho de carne",
      "contra file",
      "file mignon",
    ],
    emoji: "🥩",
  },
  {
    patterns: ["peito de frango", "frango grelhado", "frango a passarinho", "galeto", "galinhada"],
    emoji: "🍗",
  },
  { patterns: ["nuggets de frango", "nuggets", "empanado de frango"], emoji: "🍗" },
  {
    patterns: ["salmao grelhado", "file de tilapia", "sardinha assada", "atum grelhado"],
    emoji: "🐟",
  },
  { patterns: ["salada de frutas", "salada frutas"], emoji: "🍓" },
  { patterns: ["salada caesar", "salada ceasar", "salpicao", "vinagrete"], emoji: "🥗" },
  {
    patterns: [
      "batata frita",
      "batatas fritas",
      "french fries",
      "fritas crocantes",
      "mandioca frita",
    ],
    emoji: "🍟",
  },
  { patterns: ["batata doce assada", "batata doce cozida", "batata doce"], emoji: "🍠" },
  {
    patterns: ["pure de batata", "pure de batatas", "batata cozida", "batata assada"],
    emoji: "🥔",
  },
  { patterns: ["cachorro quente", "hot dog", "hotdog"], emoji: "🌭" },
  {
    patterns: ["hamburguer", "cheeseburger", "burger", "x burguer", "x tudo", "smash burger"],
    emoji: "🍔",
  },
  {
    patterns: [
      "pizza de mussarela",
      "pizza de pepperoni",
      "pizza de queijo",
      "pizza margherita",
      "fatia de pizza",
    ],
    emoji: "🍕",
  },
  { patterns: ["pad thai", "yakisoba", "chow mein", "macarrao frito"], emoji: "🍜" },
  {
    patterns: [
      "sushi combinado",
      "sashimi de salmao",
      "temaki de salmao",
      "hot roll",
      "uramaki",
      "niguiri",
    ],
    emoji: "🍣",
  },
  {
    patterns: ["nachos com queijo", "guacamole com nachos", "nachos", "tortilhas com queijo"],
    emoji: "🌮",
  },
  {
    patterns: ["burrito mexicano", "burrito de frango", "burrito de carne", "fajitas"],
    emoji: "🌯",
  },
  { patterns: ["tacos mexicanos", "taco de frango", "taco de carne"], emoji: "🌮" },
  { patterns: ["pasta de amendoim", "manteiga de amendoim", "peanut butter"], emoji: "🥜" },
  {
    patterns: [
      "whey protein",
      "proteina do soro",
      "caseina",
      "shake de proteina",
      "creatina",
      "bcaa",
      "hipercalorico",
      "barra de proteina",
    ],
    emoji: "🥛",
  },
  { patterns: ["leite condensado", "creme de leite", "doce de leite"], emoji: "🥛" },
  { patterns: ["agua de coco", "leite de coco"], emoji: "🥥" },
  { patterns: ["suco de laranja", "sumo de laranja"], emoji: "🍊" },
  { patterns: ["suco de limao", "limonada", "sumo de limao"], emoji: "🍋" },
  { patterns: ["suco de uva", "sumo de uva"], emoji: "🍇" },
  { patterns: ["suco de maca", "sumo de maca"], emoji: "🍎" },
  {
    patterns: ["suco de maracuja", "suco de manga", "suco de abacaxi", "suco verde", "smoothie"],
    emoji: "🥤",
  },
  {
    patterns: [
      "cafe com leite",
      "pingado",
      "cappuccino",
      "capuccino",
      "cafe expresso",
      "espresso",
      "latte",
      "mocha",
      "moca",
    ],
    emoji: "☕",
  },
  { patterns: ["caldo de cana", "garapa"], emoji: "🥤" },
  { patterns: ["cuscuz", "farofa", "farinha de mandioca"], emoji: "🌽" },
  { patterns: ["acaraje", "vatapa", "bobo de camarao"], emoji: "🥘" },
  { patterns: ["escondidinho"], emoji: "🥔" },
  {
    patterns: [
      "cha verde",
      "cha preto",
      "cha de camomila",
      "cha mate",
      "chimarrao",
      "tereré",
      "terere",
    ],
    emoji: "🍵",
  },
  {
    patterns: ["agua mineral", "agua com gas", "agua sem gas", "agua da torneira", "agua fresca"],
    emoji: "💧",
  },
  {
    patterns: ["bolo de chocolate", "bolo de cenoura", "bolo de fubá", "bolo de fuba"],
    emoji: "🍰",
  },
  { patterns: ["pudim de leite", "pudim de leite moca", "creme caramel"], emoji: "🍮" },
  {
    patterns: [
      "coxinha de frango",
      "coxinha",
      "empada",
      "empadao",
      "kibe",
      "quibe",
      "esfiha",
      "pastel de feira",
      "guioza",
      "dumpling",
    ],
    emoji: "🥟",
  },
  { patterns: ["pipoca doce", "pipoca salgada", "pipoca de microondas"], emoji: "🍿" },
  {
    patterns: [
      "brigadeiro",
      "beijinho",
      "trufa de chocolate",
      "bombom",
      "barra de chocolate",
      "brownie",
    ],
    emoji: "🍫",
  },
  {
    patterns: ["mousse de chocolate", "mousse de maracuja", "pave", "tiramisu", "cheesecake"],
    emoji: "🍰",
  },
  {
    patterns: [
      "sorvete de chocolate",
      "sorvete de baunilha",
      "sorvete de morango",
      "gelado de fruta",
      "picole",
    ],
    emoji: "🍨",
  },
  {
    patterns: [
      "mingau de aveia",
      "aveia em flocos",
      "farelo de aveia",
      "granola crocante",
      "muesli",
    ],
    emoji: "🥣",
  },
  {
    patterns: [
      "queijo minas",
      "queijo coalho",
      "queijo cottage",
      "queijo ricota",
      "queijo prato",
      "queijo mussarela",
      "queijo parmesao",
    ],
    emoji: "🧀",
  },
];

// 2. Mapeamento extensivo baseado em palavras-chave por grupo
const KEYWORD_GROUPS: Array<{ keywords: string[]; emoji: string }> = [
  // --- FRUTAS ---
  { keywords: ["maca", "macas", "apple", "fuji", "gala", "red delicious"], emoji: "🍎" },
  { keywords: ["maca verde", "green apple", "granny smith"], emoji: "🍏" },
  {
    keywords: ["banana", "bananas", "banana prata", "nanica", "banana da terra", "caturra", "platano"],
    emoji: "🍌",
  },
  {
    keywords: [
      "laranja",
      "laranjas",
      "orange",
      "tangerina",
      "mexerica",
      "bergamota",
      "mandarina",
      "clementina",
    ],
    emoji: "🍊",
  },
  { keywords: ["limao", "limoes", "lemon", "lime", "lima", "siciliano", "taiti"], emoji: "🍋" },
  { keywords: ["melancia", "watermelon"], emoji: "🍉" },
  { keywords: ["melao", "melon", "cantaloupe"], emoji: "🍈" },
  { keywords: ["morango", "morangos", "strawberry"], emoji: "🍓" },
  { keywords: ["uva", "uvas", "grape", "passa", "passas", "sultana"], emoji: "🍇" },
  { keywords: ["cereja", "cerejas", "cherry"], emoji: "🍒" },
  { keywords: ["pessego", "pessegos", "peach", "nectarina", "damasco", "alperce"], emoji: "🍑" },
  { keywords: ["manga", "mangas", "mango", "tommy", "palmer", "espada"], emoji: "🥭" },
  { keywords: ["abacaxi", "abacaxis", "ananas", "pineapple"], emoji: "🍍" },
  { keywords: ["coco", "cocos", "coconut"], emoji: "🥥" },
  { keywords: ["kiwi", "kiwis"], emoji: "🥝" },
  { keywords: ["pera", "peras", "pear"], emoji: "🍐" },
  {
    keywords: [
      "mirtilo",
      "mirtilos",
      "blueberry",
      "framboesa",
      "amora",
      "blackberry",
      "raspberry",
      "frutas vermelhas",
      "acai",
    ],
    emoji: "🫐",
  },
  { keywords: ["abacate", "abacates", "avocado", "guacamole"], emoji: "🥑" },
  { keywords: ["mamao", "papaya", "formosa"], emoji: "🍈" },
  { keywords: ["maracuja", "passion fruit"], emoji: "🍊" },
  { keywords: ["figo", "figos", "tamara", "tamaras", "ameixa", "ameixas"], emoji: "🫐" },
  {
    keywords: ["goiaba", "caju", "pitanga", "jabuticaba", "graviola", "carambola", "caqui"],
    emoji: "🍎",
  },

  // --- LEGUMES, VERDURAS & VEGETAIS ---
  { keywords: ["tomate", "tomates", "tomato", "cereja", "pomodoro"], emoji: "🍅" },
  { keywords: ["brocolis", "brocolos", "broccoli", "couve flor", "couveflor"], emoji: "🥦" },
  {
    keywords: [
      "alface",
      "rucula",
      "agriao",
      "espinafre",
      "couve",
      "acelga",
      "chicoria",
      "escarola",
      "repolho",
      "folhas",
      "salada",
    ],
    emoji: "🥬",
  },
  { keywords: ["cenoura", "cenouras", "carrot"], emoji: "🥕" },
  { keywords: ["pepino", "pepinos", "cucumber", "picles", "pickle"], emoji: "🥒" },
  { keywords: ["pimentao", "pimento", "bell pepper"], emoji: "🫑" },
  {
    keywords: [
      "pimenta",
      "pimentas",
      "chilli",
      "chili",
      "pepper",
      "jalapeno",
      "malagueta",
      "tabasco",
      "habanero",
    ],
    emoji: "🌶️",
  },
  {
    keywords: ["milho", "corn", "curau", "pamonha", "polenta", "milharina", "cuscuz"],
    emoji: "🌽",
  },
  {
    keywords: ["batata doce", "sweet potato", "mandioca", "aipim", "macaxeira", "inhame", "cara"],
    emoji: "🍠",
  },
  { keywords: ["batata", "batatas", "potato", "pure"], emoji: "🥔" },
  { keywords: ["alho", "garlic", "alho poro"], emoji: "🧄" },
  { keywords: ["cebola", "cebolas", "onion", "cebolinha", "chalota"], emoji: "🧅" },
  {
    keywords: [
      "cogumelo",
      "cogumelos",
      "mushroom",
      "shimeji",
      "shiitake",
      "champignon",
      "portobello",
    ],
    emoji: "🍄",
  },
  { keywords: ["berinjela", "beringela", "eggplant", "aubergine"], emoji: "🍆" },
  {
    keywords: ["abobora", "moranga", "jerimum", "abobrinha", "chuchu", "pumpkin", "zucchini"],
    emoji: "🎃",
  },
  { keywords: ["ervilha", "ervilhas", "pea", "peas", "vagem", "edamame"], emoji: "🫛" },
  { keywords: ["gengibre", "ginger"], emoji: "🫚" },
  { keywords: ["azeitona", "azeitonas", "olive", "olives", "azeite", "oliva"], emoji: "🫒" },
  { keywords: ["palmito", "aspargo", "alcachofra", "beterraba"], emoji: "🥗" },

  // --- CARNES, AVES & PEIXES ---
  {
    keywords: [
      "frango",
      "chicken",
      "galinha",
      "peru",
      "chester",
      "asa",
      "coxa",
      "sobrecoxa",
      "peito",
      "fillet",
    ],
    emoji: "🍗",
  },
  {
    keywords: [
      "carne",
      "bife",
      "picanha",
      "alcatra",
      "maminha",
      "costela",
      "fraldinha",
      "contrafile",
      "patinho",
      "moida",
      "carne moida",
      "novilho",
      "vaca",
      "carne de boi",
      "vitela",
      "beef",
      "steak",
    ],
    emoji: "🥩",
  },
  {
    keywords: [
      "porco",
      "pork",
      "leitao",
      "lombo",
      "pernil",
      "bisteca",
      "costelinha",
      "toucinho",
      "bacon",
      "pancetta",
      "presunto",
      "jamon",
    ],
    emoji: "🥓",
  },
  {
    keywords: [
      "salsicha",
      "linguica",
      "chourico",
      "calabresa",
      "hot dog",
      "hotdog",
      "salame",
      "mortadela",
      "pepperoni",
      "embutido",
    ],
    emoji: "🌭",
  },
  { keywords: ["cordeiro", "carneiro", "cabrito", "ossobuco", "chuleton"], emoji: "🍖" },
  {
    keywords: [
      "peixe",
      "fish",
      "salmao",
      "salmon",
      "atum",
      "tuna",
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
    ],
    emoji: "🐟",
  },
  { keywords: ["camarao", "camaroes", "shrimp", "prawn", "gambas", "lagostim"], emoji: "🦐" },
  { keywords: ["lagosta", "lobster"], emoji: "🦞" },
  { keywords: ["caranguejo", "siri", "crab"], emoji: "🦀" },
  { keywords: ["polvo", "octopus"], emoji: "🐙" },
  { keywords: ["lula", "calamari", "squid", "choco"], emoji: "🦑" },
  {
    keywords: ["ostra", "ostras", "marisco", "mariscos", "mexilhao", "ameijoa", "clam", "mussel"],
    emoji: "🦪",
  },
  {
    keywords: ["sushi", "sashimi", "temaki", "niguiri", "uramaki", "hotroll", "wasabi"],
    emoji: "🍣",
  },

  // --- OVOS & LATICÍNIOS ---
  {
    keywords: [
      "ovo",
      "ovos",
      "egg",
      "eggs",
      "omelete",
      "omelet",
      "ovo mexido",
      "ovos mexidos",
      "ovo cozido",
      "ovos cozidos",
      "ovo frito",
      "ovos fritos",
      "ovo poche",
      "ovo poché",
      "clara de ovo",
      "gema de ovo",
      "clara",
      "gema",
    ],
    emoji: "🍳",
  },
  {
    keywords: [
      "queijo",
      "queijos",
      "cheese",
      "mussarela",
      "mozzarella",
      "parmesao",
      "cheddar",
      "ricota",
      "cottage",
      "provolone",
      "gorgonzola",
      "brie",
      "gouda",
      "requeijao",
      "catupiry",
    ],
    emoji: "🧀",
  },
  { keywords: ["manteiga", "butter", "ghee", "margarina"], emoji: "🧈" },
  {
    keywords: ["leite", "milk", "iogurte", "yogurt", "skyr", "kefir", "coalhada", "whey", "nata"],
    emoji: "🥛",
  },

  // --- GRÃOS, CEREAIS & LEGUMINOSAS ---
  {
    keywords: ["feijao", "feijoes", "beans", "grao de bico", "lentilha", "soja", "tofu", "fava"],
    emoji: "🫘",
  },
  { keywords: ["arroz", "rice", "risoto", "risotto"], emoji: "🍚" },
  { keywords: ["aveia", "oats", "granola", "muesli", "cereal", "mingau", "porridge"], emoji: "🥣" },
  { keywords: ["quinoa", "chia", "linhaca", "amaranto", "farelo"], emoji: "🥣" },
  { keywords: ["amendoim", "peanut", "peanuts", "amendoins"], emoji: "🥜" },
  {
    keywords: [
      "castanha",
      "castanhas",
      "noz",
      "nozes",
      "amendoa",
      "amendoas",
      "avela",
      "avelas",
      "pistache",
      "pistachio",
      "macadamia",
    ],
    emoji: "🌰",
  },

  // --- MASSAS, PANIFICAÇÃO & LANCHES ---
  {
    keywords: [
      "pao",
      "paes",
      "bread",
      "torrada",
      "tosta",
      "baguete",
      "ciabatta",
      "brioche",
      "bisnaguinha",
      "pao frances",
      "pao integral",
    ],
    emoji: "🍞",
  },
  { keywords: ["croissant", "folhado", "medialuna"], emoji: "🥐" },
  { keywords: ["bagel", "rosca", "pretzel"], emoji: "🥯" },
  { keywords: ["panqueca", "panquecas", "pancake", "crepe", "crepes"], emoji: "🥞" },
  { keywords: ["waffle", "waffles"], emoji: "🧇" },
  {
    keywords: [
      "macarrao",
      "massa",
      "pasta",
      "espaguete",
      "spaghetti",
      "penne",
      "fusilli",
      "talharim",
      "fettuccine",
      "lasanha",
      "lasagna",
      "nhoque",
      "gnocchi",
      "ravioli",
      "canelone",
      "carbonara",
      "bolonhesa",
      "pesto",
    ],
    emoji: "🍝",
  },
  { keywords: ["ramen", "lamen", "noodles", "miojo", "udon", "yakisoba", "soba"], emoji: "🍜" },
  { keywords: ["pizza", "calzone"], emoji: "🍕" },
  { keywords: ["hamburguer", "burger", "cheeseburger", "xburger"], emoji: "🍔" },
  { keywords: ["sanduiche", "sandwich", "wrap", "panini", "sub", "tosta", "lanche"], emoji: "🥪" },
  { keywords: ["taco", "tacos", "nachos", "quesadilla", "fajita"], emoji: "🌮" },
  { keywords: ["burrito", "burritos"], emoji: "🌯" },
  { keywords: ["falafel", "kebab", "shawarma", "pita"], emoji: "🥙" },
  {
    keywords: [
      "salgado",
      "coxinha",
      "pastel",
      "quibe",
      "kibe",
      "esfiha",
      "empada",
      "empadao",
      "croquete",
      "rissole",
      "bolinho",
      "guioza",
      "dumpling",
    ],
    emoji: "🥟",
  },
  { keywords: ["pipoca", "popcorn"], emoji: "🍿" },

  // --- SOPAS & PRATOS DE PANELA ---
  {
    keywords: [
      "sopa",
      "sopas",
      "soup",
      "caldo",
      "canja",
      "ensopado",
      "guisado",
      "veloute",
    ],
    emoji: "🍲",
  },
  {
    keywords: [
      "paella",
      "moqueca",
      "bobo",
      "vatapa",
      "caril",
      "curry",
      "estrogonofe",
      "strogonoff",
    ],
    emoji: "🥘",
  },
  { keywords: ["fondue"], emoji: "🫕" },

  // --- DOCES & SOBREMESAS ---
  {
    keywords: [
      "chocolate",
      "cacau",
      "cocoa",
      "trufa",
      "bombom",
      "brigadeiro",
      "beijinho",
      "brownie",
      "nutella",
    ],
    emoji: "🍫",
  },
  {
    keywords: ["bolo", "cake", "torta", "cheesecake", "tiramisu", "panetone", "chocotone"],
    emoji: "🍰",
  },
  { keywords: ["torta doce", "pie", "tart", "quiche"], emoji: "🥧" },
  { keywords: ["cupcake", "muffin"], emoji: "🧁" },
  { keywords: ["pudim", "flan", "quindim", "manjar", "mousse", "creme brulee"], emoji: "🍮" },
  { keywords: ["sorvete", "gelado", "ice cream", "gelato", "sundae", "frozen"], emoji: "🍨" },
  { keywords: ["picole", "popsicle"], emoji: "🍦" },
  { keywords: ["donut", "donuts", "rosquinha", "sonho"], emoji: "🍩" },
  { keywords: ["cookie", "cookies", "biscoito", "bolacha", "wafer"], emoji: "🍪" },
  {
    keywords: ["bala", "balas", "candy", "bombom", "caramelo", "jujuba", "marshmallow", "goma"],
    emoji: "🍬",
  },
  { keywords: ["pirulito", "lollipop"], emoji: "🍭" },
  { keywords: ["mel", "honey", "melaco", "xarope", "syrup"], emoji: "🍯" },

  // --- BEBIDAS ---
  { keywords: ["agua", "water", "mineral", "h2o"], emoji: "💧" },
  { keywords: ["gelo", "ice", "gelada"], emoji: "🧊" },
  {
    keywords: ["cafe", "coffee", "expresso", "espresso", "cappuccino", "latte", "macchiato"],
    emoji: "☕",
  },
  { keywords: ["cha", "tea", "infusao", "camomila", "hortela", "matcha"], emoji: "🫖" },
  { keywords: ["mate", "chimarrao", "terere"], emoji: "🧉" },
  {
    keywords: ["suco", "sumo", "juice", "vitamina", "smoothie", "refresco", "nectar"],
    emoji: "🥤",
  },
  {
    keywords: ["refrigerante", "soda", "coca", "coca cola", "guarana", "pepsi", "fanta", "sprite"],
    emoji: "🥤",
  },
  {
    keywords: ["cerveja", "beer", "chopp", "chope", "ipa", "lager", "pilsen", "stout"],
    emoji: "🍺",
  },
  { keywords: ["vinho", "wine", "tinto", "branco", "rose", "porto"], emoji: "🍷" },
  { keywords: ["champanhe", "champagne", "espumante", "prosecco", "cava", "sidra"], emoji: "🍾" },
  {
    keywords: ["coquetel", "cocktail", "caipirinha", "mojito", "margarita", "martini", "gin"],
    emoji: "🍸",
  },
  {
    keywords: [
      "whisky",
      "whiskey",
      "vodka",
      "rum",
      "cachaca",
      "tequila",
      "bourbon",
      "conhaque",
      "licor",
    ],
    emoji: "🥃",
  },
  { keywords: ["achocolatado", "toddy", "nescau", "toddynho"], emoji: "🧃" },
  { keywords: ["boba", "bubble tea"], emoji: "🧋" },
];

/**
 * Emoji padrão utilizado quando o alimento não possui representação específica
 * Prato com talheres (garfo e faca com prato: 🍽️)
 */
export const DEFAULT_FOOD_EMOJI = "🍽️";

/**
 * Função principal para obter o emoji ideal do alimento.
 * Se nenhum emoji correspondente for encontrado na base de regras e categorias,
 * retorna rigorosamente o emoji padrão do prato com talheres ("🍽️").
 */
export function getFoodEmoji(name: string): string {
  if (!name || typeof name !== "string") return DEFAULT_FOOD_EMOJI;

  const normalized = normalizeFoodText(name);
  if (!normalized) return DEFAULT_FOOD_EMOJI;

  // 1. Busca exata ou por termo composto específico (prioritária)
  for (const item of EXACT_OR_COMPOSITE_MATCHES) {
    for (const pattern of item.patterns) {
      if (normalized.includes(pattern)) {
        return item.emoji;
      }
    }
  }

  // 2. Busca rigorosa por palavras-chave com limite de palavra (evita falsos positivos como boi em parboilizado ou maca em macarrao)
  for (const group of KEYWORD_GROUPS) {
    for (const keyword of group.keywords) {
      const cleanKeyword = normalizeFoodText(keyword);
      if (!cleanKeyword) continue;

      if (cleanKeyword.includes(" ")) {
        // Frase composta: verifica substring
        if (normalized.includes(cleanKeyword)) {
          return group.emoji;
        }
      } else {
        // Palavra única: exige palavra inteira via RegExp boundary
        const regex = new RegExp(`(^|\\s)${cleanKeyword}(\\s|$)`, "i");
        if (regex.test(normalized)) {
          return group.emoji;
        }
      }
    }
  }

  // 3. Fallback inteligente por token individual apenas se for radical válido da palavra (evita 'alimento' pegar 'lima')
  const tokens = normalized.split(/\s+/);
  for (const token of tokens) {
    if (token.length < 4) continue;
    // Ignora palavras genéricas
    if (["alimento", "gramas", "porcao", "fatia", "unidade", "copo", "prato", "colher"].includes(token)) {
      continue;
    }
    for (const group of KEYWORD_GROUPS) {
      for (const keyword of group.keywords) {
        const cleanKeyword = normalizeFoodText(keyword);
        if (cleanKeyword.length >= 5 && (token.startsWith(cleanKeyword) || cleanKeyword.startsWith(token))) {
          return group.emoji;
        }
      }
    }
  }

  // Fallback padrão amigável: Prato com garfo e faca
  return DEFAULT_FOOD_EMOJI;
}

/**
 * Coleção categorizada de emojis para visualização ou seletores futuros
 */
export const FOOD_EMOJI_CATEGORIES = [
  {
    name: "Frutas",
    emojis: [
      "🍎",
      "🍏",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🥑",
    ],
  },
  {
    name: "Legumes & Verduras",
    emojis: [
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🌽",
      "🥕",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🍅",
      "🍆",
      "🍄",
      "🎃",
      "🫛",
      "🫒",
      "🥗",
    ],
  },
  {
    name: "Carnes & Proteínas",
    emojis: [
      "🥩",
      "🍗",
      "🍖",
      "🥓",
      "🌭",
      "🍔",
      "🍳",
      "🥚",
      "🧀",
      "🐟",
      "🦐",
      "🦞",
      "🦀",
      "🐙",
      "🦑",
      "🦪",
    ],
  },
  {
    name: "Massas, Grãos & Pães",
    emojis: [
      "🍚",
      "🍛",
      "🫘",
      "🥣",
      "🍝",
      "🍜",
      "🍞",
      "🥖",
      "🥐",
      "🥯",
      "🥨",
      "🥞",
      "🧇",
      "🫓",
      "🍕",
      "🥪",
      "🌮",
      "🌯",
      "🥙",
      "🥟",
    ],
  },
  {
    name: "Doces & Sobremesas",
    emojis: ["🍫", "🍰", "🎂", "🥧", "🧁", "🍮", "🍨", "🍦", "🍩", "🍪", "🍬", "🍭", "🍯", "🍿"],
  },
  {
    name: "Bebidas",
    emojis: [
      "💧",
      "🥛",
      "☕",
      "🫖",
      "🍵",
      "🧉",
      "🥤",
      "🧃",
      "🧋",
      "🍺",
      "🍻",
      "🍷",
      "🍾",
      "🍸",
      "🍹",
      "🥃",
    ],
  },
];
