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

    if (action === "request") {
      // Verify user existence
      const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers();
      const targetUser = users.find((u: any) => u.email === email);
      
      if (listError || !targetUser) throw new Error("Usuário não encontrado");

      const newCode = Array.from(Array(15), () => 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
        .charAt(Math.floor(Math.random() * 70))
      ).join("");

      await supabaseClient
        .from("password_reset_codes")
        .upsert({
          email,
          code: newCode,
          created_at: new Date().toISOString(),
          user_id: targetUser.id, // Ensure we store user_id
        });

      // Email sending via SMTP
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpUser = Deno.env.get("SMTP_USER");

      console.log(`[SMTP] Tentando enviar e-mail para ${email} via ${smtpHost}`);

      if (smtpHost && smtpUser) {
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
          to: email,
          subject: "Redefinição de Senha",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #007bff;">Redefinição de Senha</h2>
              <p>Olá,</p>
              <p>Recebemos uma solicitação para redefinir a sua senha. Utilize o código abaixo para prosseguir:</p>
              <div style="padding: 20px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                ${newCode}
              </div>
              <p>Se você não solicitou esta redefinição, por favor, ignore este e-mail.</p>
              <p>Atenciosamente,<br>Equipe Sar.Scan</p>
            </div>
          `,
        });
        console.log(`[SMTP] E-mail enviado com sucesso para ${email}`);
      } else {
        console.warn("[SMTP] SMTP configuration missing.");
        throw new Error("Erro na configuração de envio de email");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else if (action === "confirm") {
      if (!email || !code || !password) throw new Error("Dados incompletos");

      const { data: record, error: recordError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", email)
        .eq("code", code)
        .maybeSingle();

      if (recordError || !record) {
        throw new Error("Código inválido ou expirado");
      }

      const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers();
      const targetUser = users.find((u: any) => u.email === email);
      
      if (listError || !targetUser) throw new Error("Usuário não encontrado");

      await supabaseClient.auth.admin.updateUserById(targetUser.id, {
        password: password,
      });

      await supabaseClient.from("password_reset_codes").delete().eq("email", email);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Ação inválida");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
