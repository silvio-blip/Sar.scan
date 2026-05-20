import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  // Detect if we are running under Capacitor / native webview
  const isCapacitor = typeof window !== "undefined" && (
    (window as any).Capacitor ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "http-extension:" ||
    (window.location.hostname === "localhost" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );

  if (isCapacitor) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://ais-pre-54ehh7ab2tw2wz6535wh2k-96926789601.europe-west2.run.app";
    return `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${cleanPath}`;
  }

  return cleanPath;
}
