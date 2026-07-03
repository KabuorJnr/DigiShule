import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("Missing VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function testTeacherLogin() {
  const { data: email, error: rpcError } = await supabase.rpc('email_for_username', { p_username: 'TCH31210' });
  console.log("Email from RPC:", email);
  
  if (email) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: '@YIwGa0q7J'
    });
    console.log("Auth User exists:", !!authData?.user);
    if (authData?.user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
      console.log("Profile Data:", profile);
    } else {
      console.log("Auth Error:", authError);
    }
  }
}

testTeacherLogin();
