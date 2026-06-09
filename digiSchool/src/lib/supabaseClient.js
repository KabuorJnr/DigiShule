import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface a clear message during development instead of a cryptic runtime error.
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in digiSchool/.env'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Login keeps a username UX, but Supabase Auth signs in with email/password.
// We resolve the username to its auth email via a security-definer RPC.
export async function signInWithUsername(username, password) {
  const uname = (username || '').trim();
  if (!uname || !password) return { error: { message: 'Enter a username and password.' } };

  const { data: email, error: rpcError } = await supabase.rpc('email_for_username', {
    p_username: uname,
  });
  if (rpcError) return { error: rpcError };
  if (!email) return { error: { message: 'Invalid username or password. Please try again.' } };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: { message: 'Invalid username or password. Please try again.' } };
  return { data };
}
