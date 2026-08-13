/**
 * delete_mock_teachers.js
 * 
 * Deletes all 50 mock teachers and their associated data
 * (qualifications, subject assignments, and mock subjects).
 * 
 * Run: node scripts/delete_mock_teachers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found.');
  process.exit(1);
}
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DigiShule — Delete All 50 Mock Teachers');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Authenticate
  const loginEmail = process.argv[2] || 'rooneykabuor2004@gmail.com';
  const loginPass = process.argv[3] || '12345678';
  console.log(`🔐 Authenticating as ${loginEmail}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: loginPass,
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);
  console.log(`  ✅ Signed in.\n`);

  // 1. Delete subject assignments
  console.log('🗑️  Deleting subject assignments...');
  const { error: e1, count: c1 } = await supabase
    .from('subject_assignments')
    .delete({ count: 'exact' })
    .like('teacher_id', 'mock_teacher_%');
  console.log(`  ${e1 ? '⚠ ' + e1.message : '✅ Done'}\n`);

  // 2. Delete qualifications
  console.log('🗑️  Deleting teacher qualifications...');
  const { error: e2 } = await supabase
    .from('teacher_subject_qualifications')
    .delete()
    .like('id', 'mock_teacher_%');
  console.log(`  ${e2 ? '⚠ ' + e2.message : '✅ Done'}\n`);

  // 3. Delete staff records
  console.log('🗑️  Deleting mock staff records...');
  const { error: e3s } = await supabase
    .from('staff')
    .delete()
    .like('id', 'mock_teacher_%');
  console.log(`  ${e3s ? '⚠ ' + e3s.message : '✅ Done'}\n`);

  // 4. Delete teachers
  console.log('🗑️  Deleting mock teachers...');
  const { error: e3 } = await supabase
    .from('teachers')
    .delete()
    .like('id', 'mock_teacher_%');
  console.log(`  ${e3 ? '⚠ ' + e3.message : '✅ Done'}\n`);

  // 5. Delete mock subjects
  console.log('🗑️  Deleting mock subjects...');
  const { error: e4 } = await supabase
    .from('subjects')
    .delete()
    .like('id', 'mock_subj_%');
  console.log(`  ${e4 ? '⚠ ' + e4.message : '✅ Done'}\n`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ All mock teachers and related data deleted!');
  console.log('═══════════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
