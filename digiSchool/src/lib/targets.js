/**
 * targets.js — the school's performance targets, in one place.
 *
 * Every dashboard that shows a metric "against target" reads its target from
 * here, and every target is editable by the school in Settings → Targets
 * (persisted onto `settings.targets` via updateSettings). Nothing is hardcoded
 * in a dashboard any more.
 *
 * Two exports matter:
 *   getTargets(settings)        → the numbers the school has set (with defaults)
 *   computeTargetMetrics(input) → those numbers resolved against live data,
 *                                 each as { current, target, pct, status, … }
 *
 * `pct` is always "percent of the way to target", clamped 0–100, so a progress
 * bar or ring can render it directly. `status` is a tone name the Sneat
 * components understand.
 */

/** Defaults used until a school sets its own. Tuned for a Kenyan secondary school. */
export const DEFAULT_TARGETS = {
  // Finance
  feeCollectionRate: 90,      // % of billed fees collected by end of term
  // Enrolment
  admissionTarget: 0,         // students to admit this year (0 = use capacity)
  enrolmentCapacity: 0,       // max students the school can hold (0 = unset)
  // Academics
  // NOTE: there is deliberately no school-wide mean target. A mean is only
  // meaningful per class — Form 1 and Form 4 are different problems — so the
  // real targets live in settings.targets.classMeans[year][className].
  // This value is only the fallback applied to a class with no target of its own.
  defaultClassMean: 60,
  marksCompletion: 100,       // % of class-subject units with marks entered
  // Operations
  timetableCoverage: 100,     // % of classes that have a published timetable
  classTeacherCoverage: 100,  // % of classes with a class teacher assigned
  subjectAllocation: 100,     // % of class-subject slots with a teacher
  attendanceRate: 95,         // % student attendance
  staffAttendanceRate: 95,    // % staff present
  // Administration
  openActionsCeiling: 0,      // desired size of the pending-decision queue
  disciplineCeiling: 0,       // desired number of open discipline cases
};

/** Human labels + units, so Settings can render the form from one source. */
export const TARGET_FIELDS = [
  { key: 'feeCollectionRate', label: 'Fee collection rate', unit: '%', group: 'Finance',
    help: 'Share of billed fees collected by the end of term.' },
  { key: 'admissionTarget', label: 'Students to admit', unit: 'students', group: 'Enrolment',
    help: 'New admissions targeted this academic year. Leave 0 to use capacity instead.' },
  { key: 'enrolmentCapacity', label: 'Enrolment capacity', unit: 'students', group: 'Enrolment',
    help: 'Maximum students the school can hold. 0 means unset.' },
  { key: 'defaultClassMean', label: 'Default class mean', unit: '%', group: 'Academics',
    help: 'Fallback only — used for a class with no mean target of its own. Set real targets per class and year below.' },
  { key: 'marksCompletion', label: 'Marks entry completion', unit: '%', group: 'Academics',
    help: 'Share of class-subject units with marks fully entered.' },
  { key: 'timetableCoverage', label: 'Timetable coverage', unit: '%', group: 'Operations',
    help: 'Share of classes that have a published timetable. Every class should have one.' },
  { key: 'classTeacherCoverage', label: 'Class-teacher coverage', unit: '%', group: 'Operations',
    help: 'Share of classes with a class teacher assigned.' },
  { key: 'subjectAllocation', label: 'Subject allocation', unit: '%', group: 'Operations',
    help: 'Share of class-subject slots with a teacher allocated.' },
  { key: 'attendanceRate', label: 'Student attendance', unit: '%', group: 'Operations',
    help: 'Target daily student attendance rate.' },
  { key: 'staffAttendanceRate', label: 'Staff attendance', unit: '%', group: 'Operations',
    help: 'Target daily staff attendance rate.' },
  { key: 'openActionsCeiling', label: 'Open actions ceiling', unit: 'items', group: 'Administration',
    help: 'How many pending decisions are acceptable. 0 means clear the queue.' },
  { key: 'disciplineCeiling', label: 'Open discipline ceiling', unit: 'cases', group: 'Administration',
    help: 'How many open discipline cases are acceptable.' },
];

