-- =====================================================================
-- ADICIONAR COLUNA 'plan' À TABELA PROFILES
-- Execute este script no SQL Editor do Supabase
-- =====================================================================

-- 1. Adiciona coluna plan com valor padrão 'gratis'
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'gratis'
  CHECK (plan IN ('gratis', 'pro', 'ultra'));

-- 2. Usuários já pagantes ficam como 'pro' por padrão
UPDATE public.profiles 
  SET plan = 'pro' 
  WHERE status_pagamento = true AND plan = 'gratis';

-- 3. Atualizar a função handle_new_user para incluir o plan
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ 
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, plan)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'Usuário Azura'
    ),
    NEW.email,
    'gestor',
    'gratis'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
