import { describe, it, expect } from 'vitest';
import { generateAll, requiredLessons } from '../utils/timetableEngine';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const timeslots = Array.from({ length: 8 }, (_, i) => ({ start: `${String(8 + i).padStart(2, '0')}:00`, end: `${String(8 + i).padStart(2, '0')}:40`, type: 'Normal' }));

const subjectDept = {
  French: 'Elective Languages', German: 'Elective Languages', Mandarin: 'Elective Languages',
  Biology: 'Sciences', Chemistry: 'Sciences', Physics: 'Sciences',
};

const langOptions = () => ([
  { subject: 'French', teacher: 'TF', singles: 5, doubles: 0 },
  { subject: 'German', teacher: 'TG', singles: 5, doubles: 0 },
  { subject: 'Mandarin', teacher: 'TM', singles: 5, doubles: 0 },
  { subject: 'Biology', teacher: 'TB', singles: 4, doubles: 0 },
]);

const cells = (grid) => grid.flatMap((row) => row).filter((c) => c && c.type === 'lesson');

describe('option-block timetabling', () => {
  it('places elective languages as ONE concurrent block, not 3 separate subjects', () => {
    const assignmentsByClass = { 'Grade 10 A': langOptions() };
    const { result } = generateAll({
      classes: ['Grade 10 A'], days: DAYS, timeslots, assignmentsByClass,
      constraints: { maxPerDay: 0, blockDepartments: ['Elective Languages'] }, subjectDept,
    });
    const lessons = cells(result['Grade 10 A'].grid);
    const blocks = lessons.filter((c) => c.isBlock);
    // Block occupies max(singles)=5 slots (once), each labelled with all options.
    expect(blocks.length).toBe(5);
    expect(blocks.every((c) => c.subject === 'French / German / Mandarin')).toBe(true);
    // Biology (independent) is separate: 4 slots. Total 9, not 5+5+5+4=19.
    expect(lessons.filter((c) => !c.isBlock && c.subject === 'Biology').length).toBe(4);
    expect(lessons.length).toBe(9);
  });

  it('requiredLessons counts a block department once', () => {
    expect(requiredLessons(langOptions(), ['Elective Languages'], subjectDept)).toBe(9); // 5 (block) + 4 (bio)
    expect(requiredLessons(langOptions(), [], subjectDept)).toBe(19); // no block => additive
  });

  it('keeps streams independent and never double-books a shared option teacher', () => {
    const assignmentsByClass = { 'Grade 10 A': langOptions(), 'Grade 10 B': langOptions() };
    const { result } = generateAll({
      classes: ['Grade 10 A', 'Grade 10 B'], days: DAYS, timeslots, assignmentsByClass,
      constraints: { maxPerDay: 0, blockDepartments: ['Elective Languages'] }, subjectDept,
    });
    const slotsFor = (cls) => {
      const s = new Set();
      result[cls].grid.forEach((row, p) => row.forEach((c, d) => { if (c && c.isBlock) s.add(`${d}-${p}`); }));
      return s;
    };
    const a = slotsFor('Grade 10 A'), b = slotsFor('Grade 10 B');
    // French/German/Mandarin teachers are shared, so the two streams' language
    // blocks cannot overlap in time — proving streams differ and no double-book.
    const overlap = [...a].filter((k) => b.has(k));
    expect(overlap.length).toBe(0);
  });

  it('enforces a per-subject morning-only rule', () => {
    const assignmentsByClass = { 'Grade 10 A': [{ subject: 'Biology', teacher: 'TB', singles: 4, doubles: 0 }] };
    const { result } = generateAll({
      classes: ['Grade 10 A'], days: DAYS, timeslots, assignmentsByClass,
      constraints: { maxPerDay: 0, subjectRules: { Biology: { time: 'am', maxPerDay: 0, days: [] } } }, subjectDept,
    });
    // 8 periods => morningCut = 4; every Biology lesson must be in periods 1..4.
    result['Grade 10 A'].grid.forEach((row, p) => row.forEach((c) => {
      if (c && c.type === 'lesson') expect(p + 1).toBeLessThanOrEqual(4);
    }));
  });

  it('enforces a per-subject excluded-day rule', () => {
    const assignmentsByClass = { 'Grade 10 A': [{ subject: 'Biology', teacher: 'TB', singles: 4, doubles: 0 }] };
    const { result } = generateAll({
      classes: ['Grade 10 A'], days: DAYS, timeslots, assignmentsByClass,
      constraints: { maxPerDay: 0, subjectRules: { Biology: { time: 'any', maxPerDay: 0, days: [0] } } }, subjectDept,
    });
    // Day index 0 (Mon) is excluded — no Biology should land there.
    result['Grade 10 A'].grid.forEach((row) => { if (row[0] && row[0].type === 'lesson') expect(row[0].subject).not.toBe('Biology'); });
  });

  it('does not mutate the caller assignments array', () => {
    const assignmentsByClass = { 'Grade 10 A': langOptions() };
    const before = assignmentsByClass['Grade 10 A'].length;
    generateAll({
      classes: ['Grade 10 A'], days: DAYS, timeslots, assignmentsByClass,
      constraints: { maxPerDay: 0, blockDepartments: ['Elective Languages'] }, subjectDept,
    });
    expect(assignmentsByClass['Grade 10 A'].length).toBe(before); // clone used internally
  });
});
