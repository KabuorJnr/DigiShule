import { createClient } from '@supabase/supabase-js';

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
 */
export async function signInWithUsername(username, password) {
  const uname = (username || '').trim();
  if (!uname || !password) return { error: { message: 'Enter a username and password.' } };

  // ── 1. Try Supabase Auth ─────────────────────────────────────────
  try {
    let emailToUse = null;
    
    if (uname.includes('@')) {
      emailToUse = uname;
    } else {
      // Otherwise, look up the email via RPC
      // If it looks like a prefix + number, force uppercase (e.g., prn12345 -> PRN12345)
      let rpcUname = uname;
      if (/^(prn|tch|stu|adm)\d+$/i.test(uname)) {
        rpcUname = uname.toUpperCase();
      }
      const { data: email, error: rpcError } = await supabase.rpc('email_for_username', {
        p_username: rpcUname,
      });
      if (!rpcError && email) {
        emailToUse = email;
      }
    }

    if (emailToUse) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });

      if (error) {
        // Return the actual Supabase error (e.g. 'Email not confirmed' or 'Invalid login credentials')
        return { error };
      }

      if (data?.user) {
        // Supabase auth succeeded — verify a profile row exists.
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileRow) {
          // Full real user with profile — proceed with Supabase session.
          return { data };
        }

        // Auto-heal missing profile (happens if staff creation failed mid-way due to email rate limits)
        const userMeta = data.user.user_metadata || {};
        const { error: insertErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          username: data.user.email,
          full_name: userMeta.full_name || 'Staff Member',
          role: userMeta.role || 'staff'
        });

        if (!insertErr) {
          return { data };
        }

        // Fallback if insertion still fails
        await supabase.auth.signOut();
      }
    }
  } catch (err) {
    // Network error or RPC doesn't exist.
    console.warn('Supabase auth catch block:', err);
    return { error: { message: 'Network error or invalid credentials. Please try again.' } };
  }

  return { error: { message: 'Invalid username or password. Please try again.' } };
}

/** Sign out — clears Supabase session. */
export async function signOutAll() {
  await supabase.auth.signOut();
}
