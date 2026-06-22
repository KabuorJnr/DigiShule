import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually so we don't strictly need 'dotenv' package installed
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

// --- Data Generation Helpers ---

const CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B'];
const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography'];
const DEPTS = ['Math', 'Languages', 'Languages', 'Sciences', 'Sciences', 'Sciences', 'Humanities', 'Humanities'];

const FIRST_NAMES = [
  'Brian', 'Faith', 'Kevin', 'Mercy', 'Dennis', 'Joy', 'Collins', 'Cynthia',
  'Victor', 'Esther', 'Samuel', 'Grace', 'Felix', 'Nancy', 'Allan', 'Lydia',
  'George', 'Ann', 'Peter', 'Caroline', 'Daniel', 'Sharon', 'Michael', 'Diana',
  'Joseph', 'Eunice', 'Ian', 'Purity', 'Eric', 'Winnie', 'Charles', 'Beatrice',
  'Anthony', 'Linet', 'Stephen', 'Maureen', 'Patrick', 'Janet', 'Vincent', 'Rose',
];

const LAST_NAMES = [
  'Mwangi', 'Otieno', 'Kamau', 'Wanjiru', 'Ochieng', 'Njoroge', 'Achieng', 'Kipchoge',
  'Mutua', 'Wafula', 'Cheruiyot', 'Nyambura', 'Odhiambo', 'Karanja', 'Chebet', 'Maina',
  'Owino', 'Kibet', 'Auma', 'Gitau', 'Onyango', 'Wambui', 'Kiplagat', 'Njeri',
  'Barasa', 'Mbugua', 'Atieno', 'Rotich', 'Were', 'Kariuki', 'Akinyi', 'Korir',
  'Omondi', 'Wairimu', 'Juma', 'Chepkemoi', 'Mutiso', 'Nyokabi', 'Simiyu', 'Adhiambo',
];

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function run() {
  console.log('--- DigiShule Bulk Seeding Script ---');

  // 1. Find or create a school
  let { data: schools } = await supabase.from('schools').select('id').limit(1);
  let schoolId;
  if (!schools || schools.length === 0) {
    console.log('No school found. Creating DigiShule Academy...');
    const { data: newSchool, error } = await supabase.from('schools').insert([{
      name: 'DigiShule Academy',
      motto: 'Striving for Excellence',
      type: 'Mixed Boarding',
      county: 'Nairobi',
      phone: '0712345678',
      email: 'admin@digishule.com'
    }]).select().single();
    if (error) throw error;
    schoolId = newSchool.id;
  } else {
    schoolId = schools[0].id;
    console.log(`Using existing school ID: ${schoolId}`);
  }

  // 2. Wipe existing data
  console.log('Wiping existing students and teachers...');
  await supabase.from('students').delete().neq('id', 'dummy'); // delete all
  await supabase.from('teachers').delete().neq('id', 'dummy');

  // 3. Generate Teachers
  console.log('Generating 40 Teachers...');
  const teachers = [];
  const teacherRand = mulberry32(42);
  for (let i = 0; i < 40; i++) {
    const subIdx = Math.floor(teacherRand() * SUBJECTS.length);
    const assignedClass = teacherRand() > 0.8 ? CLASSES[Math.floor(teacherRand() * CLASSES.length)] : null;
    teachers.push({
      id: `t_${i+1}`,
      name: `Mr/s. ${LAST_NAMES[Math.floor(teacherRand() * LAST_NAMES.length)]}`,
      subject: SUBJECTS[subIdx],
      role: DEPTS[subIdx], // actually department mapped to role mostly in legacy code
      emp_id: `EMP-${Math.floor(1000 + teacherRand() * 9000)}`,
      status: teacherRand() > 0.9 ? 'On Leave' : 'Present',
      school_id: schoolId
    });
  }

  const { error: tErr } = await supabase.from('teachers').insert(teachers);
  if (tErr) throw tErr;

  // 4. Generate 640 Students
  console.log('Generating 640 Students...');
  const students = [];
  CLASSES.forEach((cls, ci) => {
    const rand = mulberry32(1000 + ci * 97);
    for (let i = 0; i < 80; i++) { // 80 per class * 8 = 640
      const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      const Grade = cls.replace(/[A-Z]/g, '');
      const adm = `${Grade}${cls.replace(/[0-9]/g, '')}-${String(i + 1).padStart(3, '0')}`;
      
      const scores = {};
      SUBJECTS.forEach((sub) => {
        const base = 1.5 + (rand() * 2.5); // Baseline competency between 1.5 and 4.0
        scores[sub] = {
          a1: Math.max(1, Math.min(4, Math.round(base + (rand() * 1.5 - 0.75)))),
          a2: Math.max(1, Math.min(4, Math.round(base + (rand() * 1.5 - 0.75)))),
          a3: Math.max(1, Math.min(4, Math.round(base + (rand() * 1.5 - 0.75)))),
          a4: Math.max(1, Math.min(4, Math.round(base + (rand() * 1.5 - 0.75)))),
        };
      });

      students.push({
        id: `stu_${cls}_${i+1}`,
        name: `${fn} ${ln}`,
        adm,
        class: cls,
        gender: rand() > 0.5 ? 'M' : 'F',
        scores,
        flagged: rand() > 0.95,
        school_id: schoolId
      });
    }
  });

  // Supabase limits inserts to 1000 rows usually, but we have 640, should be safe in one go or batches
  const BATCH_SIZE = 200;
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    const { error: sErr } = await supabase.from('students').insert(batch);
    if (sErr) throw sErr;
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, students.length)} / ${students.length} students...`);
  }

  // 5. Generate some messages
  console.log('Generating messages...');
  await supabase.from('messages').delete().neq('id', 'dummy');
  const messages = [];
  for (let i = 0; i < 20; i++) {
    const r = mulberry32(i * 10)();
    const st = students[Math.floor(r * students.length)];
    messages.push({
      id: `msg_${Date.now()}_${i}`,
      sender_id: 'parent',
      sender_name: `Parent of ${st.name}`,
      recipient_role: teacherRand() > 0.5 ? 'Class Teacher' : 'Mathematics',
      student_id: st.id,
      student_name: st.name,
      subject: ['Absent Tomorrow', 'Performance Concern', 'Fees Followup', 'Thanks for support'][Math.floor(r*4)],
      body: 'Hello, I just wanted to reach out regarding my child. Please let me know when we can speak. Regards.',
      status: r > 0.5 ? 'Unread' : 'Replied',
      created_at: new Date(Date.now() - r * 1000000000).toISOString(),
    });
  }
  await supabase.from('messages').insert(messages);

  console.log('Done! Database populated successfully.');
}

run().catch(console.error);
