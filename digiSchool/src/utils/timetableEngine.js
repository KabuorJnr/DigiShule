// Pure timetable-generation engine (no React) so it can be unit-tested in isolation.
// Mirrors the Zeraki flow: typed timeslots, per-class singles/doubles, a per-teacher
// daily cap, math-in-morning, subject "not to follow" pairs and teacher time-off.
import { DEPARTMENTS, SUBJECTS } from '../data/seed';

// Only 'Normal' slots carry lessons; the rest render as fixed labels.
export const TIMESLOT_TYPES = ['Normal', 'ShortBreak', 'LongBreak', 'LunchBreak', 'Preps', 'Games'];
export const TYPE_LABELS = { ShortBreak: 'Break', LongBreak: 'Long Break', LunchBreak: 'Lunch', Preps: 'Preps', Games: 'Games' };

export const defaultConstraints = {
  maxPerDay: 6,
  mathInMorning: true,
  engKisNotFollow: true,
  mathSciNotFollow: false,
  freeAfternoonOnly: false,
  customPairs: [],        // [[subjectA, subjectB], ...]
  teacherTimeOff: {},     // { teacherName: ['<dayIdx>-<rowIdx>', ...] }
  blockDepartments: [],   // ['Technicals', 'Humanities']
  subjectRules: {},       // { subject: { time:'any'|'am'|'pm', maxPerDay:0, days:[dayIdx] } }
};

export function pairKey(a, b) { return [a, b].sort().join('|'); }

export function buildNotToFollow(c) {
  const s = new Set();
  if (!c) return s;
  if (c.engKisNotFollow) s.add(pairKey('English', 'Kiswahili'));
  if (c.mathSciNotFollow) ['Biology', 'Chemistry', 'Physics'].forEach((sci) => s.add(pairKey('Mathematics', sci)));
  (c.customPairs || []).forEach(([a, b]) => { if (a && b) s.add(pairKey(a, b)); });
  return s;
}

// Does this teacher teach `sub`? Strong signals first (explicit subject list /
// field), then a DEPARTMENT match — but ONLY when both sides are defined. The
// old check compared `t.dept === DEPARTMENTS[sub]`, and for a custom subject
// (Arabic, French, …) DEPARTMENTS[sub] is undefined, so any teacher with a
// missing dept matched EVERY custom subject (undefined === undefined). That,
// plus always taking the first match, dumped 100+ subjects on one teacher.
function teacherTeaches(t, sub) {
  if ((t.subjects || []).includes(sub)) return true;
  if (t.subject === sub) return true;
  const subDept = DEPARTMENTS[sub];
  return !!subDept && !!t.dept && t.dept === subDept;
}

function teacherTeachesClass(t, className) {
  if (!className) return true;
  return (t.classes || []).includes(className) || t.assignedClass === className || t.assigned_class === className;
}

export function defaultAssignments(teachers = [], subjects = SUBJECTS, className = '', singlesFor = null) {
  if (teachers.length === 0) return [];
  const list = Array.isArray(subjects) && subjects.length ? subjects : SUBJECTS;

  // Spread the workload across the whole staff instead of piling every subject
  // on the first match: among the valid candidates for a subject, always pick
  // the one currently carrying the fewest subjects (ties keep staff order).
  const load = new Map();
  teachers.forEach((t) => load.set(t, 0));
  const leastLoaded = (candidates) => {
    let best = null;
    for (const t of candidates) {
      if (best === null || (load.get(t) || 0) < (load.get(best) || 0)) best = t;
    }
    if (best) load.set(best, (load.get(best) || 0) + 1);
    return best;
  };

  return list.map((sub) => {
    // 1. Teaches this subject AND this class. 2. Teaches this subject (any class).
    // 3. Anyone (least-loaded) so the subject is never left unassigned.
    let t = leastLoaded(teachers.filter((x) => teacherTeaches(x, sub) && teacherTeachesClass(x, className)));
    if (!t) t = leastLoaded(teachers.filter((x) => teacherTeaches(x, sub)));
    if (!t) t = leastLoaded(teachers);

    const singles = singlesFor ? singlesFor(sub) : (sub === 'Mathematics' || sub === 'English' ? 5 : 4);
    return { subject: sub, teacher: t?.name || 'TBD', singles, doubles: 0 };
  });
}

