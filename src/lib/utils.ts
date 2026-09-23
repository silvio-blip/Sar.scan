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

  // 1. Official Capacitor native platform check
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return true;
  } catch (e) {
    // Ignored in non-native environments
    console.debug("[Env Detection] NativePlatform check error:", e);
  }

  // 2. Global window.Capacitor inspection
  try {
    const cap = (window as any).Capacitor;
    if (cap) {
      if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
      if (typeof cap.getPlatform === "function") {
        const p = cap.getPlatform();
        if (p === "android" || p === "ios") return true;
      }
      if (cap.isNative === true || cap.platform === "android" || cap.platform === "ios") {
        return true;
      }
      if (cap.Plugins && typeof cap.Plugins === "object" && Object.keys(cap.Plugins).length > 0) {
        return true;
      }
    }
  } catch (e) {
    console.debug("[Env Detection] Global Capacitor check error:", e);
  }

  // 3. Native bridge or custom app injections (Android WebView JavascriptInterface or WebKit)
  if (
    (window as any).androidBridge !== undefined ||
    (window as any).Android !== undefined ||
    (window as any).webkit?.messageHandlers !== undefined
  ) {
    return true;
  }

  // 4. Custom protocols typical of compiled app views
  const protocol = window.location.protocol || "";
  if (["capacitor:", "http-extension:", "file:", "ionic:"].includes(protocol)) {
    return true;
  }

  // 5. Hostname localhost combined with Capacitor or mobile WebView
  const hostname = window.location.hostname || "";
  const origin = window.location.origin || "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.startsWith("file:")
  ) {
    if ((window as any).Capacitor !== undefined) return true;
  }

  // 6. UserAgent check for Android/iOS WebView / Standalone mode
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent;
    if (/Capacitor|Cordova/i.test(ua)) return true;
    if (/Android.*wv/i.test(ua)) return true;
    if ((navigator as any).standalone === true) return true;
  }

  // 7. Check if window.matchMedia standalone is true (PWA / installed webview)
  if (typeof window.matchMedia === "function") {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
    } catch (e) {
      console.debug("[Env Detection] matchMedia error:", e);
    }
  }

  return false;
}

export { getFoodEmoji, FOOD_EMOJI_CATEGORIES, DEFAULT_FOOD_EMOJI } from "./food-emoji";
export { FoodIcon, type FoodIconProps } from "@/components/food-icon";

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
