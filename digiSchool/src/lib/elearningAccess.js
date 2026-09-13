/**
 * elearningAccess.js — identity, addressing and visibility for the e-learning portal.
 *
 * Two jobs, both pure and dependency-free so they can be unit tested and reused
 * from the mobile shell:
 *
 *   1. Deterministic ids. A lesson's id is a hash of (school, class, subject,
 *      term, strand, sub_strand) — never a random uuid. Regenerating a course
 *      from schemes_of_work therefore rewrites the same rows instead of
 *      orphaning every student's progress. Same discipline as timetableEngine.
 *
 *   2. canSee(). The single visibility rule for the portal. It drives the UI;
 *      the identical predicate lives in Postgres as can_see_elearning() in
 *      072_elearning_core.sql and is the actual security boundary. If you change
 *      one, change the other — two drifting copies is how a portal leaks another
 *      class's material.
 */

import { matchesClass, isSubjectMatch } from '../utils/teacherPermissions';

export const MANAGER_ROLES = ['teacher', 'principal', 'deputy_academic', 'dos', 'admin', 'super_admin'];
export const ALL_CLASS_LABELS = ['All', 'All Classes'];
export const STATES = ['draft', 'scheduled', 'published', 'archived'];

// ---- Deterministic ids ----------------------------------------------------

/**
 * FNV-1a, 32 bits, as 8 hex chars. Not a security hash — this only needs to be
 * stable, synchronous and collision-resistant enough for a school's syllabus.
 * (crypto.subtle is async and would force every id call to become a promise.)
 */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Normalise a tuple part so trivial whitespace/case edits don't mint a new id. */
function part(v) {
  return String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Two independent 32-bit hashes over the same tuple → 16 hex chars, ~2^-64 collision odds. */
function uid(prefix, parts) {
  const joined = parts.map(part).join('|');
  return `${prefix}_${fnv1a(joined)}${fnv1a(`${joined}|salt`)}`;
}

export const courseUid = (schoolId, klass, subject, term) =>
  uid('c', [schoolId, klass, subject, term]);

export const unitUid = (schoolId, klass, subject, term, strand) =>
  uid('u', [schoolId, klass, subject, term, strand]);

export const lessonUid = (schoolId, klass, subject, term, strand, subStrand) =>
  uid('l', [schoolId, klass, subject, term, strand, subStrand]);

/** Storage path for a block's file. Matches the convention in fileStore.js. */
export const blockStoragePath = (schoolId, lessonId, blockId, ext = 'pdf') =>
  `${schoolId}/elearning/${lessonId}/${blockId}.${ext}`;

// ---- Visibility -----------------------------------------------------------

export const isManager = (user) => MANAGER_ROLES.includes(String(user?.role || '').toLowerCase());

export const isAllClasses = (klass) => !klass || ALL_CLASS_LABELS.includes(String(klass).trim());

/**
 * Is this node live for a learner right now?
 * 'scheduled' becomes visible once available_from has passed — that is what
 * lets a teacher stage a whole week and have it open on its own.
 */
export function isLive(node, now = new Date()) {
  const state = node?.state || 'draft';
  if (state === 'published') return true;
  if (state !== 'scheduled') return false;
  const from = node?.available_from || node?.availableFrom;
  return !!from && new Date(from) <= now;
}

/**
 * The classes a viewer may see content for.
 * Managers get null, meaning "unrestricted" — a teacher's subject/class scoping
 * is a separate, narrower question answered by canManage() below.
 */
export function viewerClasses(user, students = []) {
  if (isManager(user)) return null;
  const ids = [
    user?.student_id, user?.studentId, user?.link, user?.id,
    ...(Array.isArray(user?.linked_students) ? user.linked_students.map((s) => s?.id || s) : []),
  ].filter(Boolean).map(String);

  const mine = students.filter(
    (s) => ids.includes(String(s.id)) || (user?.username && s.adm === user.username)
  );
  return [...new Set(mine.map((s) => s.class).filter(Boolean))];
}

/**
 * canSee — the one visibility rule. Mirrored by can_see_elearning() in SQL.
 *
 * node: { school_id, class, state, available_from }
 * ctx:  { user, students, now }
 */
export function canSee(node, { user, students = [], now = new Date() } = {}) {
  if (!node) return false;

  const viewerSchool = user?.school_id || user?.schoolId;
  if (viewerSchool && node.school_id && String(node.school_id) !== String(viewerSchool)) return false;

  if (isManager(user)) return true;

  const classes = viewerClasses(user, students) || [];
  const classOk = isAllClasses(node.class) || classes.some((c) => matchesClass(node.class, c));

  return classOk && isLive(node, now);
}

/**
 * canManage — may this staff member author/edit this node?
 * Teachers are held to their subject-class assignments; academic leadership is not.
 */
export function canManage(node, { user, assignments = [] } = {}) {
  const role = String(user?.role || '').toLowerCase();
  if (!MANAGER_ROLES.includes(role)) return false;
  if (role !== 'teacher') return true;
  if (!node?.subject) return false;

  return assignments.some(
    (a) => isSubjectMatch(a.subject, node.subject)
      && (isAllClasses(node.class) || matchesClass(a.className, node.class))
  );
}

// ---- Mastery read-time helpers -------------------------------------------

/**
 * Time decay, applied when mastery is read rather than by a cron job, so the
 * stored value stays a pure fold over the event log.
 * Half-life ~31 days toward the 0.5 prior.
 */
export function decayedMastery(m, lastAttemptAt, now = new Date()) {
  if (m == null) return 0.5;
  if (!lastAttemptAt) return Number(m);
  const days = Math.max(0, (now - new Date(lastAttemptAt)) / 86400000);
  return 0.5 + (Number(m) - 0.5) * Math.exp(-days / 45);
}
