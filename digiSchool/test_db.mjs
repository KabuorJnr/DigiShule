import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'rooneykabuor2004@gmail.com',
    password: '12345678'
  });
  
  const id = 'pay_1783609111224'; // The one that is pending
  
  // Update it to Verified, just like the browser does
  const { data, error } = await supabase.from('finance_payments').update({ status: 'Verified' }).eq('id', id).select();
  
  console.log('Update result:', data);
  console.log('Update error:', error);
}

test();
