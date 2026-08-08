import { describe, it, expect } from 'vitest';
import {
  generateAll, patternTimeslots, annotateTimeslots, buildNotToFollow,
  pairKey, defaultConstraints,
} from '../utils/timetableEngine';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// A simple 6-teaching-period day with a break after P2 and lunch after P4.
const timeslots = patternTimeslots({ startTime: '08:00', periods: 6, duration: 40, breakAfter: 2, breakDuration: 20, lunchAfter: 4, lunchDuration: 40 });

function lessonsOf(result, cls) {
  const cells = [];
  result[cls].grid.forEach((row, r) => row.forEach((c, d) => { if (c.type === 'lesson') cells.push({ ...c, r, d }); }));
  return cells;
}

describe('timeslot helpers', () => {
  it('numbers only Normal slots as teaching periods', () => {
    const ann = annotateTimeslots(timeslots);
    const teaching = ann.filter((a) => a.teaching);
    expect(teaching).toHaveLength(6);
    expect(teaching.map((t) => t.period)).toEqual([1, 2, 3, 4, 5, 6]);
    // break + lunch rows are present and non-teaching
    expect(ann.filter((a) => !a.teaching).map((a) => a.label).sort()).toEqual(['Break', 'Lunch']);
  });

  it('builds not-to-follow pairs from toggles and custom pairs', () => {
    const s = buildNotToFollow({ engKisNotFollow: true, mathSciNotFollow: true, customPairs: [['History', 'Geography']] });
    expect(s.has(pairKey('English', 'Kiswahili'))).toBe(true);
    expect(s.has(pairKey('Mathematics', 'Physics'))).toBe(true);
    expect(s.has(pairKey('Geography', 'History'))).toBe(true);
    expect(s.has(pairKey('English', 'Mathematics'))).toBe(false);
  });
});

describe('generateAll', () => {
  const teachers = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  const assignmentsByClass = {
    '1A': [
      { subject: 'Mathematics', teacher: 'Alice', singles: 4, doubles: 0 },
      { subject: 'English', teacher: 'Bob', singles: 3, doubles: 0 },
    ],
  };

  it('places exactly the requested number of lessons', () => {
    const { result, unplaced } = generateAll({
      classes: ['1A'], days: DAYS, timeslots, assignmentsByClass, constraints: defaultConstraints, term: 'Term 1',
    });
    expect(unplaced).toHaveLength(0);
    const cells = lessonsOf(result, '1A');
    expect(cells.filter((c) => c.subject === 'Mathematics')).toHaveLength(4);
    expect(cells.filter((c) => c.subject === 'English')).toHaveLength(3);
  });

  it('never places a lesson in a break/lunch row', () => {
    const { result } = generateAll({ classes: ['1A'], days: DAYS, timeslots, assignmentsByClass, constraints: defaultConstraints, term: 'T' });
    const ann = annotateTimeslots(timeslots);
    lessonsOf(result, '1A').forEach((c) => expect(ann[c.r].teaching).toBe(true));
  });

  it('honours the math-in-morning constraint', () => {
    const ann = annotateTimeslots(timeslots);
    const morningCut = Math.ceil(ann.filter((a) => a.teaching).length / 2); // = 3
    const { result } = generateAll({ classes: ['1A'], days: DAYS, timeslots, assignmentsByClass, constraints: { ...defaultConstraints, mathInMorning: true }, term: 'T' });
    lessonsOf(result, '1A').filter((c) => c.subject === 'Mathematics').forEach((c) => {
      expect(ann[c.r].period).toBeLessThanOrEqual(morningCut);
    });
  });

  it('never double-books a teacher across classes', () => {
    const shared = {
      '1A': [{ subject: 'Mathematics', teacher: 'Alice', singles: 5, doubles: 0 }],
      '1B': [{ subject: 'Mathematics', teacher: 'Alice', singles: 5, doubles: 0 }],
    };
    const { result } = generateAll({ classes: ['1A', '1B'], days: DAYS, timeslots, assignmentsByClass: shared, constraints: { ...defaultConstraints, mathInMorning: false }, term: 'T' });
    const seen = new Set();
    ['1A', '1B'].forEach((cls) => lessonsOf(result, cls).forEach((c) => {
      const key = `${c.teacher}-${c.d}-${c.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }));
  });

  it('respects the per-teacher daily cap', () => {
    const heavy = { '1A': [{ subject: 'Mathematics', teacher: 'Alice', singles: 10, doubles: 0 }] };
    const { result } = generateAll({ classes: ['1A'], days: DAYS, timeslots, assignmentsByClass: heavy, constraints: { ...defaultConstraints, maxPerDay: 2, mathInMorning: false }, term: 'T' });
    const perDay = {};
    lessonsOf(result, '1A').forEach((c) => { perDay[c.d] = (perDay[c.d] || 0) + 1; });
    Object.values(perDay).forEach((n) => expect(n).toBeLessThanOrEqual(2));
  });

  it('places doubles as two consecutive teaching rows on the same day', () => {
    const dbl = { '1A': [{ subject: 'Chemistry', teacher: 'Bob', singles: 0, doubles: 1 }] };
    const { result, unplaced } = generateAll({ classes: ['1A'], days: DAYS, timeslots, assignmentsByClass: dbl, constraints: { ...defaultConstraints }, term: 'T' });
    expect(unplaced).toHaveLength(0);
    const cells = lessonsOf(result, '1A').filter((c) => c.subject === 'Chemistry');
    expect(cells).toHaveLength(2);
    expect(cells[0].d).toBe(cells[1].d);          // same day
    expect(Math.abs(cells[0].r - cells[1].r)).toBe(1); // adjacent rows
    cells.forEach((c) => expect(c.double).toBe(true));
  });

  it('reports lessons that cannot fit instead of dropping them silently', () => {
    // 1 teaching day, 6 slots, but 10 lessons requested -> 4 unplaced.
    const oneDay = ['Mon'];
    const over = { '1A': [{ subject: 'English', teacher: 'Bob', singles: 10, doubles: 0 }] };
    const { unplaced } = generateAll({ classes: ['1A'], days: oneDay, timeslots, assignmentsByClass: over, constraints: { ...defaultConstraints, maxPerDay: 0 }, term: 'T' });
    const total = unplaced.reduce((n, m) => n + m.count, 0);
    expect(total).toBe(4);
  });
});
