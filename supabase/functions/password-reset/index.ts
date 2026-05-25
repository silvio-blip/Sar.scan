import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { action, email, code, password } = await req.json();
    const cleanEmail = email ? email.toLowerCase().trim() : "";

    if (action === "request") {
      if (!cleanEmail) throw new Error("Email é obrigatório");

      // Verify user existence
      const {
        data: { users },
        error: listError,
      } = await supabaseClient.auth.admin.listUsers();
      if (listError) throw new Error(`Erro ao listar usuários: ${listError.message}`);

      const targetUser = users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);

      if (!targetUser) throw new Error("O e-mail inserido não corresponde a uma conta ativa");

      const newCode = Array.from(Array(15), () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*".charAt(
          Math.floor(Math.random() * 70),
        ),
      ).join("");

      // Delete existing codes first to avoid constraint and duplicate issues
      try {
        const { error: deleteError } = await supabaseClient
          .from("password_reset_codes")
          .delete()
          .eq("email", cleanEmail);
        if (deleteError) {
          console.warn("[Password Reset] Explicit delete returned error:", deleteError.message);
        } else {
          console.log(
            `[Password Reset] Successfully deleted any existing recovery codes for: ${cleanEmail}`,
          );
        }
      } catch (delErr: any) {
        console.warn("[Password Reset] Delete before insert threw exception:", delErr.message);
      }

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora de expiração

      // Use upsert to safely replace or insert the code for the primary key (email)
      let insertResult = await supabaseClient.from("password_reset_codes").upsert({
        email: cleanEmail,
        code: newCode,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        user_id: targetUser.id,
      });

      if (
        insertResult.error &&
        (insertResult.error.message.includes("user_id") ||
          insertResult.error.message.includes("column") ||
          insertResult.error.message.includes("schema cache"))
      ) {
        console.warn("[Password Reset] Retrying upsert without user_id...");
        insertResult = await supabaseClient.from("password_reset_codes").upsert({
          email: cleanEmail,
          code: newCode,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
        });
      }

      if (
        insertResult.error &&
        (insertResult.error.message.includes("expires_at") ||
          insertResult.error.message.includes("column") ||
          insertResult.error.message.includes("schema cache"))
      ) {
        console.warn("[Password Reset] Retrying upsert without expires_at...");
        insertResult = await supabaseClient.from("password_reset_codes").upsert({
          email: cleanEmail,
          code: newCode,
          created_at: new Date().toISOString(),
          user_id: targetUser.id,
        });
      }

      if (insertResult.error) {
        console.warn("[Password Reset] Retrying upsert with minimal fields...");
        insertResult = await supabaseClient.from("password_reset_codes").upsert({
          email: cleanEmail,
          code: newCode,
        });
      }

      if (insertResult.error) {
        throw new Error(`Erro ao guardar código de segurança: ${insertResult.error.message}`);
      }

      // Email sending via SMTP
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpUser = Deno.env.get("SMTP_USER");

      console.log(`[SMTP] Tentando enviar e-mail para ${cleanEmail} via ${smtpHost}`);

      if (smtpHost && smtpUser) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
            secure: Deno.env.get("SMTP_SECURE") === "true",
            auth: {
              user: smtpUser,
              pass: Deno.env.get("SMTP_PASS"),
            },
          });

          await transporter.sendMail({
            from: Deno.env.get("SMTP_SENDER"),
            to: cleanEmail,
            subject: "Redefinição de Senha",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #007bff;">Redefinição de Senha</h2>
                <p>Olá,</p>
                <p>Recebemos uma solicitação para redefinir a sua senha. Utilize o código de segurança abaixo para prosseguir:</p>
                <div style="padding: 20px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                  ${newCode}
                </div>
                <p>Se você não solicitou esta redefinição, por favor, ignore este e-mail.</p>
                <p>Atenciosamente,<br>Equipe Sar.Scan</p>
              </div>
            `,
          });
          console.log(`[SMTP] E-mail enviado com sucesso para ${cleanEmail}`);
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (err: any) {
          console.error(`[SMTP] Erro ao enviar e-mail para ${cleanEmail}:`, err);
          return new Response(
            JSON.stringify({
              success: true,
              warning: "smtp_failed",
              code: newCode,
              errorDetails: err.message,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            },
          );
        }
      } else {
        console.warn(
          "[SMTP] Configuração de SMTP incompleta. Retornando código em formato JSON para desenvolvimento.",
        );
        return new Response(
          JSON.stringify({ success: true, warning: "smtp_missing", code: newCode }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
    } else if (action === "verify") {
      if (!cleanEmail || !code) throw new Error("Dados incompletos");

      const { data: record, error: recordError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", cleanEmail)
        .eq("code", code.trim())
        .maybeSingle();

      if (recordError || !record) {
        throw new Error("Código de segurança inválido ou expirado");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else if (action === "confirm") {
      if (!cleanEmail || !code || !password) throw new Error("Dados incompletos");

      const { data: record, error: recordError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", cleanEmail)
        .eq("code", code)
        .maybeSingle();

      if (recordError || !record) {
        throw new Error("Código de segurança inválido ou expirado");
      }

      const {
        data: { users },
        error: listError,
      } = await supabaseClient.auth.admin.listUsers();
      if (listError) throw new Error(`Erro ao verificar usuário: ${listError.message}`);

      const targetUser = users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);

      if (!targetUser) throw new Error("Usuário não encontrado");

      await supabaseClient.auth.admin.updateUserById(targetUser.id, {
        password: password,
      });

      await supabaseClient.from("password_reset_codes").delete().eq("email", cleanEmail);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Ação inválida");
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
