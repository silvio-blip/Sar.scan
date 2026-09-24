import type { Language } from "./strings";

const FOOD_TRANSLATIONS: Record<string, { en: string; fr: string }> = {
  // Arroz e Cereais
  "arroz branco": { en: "White Rice", fr: "Riz Blanc" },
  "arroz integral": { en: "Brown Rice", fr: "Riz Complet" },
  "arroz com feijao": { en: "Rice and Beans", fr: "Riz et Haricots" },
  "arroz carreteiro": { en: "Beef Rice Stew", fr: "Riz au Boeuf Sauté" },
  "arroz a grega": { en: "Greek Rice", fr: "Riz aux Légumes" },
  "risoto de cogumelos": { en: "Mushroom Risotto", fr: "Risotto aux Champignons" },
  "risoto de frango": { en: "Chicken Risotto", fr: "Risotto au Poulet" },
  "feijao carioca": { en: "Pinto Beans", fr: "Haricots Pinto" },
  "feijao preto": { en: "Black Beans", fr: "Haricots Noirs" },
  feijoada: { en: "Feijoada (Black Bean Stew)", fr: "Feijoada (Ragoût de Haricots)" },
  lentilha: { en: "Lentils", fr: "Lentilles" },
  "grao de bico": { en: "Chickpeas", fr: "Pois Chiches" },
  "quinoa cozida": { en: "Cooked Quinoa", fr: "Quinoa Cuit" },
  "aveia em flocos": { en: "Rolled Oats", fr: "Flocons d'Avoine" },
  "cuscuz de milho": { en: "Corn Couscous", fr: "Couscous de Maïs" },
  "tapioca recheada": { en: "Filled Tapioca", fr: "Tapioca Garnie" },

  // Carnes & Aves
  "peito de frango grelhado": { en: "Grilled Chicken Breast", fr: "Blanc de Poulet Grillé" },
  "peito de frango": { en: "Chicken Breast", fr: "Blanc de Poulet" },
  "frango grelhado": { en: "Grilled Chicken", fr: "Poulet Grillé" },
  "frango assado": { en: "Roast Chicken", fr: "Poulet Rôti" },
  "frango desfiado": { en: "Shredded Chicken", fr: "Poulet Effiloché" },
  "bife de alcatra": { en: "Sirloin Steak", fr: "Steak de Boeuf" },
  "bife de patinho": { en: "Lean Beef Steak", fr: "Steak Maigre" },
  "bife grelhado": { en: "Grilled Steak", fr: "Steak Grillé" },
  "file mignon grelhado": { en: "Grilled Tenderloin", fr: "Filet Mignon Grillé" },
  "carne moida": { en: "Ground Beef", fr: "Boeuf Haché" },
  "picanha grelhada": { en: "Grilled Picanha", fr: "Picanha Grillée" },
  "costela bovina": { en: "Beef Ribs", fr: "Côtes de Boeuf" },
  "lombo de porco": { en: "Pork Loin", fr: "Longe de Porc" },
  "costelinha de porco": { en: "Pork Ribs", fr: "Travers de Porc" },
  "hamburguer bovino": { en: "Beef Burger Patty", fr: "Steak Haché Burger" },

  // Peixes & Frutos do Mar
  "salmao grelhado": { en: "Grilled Salmon", fr: "Saumon Grillé" },
  salmao: { en: "Salmon", fr: "Saumon" },
  "file de tilapia": { en: "Tilapia Fillet", fr: "Filet de Tilapia" },
  "atum fresco": { en: "Fresh Tuna", fr: "Thon Frais" },
  "atum em lata": { en: "Canned Tuna", fr: "Thon en Boîte" },
  sardinha: { en: "Sardine", fr: "Sardine" },
  "camarao grelhado": { en: "Grilled Shrimp", fr: "Crevettes Grillées" },
  camarao: { en: "Shrimp", fr: "Crevettes" },
  bacalhau: { en: "Codfish", fr: "Morue" },
  "sushi variado": { en: "Assorted Sushi", fr: "Sushi Assorti" },
  "sashimi de salmao": { en: "Salmon Sashimi", fr: "Sashimi de Saumon" },

  // Ovos e Laticínios
  "ovo cozido": { en: "Boiled Egg", fr: "Oeuf Dur" },
  "ovo frito": { en: "Fried Egg", fr: "Oeuf au Plat" },
  "ovos mexidos": { en: "Scrambled Eggs", fr: "Oeufs Brouillés" },
  "omelete simples": { en: "Plain Omelet", fr: "Omelette Nature" },
  "omelete de queijo": { en: "Cheese Omelet", fr: "Omelette au Fromage" },
  "queijo mussarela": { en: "Mozzarella Cheese", fr: "Mozzarella" },
  "queijo prato": { en: "Yellow Cheese", fr: "Fromage Gouda / Edam" },
  "queijo minas": { en: "Fresh White Cheese", fr: "Fromage Frais" },
  "queijo cottage": { en: "Cottage Cheese", fr: "Fromage Cottage" },
  "requeijao cremoso": { en: "Cream Cheese Spread", fr: "Fromage à Tartiner" },
  "leite desnatado": { en: "Skimmed Milk", fr: "Lait Écrémé" },
  "leite integral": { en: "Whole Milk", fr: "Lait Entier" },
  "iogurte natural": { en: "Plain Yogurt", fr: "Yaourt Nature" },
  "iogurte grego": { en: "Greek Yogurt", fr: "Yaourt Grec" },
  "whey protein": { en: "Whey Protein", fr: "Protéine Whey" },

  // Frutas
  maca: { en: "Apple", fr: "Pomme" },
  maçã: { en: "Apple", fr: "Pomme" },
  "banana prata": { en: "Banana", fr: "Banane" },
  banana: { en: "Banana", fr: "Banane" },
  laranja: { en: "Orange", fr: "Orange" },
  morango: { en: "Strawberry", fr: "Fraise" },
  morangos: { en: "Strawberries", fr: "Fraises" },
  abacaxi: { en: "Pineapple", fr: "Ananas" },
  mamao: { en: "Papaya", fr: "Papaye" },
  mamão: { en: "Papaya", fr: "Papaye" },
  manga: { en: "Mango", fr: "Mangue" },
  melancia: { en: "Watermelon", fr: "Pastèque" },
  melao: { en: "Melon", fr: "Melon" },
  melão: { en: "Melon", fr: "Melon" },
  abacate: { en: "Avocado", fr: "Avocat" },
  uva: { en: "Grapes", fr: "Raisins" },
  kiwi: { en: "Kiwi", fr: "Kiwi" },
  pera: { en: "Pear", fr: "Poire" },
  pêra: { en: "Pear", fr: "Poire" },
  pessego: { en: "Peach", fr: "Pêche" },
  pêssego: { en: "Peach", fr: "Pêche" },
  limao: { en: "Lemon", fr: "Citron" },
  limão: { en: "Lemon", fr: "Citron" },

  // Legumes e Verduras
  cebola: { en: "Onion", fr: "Oignon" },
  tomate: { en: "Tomato", fr: "Tomate" },
  alface: { en: "Lettuce", fr: "Laitue" },
  rucula: { en: "Arugula", fr: "Roquette" },
  rúcula: { en: "Arugula", fr: "Roquette" },
  espinafre: { en: "Spinach", fr: "Épinards" },
  brocolis: { en: "Broccoli", fr: "Brocoli" },
  brócolis: { en: "Broccoli", fr: "Brocoli" },
  "cenoura crua": { en: "Raw Carrot", fr: "Carotte Crue" },
  "cenoura cozida": { en: "Cooked Carrot", fr: "Carotte Cuite" },
  cenoura: { en: "Carrot", fr: "Carotte" },
  "batata inglesa cozida": { en: "Boiled Potato", fr: "Pomme de Terre Bouillie" },
  "batata frita": { en: "French Fries", fr: "Frites" },
  "batata doce cozida": { en: "Boiled Sweet Potato", fr: "Patate Douce Cuite" },
  "batata doce": { en: "Sweet Potato", fr: "Patate Douce" },
  "mandioca cozida": { en: "Boiled Cassava", fr: "Manioc Cuit" },
  "abobrinha grelhada": { en: "Grilled Zucchini", fr: "Courgette Grillée" },
  "abobora cozida": { en: "Cooked Pumpkin", fr: "Potiron Cuit" },
  abóbora: { en: "Pumpkin", fr: "Potiron" },
  pepino: { en: "Cucumber", fr: "Concombre" },
  berinjela: { en: "Eggplant", fr: "Aubergine" },
  pimentao: { en: "Bell Pepper", fr: "Poivron" },
  pimentão: { en: "Bell Pepper", fr: "Poivron" },
  alho: { en: "Garlic", fr: "Ail" },

  // Pães e Massas
  "pao frances": { en: "French Bread Roll", fr: "Pain / Baguette" },
  "pão francês": { en: "French Bread Roll", fr: "Pain / Baguette" },
  "pao de forma integral": { en: "Whole Wheat Sliced Bread", fr: "Pain de Mie Complet" },
  "pao de forma": { en: "Sliced White Bread", fr: "Pain de Mie" },
  "pão de queijo": { en: "Cheese Bread", fr: "Pain au Fromage" },
  "macarrao espaguete": { en: "Spaghetti Pasta", fr: "Spaghetti" },
  "macarrao com molho de tomate": { en: "Pasta with Tomato Sauce", fr: "Pâtes Sauce Tomate" },
  "lasanha a bolonhesa": { en: "Bolognese Lasagna", fr: "Lasagne Bolognaise" },
  "pizza de mussarela": { en: "Mozzarella Pizza", fr: "Pizza Mozzarella" },
  "pizza calabresa": { en: "Pepperoni Pizza", fr: "Pizza Pepperoni" },
  "hamburguer simples": { en: "Cheeseburger", fr: "Cheeseburger" },
  "coxinha de frango": { en: "Chicken Croquette", fr: "Croquette de Poulet" },
  "pastel de carne": { en: "Meat Pastry", fr: "Friand à la Viande" },

  // Bebidas e Doces
  "cafe sem acucar": { en: "Black Coffee (Sugar-Free)", fr: "Café Noir (Sans Sucre)" },
  "cafe com leite": { en: "Coffee with Milk", fr: "Café au Lait" },
  café: { en: "Coffee", fr: "Café" },
  "suco de laranja natural": { en: "Fresh Orange Juice", fr: "Jus d'Orange Frais" },
  "suco de uva integral": { en: "Grape Juice", fr: "Jus de Raisin" },
  "agua de coco": { en: "Coconut Water", fr: "Eau de Coco" },
  "refrigerante cola": { en: "Cola Soda", fr: "Soda au Cola" },
  "refrigerante zero": { en: "Diet Cola Soda", fr: "Soda Zéro" },
  "chocolate meio amargo": { en: "Dark Chocolate", fr: "Chocolat Noir" },
  "chocolate ao leite": { en: "Milk Chocolate", fr: "Chocolat au Lait" },
  brigadeiro: { en: "Chocolate Truffle", fr: "Truffe au Chocolat" },
  "sorvete de chocolate": { en: "Chocolate Ice Cream", fr: "Glace au Chocolat" },
  "acai com banana": { en: "Açaí Bowl with Banana", fr: "Açaí Bowl à la Banane" },
  açaí: { en: "Açaí Bowl", fr: "Açaí Bowl" },
  "azeite de oliva": { en: "Extra Virgin Olive Oil", fr: "Huile d'Olive Extra Vierge" },
  manteiga: { en: "Butter", fr: "Beurre" },
  "pasta de amendoim": { en: "Peanut Butter", fr: "Beurre de Cacahuète" },
  "castanha de caju": { en: "Cashews", fr: "Noix de Cajou" },
  nozes: { en: "Walnuts", fr: "Noix" },
};

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function translateFoodName(rawName: string, lang: Language): string {
  if (!rawName) return "";
  if (lang === "pt") return rawName;

  const direct = FOOD_TRANSLATIONS[rawName.toLowerCase()];
  if (direct && direct[lang]) {
    return direct[lang];
  }

  const normalized = normalizeKey(rawName);
  const normalizedMatch = Object.keys(FOOD_TRANSLATIONS).find(
    (k) => normalizeKey(k) === normalized,
  );
  if (normalizedMatch && FOOD_TRANSLATIONS[normalizedMatch]?.[lang]) {
    return FOOD_TRANSLATIONS[normalizedMatch][lang];
  }

  // Partial match lookups
  for (const [key, trans] of Object.entries(FOOD_TRANSLATIONS)) {
    const normKey = normalizeKey(key);
    if (normalized.includes(normKey) || normKey.includes(normalized)) {
      return trans[lang];
    }
  }

  return rawName;
}
