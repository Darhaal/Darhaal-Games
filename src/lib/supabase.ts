import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The publishable key (`sb_publishable_…`). Supabase retires the old JWT
// anon key in 2027; this name never held one, so an old value cannot linger.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'See docs/environment.md for details.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
