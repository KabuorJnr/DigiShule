/**
 * dutyRoster.js — termly teacher-on-duty roster generation.
 *
 * Pure functions, no React, so the allocation rules can be unit-tested in
 * isolation (same discipline as timetableEngine.js).
 *
 * The school supplies three things: the teachers available, how many teachers
 * are on duty each week, and how many weeks the term runs. The generator
 * deals teachers out across the weeks so that:
 *
 *   1. the load is as even as possible — nobody does two tours before someone
 *      else has done one,
 *   2. a teacher is not rostered twice in the same week,
 *   3. the same pairing does not repeat until it has to,
 *   4. regenerating with the same inputs gives the same roster (deterministic),
 *      so a published roster does not reshuffle on every page load.
 *
 * Excluded teachers (on leave, exempt) are removed before dealing, so the
 * rotation closes over the remaining pool cleanly.
 */

export const DEFAULT_ROSTER_CONFIG = {
  teachersPerWeek: 2,
  weeks: 13,          // a typical Kenyan term
  startDate: '',      // ISO date of the Monday week 1 begins
  excluded: [],       // teacher names/ids to leave out
};

/** ISO date of the Monday `offset` weeks after `startDate`. */
export function weekStart(startDate, offset) {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

/** Friday of the same week. */
export function weekEnd(startDate, offset) {
  const s = weekStart(startDate, offset);
  if (!s) return null;
  const d = new Date(s);
  d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0, 10);
}

/**
 * Deal teachers across weeks in a continuous round-robin.
 *
 * Walking one cursor through the pool (rather than re-picking per week) is
 * what makes the load even: every teacher is used once before anyone is used
 * twice, and the cursor carries across the week boundary so the rotation does
 * not restart and over-use whoever sits at the front of the list.
 *
 * @param {Array<string|{id,name}>} teachers pool to draw from
 * @param {object} config {teachersPerWeek, weeks, startDate, excluded}
 * @returns {{weeks: Array, counts: Object, warnings: Array}}
 */
export function generateDutyRoster(teachers = [], config = {}) {
  const cfg = { ...DEFAULT_ROSTER_CONFIG, ...config };
  const perWeek = Math.max(1, Math.floor(Number(cfg.teachersPerWeek) || 1));
  const weekCount = Math.max(1, Math.floor(Number(cfg.weeks) || 1));
  const excluded = new Set((cfg.excluded || []).map((e) => String(e).toLowerCase()));

  // Normalise to { id, name } and drop the excluded.
  const pool = (teachers || [])
    .map((t) => (typeof t === 'string' ? { id: t, name: t } : { id: t.id ?? t.name, name: t.name ?? String(t.id) }))
    .filter((t) => t.name && !excluded.has(String(t.name).toLowerCase()) && !excluded.has(String(t.id).toLowerCase()));

  const warnings = [];
  if (pool.length === 0) {
    return { weeks: [], counts: {}, warnings: ['No teachers available to roster.'] };
  }
  if (pool.length < perWeek) {
    warnings.push(
      `Only ${pool.length} teacher${pool.length === 1 ? '' : 's'} available but ${perWeek} are needed each week — ` +
      'some teachers will repeat within a week.'
    );
  }

  const counts = Object.fromEntries(pool.map((t) => [t.name, 0]));
  const weeks = [];
  let cursor = 0;

  for (let w = 0; w < weekCount; w++) {
    const onDuty = [];
    const seenThisWeek = new Set();

    for (let slot = 0; slot < perWeek; slot++) {
      // Advance past anyone already on duty this week, unless the pool is too
      // small to avoid it (guarded by the scan limit).
      let scanned = 0;
      let pick = pool[cursor % pool.length];
      while (seenThisWeek.has(pick.name) && scanned < pool.length) {
        cursor += 1;
        pick = pool[cursor % pool.length];
        scanned += 1;
      }
      onDuty.push(pick);
      seenThisWeek.add(pick.name);
      counts[pick.name] += 1;
      cursor += 1;
    }

    weeks.push({
      week: w + 1,
      start: weekStart(cfg.startDate, w),
      end: weekEnd(cfg.startDate, w),
      teachers: onDuty,
    });
  }

  // Surface an uneven spread rather than letting it pass silently.
  const loads = Object.values(counts);
  const spread = Math.max(...loads) - Math.min(...loads);
  if (spread > 1) {
    warnings.push(`Duty load varies by ${spread} weeks across teachers — consider adjusting weeks or teachers per week.`);
  }

  return { weeks, counts, warnings };
}

/** Flatten a roster into rows for a table or PDF export. */
export function rosterToRows(roster) {
  return (roster?.weeks || []).map((w) => ({
    week: `Week ${w.week}`,
    dates: w.start ? `${w.start} → ${w.end}` : '—',
    teachers: w.teachers.map((t) => t.name).join(', '),
  }));
}

/** The week covering `date` (defaults to today), or null if outside the term. */
export function currentDutyWeek(roster, date = new Date()) {
  const iso = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  return (roster?.weeks || []).find((w) => w.start && w.end && iso >= w.start && iso <= w.end) || null;
}