// Build a typed-timeslot list from a simple schedule pattern (first-time setup helper).
export function patternTimeslots(cfg) {
  const { startTime = '07:00', periods = 8, duration = 40, breakAfter = 2,
    breakDuration = 20, lunchAfter = 5, lunchDuration = 60 } = cfg || {};
  let t = new Date(`2000-01-01T${startTime}:00`);
  const add = (m) => { t = new Date(t.getTime() + m * 60000); };
  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const slots = [];
  for (let p = 1; p <= periods; p++) {
    const s = fmt(t); add(duration);
    slots.push({ start: s, end: fmt(t), type: 'Normal' });
    if (p === breakAfter && breakDuration > 0) { const bs = fmt(t); add(breakDuration); slots.push({ start: bs, end: fmt(t), type: 'ShortBreak' }); }
    if (p === lunchAfter && lunchDuration > 0) { const ls = fmt(t); add(lunchDuration); slots.push({ start: ls, end: fmt(t), type: 'LunchBreak' }); }
  }
  return slots;
}

// Annotate each slot with whether it is teachable and its running period number / label.
export function annotateTimeslots(timeslots) {
  let pn = 0;
  return (timeslots || []).map((s) => {
    const teaching = s.type === 'Normal';
    if (teaching) pn += 1;
    return { ...s, teaching, period: teaching ? pn : null, label: teaching ? `P${pn}` : (TYPE_LABELS[s.type] || s.type) };
  });
}

// One grid row per timeslot; non-teaching rows are pre-filled with their label.
export function buildEmptyGrid(rows, numDays) {
  return rows.map((r) => Array.from({ length: numDays }, () => (r.teaching ? { type: 'empty' } : { type: 'break', label: r.label })));
}

// Resolve a subject/assignment's department. Assignments don't carry a dept, so
// we look it up in the school's subject→dept map (from Settings), falling back
// to the hardcoded map. Custom subjects (French, Computer…) only resolve via the
// passed map, which is why block-department matching needs it.
export function deptForSubject(subject, subjectDept = {}) {
  return subjectDept[subject] || DEPARTMENTS[subject] || null;
}

// Block-aware weekly lesson total for one class's assignments. Subjects in a
// "block" (concurrent) department share the same periods, so the block counts
// ONCE — the max singles/doubles among its subjects — instead of summing them.
export function requiredLessons(assignments = [], blockDepts = [], subjectDept = {}) {
  const blocks = {}; // dept -> { s, d }
  let total = 0;
  (assignments || []).forEach((a) => {
    const s = Number(a.singles) || 0, d = Number(a.doubles) || 0;
    const dept = deptForSubject(a.subject, subjectDept) || a.dept;
    if (dept && blockDepts.includes(dept)) {
      const b = (blocks[dept] || (blocks[dept] = { s: 0, d: 0 }));
      b.s = Math.max(b.s, s); b.d = Math.max(b.d, d);
    } else {
      total += s + 2 * d;
    }
  });
  Object.values(blocks).forEach((b) => { total += b.s + 2 * b.d; });
  return total;
}

