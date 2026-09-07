import { describe, it, expect } from 'vitest';
import { 
  computeRow, 
  gradeFor, 
  remarkFor, 
  subjectAverage, 
  studentOverall, 
  is844Class, 
  computeStudentReport, 
  pointsForGrade,
  percentageToCbcPoints,
  percentageToCbcGrade,
  formatCbcConversion
} from '../utils/grading';

describe('grading calculations', () => {
  it('converts percentage marks directly to CBC point system and performance levels', () => {
    // 8-tier KNEC point scale from percentage
    expect(percentageToCbcPoints(95)).toBe(8); // EE1 -> 8 pts
    expect(percentageToCbcPoints(82)).toBe(7); // EE2 -> 7 pts
    expect(percentageToCbcPoints(65)).toBe(6); // ME1 -> 6 pts
    expect(percentageToCbcPoints(50)).toBe(5); // ME2 -> 5 pts
    expect(percentageToCbcPoints(35)).toBe(4); // AE1 -> 4 pts
    expect(percentageToCbcPoints(25)).toBe(3); // AE2 -> 3 pts
    expect(percentageToCbcPoints(15)).toBe(2); // BE1 -> 2 pts
    expect(percentageToCbcPoints(5)).toBe(1);  // BE2 -> 1 pt

    // 4-tier rubric scale from percentage
    expect(percentageToCbcPoints(95, 4)).toBe(4); // EE -> 4 pts
    expect(percentageToCbcPoints(82, 4)).toBe(4); // EE -> 4 pts
    expect(percentageToCbcPoints(65, 4)).toBe(3); // ME -> 3 pts
    expect(percentageToCbcPoints(50, 4)).toBe(3); // ME -> 3 pts
    expect(percentageToCbcPoints(35, 4)).toBe(2); // AE -> 2 pts
    expect(percentageToCbcPoints(15, 4)).toBe(1); // BE -> 1 pt

    // Grade codes from percentage
    expect(percentageToCbcGrade(92)).toBe('EE1');
    expect(percentageToCbcGrade(78)).toBe('EE2');
    expect(percentageToCbcGrade(62)).toBe('ME1');
    expect(percentageToCbcGrade(45)).toBe('ME2');
    expect(percentageToCbcGrade(32)).toBe('AE1');
    expect(percentageToCbcGrade(22)).toBe('AE2');
    expect(percentageToCbcGrade(12)).toBe('BE1');
    expect(percentageToCbcGrade(8)).toBe('BE2');

    // Full structured conversion
    const conv = formatCbcConversion(78);
    expect(conv.percentage).toBe(78);
    expect(conv.gradeCode).toBe('EE2');
    expect(conv.points).toBe(7);
    expect(conv.rubricPoints).toBe(4);
    expect(conv.remark).toBe('Exceeding Expectations');
  });

  it('assigns correct CBC grade for standard thresholds and 1-4 rubric points', () => {
    // 8-tier CBC scale: EE1/EE2/ME1/ME2/AE1/AE2/BE1/BE2
    expect(gradeFor(95)).toBe('EE1'); // 90-100
    expect(gradeFor(80)).toBe('EE2'); // 75-89
    expect(gradeFor(65)).toBe('ME1'); // 58-74
    expect(gradeFor(50)).toBe('ME2'); // 41-57
    expect(gradeFor(35)).toBe('AE1'); // 31-40
    expect(gradeFor(25)).toBe('AE2'); // 21-30
    expect(gradeFor(15)).toBe('BE1'); // 11-20
    expect(gradeFor(5)).toBe('BE2');  // 0-10

    // 1, 2, 3, 4 rubric scale maps to the 8-tier grades in 0.5-point buckets.
    expect(gradeFor(4, null, 'CBC')).toBe('EE1');
    expect(gradeFor(3, null, 'CBC')).toBe('EE2');
    expect(gradeFor(2, null, 'CBC')).toBe('ME2');
    expect(gradeFor(1, null, 'CBC')).toBe('AE2');
    expect(gradeFor(3.8, null, 'CBC')).toBe('EE1');
    expect(gradeFor(2.8, null, 'CBC')).toBe('ME1');

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

  it('computes percentage row averages correctly and handles absent X', () => {
    const pctScores = { a1: 75, a2: 85, a3: 90, a4: 0 };
    const row = computeRow(pctScores);
    expect(row.average).toBe(83.3); // (75 + 85 + 90) / 3

    const absentScores = { a1: 80, a2: 'X', a3: 70, a4: 0 };
    const absentRow = computeRow(absentScores);
    expect(absentRow.average).toBe(75); // (80 + 70) / 2
  });

  it('computes report for CBC student with 8-tier points and percentage scale', () => {
    const student = {
      id: 'stu-cbc7',
      name: 'Brian Mwangi',
      adm: '7A-001',
      class: 'Grade 7A',
      scores: {
        Mathematics: { a1: 80, a2: 90, a3: 85, a4: 95 }, // avg = 87.5% -> EE2 -> 7 pts
        English: { a1: 70, a2: 60, a3: 65, a4: 65 }       // avg = 65% -> ME1 -> 6 pts
      }
    };
    const subjects = ['Mathematics', 'English'];
    const report = computeStudentReport({ student, students: [student], subjects });

    expect(report.systemType).toBe('CBC');
    expect(report.totalPoints).toBe(13); // 7 + 6
    expect(report.meanGradeCode).toBe('EE2');
    expect(report.maxPointsPerSubject).toBe(8);
  });
});
