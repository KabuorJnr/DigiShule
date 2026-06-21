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
  
  return { a1, a2, a3, a4, average: Math.round(average * 10) / 10 };
}

// Map the numerical average (1-4) to a CBC competency grade.
export function gradeFor(average, boundaries) {
  // In a full CBC system, grade boundaries might be strictly configured, but we use standard defaults:
  if (average >= 3.5) return 'EE';
  if (average >= 2.5) return 'ME';
  if (average >= 1.5) return 'AE';
  if (average > 0) return 'BE';
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

