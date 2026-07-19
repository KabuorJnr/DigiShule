import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const bLogin = await supabase.auth.signInWithPassword({email: 'bursar@digischool.com', password: 'password123'});
  const bId = bLogin?.data?.user?.id;
  
  const aLogin = await supabase.auth.signInWithPassword({email: 'accountant@digischool.com', password: 'password123'});
  const aId = aLogin?.data?.user?.id;

  const adminLogin = await supabase.auth.signInWithPassword({email: 'rooneykabuor2004@gmail.com', password: '12345678'});
  
  // Get admin's school_id to use for the new profiles
  const { data: adminProf } = await supabase.from('profiles').select('school_id').eq('id', adminLogin.data.user.id).single();
  const schoolId = adminProf?.school_id;

  if (bId) {
    const { error: profErr1 } = await supabase.from('profiles').upsert({
      id: bId, username: 'bursar', full_name: 'Jane Bursar', role: 'finance', teacher_id: bId, school_id: schoolId
    });
    if (profErr1) console.error("Error inserting bursar profile:", profErr1.message);
  }

  if (aId) {
    const { error: profErr2 } = await supabase.from('profiles').upsert({
      id: aId, username: 'accountant', full_name: 'Joe Accountant', role: 'bursar', teacher_id: aId, school_id: schoolId
    });
    if (profErr2) console.error("Error inserting accountant profile:", profErr2.message);
  }

  console.log("Done fixing profiles.");
}

main().catch(console.error);
