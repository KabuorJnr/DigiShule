// Grade computation helpers.

// Total out of 200 (CAT1 30 + CAT2 30 + Midterm 100... ) -> we normalize.
// Spec columns: CAT 1, CAT 2, Midterm, End-Term, Total, Average %, Grade.
export function computeRow(scores = {}) {
  const safeScores = scores || {};
  const cat1 = Number(safeScores.cat1) || 0;
  const cat2 = Number(safeScores.cat2) || 0;
  const midterm = Number(safeScores.midterm) || 0;
  const endterm = Number(safeScores.endterm) || 0;
  const total = cat1 + cat2 + midterm + endterm; // out of 30+30+100+100 = 260
  const average = (total / 260) * 100;
  return { cat1, cat2, midterm, endterm, total, average: Math.round(average * 10) / 10 };
}

export function gradeFor(average, boundaries) {
  const sorted = [...boundaries].sort((a, b) => b.min - a.min);
  for (const b of sorted) {
    if (average >= b.min) return b.grade;
  }
  return sorted[sorted.length - 1].grade;
}

export function remarkFor(grade) {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Very Good';
    case 'C': return 'Good';
    case 'D': return 'Needs Improvement';
    default: return 'At Risk';
  }
}

// Compute a per-subject average % for a student across the 4 assessments.
export function subjectAverage(subjectScores) {
  const { average } = computeRow(subjectScores);
  return average;
}

// Overall average across all subjects for a student.
export function studentOverall(student, subjects) {
  const avgs = subjects.map((s) => subjectAverage(student.scores[s]));
  const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  return Math.round(overall * 10) / 10;
}
