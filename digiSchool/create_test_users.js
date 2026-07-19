import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createStaffUser(email, password, name, role, dept) {
  console.log(`Creating user: ${email} (${role})...`);
  
  // 1. Create Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role
      }
    }
  });

  if (authError && !authError.message.toLowerCase().includes('already')) {
    console.error(`Auth Error for ${email}:`, authError.message);
    return;
  }

  // Generate a random ID if user already existed (for patching data)
  const userId = authData?.user?.id || `fake-${Date.now()}`;
  
  // 2. Insert into profiles (bypassing triggers if needed, but we'll try)
  // Actually, Supabase triggers usually create the profile automatically based on auth.users metadata.
  
  // Wait 1 second for triggers to finish
  await new Promise(r => setTimeout(r, 1000));

  // 3. Insert into staff table
  const { error: staffErr } = await supabase.from('staff').upsert({
    id: authData?.user?.id, 
    name,
    role,
    dept,
    status: 'Present'
  });

  if (staffErr) {
    console.error(`Staff Insert Error for ${email}:`, staffErr.message);
  } else {
    console.log(`Successfully created ${name} (${role})`);
  }
}

async function main() {
  await createStaffUser('bursar@digischool.com', 'password123', 'Jane Bursar', 'finance', 'Finance Office');
  await createStaffUser('accountant@digischool.com', 'password123', 'Joe Accountant', 'accountant', 'Finance Office');
}

main().catch(console.error);
