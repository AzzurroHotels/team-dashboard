// supabase-config.js
// Paste your Supabase Project URL and anon public key below (Project Settings → API).
// IMPORTANT: This is safe to use in the browser ONLY with proper Row Level Security (RLS) policies.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://uxvjbkbbobayjejzimtk.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dmpia2Jib2JheWplanppbXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODU4OTIsImV4cCI6MjA4NTY2MTg5Mn0.sWY3RfKy080kKSUNZgYcECVCpSaN7Ec0WEuovaF2k9s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: treat placeholders as "not configured"
export function isSupabaseConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON_PUBLIC_KEY")
  );
}
