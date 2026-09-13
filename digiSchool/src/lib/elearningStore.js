/**
 * elearningStore.js — view-facing facade for live classes.
 *
 * Previously this held the whole catalog in localStorage, which meant a
 * scheduled class lived on one teacher's browser and vanished with a cache
 * clear. It now delegates to elearningApi.js (Postgres, RLS-scoped) and only
 * keeps localStorage as an offline read-through mirror.
 *
 * The functions are async now. It maps between the DB row shape and the
 * camelCase shape ELearning.jsx renders, so the view stays unaware of the
 * schema.
 */

import * as api from './elearningApi';

const mirrorKey = (schoolId) => `eduone_elearning_catalog_${schoolId || 'default'}`;
const attendanceMirrorKey = (schoolId, sessionId) =>
  `eduone_elearning_att_${schoolId || 'default'}_${sessionId}`;

// ---- Shape mapping --------------------------------------------------------

function toView(row) {
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    description: row.description || '',
    teacher: row.host_name || 'Teacher',
    teacherId: row.host_id || null,
    klass: row.class || 'All',
    meetingLink: row.join_url || '',
    resourceLink: row.resource_url || '',
    scheduledTime: row.start_at || '',
    state: row.state,
    createdAt: row.created_at,
  };
}

function readMirror(schoolId) {
  try {
    const raw = localStorage.getItem(mirrorKey(schoolId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function writeMirror(schoolId, list) {
  try { localStorage.setItem(mirrorKey(schoolId), JSON.stringify(list)); } catch { /* quota */ }
}

// ---- Catalog --------------------------------------------------------------

/**
 * Live classes visible to the current user. RLS decides what comes back, so a
 * student only ever receives their own class's sessions — the view's filtering
 * is presentation, not security.
 */
export async function loadCatalog(schoolId) {
  try {
    const rows = await api.listLiveSessions();
    const list = rows.map(toView);
    writeMirror(schoolId, list);
    return list;
  } catch (e) {
    console.warn('[E-Learning] Falling back to cached catalog:', e.message);
    return readMirror(schoolId) || [];
  }
}

export async function scheduleClass(input, schoolId) {
  const row = await api.createLiveSession({
    subject: input.subject,
    title: input.title,
    description: input.description,
    klass: input.klass,
    joinUrl: input.meetingLink,
    resourceUrl: input.resourceLink,
    // datetime-local gives a naive string; treat it as the school's local time.
    startAt: input.scheduledTime ? new Date(input.scheduledTime).toISOString() : null,
    hostId: input.teacherId,
    hostName: input.teacher,
    createdBy: input.teacherId,
  });
  const list = await loadCatalog(schoolId);
  return { created: toView(row), catalog: list };
}

/**
 * Cancel rather than hard-delete: attendance rows and any events students
 * already generated stay intact, and learners simply stop seeing it.
 */
export async function cancelClass(id, schoolId) {
  await api.cancelLiveSession(id);
  return loadCatalog(schoolId);
}

export async function deleteClass(id, schoolId) {
  await api.deleteLiveSession(id);
  return loadCatalog(schoolId);
}

// ---- Attendance -----------------------------------------------------------

/** Returns a { [studentId]: 'Present' | 'Absent' } map for the roster UI. */
export async function getLiveAttendance(schoolId, sessionId) {
  try {
    const rows = await api.listLiveAttendance(sessionId);
    const map = {};
    rows.forEach((r) => {
      map[r.student_id] = r.status === 'present' || r.status === 'late' ? 'Present' : 'Absent';
    });
    try {
      localStorage.setItem(attendanceMirrorKey(schoolId, sessionId), JSON.stringify(map));
    } catch { /* quota */ }
    return map;
  } catch {
    try {
      const raw = localStorage.getItem(attendanceMirrorKey(schoolId, sessionId));
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }
}

export async function saveLiveAttendance(schoolId, sessionId, attendanceMap, markedBy = null) {
  const rows = Object.entries(attendanceMap)
    .filter(([, status]) => status)
    .map(([studentId, status]) => ({
      studentId,
      status: status === 'Present' ? 'present' : 'absent',
    }));

  await api.saveLiveAttendance(sessionId, rows, markedBy);
  try {
    localStorage.setItem(attendanceMirrorKey(schoolId, sessionId), JSON.stringify(attendanceMap));
  } catch { /* quota */ }
  return true;
}
