/**
 * ingest_50_mock_teachers.js
 * 
 * Inserts 50 mock teachers into the DigiShule system and assigns them subjects.
 * All teacher IDs are prefixed with 'mock_teacher_' for easy bulk deletion later.
 * 
 * Run: node scripts/ingest_50_mock_teachers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Read .env ────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found in root directory.');
  process.exit(1);
}
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const url = envVars.VITE_SUPABASE_URL;
const key = envVars.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

// ── Subject & Department Definitions ─────────────────────────────────
const SUBJECTS = [
  { name: 'Mathematics',    code: '121', dept: 'Math',       isCore: true,  periods: 7 },
  { name: 'English',        code: '101', dept: 'Languages',  isCore: true,  periods: 7 },
  { name: 'Kiswahili',      code: '102', dept: 'Languages',  isCore: true,  periods: 5 },
  { name: 'Biology',        code: '231', dept: 'Sciences',   isCore: true,  periods: 5 },
  { name: 'Chemistry',      code: '233', dept: 'Sciences',   isCore: true,  periods: 5 },
  { name: 'Physics',        code: '232', dept: 'Sciences',   isCore: true,  periods: 5 },
  { name: 'History',        code: '311', dept: 'Humanities',  isCore: false, periods: 4 },
  { name: 'Geography',      code: '312', dept: 'Humanities',  isCore: false, periods: 4 },
  { name: 'CRE',            code: '313', dept: 'Humanities',  isCore: false, periods: 3 },
  { name: 'Business Studies',code: '565', dept: 'Technical',  isCore: false, periods: 3 },
  { name: 'Computer Studies',code: '451', dept: 'Technical',  isCore: false, periods: 3 },
  { name: 'Agriculture',    code: '443', dept: 'Technical',  isCore: false, periods: 3 },
  { name: 'Home Science',   code: '441', dept: 'Technical',  isCore: false, periods: 3 },
  { name: 'Art & Design',   code: '442', dept: 'Creative Arts', isCore: false, periods: 2 },
  { name: 'Music',          code: '511', dept: 'Creative Arts', isCore: false, periods: 2 },
  { name: 'French',         code: '501', dept: 'Languages',  isCore: false, periods: 3 },
];

const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

// ── 50 Mock Teacher Data ─────────────────────────────────────────────
const MOCK_TEACHERS = [
  { idx:  1, name: 'James Mwangi',       gender: 'M', subjects: ['Mathematics'],       phone: '0722100001', tsc: 'TSC-M001' },
  { idx:  2, name: 'Mary Wanjiku',        gender: 'F', subjects: ['Mathematics'],       phone: '0722100002', tsc: 'TSC-M002' },
  { idx:  3, name: 'Peter Ochieng',       gender: 'M', subjects: ['Mathematics'],       phone: '0722100003', tsc: 'TSC-M003' },
  { idx:  4, name: 'Sarah Akinyi',        gender: 'F', subjects: ['Mathematics','Physics'], phone: '0722100004', tsc: 'TSC-M004' },
  { idx:  5, name: 'John Kamau',          gender: 'M', subjects: ['English'],           phone: '0722100005', tsc: 'TSC-M005' },
  { idx:  6, name: 'Alice Njeri',         gender: 'F', subjects: ['English'],           phone: '0722100006', tsc: 'TSC-M006' },
  { idx:  7, name: 'David Kiplagat',      gender: 'M', subjects: ['English','History'], phone: '0722100007', tsc: 'TSC-M007' },
  { idx:  8, name: 'Grace Chebet',        gender: 'F', subjects: ['English'],           phone: '0722100008', tsc: 'TSC-M008' },
  { idx:  9, name: 'Robert Otieno',       gender: 'M', subjects: ['Kiswahili'],         phone: '0722100009', tsc: 'TSC-M009' },
  { idx: 10, name: 'Elizabeth Wambui',     gender: 'F', subjects: ['Kiswahili'],         phone: '0722100010', tsc: 'TSC-M010' },
  { idx: 11, name: 'Joseph Barasa',       gender: 'M', subjects: ['Kiswahili','CRE'],   phone: '0722100011', tsc: 'TSC-M011' },
  { idx: 12, name: 'Catherine Nyambura',   gender: 'F', subjects: ['Biology'],           phone: '0722100012', tsc: 'TSC-M012' },
  { idx: 13, name: 'Daniel Rotich',       gender: 'M', subjects: ['Biology'],           phone: '0722100013', tsc: 'TSC-M013' },
  { idx: 14, name: 'Lucy Atieno',         gender: 'F', subjects: ['Biology','Agriculture'], phone: '0722100014', tsc: 'TSC-M014' },
  { idx: 15, name: 'Francis Kariuki',     gender: 'M', subjects: ['Chemistry'],         phone: '0722100015', tsc: 'TSC-M015' },
  { idx: 16, name: 'Beatrice Maina',      gender: 'F', subjects: ['Chemistry'],         phone: '0722100016', tsc: 'TSC-M016' },
  { idx: 17, name: 'Stephen Wafula',      gender: 'M', subjects: ['Chemistry','Biology'], phone: '0722100017', tsc: 'TSC-M017' },
  { idx: 18, name: 'Ann Wairimu',         gender: 'F', subjects: ['Physics'],           phone: '0722100018', tsc: 'TSC-M018' },
  { idx: 19, name: 'Patrick Omondi',      gender: 'M', subjects: ['Physics'],           phone: '0722100019', tsc: 'TSC-M019' },
  { idx: 20, name: 'Diana Chepkemoi',     gender: 'F', subjects: ['Physics','Mathematics'], phone: '0722100020', tsc: 'TSC-M020' },
  { idx: 21, name: 'Charles Gitau',       gender: 'M', subjects: ['History'],           phone: '0722100021', tsc: 'TSC-M021' },
  { idx: 22, name: 'Sharon Adhiambo',     gender: 'F', subjects: ['History'],           phone: '0722100022', tsc: 'TSC-M022' },
  { idx: 23, name: 'Vincent Korir',       gender: 'M', subjects: ['History','CRE'],     phone: '0722100023', tsc: 'TSC-M023' },
  { idx: 24, name: 'Mercy Njoroge',       gender: 'F', subjects: ['Geography'],         phone: '0722100024', tsc: 'TSC-M024' },
  { idx: 25, name: 'Eric Simiyu',         gender: 'M', subjects: ['Geography'],         phone: '0722100025', tsc: 'TSC-M025' },
  { idx: 26, name: 'Joy Auma',            gender: 'F', subjects: ['Geography','History'], phone: '0722100026', tsc: 'TSC-M026' },
  { idx: 27, name: 'Collins Mutiso',      gender: 'M', subjects: ['CRE'],               phone: '0722100027', tsc: 'TSC-M027' },
  { idx: 28, name: 'Cynthia Cheruiyot',   gender: 'F', subjects: ['CRE'],               phone: '0722100028', tsc: 'TSC-M028' },
  { idx: 29, name: 'Victor Were',         gender: 'M', subjects: ['Business Studies'],   phone: '0722100029', tsc: 'TSC-M029' },
  { idx: 30, name: 'Esther Nyokabi',      gender: 'F', subjects: ['Business Studies'],   phone: '0722100030', tsc: 'TSC-M030' },
  { idx: 31, name: 'Samuel Juma',         gender: 'M', subjects: ['Business Studies','Geography'], phone: '0722100031', tsc: 'TSC-M031' },
  { idx: 32, name: 'Nancy Karanja',       gender: 'F', subjects: ['Computer Studies'],   phone: '0722100032', tsc: 'TSC-M032' },
  { idx: 33, name: 'Allan Owino',         gender: 'M', subjects: ['Computer Studies'],   phone: '0722100033', tsc: 'TSC-M033' },
  { idx: 34, name: 'Lydia Mbugua',        gender: 'F', subjects: ['Computer Studies','Mathematics'], phone: '0722100034', tsc: 'TSC-M034' },
  { idx: 35, name: 'George Odhiambo',     gender: 'M', subjects: ['Agriculture'],       phone: '0722100035', tsc: 'TSC-M035' },
  { idx: 36, name: 'Caroline Kibet',      gender: 'F', subjects: ['Agriculture'],       phone: '0722100036', tsc: 'TSC-M036' },
  { idx: 37, name: 'Michael Kipchoge',    gender: 'M', subjects: ['Agriculture','Biology'], phone: '0722100037', tsc: 'TSC-M037' },
  { idx: 38, name: 'Purity Mutua',        gender: 'F', subjects: ['Home Science'],       phone: '0722100038', tsc: 'TSC-M038' },
  { idx: 39, name: 'Ian Onyango',         gender: 'M', subjects: ['Home Science'],       phone: '0722100039', tsc: 'TSC-M039' },
  { idx: 40, name: 'Winnie Njeri',        gender: 'F', subjects: ['Art & Design'],       phone: '0722100040', tsc: 'TSC-M040' },
  { idx: 41, name: 'Felix Mutua',         gender: 'M', subjects: ['Art & Design','Home Science'], phone: '0722100041', tsc: 'TSC-M041' },
  { idx: 42, name: 'Linet Achieng',       gender: 'F', subjects: ['Music'],             phone: '0722100042', tsc: 'TSC-M042' },
  { idx: 43, name: 'Dennis Cheruiyot',    gender: 'M', subjects: ['Music'],             phone: '0722100043', tsc: 'TSC-M043' },
  { idx: 44, name: 'Rose Wanjiru',        gender: 'F', subjects: ['French'],             phone: '0722100044', tsc: 'TSC-M044' },
  { idx: 45, name: 'Anthony Barasa',      gender: 'M', subjects: ['French','English'],   phone: '0722100045', tsc: 'TSC-M045' },
  { idx: 46, name: 'Maureen Otieno',      gender: 'F', subjects: ['Mathematics','Chemistry'], phone: '0722100046', tsc: 'TSC-M046' },
  { idx: 47, name: 'Kevin Njoroge',       gender: 'M', subjects: ['English','Kiswahili'],phone: '0722100047', tsc: 'TSC-M047' },
  { idx: 48, name: 'Janet Kiplagat',      gender: 'F', subjects: ['Biology','Chemistry'],phone: '0722100048', tsc: 'TSC-M048' },
  { idx: 49, name: 'Brian Karanja',       gender: 'M', subjects: ['Physics','Mathematics'], phone: '0722100049', tsc: 'TSC-M049' },
  { idx: 50, name: 'Eunice Wafula',       gender: 'F', subjects: ['History','Geography'],phone: '0722100050', tsc: 'TSC-M050' },
];

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DigiShule — Ingest 50 Mock Teachers with Subjects');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 0. Authenticate as admin to bypass RLS
  const loginEmail = process.argv[2] || 'rooneykabuor2004@gmail.com';
  const loginPass = process.argv[3] || '12345678';
  console.log(`🔐 Authenticating as ${loginEmail}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: loginPass,
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);
  console.log(`  ✅ Signed in as ${authData.user.email}\n`);

  // 1. Get school_id from admin profile
  const { data: adminProfile, error: profErr } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', authData.user.id)
    .limit(1)
    .single();
  if (profErr) throw new Error(`Profile fetch failed: ${profErr.message}`);
  const schoolId = adminProfile.school_id;
  if (!schoolId) throw new Error('Admin has no school_id. Register a school first.');

  const { data: schoolData } = await supabase.from('schools').select('name').eq('id', schoolId).single();
  console.log(`📌 School: "${schoolData?.name || 'Unknown'}" (${schoolId})\n`);

  // 2. Clean up any previous mock teachers (idempotent re-runs)
  console.log('🧹 Cleaning up any previous mock teachers...');
  const { error: delQualErr } = await supabase.from('teacher_subject_qualifications').delete().like('id', 'mock_teacher_%');
  if (delQualErr) console.warn('  ⚠ Could not clean qualifications:', delQualErr.message);
  
  const { error: delAssignErr } = await supabase.from('subject_assignments').delete().like('teacher_id', 'mock_teacher_%');
  if (delAssignErr) console.warn('  ⚠ Could not clean assignments:', delAssignErr.message);
  
  const { error: delTeachErr } = await supabase.from('teachers').delete().like('id', 'mock_teacher_%');
  if (delTeachErr) console.warn('  ⚠ Could not clean teachers:', delTeachErr.message);
  
  console.log('  ✅ Cleanup complete.\n');

  // 3. Ensure subjects exist in the subjects table
  console.log('📚 Ensuring subjects exist in catalog...');
  const subjectRows = SUBJECTS.map(s => ({
    id: `mock_subj_${s.code}`,
    code: s.code,
    name: s.name,
    is_core: s.isCore,
    periods_per_week: s.periods,
    department: s.dept,
    school_id: schoolId,
  }));

  const { error: subjErr } = await supabase.from('subjects').upsert(subjectRows, { onConflict: 'id' });
  if (subjErr) {
    console.warn('  ⚠ Subject upsert warning:', subjErr.message);
  } else {
    console.log(`  ✅ ${subjectRows.length} subjects ensured.\n`);
  }

  // 4. Insert teachers
  console.log('👩‍🏫 Inserting 50 mock teachers...');
  const teacherRows = MOCK_TEACHERS.map(t => {
    const primarySubject = t.subjects[0];
    const dept = SUBJECTS.find(s => s.name === primarySubject)?.dept || 'General';
    return {
      id: `mock_teacher_${String(t.idx).padStart(3, '0')}`,
      name: t.name,
      subject: primarySubject,
      role: dept,
      emp_id: `MOCK-EMP-${String(t.idx).padStart(3, '0')}`,
      phone: t.phone,
      status: 'Active',
      tsc_number: t.tsc,
      school_id: schoolId,
    };
  });

  const { error: teachErr } = await supabase.from('teachers').insert(teacherRows);
  if (teachErr) throw new Error(`Failed to insert teachers: ${teachErr.message}`);
  console.log(`  ✅ ${teacherRows.length} teachers inserted.\n`);

  // 5. Create teacher-subject qualifications
  console.log('🎓 Creating teacher-subject qualifications...');
  const qualRows = [];
  MOCK_TEACHERS.forEach(t => {
    t.subjects.forEach((subjectName, si) => {
      const subjectDef = SUBJECTS.find(s => s.name === subjectName);
      if (!subjectDef) return;
      qualRows.push({
        id: `mock_teacher_qual_${String(t.idx).padStart(3, '0')}_${subjectDef.code}`,
        teacher_id: `mock_teacher_${String(t.idx).padStart(3, '0')}`,
        subject_id: `mock_subj_${subjectDef.code}`,
        qualification_level: si === 0 ? 'primary' : 'qualified',
        school_id: schoolId,
      });
    });
  });

  // Insert in batches
  const BATCH = 50;
  for (let i = 0; i < qualRows.length; i += BATCH) {
    const batch = qualRows.slice(i, i + BATCH);
    const { error: qErr } = await supabase.from('teacher_subject_qualifications').upsert(batch, { onConflict: 'id' });
    if (qErr) console.warn(`  ⚠ Qualification batch ${i / BATCH + 1} warning:`, qErr.message);
  }
  console.log(`  ✅ ${qualRows.length} qualifications created.\n`);

  // 6. Create subject assignments (teacher → class → subject for Term 2, 2026)
  console.log('📋 Creating subject assignments (Term 2, 2026)...');
  const assignRows = [];
  let assignIdx = 0;
  MOCK_TEACHERS.forEach(t => {
    const teacherId = `mock_teacher_${String(t.idx).padStart(3, '0')}`;
    // Assign each teacher's primary subject to 1-2 classes
    const primarySubject = t.subjects[0];
    const subjectDef = SUBJECTS.find(s => s.name === primarySubject);
    if (!subjectDef) return;
    
    // Assign to 1 or 2 classes based on teacher index
    const classCount = t.idx % 3 === 0 ? 2 : 1;
    for (let c = 0; c < classCount && c < CLASSES.length; c++) {
      const classIdx = (t.idx + c) % CLASSES.length;
      assignIdx++;
      assignRows.push({
        id: `mock_teacher_assign_${String(assignIdx).padStart(4, '0')}`,
        class_name: CLASSES[classIdx],
        stream_name: null,
        subject_id: `mock_subj_${subjectDef.code}`,
        teacher_id: teacherId,
        term: 'Term 2',
        year: 2026,
        periods_per_week: subjectDef.periods,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        school_id: schoolId,
      });
    }
  });

  for (let i = 0; i < assignRows.length; i += BATCH) {
    const batch = assignRows.slice(i, i + BATCH);
    const { error: aErr } = await supabase.from('subject_assignments').upsert(batch, { onConflict: 'id' });
    if (aErr) console.warn(`  ⚠ Assignment batch ${i / BATCH + 1} warning:`, aErr.message);
  }
  console.log(`  ✅ ${assignRows.length} subject assignments created.\n`);

  // 7. Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ DONE — 50 Mock Teachers Ingested Successfully!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📊 Summary:');
  console.log(`   Teachers:       ${teacherRows.length}`);
  console.log(`   Subjects:       ${subjectRows.length}`);
  console.log(`   Qualifications: ${qualRows.length}`);
  console.log(`   Assignments:    ${assignRows.length}`);
  console.log('\n🔑 All IDs are prefixed with "mock_teacher_" for easy deletion.');
  console.log('   To delete all mock teachers, run: node scripts/delete_mock_teachers.js');
  console.log('');

  // Print teacher table
  console.log('┌─────┬────────────────────────┬────────────────────────────┬──────────────┐');
  console.log('│  #  │ Name                   │ Subject(s)                 │ EMP ID       │');
  console.log('├─────┼────────────────────────┼────────────────────────────┼──────────────┤');
  MOCK_TEACHERS.forEach(t => {
    const num = String(t.idx).padStart(3);
    const nm = t.name.padEnd(22);
    const subj = t.subjects.join(', ').padEnd(26);
    const emp = `MOCK-EMP-${String(t.idx).padStart(3, '0')}`;
    console.log(`│ ${num} │ ${nm} │ ${subj} │ ${emp}  │`);
  });
  console.log('└─────┴────────────────────────┴────────────────────────────┴──────────────┘');
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
