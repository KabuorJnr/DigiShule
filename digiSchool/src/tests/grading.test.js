import { describe, it, expect } from 'vitest';
import { computeRow, gradeFor, remarkFor, subjectAverage, studentOverall } from '../utils/grading';

describe('grading calculations', () => {
  it('assigns correct CBC grade for standard thresholds', () => {
    expect(gradeFor(3.5)).toBe('EE');
    expect(gradeFor(3.0)).toBe('ME');
    expect(gradeFor(2.0)).toBe('AE');
    expect(gradeFor(1.0)).toBe('BE');
    expect(gradeFor(0)).toBe('-');
  });

  it('provides the correct remarks for grades', () => {
    expect(remarkFor('EE')).toBe('Exceeding Expectations');
    expect(remarkFor('ME')).toBe('Meeting Expectations');
    expect(remarkFor('AE')).toBe('Approaching Expectations');
    expect(remarkFor('BE')).toBe('Below Expectations');
    expect(remarkFor('UNKNOWN')).toBe('No Score');
  });

  it('computes row average correctly ignoring zeroes (unscored)', () => {
    // 3 out of 4 scored
    const scores1 = { a1: 4, a2: 3, a3: 3, a4: 0 };
    expect(computeRow(scores1).average).toBe(3.3); // (4+3+3)/3 = 10/3 = 3.33 -> 3.3

    // 2 out of 4 scored
    const scores2 = { a1: 4, a2: 4, a3: 0, a4: 0 };
    expect(computeRow(scores2).average).toBe(4.0);

    // None scored
    const scores3 = { a1: 0, a2: 0, a3: 0, a4: 0 };
    expect(computeRow(scores3).average).toBe(0);
  });

  it('computes subject average', () => {
    const scores = { a1: 2, a2: 3, a3: 0, a4: 0 };
    expect(subjectAverage(scores)).toBe(2.5);
  });

  it('computes student overall average ignoring unscored subjects', () => {
    const student = {
      scores: {
        Math: { a1: 4, a2: 4 }, // avg 4.0
        English: { a1: 3, a2: 2 }, // avg 2.5
        Science: { a1: 0, a2: 0 } // avg 0 (unscored, should be ignored)
      }
    };
    const subjects = ['Math', 'English', 'Science'];
    // Overall should be (4.0 + 2.5) / 2 = 6.5 / 2 = 3.25 -> rounded to 3.3
    expect(studentOverall(student, subjects)).toBe(3.3);
  });
});
