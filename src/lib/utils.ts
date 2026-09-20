import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") {
    return cleanPath;
  }

  // 1. Variável de ambiente explícita VITE_API_BASE_URL (se configurada)
  let configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredBaseUrl && typeof configuredBaseUrl === "string" && configuredBaseUrl.trim()) {
    configuredBaseUrl = configuredBaseUrl.trim();
    if (configuredBaseUrl.endsWith("/")) {
      configuredBaseUrl = configuredBaseUrl.slice(0, -1);
    }
    return `${configuredBaseUrl}${cleanPath}`;
  }

  // 2. Detecção de ambiente Web vs Nativo (Capacitor / Android / iOS)
  const origin = window.location.origin;
  const isCapacitorLocal =
    !origin ||
    origin === "null" ||
    origin === "file://" ||
    origin.startsWith("file:") ||
    origin.startsWith("capacitor:") ||
    origin.startsWith("ionic:") ||
    origin.startsWith("http-extension:") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  // Se estiver rodando na Web normal em um domínio público (ex: *.run.app, *.lovable.app, etc.)
  if (!isCapacitorLocal && origin) {
    let cleanOrigin = origin;
    if (cleanOrigin.endsWith("/")) {
      cleanOrigin = cleanOrigin.slice(0, -1);
    }
    return `${cleanOrigin}${cleanPath}`;
  }

  // 3. Fallback no aplicativo Android / APK Nativo:
  // Como o WebView local do celular não possui um servidor backend rodando na porta 80 do aparelho,
  // direcionamos as chamadas para o backend na nuvem onde as APIs (/api/*) e Webhooks estão disponíveis.
  const remoteProductionApi =
    "https://ais-pre-ngxxvimnf4y47ehcqvxib7-112028348065.europe-west2.run.app";
  return `${remoteProductionApi}${cleanPath}`;
}

export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;

  // 1. Capacitor JS native bridge (only present in real compiled native APK/iOS apps)
  const cap = (window as any).Capacitor;
  const isCapacitorNative = !!(
    cap &&
    (cap.isNative === true || cap.platform === "android" || cap.platform === "ios")
  );

  // 2. Custom protocols typical of compiled app views
  const isCapacitorProtocol = ["capacitor:", "http-extension:", "file:", "ionic:"].includes(
    window.location.protocol,
  );

  return isCapacitorNative || isCapacitorProtocol;
}

export function getFoodEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("arroz")) return "🍚";
  if (lower.includes("feijão") || lower.includes("feijao")) return "🫘";
  if (lower.includes("frango") || lower.includes("fraga")) return "🍗";
  if (
    lower.includes("carne") ||
    lower.includes("bife") ||
    lower.includes("novilho") ||
    lower.includes("porco") ||
    lower.includes("vaca") ||
    lower.includes("lombo") ||
    lower.includes("costeleta")
  )
    return "🥩";
  if (
    lower.includes("peixe") ||
    lower.includes("salmão") ||
    lower.includes("salmao") ||
    lower.includes("atum") ||
    lower.includes("bacalhau") ||
    lower.includes("pescada")
  )
    return "🐟";
  if (lower.includes("ovo") || lower.includes("omelete") || lower.includes("frito")) return "🍳";
  if (
    lower.includes("pão") ||
    lower.includes("pao") ||
    lower.includes("tosta") ||
    lower.includes("sanduíche") ||
    lower.includes("sanduiche") ||
    lower.includes("baguete") ||
    lower.includes("croissant")
  )
    return "🍞";
  if (lower.includes("queijo") || lower.includes("queijos")) return "🧀";
  if (lower.includes("leite")) return "🥛";
  if (lower.includes("iogurte") || lower.includes("skyr") || lower.includes("queijo fresco"))
    return "🥛";
  if (lower.includes("banana")) return "🍌";
  if (lower.includes("maçã") || lower.includes("maca")) return "🍎";
  if (lower.includes("laranja")) return "🍊";
  if (lower.includes("limão") || lower.includes("limao")) return "🍋";
  if (
    lower.includes("morango") ||
    lower.includes("fruto") ||
    lower.includes("baga") ||
    lower.includes("framboesa") ||
    lower.includes("mirtilo")
  )
    return "🍓";
  if (
    lower.includes("salada") ||
    lower.includes("alface") ||
    lower.includes("folhas") ||
    lower.includes("vegetal") ||
    lower.includes("verdura") ||
    lower.includes("tomate") ||
    lower.includes("cenoura") ||
    lower.includes("brócolos")
  )
    return "🥗";
  if (lower.includes("sopa") || lower.includes("creme")) return "🍲";
  if (lower.includes("batata")) return "🥔";
  if (
    lower.includes("aveia") ||
    lower.includes("muesli") ||
    lower.includes("granola") ||
    lower.includes("cereal")
  )
    return "🥣";
  if (
    lower.includes("massa") ||
    lower.includes("esparguete") ||
    lower.includes("macarrão") ||
    lower.includes("massa integral")
  )
    return "🍝";
  if (
    lower.includes("suco") ||
    lower.includes("sumo") ||
    lower.includes("bebida") ||
    lower.includes("chá") ||
    lower.includes("cha") ||
    lower.includes("refrigerante") ||
    lower.includes("cola")
  )
    return "🥤";
  if (lower.includes("abacate")) return "🥑";
  if (lower.includes("manteiga") || lower.includes("margarina")) return "🧈";
  if (lower.includes("azeite") || lower.includes("óleo") || lower.includes("oleo")) return "🧴"; // or olive symbol/drop
  if (
    lower.includes("noz") ||
    lower.includes("amêndoa") ||
    lower.includes("castanha") ||
    lower.includes("amendoim") ||
    lower.includes("avelã")
  )
    return "🥜";
  if (lower.includes("chocolate") || lower.includes("cacau")) return "🍫";
  if (lower.includes("bolo") || lower.includes("doce") || lower.includes("sobremesa")) return "🍰";
  if (lower.includes("água") || lower.includes("agua")) return "💧";
  return "🍽️";
}

export async function dataURLtoFile(dataurl: string, filename: string): Promise<File> {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