/* ────────────────────────── Per-class mean targets ───────────────────────
 * A school-wide mean is not an actionable target: Form 1 and Form 4 sit at
 * different points of the curriculum and are judged differently. Mean targets
 * are therefore set per CLASS LEVEL and per YEAR, and a stream inherits its
 * level's target ("Form 2 East" is measured against "Form 2").
 *
 * Shape: settings.targets.classMeans = { "2026": { "Form 1": 55, ... } }
 * ------------------------------------------------------------------------ */

/** The academic year targets are keyed by. */
export function getAcademicYear(settings) {
  return String(settings?.academicYear || settings?.currentYear || new Date().getFullYear());
}

/** Base class levels a school has defined, e.g. ['Form 1','Form 2']. */
export function getClassLevels(settings) {
  const classes = settings?.classes || [];
  return classes
    .map((c) => (typeof c === 'string' ? c.trim() : c?.name))
    .filter(Boolean);
}

/**
 * Reduce a class or stream name to its level.
 * "Form 2 East" → "Form 2" when "Form 2" is a known level; otherwise returned
 * unchanged, so schools that name classes without streams still work.
 */
export function classLevelOf(className, levels = []) {
  const name = String(className || '').trim();
  if (!name) return '';
  if (levels.includes(name)) return name;
  // Longest matching prefix wins ("Grade 10" before "Grade 1").
  const match = levels
    .filter((l) => name.startsWith(`${l} `))
    .sort((a, b) => b.length - a.length)[0];
  return match || name;
}

/** All mean targets for a year: { [level]: number }. */
export function getClassMeanTargets(settings, year) {
  const y = year || getAcademicYear(settings);
  const all = settings?.targets?.classMeans || {};
  return { ...(all[y] || {}) };
}

/** The mean target for one class or stream, falling back to the default. */
export function getClassMeanTarget(settings, className, year) {
  const levels = getClassLevels(settings);
  const level = classLevelOf(className, levels);
  const table = getClassMeanTargets(settings, year);
  const v = Number(table[level]);
  if (Number.isFinite(v) && v > 0) return v;
  return getTargets(settings).defaultClassMean;
}

/** Years that have any targets saved, newest first (always includes current). */
export function getTargetYears(settings) {
  const all = settings?.targets?.classMeans || {};
  const years = new Set(Object.keys(all));
  years.add(getAcademicYear(settings));
  return [...years].sort((a, b) => Number(b) - Number(a));
}

/**
 * Measure actual class means against their per-class targets.
 *
 * @param {object} settings
 * @param {Array}  actuals  [{ name, mean, students }] — one row per class or
 *                          stream, as computed by the calling dashboard.
 * @param {string} year
 * @returns {{ rows, met, total, pct, worst, best, rollup }}
 *   rows   — each class with its target, gap, pct-to-target and tone
 *   rollup — a metric descriptor ("classes meeting their mean target")
 */
export function computeClassMeanMetrics(settings, actuals = [], year) {
  const y = year || getAcademicYear(settings);
  const levels = getClassLevels(settings);
  const table = getClassMeanTargets(settings, y);
  const fallback = getTargets(settings).defaultClassMean;

  const rows = (actuals || []).map((a) => {
    const level = classLevelOf(a.name, levels);
    const explicit = Number(table[level]);
    const target = Number.isFinite(explicit) && explicit > 0 ? explicit : fallback;
    const mean = Number(a.mean) || 0;
    const pct = target > 0 ? clampPct((mean / target) * 100) : 0;
    const gap = mean - target;
    return {
      ...a,
      level,
      mean,
      target,
      gap,
      pct,
      met: mean >= target,
      hasExplicitTarget: Number.isFinite(explicit) && explicit > 0,
      status: toneFor(pct),
    };
  });

  const total = rows.length;
  const met = rows.filter((r) => r.met).length;
  const sorted = [...rows].sort((a, b) => a.gap - b.gap);

  return {
    year: y,
    rows,
    met,
    total,
    pct: total > 0 ? (met / total) * 100 : 0,
    worst: sorted[0] || null,
    best: sorted[sorted.length - 1] || null,
    rollup: metric('Classes meeting mean target', met, total, {
      unit: 'classes',
      caption: total > 0
        ? `${met} of ${total} class${total === 1 ? '' : 'es'} at or above their ${y} mean target`
        : 'No classes with marks yet',
    }),
  };
}

