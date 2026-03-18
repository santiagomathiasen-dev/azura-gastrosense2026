// This file is adapted for Next.js App Router to use SSR Cookies
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// Primary: read from Next.js env vars. Fallback: hardcoded project values (safe public keys)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lqktevnjfywrujdhetlo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("Supabase Client: Environment variables are missing.");
}

export const supabase = createBrowserClient<any>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
