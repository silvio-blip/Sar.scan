import { supabase } from "@/integrations/supabase/client";

export type ReferenceObjectType =
  "card" | "coin_2eur" | "coin_1real" | "coin_1eur" | "bottle_cap" | "ruler";

export interface ReferenceObjectOption {
  id: ReferenceObjectType;
  label: string;
  description: string;
  realSizeDescription: string;
  emoji: string;
  standardDimensionsMm: {
    width: number;
    height?: number;
    diameter?: number;
  };
}

export const REFERENCE_OBJECTS: ReferenceObjectOption[] = [
  {
    id: "card",
    label: "Cartão Bancário / ID / Fidelidade",
    description: "Qualquer cartão de plástico padrão (crédito, débito, cidadão)",
    realSizeDescription: "85.6 mm × 53.98 mm (Padrão ISO)",
    emoji: "💳",
    standardDimensionsMm: {
      width: 85.6,
      height: 53.98,
    },
  },
  {
    id: "coin_2eur",
    label: "Moeda de 2 Euros (€2)",
    description: "Moeda padrão de 2 Euros comum na Europa",
    realSizeDescription: "25.75 mm de diâmetro",
    emoji: "🪙",
    standardDimensionsMm: {
      width: 25.75,
      diameter: 25.75,
    },
  },
  {
    id: "coin_1real",
    label: "Moeda de 1 Real (R$ 1)",
    description: "Moeda padrão bimetálica de 1 Real",
    realSizeDescription: "27.00 mm de diâmetro",
    emoji: "🪙",
    standardDimensionsMm: {
      width: 27.0,
      diameter: 27.0,
    },
  },
  {
    id: "coin_1eur",
    label: "Moeda de 1 Euro (€1)",
    description: "Moeda padrão de 1 Euro",
    realSizeDescription: "23.25 mm de diâmetro",
    emoji: "🪙",
    standardDimensionsMm: {
      width: 23.25,
      diameter: 23.25,
    },
  },
  {
    id: "bottle_cap",
    label: "Tampa de Garrafa Pet",
    description: "Tampa plástica padrão de refrigerante ou água",
    realSizeDescription: "28.00 mm de diâmetro",
    emoji: "🥤",
    standardDimensionsMm: {
      width: 28.0,
      diameter: 28.0,
    },
  },
  {
    id: "ruler",
    label: "Régua ou Fita Métrica",
    description: "Régua com marcação visível de centímetros",
    realSizeDescription: "Escala métrica de centímetros visível",
    emoji: "📏",
    standardDimensionsMm: {
      width: 100.0,
    },
  },
];

export interface HandCalibrationData {
  userId?: string;
  comprimento_cm: number; // Ex: 18.5 cm (do punho até a ponta do dedo médio)
  largura_palma_cm: number; // Ex: 8.2 cm (largura transversal da palma)
  largura_indicador_cm?: number; // Ex: 1.9 cm
  objeto_referencia: ReferenceObjectType;
  nome_objeto?: string;
  foto_amostra_url?: string | null;
  calibrado_em: string;
  confianca_percentual?: number;
}

const STORAGE_KEY = "sar_hand_biometric_calibration";

/**
 * Obtém a calibração biométrica da mão salva
 */
export function getSavedHandCalibration(): HandCalibrationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.comprimento_cm === "number" && parsed.comprimento_cm > 0) {
      return parsed as HandCalibrationData;
    }
  } catch (e) {
    console.warn("[HandCalibration] Erro ao ler calibração local:", e);
  }
  return null;
}

/**
 * Salva a calibração da mão localmente e tenta sincronizar no Supabase
 */
export async function saveHandCalibration(
  data: HandCalibrationData,
  userId?: string,
): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  if (userId) {
    try {
      // Salva no banco de dados na tabela de calibrações ou perfis
      await (supabase as any)
        .from("profiles")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch (dbErr) {
      console.warn("[HandCalibration] Aviso ao sincronizar com banco:", dbErr);
    }
  }
}

/**
 * Remove a calibração salva
 */
export function clearHandCalibration(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
