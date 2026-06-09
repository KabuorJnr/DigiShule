// Seeds the DigiShule Supabase project: creates auth users for every demo
// account, their profiles, and loads all reference data. Idempotent — safe to
// re-run. Reuses the exact seed data the frontend shipped with so the DB-backed
// app looks identical to the old mock-data version.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Run: node scripts/seed.mjs

import { createClient } from '@supabase/supabase-js';
import { USERS } from '../src/data/users.js';
import {
  TEACHERS,
  buildStudents,
  buildExamSchedules,
  DEFAULT_SETTINGS,
  DEFAULT_GRADE_BOUNDARIES,
  DEFAULT_FEE_STRUCTURE,
  DEFAULT_NOTIF_TOGGLES,
  DEFAULT_VENUES,
  SEED_NOTIFICATIONS,
} from '../src/data/seed.js';
import {
  LIBRARY_BOOKS,
  LIBRARY_LOANS,
  FINANCE_PAYMENTS,
  FEE_SUMMARY,
  ADMISSIONS,
  CLINIC_VISITS,
  DISCIPLINARY_RECORDS,
  STAFF,
  FACILITIES,
} from '../src/data/modules.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emailFor = (username) => `${username.trim().toLowerCase()}@digishule.app`;

async function listAllUsers() {
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

async function seedAuthAndProfiles() {
  // De-duplicate accounts whose username only differs by case (the legacy data
  // had two "Librarian" rows; login was always case-insensitive).
  const seen = new Set();
  const accounts = USERS.filter((u) => {
    const key = u.username.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const existing = await listAllUsers();

  for (const u of accounts) {
    const email = emailFor(u.username);
    let userId = existing.get(email);
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
        user_metadata: { username: u.username, full_name: u.name, role: u.role },
      });
      if (error) throw new Error(`createUser ${email}: ${error.message}`);
      userId = data.user.id;
      console.log(`  + auth user ${u.username} (${email})`);
    } else {
      console.log(`  = auth user ${u.username} exists`);
    }

    const profile = {
      id: userId,
      username: u.username,
      full_name: u.name,
      role: u.role,
      dept: u.dept || null,
      teacher_id: u.role === 'teacher' ? u.link || null : null,
      student_id: u.role === 'student' || u.role === 'parent' ? u.link || null : null,
    };
    const { error: pErr } = await admin.from('profiles').upsert(profile);
    if (pErr) throw new Error(`profile ${u.username}: ${pErr.message}`);
  }
  console.log(`Seeded ${accounts.length} accounts.`);
}

async function seedConfig() {
  const { error } = await admin.from('app_config').upsert({
    id: 1,
    settings: DEFAULT_SETTINGS,
    grade_boundaries: DEFAULT_GRADE_BOUNDARIES,
    fee_structure: DEFAULT_FEE_STRUCTURE,
    notif_toggles: DEFAULT_NOTIF_TOGGLES,
    venues: DEFAULT_VENUES,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  console.log('Seeded app_config.');
}

async function upsert(table, rows) {
  if (!rows.length) return;
  const { error } = await admin.from(table).upsert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`Seeded ${rows.length} rows into ${table}.`);
}

async function seedAcademics() {
  await upsert('teachers', TEACHERS.map((t) => ({
    id: t.id, name: t.name, subject: t.subject, department: t.department, status: t.status,
  })));

  await upsert('students', buildStudents().map((s) => ({
    id: s.id, name: s.name, adm: s.adm, class: s.class,
    gender: s.gender, scores: s.scores, flagged: s.flagged,
  })));

  const exams = buildExamSchedules();
  await upsert('exam_schedules', exams.map((e) => ({
    id: e.id, name: e.name, type: e.type, start_date: e.startDate, end_date: e.endDate,
  })));
  const sessions = exams.flatMap((e) => e.sessions.map((s) => ({
    id: s.id, exam_id: e.id, date: s.date, classes: s.classes, subject: s.subject,
    start_time: s.start, end_time: s.end, venue: s.venue, invigilator: s.invigilator, status: s.status,
  })));
  await upsert('exam_sessions', sessions);
}

async function seedModules() {
  await upsert('library_books', LIBRARY_BOOKS);
  await upsert('library_loans', LIBRARY_LOANS);
  await upsert('finance_payments', FINANCE_PAYMENTS);
  await upsert('fee_summary', FEE_SUMMARY);
  await upsert('admissions', ADMISSIONS);
  await upsert('clinic_visits', CLINIC_VISITS);
  await upsert('disciplinary_records', DISCIPLINARY_RECORDS);
  await upsert('staff', STAFF.map((s) => ({
    id: s.id, name: s.name, role: s.role, dept: s.dept, status: s.status, check_in: s.checkIn,
  })));
  await upsert('facilities', FACILITIES);
  await upsert('notifications', SEED_NOTIFICATIONS.map((n) => ({
    id: n.id, title: n.title, body: n.body, time: n.time, read: n.read,
  })));
}

async function main() {
  console.log('Seeding DigiShule database...');
  await seedConfig();
  await seedAuthAndProfiles();
  await seedAcademics();
  await seedModules();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
