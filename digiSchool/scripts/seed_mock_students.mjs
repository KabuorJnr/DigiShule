// =============================================================================
// seed_mock_students.mjs
// -----------------------------------------------------------------------------
// Ensures EVERY stream/class of EVERY school has exactly 60 students by topping
// up each stream with realistic mock students. Idempotent: it counts what
// already exists per stream and only inserts the difference, so re-running is
// safe and never pushes a stream past 60.
//
// Every student it creates is TAGGED as mock (admission numbers prefixed with
// `MOCK-`) and recorded in a manifest file so you can find — and later delete —
// exactly what this script added.
//
// Requires a SERVICE-ROLE key because Row-Level Security scopes normal keys to a
// single signed-in school; only the service role can enumerate every school and
// insert across all of them.
//
//   Required env: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
//   Run (PowerShell):
//     $env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node scripts/seed_mock_students.mjs
//   Run (bash):
//     SUPABASE_SERVICE_ROLE_KEY="<key>" node scripts/seed_mock_students.mjs
//
//   Flags:
//     --dry-run        Report what WOULD be inserted; write no rows.
//     --target=N       Students per stream (default 60).
//     --school=<id>    Restrict to a single school id.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TARGET = Number((args.find(a => a.startsWith('--target=')) || '').split('=')[1]) || 60;
const ONLY_SCHOOL = (args.find(a => a.startsWith('--school=')) || '').split('=')[1] || null;

// ---- env --------------------------------------------------------------------
function loadEnv() {
  const out = { ...process.env };
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^=#]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^['"]|['"]$/g, '');
        if (out[k] === undefined) out[k] = v;
      }
    });
  }
  return out;
}
const env = loadEnv();
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
// Admin-login mode: credentials come from the environment ONLY. They are never
// hard-coded here — you export them in your own shell and run the script, so
// your password stays with you.
const SEED_EMAIL = env.SEED_EMAIL;
const SEED_PASSWORD = env.SEED_PASSWORD;

if (!URL) { console.error('✖ Missing SUPABASE_URL / VITE_SUPABASE_URL'); process.exit(1); }

// Two ways in, in priority order:
//   1. SERVICE-ROLE key  → seeds EVERY school (bypasses RLS).
//   2. SEED_EMAIL + SEED_PASSWORD → signs in as that admin and seeds THEIR
//      school(s) only, within RLS.
const MODE = SERVICE_KEY ? 'service' : (SEED_EMAIL && SEED_PASSWORD ? 'login' : null);
if (!MODE) {
  console.error('✖ No credentials found. Choose ONE:');
  console.error('  A) Service role (all schools):');
  console.error('       $env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node scripts/seed_mock_students.mjs');
  console.error('  B) Admin login (your school only):');
  console.error('       $env:SEED_EMAIL="admin@example.com"; $env:SEED_PASSWORD="<password>"; node scripts/seed_mock_students.mjs');
  process.exit(1);
}
if (MODE === 'login' && !ANON_KEY) { console.error('✖ Missing VITE_SUPABASE_ANON_KEY for login mode'); process.exit(1); }

const supabase = createClient(URL, MODE === 'service' ? SERVICE_KEY : ANON_KEY, { auth: { persistSession: false } });

// ---- name / data pools ------------------------------------------------------
const FIRST_NAMES_M = ['Brian','Kevin','Dennis','Collins','Victor','Samuel','Felix','Allan','George','Peter','Daniel','Michael','Joseph','Ian','Eric','Charles','Anthony','Stephen','Patrick','Vincent','Emmanuel','Kelvin','Duncan','Nicholas','Martin','Fredrick','Elvis','Brayan','Gideon','Cornelius'];
const FIRST_NAMES_F = ['Faith','Mercy','Joy','Cynthia','Esther','Grace','Nancy','Lydia','Ann','Caroline','Sharon','Diana','Eunice','Purity','Winnie','Beatrice','Linet','Maureen','Janet','Rose','Mary','Lucy','Christine','Brenda','Sylvia','Valentine','Mitchelle','Stella','Doreen','Pauline'];
const LAST_NAMES = ['Mwangi','Otieno','Kamau','Wanjiru','Ochieng','Njoroge','Achieng','Kipchoge','Mutua','Wafula','Cheruiyot','Nyambura','Odhiambo','Karanja','Chebet','Maina','Owino','Kibet','Auma','Gitau','Onyango','Wambui','Kiplagat','Njeri','Barasa','Mbugua','Atieno','Rotich','Were','Kariuki','Akinyi','Korir','Omondi','Wairimu','Juma','Chepkemoi','Mutiso','Nyokabi','Simiyu','Adhiambo'];
const SUBJECTS = ['Mathematics','English','Kiswahili','Biology','Chemistry','Physics','History','Geography'];
const COUNTIES = ['Nairobi','Kiambu','Nakuru','Kisumu','Mombasa','Machakos','Kakamega','Uasin Gishu','Meru','Kilifi'];