/* ─────────────────────── Expected enrolment (termly) ─────────────────────
 * How many students the school SHOULD have, against how many it actually
 * has. Two figures matter and they answer different questions:
 *
 *   · general  — settings.targets.enrolmentCapacity: the most the school can
 *                hold. A ceiling; exceeding it is a problem.
 *   · termly   — settings.targets.expectedEnrolment[year][term]: how many it
 *                planned for THIS term. A plan; falling short is a problem.
 *
 * Shape: expectedEnrolment = { "2026": { "Term 1": 820, "Term 2": 835, ... } }
 * ------------------------------------------------------------------------ */

export const TERMS = ['Term 1', 'Term 2', 'Term 3'];

/** The term targets are keyed by. Falls back to the school's current term. */
export function getCurrentTerm(settings) {
  const t = settings?.currentTerm;
  return TERMS.includes(t) ? t : TERMS[0];
}

/** All termly expected figures for a year: { 'Term 1': n, … }. */
export function getExpectedEnrolmentTable(settings, year) {
  const y = year || getAcademicYear(settings);
  return { ...((settings?.targets?.expectedEnrolment || {})[y] || {}) };
}

/**
 * Expected students for one term, falling back to the general capacity and
 * then to 0 (meaning "not set").
 */
export function getExpectedEnrolment(settings, year, term) {
  const table = getExpectedEnrolmentTable(settings, year);
  const v = Number(table[term || getCurrentTerm(settings)]);
  if (Number.isFinite(v) && v > 0) return v;
  return Number(getTargets(settings).enrolmentCapacity) || 0;
}

/**
 * Actual enrolment against what was planned for the term, plus the general
 * capacity picture.
 *
 * @returns {{ actual, expected, term, year, variance, pct, status, capacity,
 *             capacityPct, overCapacity, rollup }}
 */
export function computeEnrolmentMetrics(settings, actualCount, year, term) {
  const y = year || getAcademicYear(settings);
  const t = term || getCurrentTerm(settings);
  const actual = Number(actualCount) || 0;
  const expected = getExpectedEnrolment(settings, y, t);
  const capacity = Number(getTargets(settings).enrolmentCapacity) || 0;

  const variance = actual - expected;               // negative = short
  const pct = expected > 0 ? clampPct((actual / expected) * 100) : 0;
  const capacityPct = capacity > 0 ? clampPct((actual / capacity) * 100) : 0;
  const overCapacity = capacity > 0 && actual > capacity;

  // Being short is the problem this metric exists to surface; being over
  // capacity is a different problem and is flagged separately.
  let status = 'success';
  if (expected > 0) {
    if (pct >= 100) status = 'success';
    else if (pct >= 95) status = 'primary';
    else if (pct >= 85) status = 'warning';
    else status = 'danger';
  } else {
    status = 'secondary';
  }
  if (overCapacity) status = 'danger';

  return {
    actual, expected, capacity, term: t, year: y,
    variance, pct, capacityPct, overCapacity, status,
    rollup: metric('Students enrolled', actual, expected, {
      unit: 'students',
      caption: expected > 0
        ? `${actual} of ${expected} expected for ${t}${variance < 0 ? ` · ${Math.abs(variance)} short` : variance > 0 ? ` · ${variance} over plan` : ''}`
        : `${actual} enrolled — no ${t} target set`,
    }),
  };
}

/** Merge a school's saved targets over the defaults. */
export function getTargets(settings) {
  const saved = settings?.targets || {};
  const out = { ...DEFAULT_TARGETS };
  Object.keys(DEFAULT_TARGETS).forEach((k) => {
    const v = Number(saved[k]);
    if (saved[k] !== undefined && saved[k] !== '' && !Number.isNaN(v)) out[k] = v;
  });
  return out;
}

const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/** Tone for a "higher is better" metric. */
function toneFor(pct) {
  if (pct >= 100) return 'success';
  if (pct >= 80) return 'primary';
  if (pct >= 50) return 'warning';
  return 'danger';
}

