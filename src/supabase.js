import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publicKey);
export const supabase = isSupabaseConfigured ? createClient(url, publicKey) : null;

// This client always reads as a public visitor; it never persists or consumes a member session.
export const publicSupabase = isSupabaseConfigured ? createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'spinout-public' }
}) : null;
