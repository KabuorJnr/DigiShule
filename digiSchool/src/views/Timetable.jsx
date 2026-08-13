import { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '../components/Modal';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { SUBJECTS, DEPARTMENTS, getSubjectMeta, expandClassesWithStreams, getDynamicClasses, CLASSES, getDeptColor, DEFAULT_DEPARTMENTS } from '../data/seed';
import { downloadExcel, exportTimetableLandscapePDF, exportAllTimetablesPDF } from '../utils/exporters';
import {
  TIMESLOT_TYPES, defaultConstraints, defaultAssignments, patternTimeslots,
  annotateTimeslots, buildEmptyGrid, generateAll,
} from '../utils/timetableEngine';
import { reportError } from '../lib/errorReporter';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export function formatTeacherFirstName(name) {
  if (!name || name === 'TBD' || name === '-') return '';
  const cleaned = name.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').trim();
  return cleaned.split(/\s+/)[0] || name;
}

// Compact teacher tag: first-name initial + surname (e.g. "Alan Otieno" -> "AOtieno").
export function teacherAbbr(name) {
  if (!name || name === 'TBD' || name === '-') return '';
  const clean = name.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').trim();
  const toks = clean.split(/\s+/).filter(Boolean);
  if (toks.length >= 2) {
    const surname = toks[toks.length - 1];
    return toks[0][0].toUpperCase() + surname.charAt(0).toUpperCase() + surname.slice(1);
  }
  return clean.slice(0, 8);
}

// A translucent background derived from the subject colour.
const tint = (hex) => (hex || '#64748b') + '22';

// A subject is "offered" by a class when it carries at least one lesson.
const isOfferedAssignment = (a) => Number(a?.singles || 0) > 0 || Number(a?.doubles || 0) > 0;
// Sensible weekly singles to seed when a subject is switched ON (mirrors the
// auto-assigner: core languages/maths get 5, everything else 4).
const defaultSinglesFor = (sub = '') => (/math|english|kiswahili/i.test(sub) ? 5 : 4);

// Guarantee a class's assignment table has a row for EVERY school subject.
// Existing rows (teacher / singles / doubles the DoS filled in) are preserved
// verbatim; only the missing subjects are appended. An empty/absent table is
// seeded from scratch. This is the single source of truth used by every effect
// that (re)loads assignments, so a subject added in Settings can never be
// silently dropped when saved assignments are reloaded.
function completeAssignments(table, subjects, teachers, className) {
  const base = Array.isArray(table) ? table : [];
  if (base.length === 0) return defaultAssignments(teachers, subjects, className);
  const existing = new Set(base.map((a) => a.subject));
  const missing = (subjects || []).filter((s) => !existing.has(s));
  if (missing.length === 0) return base;
  const pool = teachers && teachers.length ? teachers : [];
  const extras = missing.map((sub, i) => ({
    subject: sub,
    teacher: pool.length ? pool[(existing.size + i) % pool.length].name : 'TBD',
    singles: 4,
    doubles: 0,
  }));
  return [...base, ...extras];
}

export default function Timetable({ store, user }) {
  const isTimetableAdmin = ['deputy_admin', 'deputy_academic', 'dos', 'principal'].includes(user?.role);
  const { timetables, setTimetables, notify, settings, teachers } = store;

  // Only the classes an admin has explicitly added in Settings → Academic.
  // Fallback to students' classes, then seed classes.
  const dynamicClasses = useMemo(() => {
    let classes = expandClassesWithStreams(store.settings?.classes || []);
    if (classes.length === 0 && store.students && store.students.length > 0) {
      classes = getDynamicClasses(store.students);
    }
    if (classes.length === 0) {
      classes = CLASSES;
    }
    return classes;
  }, [store.settings, store.students]);

  // The school's own subject list (from Settings → Academic). Falls back to
  // the seed only if the school hasn't configured any yet. This is the ONE
  // place the timetable pulls subject names from — everything else in this
  // view (legends, edit-cell dropdowns, "not to follow" pairs) reads from
  // `schoolSubjects`, so an admin adding "French" in Settings sees it here
  // immediately.
  const schoolSubjects = useMemo(() => {
    const raw = store.settings?.subjects;
    if (Array.isArray(raw) && raw.length) {
      // Settings stores [{name, dept}] objects; extract names, unique + defined.
      const names = raw.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
      return names.length ? [...new Set(names)] : SUBJECTS;
    }
    return SUBJECTS;
  }, [store.settings]);

  // Keep the raw [{name, dept}] array for department-aware lookups
  const schoolSubjectsRaw = useMemo(() => {
    const raw = store.settings?.subjects;
    return Array.isArray(raw) && raw.length ? raw : null;
  }, [store.settings]);

  // Dynamic department list from settings
  const schoolDepts = useMemo(() => {
    return store.settings?.departments?.length > 0 ? store.settings.departments : DEFAULT_DEPARTMENTS;
  }, [store.settings?.departments]);

  const [term, setTerm] = useState('Term 2');
  const [cls, setCls] = useState(dynamicClasses[0] || '');
  const [tab, setTab] = useState('class');
  const [teacherSel, setTeacherSel] = useState(teachers?.[0]?.name || '');

  // NEW: Timetable Type (Standard vs Remedial)
  const [ttType, setTtType] = useState('Standard');
  const actualCls = ttType === 'Remedial' ? `${cls} (Remedial)` : cls;

  // ---- Typed timeslots ----------------------------------------------------
  const [timeslots, setTimeslots] = useState(() => {
    const key = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
    const saved = settings?.[key];
    return Array.isArray(saved) && saved.length ? saved : patternTimeslots(settings?.timetable_schedule);
  });
  const annotated = useMemo(() => annotateTimeslots(timeslots), [timeslots]);
  // Teaching slots carry their original row index (position in the full timeslot list).
  const teachingSlots = useMemo(() => annotated.map((a, i) => ({ ...a, _rowIndex: i })).filter((a) => a.teaching), [annotated]);
  const [timeslotModal, setTimeslotModal] = useState(false);

  // ---- Constraints --------------------------------------------------------
  const [constraints, setConstraints] = useState(() => {
    const key = ttType === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
    return { ...defaultConstraints, ...(settings?.[key] || {}) };
  });
  const [constraintsModal, setConstraintsModal] = useState(false);

  // ---- Per-class assignments (singles + doubles) --------------------------
  const [assignmentsByClass, setAssignmentsByClass] = useState(() => {
    const key = ttType === 'Remedial' ? 'remedial_timetable_assignments' : 'timetable_assignments';
    return settings?.[key] || {};
  });
  const [genClass, setGenClass] = useState(dynamicClasses[0] || '');
  const genAssignments = assignmentsByClass[genClass] || [];
  const setGenAssignments = (updater) =>
    setAssignmentsByClass((prev) => {
      const current = prev[genClass] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [genClass]: next };
    });

  const [workingDays, setWorkingDays] = useState(DAYS.map(() => true));
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editCell, setEditCell] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [unplaced, setUnplaced] = useState([]);

  // Sync state when ttType or settings change
  useEffect(() => {
    const tsKey = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
    const savedTs = settings?.[tsKey];
    setTimeslots(Array.isArray(savedTs) && savedTs.length ? savedTs : patternTimeslots(settings?.timetable_schedule));

    const conKey = ttType === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
    setConstraints({ ...defaultConstraints, ...(settings?.[conKey] || {}) });

    const assKey = ttType === 'Remedial' ? 'remedial_timetable_assignments' : 'timetable_assignments';
    setAssignmentsByClass(settings?.[assKey] || {});
  }, [ttType, settings]);

  const activeDays = DAYS.filter((_, i) => workingDays[i]);
  const tt = timetables[actualCls];
  const hasGenerated = Object.keys(timetables).length > 0 && tt;

  const allConflicts = useMemo(() => {
    if (!hasGenerated) return [];
    const confs = [];
    const seen = {};
    dynamicClasses.forEach((c) => {
      const checkCls = ttType === 'Remedial' ? `${c} (Remedial)` : c;
      const grid = timetables[checkCls]?.grid;
      if (!grid) return;
      grid.forEach((row, p) => {
        row.forEach((cell, d) => {
          if (cell && cell.type === 'lesson' && cell.teacher !== 'TBD' && cell.teacher) {
            const key = `${p}-${d}-${cell.teacher}`;
            if (seen[key]) {
              confs.push({ p, d, teacher: cell.teacher, classes: [seen[key], c] });
            } else {
              seen[key] = c;
            }
          }
        });
      });
    });
    return confs;
  }, [timetables, dynamicClasses, hasGenerated]);

  // Seed a default assignment table for any class that doesn't have one yet,
  // AND merge newly-added school subjects into existing assignment tables so
  // adding "French" in Settings surfaces here immediately without wiping the
  // rows the DoS already filled in.
  useEffect(() => {
    if (!teachers || teachers.length === 0 || dynamicClasses.length === 0) return;
    setAssignmentsByClass((prev) => {
      const next = { ...prev };
      let changed = false;
      dynamicClasses.forEach((c) => {
        const completed = completeAssignments(next[c], schoolSubjects, teachers, c);
        if (completed !== next[c]) { next[c] = completed; changed = true; }
      });
      return changed ? next : prev;
    });
    setTeacherSel((prev) => prev || teachers[0].name);
  }, [teachers, dynamicClasses, schoolSubjects]);

  useEffect(() => { if (!dynamicClasses.includes(cls)) setCls(dynamicClasses[0] || ''); }, [dynamicClasses, cls]);
  useEffect(() => { if (!dynamicClasses.includes(genClass)) setGenClass(dynamicClasses[0] || ''); }, [dynamicClasses, genClass]);

  // Sync state when ttType (or the specific settings slice for this type) changes.
  // We depend on the individual slices, not the whole settings object — that
  // avoids overwriting unsaved local edits whenever an unrelated settings key
  // changes (e.g. a realtime refetch triggered by another module).
  const tsKey = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
  const constrKey = ttType === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
  const assignKey = ttType === 'Remedial' ? 'remedial_timetable_assignments' : 'timetable_assignments';
  const savedTs = settings?.[tsKey];
  const savedConstr = settings?.[constrKey];
  const savedAssign = settings?.[assignKey];
  useEffect(() => {
    setTimeslots(Array.isArray(savedTs) && savedTs.length ? savedTs : patternTimeslots(settings?.timetable_schedule));
    setConstraints({ ...defaultConstraints, ...(savedConstr || {}) });
    if (savedAssign && Object.keys(savedAssign).length) {
      // Reloading the saved table must NOT drop subjects added in Settings after
      // the assignments were last saved. Complete every class against the current
      // school subject list before applying, otherwise this reload would clobber
      // the subject-merge above and only the saved subjects would ever show.
      const completed = {};
      Object.keys(savedAssign).forEach((c) => {
        completed[c] = completeAssignments(savedAssign[c], schoolSubjects, teachers, c);
      });
      // Also seed any settings-class that has no saved table yet, so switching
      // Type never leaves a class with an empty subject list.
      dynamicClasses.forEach((c) => {
        if (!completed[c]) completed[c] = completeAssignments(null, schoolSubjects, teachers, c);
      });
      setAssignmentsByClass(completed);
    }
  }, [ttType, savedTs, savedConstr, savedAssign, schoolSubjects, teachers, dynamicClasses, settings?.timetable_schedule]);

  async function persist(patch) {
    try { const { updateSettings } = await import('../lib/api'); await updateSettings(patch); }
    catch (e) { /* saved locally; server sync will retry */ }
  }

  // --- Auto-Save on Page Leave ---
  const stateRef = useRef({ assignmentsByClass, constraints, timeslots, ttType });
  useEffect(() => {
    stateRef.current = { assignmentsByClass, constraints, timeslots, ttType };
  }, [assignmentsByClass, constraints, timeslots, ttType]);

  useEffect(() => {
    const doSave = () => {
      const { assignmentsByClass: a, constraints: c, timeslots: t, ttType: type } = stateRef.current;
      const tsKey = type === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
      const constrKey = type === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
      const assignKey = type === 'Remedial' ? 'remedial_timetable_assignments' : 'timetable_assignments';
      // We use fire-and-forget here because this might happen on unmount
      import('../lib/api').then(({ updateSettings }) => {
        updateSettings({ [assignKey]: a, [constrKey]: c, [tsKey]: t }).catch((e) => reportError(e, 'views.Timetable'));
      }).catch((e) => reportError(e, 'views.Timetable'));
    };

    const handleBeforeUnload = () => doSave();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      doSave();
    };
  }, []);

  function copyAssignmentsToAll() {
    setAssignmentsByClass((prev) => {
      const source = prev[genClass] || [];
      const next = { ...prev };
      dynamicClasses.forEach((c) => { next[c] = source.map((a) => ({ ...a })); });
      return next;
    });
    notify(`Assignments copied to all ${dynamicClasses.length} classes`, 'success', 'Timetable');
  }

  // ---- Validation: required lessons vs available teaching slots -----------
  const validation = useMemo(() => {
    const available = teachingSlots.length * activeDays.length;
    return dynamicClasses.map((c) => {
      const rows = assignmentsByClass[c] || [];
      const required = rows.reduce((n, a) => n + Number(a.singles || 0) + 2 * Number(a.doubles || 0), 0);
      return { cls: c, required, available, ok: required <= available };
    });
  }, [dynamicClasses, assignmentsByClass, teachingSlots, activeDays]);
  const anyOverbooked = validation.some((v) => !v.ok);

  function handleGenerate() {
    if (activeDays.length === 0) return notify('Select at least one working day', 'warning', 'Timetable');
    if (teachingSlots.length === 0) return notify('Add at least one Normal timeslot', 'warning', 'Timetable');
    setGenerating(true);
    setProgress(0);
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1500) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        const { result, unplaced: missed } = generateAll({
          classes: dynamicClasses,
          days: activeDays,
          timeslots,
          assignmentsByClass,
          constraints: { ...constraints, blockDepartments: settings?.block_departments || [] },
          term,
        });
        let finalResult = result;
        if (ttType === 'Remedial') {
          finalResult = {};
          for (const key in result) {
            finalResult[`${key} (Remedial)`] = result[key];
          }
        }

        // Prune stale grids: drop any previously-saved timetable of the type we're
        // generating whose class is no longer in the school's settings (e.g. a class
        // that was removed after an earlier generation). The OTHER type is left
        // untouched, so generating Standard never wipes saved Remedial grids.
        const REMEDIAL_SUFFIX = ' (Remedial)';
        setTimetables(prev => {
          const kept = {};
          for (const key of Object.keys(prev)) {
            const isRemedial = key.endsWith(REMEDIAL_SUFFIX);
            const base = isRemedial ? key.slice(0, -REMEDIAL_SUFFIX.length) : key;
            const sameType = (ttType === 'Remedial') === isRemedial;
            if (sameType && !dynamicClasses.includes(base)) continue; // stale — drop
            kept[key] = prev[key];
          }
          return { ...kept, ...finalResult };
        });
        setUnplaced(missed);
        setGenerating(false);
        
        const tsKey = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
        const constrKey = ttType === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
        const assignKey = ttType === 'Remedial' ? 'remedial_timetable_assignments' : 'timetable_assignments';
        persist({ [assignKey]: assignmentsByClass, [constrKey]: constraints, [tsKey]: timeslots });
        if (missed.length) {
          const total = missed.reduce((n, m) => n + m.count, 0);
          notify(`Timetable generated, but ${total} lesson${total > 1 ? 's' : ''} could not be placed`, 'warning', 'Timetable');
        } else {
          notify('Timetable generated for all classes', 'success', 'Timetable');
        }
      }
    }, 50);
  }

  function hasConflict(cell, rowIdx, dayIdx) {
    if (!cell || cell.type !== 'lesson') return false;
    return dynamicClasses.some((c) => {
      if (c === cls) return false;
      const checkCls = ttType === 'Remedial' ? `${c} (Remedial)` : c;
      const oc = timetables[checkCls]?.grid[rowIdx]?.[dayIdx];
      return oc && oc.type === 'lesson' && oc.teacher === cell.teacher;
    });
  }

  function saveCell(updated) {
    setTimetables((prev) => {
      const copy = { ...prev };
      const baseCls = editCell.cls || cls;
      const targetCls = ttType === 'Remedial' ? `${baseCls} (Remedial)` : baseCls;
      
      if (!copy[targetCls] || !copy[targetCls].grid) return prev;
      
      const grid = copy[targetCls].grid.map((r) => r.slice());
      grid[editCell.p][editCell.d] = {
        type: 'lesson',
        subject: updated.subject,
        teacher: updated.teacher,
        dept: DEPARTMENTS[updated.subject] || 'Humanities',
        notes: updated.notes,
      };
      copy[targetCls] = { ...copy[targetCls], grid };
      return copy;
    });
    setEditCell(null);
    notify('Timetable cell updated', 'success', 'Timetable');
  }

  // Teacher timetable: scan all classes for this teacher, row-aligned to timeslots.
  function teacherGrid() {
    return annotated.map((slot, p) => activeDays.map((_, d) => {
      if (!slot.teaching) return { type: 'break', label: slot.label };
      for (const c of dynamicClasses) {
        const checkCls = ttType === 'Remedial' ? `${c} (Remedial)` : c;
        const cell = timetables[checkCls]?.grid[p]?.[d];
        if (cell && cell.type === 'lesson' && cell.teacher === teacherSel) return { ...cell, cls: c };
      }
      return null;
    }));
  }

  function exportPDF() {
    if (!tt) return notify('Generate a timetable first', 'warning');

    const schoolName = settings?.name || 'School';
    const year = settings?.academicYear || settings?.year || String(new Date().getFullYear());
    const pdfTitle = `${schoolName} Timetable ${term}: ${year}`;

    if (tab === 'teacher') {
      // Teacher timetable: same page-filling landscape grid, class per cell.
      const tgrid = teacherGrid().map((row) => row.map((c) => c || { type: 'empty' }));
      exportTimetableLandscapePDF({
        title: pdfTitle,
        schoolName,
        classLabel: teacherSel,
        grid: tgrid,
        days: activeDays,
        slots: annotated,
        filename: `timetable-teacher-${teacherSel}.pdf`,
        variant: 'teacher',
      });
      notify('Teacher timetable exported as PDF', 'success', 'Export');
      return;
    }

    // Class + Master export the current class as a landscape grid.
    exportTimetableLandscapePDF({
      title: pdfTitle,
      schoolName,
      classLabel: actualCls.replace(/\s+/g, ''),
      grid: tt.grid,
      days: tt.days,
      slots: annotated,
      filename: `timetable-${actualCls}-${term}.pdf`,
      variant: 'class',
      teacherAbbrOf: teacherAbbr,
    });
    notify('Timetable exported as PDF', 'success', 'Export');
  }

  function exportAllPDF() {
    // Only export the classes that exist in the school's settings, and only the
    // timetable TYPE that's currently selected. Remedial grids are excluded from a
    // Standard bulk export (and vice-versa) — switching the Type toggle to Remedial
    // is the explicit opt-in for exporting remedial timetables. This also drops any
    // stale grids for classes that are no longer in Settings.
    const subset = {};
    dynamicClasses.forEach((c) => {
      const key = ttType === 'Remedial' ? `${c} (Remedial)` : c;
      if (timetables[key]?.grid) subset[key] = timetables[key];
    });

    if (Object.keys(subset).length === 0) {
      return notify(`No ${ttType.toLowerCase()} timetables to export — generate them first`, 'warning', 'Export');
    }

    exportAllTimetablesPDF({
      timetables: subset,
      days: activeDays,
      slots: annotated,
      teacherAbbrOf: teacherAbbr,
      schoolName: settings?.name || 'DigiSchool',
      filename: ttType === 'Remedial' ? 'All_Classes_Remedial_Timetables.pdf' : 'All_Classes_Timetables.pdf',
    });
    notify(`All ${ttType.toLowerCase()} class timetables exported as PDF`, 'success', 'Export');
  }

  function exportExcel() {
    if (!tt) return notify('Generate a timetable first', 'warning');
    const aoa = [['Period', ...activeDays]];
    if (tab === 'teacher') {
      teacherGrid().forEach((row, p) => {
        aoa.push([annotated[p].label, ...row.map((c) => (c && c.type === 'lesson' ? `${c.subject} / ${c.cls}` : c && c.type === 'break' ? c.label : ''))]);
      });
    } else {
      tt.grid.forEach((row, p) => {
        aoa.push([annotated[p].label, ...row.map((c) => (c.type === 'break' ? c.label : c.type === 'lesson' ? `${c.subject} / ${c.teacher}` : ''))]);
      });
    }
    const sheetName = tab === 'teacher' ? teacherSel.slice(0, 31) : `${actualCls}`.slice(0, 31);
    const filename = tab === 'teacher' ? `timetable-${teacherSel}.xlsx` : `timetable-${actualCls}-${term}.xlsx`;
    downloadExcel(filename, [{ name: sheetName, aoa }]);
    notify('Timetable exported as Excel', 'success', 'Export');
  }

  // Build live timetable grids from parsed CSV rows and persist them.
  function importCsv({ headers, rows, mapping }) {
    const col = (f) => headers.indexOf(mapping[f]);
    const ci = col('class'), si = col('subject'), ti = col('teacher'), pi = col('period'), di = col('day');
    if (si < 0 || pi < 0 || di < 0) return notify('Map at least the Subject, Period and Day columns', 'warning', 'Import');

    const dayKey = (v) => (v || '').toString().trim().slice(0, 3).toLowerCase();
    const dayIndex = {}; activeDays.forEach((d, i) => { dayIndex[dayKey(d)] = i; });
    const norm = (v) => (v || '').toString().replace(/[^a-z0-9]/gi, '').toLowerCase();
    const classByNorm = {}; dynamicClasses.forEach((c) => { classByNorm[norm(c)] = c; });
    const rowByPeriod = {}; annotated.forEach((a, idx) => { if (a.teaching) rowByPeriod[a.period] = idx; });

    const map = {};
    dynamicClasses.forEach((c) => { map[c] = { grid: buildEmptyGrid(annotated, activeDays.length), timeslots, days: activeDays, periods: teachingSlots.length, term }; });

    let placed = 0, skipped = 0;
    rows.forEach((r) => {
      const c = ci >= 0 ? classByNorm[norm(r[ci])] : dynamicClasses[0];
      const dIdx = dayIndex[dayKey(r[di])];
      const pNum = parseInt(String(r[pi]).replace(/[^0-9]/g, ''), 10);
      const rowIdx = rowByPeriod[pNum];
      const subject = (r[si] || '').trim();
      const teacher = ti >= 0 ? (r[ti] || '').trim() : 'TBD';
      if (!c || dIdx === undefined || rowIdx === undefined || !subject) { skipped++; return; }
      map[c].grid[rowIdx][dIdx] = { type: 'lesson', subject, teacher: teacher || 'TBD', dept: DEPARTMENTS[subject] || 'Humanities', notes: '' };
      placed++;
    });

    setTimetables(map);
    setUnplaced([]);
    setImportOpen(false);
    notify(`Imported ${placed} lesson(s)${skipped ? `, skipped ${skipped}` : ''}`, placed ? 'success' : 'warning', 'Import');
  }

  const cellStyle = (cell) => {
    if (cell.isBlock) {
      const color = getDeptColor(cell.dept) || '#64748b';
      return { background: tint(color), borderLeft: `3px solid ${color}` };
    }
    const meta = getSubjectMeta(cell.subject, schoolSubjectsRaw);
    return { background: tint(meta.color), borderLeft: `3px solid ${meta.color}` };
  };

  return (
    <div>
      <PageHeader
        title="Timetable Management"
        subtitle="Generate, edit and export class, teacher & master timetables"
        actions={
          <>
            {isTimetableAdmin && <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}><Icon name="settings" size={16} /> Generate Timetable</button>}
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
            <button className="btn" onClick={exportAllPDF} title={`Export every ${ttType} class timetable in the school`}><Icon name="file" size={16} /> Bulk Export {ttType === 'Remedial' ? 'Remedial ' : ''}PDF</button>
            <button className="btn" onClick={exportExcel}><Icon name="chart" size={16} /> Export Excel</button>
            {isTimetableAdmin && <button className="btn" onClick={() => setImportOpen(true)}><Icon name="download" size={16} /> Import CSV</button>}
          </>
        }
      />

      <div className="toolbar">
        <div>
          <label className="field-label">Type</label>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 4 }}>
            <button className={`btn btn-sm ${ttType === 'Standard' ? 'btn-primary' : ''}`} style={{ background: ttType === 'Standard' ? '' : 'transparent', color: ttType === 'Standard' ? '#fff' : '#64748b', border: 'none', boxShadow: 'none' }} onClick={() => setTtType('Standard')}>Standard</button>
            <button className={`btn btn-sm ${ttType === 'Remedial' ? 'btn-primary' : ''}`} style={{ background: ttType === 'Remedial' ? '' : 'transparent', color: ttType === 'Remedial' ? '#fff' : '#64748b', border: 'none', boxShadow: 'none' }} onClick={() => setTtType('Remedial')}>Remedial</button>
          </div>
        </div>
        <div>
          <label className="field-label">Term</label>
          <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 140 }}>
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Class</label>
                <select className="select" value={tab === 'master' ? 'All Classes' : cls} style={{ width: 140 }} onChange={(e) => {
                  if (e.target.value === 'All Classes') setTab('master');
                  else { setCls(e.target.value); if (tab === 'master') setTab('class'); }
                }}>
                  <option value="All Classes">All Classes (Master)</option>
                  {dynamicClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
        </div>
      </div>

      {/* Generator block */}
      {isTimetableAdmin && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 24, marginBottom: 20, alignItems: 'start' }}>

          {/* Left: Timeslots + Constraints summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-pad" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name="clock" size={20} color="#0284c7" />
                <h3 className="section-title" style={{ margin: 0, color: '#0284c7', fontSize: 16 }}>Timeslots</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, maxHeight: 200, overflowY: 'auto' }}>
                {annotated.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: s.teaching ? '#334155' : '#94a3b8' }}>{s.label}</span>
                    <span className="muted">{s.start}–{s.end}{!s.teaching ? '' : ''}</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{teachingSlots.length} teaching periods/day</div>
              <button className="btn btn-outline" style={{ width: '100%', marginTop: 14, color: '#0ea5e9', borderColor: '#bae6fd', background: '#fff' }} onClick={() => setTimeslotModal(true)}>
                <Icon name="settings" size={16} /> Edit Timeslots
              </button>
            </div>

            <div className="card card-pad" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="shield" size={20} color="#7c3aed" />
                <h3 className="section-title" style={{ margin: 0, color: '#7c3aed', fontSize: 16 }}>Constraints</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {constraints.mathInMorning && <Chip>Math in morning</Chip>}
                {constraints.engKisNotFollow && <Chip>Eng ✕ Kis</Chip>}
                {constraints.mathSciNotFollow && <Chip>Math ✕ Science</Chip>}
                {constraints.freeAfternoonOnly && <Chip>Free = afternoon</Chip>}
                <Chip>Max {constraints.maxPerDay || '∞'}/day</Chip>
                {(constraints.customPairs || []).map((p, i) => <Chip key={i}>{getSubjectMeta(p[0], schoolSubjectsRaw).initials} ✕ {getSubjectMeta(p[1], schoolSubjectsRaw).initials}</Chip>)}
                {Object.values(constraints.teacherTimeOff || {}).some((a) => a.length) && <Chip>Teacher time-off</Chip>}
              </div>
              <button className="btn btn-outline" style={{ width: '100%', marginTop: 14, color: '#7c3aed', borderColor: '#ddd6fe', background: '#fff' }} onClick={() => setConstraintsModal(true)}>
                <Icon name="settings" size={16} /> Edit Constraints
              </button>
            </div>
          </div>

          {/* Right: Generator settings & assignments */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Timetable Generator</h3>
              {generating && <div className="muted" style={{ fontSize: 13 }}>Generating… {Math.round(progress)}%</div>}
            </div>

            <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <label className="field-label">Working Days</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
                  {DAYS.map((d, i) => (
                    <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                      <input type="checkbox" checked={workingDays[i]} onChange={() => setWorkingDays((w) => w.map((x, j) => (j === i ? !x : x)))} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              
              <button className="btn btn-outline btn-sm" style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }} onClick={() => {
                if (window.confirm('This will reset your timeslots to the CBC Grade 10 standard (8 periods x 40 mins). Are you sure?')) {
                  const cbcPattern = { startTime: '08:00', periods: 8, duration: 40, breakAfter: 3, breakDuration: 20, lunchAfter: 6, lunchDuration: 50 };
                  const ts = patternTimeslots(cbcPattern);
                  setTimeslots(ts);
                  setWorkingDays([true, true, true, true, true]);
                  const tsKey = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
                  persist({ [tsKey]: ts });
                  notify('CBC timeslots loaded (40 lessons/week)', 'success', 'Timetable');
                }
              }}>
                Load CBC G10 Timeslots
              </button>
            </div>

            {/* Validation summary */}
            <div style={{ marginBottom: 18, border: `1px solid ${anyOverbooked ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: anyOverbooked ? '#fef2f2' : '#f0fdf4', fontSize: 13, fontWeight: 600, color: anyOverbooked ? '#b91c1c' : '#15803d' }}>
                Lessons vs available slots {anyOverbooked ? '— some classes are overbooked' : '— all classes fit'}
              </div>
              <div className="scroll-x" style={{ maxHeight: 130, overflowY: 'auto' }}>
                <table className="table" style={{ margin: 0, fontSize: 13 }}>
                  <tbody>
                    {validation.map((v) => (
                      <tr key={v.cls}>
                        <td style={{ padding: '4px 12px', fontWeight: 500 }}>{v.cls}</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right' }}>{v.required} / {v.available}</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', color: v.ok ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{v.ok ? 'OK' : `+${v.required - v.available}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="field-label">Lessons for class</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <select className="select" value={genClass} onChange={(e) => setGenClass(e.target.value)} style={{ maxWidth: 200 }}>
                    {dynamicClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {(() => {
                    const total = genAssignments.reduce((n, a) => n + Number(a.singles || 0) + 2 * Number(a.doubles || 0), 0);
                    const avail = teachingSlots.length * activeDays.length;
                    const offered = genAssignments.filter(isOfferedAssignment).length;
                    const ok = total <= avail;
                    return (
                      <span title="Subjects offered · this class's total weekly lessons vs available teaching slots"
                        style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 14, whiteSpace: 'nowrap',
                          background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#15803d' : '#b91c1c', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
                        {offered} subjects · {total}/{avail} {ok ? '✓ fits' : `over by ${total - avail}`}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => {
                  if (window.confirm(`Auto-assign teachers for ${genClass} based on their profile subjects and classes? This will overwrite current assignments for this class.`)) {
                    setAssignmentsByClass(prev => ({
                      ...prev,
                      [genClass]: defaultAssignments(teachers, schoolSubjects, genClass)
                    }));
                    notify(`Auto-assigned teachers for ${genClass}`, 'success', 'Timetable');
                  }
                }}>
                  <Icon name="users" size={14} /> Auto-Assign
                </button>
                <button className="btn btn-outline" style={{ fontSize: 13, color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }} onClick={() => {
                  if (window.confirm(`Load strict KICD Grade 10 lesson allocations for ${genClass}?`)) {
                    // KICD standard: 40 lessons total.
                    const cbcCounts = {
                      'English': 5,
                      'Kiswahili': 5,
                      'Kenya Sign Language': 5,
                      'Mathematics - Core': 5,
                      'Mathematics - Essential': 5,
                      'Community Service Learning': 3,
                      'Physical Education': 3,
                      'ICT Skills': 2,
                      'PPI': 1,
                      'Learner Personal Study': 1,
                    };
                    
                    // Reuse the load-balanced assigner so teachers are spread
                    // across the staff; electives (not in the KICD list) default
                    // to 5 singles.
                    const newAssignments = defaultAssignments(
                      teachers, schoolSubjects, genClass,
                      (sub) => (cbcCounts[sub] !== undefined ? cbcCounts[sub] : 5)
                    );

                    setAssignmentsByClass(prev => ({
                      ...prev,
                      [genClass]: newAssignments
                    }));
                    notify(`CBC Grade 10 allocations loaded for ${genClass}`, 'success', 'Timetable');
                  }
                }}>
                  <Icon name="file-text" size={14} /> Load CBC G10
                </button>
                <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={copyAssignmentsToAll} disabled={dynamicClasses.length < 2}>
                  <Icon name="clipboard" size={14} /> Copy to all classes
                </button>
                <button className="btn btn-outline" style={{ fontSize: 13, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => {
                  if (window.confirm(`Switch OFF every subject for ${genClass}? This sets all lessons to 0 so you can turn on just the subjects this class actually offers.`)) {
                    setGenAssignments((as) => as.map((x) => ({ ...x, singles: 0, doubles: 0 })));
                    notify(`All subjects switched off for ${genClass} — tick the ones it offers`, 'success', 'Timetable');
                  }
                }}>
                  <Icon name="close" size={14} /> Clear all
                </button>
              </div>
            </div>
            <div className="scroll-x" style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }} title="Does this class offer this subject? Unticked subjects get no lessons.">Offered</th>
                    <th style={{ padding: '8px 12px' }}>Subject</th>
                    <th style={{ padding: '8px 12px' }}>Assigned Teacher</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }} title="Single periods / week">Singles</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }} title="Double (consecutive) periods / week">Doubles</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }} title="Total periods / week">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build department grouping from schoolSubjectsRaw
                    const subjectDeptMap = {};
                    if (schoolSubjectsRaw) {
                      schoolSubjectsRaw.forEach(s => {
                        const name = typeof s === 'string' ? s : s?.name;
                        const dept = typeof s === 'string' ? null : s?.dept;
                        if (name) subjectDeptMap[name] = dept;
                      });
                    }
                    // Fallback to hardcoded DEPARTMENTS for known subjects
                    genAssignments.forEach(a => {
                      if (!subjectDeptMap[a.subject]) subjectDeptMap[a.subject] = DEPARTMENTS[a.subject] || null;
                    });

                    const grouped = {};
                    genAssignments.forEach((a, i) => {
                      const dept = subjectDeptMap[a.subject] || 'Other';
                      if (!grouped[dept]) grouped[dept] = [];
                      grouped[dept].push({ ...a, _idx: i });
                    });

                    // Order: known depts first, then 'Other'
                    const orderedDepts = [...schoolDepts.filter(d => grouped[d]), ...Object.keys(grouped).filter(d => !schoolDepts.includes(d))];

                    return orderedDepts.map(dept => [
                      <tr key={`dept-${dept}`}>
                        <td colSpan={6} style={{
                          background: getDeptColor(dept) + '12',
                          padding: '5px 12px', fontWeight: 700, fontSize: 12,
                          color: getDeptColor(dept),
                          borderLeft: `3px solid ${getDeptColor(dept)}`,
                          letterSpacing: 0.3
                        }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: getDeptColor(dept), marginRight: 8 }} />
                          {dept} ({grouped[dept].length})
                        </td>
                      </tr>,
                      ...grouped[dept].map(a => {
                        const meta = getSubjectMeta(a.subject, schoolSubjectsRaw);
                        const total = Number(a.singles || 0) + 2 * Number(a.doubles || 0);
                        const offered = isOfferedAssignment(a);
                        return (
                          <tr key={a.subject} style={{ background: offered ? undefined : '#f8fafc' }}>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input type="checkbox" checked={offered} title={offered ? 'Offered — untick to give this class no lessons in this subject' : 'Not offered — tick to add it to this class'}
                                onChange={(e) => setGenAssignments((as) => as.map((x, j) => {
                                  if (j !== a._idx) return x;
                                  return e.target.checked
                                    ? { ...x, singles: defaultSinglesFor(x.subject), doubles: 0 }
                                    : { ...x, singles: 0, doubles: 0 };
                                }))} />
                            </td>
                            <td style={{ padding: '6px 12px', paddingLeft: 12, fontWeight: 500, opacity: offered ? 1 : 0.5 }}>
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: meta.color, marginRight: 8 }} />
                              {a.subject}
                              {meta.code && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>({meta.code})</span>}
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <select className="select" value={a.teacher} disabled={!offered} style={{ height: 32, fontSize: 13, opacity: offered ? 1 : 0.5 }}
                                onChange={(e) => setGenAssignments((as) => as.map((x, j) => (j === a._idx ? { ...x, teacher: e.target.value } : x)))}>
                                <option value="">-- Select --</option>
                                {(teachers || []).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input className="input" type="number" min="0" max="10" value={a.singles} disabled={!offered} style={{ width: 54, height: 32, textAlign: 'center', fontSize: 13, opacity: offered ? 1 : 0.5 }}
                                onChange={(e) => setGenAssignments((as) => as.map((x, j) => (j === a._idx ? { ...x, singles: e.target.value } : x)))} />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input className="input" type="number" min="0" max="5" value={a.doubles} disabled={!offered} style={{ width: 54, height: 32, textAlign: 'center', fontSize: 13, opacity: offered ? 1 : 0.5 }}
                                onChange={(e) => setGenAssignments((as) => as.map((x, j) => (j === a._idx ? { ...x, doubles: e.target.value } : x)))} />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>{total}</td>
                          </tr>
                        );
                      })
                    ]);
                  })()}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ minWidth: 160 }}>
                {generating ? 'Generating...' : 'Generate New Timetable'}
              </button>
            </div>
            {generating && <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${progress}%`, background: 'var(--primary)' }} /></div>}
          </div>
        </div>
      )}

      {/* Unplaced lessons report */}
      {isTimetableAdmin && unplaced.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#b45309' }}>
            <Icon name="warning" size={18} />
            <strong style={{ fontSize: 14 }}>{unplaced.reduce((n, m) => n + m.count, 0)} lesson(s) could not be placed</strong>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
            No free slot was available (teacher fully booked, daily cap reached, constraint blocked, or too few periods).
            Reduce lessons/week, raise the daily cap, add working days/timeslots, relax constraints, or assign another teacher.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unplaced.map((m, i) => (
              <span key={i} style={{ fontSize: 12, background: '#fff', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 10px', color: '#92400e' }}>
                {m.cls}: {m.subject} ×{m.count} {m.kind === 'double' ? '(double)' : ''} ({formatTeacherFirstName(m.teacher) || m.teacher})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts report */}
      {isTimetableAdmin && allConflicts.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#991b1b' }}>
            <Icon name="warning" size={18} />
            <strong style={{ fontSize: 14 }}>{allConflicts.length} double-booking conflict(s) detected</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allConflicts.map((c, i) => (
              <span key={i} style={{ fontSize: 12, background: '#fff', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', color: '#7f1d1d' }}>
                {DAYS[c.d]} P{annotated[c.p]?.period || c.p + 1}: {formatTeacherFirstName(c.teacher)} ({c.classes.join(' & ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + grid */}
      {hasGenerated && (
        <div className="card card-pad">
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${tab === 'master' ? ' active' : ''}`} onClick={() => setTab('master')}>Master</button>
            <button className={`tab${tab === 'class' ? ' active' : ''}`} onClick={() => setTab('class')}>Class Timetable</button>
            <button className={`tab${tab === 'teacher' ? ' active' : ''}`} onClick={() => setTab('teacher')}>Teacher Timetable</button>
          </div>

          {tab === 'teacher' && (
            <div style={{ marginBottom: 12, maxWidth: 240 }}>
              <label className="field-label">Select Teacher</label>
              <select className="select" value={teacherSel} onChange={(e) => setTeacherSel(e.target.value)}>
                {(teachers || []).map((t) => <option key={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Legend */}
          {tab !== 'master' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              {schoolSubjects.map((s) => {
                const meta = getSubjectMeta(s, schoolSubjectsRaw);
                return (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} title={s}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: meta.color }} />
                    <strong>{meta.short}</strong> {s}
                  </span>
                );
              })}
              {tab === 'class' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, border: '2px dashed var(--danger)' }} /> Conflict
                </span>
              )}
            </div>
          )}

          {/* MASTER VIEW */}
          {tab === 'master' && (
            <div className="scroll-x">
              <table className="tt-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Period</th>
                    {dynamicClasses.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {annotated.map((slot, p) => (
                    slot.teaching ? (
                      <tr key={p}>
                        <td className="tt-period-label" title={`${slot.start}–${slot.end}`}>{slot.label}</td>
                        {dynamicClasses.map((c) => {
                          const checkCls = ttType === 'Remedial' ? `${c} (Remedial)` : c;
                          return <MasterCell key={c} cell={timetables[checkCls]?.grid[p]} schoolSubjectsRaw={schoolSubjectsRaw} />;
                        })}
                      </tr>
                    ) : (
                      <tr key={p}>
                        <td className="tt-period-label">{slot.label}</td>
                        <td className="tt-break" colSpan={dynamicClasses.length} style={{ textAlign: 'center' }}>{slot.label}</td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Master view shows each class across the week (Mon→Fri stacked per cell). Use the Class tab for a full day-by-day grid.</p>
            </div>
          )}

          {/* CLASS + TEACHER VIEW — horizontal (days as rows, periods as columns) */}
          {tab !== 'master' && (() => {
            const tGrid = tab === 'teacher' ? teacherGrid() : null;
            return (
              <div className="scroll-x">
                <table className="tt-grid" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}></th>
                      {annotated.map((slot, ci) => (
                        <th key={ci} style={{ padding: '4px 2px' }}>
                          {slot.teaching ? (
                            <div>{slot.label}<div style={{ fontSize: 9, fontWeight: 400, color: '#94a3b8' }}>{slot.start}-{slot.end}</div></div>
                          ) : slot.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map((day, d) => (
                      <tr key={day}>
                        <td className="tt-period-label" style={{ fontWeight: 700 }}>{day}</td>
                        {annotated.map((slot, ci) => {
                          // Break/lunch: one vertical spanning column, drawn on the first row only.
                          if (!slot.teaching) {
                            if (d !== 0) return null;
                            return (
                              <td key={ci} className="tt-break" rowSpan={activeDays.length} style={{ verticalAlign: 'middle' }}>
                                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>{slot.label}</span>
                              </td>
                            );
                          }
                          // Guard against stale grids: if timeslots were edited after generation,
                          // ci can be beyond the saved grid's rows — return empty rather than crash.
                          const gridRow = tab === 'class' ? (tt?.grid?.[ci]) : (tGrid?.[ci]);
                          const cell = (gridRow && gridRow[d]) || { type: 'empty' };
                          if (!cell || cell.type === 'empty') {
                            return (
                              <td key={ci} className="tt-empty" style={{ height: 60 }}
                                onClick={() => tab === 'class' && isTimetableAdmin && setEditCell({ p: ci, d, subject: schoolSubjects[0], teacher: (teachers?.[0]?.name || ''), notes: '' })}>
                                {tab === 'class' && isTimetableAdmin ? '+' : ''}
                              </td>
                            );
                          }
                          const meta = getSubjectMeta(cell.subject, schoolSubjectsRaw);
                          if (tab === 'class') {
                            const conflict = hasConflict(cell, ci, d);
                            return (
                              <td key={ci} className={conflict ? 'tt-conflict' : ''}
                                style={{ ...cellStyle(cell), cursor: isTimetableAdmin ? 'pointer' : 'default', position: 'relative', height: 60, textAlign: 'center' }}
                                onClick={() => isTimetableAdmin && setEditCell({ p: ci, d, ...cell })}
                                title={`${cell.subject}${cell.teacher ? ' — ' + cell.teacher : ''}${conflict ? ' (CONFLICT: double-booked)' : ''}`}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>
                                  {cell.isBlock ? `${cell.dept} Blk` : meta.short}
                                  {cell.double && <span title="Double period" style={{ marginLeft: 3, fontSize: 9, color: '#64748b' }}>‖</span>}
                                </div>
                                <span style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 9, fontWeight: 700, color: conflict ? 'var(--danger)' : '#475569' }}>
                                  {cell.isBlock ? `${cell.subject.split(' / ').length} subjs` : teacherAbbr(cell.teacher)}
                                </span>
                              </td>
                            );
                          }
                          // Teacher view: class taught is the headline, subject abbr in the corner.
                          return (
                            <td key={ci} style={{ ...cellStyle(cell), position: 'relative', height: 60, textAlign: 'center' }} title={`${cell.subject} — ${cell.cls}`}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{cell.cls}</div>
                              <span style={{ position: 'absolute', left: 4, top: 2, fontSize: 9, fontWeight: 700, color: '#475569' }}>
                                {cell.isBlock ? 'Block' : meta.short}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {!hasGenerated && !generating && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {isTimetableAdmin
            ? <>Configure timeslots, constraints and lesson assignments above, then click <strong>Generate</strong>.</>
            : <>No timetable has been generated yet.</>}
        </div>
      )}

      {editCell && <EditCellModal cell={editCell} onClose={() => setEditCell(null)} onSave={saveCell} teachers={teachers} subjects={schoolSubjects} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={importCsv} dynamicClasses={dynamicClasses} />}

      {timeslotModal && (
        <TimeslotsModal
          timeslots={timeslots}
          schedule={settings?.timetable_schedule}
          onClose={() => setTimeslotModal(false)}
          onSave={(next) => {
            setTimeslots(next);
            setTimeslotModal(false);
            const tsKey = ttType === 'Remedial' ? 'remedial_timetable_timeslots' : 'timetable_timeslots';
            persist({ [tsKey]: next });
            notify('Timeslots saved', 'success', 'Timetable');
          }}
        />
      )}

      {constraintsModal && (
        <ConstraintsModal
          constraints={constraints}
          teachers={teachers}
          teachingSlots={teachingSlots}
          days={activeDays}
          subjects={schoolSubjects}
          onClose={() => setConstraintsModal(false)}
          onSave={(next) => {
            setConstraints(next);
            setConstraintsModal(false);
            const constrKey = ttType === 'Remedial' ? 'remedial_timetable_constraints' : 'timetable_constraints';
            persist({ [constrKey]: next });
            notify('Constraints saved', 'success', 'Timetable');
          }}
        />
      )}
    </div>
  );
}

function Chip({ children }) {
  return <span style={{ fontSize: 11, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '3px 9px', color: '#475569' }}>{children}</span>;
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14 }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// A master-grid cell that stacks the week (Mon→Fri) initials for one class/period.
function MasterCell({ cell, schoolSubjectsRaw }) {
  if (!cell) return <td className="tt-empty">-</td>;
  return (
    <td style={{ padding: 2 }}>
      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        {cell.map((c, i) => {
          if (!c || c.type !== 'lesson') return <span key={i} style={{ width: 24, height: 16, fontSize: 9, color: '#cbd5e1', textAlign: 'center' }}>·</span>;
          if (c.isBlock) {
             const color = getDeptColor(c.dept) || '#64748b';
             return <span key={i} title={`${DAYS[i]}: ${c.dept} Block`} style={{ width: 24, height: 16, fontSize: 9, fontWeight: 700, color: '#fff', background: color, borderRadius: 2, textAlign: 'center', lineHeight: '16px' }}>BLK</span>;
          }
          const meta = getSubjectMeta(c.subject, schoolSubjectsRaw);
          return <span key={i} title={`${DAYS[i]}: ${c.subject} (${c.teacher})`} style={{ width: 24, height: 16, fontSize: 9, fontWeight: 700, color: '#fff', background: meta.color, borderRadius: 2, textAlign: 'center', lineHeight: '16px' }}>{meta.initials.slice(0, 3)}</span>;
        })}
      </div>
    </td>
  );
}

function TimeslotsModal({ timeslots, schedule, onClose, onSave }) {
  const [rows, setRows] = useState(() => timeslots.map((s) => ({ ...s })));
  const [pattern, setPattern] = useState({
    startTime: schedule?.startTime || '07:00', periods: schedule?.periods || 8, duration: schedule?.duration || 40,
    breakAfter: schedule?.breakAfter || 2, breakDuration: schedule?.breakDuration || 20,
    lunchAfter: schedule?.lunchAfter || 5, lunchDuration: schedule?.lunchDuration || 60,
  });

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { start: '', end: '', type: 'Normal' }]);
  const delRow = (i) => setRows((rs) => rs.filter((_, j) => j !== i));
  const rebuild = () => setRows(patternTimeslots(pattern));

  return (
    <Modal
      title="Edit Timeslots"
      wide
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(rows.filter((r) => r.start && r.end))}>Save Timeslots</button></>}
    >
      <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#475569' }}>Quick build from pattern</h4>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <div><label className="field-label" style={{ fontSize: 11 }}>Start</label><input className="input" type="time" value={pattern.startTime} onChange={(e) => setPattern((p) => ({ ...p, startTime: e.target.value }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Periods</label><input className="input" type="number" min="1" max="15" value={pattern.periods} onChange={(e) => setPattern((p) => ({ ...p, periods: parseInt(e.target.value) || 1 }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Duration</label><input className="input" type="number" min="10" max="120" value={pattern.duration} onChange={(e) => setPattern((p) => ({ ...p, duration: parseInt(e.target.value) || 40 }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Break after</label><input className="input" type="number" min="0" max="15" value={pattern.breakAfter} onChange={(e) => setPattern((p) => ({ ...p, breakAfter: parseInt(e.target.value) || 0 }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Break mins</label><input className="input" type="number" min="0" max="60" value={pattern.breakDuration} onChange={(e) => setPattern((p) => ({ ...p, breakDuration: parseInt(e.target.value) || 0 }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Lunch after</label><input className="input" type="number" min="0" max="15" value={pattern.lunchAfter} onChange={(e) => setPattern((p) => ({ ...p, lunchAfter: parseInt(e.target.value) || 0 }))} /></div>
          <div><label className="field-label" style={{ fontSize: 11 }}>Lunch mins</label><input className="input" type="number" min="0" max="120" value={pattern.lunchDuration} onChange={(e) => setPattern((p) => ({ ...p, lunchDuration: parseInt(e.target.value) || 0 }))} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn btn-outline" style={{ width: '100%' }} onClick={rebuild}>Rebuild rows</button></div>
        </div>
      </div>

      <div className="scroll-x" style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
            <tr><th>#</th><th>Start</th><th>End</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 8px' }}>{i + 1}</td>
                <td style={{ padding: '4px 8px' }}><input className="input" type="time" value={r.start} style={{ height: 32 }} onChange={(e) => setRow(i, { start: e.target.value })} /></td>
                <td style={{ padding: '4px 8px' }}><input className="input" type="time" value={r.end} style={{ height: 32 }} onChange={(e) => setRow(i, { end: e.target.value })} /></td>
                <td style={{ padding: '4px 8px' }}>
                  <select className="select" value={r.type} style={{ height: 32, fontSize: 13 }} onChange={(e) => setRow(i, { type: e.target.value })}>
                    {TIMESLOT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 8px' }}><button className="btn" style={{ padding: '4px 8px' }} onClick={() => delRow(i)}><Icon name="close" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={addRow}><Icon name="plus" size={14} /> Add slot</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Only <strong>Normal</strong> slots hold lessons. Breaks, Lunch, Preps and Games are shown as fixed rows.</p>
    </Modal>
  );
}

function ConstraintsModal({ constraints, teachers, teachingSlots, days, onClose, onSave, subjects = SUBJECTS }) {
  const [form, setForm] = useState(() => ({ ...defaultConstraints, ...constraints, customPairs: [...(constraints.customPairs || [])], teacherTimeOff: { ...(constraints.teacherTimeOff || {}) } }));
  const [pairA, setPairA] = useState(subjects[0]);
  const [pairB, setPairB] = useState(subjects[1] || subjects[0]);
  const [toTeacher, setToTeacher] = useState(teachers?.[0]?.name || '');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const addPair = () => { if (pairA && pairB && pairA !== pairB) set({ customPairs: [...form.customPairs, [pairA, pairB]] }); };
  const delPair = (i) => set({ customPairs: form.customPairs.filter((_, j) => j !== i) });

  const offSet = new Set(form.teacherTimeOff[toTeacher] || []);
  const toggleOff = (d, rowIdx) => {
    const key = `${d}-${rowIdx}`;
    const cur = new Set(form.teacherTimeOff[toTeacher] || []);
    cur.has(key) ? cur.delete(key) : cur.add(key);
    set({ teacherTimeOff: { ...form.teacherTimeOff, [toTeacher]: [...cur] } });
  };

  return (
    <Modal
      title="Timetable Constraints"
      wide
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(form)}>Save Constraints</button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <ToggleRow label="Math in the morning" checked={!!form.mathInMorning} onChange={(v) => set({ mathInMorning: v })} />
          <ToggleRow label="English & Kiswahili not to follow each other" checked={!!form.engKisNotFollow} onChange={(v) => set({ engKisNotFollow: v })} />
          <ToggleRow label="Math & Science not to follow each other" checked={!!form.mathSciNotFollow} onChange={(v) => set({ mathSciNotFollow: v })} />
          <ToggleRow label="Free lessons only during the afternoon" checked={!!form.freeAfternoonOnly} onChange={(v) => set({ freeAfternoonOnly: v })} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 14 }}>Max lessons / teacher / day</span>
            <input className="input" type="number" min="0" max="15" value={form.maxPerDay} style={{ width: 80 }} onChange={(e) => set({ maxPerDay: parseInt(e.target.value) || 0 })} title="0 = no limit" />
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#475569' }}>Custom "not to follow" pairs</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <select className="select" value={pairA} onChange={(e) => setPairA(e.target.value)} style={{ width: 150 }}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
            <span className="muted">✕</span>
            <select className="select" value={pairB} onChange={(e) => setPairB(e.target.value)} style={{ width: 150 }}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn btn-outline" onClick={addPair}><Icon name="plus" size={14} /> Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {form.customPairs.map((p, i) => (
              <span key={i} style={{ fontSize: 12, background: '#f1f5f9', borderRadius: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                {p[0]} ✕ {p[1]} <button className="btn" style={{ padding: 0, background: 'none', color: '#dc2626' }} onClick={() => delPair(i)}><Icon name="close" size={12} /></button>
              </span>
            ))}
            {form.customPairs.length === 0 && <span className="muted" style={{ fontSize: 12 }}>None</span>}
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#475569' }}>Teacher time-off</h4>
          <select className="select" value={toTeacher} onChange={(e) => setToTeacher(e.target.value)} style={{ width: 220, marginBottom: 10 }}>
            {(teachers || []).map((t) => <option key={t.id}>{t.name}</option>)}
          </select>
          <div className="scroll-x">
            <table className="table" style={{ margin: 0, fontSize: 12 }}>
              <thead><tr><th>Day</th>{teachingSlots.map((s) => <th key={s.period} style={{ textAlign: 'center' }}>{s.label}</th>)}</tr></thead>
              <tbody>
                {days.map((d, di) => (
                  <tr key={d}>
                    <td style={{ fontWeight: 500 }}>{d}</td>
                    {teachingSlots.map((s) => <TimeOffCell key={s.period} day={di} slot={s} offSet={offSet} onToggle={toggleOff} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Tick a slot to mark {formatTeacherFirstName(toTeacher) || 'the teacher'} unavailable then.</p>
        </div>
      </div>
    </Modal>
  );
}

// Time-off cell keyed by the timeslot's original row index (slot._rowIndex).
function TimeOffCell({ day, slot, offSet, onToggle }) {
  const rowIdx = slot._rowIndex;
  const key = `${day}-${rowIdx}`;
  return (
    <td style={{ textAlign: 'center', padding: '4px' }}>
      <input type="checkbox" checked={offSet.has(key)} onChange={() => onToggle(day, rowIdx)} />
    </td>
  );
}

function EditCellModal({ cell, onClose, onSave, teachers, subjects = SUBJECTS }) {
  const [subject, setSubject] = useState(cell.subject || subjects[0]);
  const [teacher, setTeacher] = useState(cell.teacher || (teachers?.[0]?.name || ''));
  const [notes, setNotes] = useState(cell.notes || '');
  return (
    <Modal
      title="Edit Timetable Cell"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave({ subject, teacher, notes })}>Save</button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label">Subject</label>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label className="field-label">Teacher</label>
          <select className="select" value={teacher} onChange={(e) => setTeacher(e.target.value)}>{(teachers || []).map((t) => <option key={t.id}>{t.name}</option>)}</select>
        </div>
        <div>
          <label className="field-label">Notes</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onImport, dynamicClasses = [] }) {
  const [drag, setDrag] = useState(false);
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ class: '', subject: '', teacher: '', period: '', day: '' });
  const fileRef = useRef(null);

  function splitLine(line) {
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function parse(text) {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const hdr = splitLine(lines[0]);
    const data = lines.slice(1).map(splitLine);
    const NONE = '(none)';
    setHeaders(hdr);
    setRows(data);
    setMapping({
      class: hdr.find((h) => /class|grade|stream/i.test(h)) || NONE,
      subject: hdr.find((h) => /subject/i.test(h)) || hdr[0] || '',
      teacher: hdr.find((h) => /teacher/i.test(h)) || NONE,
      period: hdr.find((h) => /period|lesson|slot/i.test(h)) || '',
      day: hdr.find((h) => /day/i.test(h)) || '',
    });
  }

  function onFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parse(String(e.target.result));
    reader.readAsText(file);
  }

  return (
    <Modal
      title="Import Timetable CSV"
      wide
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onImport({ headers, rows, mapping })} disabled={!rows}>Confirm Import</button></>}
    >
      {!rows && (
        <div className={`dropzone${drag ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 28, color: 'var(--primary)', marginBottom: 8 }}><Icon name="download" size={32} /></div>
          <p>Drag & drop a CSV file here, or click to browse.</p>
          <p style={{ fontSize: 12 }}>Expected columns: Class, Subject, Teacher, Period, Day</p>
          {dynamicClasses.length > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>Known classes: {dynamicClasses.join(', ')}</p>}
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => onFile(e.target.files[0])} />
        </div>
      )}

      {rows && (
        <div>
          <h4 style={{ marginBottom: 10 }}>Column Mapping</h4>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            {['class', 'subject', 'teacher', 'period', 'day'].map((field) => (
              <div key={field}>
                <label className="field-label" style={{ textTransform: 'capitalize' }}>{field}{(field === 'subject' || field === 'period' || field === 'day') && ' *'}</label>
                <select className="select" value={mapping[field]} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}>
                  {(field === 'class' || field === 'teacher') && <option>(none)</option>}
                  {headers.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            If no Class column is mapped, all rows import into <strong>{dynamicClasses[0] || '—'}</strong>. Period accepts "1" or "P1".
          </p>
          <h4 style={{ marginBottom: 10 }}>Preview (first 5 rows)</h4>
          <div className="scroll-x">
            <table className="table">
              <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{rows.length} rows detected.</p>
        </div>
      )}
    </Modal>
  );
}
