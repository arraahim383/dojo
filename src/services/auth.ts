import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = authConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const authRedirectUrl =
  import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() ||
  (typeof window !== 'undefined' && window.location.hostname === 'dojo-omega-two.vercel.app'
    ? window.location.origin
    : 'https://dojo-omega-two.vercel.app');
