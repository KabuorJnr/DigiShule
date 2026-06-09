// Bulk-import real school data into DigiShule from CSV files.
//
// Reads CSVs from a folder (default: ./data-import) and:
//   - upserts students / teachers / staff data rows
//   - creates Supabase Auth login accounts for students, teachers and parents
//   - links each parent (and student) account to the right student record
//
// It is idempotent: re-running updates existing rows (matched by admission
// number / id / username) instead of creating duplicates. Uses the
// service-role key, so it must run server-side only — never in the browser.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Usage:
//   node scripts/import.mjs                 # imports from ./data-import
//   node scripts/import.mjs ./my-folder     # imports from a custom folder
//   IMPORT_DEFAULT_PASSWORD=Start@123 node scripts/import.mjs
//
// CSV files (headers shown; extra columns are ignored, order doesn't matter):
//   students.csv : name,adm,class,gender,username,password
//   teachers.csv : name,subject,department,status,username,password
//   staff.csv    : name,role,dept,status
//   parents.csv  : name,username,password,child_adm
//
// Notes:
//   - username/password are optional. If a student's username is blank it
//     defaults to their admission number; teachers default to a slug of their
//     name. Blank passwords fall back to IMPORT_DEFAULT_PASSWORD (or "changeme").
//   - staff.csv rows are attendance/HR records only and get no login account.
//   - A parent row links to its child by the child's admission number (adm).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const FOLDER = resolve(process.argv[2] || './data-import');
const DEFAULT_PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD || 'changeme';

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emailFor = (username) => `${String(username).trim().toLowerCase()}@digishule.app`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

// ---- Minimal CSV parser (handles quoted fields and embedded commas) --------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); }
  return rows;
}

function readRecords(file) {
  const path = join(FOLDER, file);
  if (!existsSync(path)) return null;
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 1) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

async function listAuthUsersByEmail() {
  const map = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => map.set((u.email || '').toLowerCase(), u.id));
    if (data.users.length < 1000) break;
    page += 1;
  }
  return map;
}

// Create the auth user if missing (else keep existing), then upsert its profile.
async function ensureAccount(existing, { username, password, name, role, dept, teacherId, studentId }) {
  const email = emailFor(username);
  let userId = existing.get(email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password || DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { username, full_name: name, role },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    userId = data.user.id;
    existing.set(email, userId);
  }
  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId,
    username,
    full_name: name,
    role,
    dept: dept || null,
    teacher_id: teacherId || null,
    student_id: studentId || null,
  });
  if (pErr) throw new Error(`profile ${username}: ${pErr.message}`);
  return userId;
}

async function loadStudentAdmToId() {
  const map = new Map();
  const { data, error } = await admin.from('students').select('id, adm');
  if (error) throw error;
  data.forEach((s) => map.set(s.adm, s.id));
  return map;
}

async function importStudents(existing) {
  const records = readRecords('students.csv');
  if (!records) { console.log('students.csv: not found, skipping'); return; }
  const admToId = await loadStudentAdmToId();

  let created = 0;
  let accounts = 0;
  for (const r of records) {
    if (!r.adm || !r.name || !r.class) {
      console.warn(`  ! skipping student row missing name/adm/class: ${JSON.stringify(r)}`);
      continue;
    }
    // Reuse an existing id when the admission number is already known, so a
    // re-import updates the same record rather than colliding on adm.
    const id = admToId.get(r.adm) || r.adm;
    const { error } = await admin.from('students').upsert({
      id,
      name: r.name,
      adm: r.adm,
      class: r.class,
      gender: r.gender || null,
      // Scores are managed in the gradebook; start empty unless already set.
      ...(admToId.has(r.adm) ? {} : { scores: {}, flagged: false }),
    });
    if (error) throw new Error(`student ${r.adm}: ${error.message}`);
    admToId.set(r.adm, id);
    created += 1;

    // A student login is optional: only create one if a username is given or
    // we fall back to the admission number as the username.
    const username = r.username || r.adm;
    if (username) {
      await ensureAccount(existing, {
        username,
        password: r.password,
        name: r.name,
        role: 'student',
        dept: `Form ${r.class}`,
        studentId: id,
      });
      accounts += 1;
    }
  }
  console.log(`students.csv: ${created} rows upserted, ${accounts} login accounts ensured.`);
}

