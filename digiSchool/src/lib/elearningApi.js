/**
 * elearningApi.js — Supabase data layer for the e-learning portal.
 *
 * Backed by 072_elearning_core.sql. Follows the same conventions as api.js:
 * reads are scoped by RLS, writes are tagged with the active school id, and
 * anything that must survive a dropped connection goes through the IndexedDB
 * queue in offlineSync.js.
 *
 * The one rule that shapes this file: events are append-only with a
 * CLIENT-generated uuid. Replaying a queued batch twice inserts nothing the
 * second time, so offline sync needs no conflict resolution at all.
 */

import { supabase } from './supabaseClient';
import { getActiveSchoolId } from './api';
import { saveToCache, getFromCache, queueMutation } from './offlineSync';

const CACHE = {
  sessions: (schoolId) => `elearning_sessions_${schoolId}`,
  courses: (schoolId) => `elearning_courses_${schoolId}`,
  course: (courseId) => `elearning_course_${courseId}`,
  mastery: (schoolId, studentId) => `elearning_mastery_${schoolId}_${studentId}`,
};

const newId = () =>
  (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function requireSchool() {
  const schoolId = getActiveSchoolId();
  if (!schoolId) throw new Error('No active school selected');
  return schoolId;
}

// ---- Live sessions --------------------------------------------------------

/**
 * Sessions visible to the caller. RLS already restricts students/parents to
 * their own class and hides cancelled sessions from them, so no class filter
 * is needed here for correctness — `klass` is only a convenience for staff.
 */
export async function listLiveSessions({ subject, klass, since } = {}) {
  const schoolId = getActiveSchoolId();
  try {
    let query = supabase
      .from('elearning_live_sessions')
      .select('*')
      .order('start_at', { ascending: false });

    if (schoolId) query = query.eq('school_id', schoolId);
    if (subject && subject !== 'All') query = query.eq('subject', subject);
    if (klass && klass !== 'All') query = query.in('class', [klass, 'All', 'All Classes']);
    if (since) query = query.gte('start_at', since);

    const { data, error } = await query;
    if (error) throw error;

    await saveToCache(CACHE.sessions(schoolId), data || []);
    return data || [];
  } catch (e) {
    // Offline or RLS hiccup — serve the last good copy rather than an empty portal.
    const cached = await getFromCache(CACHE.sessions(schoolId));
    if (cached) return cached;
    throw e;
  }
}

export async function createLiveSession(input) {
  const schoolId = requireSchool();
  const row = {
    id: input.id || newId(),
    school_id: schoolId,
    lesson_id: input.lessonId || null,
    subject: input.subject,
    class: input.klass || input.class || 'All',
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim() || null,
    host_id: input.hostId || null,
    host_name: input.hostName || null,
    provider: detectProvider(input.joinUrl),
    join_url: input.joinUrl || null,
    resource_url: input.resourceUrl || null,
    start_at: input.startAt || null,
    end_at: input.endAt || null,
    state: 'scheduled',
    created_by: input.createdBy || null,
  };

  const { data, error } = await supabase
    .from('elearning_live_sessions')
    .insert(row)
    .select()
    .single();

  if (error) {
    await queueMutation('elearning_create_session', row);
    throw new Error(`Could not schedule class: ${error.message}`);
  }
  return data;
}

export async function updateLiveSession(id, patch) {
  const { data, error } = await supabase
    .from('elearning_live_sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Could not update class: ${error.message}`);
  return data;
}

/**
 * Cancelling keeps the row (and its attendance) but hides it from learners.
 * Prefer this over deleting anything a student may already have attended.
 */
export const cancelLiveSession = (id) => updateLiveSession(id, { state: 'cancelled' });

export async function deleteLiveSession(id) {
  const { error } = await supabase.from('elearning_live_sessions').delete().eq('id', id);
  if (error) throw new Error(`Could not delete class: ${error.message}`);
  return true;
}

function detectProvider(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('meet.google')) return 'meet';
  if (u.includes('zoom.')) return 'zoom';
  if (u.includes('teams.microsoft')) return 'teams';
  return 'other';
}

// ---- Live attendance ------------------------------------------------------

export async function listLiveAttendance(sessionId) {
  const { data, error } = await supabase
    .from('elearning_live_attendance')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data || [];
}

/**
 * A teacher's roster marks. Written as source='manual' so a later derivation
 * from join/leave events never silently overwrites a human decision.
 */
export async function saveLiveAttendance(sessionId, rows, markedBy = null) {
  const schoolId = requireSchool();
  const payload = rows.map((r) => ({
    session_id: sessionId,
    student_id: String(r.studentId),
    school_id: schoolId,
    status: r.status,
    source: 'manual',
    marked_by: markedBy,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('elearning_live_attendance')
    .upsert(payload, { onConflict: 'session_id,student_id' });

  if (error) {
    await queueMutation('elearning_save_attendance', { sessionId, payload });
    throw new Error(`Could not save attendance: ${error.message}`);
  }
  return true;
}

/**
 * Derived attendance (Algorithm G): fold a session's join/leave events into
 * presence. Pure — pass it the events and the session, get rows back.
 * Present at >= 60% of the session; late if the first join is >10min in.
 */
export function deriveAttendance(session, events, { presentAt = 0.6, lateAfterMin = 10 } = {}) {
  const start = session.start_at ? new Date(session.start_at) : null;
  const end = session.end_at ? new Date(session.end_at) : null;
  if (!start) return [];

  const windowEnd = end || new Date(start.getTime() + 40 * 60000);
  const durationMin = Math.max(1, (windowEnd - start) / 60000);

  const byStudent = new Map();
  for (const e of events) {
    if (e.kind !== 'join' && e.kind !== 'leave') continue;
    if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, []);
    byStudent.get(e.student_id).push(e);
  }

  const out = [];
  for (const [studentId, list] of byStudent) {
    list.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

    let minutes = 0;
    let openJoin = null;
    let firstJoin = null;
    let lastLeave = null;

    for (const e of list) {
      const t = new Date(e.occurred_at);
      if (e.kind === 'join') {
        if (!openJoin) openJoin = t;
        if (!firstJoin) firstJoin = t;
      } else if (openJoin) {
        // Clip to the session window so a tab left open overnight is not presence.
        const from = openJoin < start ? start : openJoin;
        const to = t > windowEnd ? windowEnd : t;
        if (to > from) minutes += (to - from) / 60000;
        lastLeave = t;
        openJoin = null;
      }
    }
    // Never left: credit up to the end of the session, not until now.
    if (openJoin) {
      const from = openJoin < start ? start : openJoin;
      if (windowEnd > from) minutes += (windowEnd - from) / 60000;
      lastLeave = windowEnd;
    }

    const pct = Math.min(1, minutes / durationMin);
    let status = 'absent';
    if (pct >= presentAt) {
      status = firstJoin && (firstJoin - start) / 60000 > lateAfterMin ? 'late' : 'present';
    }

    out.push({
      session_id: session.id,
      student_id: studentId,
      first_join: firstJoin ? firstJoin.toISOString() : null,
      last_leave: lastLeave ? new Date(lastLeave).toISOString() : null,
      minutes_present: Number(minutes.toFixed(2)),
      presence_pct: Number(pct.toFixed(4)),
      status,
      source: 'derived',
    });
  }
  return out;
}

// ---- Content graph --------------------------------------------------------

export async function listCourses({ klass, subject, term } = {}) {
  const schoolId = getActiveSchoolId();
  try {
    let query = supabase.from('elearning_courses').select('*').order('subject');
    if (schoolId) query = query.eq('school_id', schoolId);
    if (klass && klass !== 'All') query = query.eq('class', klass);
    if (subject && subject !== 'All') query = query.eq('subject', subject);
    if (term) query = query.eq('term', term);

    const { data, error } = await query;
    if (error) throw error;
    await saveToCache(CACHE.courses(schoolId), data || []);
    return data || [];
  } catch (e) {
    const cached = await getFromCache(CACHE.courses(schoolId));
    if (cached) return cached;
    throw e;
  }
}

/** A course with its units, lessons and blocks, in the nested shape the UI renders. */
export async function getCourse(courseId) {
  try {
    const [courseRes, unitsRes, lessonsRes] = await Promise.all([
      supabase.from('elearning_courses').select('*').eq('id', courseId).maybeSingle(),
      supabase.from('elearning_units').select('*').eq('course_id', courseId).order('ord'),
      supabase.from('elearning_lessons').select('*').eq('course_id', courseId).order('ord'),
    ]);
    if (courseRes.error) throw courseRes.error;
    if (!courseRes.data) return null;

    const lessons = lessonsRes.data || [];
    const lessonIds = lessons.map((l) => l.id);

    let blocks = [];
    if (lessonIds.length) {
      const { data, error } = await supabase
        .from('elearning_blocks')
        .select('*')
        .in('lesson_id', lessonIds)
        .order('ord');
      if (error) throw error;
      blocks = data || [];
    }

    const blocksByLesson = new Map();
    for (const b of blocks) {
      if (!blocksByLesson.has(b.lesson_id)) blocksByLesson.set(b.lesson_id, []);
      blocksByLesson.get(b.lesson_id).push(b);
    }

    const course = {
      ...courseRes.data,
      units: (unitsRes.data || []).map((u) => ({
        ...u,
        lessons: lessons
          .filter((l) => l.unit_id === u.id)
          .map((l) => ({ ...l, blocks: blocksByLesson.get(l.id) || [] })),
      })),
    };

    await saveToCache(CACHE.course(courseId), course);
    return course;
  } catch (e) {
    const cached = await getFromCache(CACHE.course(courseId));
    if (cached) return cached;
    throw e;
  }
}

/**
 * Idempotent upsert of a generated course graph (Algorithm A, called by the
 * phase-2 generator). Ids are deterministic, so re-running rewrites the same
 * rows. Lessons a teacher has pinned (origin='manual') are left alone.
 */
export async function upsertCourseGraph({ course, units = [], lessons = [], blocks = [] }) {
  const schoolId = requireSchool();
  const stamp = (r) => ({ ...r, school_id: schoolId });

  const { error: cErr } = await supabase
    .from('elearning_courses')
    .upsert(stamp({ ...course, generated_at: new Date().toISOString() }));
  if (cErr) throw new Error(`Course save failed: ${cErr.message}`);

  if (units.length) {
    const { error } = await supabase.from('elearning_units').upsert(units.map(stamp));
    if (error) throw new Error(`Units save failed: ${error.message}`);
  }

  if (lessons.length) {
    // Only auto rows are rewritten; a manual edit outranks the generator.
    const { data: existing } = await supabase
      .from('elearning_lessons')
      .select('id, origin')
      .eq('course_id', course.id);
    const pinned = new Set((existing || []).filter((l) => l.origin === 'manual').map((l) => l.id));

    const writable = lessons.filter((l) => !pinned.has(l.id)).map(stamp);
    if (writable.length) {
      const { error } = await supabase.from('elearning_lessons').upsert(writable);
      if (error) throw new Error(`Lessons save failed: ${error.message}`);
    }
  }

  if (blocks.length) {
    const { error } = await supabase.from('elearning_blocks').upsert(blocks.map(stamp));
    if (error) throw new Error(`Blocks save failed: ${error.message}`);
  }

  return true;
}

export async function setLessonState(lessonId, state, availableFrom = null) {
  const { error } = await supabase
    .from('elearning_lessons')
    .update({ state, available_from: availableFrom })
    .eq('id', lessonId);
  if (error) throw new Error(`Could not publish lesson: ${error.message}`);
  return true;
}

// ---- Events (append-only) -------------------------------------------------

/**
 * Record one learning event. The id is minted here, so a retry — from the
 * offline queue, a double-tap, or a flaky connection — is a no-op server side.
 */
export async function logEvent({
  studentId, lessonId = null, blockId = null, sessionId = null,
  kind, subject = null, strand = null, score = null, maxScore = null,
  difficulty = 1.0, meta = {}, occurredAt,
}) {
  const schoolId = requireSchool();
  const row = {
    id: newId(),
    school_id: schoolId,
    student_id: String(studentId),
    lesson_id: lessonId,
    block_id: blockId,
    session_id: sessionId,
    kind,
    subject,
    strand,
    score,
    max_score: maxScore,
    difficulty,
    meta,
    occurred_at: occurredAt || new Date().toISOString(),
  };

  const { error } = await supabase.from('elearning_events').insert(row);
  if (error) {
    // Queue and return the row — the caller's UI can treat the event as
    // recorded, because replaying it later is safe.
    await queueMutation('elearning_log_event', row);
    return { ...row, queued: true };
  }
  return row;
}

/** Replay a queued batch. Safe to call repeatedly — duplicate ids are ignored. */
export async function flushEvents(rows) {
  if (!rows?.length) return 0;
  const { error } = await supabase
    .from('elearning_events')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

export async function listEvents({ studentId, lessonId, since, limit = 500 } = {}) {
  let query = supabase
    .from('elearning_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (studentId) query = query.eq('student_id', String(studentId));
  if (lessonId) query = query.eq('lesson_id', lessonId);
  if (since) query = query.gte('occurred_at', since);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ---- Mastery --------------------------------------------------------------

export async function getMastery(studentId) {
  const schoolId = getActiveSchoolId();
  try {
    const { data, error } = await supabase
      .from('elearning_mastery')
      .select('*')
      .eq('student_id', String(studentId));
    if (error) throw error;
    await saveToCache(CACHE.mastery(schoolId, studentId), data || []);
    return data || [];
  } catch (e) {
    const cached = await getFromCache(CACHE.mastery(schoolId, studentId));
    if (cached) return cached;
    throw e;
  }
}

/** Recompute the mastery cache from the event log. Safe to run any time. */
export async function rebuildMastery(studentId = null) {
  const schoolId = requireSchool();
  const { data, error } = await supabase.rpc('rebuild_elearning_mastery', {
    p_school_id: schoolId,
    p_student_id: studentId ? String(studentId) : null,
  });
  if (error) throw new Error(`Mastery rebuild failed: ${error.message}`);
  return data;
}
