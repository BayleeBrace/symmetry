import { createClient } from "@supabase/supabase-js";

export function hasSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase is not connected");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