// Deterministic PRNG so re-runs of the SAME stream produce stable data.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- class/stream expansion (mirrors src/data/seed.js) ----------------------
function expandClassesWithStreams(classes = []) {
  if (!classes || !classes.length) return [];
  const expanded = [];
  classes.forEach(c => {
    if (typeof c === 'string') { if (c.trim()) expanded.push(c.trim()); return; }
    if (!c.streams || !c.streams.trim()) { if (c.name) expanded.push(c.name); }
    else {
      const streams = c.streams.split(',').map(s => s.trim()).filter(Boolean);
      if (streams.length === 0 && c.name) expanded.push(c.name);
      else streams.forEach(s => expanded.push(`${c.name} ${s}`));
    }
  });
  return expanded;
}

const DEFAULT_CLASSES = [
  { name: 'Grade 7', streams: 'A, B' },
  { name: 'Grade 8', streams: 'A, B' },
  { name: 'Grade 9', streams: 'A, B' },
  { name: 'Grade 10', streams: 'A, B' },
  { name: 'Grade 11', streams: 'A, B' },
  { name: 'Grade 12', streams: 'A, B' },
];

function classCode(label) {
  // "Grade 10 A" -> "G10A"; "Form 1 East" -> "F1EAST"
  return label.replace(/grade/ig, 'G').replace(/form/ig, 'F').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function makeScores(rand) {
  const scores = {};
  SUBJECTS.forEach(sub => {
    const base = 1.5 + rand() * 2.5; // baseline competency 1.5–4.0
    const clamp = v => Math.max(1, Math.min(4, Math.round(v)));
    scores[sub] = {
      a1: clamp(base + (rand() * 1.5 - 0.75)),
      a2: clamp(base + (rand() * 1.5 - 0.75)),
      a3: clamp(base + (rand() * 1.5 - 0.75)),
      a4: clamp(base + (rand() * 1.5 - 0.75)),
    };
  });
  return scores;
}

async function run() {
  console.log(`\n=== DigiShule mock-student seeder ===`);
  console.log(`Mode: ${MODE === 'service' ? 'service-role (all schools)' : `admin-login (${SEED_EMAIL})`}`);
  console.log(`Target per stream: ${TARGET}${DRY_RUN ? '   [DRY RUN — no writes]' : ''}`);

  // 0. In login mode, sign in and restrict to the admin's own school(s).
  let allowedSchoolIds = null; // null => no restriction (service mode)
  if (MODE === 'login') {
    const { data: auth, error: ae } = await supabase.auth.signInWithPassword({ email: SEED_EMAIL, password: SEED_PASSWORD });
    if (ae) throw new Error(`Login failed for ${SEED_EMAIL}: ${ae.message}`);
    const uid = auth?.user?.id;
    const { data: profs, error: pe } = await supabase.from('profiles').select('school_id, role').eq('id', uid);
    if (pe) throw pe;
    allowedSchoolIds = [...new Set((profs || []).map(p => p.school_id).filter(Boolean))];
    if (allowedSchoolIds.length === 0) throw new Error(`Signed in as ${SEED_EMAIL} but no school_id on profile — cannot scope seeding.`);
    console.log(`Signed in as ${SEED_EMAIL} → school(s): ${allowedSchoolIds.join(', ')}`);
  }

  // 1. Enumerate schools (RLS already scopes this to the admin's school in login mode)
  let schoolQuery = supabase.from('schools').select('id, name').order('name');
  if (ONLY_SCHOOL) schoolQuery = schoolQuery.eq('id', ONLY_SCHOOL);
  else if (allowedSchoolIds) schoolQuery = schoolQuery.in('id', allowedSchoolIds);
  const { data: schools, error: se } = await schoolQuery;
  if (se) throw se;
  if (!schools || schools.length === 0) { console.log('No schools found. Nothing to do.'); return; }
  console.log(`Schools found: ${schools.length}\n`);

  const manifest = [];       // every mock student created
  const summaryRows = [];     // per-stream report

  for (const school of schools) {
    const sid = school.id;

    // 2. Read this school's configured classes from app_config.settings.classes
    const { data: cfg } = await supabase.from('app_config').select('settings').eq('school_id', sid).maybeSingle();
    let classes = cfg?.settings?.classes;
    if (!Array.isArray(classes) || classes.length === 0) classes = DEFAULT_CLASSES;
    const streams = [...new Set(expandClassesWithStreams(classes))];

    // 3. Pull existing students for this school once (id, adm, class)
    const existing = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('students')
        .select('id, adm, class').eq('school_id', sid).range(from, from + PAGE - 1);
      if (error) throw error;
      existing.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    const admTaken = new Set(existing.map(s => (s.adm || '').toUpperCase()));
    const countByClass = {};
    existing.forEach(s => { const k = (s.class || '').trim(); countByClass[k] = (countByClass[k] || 0) + 1; });

    console.log(`▶ ${school.name}  (${streams.length} streams, ${existing.length} existing students)`);

    const toInsert = [];
    for (const streamLabel of streams) {
      const have = countByClass[streamLabel] || 0;
      const need = Math.max(0, TARGET - have);
      summaryRows.push({ school: school.name, school_id: sid, stream: streamLabel, before: have, added: need, after: Math.max(have, TARGET) });
      if (need === 0) { console.log(`   • ${streamLabel.padEnd(14)} ${have} → ${have} (ok)`); continue; }
      console.log(`   • ${streamLabel.padEnd(14)} ${have} → ${TARGET}  (+${need})`);

      const rand = mulberry32(hashStr(sid + '|' + streamLabel));
      const code = classCode(streamLabel);
      let seq = have; // continue numbering after existing count
      for (let i = 0; i < need; i++) {
        const isMale = rand() > 0.5;
        const fn = (isMale ? FIRST_NAMES_M : FIRST_NAMES_F)[Math.floor(rand() * (isMale ? FIRST_NAMES_M : FIRST_NAMES_F).length)];
        const mid = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];

        // Unique, clearly-mock admission number. Bump if it somehow collides.
        let adm;
        const schoolPrefix = sid.slice(0, 4).toUpperCase();
        do { seq += 1; adm = `MOCK-${schoolPrefix}-${code}-${String(seq).padStart(3, '0')}`; } while (admTaken.has(adm.toUpperCase()));
        admTaken.add(adm.toUpperCase());

        const id = `mock_${sid.slice(0, 8)}_${code}_${String(seq).padStart(3, '0')}`;
        const student = {
          id,
          name: `${fn} ${mid} ${ln}`,
          adm,
          class: streamLabel,
          gender: isMale ? 'Male' : 'Female',
          scores: makeScores(rand),
          flagged: rand() > 0.96,
          status: 'Active',
          guardian_name: `${rand() > 0.5 ? 'Mr.' : 'Mrs.'} ${ln}`,
          guardian_phone: `07${Math.floor(10000000 + rand() * 89999999)}`,
          county: COUNTIES[Math.floor(rand() * COUNTIES.length)],
          nationality: 'Kenyan',
          school_id: sid,
        };
        toInsert.push(student);
        manifest.push({ id, adm, name: student.name, class: streamLabel, gender: student.gender, school: school.name, school_id: sid });
      }
    }

    // 4. Insert in batches (upsert on id → idempotent)
    if (!DRY_RUN && toInsert.length) {
      const BATCH = 200;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const { error } = await supabase.from('students').upsert(batch, { onConflict: 'id' });
        if (error) throw error;
      }
    }
    console.log(`   ${DRY_RUN ? 'would insert' : 'inserted'} ${toInsert.length} for ${school.name}\n`);
  }

  // 5. Write manifest + summary so the mock students are fully traceable
  const outDir = path.join(ROOT, 'scripts', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `mock_students_${stamp}.json`);
  const csvPath = path.join(outDir, `mock_students_${stamp}.csv`);
  const latestJson = path.join(outDir, `mock_students_latest.json`);

  const payload = { generatedAt: new Date().toISOString(), dryRun: DRY_RUN, target: TARGET, totalMockStudents: manifest.length, summary: summaryRows, students: manifest };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(latestJson, JSON.stringify(payload, null, 2));
  const csv = ['id,adm,name,class,gender,school,school_id',
    ...manifest.map(m => [m.id, m.adm, `"${m.name}"`, `"${m.class}"`, m.gender, `"${m.school}"`, m.school_id].join(','))].join('\n');
  fs.writeFileSync(csvPath, csv);

  console.log('=== Summary ===');
  console.log(`Total mock students ${DRY_RUN ? 'that WOULD be created' : 'created'}: ${manifest.length}`);
  console.log(`Manifest (JSON): ${path.relative(ROOT, jsonPath)}`);
  console.log(`Manifest (CSV):  ${path.relative(ROOT, csvPath)}`);
  console.log(`Every mock admission number begins with "MOCK-" for easy filtering / deletion.`);
}

run().catch(e => { console.error('\n✖ Seeding failed:', e.message || e); process.exit(1); });
