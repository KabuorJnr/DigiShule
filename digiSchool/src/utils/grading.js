// CBC Grade computation helpers.

// Assesses 4 rubric scores out of 4 (e.g. strands). Returns average rubric.
// Spec columns: Assessment 1, Assessment 2, Assessment 3, Assessment 4, Average Rubric.
export function computeRow(scores = {}) {
  const safeScores = scores || {};
  const a1 = Number(safeScores.a1) || 0;
  const a2 = Number(safeScores.a2) || 0;
  const a3 = Number(safeScores.a3) || 0;
  const a4 = Number(safeScores.a4) || 0;
  
  // Calculate average only over completed assessments (score > 0)
  const validScores = [a1, a2, a3, a4].filter(v => v > 0);
  const average = validScores.length > 0 ? validScores.reduce((sum, v) => sum + v, 0) / validScores.length : 0;
  
  return { a1, a2, a3, a4, average: Math.round(average * 10) / 10, remarks: safeScores.remarks || '' };
}

// Map the numerical average (0-100) to a CBC competency grade.
export function gradeFor(average, boundaries) {
  const defaultBoundaries = [
    { min: 3.5, grade: 'EE' },
    { min: 2.5, grade: 'ME' },
    { min: 1.5, grade: 'AE' },
    { min: 0.1, grade: 'BE' }
  ];
  const bnds = boundaries && boundaries.length > 0 ? boundaries : defaultBoundaries;
  
  if (average === 0 || !average) return '-';
  
  // boundaries should be sorted by min descending (e.g. 80, 60, 40, 0)
  for (const b of bnds) {
    if (average >= b.min) {
      return b.grade;
    }
  }
  return '-';
}

export function remarkFor(grade) {
  switch (grade) {
    case 'EE': return 'Exceeding Expectations';
    case 'ME': return 'Meeting Expectations';
    case 'AE': return 'Approaching Expectations';
    case 'BE': return 'Below Expectations';
    default: return 'No Score';
  }
}

// Compute a per-subject average rubric for a student across assessments.
export function subjectAverage(subjectScores) {
  const { average } = computeRow(subjectScores);
  return average;
}

// Overall average across all subjects for a student.
export function studentOverall(student, subjects) {
  const avgs = subjects.map((s) => subjectAverage(student.scores[s] || {}));
  const validAvgs = avgs.filter(v => v > 0);
  const overall = validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : 0;
  return Math.round(overall * 10) / 10;
}