async function importTeachers(existing) {
  const records = readRecords('teachers.csv');
  if (!records) { console.log('teachers.csv: not found, skipping'); return; }

  // Find the highest existing numeric teacher id (t1, t2, ...) to continue from.
  const { data: existingTeachers, error } = await admin.from('teachers').select('id');
  if (error) throw error;
  let maxN = 0;
  existingTeachers.forEach((t) => {
    const m = /^t(\d+)$/.exec(t.id);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  });

  // Map an existing teacher login (username) to its teacher id so a re-import
  // updates the same teacher instead of creating a duplicate row.
  const { data: tProfiles, error: tpErr } = await admin
    .from('profiles').select('username, teacher_id').eq('role', 'teacher');
  if (tpErr) throw tpErr;
  const usernameToTeacherId = new Map();
  tProfiles.forEach((p) => {
    if (p.teacher_id) usernameToTeacherId.set(String(p.username).toLowerCase(), p.teacher_id);
  });

  let count = 0;
  let accounts = 0;
  for (const r of records) {
    if (!r.name) { console.warn(`  ! skipping teacher row missing name`); continue; }
    const username = r.username || slug(r.name);
    const existingTid = usernameToTeacherId.get(username.toLowerCase());
    let id;
    if (existingTid) {
      id = existingTid;
    } else {
      maxN += 1;
      id = `t${maxN}`;
    }
    const { error: tErr } = await admin.from('teachers').upsert({
      id,
      name: r.name,
      subject: r.subject || null,
      department: r.department || null,
      status: r.status || 'active',
    });
    if (tErr) throw new Error(`teacher ${r.name}: ${tErr.message}`);
    count += 1;

    if (username) {
      await ensureAccount(existing, {
        username,
        password: r.password,
        name: r.name,
        role: 'teacher',
        dept: r.department || null,
        teacherId: id,
      });
      usernameToTeacherId.set(username.toLowerCase(), id);
      accounts += 1;
    }
  }
  console.log(`teachers.csv: ${count} rows upserted, ${accounts} login accounts ensured.`);
}

async function importStaff() {
  const records = readRecords('staff.csv');
  if (!records) { console.log('staff.csv: not found, skipping'); return; }

  const { data: existingStaff, error } = await admin.from('staff').select('id, name');
  if (error) throw error;
  let maxN = 0;
  const nameToId = new Map();
  existingStaff.forEach((s) => {
    const m = /^s(\d+)$/.exec(s.id);
    if (m) maxN = Math.max(maxN, Number(m[1]));
    nameToId.set(String(s.name).toLowerCase(), s.id);
  });

  let count = 0;
  for (const r of records) {
    if (!r.name) { console.warn(`  ! skipping staff row missing name`); continue; }
    // Re-import stability: an explicit id wins; otherwise reuse the id of an
    // existing staff member with the same name; otherwise allocate a new id.
    let id = r.id;
    if (!id) id = nameToId.get(r.name.toLowerCase());
    if (!id) { maxN += 1; id = `s${maxN}`; }
    const { error: sErr } = await admin.from('staff').upsert({
      id,
      name: r.name,
      role: r.role || null,
      dept: r.dept || null,
      status: r.status || 'Present',
      check_in: null,
    });
    if (sErr) throw new Error(`staff ${r.name}: ${sErr.message}`);
    nameToId.set(r.name.toLowerCase(), id);
    count += 1;
  }
  console.log(`staff.csv: ${count} rows upserted.`);
}

async function importParents(existing) {
  const records = readRecords('parents.csv');
  if (!records) { console.log('parents.csv: not found, skipping'); return; }
  const admToId = await loadStudentAdmToId();

  let count = 0;
  for (const r of records) {
    if (!r.username || !r.child_adm) {
      console.warn(`  ! skipping parent row missing username/child_adm: ${JSON.stringify(r)}`);
      continue;
    }
    const studentId = admToId.get(r.child_adm);
    if (!studentId) {
      console.warn(`  ! parent ${r.username}: no student with adm ${r.child_adm}; import that student first. Skipping.`);
      continue;
    }
    await ensureAccount(existing, {
      username: r.username,
      password: r.password,
      name: r.name || 'Parent / Guardian',
      role: 'parent',
      dept: 'Parent',
      studentId,
    });
    count += 1;
  }
  console.log(`parents.csv: ${count} parent accounts ensured.`);
}

async function main() {
  console.log(`Importing DigiShule data from ${FOLDER} ...`);
  const existing = await listAuthUsersByEmail();
  await importStudents(existing);
  await importTeachers(existing);
  await importStaff();
  await importParents(existing); // after students so child links resolve
  console.log('Import complete.');
}

main().catch((err) => {
  console.error('Import failed:', err.message || err);
  process.exit(1);
});
