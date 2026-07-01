import { supabase } from './supabaseClient';

/**
 * api.js — Supabase query layer, multi-tenant edition.
 *
 * After login, call setActiveSchoolId(id) so write operations can tag rows.
 * All reads are automatically scoped by RLS via the my_school_id() function.
 */

// Module-level school context — set once after login, used by all writes.
let _schoolId = null;
export function setActiveSchoolId(id) { _schoolId = id; }
export function getActiveSchoolId() { return _schoolId; }

// ---- School registration (called by SetupWizard) --------------------------
export async function registerSchool({
  name, motto, type, county, address, phone, email, website, logoUrl
}) {
  const { data, error } = await supabase.rpc('register_school', {
    p_name: name || '',
    p_motto: motto || null,
    p_type: type || null,
    p_county: county || null,
    p_address: address || null,
    p_phone: phone || null,
    p_email: email || null,
    p_website: website || null,
    p_logo_url: logoUrl || null,
  });
  if (error) throw error;
  return data; // returns school UUID
}

export async function fetchSchool(schoolId) {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSchool(schoolId, patch) {
  const { error } = await supabase
    .from('schools')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', schoolId);
  if (error) throw error;
}

// ---- Profile / current user -----------------------------------------------
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  
  return {
    username: data.username,
    name: data.full_name || data.name,
    role: data.role,
    dept: data.dept,
    teacherId: data.teacher_id || null,
    studentId: data.student_id || null,
    schoolId: data.school_id || null,
  };
}

// ---- App config (school-scoped) -------------------------------------------
export async function fetchConfig() {
  if (!_schoolId) {
    return {
      settings: {},
      gradeBoundaries: [
        { grade: 'A', min: 75 }, { grade: 'B', min: 60 }, { grade: 'C', min: 50 },
        { grade: 'D', min: 40 }, { grade: 'E', min: 0 },
      ],
      feeStructure: [],
      notifToggles: { email: true, sms: false, attendance: true, fees: true, exams: true },
      venues: [],
    };
  }

  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', _schoolId)
    .single();

  if (error) {
    return {
      settings: {},
      gradeBoundaries: [
        { grade: 'A', min: 75 }, { grade: 'B', min: 60 }, { grade: 'C', min: 50 },
        { grade: 'D', min: 40 }, { grade: 'E', min: 0 },
      ],
      feeStructure: [],
      notifToggles: { email: true, sms: false, attendance: true, fees: true, exams: true },
      venues: [],
    };
  }

  return {
    settings: data.settings || {},
    gradeBoundaries: data.grade_boundaries || [],
    feeStructure: data.fee_structure || [],
    notifToggles: data.notif_toggles || {},
    venues: data.venues || [],
  };
}

export async function saveConfig(patch) {
  if (!_schoolId) return; // safety guard
  const args = {
    p_school_id: _schoolId,
    p_settings: patch.settings ? JSON.parse(JSON.stringify(patch.settings)) : null,
    p_grade_boundaries: patch.gradeBoundaries ?? null,
    p_fee_structure: patch.feeStructure ?? null,
    p_notif_toggles: patch.notifToggles ?? null,
    p_venues: patch.venues ?? null,
  };
  const { error } = await supabase.rpc('upsert_school_config', args);
  if (error) throw error;
}

