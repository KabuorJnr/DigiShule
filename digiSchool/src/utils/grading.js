// CBC & 8-4-4 Dual Curriculum Grade computation helpers.

export const CBC_BOUNDARIES = [
  { min: 90, grade: 'EE1', label: 'Exceeding Expectation (EE1)', pts: 8, remark: 'Exceeding Expectations' },
  { min: 75, grade: 'EE2', label: 'Exceeding Expectation (EE2)', pts: 7, remark: 'Exceeding Expectations' },
  { min: 58, grade: 'ME1', label: 'Meeting Expectation (ME1)', pts: 6, remark: 'Meeting Expectations' },
  { min: 41, grade: 'ME2', label: 'Meeting Expectation (ME2)', pts: 5, remark: 'Meeting Expectations' },
  { min: 31, grade: 'AE1', label: 'Approaching Expectation (AE1)', pts: 4, remark: 'Approaching Expectations' },
  { min: 21, grade: 'AE2', label: 'Approaching Expectation (AE2)', pts: 3, remark: 'Approaching Expectations' },
  { min: 11, grade: 'BE1', label: 'Below Expectation (BE1)', pts: 2, remark: 'Below Expectations' },
  { min: 0,  grade: 'BE2', label: 'Below Expectation (BE2)', pts: 1, remark: 'Below Expectations' },
];

export const KCSE_BOUNDARIES = [
  { min: 80, grade: 'A',  label: 'A Plain',  pts: 12, remark: 'Excellent' },
  { min: 75, grade: 'A-', label: 'A Minus',  pts: 11, remark: 'Very Good' },
  { min: 70, grade: 'B+', label: 'B Plus',   pts: 10, remark: 'Good' },
  { min: 65, grade: 'B',  label: 'B Plain',  pts: 9,  remark: 'Good' },
  { min: 60, grade: 'B-', label: 'B Minus',  pts: 8,  remark: 'Fairly Good' },
  { min: 55, grade: 'C+', label: 'C Plus',   pts: 7,  remark: 'Satisfactory' },
  { min: 50, grade: 'C',  label: 'C Plain',  pts: 6,  remark: 'Average' },
  { min: 45, grade: 'C-', label: 'C Minus',  pts: 5,  remark: 'Fair' },
  { min: 40, grade: 'D+', label: 'D Plus',   pts: 4,  remark: 'Below Average' },
  { min: 35, grade: 'D',  label: 'D Plain',  pts: 3,  remark: 'Poor' },
  { min: 30, grade: 'D-', label: 'D Minus',  pts: 2,  remark: 'Very Poor' },
  { min: 0,  grade: 'E',  label: 'E Plain',  pts: 1,  remark: 'Needs Serious Effort' },
];

export const CBC_SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Environmental Activities',
  'Social Studies',
  'Religious Education (CRE)',
  'Creative Arts',
  'Indigenous Language'
];

export const KCSE_844_SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Geography',
  'CRE',
  'Agriculture'
];

export const REPORT_CARD_SUBJECTS = CBC_SUBJECTS;

