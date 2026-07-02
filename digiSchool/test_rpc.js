import { createClient } from '@supabase/supabase-js';

const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';

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
