import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkxMjY0NiwiZXhwIjoyMDk2NDg4NjQ2fQ.w2p-w5XvN_g59D9L2XQ04O9D_93m0C2M1yWpX_vE5qM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "medicalInfo" TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS "medicalInfo" TEXT;
  ` });
  console.log('Result:', error || data || 'Success');
}

run();