export function calculateStandardDeviation(numbers = []) {
  if (!numbers || numbers.length <= 1) return 0;
  const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
  if (validNumbers.length <= 1) return 0;
  const mean = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
  const variance = validNumbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (validNumbers.length - 1);
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function is844Class(className = '') {
  if (!className) return false;
  const str = String(className).trim().toLowerCase();
  return str.includes('form') || str.includes('8-4-4') || str.includes('844') || str.includes('kcse');
}

// Assesses 4 rubric scores out of 4 (e.g. strands). Returns average rubric.
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

// Map numerical average/score (0-100 or 1-4 rubric points) to a grade.
export function gradeFor(average, boundaries, systemType = 'CBC') {
  const defaultBoundaries = systemType === '844' ? KCSE_BOUNDARIES : CBC_BOUNDARIES;
  const bnds = boundaries && boundaries.length > 0 ? boundaries : defaultBoundaries;
  
  if (average === null || average === undefined || isNaN(average)) return '-';
  const num = Number(average);
  const fallback = systemType === '844' ? 'E' : 'BE';
  if (num === 0) return fallback;

  if (systemType === 'CBC' || systemType === 'cbc') {
    // Detect 1-4 rubric score scale and map to the 8-tier grades
    if (num > 0 && num <= 4) {
      if (num >= 3.5) return 'EE1';
      if (num >= 3.0) return 'EE2';
      if (num >= 2.5) return 'ME1';
      if (num >= 2.0) return 'ME2';
      if (num >= 1.5) return 'AE1';
      if (num >= 1.0) return 'AE2';
      if (num >= 0.5) return 'BE1';
      return 'BE2';
    }
  }

  for (const b of bnds) {
    if (num >= b.min) {
      return b.grade;
    }
  }
  return fallback;
}

export function fullGradeName(grade, systemType = 'CBC') {
  if (systemType === '844' || ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'].includes(grade)) {
    return grade || '-';
  }
  switch (grade) {
    case 'EE': return 'Exceeding Expectation (EE)';
    case 'ME': return 'Meeting Expectation (ME)';
    case 'AE': return 'Approaching Expectation (AE)';
    case 'BE': return 'Below Expectation (BE)';
    default:
      if (!grade || grade === '-') return '-';
      if (grade.includes('Expectation')) return grade;
      return grade;
  }
}

export function pointsForGrade(grade, systemType = 'CBC') {
  if (systemType === '844' || ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'].includes(grade)) {
    switch (grade) {
      case 'A':  return 12;
      case 'A-': return 11;
      case 'B+': return 10;
      case 'B':  return 9;
      case 'B-': return 8;
      case 'C+': return 7;
      case 'C':  return 6;
      case 'C-': return 5;
      case 'D+': return 4;
      case 'D':  return 3;
      case 'D-': return 2;
      case 'E':  return 1;
      default:   return 0;
    }
  }
  
  if (typeof grade === 'string' && grade.includes('EE1')) return 8;
  if (typeof grade === 'string' && grade.includes('EE2')) return 7;
  if (typeof grade === 'string' && grade.includes('ME1')) return 6;
  if (typeof grade === 'string' && grade.includes('ME2')) return 5;
  if (typeof grade === 'string' && grade.includes('AE1')) return 4;
  if (typeof grade === 'string' && grade.includes('AE2')) return 3;
  if (typeof grade === 'string' && grade.includes('BE1')) return 2;
  if (typeof grade === 'string' && grade.includes('BE2')) return 1;
  // Fallbacks for older 4-tier format
  if (typeof grade === 'string' && grade.includes('EE')) return 8;
  if (typeof grade === 'string' && grade.includes('ME')) return 6;
  if (typeof grade === 'string' && grade.includes('AE')) return 4;
  if (typeof grade === 'string' && grade.includes('BE')) return 2;
  return 0;
}

export function remarkFor(grade, systemType = 'CBC') {
  if (systemType === '844' || ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'].includes(grade)) {
    const kcseMatch = KCSE_BOUNDARIES.find(b => b.grade === grade);
    return kcseMatch ? kcseMatch.remark : 'No Score';
  }
  if (typeof grade === 'string') {
    if (grade.includes('EE')) return 'Exceeding Expectations';
    if (grade.includes('ME')) return 'Meeting Expectations';
    if (grade.includes('AE')) return 'Approaching Expectations';
    if (grade.includes('BE')) return 'Below Expectations';
  }
  return 'No Score';
}

// Compute per-subject average score for a student.
export function subjectAverage(subjectScores) {
  if (typeof subjectScores === 'number') return subjectScores;
  if (!subjectScores) return 0;
  if (subjectScores.score !== undefined) return Number(subjectScores.score);
  if (subjectScores.average !== undefined) {
    const avg = Number(subjectScores.average);
    return avg <= 4 && avg > 0 ? Math.round(avg * 25) : avg;
  }
  const { average } = computeRow(subjectScores);
  return average <= 4 && average > 0 ? Math.round(average * 25) : average;
}

// Overall average across all subjects for a student.
export function studentOverall(student, subjects) {
  const subs = subjects && subjects.length > 0 ? subjects : REPORT_CARD_SUBJECTS;
  const avgs = subs.map((s) => subjectAverage(student?.scores?.[s] || {}));
  const validAvgs = avgs.filter(v => v > 0);
  const overall = validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : 0;
  return Math.round(overall * 10) / 10;
}

// Compute full detailed report card object for a given student (supports both CBC and 8-4-4)
export function computeStudentReport({ student, students = [], subjects = [], examTitle = 'Term 1 Opening Exam', termName = 'Term 1', gradeBoundaries = [] }) {
  if (!student) return null;

  // Resolve enriched student object with scores if available in students array
  const richStudent = (student?.scores && Object.keys(student.scores).length > 0)
    ? student
    : (students.find(s => String(s.id) === String(student?.id) || (s.adm && String(s.adm) === String(student?.adm))) || student);
  
  const systemType = is844Class(richStudent.class || student.class) ? '844' : 'CBC';
  const defaultBnds = systemType === '844' ? KCSE_BOUNDARIES : CBC_BOUNDARIES;
  const targetBoundaries = gradeBoundaries && gradeBoundaries.length > 0 ? gradeBoundaries : defaultBnds;

  const targetSubjects = (subjects && subjects.length > 0) ? subjects : REPORT_CARD_SUBJECTS;
  
  // Class/Stream students
  const streamStudents = students.length > 0 
    ? students.filter(s => s.class === richStudent.class)
    : [richStudent];
  const activeStream = streamStudents.length > 0 ? streamStudents : [richStudent];
  
  // Overall students (same grade or form level prefix)
  const classLevel = richStudent.class ? richStudent.class.split(' ')[0] : '';
  const overallStudents = classLevel && students.length > 0
    ? students.filter(s => s.class && s.class.startsWith(classLevel))
    : (students.length > 0 ? students : [richStudent]);
  const activeOverall = overallStudents.length > 0 ? overallStudents : activeStream;

  // Helper to extract score 0-100 for a student in a subject
  const getScoreVal = (stu, sub) => {
    if (!stu) return 0;
    const sc = stu.scores?.[sub];
    if (sc === undefined || sc === null) return 0;
    if (typeof sc === 'number') return sc;
    if (sc.score !== undefined) return Number(sc.score);
    if (sc.average !== undefined) {
      const avg = Number(sc.average);
      return avg <= 4 && avg > 0 ? Math.round(avg * 25) : avg;
    }
    const { average } = computeRow(sc);
    return average <= 4 && average > 0 ? Math.round(average * 25) : average;
  };

  // Helper for student total marks
  const getStudentTotal = (stu) => {
    return targetSubjects.reduce((sum, s) => sum + getScoreVal(stu, s), 0);
  };

  // Compute subject details
  let totalMarks = 0;
  let totalPoints = 0;

  const subjectRows = targetSubjects.map((sub) => {
    const scoreVal = Math.round(getScoreVal(richStudent, sub));
    totalMarks += scoreVal;

    const gCode = gradeFor(scoreVal, targetBoundaries, systemType);
    const gFull = fullGradeName(gCode, systemType);
    const pts = pointsForGrade(gCode, systemType);
    const rmk = remarkFor(gCode, systemType);
    totalPoints += pts;

    // Subject position in stream
    const scoresInStream = activeStream.map(st => getScoreVal(st, sub)).sort((a, b) => b - a);
    const subjRank = scoresInStream.findIndex(sc => sc <= scoreVal) + 1;
    const positionText = `${subjRank || 1}/${activeStream.length || 1}`;

    return {
      subject: sub,
      score: scoreVal,
      maxScore: 100,
      scoreText: `${scoreVal}/100`,
      percentage: scoreVal,
      percentageText: `${scoreVal}%`,
      gradeCode: gCode,
      gradeFull: gFull,
      pts: pts,
      remark: rmk,
      position: positionText,
      subjRank: subjRank || 1,
      totalInStream: activeStream.length || 1
    };
  });

  const subjectCount = targetSubjects.length || 1;
  const meanPercentage = Math.round((totalMarks / subjectCount) * 10) / 10;
  const meanPoints = Math.round((totalPoints / subjectCount) * 10) / 10;
  const meanGradeCode = gradeFor(meanPercentage, targetBoundaries, systemType);
  const meanGradeFull = fullGradeName(meanGradeCode, systemType);

  // Stream Position
  const streamTotals = activeStream.map(st => ({ id: st.id, total: getStudentTotal(st) })).sort((a, b) => b.total - a.total);
  let streamRank = streamTotals.findIndex(t => String(t.id) === String(richStudent.id)) + 1;
  if (streamRank <= 0) streamRank = 1;
  const streamPositionText = `${streamRank} of ${activeStream.length}`;

  // Overall Position
  const overallTotals = activeOverall.map(st => ({ id: st.id, total: getStudentTotal(st) })).sort((a, b) => b.total - a.total);
  let overallRank = overallTotals.findIndex(t => String(t.id) === String(richStudent.id)) + 1;
  if (overallRank <= 0) overallRank = 1;
  const overallPositionText = `${overallRank} of ${activeOverall.length}`;

  // Standardize Class Display Name
  let formattedClassName = richStudent.class || student.class || 'Form 3';
  if (!formattedClassName.toLowerCase().includes('form') && !formattedClassName.toLowerCase().includes('grade')) {
    formattedClassName = `Grade ${formattedClassName}`;
  }

  const pointsScaleMax = systemType === '844' ? 12 : 8;
  const totalPointsText = systemType === '844'
    ? `${totalPoints} (${meanPoints.toFixed(1)} / ${pointsScaleMax} mean)`
    : `${totalPoints} (${meanPoints.toFixed(1)} mean)`;

  return {
    systemType: systemType,
    studentName: richStudent.name || student.name || 'Student Name',
    admissionNo: richStudent.adm || richStudent.admission_no || student.adm || student.admission_no || student.id || 'N/A',
    className: formattedClassName,
    streamPosition: streamPositionText,
    overallPosition: overallPositionText,
    totalPoints: totalPoints,
    meanPoints: meanPoints,
    maxPointsPerSubject: pointsScaleMax,
    totalPointsText: totalPointsText,
    examTitle: examTitle,
    termName: termName,
    subjectRows: subjectRows,
    totalMarks: totalMarks,
    meanPercentage: meanPercentage,
    meanPercentageText: `${meanPercentage.toFixed(1)}%`,
    meanGradeCode: meanGradeCode,
    meanGradeFull: meanGradeFull
  };
}
