import { describe, it, expect } from 'vitest';
import { gradeFor, remarkFor } from '../utils/grading';

describe('grading calculations', () => {
  it('assigns correct CBC grade for standard thresholds', () => {
    // EE (Exceeds Expectations) is usually 4.0 or above 80
    // Actually the function maps numbers (1-4 or 0-100 depending on the impl)
    // Let's test the default boundaries.
    expect(gradeFor(3.5)).toBe('EE');
    expect(gradeFor(3.0)).toBe('ME');
    expect(gradeFor(2.0)).toBe('AE');
    expect(gradeFor(1.0)).toBe('BE');
  });

  it('provides the correct remarks for grades', () => {
    expect(remarkFor('EE')).toBe('Exceeding Expectations');
    expect(remarkFor('ME')).toBe('Meeting Expectations');
    expect(remarkFor('AE')).toBe('Approaching Expectations');
    expect(remarkFor('BE')).toBe('Below Expectations');
    expect(remarkFor('UNKNOWN')).toBe('No Score');
  });
});