// Generate timetables for all classes. Returns { result, unplaced }.
export function generateAll({ classes, days, timeslots, assignmentsByClass, constraints, term, subjectDept = {} }) {
  const rows = annotateTimeslots(timeslots);
  const numDays = days.length;
  const cap = Number(constraints?.maxPerDay) || 0;
  const teachRows = rows.map((r, i) => (r.teaching ? i : -1)).filter((i) => i >= 0);
  const numTeach = teachRows.length;
  const morningCut = Math.ceil(numTeach / 2);
  const teachPos = {}; teachRows.forEach((ri, idx) => { teachPos[ri] = idx; });

  const notFollow = buildNotToFollow(constraints);
  const timeOff = constraints?.teacherTimeOff || {};
  const mathMorning = !!constraints?.mathInMorning;
  const freeAfternoon = !!constraints?.freeAfternoonOnly;
  const subjectRules = constraints?.subjectRules || {}; // { subject: { time, maxPerDay, days:[dayIdx] } }
  const deptOf = (a) => a.dept || deptForSubject(a.subject, subjectDept);

  const teacherBusy = {};  // teacher -> Set('<day>-<row>')
  const teacherDay = {};   // teacher -> { day: count }
  const subjDay = {};      // '<cls>|<subject>|<day>' -> count (for per-subject daily caps)
  const result = {};
  const unplaced = [];

  // Work on a clone so we never mutate the caller's React assignment state.
  const byClass = {};
  classes.forEach((c) => { byClass[c] = [...(assignmentsByClass[c] || [])]; });

  const isOff = (t, d, r) => (timeOff[t] || []).includes(`${d}-${r}`);
  const free = (t, d, r) => (!teacherBusy[t] || !teacherBusy[t].has(`${d}-${r}`)) && !isOff(t, d, r);
  const dayCount = (t, d) => teacherDay[t]?.[d] || 0;
  const mark = (t, d, r) => {
    (teacherBusy[t] || (teacherBusy[t] = new Set())).add(`${d}-${r}`);
    teacherDay[t] || (teacherDay[t] = {});
    teacherDay[t][d] = (teacherDay[t][d] || 0) + 1;
  };

  classes.forEach((cls) => {
    result[cls] = { grid: buildEmptyGrid(rows, numDays), timeslots, days, periods: numTeach, term };
  });

  const prevTeachRow = (ri) => { const p = teachPos[ri]; return p > 0 ? teachRows[p - 1] : -1; };
  const nextTeachRow = (ri) => { const p = teachPos[ri]; return p < numTeach - 1 ? teachRows[p + 1] : -1; };

  // --- OPTION-BLOCK TIMETABLING ---
  // Subjects in a "block" (concurrent) department are taught at the SAME time —
  // a learner picks one option. We place them as a single block span PER STREAM,
  // independently (streams are NOT synced to the same slot, so they differ), and
  // mark EVERY option's teacher busy globally so a teacher can't be double-booked
  // across streams. Each option keeps its own teacher; the cell shows the options
  // joined (e.g. "French / German / Mandarin").
  const blockDepts = constraints?.blockDepartments || [];
  if (blockDepts.length > 0) {
    classes.forEach((cls) => {
      const grid = result[cls].grid;
      blockDepts.forEach((dept) => {
        const options = (byClass[cls] || []).filter((a) =>
          deptOf(a) === dept && a.teacher && a.teacher !== 'TBD' &&
          (Number(a.singles) > 0 || Number(a.doubles) > 0));
        if (options.length === 0) return;

        // Pull the options out of normal (independent) placement for this stream.
        byClass[cls] = byClass[cls].filter((a) => !options.includes(a));

        // Footprint of the concurrent block = the largest option within it.
        let maxSingles = 0, maxDoubles = 0;
        options.forEach((a) => {
          maxSingles = Math.max(maxSingles, Number(a.singles) || 0);
          maxDoubles = Math.max(maxDoubles, Number(a.doubles) || 0);
        });
        const teachersInBlock = options.map((o) => o.teacher).filter((t) => t && t !== 'TBD');
        const subjectsLabel = options.map((o) => o.subject).join(' / ');
        const teachersLabel = options.map((o) => o.teacher).join(' / ');

        const tryPlaceBlock = (d, span) => {
          for (const ri of span) if (grid[ri][d].type !== 'empty') return false;
          for (const t of teachersInBlock) {
            for (const ri of span) if (!free(t, d, ri)) return false;
            if (cap && dayCount(t, d) + span.length > cap) return false;
          }
          for (const ri of span) {
            grid[ri][d] = { type: 'lesson', subject: subjectsLabel, teacher: teachersLabel, dept, double: span.length === 2, isBlock: true };
          }
          for (const t of teachersInBlock) for (const ri of span) mark(t, d, ri);
          return true;
        };

        const placeBlockUnit = (size, avoid) => {
          const dayOrder = Array.from({ length: numDays }, (_, d) => d).sort((a, b) => {
            const av = avoid.has(a) ? 1 : 0, bv = avoid.has(b) ? 1 : 0;
            if (av !== bv) return av - bv;
            return Math.random() - 0.5;
          });
          for (const d of dayOrder) {
            if (size === 2) {
              for (let idx = 0; idx < numTeach - 1; idx++) {
                const r = teachRows[idx], r2 = teachRows[idx + 1];
                if (r2 !== r + 1) continue;
                if (tryPlaceBlock(d, [r, r2])) return d;
              }
            } else {
              for (const r of teachRows) { if (tryPlaceBlock(d, [r])) return d; }
            }
          }
          return -1;
        };

        const avoid = new Set();
        let dbl = maxDoubles;
        while (dbl > 0) {
          const d = placeBlockUnit(2, avoid);
          if (d === -1) { unplaced.push({ cls, subject: subjectsLabel, teacher: teachersLabel, count: 2, kind: 'block-double' }); break; }
          avoid.add(d); dbl--;
        }
        let sng = maxSingles;
        while (sng > 0) {
          const d = placeBlockUnit(1, avoid);
          if (d === -1) { unplaced.push({ cls, subject: subjectsLabel, teacher: teachersLabel, count: sng, kind: 'block' }); break; }
          avoid.add(d); sng--;
        }
      });
    });
  }

  function conflictsAdjacent(cls, d, startRow, endRow, subject) {
    if (notFollow.size === 0) return false;
    const grid = result[cls].grid;
    const clash = (ri) => {
      if (ri < 0) return false;
      const c = grid[ri][d];
      return c && c.type === 'lesson' && c.subject !== subject && notFollow.has(pairKey(subject, c.subject));
    };
    return clash(prevTeachRow(startRow)) || clash(nextTeachRow(endRow));
  }

  function tryPlace(cls, subject, teacher, d, span) {
    const grid = result[cls].grid;
    const lastPeriod = rows[span[span.length - 1]].period;
    const firstPeriod = rows[span[0]].period;
    // Built-in math-in-morning (kept for back-compat).
    if (mathMorning && subject === 'Mathematics' && lastPeriod > morningCut) return false;
    // Editable per-subject custom rules (time-of-day / excluded days / daily cap).
    const rule = subjectRules[subject];
    if (rule) {
      if (rule.time === 'am' && lastPeriod > morningCut) return false;
      if (rule.time === 'pm' && firstPeriod <= morningCut) return false;
      if (Array.isArray(rule.days) && rule.days.includes(d)) return false;
      const sc = subjDay[`${cls}|${subject}|${d}`] || 0;
      if (Number(rule.maxPerDay) > 0 && sc + span.length > Number(rule.maxPerDay)) return false;
    }
    for (const ri of span) { if (grid[ri][d].type !== 'empty' || !free(teacher, d, ri)) return false; }
    if (cap && dayCount(teacher, d) + span.length > cap) return false;
    if (conflictsAdjacent(cls, d, span[0], span[span.length - 1], subject)) return false;
    for (const ri of span) {
      grid[ri][d] = { type: 'lesson', subject, teacher, dept: deptForSubject(subject, subjectDept) || 'Humanities', double: span.length === 2, notes: '' };
      mark(teacher, d, ri);
    }
    subjDay[`${cls}|${subject}|${d}`] = (subjDay[`${cls}|${subject}|${d}`] || 0) + span.length;
    return true;
  }

  // Place one unit (size 1 = single, 2 = consecutive double). `avoid` = days to spread away from.
  function placeUnit(cls, subject, teacher, size, avoid) {
    const grid = result[cls].grid;
    const classDayLoad = Array.from({ length: numDays }, (_, d) =>
      grid.reduce((n, row) => n + (row[d].type === 'lesson' ? 1 : 0), 0));
    const dayOrder = Array.from({ length: numDays }, (_, d) => d).sort((a, b) => {
      const av = avoid.has(a) ? 1 : 0, bv = avoid.has(b) ? 1 : 0;
      if (av !== bv) return av - bv;
      if (classDayLoad[a] !== classDayLoad[b]) return classDayLoad[a] - classDayLoad[b];
      return Math.random() - 0.5;
    });

    for (const d of dayOrder) {
      if (cap && dayCount(teacher, d) + size > cap) continue;
      if (size === 2) {
        for (let idx = 0; idx < numTeach - 1; idx++) {
          const r = teachRows[idx], r2 = teachRows[idx + 1];
          if (r2 !== r + 1) continue; // must be physically adjacent rows (no break between)
          if (tryPlace(cls, subject, teacher, d, [r, r2])) return d;
        }
      } else {
        let order = teachRows;
        if (!freeAfternoon && numTeach > 0) {
          const off = Math.floor(Math.random() * numTeach);
          order = teachRows.slice(off).concat(teachRows.slice(0, off));
        }
        for (const r of order) { if (tryPlace(cls, subject, teacher, d, [r])) return d; }
      }
    }
    return -1;
  }

  classes.forEach((cls) => {
    const assignments = (byClass[cls] || [])
      .filter((a) => a.teacher && a.teacher !== 'TBD' && (Number(a.singles) > 0 || Number(a.doubles) > 0))
      .sort((a, b) => (Number(b.singles) + 2 * Number(b.doubles)) - (Number(a.singles) + 2 * Number(a.doubles)));

    assignments.forEach((a) => {
      const teacher = a.teacher;
      const avoid = new Set();

      let doubles = Number(a.doubles) || 0;
      while (doubles > 0) {
        const d = placeUnit(cls, a.subject, teacher, 2, avoid);
        if (d === -1) { unplaced.push({ cls, subject: a.subject, teacher, count: doubles * 2, kind: 'double' }); break; }
        avoid.add(d);
        doubles--;
      }

      let singles = Number(a.singles) || 0;
      let relaxed = false;
      while (singles > 0) {
        const d = placeUnit(cls, a.subject, teacher, 1, avoid);
        if (d === -1) {
          if (!relaxed) { relaxed = true; avoid.clear(); continue; }
          unplaced.push({ cls, subject: a.subject, teacher, count: singles, kind: 'single' });
          break;
        }
        avoid.add(d);
        singles--;
      }
    });
  });

  return { result, unplaced };
}