/** Tone for a "lower is better" metric (queues, arrears, open cases). */
function toneForCeiling(current, ceiling) {
  if (current <= ceiling) return 'success';
  if (current <= ceiling + 3) return 'warning';
  return 'danger';
}

/**
 * Build one metric descriptor.
 * `current` and `target` are in the metric's own unit; pct is progress to target.
 */
function metric(label, current, target, { unit = '', lowerIsBetter = false, caption } = {}) {
  const t = Number(target) || 0;
  const c = Number(current) || 0;
  let pct;
  let status;
  if (lowerIsBetter) {
    // At or under the ceiling is 100%. Above it, degrade toward 0.
    pct = c <= t ? 100 : clampPct(100 - ((c - t) / Math.max(1, c)) * 100);
    status = toneForCeiling(c, t);
  } else {
    pct = t > 0 ? clampPct((c / t) * 100) : (c > 0 ? 100 : 0);
    status = toneFor(pct);
  }
  return { label, current: c, target: t, unit, pct, status, lowerIsBetter, caption, met: lowerIsBetter ? c <= t : c >= t };
}

/**
 * Resolve every target against live data.
 *
 * Pass whatever you have — each metric is computed independently and any
 * missing input just yields a zeroed metric rather than throwing, so a
 * dashboard can ask for the whole set and use the two or three it needs.
 *
 * @param {object} input
 * @param {object} input.settings     school settings (holds saved targets)
 * @param {Array}  input.students     active students
 * @param {Array}  input.teachers     staff/teacher records
 * @param {Array}  input.classes      expanded class/stream names
 * @param {object} input.timetables   { [className]: grid }
 * @param {Array}  input.subjects     curriculum subject list
 * @param {number} input.collected    fees collected (KES)
 * @param {number} input.billed       fees billed/expected (KES)
 * @param {number} input.admittedThisYear  new admissions so far
 * @param {number} input.marksCompletionPct already-computed marks completion
 * @param {number} input.attendancePct      already-computed attendance rate
 * @param {number} input.staffPresentPct    already-computed staff attendance
 * @param {Array}  input.classMeans   [{ name, mean, students }] actual mean per
 *                                    class/stream — measured against that
 *                                    class's own yearly target
 * @param {string} input.year         academic year for the mean targets
 * @param {number} input.openActions        pending decisions
 * @param {number} input.openDiscipline     open discipline cases
 */
