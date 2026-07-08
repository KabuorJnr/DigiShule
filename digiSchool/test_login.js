import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase credentials in process.env");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

function generateSecurePassword(length = 10) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

async function run() {
  for (let i=0; i<5; i++) {
    const password = generateSecurePassword(10);
    const email = `test_pw_${Date.now()}_${i}@edu1app.tech`;
    
    console.log(`[${i}] Password:`, password);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { console.error("Sign up error:", signUpError); continue; }
    
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.error("Sign in error:", signInError.message);
    } else {
      console.log(`[${i}] Sign in success!`);
    }
  }
}
run();
