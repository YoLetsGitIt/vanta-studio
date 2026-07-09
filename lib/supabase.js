import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aznxvdnpvbcofaqxgmtu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SrxxKBifFjEUF8Is9ipQwQ_HVvvLPn_';

let _client;
export function getSupabase() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export function resetSupabaseClient() {
  _client = null;
}
