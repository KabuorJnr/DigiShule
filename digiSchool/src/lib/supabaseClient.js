import { createClient } from '@supabase/supabase-js';
import { USERS } from '../data/users';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
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

/**
 * Sign in using username + password.
 *
 * Strategy:
 * 1. Try Supabase: look up email via `email_for_username` RPC → signInWithPassword.
 * 2. If Supabase has no matching user (RPC returns null / RPC missing), fall back to
 *    the demo seed credentials in users.js and set a local mock session.
 *
 * The mock session stores the matched seed user in localStorage so App.jsx can
 * bootstrap the correct role without a real Supabase session.
 */
export async function signInWithUsername(username, password) {
  const uname = (username || '').trim();
  if (!uname || !password) return { error: { message: 'Enter a username and password.' } };

  // ── 1. Try Supabase Auth ─────────────────────────────────────────
  try {
    const { data: email, error: rpcError } = await supabase.rpc('email_for_username', {
      p_username: uname,
    });

    if (!rpcError && email) {
      // RPC succeeded and found an email — attempt Supabase sign-in
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { data };
      // Wrong password for Supabase user — don't fall through to demo
      return { error: { message: 'Invalid username or password. Please try again.' } };
    }
    // rpcError or email is null → no Supabase user, fall through to demo
  } catch {
    // Network error or RPC doesn't exist yet — fall through to demo
  }

  // ── 2. Demo / seed fallback ──────────────────────────────────────
  const seedUser = USERS.find(
    (u) =>
      u.username.toLowerCase() === uname.toLowerCase() &&
      u.password === password
  );

  if (!seedUser) {
    return { error: { message: 'Invalid username or password. Please try again.' } };
  }

  // Store the seed user as a mock session so App.jsx can read it
  localStorage.setItem('eduone_demo_user', JSON.stringify(seedUser));
  // Dispatch a custom event so App.jsx reacts synchronously
  window.dispatchEvent(new CustomEvent('eduone:demo_login', { detail: seedUser }));

  return { data: { demoUser: seedUser } };
}

/** Sign out — clears both Supabase session and demo session. */
export async function signOutAll() {
  localStorage.removeItem('eduone_demo_user');
  await supabase.auth.signOut();
}
