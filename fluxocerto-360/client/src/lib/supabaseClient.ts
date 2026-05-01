import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = import.meta.env as SupabaseEnv;

const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function assertSupabaseConfigured() {
  if (!supabase) {
    return {
      ok: false as const,
      error: "Supabase não configurado. Usando fallback local do MVP.",
    };
  }

  return {
    ok: true as const,
    supabase,
  };
}
