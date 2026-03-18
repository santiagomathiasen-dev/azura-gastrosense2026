-- Add subscription and trial columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mp_customer_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

-- Update existing users with a 7-day trial starting from today
UPDATE public.profiles
SET 
  trial_start_date = NOW(),
  subscription_end_date = NOW() + INTERVAL '7 days'
WHERE subscription_end_date IS NULL;

-- Update the handle_new_user function to set default trial dates accurately 
-- maintaining the original AZURA schema structure
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
    status_pagamento,
    trial_start_date,
    subscription_end_date
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    'gestor'::business_role,
    true,
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