// ---- Teachers / students --------------------------------------------------
export async function fetchTeachers() {
  let query = supabase.from('teachers').select('*').order('id');
  if (_schoolId) query = query.eq('school_id', _schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(t => ({
    ...t,
    assignedClass: t.assigned_class || null
  }));
}

export async function updateTeacher(id, patch) {
  const payload = { ...patch };
  if (payload.assignedClass !== undefined) {
    payload.assigned_class = payload.assignedClass;
    delete payload.assignedClass;
  }
  const { error } = await supabase.from('teachers').update(payload).eq('id', id);
  if (error) throw error;
}

export async function upsertTeacher(teacher) {
  const { error } = await supabase.from('teachers').upsert({
    id: teacher.id,
    name: teacher.name,
    subject: teacher.subject || teacher.dept,
    role: teacher.role,
    emp_id: teacher.emp_id || teacher.id,
    phone: teacher.phone,
    status: teacher.status || 'Active',
    assigned_class: teacher.assignedClass || null,
    school_id: _schoolId,
  });
  if (error) throw error;
}

export async function fetchStudents(page = 0, limit = 50, filters = {}) {
  let query = supabase.from('students').select('*', { count: 'exact' });
  
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,adm.ilike.%${filters.search}%`);
  }
  if (filters.class) {
    query = query.eq('class', filters.class);
  }
  if (_schoolId) {
    query = query.eq('school_id', _schoolId);
  }

  const { data, error, count } = await query
    .order('class')
    .order('adm')
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  
  const mapped = data.map(s => ({
    ...s,
    birthCertNo: s.birth_cert_no,
    guardianName: s.guardian_name,
    guardianPhone: s.guardian_phone,
    guardianEmail: s.guardian_email,
    parentAddress: s.parent_address,
    admissionLetterUrl: s.admission_letter_url,
  }));
  return { data: mapped, count };
}

export async function fetchStudentByQuery(field, value) {
  let query = supabase.from('students').select('*').eq(field, value);
  if (_schoolId) query = query.eq('school_id', _schoolId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    birthCertNo: data.birth_cert_no,
    guardianName: data.guardian_name,
    guardianPhone: data.guardian_phone,
    guardianEmail: data.guardian_email,
    parentAddress: data.parent_address,
    admissionLetterUrl: data.admission_letter_url,
  };
}

export async function fetchStudentStats() {
  const { data, error } = await supabase.rpc('get_student_stats');
  if (error) throw error;
  return data;
}

export async function fetchAllStudentsUnpaginated() {
  let query = supabase.from('students').select('*').order('class').order('adm');
  if (_schoolId) query = query.eq('school_id', _schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(s => ({
    ...s,
    birthCertNo: s.birth_cert_no,
    guardianName: s.guardian_name,
    guardianPhone: s.guardian_phone,
    guardianEmail: s.guardian_email,
    parentAddress: s.parent_address,
    admissionLetterUrl: s.admission_letter_url,
  }));
}

export async function fetchClassRank() {
  const { data, error } = await supabase.rpc('my_class_rank');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { position: row.student_position, classSize: row.class_size };
}

export async function upsertStudent(student) {
  const { error } = await supabase.from('students').upsert({
    id: student.id,
    name: student.name,
    adm: student.adm,
    class: student.class,
    gender: student.gender,
    birth_cert_no: student.birthCertNo,
    scores: student.scores,
    flagged: student.flagged,
    guardian_name: student.guardianName,
    guardian_phone: student.guardianPhone,
    guardian_email: student.guardianEmail,
    parent_address: student.parentAddress,
    admission_letter_url: student.admissionLetterUrl,
    school_id: _schoolId,
  });
  if (error) throw error;
}

export async function deleteStudent(studentId) {
  if (!_schoolId) throw new Error("School ID not set");
  const { error } = await supabase.from('students').delete().eq('id', studentId).eq('school_id', _schoolId);
  if (error) throw error;
}

// ---- Exam schedules + sessions --------------------------------------------
export async function fetchExamSchedules() {
  let q1 = supabase.from('exam_schedules').select('*').order('start_date');
  let q2 = supabase.from('exam_sessions').select('*');
  if (_schoolId) {
    q1 = q1.eq('school_id', _schoolId);
    q2 = q2.eq('school_id', _schoolId);
  }
  const [{ data: exams, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
    q1,
    q2,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const byExam = {};
  (sessions || []).forEach((s) => {
    (byExam[s.exam_id] ||= []).push({
      id: s.id, date: s.date, classes: s.classes, subject: s.subject,
      start: s.start_time, end: s.end_time, venue: s.venue,
      invigilator: s.invigilator, status: s.status,
    });
  });
  return (exams || []).map((e) => ({
    id: e.id, name: e.name, type: e.type, startDate: e.start_date,
    endDate: e.end_date, sessions: byExam[e.id] || [],
  }));
}

export async function saveExamSchedule(exam) {
  const { error: e1 } = await supabase.from('exam_schedules').upsert({
    id: exam.id, name: exam.name, type: exam.type,
    start_date: exam.startDate || null, end_date: exam.endDate || null,
    school_id: _schoolId,
  });
  if (e1) throw e1;
  const rows = (exam.sessions || []).map((s) => ({
    id: s.id, exam_id: exam.id, date: s.date || null, classes: s.classes,
    subject: s.subject, start_time: s.start, end_time: s.end, venue: s.venue,
    invigilator: s.invigilator, status: s.status, school_id: _schoolId,
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

export async function replaceAllExams(exams) {
  // Delete all this school's exams (RLS prevents touching other schools)
  const { error: delErr } = await supabase.from('exam_schedules').delete().not('id', 'is', null);
  if (delErr) throw delErr;
  if (!exams.length) return;
  const examRows = exams.map((e) => ({
    id: e.id, name: e.name, type: e.type,
    start_date: e.startDate || null, end_date: e.endDate || null,
    school_id: _schoolId,
  }));
  const { error: e1 } = await supabase.from('exam_schedules').insert(examRows);
  if (e1) throw e1;
  const sessionRows = exams.flatMap((e) => (e.sessions || []).map((s) => ({
    id: s.id, exam_id: e.id, date: s.date || null, classes: s.classes,
    subject: s.subject, start_time: s.start, end_time: s.end, venue: s.venue,
    invigilator: s.invigilator, status: s.status, school_id: _schoolId,
  })));
  if (sessionRows.length) {
    const { error: e2 } = await supabase.from('exam_sessions').insert(sessionRows);
    if (e2) throw e2;
  }
}

// ---- Timetables -----------------------------------------------------------
export async function fetchTimetables() {
  let query = supabase.from('timetables').select('*');
  if (_schoolId) query = query.eq('school_id', _schoolId);
  const { data, error } = await query;
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.class] = row.data; });
  return map;
}

export async function saveTimetable(cls, term, data) {
  const { error } = await supabase.from('timetables').upsert({
    class: cls, term, data, updated_at: new Date().toISOString(), school_id: _schoolId,
  });
  if (error) throw error;
}

export async function saveTimetables(map, term) {
  const rows = Object.entries(map).map(([cls, data]) => ({
    class: cls, term: term || null, data,
    updated_at: new Date().toISOString(), school_id: _schoolId,
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('timetables').upsert(rows);
  if (error) throw error;
}

// ---- Generic module tables ------------------------------------------------
const TABLES = {
  libraryBooks: 'library_books', libraryLoans: 'library_loans',
  financePayments: 'finance_payments', feeSummary: 'fee_summary',
  invoices: 'invoices', expenses: 'expenses',
  admissions: 'admissions', clinicVisits: 'clinic_visits',
  disciplinaryRecords: 'disciplinary_records', staff: 'staff',
  facilities: 'facilities', notifications: 'notifications',
  schoolEvents: 'school_events', job_applications: 'job_applications',
  messages: 'messages', studentAttendance: 'student_attendance',
  assignmentSubmissions: 'assignment_submissions'
};

export async function fetchTable(key) {
  let query = supabase.from(TABLES[key] || key).select('*');
  if (_schoolId) query = query.eq('school_id', _schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertRow(key, row) {
  const payload = _schoolId ? { ...row, school_id: _schoolId } : row;
  const { error } = await supabase.from(TABLES[key] || key).upsert(payload);
  if (error) throw error;
}

export async function deleteRow(key, id, idColumn = 'id') {
  const { error } = await supabase.from(TABLES[key] || key).delete().eq(idColumn, id);
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
