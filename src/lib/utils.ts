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

  // If we are running on standard web browser (http/https), relative paths are ALWAYS safe
  if (window.location.protocol.startsWith("http")) {
    console.log(`[getApiUrl] Returning relative path for web context: ${cleanPath}`);
    return cleanPath;
  }

  // Explicitly configured URL takes precedence
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredBaseUrl) {
    console.log(`[getApiUrl] Using configured VITE_API_BASE_URL: ${configuredBaseUrl}`);
    return `${configuredBaseUrl.endsWith("/") ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl}${cleanPath}`;
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

  // Fallback to absolute service endpoint for native wrappers
  let baseUrl = import.meta.env.DEV
    ? "https://ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
    : "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app";

  const finalUrl = `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${cleanPath}`;
  console.warn(
    `[getApiUrl] Fallback to absolute URL: ${finalUrl}, isCapacitor: ${isCapacitor}, protocol: ${window.location.protocol}`,
  );
  return finalUrl;
}

export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;

  // 1. Capacitor JS bridge or custom protocols
  const isCapacitor = !!((window as any).Capacitor || (window as any).Capacitor?.Plugins);
  const isCapacitorProtocol = ["capacitor:", "http-extension:", "file:", "ionic:"].includes(
    window.location.protocol,
  );

  // 2. Standalone display mode (PWA installed)
  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://");

  // 3. User agent cues typical of WebViews in Android / iOS apps
  const ua = navigator.userAgent || "";
  const isWebView =
    /wv|WebView|Android.*Version\/[0-9.]+/i.test(ua) ||
    (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua));

  return isCapacitor || isCapacitorProtocol || isPWA || isWebView;
}
