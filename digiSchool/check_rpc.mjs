import { createClient } from '@supabase/supabase-js';

const url = process.argv[2];
const anonKey = process.argv[3];
const supabase = createClient(url, anonKey);

async function check() {
  console.log("Checking RPC email_for_username with ADM/2025/002...");
  const { data: email, error: rpcError } = await supabase.rpc('email_for_username', {
    p_username: 'ADM/2025/002'
  });
  console.log("RPC Error:", rpcError);
  console.log("RPC Data:", email);

  if (email) {
    console.log("Attempting sign in...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: 'ADM/2025/002'
    });
    console.log("Sign In Error:", error?.message);
    console.log("Sign In Data User:", data?.user?.id);
  }
}
check();
