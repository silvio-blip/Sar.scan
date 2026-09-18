-- Migração para criação da tabela de configurações gerais e chaves secretas (Stripe, Gemini, Webhooks)
-- Pode ser executada diretamente no Editor SQL do Supabase.

-- 1. Criação da tabela app_settings (Padrão Chave-Valor)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ativar Row Level Security (RLS) para proteger chaves e segredos
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança:
-- Somente administradores (service_role ou usuários com perfil de admin) podem consultar ou alterar
CREATE POLICY "Apenas administradores podem ler as configurações" 
ON public.app_settings
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Apenas administradores podem modificar as configurações" 
ON public.app_settings
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

-- 4. Inserir ou atualizar as chaves necessárias da Stripe
-- Substitua 'SUA_STRIPE_SECRET_KEY_AQUI' pela sua Secret Key (ex: sk_live_... ou sk_test_...)
-- Substitua 'SEU_STRIPE_WEBHOOK_SECRET_AQUI' pelo segredo do webhook (ex: whsec_...)
INSERT INTO public.app_settings (key, value)
VALUES 
    ('stripe_secret_key', 'COLOQUE_SUA_STRIPE_SECRET_KEY_AQUI'),
    ('stripe_webhook_secret', 'COLOQUE_SEU_STRIPE_WEBHOOK_SECRET_AQUI')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;
