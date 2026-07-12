import { createClient } from '@supabase/supabase-js';

let _client;
export function getSupabase() {
  if (!_client) _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return _client;
}

export function resetSupabaseClient() {
  _client = null;
}
