// CBC & 8-4-4 Dual Curriculum Grade computation helpers.

export const CBC_BOUNDARIES = [
  { min: 80, grade: 'EE', label: 'Exceeding Expectation (EE)', pts: 4, remark: 'Exceeding Expectations' },
  { min: 50, grade: 'ME', label: 'Meeting Expectation (ME)', pts: 3, remark: 'Meeting Expectations' },
  { min: 30, grade: 'AE', label: 'Approaching Expectation (AE)', pts: 2, remark: 'Approaching Expectations' },
  { min: 0,  grade: 'BE', label: 'Below Expectation (BE)', pts: 1, remark: 'Below Expectations' },
];

export const KCSE_BOUNDARIES = [
  { min: 80, grade: 'A',  label: 'Plain A',  pts: 12, remark: 'Excellent' },
  { min: 75, grade: 'A-', label: 'A Minus',  pts: 11, remark: 'Very Good' },
  { min: 70, grade: 'B+', label: 'B Plus',   pts: 10, remark: 'Good' },
  { min: 65, grade: 'B',  label: 'Plain B',  pts: 9,  remark: 'Good' },
  { min: 60, grade: 'B-', label: 'B Minus',  pts: 8,  remark: 'Fairly Good' },
  { min: 55, grade: 'C+', label: 'C Plus',   pts: 7,  remark: 'Satisfactory' },
  { min: 50, grade: 'C',  label: 'Plain C',  pts: 6,  remark: 'Average' },
  { min: 45, grade: 'C-', label: 'C Minus',  pts: 5,  remark: 'Fair' },
  { min: 40, grade: 'D+', label: 'D Plus',   pts: 4,  remark: 'Below Average' },
  { min: 35, grade: 'D',  label: 'Plain D',  pts: 3,  remark: 'Poor' },
  { min: 30, grade: 'D-', label: 'D Minus',  pts: 2,  remark: 'Very Poor' },
  { min: 0,  grade: 'E',  label: 'Grade E',  pts: 1,  remark: 'Needs Serious Effort' },
];

export const REPORT_CARD_SUBJECTS = [
  'Creative Arts',
  'English',
  'Environmental Activities',
  'Indigenous Language',
  'Kiswahili',
  'Mathematics',
  'Religious Education (CRE)',
  'Social Studies'
];

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
    // Detect 1-4 rubric score scale and map to EE, ME, AE, BE
    if (num > 0 && num <= 4) {
      if (num >= 3.5) return 'EE'; // 4 -> EE
      if (num >= 2.5) return 'ME'; // 3 -> ME
      if (num >= 1.5) return 'AE'; // 2 -> AE
      return 'BE';                 // 1 -> BE
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
  
  if (typeof grade === 'string' && grade.includes('EE')) return 4;
  if (typeof grade === 'string' && grade.includes('ME')) return 3;
  if (typeof grade === 'string' && grade.includes('AE')) return 2;
  if (typeof grade === 'string' && grade.includes('BE')) return 1;
  switch (grade) {
    case 'EE': return 4;
    case 'ME': return 3;
    case 'AE': return 2;
    case 'BE': return 1;
    default: return 0;
  }
}

export function remarkFor(grade, systemType = 'CBC') {
  if (systemType === '844' || ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'].includes(grade)) {
    const kcseMatch = KCSE_BOUNDARIES.find(b => b.grade === grade);
    return kcseMatch ? kcseMatch.remark : 'No Score';
  }
  switch (grade) {
    case 'EE': return 'Exceeding Expectations';
    case 'ME': return 'Meeting Expectations';
    case 'AE': return 'Approaching Expectations';
    case 'BE': return 'Below Expectations';
    default: return 'No Score';
  }
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
  
  const systemType = is844Class(student.class) ? '844' : 'CBC';
  const defaultBnds = systemType === '844' ? KCSE_BOUNDARIES : CBC_BOUNDARIES;
  const targetBoundaries = gradeBoundaries && gradeBoundaries.length > 0 ? gradeBoundaries : defaultBnds;

  const targetSubjects = (subjects && subjects.length > 0) ? subjects : REPORT_CARD_SUBJECTS;
  
  // Class/Stream students
  const streamStudents = students.length > 0 
    ? students.filter(s => s.class === student.class)
    : [student];
  const activeStream = streamStudents.length > 0 ? streamStudents : [student];
  
  // Overall students (same grade or form level prefix)
  const classLevel = student.class ? student.class.split(' ')[0] : '';
  const overallStudents = classLevel && students.length > 0
    ? students.filter(s => s.class && s.class.startsWith(classLevel))
    : (students.length > 0 ? students : [student]);
  const activeOverall = overallStudents.length > 0 ? overallStudents : activeStream;

  // Helper to extract score 0-100 for a student in a subject
  const getScoreVal = (stu, sub) => {
    const sc = stu.scores?.[sub];
    if (sc === undefined || sc === null) return 0;
    if (typeof sc === 'number') return sc;
    if (sc.score !== undefined) return Number(sc.score);
    if (sc.average !== undefined) {
      const avg = Number(sc.average);
      return avg <= 4 && avg > 0 ? Math.round(avg * 25) : avg;
    }
    const { average } = computeRow(sc);
    return average <= 4 && average > 0 ? Math.round(avg * 25) : average;
  };

  // Helper for student total marks
  const getStudentTotal = (stu) => {
    return targetSubjects.reduce((sum, s) => sum + getScoreVal(stu, s), 0);
  };

  // Compute subject details
  let totalMarks = 0;
  let totalPoints = 0;

  const subjectRows = targetSubjects.map((sub) => {
    const scoreVal = Math.round(getScoreVal(student, sub));
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
  let streamRank = streamTotals.findIndex(t => t.id === student.id) + 1;
  if (streamRank <= 0) streamRank = 1;
  const streamPositionText = `${streamRank} of ${activeStream.length}`;

  // Overall Position
  const overallTotals = activeOverall.map(st => ({ id: st.id, total: getStudentTotal(st) })).sort((a, b) => b.total - a.total);
  let overallRank = overallTotals.findIndex(t => t.id === student.id) + 1;
  if (overallRank <= 0) overallRank = 1;
  const overallPositionText = `${overallRank} of ${activeOverall.length}`;

  // Standardize Class Display Name
  let formattedClassName = student.class || 'Form 3';
  if (!formattedClassName.toLowerCase().includes('form') && !formattedClassName.toLowerCase().includes('grade')) {
    formattedClassName = `Grade ${formattedClassName}`;
  }

  const pointsScaleMax = systemType === '844' ? 12 : 4;
  const totalPointsText = systemType === '844'
    ? `${totalPoints} (${meanPoints.toFixed(1)} / ${pointsScaleMax} mean)`
    : `${totalPoints} (${meanPoints.toFixed(1)} mean)`;

  return {
    systemType: systemType,
    studentName: student.name || 'Student Name',
    admissionNo: student.adm || student.admission_no || student.id || 'N/A',
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
