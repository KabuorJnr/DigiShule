import { createClient } from '@supabase/supabase-js';

const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';

const supabase = createClient(url, anonKey);

async function checkAdmissions() {
  console.log("Fetching admissions columns by ordering created_at...");
  const { data, error } = await supabase.from('admissions').select('*').order('created_at').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

checkAdmissions();
