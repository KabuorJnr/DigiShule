import { createClient } from '@supabase/supabase-js';
const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';

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
