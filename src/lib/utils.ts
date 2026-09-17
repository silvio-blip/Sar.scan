import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from "@capacitor/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") {
    return cleanPath;
  }

  // Explicitly configured URL takes precedence
  let configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

  // Cleanup: remove incorrect subpaths like "/scanner", "/diario", "/chat", etc. from the end of base URLs
  if (configuredBaseUrl) {
    if (configuredBaseUrl.endsWith("/")) {
      configuredBaseUrl = configuredBaseUrl.slice(0, -1);
    }
    const invalidSubpaths = [
      "/scanner",
      "/diario",
      "/chat",
      "/buscar",
      "/perfil",
      "/premium",
      "/login",
    ];
    for (const sub of invalidSubpaths) {
      if (configuredBaseUrl.endsWith(sub)) {
        console.warn(
          `[getApiUrl] Cleaned invalid subpath '${sub}' from VITE_API_BASE_URL: ${configuredBaseUrl}`,
        );
        configuredBaseUrl = configuredBaseUrl.slice(0, -sub.length);
      }
    }
  }

  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isCapacitor = !!(
    (window as any).Capacitor ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "http-extension:" ||
    window.location.protocol === "file:" ||
    window.location.protocol === "ionic:" ||
    (window.location.hostname === "localhost" && isMobile)
  );

  // If in Capacitor, we MUST return absolute API URL
  if (isCapacitor) {
    if (configuredBaseUrl) {
      console.log(
        `[getApiUrl] Capacitor client using adjusted VITE_API_BASE_URL: ${configuredBaseUrl}`,
      );
      return `${configuredBaseUrl}${cleanPath}`;
    }
    const isSharedPreview =
      typeof window !== "undefined" && window.location.hostname.includes("run.app");
    const baseUrl = import.meta.env.DEV
      ? "https://ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
      : isSharedPreview
        ? "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
        : "https://sar-scan.vercel.app";

    const finalUrl = `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${cleanPath}`;
    console.warn(`[getApiUrl] Capacitor fallback to absolute URL: ${finalUrl}`);
    return finalUrl;
  }

  // If we are running on standard web browser (http/https), absolute origin paths are safe and prevent relative subpath corruption
  if (window.location.protocol.startsWith("http")) {
    if (configuredBaseUrl) {
      console.log(`[getApiUrl] Web context using adjusted VITE_API_BASE_URL: ${configuredBaseUrl}`);
      return `${configuredBaseUrl}${cleanPath}`;
    }
    let origin = window.location.origin;
    if (origin.endsWith("/")) {
      origin = origin.slice(0, -1);
    }
    const finalUrl = `${origin}${cleanPath}`;
    console.log(`[getApiUrl] Returning absolute origin-based URL: ${finalUrl}`);
    return finalUrl;
  }

  if (configuredBaseUrl) {
    console.log(`[getApiUrl] Fallback using adjusted VITE_API_BASE_URL: ${configuredBaseUrl}`);
    return `${configuredBaseUrl}${cleanPath}`;
  }

  const isSharedPreview =
    typeof window !== "undefined" && window.location.hostname.includes("run.app");
  const baseUrl = import.meta.env.DEV
    ? "https://ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
    : isSharedPreview
      ? "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
      : "https://sar-scan.vercel.app";

  const finalUrl = `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${cleanPath}`;
  console.warn(
    `[getApiUrl] Fallback to absolute URL: ${finalUrl}, isCapacitor: ${isCapacitor}, protocol: ${window.location.protocol}`,
  );
  return finalUrl;
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

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch (err) {
    void err;
  }
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === "function") {
    try {
      return cap.isNativePlatform();
    } catch (err) {
      void err;
    }
  }
  return isInstalledApp();
}

/**
 * Converte string de fcm_token (seja token único, lista separada por vírgulas ou JSON array)
 * em array de tokens individuais para suporte multi-dispositivo.
 */
export function parseFcmTokens(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((t) => String(t).trim())
          .filter((t) => Boolean(t) && !t.startsWith("fcm_mock_"));
      }
    } catch {
      // fallback
    }
  }

  return trimmed
    .split(",")
    .map((t) => t.trim())
    .filter((t) => Boolean(t) && !t.startsWith("fcm_mock_"));
}

/**
 * Adiciona um novo token de dispositivo à lista de tokens do utilizador sem apagar os outros telemóveis.
 */
export function mergeFcmTokens(
  existingRaw: string | null | undefined,
  newDeviceToken: string,
): string {
  const existing = parseFcmTokens(existingRaw);
  const cleanNew = newDeviceToken.trim();
  if (!cleanNew) return existing.join(",");

  const tokenSet = new Set(existing);
  tokenSet.add(cleanNew);

  // Mantém até 10 telemóveis/dispositivos ativos mais recentes
  const allTokens = Array.from(tokenSet);
  const limited = allTokens.slice(-10);
  return limited.join(",");
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
