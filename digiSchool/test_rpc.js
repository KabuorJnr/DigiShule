import { createClient } from '@supabase/supabase-js';

const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';

const supabase = createClient(url, anonKey);

async function testRpc() {
  console.log("Testing email_for_username RPC...");
  const { data, error } = await supabase.rpc('email_for_username', {
    p_username: 'TCH_TEST999',
  });
  console.log("RPC Data:", data);
  console.log("RPC Error:", error);
}

testRpc();
