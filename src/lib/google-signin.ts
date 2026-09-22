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
        serverClientId: clientId,
        scopes: ["profile", "email"],
        grantOfflineAccess: true,
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
      console.warn("[GoogleAuth] Native Google Sign-In notice:", err);

      // Check if it was a user cancellation
      const isCancellation =
        errMsg.toLowerCase().includes("cancel") ||
        errMsg.includes("12501") ||
        errMsg.toLowerCase().includes("closed");

      if (isCancellation) {
        console.log("[GoogleAuth] Native sign-in was cancelled by the user. Stopping.");
        return { data: null, error: new Error("cancelled") };
      }

      console.warn(
        `[GoogleAuth] Native SDK issue (Code ${err?.code || "unknown"}). Attempting fallback to secure Browser OAuth...`,
      );
      // Fall through to the browser OAuth flow so the user is never locked out
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
