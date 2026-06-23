import { createClient } from '@supabase/supabase-js';
import { USERS } from '../data/users';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (url === 'https://placeholder.supabase.co') {
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

export const secondaryAuthClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Sign in using username + password.
 *
 * Strategy:
 * 1. Try Supabase: look up email via `email_for_username` RPC → signInWithPassword.
 *    ONLY proceeds with Supabase session if a profile row also exists (role is known).
 * 2. If Supabase has no profile row, signs out and falls through to seed credentials.
 * 3. If RPC missing / no match → falls through to seed credentials.
 *
 * This means demo/seed credentials ALWAYS work, even when a Supabase auth
 * account exists but the profile row hasn't been created yet.
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data?.user) {
        // Supabase auth succeeded — verify a profile row exists.
        // Without a profile row the app cannot determine the user's role.
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileRow) {
          // Full real user with profile — proceed with Supabase session.
          return { data };
        }

        // No profile row yet — sign out of Supabase and fall through to seed.
        await supabase.auth.signOut();
      }
      // Wrong password OR no profile → fall through to seed below.
    }
    // rpcError or email null → no Supabase user, fall through to seed.
  } catch {
    // Network error or RPC doesn't exist — fall through to seed.
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

  // Store the seed user as a mock session (persists across refreshes)
  localStorage.setItem('eduone_demo_user', JSON.stringify(seedUser));
  // Return demoUser — Login.jsx calls App.jsx's onDemoLogin prop directly.
  return { data: { demoUser: seedUser } };
}

/** Sign out — clears both Supabase session and demo session. */
export async function signOutAll() {
  localStorage.removeItem('eduone_demo_user');
  await supabase.auth.signOut();
}
