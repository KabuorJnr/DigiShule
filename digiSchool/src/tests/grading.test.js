import { describe, it, expect } from 'vitest';
import { computeRow, gradeFor, remarkFor, subjectAverage, studentOverall, is844Class, computeStudentReport, pointsForGrade } from '../utils/grading';

describe('grading calculations', () => {
  it('assigns correct CBC grade for standard thresholds and 1-4 rubric points', () => {
    expect(gradeFor(85)).toBe('EE');
    expect(gradeFor(65)).toBe('ME');
    expect(gradeFor(40)).toBe('AE');
    expect(gradeFor(15)).toBe('BE');

    // 1, 2, 3, 4 Rubric Points Scale Detection
    expect(gradeFor(4, null, 'CBC')).toBe('EE');
    expect(gradeFor(3, null, 'CBC')).toBe('ME');
    expect(gradeFor(2, null, 'CBC')).toBe('AE');
    expect(gradeFor(1, null, 'CBC')).toBe('BE');
    expect(gradeFor(3.8, null, 'CBC')).toBe('EE');
    expect(gradeFor(2.8, null, 'CBC')).toBe('ME');

    expect(gradeFor(null)).toBe('-');
  });

  it('assigns correct 8-4-4 KCSE grades for 12-point scale', () => {
    expect(gradeFor(82, null, '844')).toBe('A');
    expect(gradeFor(76, null, '844')).toBe('A-');
    expect(gradeFor(72, null, '844')).toBe('B+');
    expect(gradeFor(68, null, '844')).toBe('B');
    expect(gradeFor(62, null, '844')).toBe('B-');
    expect(gradeFor(57, null, '844')).toBe('C+');
    expect(gradeFor(52, null, '844')).toBe('C');
    expect(gradeFor(47, null, '844')).toBe('C-');
    expect(gradeFor(42, null, '844')).toBe('D+');
    expect(gradeFor(37, null, '844')).toBe('D');
    expect(gradeFor(32, null, '844')).toBe('D-');
    expect(gradeFor(20, null, '844')).toBe('E');

    expect(pointsForGrade('A', '844')).toBe(12);
    expect(pointsForGrade('B+', '844')).toBe(10);
    expect(pointsForGrade('C+', '844')).toBe(7);
    expect(pointsForGrade('E', '844')).toBe(1);
  });

  it('correctly identifies 8-4-4 classes vs CBC grades', () => {
    expect(is844Class('Form 3')).toBe(true);
    expect(is844Class('Form 4 West')).toBe(true);
    expect(is844Class('Form 1')).toBe(true);
    expect(is844Class('Grade 10')).toBe(false);
    expect(is844Class('Grade 8 East')).toBe(false);
  });

  it('provides the correct remarks for grades', () => {
    expect(remarkFor('EE')).toBe('Exceeding Expectations');
    expect(remarkFor('ME')).toBe('Meeting Expectations');
    expect(remarkFor('A', '844')).toBe('Excellent');
    expect(remarkFor('B+', '844')).toBe('Good');
    expect(remarkFor('E', '844')).toBe('Needs Serious Effort');
  });

  it('computes row average correctly ignoring zeroes (unscored)', () => {
    const scores1 = { a1: 4, a2: 3, a3: 3, a4: 0 };
    expect(computeRow(scores1).average).toBe(3.3);

    const scores2 = { a1: 4, a2: 4, a3: 0, a4: 0 };
    expect(computeRow(scores2).average).toBe(4.0);

    const scores3 = { a1: 0, a2: 0, a3: 0, a4: 0 };
    expect(computeRow(scores3).average).toBe(0);
  });

  it('computes subject average', () => {
    const scores = { a1: 2, a2: 3, a3: 0, a4: 0 }; // 2.5 / 4 = 62.5% -> 63%
    expect(subjectAverage(scores)).toBe(63);
  });

  it('computes student overall average ignoring unscored subjects', () => {
    const student = {
      scores: {
        Math: { a1: 4, a2: 4 }, // 100%
        English: { a1: 3, a2: 2 }, // 63%
        Science: { a1: 0, a2: 0 }
      }
    };
    const subjects = ['Math', 'English', 'Science'];
    expect(studentOverall(student, subjects)).toBe(81.5);
  });

  it('computes report for Form 3 8-4-4 student with KCSE points scale', () => {
    const student = {
      id: 'stu-form3',
      name: 'Form 3 Student',
      adm: 'F3001',
      class: 'Form 3 East',
      scores: {
        Mathematics: 82, // A -> 12 pts
        English: 76      // A- -> 11 pts
      }
    };
    const subjects = ['Mathematics', 'English'];
    const report = computeStudentReport({ student, students: [student], subjects });
    
    expect(report.systemType).toBe('844');
    expect(report.totalPoints).toBe(23); // 12 + 11
    expect(report.meanGradeCode).toBe('A-');
    expect(report.className).toBe('Form 3 East');
  });
});
