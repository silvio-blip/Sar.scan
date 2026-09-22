import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

/**
 * Initiates Google Sign-In.
 * On native mobile devices (Android/iOS), it attempts to use the native Google Sign-In SDK
 * via the `@codetrix-studio/capacitor-google-auth` plugin.
 * On the web, or if native sign-in is not configured or fails, it gracefully falls back
 * to Supabase's standard OAuth flow (opening in the Capacitor In-App Browser for mobile, or standard redirect on web).
 */
export async function handleGoogleSignIn() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      console.log("[GoogleAuth] Native environment detected. Initializing native Google Auth...");
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

      const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || "181086329740-sv5g9veth6qsitqistm84ltuve9a5d5m.apps.googleusercontent.com";

      if (!clientId) {
        console.warn(
          "[GoogleAuth] VITE_GOOGLE_WEB_CLIENT_ID is not set in environment variables. Falling back to browser OAuth...",
        );
        throw new Error("VITE_GOOGLE_WEB_CLIENT_ID_MISSING");
      }

      GoogleAuth.initialize({
        clientId: clientId,
        scopes: ["profile", "email"],
      });

      console.log("[GoogleAuth] Triggering native Google Accounts sheet with Client ID:", clientId);
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication.idToken;

      if (!idToken) {
        throw new Error("No idToken returned from native Google Auth.");
      }

      console.log("[GoogleAuth] Native token acquired successfully. Exchanging with Supabase...");
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) throw error;
      console.log("[GoogleAuth] Supabase session established successfully from native token!");
      return { data, error: null };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn("[GoogleAuth] Native Google Sign-In failed or was cancelled. Error:", err);

      // Check if it was a user cancellation
      const isCancellation =
        errMsg.toLowerCase().includes("cancel") ||
        errMsg.includes("12501") ||
        errMsg.toLowerCase().includes("closed");

      if (isCancellation) {
        console.log("[GoogleAuth] Native sign-in was cancelled by the user. Stopping.");
        return { data: null, error: new Error("cancelled") };
      }

      // If VITE_GOOGLE_WEB_CLIENT_ID is missing, return a clean error so the user knows they need to set it
      if (errMsg === "VITE_GOOGLE_WEB_CLIENT_ID_MISSING") {
        return {
          data: null,
          error: new Error(
            "Configuração pendente: Defina VITE_GOOGLE_WEB_CLIENT_ID nas variáveis de ambiente (.env) para o login nativo.",
          ),
        };
      }

      // Format a detailed error string with JSON.stringify(err) if possible to show exact error fields
      let detailedError = errMsg;
      try {
        if (err && typeof err === "object") {
          detailedError = `${errMsg} | Detalhes: ${JSON.stringify(err)}`;
        }
      } catch (e) {
        detailedError = `${errMsg} | Erro não-serializável: ${String(err)}`;
      }

      // If it's a real configuration error (e.g., audience mismatch on Supabase),
      // we should STOP and return the error so it can be toasted, instead of doing a silent fallback
      // which confuses the user by opening the browser.
      console.error("[GoogleAuth] Real configuration or server error:", err);
      return {
        data: null,
        error: new Error(
          `Erro no login nativo: ${detailedError}. Verifique o SHA-1, Client IDs e console do Google/Supabase.`,
        ),
      };
    }
  }

  // Web Browser flow or Native Fallback
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    return { data: null, error };
  }

  // If we are in Capacitor and standard OAuth returned a URL (due to fallback),
  // open it in the In-App browser
  if (data?.url && isNative) {
    console.log("[GoogleAuth] Opening standard OAuth URL in Capacitor Custom Tabs/Safari View...");
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url });
  }

  return { data, error: null };
}
