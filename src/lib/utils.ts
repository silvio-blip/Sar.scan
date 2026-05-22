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
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

  // Detect if we are running in an environment where relative API paths won't work:
  // 1. Capacitor / Native protocol (capacitor://, file://, etc.)
  // 2. Running on a mobile device (Android/iOS) and NOT on our official *.run.app production servers
  // 3. Running on localhost inside a mobile agent webview
  // 4. Capacitor JS bridge exists on the window object
  const isCapacitor = !!(
    (window as any).Capacitor ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "http-extension:" ||
    window.location.protocol === "file:" ||
    (window.location.hostname === "localhost" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) ||
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.location.hostname.endsWith(".run.app") && !window.location.hostname.endsWith(".vercel.app"))
  );

  if (isCapacitor || configuredBaseUrl) {
    const baseUrl = configuredBaseUrl || "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app";
    return `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${cleanPath}`;
  }

  return cleanPath;
}

export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  
  // 1. Capacitor JS bridge or custom protocols
  const isCapacitor = !!((window as any).Capacitor || (window as any).Capacitor?.Plugins);
  const isCapacitorProtocol = ["capacitor:", "http-extension:", "file:", "ionic:"].includes(window.location.protocol);
  
  // 2. Standalone display mode (PWA installed)
  const isPWA = window.matchMedia("(display-mode: standalone)").matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes("android-app://");
  
  // 3. User agent cues typical of WebViews in Android / iOS apps
  const ua = navigator.userAgent || "";
  const isWebView = /wv|WebView|Android.*Version\/[0-9.]+/i.test(ua) || 
                    (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua));

  return isCapacitor || isCapacitorProtocol || isPWA || isWebView;
}
