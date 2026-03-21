-- Create invoices storage bucket (private, with 10MB size limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access their own invoice files (path must start with user_id)
CREATE POLICY IF NOT EXISTS "Users can upload invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can read own invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can delete own invoices"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
