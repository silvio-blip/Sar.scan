import React, { useState, useEffect, useMemo } from "react";
import {
  Camera,
  History,
  Search,
  Bot,
  User,
  Plus,
  Flame,
  Droplet,
  CheckCircle2,
  Trash2,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  X,
  Send,
  Zap,
  Edit3,
  Utensils,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Sliders,
  AlertCircle
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Toaster, toast } from "sonner";

// Types
interface FoodEntry {
  id: string;
  nome: string;
  calorias: number;
  prot: number;
  carbs: number;
  gord: number;
  porcoes: number;
  mealType: string;
  data: string;
}

interface FoodBasic {
  id: string;
  nome: string;
  cal: number;
  carb: number;
  prot: number;
  gord: number;
  porcao: string;
  categoria: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UserProfile {
  nome: string;
  email: string;
  pesoKg: number;
  alturaCm: number;
  idade: number;
  genero: "Masculino" | "Feminino";
  objetivo: string;
  streakDays: number;
  isPremium: boolean;
}

interface DailyGoals {
  calorias: number;
  proteinaG: number;
  carbsG: number;
  gorduraG: number;
  waterMl: number;
}

const INITIAL_FOODS: FoodBasic[] = [
  { id: "1", nome: "Arroz Branco Cozido", cal: 128, carb: 28.1, prot: 2.5, gord: 0.2, porcao: "100g", categoria: "Carboidratos" },
  { id: "2", nome: "Feijão Carioca Cozido", cal: 76, carb: 13.6, prot: 4.8, gord: 0.5, porcao: "100g", categoria: "Leguminosas" },
  { id: "3", nome: "Peito de Frango Grelhado", cal: 159, carb: 0, prot: 32.0, gord: 3.2, porcao: "100g", categoria: "Proteínas" },
  { id: "4", nome: "Carne Moída Patinho", cal: 185, carb: 0, prot: 31.5, gord: 6.0, porcao: "100g", categoria: "Proteínas" },
  { id: "5", nome: "Filé de Tilápia Grelhado", cal: 128, carb: 0, prot: 26.0, gord: 2.7, porcao: "100g", categoria: "Proteínas" },
  { id: "6", nome: "Ovos Mexidos (com azeite)", cal: 180, carb: 1.5, prot: 12.0, gord: 14.0, porcao: "2 unidades (100g)", categoria: "Proteínas" },
  { id: "7", nome: "Batata Doce Cozida", cal: 86, carb: 20.1, prot: 1.6, gord: 0.1, porcao: "100g", categoria: "Carboidratos" },
  { id: "8", nome: "Tapioca (Goma)", cal: 240, carb: 60.0, prot: 0.2, gord: 0.1, porcao: "100g", categoria: "Carboidratos" },
  { id: "9", nome: "Banana Prata", cal: 89, carb: 22.8, prot: 1.1, gord: 0.3, porcao: "1 unidade (100g)", categoria: "Frutas" },
  { id: "10", nome: "Maçã Fuji", cal: 52, carb: 13.8, prot: 0.3, gord: 0.2, porcao: "1 unidade (100g)", categoria: "Frutas" },
  { id: "11", nome: "Açaí Puro na Tigela", cal: 110, carb: 12.0, prot: 1.5, gord: 6.2, porcao: "100g", categoria: "Frutas" },
  { id: "12", nome: "Aveia em Flocos", cal: 389, carb: 66.3, prot: 16.9, gord: 6.9, porcao: "100g", categoria: "Cereais" },
  { id: "13", nome: "Pão Francês", cal: 300, carb: 58.7, prot: 9.0, gord: 3.1, porcao: "2 unidades (100g)", categoria: "Pães" },
  { id: "14", nome: "Pão Integral 100%", cal: 240, carb: 44.0, prot: 11.0, gord: 3.0, porcao: "2 fatias (50g)", categoria: "Pães" },
  { id: "15", nome: "Queijo Minas Frescal", cal: 227, carb: 3.2, prot: 17.4, gord: 16.0, porcao: "100g", categoria: "Laticínios" },
  { id: "16", nome: "Whey Protein 80%", cal: 400, carb: 5.0, prot: 80.0, gord: 4.0, porcao: "3 scoops (100g)", categoria: "Suplementos" },
  { id: "17", nome: "Pasta de Amendoim Integral", cal: 588, carb: 20.0, prot: 25.0, gord: 50.0, porcao: "100g", categoria: "Gorduras" },
  { id: "18", nome: "Brócolis Cozido", cal: 35, carb: 7.2, prot: 2.4, gord: 0.4, porcao: "100g", categoria: "Vegetais" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"diario" | "scanner" | "buscar" | "chat" | "perfil">("diario");

  // State with LocalStorage Persistence
  const [entries, setEntries] = useState<FoodEntry[]>(() => {
    const saved = localStorage.getItem("sar_entries");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [
      { id: "1", nome: "Ovos Mexidos com Pão Integral", calorias: 320, prot: 18, carbs: 26, gord: 14, porcoes: 1, mealType: "Café da Manhã", data: new Date().toISOString().slice(0, 10) },
      { id: "2", nome: "Peito de Frango, Arroz & Feijão", calorias: 540, prot: 45, carbs: 58, gord: 8, porcoes: 1, mealType: "Almoço", data: new Date().toISOString().slice(0, 10) },
      { id: "3", nome: "Whey Protein com Banana", calorias: 230, prot: 25, carbs: 27, gord: 2, porcoes: 1, mealType: "Lanches", data: new Date().toISOString().slice(0, 10) }
    ];
  });

  const [goals, setGoals] = useState<DailyGoals>(() => {
    const saved = localStorage.getItem("sar_goals");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { calorias: 2000, proteinaG: 140, carbsG: 220, gorduraG: 60, waterMl: 2500 };
  });

  const [waterMl, setWaterMl] = useState<number>(() => {
    const saved = localStorage.getItem("sar_water");
    return saved ? Number(saved) : 1350;
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("sar_profile");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      nome: "Silvio",
      email: "silvio@sarscan.com",
      pesoKg: 74.0,
      alturaCm: 178,
      idade: 26,
      genero: "Masculino",
      objetivo: "Ganhar Massa",
      streakDays: 5,
      isPremium: false
    };
  });

  const [foods, setFoods] = useState<FoodBasic[]>(() => {
    const saved = localStorage.getItem("sar_foods");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_FOODS;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("sar_chat");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: "1",
        role: "assistant",
        content: "Olá! Sou seu Nutricionista IA da Sar.scan. Posso te ajudar a calcular macronutrientes, sugerir refeições saudáveis, analisar pratos ou tirar dúvidas sobre sua dieta. Como posso te orientar hoje?"
      }
    ];
  });

  // Save to localStorage
  useEffect(() => { localStorage.setItem("sar_entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("sar_goals", JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem("sar_water", String(waterMl)); }, [waterMl]);
  useEffect(() => { localStorage.setItem("sar_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("sar_foods", JSON.stringify(foods)); }, [foods]);
  useEffect(() => { localStorage.setItem("sar_chat", JSON.stringify(chatMessages)); }, [chatMessages]);

  // Modals & States
  const [isPremiumOpen, setIsPremiumOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [selectedFoodForAdd, setSelectedFoodForAdd] = useState<FoodBasic | null>(null);
  const [portionMultiplier, setPortionMultiplier] = useState(1);
  const [addMealType, setAddMealType] = useState("Almoço");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [chatInput, setChatInput] = useState("");
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);

  // Computed Macros
  const totalCal = useMemo(() => entries.reduce((s, e) => s + e.calorias, 0), [entries]);
  const totalProt = useMemo(() => entries.reduce((s, e) => s + e.prot, 0), [entries]);
  const totalCarbs = useMemo(() => entries.reduce((s, e) => s + e.carbs, 0), [entries]);
  const totalFat = useMemo(() => entries.reduce((s, e) => s + e.gord, 0), [entries]);

  // Weekly dummy/real history
  const weeklyData = [
    { dia: "Seg", cal: 1850 },
    { dia: "Ter", cal: 1920 },
    { dia: "Qua", cal: 2050 },
    { dia: "Qui", cal: 1880 },
    { dia: "Sex", cal: 2100 },
    { dia: "Sáb", cal: 1950 },
    { dia: "Hoje", cal: totalCal }
  ];

  // Actions
  const handleAddWater = (amount: number) => {
    setWaterMl(prev => Math.min(prev + amount, 6000));
    toast.success(`+${amount}ml de água registrados!`);
  };

  const handleRemoveWater = () => {
    setWaterMl(prev => Math.max(prev - 250, 0));
    toast.info("Último registro de água desfeito.");
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success("Alimento removido do diário.");
  };

  const handleScanSimulation = (dishName?: string) => {
    setIsScanning(true);
    setScannedResult(null);

    setTimeout(() => {
      setIsScanning(false);
      const query = (dishName || "").toLowerCase();

      if (query.includes("salada")) {
        setScannedResult({
          title: "Salada Caesar com Frango Grelhado",
          calorias: 380,
          prot: 38,
          carbs: 14,
          gord: 18,
          confidence: 96,
          items: [
            { name: "Peito de Frango Grelhado", portion: "120g", cal: 190 },
            { name: "Folhas Verdes & Tomate Cereja", portion: "150g", cal: 35 },
            { name: "Parmesão Ralado & Croutons", portion: "30g", cal: 155 }
          ]
        });
      } else if (query.includes("café") || query.includes("ovo") || query.includes("tapioca")) {
        setScannedResult({
          title: "Café da Manhã: Ovos Mexidos & Tapioca",
          calorias: 390,
          prot: 22,
          carbs: 42,
          gord: 14,
          confidence: 94,
          items: [
            { name: "Tapioca Tradicional", portion: "70g", cal: 168 },
            { name: "Ovos Mexidos com Queijo Branco", portion: "2 unid", cal: 222 }
          ]
        });
      } else if (query.includes("açaí") || query.includes("banana")) {
        setScannedResult({
          title: "Bowl de Açaí com Banana e Granola",
          calorias: 430,
          prot: 8.5,
          carbs: 78,
          gord: 10,
          confidence: 97,
          items: [
            { name: "Polpa de Açaí Natural", portion: "200g", cal: 220 },
            { name: "Banana Fatiada", portion: "1 unidade", cal: 90 },
            { name: "Granola Integral", portion: "30g", cal: 120 }
          ]
        });
      } else {
        setScannedResult({
          title: "Prato Executivo: Frango, Arroz & Feijão",
          calorias: 580,
          prot: 46.5,
          carbs: 68,
          gord: 11.2,
          confidence: 98,
          items: [
            { name: "Peito de Frango Grelhado", portion: "140g", cal: 225 },
            { name: "Arroz Branco Cozido", portion: "150g", cal: 192 },
            { name: "Feijão Carioca Cozido", portion: "100g", cal: 76 },
            { name: "Salada com Azeite", portion: "100g", cal: 87 }
          ]
        });
      }
      toast.success("Alimento escaneado com sucesso pela IA!");
    }, 1400);
  };

  const handleSaveScannedMeal = (mealType: string) => {
    if (!scannedResult) return;
    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      nome: scannedResult.title,
      calorias: scannedResult.calorias,
      prot: scannedResult.prot,
      carbs: scannedResult.carbs,
      gord: scannedResult.gord,
      porcoes: 1,
      mealType: mealType,
      data: new Date().toISOString().slice(0, 10)
    };
    setEntries(prev => [newEntry, ...prev]);
    setScannedResult(null);
    setActiveTab("diario");
    toast.success(`${newEntry.nome} registrado no Diário!`);
  };

  const handleAddFoodFromSearch = () => {
    if (!selectedFoodForAdd) return;
    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      nome: selectedFoodForAdd.nome,
      calorias: Math.round(selectedFoodForAdd.cal * portionMultiplier),
      prot: Math.round(selectedFoodForAdd.prot * portionMultiplier),
      carbs: Math.round(selectedFoodForAdd.carb * portionMultiplier),
      gord: Math.round(selectedFoodForAdd.gord * portionMultiplier),
      porcoes: portionMultiplier,
      mealType: addMealType,
      data: new Date().toISOString().slice(0, 10)
    };
    setEntries(prev => [newEntry, ...prev]);
    setSelectedFoodForAdd(null);
    setPortionMultiplier(1);
    toast.success(`${newEntry.nome} adicionado ao ${addMealType}!`);
  };

  const handleSendMessage = (textToSend?: string) => {
    const q = textToSend || chatInput;
    if (!q.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: q };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatTyping(true);

    setTimeout(() => {
      let reply = "Ótima pergunta! Manter uma ingestão balanceada de proteínas de alto valor biológico e carboidratos complexos vai garantir consistência nos seus resultados.";
      const low = q.toLowerCase();

      if (low.includes("proteína") || low.includes("proteina")) {
        reply = "Para bater sua meta de proteínas com facilidade:\n• Peito de frango (32g prot/100g)\n• Ovos cozidos (6g por unidade)\n• Patinho moído (31g/100g)\n• 1 scoop de Whey Protein (~24g prot puro).";
      } else if (low.includes("emagrecer") || low.includes("perder peso") || low.includes("déficit")) {
        reply = "Para emagrecer com saúde:\n1. Mantenha um déficit de 300-500 kcal diárias.\n2. Mantenha a proteína alta (1.8g/kg) para preservar massa muscular.\n3. Beba 35ml de água por kg de peso e priorize alimentos volumosos ricos em fibras.";
      } else if (low.includes("ganhar massa") || low.includes("bulking")) {
        reply = "Para hipertrofia (ganho de massa magra):\n• Consuma 200 a 400 kcal acima do gasto diário.\n• Divida 2.0g/kg de proteína ao longo de 4 a 5 refeições.\n• Use creatina (3g a 5g/dia) e mantenha sobrecarga progressiva nos treinos.";
      } else if (low.includes("água") || low.includes("agua")) {
        reply = `Sua meta ideal calculada é de ${goals.waterMl}ml ao dia! Hidratação adequada melhora o metabolismo, combate a retenção e auxilia na digestão.`;
      }

      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: reply };
      setChatMessages(prev => [...prev, assistantMsg]);
      setIsChatTyping(false);
    }, 700);
  };

  // Filtered Foods
  const filteredFoods = useMemo(() => {
    return foods.filter(f => {
      const matchQuery = f.nome.toLowerCase().includes(searchQuery.toLowerCase()) || f.categoria.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === "Todos" || f.categoria === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [foods, searchQuery, selectedCategory]);

  const categories = ["Todos", "Proteínas", "Carboidratos", "Frutas", "Leguminosas", "Laticínios", "Suplementos", "Gorduras", "Vegetais"];

  // Metrics
  const imc = (profile.pesoKg / ((profile.alturaCm / 100) * (profile.alturaCm / 100))).toFixed(1);
  const bmr = profile.genero === "Masculino"
    ? Math.round(88.362 + (13.397 * profile.pesoKg) + (4.799 * profile.alturaCm) - (5.677 * profile.idade))
    : Math.round(447.593 + (9.247 * profile.pesoKg) + (3.098 * profile.alturaCm) - (4.330 * profile.idade));

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2E24] flex justify-center selection:bg-[#2E4A3B] selection:text-white">
      <Toaster position="top-center" richColors />

      {/* Main Container - Mobile First Frame */}
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FAF7F2] relative shadow-2xl border-x border-[#1C2E24]/5 pb-24">
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#1C2E24]/5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E4A3B] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5 text-[#E28C6A]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-[#1C2E24]">Sar.scan</h1>
              <p className="text-[10px] font-medium text-[#5A6F62] leading-none">Nutrição Inteligente & IA</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#FDEEE8] text-[#B55D3B] text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-[#E28C6A] text-[#E28C6A]" />
              <span>{profile.streakDays}d</span>
            </div>

            <button
              onClick={() => setIsPremiumOpen(true)}
              className="p-2 rounded-full hover:bg-[#E5EEE8] text-[#E28C6A] transition-colors"
              title="Assinar Premium"
            >
              <Award className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tab 1: DIÁRIO */}
        {activeTab === "diario" && (
          <main className="flex-1 px-4 py-4 space-y-4">
            
            {/* Calorie Macro Ring Gauge Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#1C2E24]/5 space-y-4">
              <div className="flex items-center justify-between">
                {/* Circular Indicator */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#E5EEE8" strokeWidth="9" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#2E4A3B"
                      strokeWidth="9"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 * (1 - Math.min(totalCal / goals.calorias, 1))}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-extrabold text-[#1C2E24]">
                      {Math.max(goals.calorias - totalCal, 0)}
                    </span>
                    <span className="text-[10px] text-[#5A6F62] font-medium">kcal rest.</span>
                  </div>
                </div>

                {/* Calorie Stats */}
                <div className="flex-1 pl-4 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[#5A6F62]">Meta diária</span>
                    <span className="font-bold text-[#1C2E24]">{goals.calorias} kcal</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#5A6F62]">Consumidas</span>
                    <span className="font-bold text-[#2E4A3B]">{totalCal} kcal</span>
                  </div>
                  <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    totalCal > goals.calorias ? "bg-amber-100 text-amber-800" : "bg-[#E5EEE8] text-[#2E4A3B]"
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{totalCal > goals.calorias ? "Meta excedida" : "Dentro da meta"}</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-[#1C2E24]/5" />

              {/* 3 Macro Bars */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-[#E28C6A]">Proteína</span>
                    <span className="text-[#5A6F62]">{Math.round(totalProt)}/{goals.proteinaG}g</span>
                  </div>
                  <div className="h-2 bg-[#FDEEE8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E28C6A] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((totalProt / goals.proteinaG) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-[#E5A93C]">Carbos</span>
                    <span className="text-[#5A6F62]">{Math.round(totalCarbs)}/{goals.carbsG}g</span>
                  </div>
                  <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E5A93C] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((totalCarbs / goals.carbsG) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-[#6B9B7B]">Gorduras</span>
                    <span className="text-[#5A6F62]">{Math.round(totalFat)}/{goals.gorduraG}g</span>
                  </div>
                  <div className="h-2 bg-emerald-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6B9B7B] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((totalFat / goals.gorduraG) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Water Tracker Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#1C2E24]/5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#E6F2FC] flex items-center justify-center text-[#4C9EEB]">
                    <Droplet className="w-5 h-5 fill-[#4C9EEB]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#1C2E24]">Hidratação Diária</h3>
                    <p className="text-xs text-[#5A6F62]">{waterMl} de {goals.waterMl} ml atingidos</p>
                  </div>
                </div>

                {waterMl > 0 && (
                  <button
                    onClick={handleRemoveWater}
                    className="text-xs text-[#5A6F62] hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Desfazer
                  </button>
                )}
              </div>

              {/* Water Progress Bar */}
              <div className="h-2.5 bg-[#E6F2FC] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4C9EEB] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((waterMl / goals.waterMl) * 100, 100)}%` }}
                />
              </div>

              {/* Quick Add Water Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => handleAddWater(250)}
                  className="py-2 px-3 rounded-xl border border-[#4C9EEB]/30 text-[#2879C5] font-semibold text-xs flex items-center justify-center space-x-1.5 hover:bg-[#E6F2FC]/50 transition-colors active:scale-95"
                >
                  <Droplet className="w-3.5 h-3.5" />
                  <span>+250 ml (Copo)</span>
                </button>
                <button
                  onClick={() => handleAddWater(500)}
                  className="py-2 px-3 rounded-xl bg-[#4C9EEB] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm hover:bg-[#3B8DD8] transition-colors active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+500 ml (Garrafa)</span>
                </button>
              </div>
            </div>

            {/* Meals Header */}
            <div className="flex items-center justify-between pt-2">
              <h2 className="font-bold text-base text-[#1C2E24]">Refeições de Hoje</h2>
              <button
                onClick={() => setActiveTab("buscar")}
                className="inline-flex items-center space-x-1 text-xs font-bold text-[#2E4A3B] bg-[#E5EEE8] px-3 py-1.5 rounded-xl hover:bg-[#D5E4DB] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Meals List */}
            {entries.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-[#1C2E24]/5 space-y-3">
                <Utensils className="w-10 h-10 text-[#5A6F62] mx-auto opacity-40" />
                <p className="font-bold text-sm text-[#1C2E24]">Nenhuma refeição registrada hoje</p>
                <p className="text-xs text-[#5A6F62]">Escaneie seu prato com a IA ou busque alimentos na biblioteca.</p>
                <button
                  onClick={() => setActiveTab("scanner")}
                  className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-[#2E4A3B] text-white rounded-xl font-bold text-xs shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  <span>Escanear com IA</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#1C2E24]/5 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E5EEE8] flex items-center justify-center text-[#2E4A3B]">
                        {entry.mealType === "Café da Manhã" ? <Coffee className="w-4 h-4" /> :
                         entry.mealType === "Almoço" ? <Sun className="w-4 h-4" /> :
                         entry.mealType === "Jantar" ? <Moon className="w-4 h-4" /> : <Cookie className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-[#1C2E24] line-clamp-1">{entry.nome}</h4>
                        <div className="flex items-center space-x-2 text-[10px] text-[#5A6F62] mt-0.5">
                          <span className="font-bold text-[#2E4A3B]">{entry.calorias} kcal</span>
                          <span>•</span>
                          <span className="text-[#E28C6A]">P: {Math.round(entry.prot)}g</span>
                          <span className="text-[#E5A93C]">C: {Math.round(entry.carbs)}g</span>
                          <span className="text-[#6B9B7B]">G: {Math.round(entry.gord)}g</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1.5 text-[#5A6F62]/60 hover:text-red-600 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Evolution Chart */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#1C2E24]/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#1C2E24]">Evolução Semanal</h3>
                  <p className="text-[11px] text-[#5A6F62]">Consumo calórico dos últimos 7 dias</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#E5EEE8] text-[#2E4A3B]">
                  Meta: {goals.calorias} kcal
                </span>
              </div>

              <div className="h-40 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="dia" stroke="#8A9A90" fontSize={11} tickLine={false} />
                    <YAxis stroke="#8A9A90" fontSize={10} tickLine={false} domain={[0, 2500]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1C2E24", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                      itemStyle={{ color: "#E28C6A" }}
                    />
                    <Bar dataKey="cal" radius={[6, 6, 0, 0]}>
                      {weeklyData.map((d, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={d.cal > goals.calorias ? "#E28C6A" : "#2E4A3B"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </main>
        )}

        {/* Tab 2: SCANNER IA */}
        {activeTab === "scanner" && (
          <main className="flex-1 px-4 py-4 space-y-4">
            
            {/* Viewfinder HUD */}
            <div className="relative w-full h-72 bg-[#16251D] rounded-3xl overflow-hidden border border-[#2E4A3B]/40 shadow-inner flex flex-col items-center justify-center p-6 text-center">
              
              {/* Corner Reticles */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#4A735E]" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#4A735E]" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#4A735E]" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#4A735E]" />

              {/* Laser Animation */}
              {isScanning && (
                <div className="absolute left-6 right-6 h-1 bg-gradient-to-r from-transparent via-[#E28C6A] to-transparent animate-scan-laser shadow-[0_0_12px_#E28C6A]" />
              )}

              {isScanning ? (
                <div className="space-y-3 z-10">
                  <div className="w-12 h-12 rounded-full border-3 border-[#E28C6A] border-t-transparent animate-spin mx-auto" />
                  <h3 className="font-bold text-white text-base">Analisando Prato com IA...</h3>
                  <p className="text-xs text-[#A5C4B4]">Identificando ingredientes, porções e macros</p>
                </div>
              ) : scannedResult ? (
                <div className="space-y-2 z-10">
                  <span className="inline-flex items-center space-x-1 bg-[#2E4A3B]/80 text-[#A5C4B4] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#4A735E]/50">
                    <CheckCircle2 className="w-3 h-3 text-[#E28C6A]" />
                    <span>Confiança IA: {scannedResult.confidence}%</span>
                  </span>
                  <h3 className="font-bold text-white text-lg leading-tight">{scannedResult.title}</h3>
                  <p className="text-[#E28C6A] font-extrabold text-sm">{scannedResult.calorias} kcal • {scannedResult.prot}g Proteína</p>
                </div>
              ) : (
                <div className="space-y-2.5 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#2E4A3B]/60 flex items-center justify-center text-[#A5C4B4] mx-auto border border-[#4A735E]/30">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-white text-base">Aponte para o Alimento</h3>
                  <p className="text-xs text-[#A5C4B4] max-w-xs">A IA detecta automaticamente refeições, calorias e macronutrientes.</p>
                </div>
              )}
            </div>

            {/* Quick Presets for instant simulation */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#5A6F62] px-1">Ou teste pratos populares:</span>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  "Prato Executivo Fitness",
                  "Salada Caesar com Frango",
                  "Café com Ovos e Tapioca",
                  "Bowl de Açaí com Banana"
                ].map(dish => (
                  <button
                    key={dish}
                    onClick={() => handleScanSimulation(dish)}
                    className="whitespace-nowrap text-xs bg-white border border-[#1C2E24]/10 text-[#1C2E24] px-3 py-1.5 rounded-full font-medium hover:border-[#2E4A3B] transition-colors"
                  >
                    {dish}
                  </button>
                ))}
              </div>
            </div>

            {/* Scan Action Button */}
            <button
              onClick={() => handleScanSimulation()}
              disabled={isScanning}
              className="w-full py-3.5 bg-[#2E4A3B] text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 hover:bg-[#233A2E] transition-all active:scale-98 disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>{isScanning ? "Escaneando..." : "Escanear Alimento Agora"}</span>
            </button>

            {/* Scanned Breakdown Card */}
            {scannedResult && (
              <div className="bg-white rounded-3xl p-5 shadow-md border border-[#1C2E24]/5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#1C2E24]">{scannedResult.title}</h3>
                    <p className="text-xs text-[#5A6F62]">Detecção detalhada de macronutrientes</p>
                  </div>
                  <button
                    onClick={() => setScannedResult(null)}
                    className="p-1 rounded-full text-[#5A6F62] hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Macro Pills */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-[#E5EEE8] p-2 rounded-xl">
                    <span className="block text-xs font-bold text-[#2E4A3B]">{scannedResult.calorias}</span>
                    <span className="text-[10px] text-[#5A6F62]">kcal</span>
                  </div>
                  <div className="bg-[#FDEEE8] p-2 rounded-xl">
                    <span className="block text-xs font-bold text-[#B55D3B]">{scannedResult.prot}g</span>
                    <span className="text-[10px] text-[#5A6F62]">Prot</span>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl">
                    <span className="block text-xs font-bold text-[#E5A93C]">{scannedResult.carbs}g</span>
                    <span className="text-[10px] text-[#5A6F62]">Carbo</span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-xl">
                    <span className="block text-xs font-bold text-[#6B9B7B]">{scannedResult.gord}g</span>
                    <span className="text-[10px] text-[#5A6F62]">Gord</span>
                  </div>
                </div>

                {/* Items in dish */}
                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-[#1C2E24]">Ingredientes Identificados:</span>
                  {scannedResult.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-none">
                      <span className="text-[#5A6F62]">{item.name} ({item.portion})</span>
                      <span className="font-semibold text-[#1C2E24]">{item.cal} kcal</span>
                    </div>
                  ))}
                </div>

                {/* Register button */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {["Café da Manhã", "Almoço", "Jantar", "Lanches"].map(meal => (
                    <button
                      key={meal}
                      onClick={() => handleSaveScannedMeal(meal)}
                      className="py-2.5 px-3 rounded-xl bg-[#FAF7F2] border border-[#2E4A3B]/20 text-[#2E4A3B] font-bold text-xs hover:bg-[#2E4A3B] hover:text-white transition-colors"
                    >
                      + Salvar em {meal}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </main>
        )}

        {/* Tab 3: BUSCAR ALIMENTOS */}
        {activeTab === "buscar" && (
          <main className="flex-1 px-4 py-4 space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#5A6F62]" />
              <input
                type="text"
                placeholder="Buscar arroz, frango, whey, ovos..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-[#1C2E24]/10 text-sm focus:outline-none focus:border-[#2E4A3B] transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-3 text-[#5A6F62]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? "bg-[#2E4A3B] text-white"
                      : "bg-white border border-[#1C2E24]/10 text-[#5A6F62]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Foods List */}
            <div className="space-y-2">
              {filteredFoods.map(food => (
                <div
                  key={food.id}
                  onClick={() => {
                    setSelectedFoodForAdd(food);
                    setPortionMultiplier(1);
                  }}
                  className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#1C2E24]/5 flex items-center justify-between cursor-pointer hover:border-[#2E4A3B]/30 transition-all active:scale-99"
                >
                  <div>
                    <h4 className="font-bold text-xs text-[#1C2E24]">{food.nome}</h4>
                    <p className="text-[10px] text-[#5A6F62]">Porção: {food.porcao} • {food.categoria}</p>
                    <div className="flex items-center space-x-2 text-[10px] font-semibold mt-1">
                      <span className="text-[#E28C6A]">P: {food.prot}g</span>
                      <span className="text-[#E5A93C]">C: {food.carb}g</span>
                      <span className="text-[#6B9B7B]">G: {food.gord}g</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-[#E5EEE8] text-[#2E4A3B] font-bold text-xs">
                    {food.cal} kcal
                  </span>
                </div>
              ))}
            </div>

            {/* Floating Custom Food Creator Button */}
            <button
              onClick={() => setShowCustomFoodModal(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-[#2E4A3B] text-[#2E4A3B] font-bold text-xs flex items-center justify-center space-x-1.5 hover:bg-[#E5EEE8]/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Alimento Personalizado</span>
            </button>

          </main>
        )}

        {/* Tab 4: NUTRICIONISTA IA (CHAT) */}
        {activeTab === "chat" && (
          <main className="flex-1 flex flex-col px-4 py-3 space-y-3">
            
            {/* Header info */}
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-[#1C2E24]/5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#E5EEE8] flex items-center justify-center text-[#2E4A3B]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#1C2E24]">Nutricionista IA</h3>
                  <p className="text-[10px] text-[#5A6F62] flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Disponível 24/7</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setChatMessages([
                  { id: "1", role: "assistant", content: "Histórico reiniciado! Em que posso te orientar hoje?" }
                ])}
                className="text-[11px] text-[#5A6F62] hover:text-red-600"
              >
                Limpar
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[420px] pr-1 scrollbar-none">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#2E4A3B] text-white rounded-br-none"
                        : "bg-white text-[#1C2E24] shadow-sm border border-[#1C2E24]/5 rounded-bl-none whitespace-pre-line"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isChatTyping && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl p-3 shadow-sm border border-[#1C2E24]/5 flex items-center space-x-1.5 text-xs text-[#5A6F62]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2E4A3B] animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2E4A3B] animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2E4A3B] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Suggestion Prompts */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                "Como bater meta de proteína?",
                "Dicas para emagrecer com saúde",
                "O que comer no pré/pós treino?",
                "Qual minha meta ideal de água?"
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  className="whitespace-nowrap text-[11px] bg-white border border-[#1C2E24]/10 text-[#5A6F62] px-3 py-1 rounded-full font-medium hover:border-[#2E4A3B] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                placeholder="Tire sua dúvida nutricional..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                className="flex-1 px-4 py-2.5 bg-white rounded-2xl border border-[#1C2E24]/10 text-xs focus:outline-none focus:border-[#2E4A3B]"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim()}
                className="p-2.5 bg-[#2E4A3B] text-white rounded-xl disabled:opacity-40 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </main>
        )}

        {/* Tab 5: PERFIL & METAS */}
        {activeTab === "perfil" && (
          <main className="flex-1 px-4 py-4 space-y-4">
            
            {/* User Profile Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#1C2E24]/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2E4A3B] to-[#E28C6A] flex items-center justify-center text-white font-black text-xl shadow-md">
                    {profile.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1C2E24]">{profile.nome}</h3>
                    <p className="text-xs text-[#5A6F62]">{profile.email}</p>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5EEE8] text-[#2E4A3B] mt-1">
                      {profile.objetivo}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowEditProfile(true)}
                  className="p-2 rounded-xl text-[#2E4A3B] hover:bg-[#E5EEE8] transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="h-px bg-[#1C2E24]/5" />

              {/* Physical Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-[#FAF7F2] p-2.5 rounded-2xl">
                  <span className="block text-xs font-bold text-[#1C2E24]">{profile.pesoKg} kg</span>
                  <span className="text-[10px] text-[#5A6F62]">Peso</span>
                </div>
                <div className="bg-[#FAF7F2] p-2.5 rounded-2xl">
                  <span className="block text-xs font-bold text-[#1C2E24]">{profile.alturaCm} cm</span>
                  <span className="text-[10px] text-[#5A6F62]">Altura</span>
                </div>
                <div className="bg-[#FAF7F2] p-2.5 rounded-2xl">
                  <span className="block text-xs font-bold text-[#2E4A3B]">{imc}</span>
                  <span className="text-[10px] text-[#5A6F62]">IMC</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="bg-[#E5EEE8] p-2.5 rounded-2xl">
                  <span className="block text-xs font-bold text-[#2E4A3B]">{bmr} kcal/dia</span>
                  <span className="text-[10px] text-[#5A6F62]">Taxa Basal (TMB)</span>
                </div>
                <div className="bg-[#FDEEE8] p-2.5 rounded-2xl">
                  <span className="block text-xs font-bold text-[#B55D3B]">{profile.streakDays} dias</span>
                  <span className="text-[10px] text-[#5A6F62]">Ofensiva Ativa</span>
                </div>
              </div>
            </div>

            {/* Daily Goals Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#1C2E24]/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#1C2E24]">Metas Diárias</h3>
                <button
                  onClick={() => setShowEditGoals(true)}
                  className="text-xs font-bold text-[#2E4A3B] hover:underline"
                >
                  Ajustar
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#5A6F62]">Calorias:</span>
                  <span className="font-bold text-[#2E4A3B]">{goals.calorias} kcal</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#5A6F62]">Proteína:</span>
                  <span className="font-bold text-[#E28C6A]">{goals.proteinaG}g</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#5A6F62]">Carboidratos:</span>
                  <span className="font-bold text-[#E5A93C]">{goals.carbsG}g</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#5A6F62]">Gorduras:</span>
                  <span className="font-bold text-[#6B9B7B]">{goals.gorduraG}g</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5A6F62]">Água:</span>
                  <span className="font-bold text-[#4C9EEB]">{goals.waterMl} ml</span>
                </div>
              </div>
            </div>

            {/* Premium Upgrade Banner */}
            <div
              onClick={() => setIsPremiumOpen(true)}
              className="bg-gradient-to-r from-[#2E4A3B] to-[#3E6551] rounded-3xl p-5 text-white shadow-lg cursor-pointer flex items-center justify-between active:scale-98 transition-transform"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#E28C6A]" />
                  <span className="font-extrabold text-sm">Sar.scan Premium</span>
                </div>
                <p className="text-[11px] text-[#CCE4D6]">Scans com IA ilimitados, relatórios e planos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80" />
            </div>

          </main>
        )}

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-lg border-t border-[#1C2E24]/5 px-3 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab("diario")}
            className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition-colors ${
              activeTab === "diario" ? "text-[#2E4A3B] font-bold" : "text-[#8A9A90]"
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px]">Diário</span>
          </button>

          <button
            onClick={() => setActiveTab("scanner")}
            className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition-colors ${
              activeTab === "scanner" ? "text-[#2E4A3B] font-bold" : "text-[#8A9A90]"
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px]">Scanner IA</span>
          </button>

          <button
            onClick={() => setActiveTab("buscar")}
            className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition-colors ${
              activeTab === "buscar" ? "text-[#2E4A3B] font-bold" : "text-[#8A9A90]"
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px]">Buscar</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition-colors ${
              activeTab === "chat" ? "text-[#2E4A3B] font-bold" : "text-[#8A9A90]"
            }`}
          >
            <Bot className="w-5 h-5" />
            <span className="text-[10px]">Nutri IA</span>
          </button>

          <button
            onClick={() => setActiveTab("perfil")}
            className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition-colors ${
              activeTab === "perfil" ? "text-[#2E4A3B] font-bold" : "text-[#8A9A90]"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Perfil</span>
          </button>
        </nav>

        {/* Modal 1: Add Food Details & Portion Adjuster */}
        {selectedFoodForAdd && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#1C2E24]">{selectedFoodForAdd.nome}</h3>
                <button onClick={() => setSelectedFoodForAdd(null)} className="p-1 text-[#5A6F62]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#FAF7F2] p-3 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5A6F62]">Porção Base:</span>
                  <span className="font-bold">{selectedFoodForAdd.porcao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A6F62]">Calorias:</span>
                  <span className="font-bold text-[#2E4A3B]">{Math.round(selectedFoodForAdd.cal * portionMultiplier)} kcal</span>
                </div>
              </div>

              {/* Portion Multiplier */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#5A6F62]">Quantidade:</span>
                <div className="flex items-center justify-center space-x-3 bg-slate-50 py-2 rounded-2xl">
                  <button
                    onClick={() => setPortionMultiplier(p => Math.max(p - 0.5, 0.5))}
                    className="w-8 h-8 rounded-full bg-white shadow-sm border font-bold text-base flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-extrabold text-base w-12 text-center">{portionMultiplier}x</span>
                  <button
                    onClick={() => setPortionMultiplier(p => p + 0.5)}
                    className="w-8 h-8 rounded-full bg-white shadow-sm border font-bold text-base flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Meal Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#5A6F62]">Refeição:</span>
                <div className="grid grid-cols-2 gap-2">
                  {["Café da Manhã", "Almoço", "Jantar", "Lanches"].map(meal => (
                    <button
                      key={meal}
                      onClick={() => setAddMealType(meal)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        addMealType === meal
                          ? "bg-[#2E4A3B] text-white border-[#2E4A3B]"
                          : "bg-white border-[#1C2E24]/10 text-[#5A6F62]"
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddFoodFromSearch}
                className="w-full py-3 bg-[#2E4A3B] text-white rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-transform"
              >
                Adicionar ao Diário
              </button>
            </div>
          </div>
        )}

        {/* Modal 2: Premium Subscription */}
        {isPremiumOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E28C6A] to-[#F7B089] flex items-center justify-center text-white mx-auto shadow-md">
                <Sparkles className="w-7 h-7" />
              </div>

              <div>
                <h3 className="font-black text-xl text-[#1C2E24]">Sar.scan Premium</h3>
                <p className="text-xs text-[#5A6F62] mt-1">Desbloqueie todo o poder da IA nutricional</p>
              </div>

              <div className="space-y-2 text-left text-xs bg-[#FAF7F2] p-3.5 rounded-2xl">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E4A3B]" />
                  <span>Scans ilimitados de fotos com IA</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E4A3B]" />
                  <span>Nutricionista IA sem limites</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E4A3B]" />
                  <span>Exportação de relatórios nutricionais</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E4A3B]" />
                  <span>Planos de refeições customizados</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setProfile(p => ({ ...p, isPremium: true }));
                  setIsPremiumOpen(false);
                  toast.success("Parabéns! Você agora é Sar.scan Premium!");
                }}
                className="w-full py-3 bg-[#2E4A3B] text-white rounded-2xl font-bold text-sm shadow-md"
              >
                Assinar por R$ 14,90/mês
              </button>

              <button
                onClick={() => setIsPremiumOpen(false)}
                className="text-xs text-[#5A6F62] hover:underline"
              >
                Talvez mais tarde
              </button>
            </div>
          </div>
        )}

        {/* Modal 3: Custom Food Creator */}
        {showCustomFoodModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 shadow-2xl">
              <h3 className="font-bold text-base text-[#1C2E24]">Criar Alimento Personalizado</h3>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.target as any;
                  const newF: FoodBasic = {
                    id: Date.now().toString(),
                    nome: form.nome.value,
                    cal: Number(form.cal.value),
                    prot: Number(form.prot.value),
                    carb: Number(form.carb.value),
                    gord: Number(form.gord.value),
                    porcao: form.porcao.value || "100g",
                    categoria: "Personalizado"
                  };
                  setFoods(prev => [newF, ...prev]);
                  setShowCustomFoodModal(false);
                  toast.success(`Alimento '${newF.nome}' criado com sucesso!`);
                }}
                className="space-y-2.5 text-xs"
              >
                <input name="nome" placeholder="Nome do Alimento" required className="w-full p-2.5 rounded-xl border border-slate-200" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="cal" type="number" placeholder="Calorias (kcal)" required className="p-2.5 rounded-xl border border-slate-200" />
                  <input name="porcao" placeholder="Porção (ex: 100g)" className="p-2.5 rounded-xl border border-slate-200" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input name="prot" type="number" step="0.1" placeholder="Prot (g)" required className="p-2.5 rounded-xl border border-slate-200" />
                  <input name="carb" type="number" step="0.1" placeholder="Carb (g)" required className="p-2.5 rounded-xl border border-slate-200" />
                  <input name="gord" type="number" step="0.1" placeholder="Gord (g)" required className="p-2.5 rounded-xl border border-slate-200" />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button type="button" onClick={() => setShowCustomFoodModal(false)} className="flex-1 py-2.5 rounded-xl border text-[#5A6F62]">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#2E4A3B] text-white font-bold">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
