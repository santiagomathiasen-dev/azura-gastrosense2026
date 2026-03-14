CREATE TABLE IF NOT EXISTS public.pos_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  credentials JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  webhook_url VARCHAR(1024),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pos_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pos integrations"
  ON public.pos_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pos integrations"
  ON public.pos_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pos integrations"
  ON public.pos_integrations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pos integrations"
  ON public.pos_integrations FOR DELETE
  USING (auth.uid() = user_id);
