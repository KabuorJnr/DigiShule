import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oblzjefrmtxcvbagvnrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching staff...');
  const { data: staff, error } = await supabase.from('staff').select('id, name, status, school_id');
  if (error) { console.error('Error fetching staff:', error); return; }
  
  console.log('Fetching profiles...');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, role, teacher_id');
  if (pErr) { console.error('Error fetching profiles:', pErr); return; }

  const teachersToInsert = [];
  
  for (const s of staff) {
    const hasTeacherProfile = profiles.some(p => (p.teacher_id === s.id || p.id === s.id) && ['teacher', 'principal', 'deputy_admin', 'deputy_academic'].includes(p.role));
    if (hasTeacherProfile) {
      teachersToInsert.push({
        id: s.id,
        name: s.name,
        role: 'teacher',
        emp_id: s.id,
        status: s.status,
        school_id: s.school_id
      });
    }
  }

  console.log(`Found ${teachersToInsert.length} staff members to sync to teachers table.`);
  
  if (teachersToInsert.length > 0) {
    const { data, error: iErr } = await supabase.from('teachers').upsert(teachersToInsert, { onConflict: 'id' });
    if (iErr) {
      console.error('Error inserting teachers:', iErr);
    } else {
      console.log('Successfully synced teachers.');
    }
  }
}
run();
