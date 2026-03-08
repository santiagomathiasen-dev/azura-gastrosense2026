-- ========================================================
-- GOOGLE AUTH & PROFILE AUTOMATION
-- ========================================================
-- Execute este script no SQL Editor do Supabase para garantir que
-- novos usuários via Google (ou Email) tenham um perfil criado automaticamente.
-- 1. Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.profiles (id, full_name, email, role)
VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            'Usuário Azura'
        ),
        NEW.email,
        'gestor' -- Papel padrão inicial
    ) ON CONFLICT (id) DO NOTHING;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- 3. Garantir que Perfis existentes tenham permissão de visualização (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção pelo trigger" ON public.profiles;
-- Nota: O trigger usa SECURITY DEFINER, então não precisa de política de INSERT publica.
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR
SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR
UPDATE USING (auth.uid() = id);