export function computeTargetMetrics(input = {}) {
  const {
    settings, students = [], teachers = [], classes = [], timetables = {},
    subjects = [], collected = 0, billed = 0, admittedThisYear,
    marksCompletionPct, attendancePct, staffPresentPct,
    classMeans = [], year,
    openActions, openDiscipline,
  } = input;

  const T = getTargets(settings);

  // Per-class mean targets for the year (see computeClassMeanMetrics).
  const classMeanMetrics = computeClassMeanMetrics(settings, classMeans, year);
  const classList = (classes || []).filter(Boolean);
  const classCount = classList.length;

  // ── Fees ────────────────────────────────────────────────────────────────
  const collectionRate = billed > 0 ? (collected / billed) * 100 : 0;

  // ── Enrolment: admissions against target (falls back to capacity) ───────
  const admitted = admittedThisYear !== undefined
    ? Number(admittedThisYear)
    : students.filter((s) => {
        const d = s.admission_date || s.created_at || s.date_joined;
        return d && new Date(d).getFullYear() === new Date().getFullYear();
      }).length;
  const admissionGoal = T.admissionTarget > 0 ? T.admissionTarget : T.enrolmentCapacity;

  // ── Timetables: every class should have one ─────────────────────────────
  const classesWithTimetable = classList.filter((c) => {
    const grid = timetables?.[c];
    if (!grid) return false;
    if (Array.isArray(grid)) return grid.length > 0;
    return Object.keys(grid).length > 0;
  }).length;
  const timetablePct = classCount > 0 ? (classesWithTimetable / classCount) * 100 : 0;

  // ── Teacher allocation ──────────────────────────────────────────────────
  // A class is covered when some teacher lists it in assignedClass.
  const assignedClassSet = new Set();
  (teachers || []).forEach((t) => {
    const a = t.assignedClass ?? t.assigned_class;
    if (!a) return;
    (Array.isArray(a) ? a : String(a).split(',')).forEach((c) => {
      const name = String(c).trim();
      if (name) assignedClassSet.add(name);
    });
  });
  const classesWithTeacher = classList.filter((c) => assignedClassSet.has(c)).length;
  const classTeacherPct = classCount > 0 ? (classesWithTeacher / classCount) * 100 : 0;

  // Subject-level allocation: how many class×subject slots have a teacher who
  // teaches that subject. Approximate but useful as a coverage signal.
  const subjectList = (subjects || []).filter(Boolean);
  const totalSlots = classCount * subjectList.length;
  const teachableSubjects = new Set();
  (teachers || []).forEach((t) => {
    if (Array.isArray(t.subjects)) t.subjects.forEach((s) => s && teachableSubjects.add(s));
    if (t.subject) teachableSubjects.add(t.subject);
    if (t.dept) teachableSubjects.add(t.dept);
  });
  const coveredSlots = classCount * subjectList.filter((s) => teachableSubjects.has(s)).length;
  const subjectAllocPct = totalSlots > 0 ? (coveredSlots / totalSlots) * 100 : 0;

  return {
    targets: T,

    fees: metric('Fee collection rate', collectionRate, T.feeCollectionRate, {
      unit: '%', caption: `${Math.round(collectionRate)}% of billed fees collected`,
    }),

    admissions: metric('Students admitted', admitted, admissionGoal, {
      unit: 'students',
      caption: admissionGoal > 0
        ? `${admitted} of ${admissionGoal} targeted admissions`
        : `${admitted} admitted this year — no target set`,
    }),

    enrolment: metric('Enrolment', students.length, T.enrolmentCapacity, {
      unit: 'students',
      caption: T.enrolmentCapacity > 0
        ? `${students.length} of ${T.enrolmentCapacity} places filled`
        : `${students.length} students enrolled`,
    }),

    timetables: metric('Timetable coverage', timetablePct, T.timetableCoverage, {
      unit: '%',
      caption: `${classesWithTimetable} of ${classCount} class${classCount === 1 ? '' : 'es'} have a timetable`,
    }),

    classTeachers: metric('Class-teacher coverage', classTeacherPct, T.classTeacherCoverage, {
      unit: '%',
      caption: `${classesWithTeacher} of ${classCount} class${classCount === 1 ? '' : 'es'} have a class teacher`,
    }),

    subjectAllocation: metric('Subject allocation', subjectAllocPct, T.subjectAllocation, {
      unit: '%',
      caption: `${Math.round(subjectAllocPct)}% of class-subject slots have a teacher`,
    }),

    // Mean is measured per class, not school-wide. `classMeanMetrics` holds the
    // per-class rows; `meanScore` here is the rollup — how many classes are at
    // or above their own target.
    classMeans: classMeanMetrics,
    meanScore: classMeanMetrics.rollup,

    marksCompletion: metric('Marks completion', marksCompletionPct ?? 0, T.marksCompletion, { unit: '%' }),

    attendance: metric('Student attendance', attendancePct ?? 0, T.attendanceRate, { unit: '%' }),

    staffAttendance: metric('Staff attendance', staffPresentPct ?? 0, T.staffAttendanceRate, { unit: '%' }),

    openActions: metric('Open actions', openActions ?? 0, T.openActionsCeiling, {
      unit: 'items', lowerIsBetter: true,
    }),

    discipline: metric('Open discipline cases', openDiscipline ?? 0, T.disciplineCeiling, {
      unit: 'cases', lowerIsBetter: true,
    }),

    // Raw counts dashboards often want alongside the metrics.
    raw: {
      classCount, classesWithTimetable, classesWithTeacher,
      admitted, collectionRate,
    },
  };
}

/** Format a metric's current value for display. */
export function formatMetric(m) {
  if (!m) return '—';
  if (m.unit === '%') return `${m.current.toFixed(1)}%`;
  return String(Math.round(m.current));
}
