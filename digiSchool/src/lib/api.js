import { supabase } from './supabaseClient';

// Maps between the app's camelCase shapes and the database's snake_case columns.
// Read helpers return data already shaped the way the views expect; write
// helpers accept app-shaped objects and persist them.

// ---- Profile / current user ----------------------------------------------
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, full_name, role, dept, teacher_id, student_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    username: data.username,
    name: data.full_name,
    role: data.role,
    dept: data.dept,
    teacherId: data.teacher_id,
    studentId: data.student_id,
  };
}

// ---- App config (singleton) -----------------------------------------------
export async function fetchConfig() {
  const { data, error } = await supabase.from('app_config').select('*').eq('id', 1).single();
  if (error) throw error;
  return {
    settings: data.settings || {},
    gradeBoundaries: data.grade_boundaries || [],
    feeStructure: data.fee_structure || [],
    notifToggles: data.notif_toggles || {},
    venues: data.venues || [],
  };
}

export async function saveConfig(patch) {
  const row = { id: 1, updated_at: new Date().toISOString() };
  if (patch.settings) row.settings = patch.settings;
  if (patch.gradeBoundaries) row.grade_boundaries = patch.gradeBoundaries;
  if (patch.feeStructure) row.fee_structure = patch.feeStructure;
  if (patch.notifToggles) row.notif_toggles = patch.notifToggles;
  if (patch.venues) row.venues = patch.venues;
  const { error } = await supabase.from('app_config').update(row).eq('id', 1);
  if (error) throw error;
}

// ---- Teachers / students --------------------------------------------------
export async function fetchTeachers() {
  const { data, error } = await supabase.from('teachers').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function fetchStudents() {
  const { data, error } = await supabase.from('students').select('*').order('class').order('adm');
  if (error) throw error;
  return data;
}

export async function upsertStudent(student) {
  const { error } = await supabase.from('students').upsert({
    id: student.id,
    name: student.name,
    adm: student.adm,
    class: student.class,
    gender: student.gender,
    scores: student.scores,
    flagged: student.flagged,
  });
  if (error) throw error;
}

// ---- Exam schedules + sessions --------------------------------------------
export async function fetchExamSchedules() {
  const [{ data: exams, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
    supabase.from('exam_schedules').select('*').order('start_date'),
    supabase.from('exam_sessions').select('*'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const byExam = {};
  (sessions || []).forEach((s) => {
    (byExam[s.exam_id] ||= []).push({
      id: s.id,
      date: s.date,
      classes: s.classes,
      subject: s.subject,
      start: s.start_time,
      end: s.end_time,
      venue: s.venue,
      invigilator: s.invigilator,
      status: s.status,
    });
  });
  return (exams || []).map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    startDate: e.start_date,
    endDate: e.end_date,
    sessions: byExam[e.id] || [],
  }));
}

export async function saveExamSchedule(exam) {
  const { error: e1 } = await supabase.from('exam_schedules').upsert({
    id: exam.id,
    name: exam.name,
    type: exam.type,
    start_date: exam.startDate || null,
    end_date: exam.endDate || null,
  });
  if (e1) throw e1;
  const rows = (exam.sessions || []).map((s) => ({
    id: s.id,
    exam_id: exam.id,
    date: s.date || null,
    classes: s.classes,
    subject: s.subject,
    start_time: s.start,
    end_time: s.end,
    venue: s.venue,
    invigilator: s.invigilator,
    status: s.status,
  }));
  if (rows.length) {
    const { error: e2 } = await supabase.from('exam_sessions').upsert(rows);
    if (e2) throw e2;
  }
}

export async function deleteExamSchedule(examId) {
  const { error } = await supabase.from('exam_schedules').delete().eq('id', examId);
  if (error) throw error;
}

export async function deleteExamSession(sessionId) {
  const { error } = await supabase.from('exam_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

// Replace the entire exam set (handles edits and deletions of sessions in one
// shot). The data is tiny (a few exams / sessions), so a wipe-and-insert keeps
// the local array and the database in exact sync without per-row diffing.
export async function replaceAllExams(exams) {
  const { error: delErr } = await supabase
    .from('exam_schedules')
    .delete()
    .not('id', 'is', null);
  if (delErr) throw delErr;
  if (!exams.length) return;
  const examRows = exams.map((e) => ({
    id: e.id, name: e.name, type: e.type,
    start_date: e.startDate || null, end_date: e.endDate || null,
  }));
  const { error: e1 } = await supabase.from('exam_schedules').insert(examRows);
  if (e1) throw e1;
  const sessionRows = exams.flatMap((e) => (e.sessions || []).map((s) => ({
    id: s.id, exam_id: e.id, date: s.date || null, classes: s.classes,
    subject: s.subject, start_time: s.start, end_time: s.end,
    venue: s.venue, invigilator: s.invigilator, status: s.status,
  })));
  if (sessionRows.length) {
    const { error: e2 } = await supabase.from('exam_sessions').insert(sessionRows);
    if (e2) throw e2;
  }
}

// ---- Timetables -----------------------------------------------------------
export async function fetchTimetables() {
  const { data, error } = await supabase.from('timetables').select('*');
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.class] = row.data; });
  return map;
}

export async function saveTimetable(cls, term, data) {
  const { error } = await supabase
    .from('timetables')
    .upsert({ class: cls, term, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Persist a whole { className: gridData } map (used after generate / cell edits).
export async function saveTimetables(map, term) {
  const rows = Object.entries(map).map(([cls, data]) => ({
    class: cls, term: term || null, data, updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('timetables').upsert(rows);
  if (error) throw error;
}

// ---- Generic module tables (shape matches columns directly) ---------------
const TABLES = {
  libraryBooks: 'library_books',
  libraryLoans: 'library_loans',
  financePayments: 'finance_payments',
  feeSummary: 'fee_summary',
  admissions: 'admissions',
  clinicVisits: 'clinic_visits',
  disciplinaryRecords: 'disciplinary_records',
  staff: 'staff',
  facilities: 'facilities',
  notifications: 'notifications',
};

export async function fetchTable(key) {
  const { data, error } = await supabase.from(TABLES[key]).select('*');
  if (error) throw error;
  return data;
}

export async function upsertRow(key, row) {
  const { error } = await supabase.from(TABLES[key]).upsert(row);
  if (error) throw error;
}

export async function deleteRow(key, id, idColumn = 'id') {
  const { error } = await supabase.from(TABLES[key]).delete().eq(idColumn, id);
  if (error) throw error;
}

// ---- Notifications --------------------------------------------------------
export async function setNotificationRead(id, read) {
  const { error } = await supabase.from('notifications').update({ read }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
  if (error) throw error;
}
