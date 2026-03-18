-- ========================================================
-- AZURA GASTROSENSE: GOOGLE AUTH & PAYMENT STATUS INITIALIZATION
-- ========================================================

-- 1. Ensure profiles table has all necessary columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
ADD COLUMN IF NOT EXISTS status_pagamento BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS mp_customer_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free_trial';

-- 2. Update existing users who don't have trial dates
UPDATE public.profiles
SET 
  trial_start_date = COALESCE(trial_start_date, NOW()),
  subscription_end_date = COALESCE(subscription_end_date, NOW() + INTERVAL '7 days'),
  status = COALESCE(status, 'ativo'),
  status_pagamento = COALESCE(status_pagamento, TRUE)
WHERE subscription_end_date IS NULL;

-- 3. FUNCTION: handle_new_user
-- This function automatically creates a profile when a new user signs up (Email or Google)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role,
    status,
    status_pagamento,
    trial_start_date,
    subscription_end_date
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    'gestor'::business_role,
    'ativo',
    true,
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
    
  RETURN NEW;
END;
$$;

-- 4. TRIGGER: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RLS Policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles 
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles 
FOR UPDATE USING (auth.uid() = id);

-- 6. Grant permissions
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
