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

export function defaultAssignments(teachers = [], subjects = SUBJECTS, className = '') {
  if (teachers.length === 0) return [];
  const list = Array.isArray(subjects) && subjects.length ? subjects : SUBJECTS;
  
  return list.map((sub, i) => {
    // 1. Exact match: teacher teaches this subject AND this class
    let t = teachers.find(t => {
      const teachesSub = (t.subjects || []).includes(sub) || t.subject === sub || t.dept === DEPARTMENTS[sub];
      const teachesClass = (t.classes || []).includes(className) || t.assignedClass === className || t.assigned_class === className;
      return teachesSub && teachesClass;
    });

    // 2. Partial match: teacher teaches this subject (we'll just use the first one we find)
    if (!t) {
      t = teachers.find(t => (t.subjects || []).includes(sub) || t.subject === sub || t.dept === DEPARTMENTS[sub]);
    }

    // 3. Fallback: round-robin
    if (!t) {
      t = teachers[i % teachers.length];
    }

    return {
      subject: sub,
      teacher: t?.name || 'TBD',
      singles: sub === 'Mathematics' || sub === 'English' ? 5 : 4,
      doubles: 0,
    };
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

// Generate timetables for all classes. Returns { result, unplaced }.
export function generateAll({ classes, days, timeslots, assignmentsByClass, constraints, term }) {
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

  const teacherBusy = {};  // teacher -> Set('<day>-<row>')
  const teacherDay = {};   // teacher -> { day: count }
  const result = {};
  const unplaced = [];

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
    if (mathMorning && subject === 'Mathematics' && rows[span[span.length - 1]].period > morningCut) return false;
    for (const ri of span) { if (grid[ri][d].type !== 'empty' || !free(teacher, d, ri)) return false; }
    if (cap && dayCount(teacher, d) + span.length > cap) return false;
    if (conflictsAdjacent(cls, d, span[0], span[span.length - 1], subject)) return false;
    for (const ri of span) {
      grid[ri][d] = { type: 'lesson', subject, teacher, dept: DEPARTMENTS[subject] || 'Humanities', double: span.length === 2, notes: '' };
      mark(teacher, d, ri);
    }
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
    const assignments = (assignmentsByClass[cls] || [])
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
