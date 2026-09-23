import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

export async function handleGoogleSignIn(): Promise<{ data: any; error: Error | null }> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      console.log("[GoogleAuth] Iniciando autenticação 100% nativa...");
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

      const clientId =
        (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string) ||
        "181086329740-sv5g9veth6qsitqistm84ltuve9a5d5m.apps.googleusercontent.com";

      GoogleAuth.initialize({
        clientId: clientId,
        serverClientId: clientId,
        scopes: ["profile", "email"],
        grantOfflineAccess: false,
      });

      const googleUser = await GoogleAuth.signIn();

      const idToken =
        googleUser?.authentication?.idToken ||
        (googleUser as any)?.idToken ||
        (googleUser as any)?.id_token;

      const accessToken =
        googleUser?.authentication?.accessToken ||
        (googleUser as any)?.accessToken ||
        (googleUser as any)?.access_token;

      if (!idToken) {
        throw new Error("O Google não forneceu o idToken necessário para autenticação.");
      }

      console.log("[GoogleAuth] Token obtido. Autenticando com Supabase...");
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        ...(accessToken ? { access_token: accessToken } : {}),
      });

      if (error) throw error;
      console.log("[GoogleAuth] Login Supabase concluído com sucesso!");
      return { data, error: null };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isCancelled =
        errMsg.toLowerCase().includes("cancel") ||
        errMsg.includes("12501") ||
        errMsg.toLowerCase().includes("closed");

      if (isCancelled) {
        return { data: null, error: new Error("cancelled") };
      }

      console.error("[GoogleAuth] Erro na autenticação nativa:", err);
      return {
        data: null,
        error: new Error(`Erro na autenticação com o Google: ${errMsg}`),
      };
    }
  }

  // Navegadores desktop / web
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  return { data, error: error ? new Error(error.message) : null };
}
