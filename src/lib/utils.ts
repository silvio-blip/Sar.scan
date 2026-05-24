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
    const baseUrl = import.meta.env.DEV
      ? "https://ais-dev-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app"
      : "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app";

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

  const baseUrl = import.meta.env.DEV
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
