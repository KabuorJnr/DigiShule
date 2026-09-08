import { useMemo, useState } from 'react';
import { 
  studentOverall, gradeFor, pointsForGrade, subjectAverage, 
  is844Class, calculateStandardDeviation, CBC_SUBJECTS, KCSE_844_SUBJECTS,
  getSubjectAbbr, SUBJECT_ABBREVIATIONS
} from '../utils/grading';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { poppinsRegular } from '../utils/Poppins-Regular';
import { poppinsBold } from '../utils/Poppins-Bold';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge, ProgressBar } from './widgets';
import { 
  Award, Download, Filter, Search, ArrowUp, ArrowDown, 
  TrendingUp, TrendingDown, Minus, FileSpreadsheet, CheckCircle2, Lock, Unlock, Edit3, Save,
  CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, BookOpen, ChevronRight,
  Trophy, Medal, Users, Layers, GraduationCap, Printer, Eye, BarChart2, Home
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

export default function MeritListModule({ 
  students = [], 
  schoolSettings = {}, 
  teachers = [], 
  classes = [], 
  userRole = 'dos', 
  currentStudentId = null,
  notify = console.log,
  onUpdateStudentScores = null,
  onUpdateSettings = null,
  onNavigateGradebook = null
}) {
  // ── EXECUTIVE READ & WRITE PERMISSION ──
  const isExecutive = useMemo(() => {
    const role = (userRole || '').toLowerCase();
    return ['dos', 'deputy_academic', 'principal', 'admin', 'super_admin'].includes(role);
  }, [userRole]);

  // ── PUBLICATION & EDITING STATE ──
  const isPublished = !!schoolSettings?.results_published;
  const [publishedInfo, setPublishedInfo] = useState(() => {
    if (schoolSettings?.results_published) {
      return {
        approverRole: 'Director of Studies (DoS)',
        approvedAt: 'Certified Official'
      };
    }
    return null;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedScores, setEditedScores] = useState({}); // { studentId_subject: score }
  const principalSig = schoolSettings?.principal_signature_url || schoolSettings?.signature_url || null;

  // ── CONTROLS STATE ──
  const [modelMode, setModelMode] = useState('auto'); // 'auto' | 'cbc' | '844'
  const [viewScope, setViewScope] = useState('overall'); // 'overall' | 'stream'
  const [activeAnalyticsView, setActiveAnalyticsView] = useState('broadsheet'); // 'broadsheet' | 'stream_breakdown' | 'subject_leaderboard'
  const [selectedBreakdownSubject, setSelectedBreakdownSubject] = useState('All');
  const [selectedExamSeries, setSelectedExamSeries] = useState(() => schoolSettings?.current_exam || 'Opener - Term 2 2026');
  const [selectedClass, setSelectedClass] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [passThreshold, setPassThreshold] = useState(50); // Pass mark threshold %
  const [sortField, setSortField] = useState('rank'); // 'rank' | 'name' | 'adm' | 'total' | 'avg' | subjectName
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Extract dynamic class names
  const classOptions = useMemo(() => {
    if (!students || students.length === 0) {
      const expanded = classes.reduce((acc, c) => {
        if (typeof c === 'string') return [...acc, c];
        if (!c.streams) return [...acc, c.name];
        const streams = c.streams.split(',').map(s => s.trim()).filter(Boolean);
        return [...acc, ...(streams.length ? streams.map(s => `${c.name} ${s}`) : [c.name])];
      }, []);
      return ['All', ...expanded];
    }
    const set = new Set(students.map(s => s.class).filter(Boolean));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [students, classes]);

  // Determine active curriculum model
  const activeCurriculum = useMemo(() => {
    if (modelMode !== 'auto') return modelMode.toUpperCase();
    if (selectedClass !== 'All') {
      return is844Class(selectedClass) ? '844' : 'CBC';
    }
    const sample844 = students.some(s => is844Class(s.class));
    return sample844 ? '844' : 'CBC';
  }, [modelMode, selectedClass, students]);

  // Active subject list based on curriculum model
  const activeSubjects = useMemo(() => {
    return activeCurriculum === '844' ? KCSE_844_SUBJECTS : CBC_SUBJECTS;
  }, [activeCurriculum]);

  // Filter & Evaluate Students with Live Score Overrides
  const allEvaluatedStudents = useMemo(() => {
    let list = students.filter(s => 
      s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending'
    );

    const evaluated = list.map(s => {
      const is844 = activeCurriculum === '844' || is844Class(s.class);
      const effectiveScores = { ...(s.scores || {}) };
      activeSubjects.forEach(sub => {
        const overrideKey = `${s.id}_${sub}`;
        if (editedScores[overrideKey] !== undefined) {
          effectiveScores[sub] = Number(editedScores[overrideKey]) || 0;
        }
      });

      const studentWithEffectiveScores = { ...s, scores: effectiveScores };
      const overallPct = studentOverall(studentWithEffectiveScores, activeSubjects);
      const grade = gradeFor(overallPct, schoolSettings?.gradeBoundaries, is844 ? '844' : 'CBC');
      const pts = pointsForGrade(grade, is844 ? '844' : 'CBC');

      const subjectScoresMap = {};
      let total = 0;

      activeSubjects.forEach(sub => {
        const val = subjectAverage(effectiveScores[sub]);
        subjectScoresMap[sub] = val;
        total += val;
      });

      const average = activeSubjects.length > 0 ? Math.round((total / activeSubjects.length) * 10) / 10 : 0;
      const isPassed = is844 ? average >= passThreshold : (grade === 'EE' || grade === 'ME' || average >= passThreshold);

      return {
        id: s.id,
        adm: s.adm || s.admission_no || '-',
        name: s.name || 'Unnamed Student',
        class: s.class || '-',
        gender: s.gender || '-',
        scores: subjectScoresMap,
        totalMarks: Math.round(total),
        averagePct: average,
        meanGrade: grade,
        points: pts,
        isPassed,
        raw: studentWithEffectiveScores
      };
    });

    evaluated.sort((a, b) => b.totalMarks - a.totalMarks);

    evaluated.forEach((s, idx) => {
      s.overallRank = idx + 1;
      s.rank = idx + 1; // Default
    });

    const streamGroups = {};
    evaluated.forEach(s => {
      const c = s.class || 'Unknown';
      if (!streamGroups[c]) streamGroups[c] = [];
      streamGroups[c].push(s);
    });

    Object.values(streamGroups).forEach(group => {
      group.forEach((s, idx) => {
        s.streamRank = idx + 1;
        s.streamTotal = group.length;
      });
    });

    return evaluated;
  }, [students, activeCurriculum, activeSubjects, passThreshold, schoolSettings, editedScores]);

  const evaluatedStudents = useMemo(() => {
    let list = allEvaluatedStudents;

    if (selectedClass !== 'All') {
      list = list.filter(s => s.class === selectedClass);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.name || '').toLowerCase().includes(q) || 
        (s.adm || s.admission_no || '').toLowerCase().includes(q)
      );
    }

    let ranked = list.map(s => ({
      ...s,
      rank: viewScope === 'stream' ? s.streamRank : s.overallRank
    }));
    
    // Maintain backwards compat with sorting
    if (sortField === 'rank') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.rank - b.rank : b.rank - a.rank);
    } else if (sortField === 'name') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortField === 'adm') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.adm.localeCompare(b.adm) : b.adm.localeCompare(a.adm));
    } else if (sortField === 'total') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.totalMarks - b.totalMarks : b.totalMarks - a.totalMarks);
    } else if (sortField === 'avg') {
      ranked.sort((a, b) => sortDirection === 'asc' ? a.averagePct - b.averagePct : b.averagePct - a.averagePct);
    } else if (activeSubjects.includes(sortField)) {
      ranked.sort((a, b) => {
        const scA = a.scores[sortField] || 0;
        const scB = b.scores[sortField] || 0;
        return sortDirection === 'asc' ? scA - scB : scB - scA;
      });
    }

    return ranked;
  }, [students, selectedClass, searchQuery, activeCurriculum, activeSubjects, passThreshold, schoolSettings, sortField, sortDirection, editedScores, viewScope]);

  // Handle Score Input Change (Exec Only)
  const handleScoreChange = (studentId, subject, val) => {
    if (!isExecutive) return;
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    setEditedScores(prev => ({
      ...prev,
      [`${studentId}_${subject}`]: num
    }));
  };

  // Save Score Modifications
  const handleSaveAllScores = () => {
    if (onUpdateStudentScores) {
      onUpdateStudentScores(editedScores);
    }
    setIsEditing(false);
    notify('Student scores updated and saved successfully!', 'success');
  };

  // Handle Sort Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'adm' ? 'asc' : 'desc');
    }
  };

  // Toggle Publication (Executive Only)
  const handleTogglePublication = async () => {
    if (!isExecutive) return;
    const nextState = !isPublished;
    if (nextState) {
      const info = {
        approverRole: userRole === 'dos' ? 'Director of Studies (DoS)' : userRole === 'principal' ? 'Principal' : 'Deputy Academics',
        approvedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      setPublishedInfo(info);
    } else {
      setPublishedInfo(null);
    }

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ results_published: nextState });
      } catch (err) {
        console.error('Failed to update publication settings:', err);
      }
    }

    notify(
      nextState
        ? `Official Results APPROVED & PUBLISHED! Principal signature & DoS stamps active on all report forms.`
        : 'Merit list publication returned to DRAFT mode for moderation.',
      nextState ? 'success' : 'info'
    );
  };

  // ── CLASS & SUBJECT ANALYSIS LAYER ──
  const subjectAnalysis = useMemo(() => {
    if (evaluatedStudents.length === 0) return {};

    const analysis = {};
    const subMeans = [];

    activeSubjects.forEach(sub => {
      const scores = evaluatedStudents.map(s => s.scores[sub] || 0);
      const satScores = scores.filter(sc => sc > 0);
      const sum = scores.reduce((a, b) => a + b, 0);
      const entry = satScores.length;
      const mean = Math.round((sum / (scores.length || 1)) * 10) / 10;
      const sd = calculateStandardDeviation(scores);

      let topVal = -1;
      let topStudent = 'None';
      let lowestVal = 100;

      evaluatedStudents.forEach(s => {
        const val = s.scores[sub] || 0;
        if (val > topVal) {
          topVal = val;
          topStudent = `${s.name} (${val})`;
        }
        if (val > 0 && val < lowestVal) {
          lowestVal = val;
        }
      });

      const passedCount = scores.filter(sc => sc >= passThreshold).length;
      const passPct = Math.round((passedCount / (scores.length || 1)) * 100);

      // GPA calculation
      let ptsSum = 0;
      satScores.forEach(sc => {
        const g = gradeFor(sc, schoolSettings?.gradeBoundaries, activeCurriculum);
        ptsSum += pointsForGrade(g, activeCurriculum);
      });
      const gpa = entry > 0 ? (ptsSum / entry).toFixed(3) : '0.000';
      const meanGrade = gradeFor(mean, schoolSettings?.gradeBoundaries, activeCurriculum);

      analysis[sub] = {
        name: sub,
        abbr: getSubjectAbbr(sub),
        entry,
        mean,
        sd,
        topStudent,
        topScore: topVal > 0 ? topVal : 0,
        lowestScore: lowestVal === 100 ? 0 : lowestVal,
        gpa,
        meanGrade,
        passPct
      };

      subMeans.push({ sub, mean });
    });

    subMeans.sort((a, b) => b.mean - a.mean);
    subMeans.forEach((item, idx) => {
      if (analysis[item.sub]) {
        analysis[item.sub].rank = idx + 1;
      }
    });

    return analysis;
  }, [evaluatedStudents, activeSubjects, passThreshold, schoolSettings, activeCurriculum]);

  // Overall Class Statistics
  const classStats = useMemo(() => {
    if (evaluatedStudents.length === 0) {
      return { total: 0, meanScore: 0, overallGrade: '-', passRate: 0, topSubject: '-', weakSubject: '-' };
    }

    const totalStudents = evaluatedStudents.length;
    const overallMeanSum = evaluatedStudents.reduce((acc, s) => acc + s.averagePct, 0);
    const meanScore = Math.round((overallMeanSum / totalStudents) * 10) / 10;
    const overallGrade = gradeFor(meanScore, schoolSettings?.gradeBoundaries, activeCurriculum);

    const passedStudents = evaluatedStudents.filter(s => s.isPassed).length;
    const passRate = Math.round((passedStudents / totalStudents) * 100);

    let bestSub = '-';
    let highestMean = -1;
    let worstSub = '-';
    let lowestMean = 999;

    Object.entries(subjectAnalysis).forEach(([sub, data]) => {
      if (data.mean > highestMean) {
        highestMean = data.mean;
        bestSub = sub;
      }
      if (data.mean < lowestMean && data.mean > 0) {
        lowestMean = data.mean;
        worstSub = sub;
      }
    });

    return {
      total: totalStudents,
      meanScore,
      overallGrade,
      passRate,
      passedStudents,
      topSubject: bestSub !== '-' ? `${bestSub} (${highestMean}%)` : '-',
      weakSubject: worstSub !== '-' && worstSub !== bestSub ? `${worstSub} (${lowestMean}%)` : '-'
    };
  }, [evaluatedStudents, schoolSettings, activeCurriculum, subjectAnalysis]);

  // Teacher & TSC resolver
  const getSubjectTeacherInfo = (subjectName, streamName) => {
    if (!teachers || teachers.length === 0) return { name: 'Assigned Faculty', tscNo: '-' };
    const sNameLower = (subjectName || '').toLowerCase();
    const stNameLower = (streamName || '').toLowerCase();

    const match = teachers.find(t => {
      const subs = Array.isArray(t.subjects) ? t.subjects : String(t.subjects || t.subject || '').split(',').map(s => s.trim().toLowerCase());
      const subMatch = subs.some(s => s.includes(sNameLower) || sNameLower.includes(s));
      if (!subMatch) return false;
      if (!streamName || streamName === 'All') return true;
      const cls = Array.isArray(t.classes) ? t.classes : String(t.classes || t.class || '').split(',').map(c => c.trim().toLowerCase());
      return cls.length === 0 || cls.some(c => stNameLower.includes(c) || c.includes(stNameLower));
    });

    if (match) {
      return {
        name: match.name || 'Faculty',
        tscNo: match.tsc_number || match.tscNo || match.tsc || (match.id ? `TSC-${String(match.id).slice(0, 6)}` : '-')
      };
    }

    const anySub = teachers.find(t => {
      const subs = Array.isArray(t.subjects) ? t.subjects : String(t.subjects || t.subject || '').split(',').map(s => s.trim().toLowerCase());
      return subs.some(s => s.includes(sNameLower) || sNameLower.includes(s));
    });

    if (anySub) {
      return {
        name: anySub.name,
        tscNo: anySub.tsc_number || anySub.tscNo || anySub.tsc || '-'
      };
    }

    return { name: 'Teacher', tscNo: '-' };
  };

  // ── ZERAKI STREAM BREAKDOWN DATA ──
  const streamBreakdownData = useMemo(() => {
    if (!allEvaluatedStudents || allEvaluatedStudents.length === 0) {
      return { streams: [], gradeGrades: [], cohortTotalStudents: 0, cohortMeanMarks: 0, cohortMeanPts: 0, cohortGrade: '-' };
    }

    const is844 = activeCurriculum === '844';
    const gradeGrades = is844 
      ? ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E']
      : ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];

    const streamsMap = {};
    allEvaluatedStudents.forEach(s => {
      const c = s.class || 'Unassigned';
      if (!streamsMap[c]) streamsMap[c] = [];
      streamsMap[c].push(s);
    });

    const cohortTotalStudents = allEvaluatedStudents.length;
    const cohortTotalMarks = allEvaluatedStudents.reduce((acc, s) => acc + s.averagePct, 0);
    const cohortMeanMarks = cohortTotalStudents > 0 ? Math.round((cohortTotalMarks / cohortTotalStudents) * 10) / 10 : 0;
    const cohortTotalPts = allEvaluatedStudents.reduce((acc, s) => acc + (s.points || 0), 0);
    const cohortMeanPts = cohortTotalStudents > 0 ? Math.round((cohortTotalPts / cohortTotalStudents) * 10000) / 10000 : 0;

    const list = Object.entries(streamsMap).map(([streamName, stList]) => {
      const entries = stList.length;
      const sumMarks = stList.reduce((acc, s) => acc + s.averagePct, 0);
      const meanMarks = Math.round((sumMarks / (entries || 1)) * 10) / 10;
      const sumPts = stList.reduce((acc, s) => acc + (s.points || 0), 0);
      const meanPoints = Math.round((sumPts / (entries || 1)) * 10000) / 10000;
      const grade = gradeFor(meanMarks, schoolSettings?.gradeBoundaries, activeCurriculum);

      let topStudent = null;
      stList.forEach(s => {
        if (!topStudent || s.averagePct > topStudent.averagePct) topStudent = s;
      });

      const gradeCounts = {};
      gradeGrades.forEach(g => { gradeCounts[g] = 0; });
      gradeCounts['X'] = 0;
      gradeCounts['Y'] = 0;

      stList.forEach(s => {
        const g = s.meanGrade;
        if (gradeCounts[g] !== undefined) {
          gradeCounts[g] += 1;
        } else if (gradeCounts[g?.substring(0, 2)] !== undefined) {
          gradeCounts[g.substring(0, 2)] += 1;
        }
      });

      const passed = stList.filter(s => s.isPassed).length;
      const passRate = Math.round((passed / (entries || 1)) * 100);

      const marksDeviation = Math.round((meanMarks - cohortMeanMarks) * 100) / 100;
      const pointsDeviation = Math.round((meanPoints - cohortMeanPts) * 10000) / 10000;

      return {
        stream: streamName,
        entries,
        meanMarks,
        meanPoints,
        grade,
        marksDeviation,
        pointsDeviation,
        gradeCounts,
        topStudent: topStudent ? `${topStudent.name} (${topStudent.averagePct.toFixed(1)}%)` : '-',
        passRate,
        students: stList
      };
    });

    list.sort((a, b) => b.meanMarks - a.meanMarks);
    list.forEach((item, idx) => { item.rank = idx + 1; });

    return {
      streams: list,
      gradeGrades,
      cohortTotalStudents,
      cohortMeanMarks,
      cohortMeanPts,
      cohortGrade: gradeFor(cohortMeanMarks, schoolSettings?.gradeBoundaries, activeCurriculum)
    };
  }, [allEvaluatedStudents, activeCurriculum, schoolSettings]);

  // ── ZERAKI SUBJECT BREAKDOWN BY STREAM ──
  const subjectStreamBreakdown = useMemo(() => {
    if (!allEvaluatedStudents || allEvaluatedStudents.length === 0) return { targetSubject: 'None', gradeGrades: [], rows: [], totalRow: null };

    const targetSubject = selectedBreakdownSubject === 'All' ? (activeSubjects[0] || 'Mathematics') : selectedBreakdownSubject;
    const is844 = activeCurriculum === '844';
    const gradeGrades = is844 
      ? ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E']
      : ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];

    // Cohort stats in this subject
    const cohortScores = allEvaluatedStudents.map(s => s.scores[targetSubject] || 0).filter(v => v > 0);
    const cohortEntries = cohortScores.length;
    const cohortSumMarks = cohortScores.reduce((a, b) => a + b, 0);
    const cohortMeanMarks = cohortEntries > 0 ? Math.round((cohortSumMarks / cohortEntries) * 10) / 10 : 0;
    const cohortPts = cohortScores.map(sc => pointsForGrade(gradeFor(sc, schoolSettings?.gradeBoundaries, activeCurriculum), activeCurriculum));
    const cohortMeanPts = cohortEntries > 0 ? Math.round((cohortPts.reduce((a, b) => a + b, 0) / cohortEntries) * 10000) / 10000 : 0;
    const cohortGrade = gradeFor(cohortMeanMarks, schoolSettings?.gradeBoundaries, activeCurriculum);

    const streamsMap = {};
    allEvaluatedStudents.forEach(s => {
      const c = s.class || 'Unassigned';
      if (!streamsMap[c]) streamsMap[c] = [];
      streamsMap[c].push(s);
    });

    const rows = Object.entries(streamsMap).map(([streamName, stList]) => {
      const scores = stList.map(s => s.scores[targetSubject] || 0).filter(v => v > 0);
      const entries = scores.length;
      const sumMarks = scores.reduce((a, b) => a + b, 0);
      const meanMarks = entries > 0 ? Math.round((sumMarks / entries) * 10) / 10 : 0;
      
      const ptsArr = scores.map(sc => pointsForGrade(gradeFor(sc, schoolSettings?.gradeBoundaries, activeCurriculum), activeCurriculum));
      const meanPoints = entries > 0 ? Math.round((ptsArr.reduce((a, b) => a + b, 0) / entries) * 10000) / 10000 : 0;
      const grade = gradeFor(meanMarks, schoolSettings?.gradeBoundaries, activeCurriculum);

      const gradeCounts = {};
      gradeGrades.forEach(g => { gradeCounts[g] = 0; });
      gradeCounts['X'] = 0;
      gradeCounts['Y'] = 0;

      scores.forEach(sc => {
        const g = gradeFor(sc, schoolSettings?.gradeBoundaries, activeCurriculum);
        if (gradeCounts[g] !== undefined) {
          gradeCounts[g] += 1;
        } else if (gradeCounts[g?.substring(0, 2)] !== undefined) {
          gradeCounts[g.substring(0, 2)] += 1;
        }
      });

      const marksDeviation = Math.round((meanMarks - cohortMeanMarks) * 100) / 100;
      const pointsDeviation = Math.round((meanPoints - cohortMeanPts) * 10000) / 10000;
      const teacherInfo = getSubjectTeacherInfo(targetSubject, streamName);

      return {
        stream: streamName,
        entries,
        meanMarks,
        marksDeviation,
        meanPoints,
        pointsDeviation,
        grade,
        gradeCounts,
        teacher: teacherInfo.name,
        tscNo: teacherInfo.tscNo
      };
    });

    rows.sort((a, b) => b.meanMarks - a.meanMarks);

    // Total Cohort Grade counts
    const totalGradeCounts = {};
    gradeGrades.forEach(g => {
      totalGradeCounts[g] = rows.reduce((acc, r) => acc + (r.gradeCounts[g] || 0), 0);
    });
    totalGradeCounts['X'] = rows.reduce((acc, r) => acc + (r.gradeCounts['X'] || 0), 0);
    totalGradeCounts['Y'] = rows.reduce((acc, r) => acc + (r.gradeCounts['Y'] || 0), 0);

    const totalRow = {
      stream: selectedClass === 'All' ? 'Overall Cohort' : selectedClass,
      entries: cohortEntries,
      meanMarks: cohortMeanMarks,
      marksDeviation: 0,
      meanPoints: cohortMeanPts,
      pointsDeviation: 0,
      grade: cohortGrade,
      gradeCounts: totalGradeCounts,
      teacher: 'All Faculty',
      tscNo: '-'
    };

    return {
      targetSubject,
      gradeGrades,
      rows,
      totalRow
    };
  }, [allEvaluatedStudents, selectedBreakdownSubject, activeSubjects, activeCurriculum, schoolSettings, selectedClass]);

  // ── ZERAKI SUBJECT PERFORMANCE LEADERBOARD ──
  const subjectLeaderboardData = useMemo(() => {
    if (!allEvaluatedStudents || allEvaluatedStudents.length === 0) return [];

    const totalCohortMarks = allEvaluatedStudents.reduce((acc, s) => acc + s.averagePct, 0);
    const cohortAverage = allEvaluatedStudents.length > 0 ? totalCohortMarks / allEvaluatedStudents.length : 0;

    const list = activeSubjects.map(sub => {
      const scores = allEvaluatedStudents.map(s => s.scores[sub] || 0).filter(v => v > 0);
      const entries = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const mean = entries > 0 ? Math.round((sum / entries) * 10000) / 10000 : 0;
      const meanPct = entries > 0 ? Math.round((sum / entries) * 10) / 10 : 0;
      const grade = gradeFor(meanPct, schoolSettings?.gradeBoundaries, activeCurriculum);
      const deviation = Math.round((meanPct - cohortAverage) * 10000) / 10000;
      const trend = deviation >= 0 ? 'up' : 'down';

      return {
        name: sub,
        abbr: getSubjectAbbr(sub),
        entries,
        mean: mean.toFixed(3),
        meanPct,
        deviation: (deviation >= 0 ? '+' : '') + deviation.toFixed(4),
        trend,
        grade
      };
    });

    list.sort((a, b) => b.meanPct - a.meanPct);
    return list;
  }, [allEvaluatedStudents, activeSubjects, activeCurriculum, schoolSettings]);

  // Parent View Filtering
  const displayedStudents = useMemo(() => {
    if (userRole === 'parent' && currentStudentId) {
      return evaluatedStudents.filter(s => String(s.id) === String(currentStudentId));
    }
    return evaluatedStudents;
  }, [evaluatedStudents, userRole, currentStudentId]);

  // ── 1. BROADSHEET PDF EXPORT (MARKS ONLY, ABBR HEADERS, CRISP WHITE PAPER) ──
  const handleExportPDF = () => {
    if (evaluatedStudents.length === 0) return notify('No students to export', 'warning');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    doc.addFileToVFS('Poppins-Regular.ttf', poppinsRegular);
    doc.addFileToVFS('Poppins-Bold.ttf', poppinsBold);
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // -- HEADER SECTION (NO COLLISION) --
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(4, 120, 87); // Brand emerald
    doc.text((schoolSettings?.name || 'DIGISHULE ACADEMY').toUpperCase(), pageWidth / 2, 30, { align: 'center' });
    
    // School contact line (address · tel · email)
    doc.setFont('Poppins', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const contactParts = [schoolSettings?.address, schoolSettings?.phone || schoolSettings?.tel, schoolSettings?.email].filter(Boolean);
    if (contactParts.length) doc.text(contactParts.join('   ·   '), pageWidth / 2, 42, { align: 'center' });

    doc.setFont('Poppins', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const subTitle = viewScope === 'stream' && selectedClass !== 'All'
      ? `STREAM MERIT LIST - STREAM ${selectedClass.toUpperCase()} - ${selectedExamSeries.toUpperCase()}`
      : `OVERALL CLASS MERIT LIST - ALL STREAMS - ${selectedExamSeries.toUpperCase()}`;
    doc.text(subTitle, pageWidth / 2, contactParts.length ? 54 : 46, { align: 'center' });

    // Thin brand rule under the header
    doc.setDrawColor(4, 120, 87);
    doc.setLineWidth(0.75);
    doc.line(margin, contactParts.length ? 59 : 51, pageWidth - margin, contactParts.length ? 59 : 51);

    doc.setFont('Poppins', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Printed: ${new Date().toLocaleDateString('en-GB')}  |  Curriculum: ${activeCurriculum}  |  Pass Threshold: ${passThreshold}%  |  Candidature: ${evaluatedStudents.length} Students`,
      pageWidth / 2, contactParts.length ? 68 : 60, { align: 'center' }
    );

    // -- TABLE STRUCTURE: SINGLE ROW HEADER, ABBREVIATIONS --
    const head = [
      { content: 'SN', styles: { halign: 'center' } },
      { content: 'ADM', styles: { halign: 'center' } },
      { content: "CANDIDATE'S NAME", styles: { halign: 'left' } },
      { content: 'SEX', styles: { halign: 'center' } },
    ];
    activeSubjects.forEach(sub => {
      head.push({ content: getSubjectAbbr(sub), styles: { halign: 'center' } });
    });
    head.push({ content: 'TOTAL', styles: { halign: 'center' } });
    head.push({ content: 'MEAN %', styles: { halign: 'center' } });
    head.push({ content: activeCurriculum === '844' ? 'GRADE' : 'COMP', styles: { halign: 'center' } });
    head.push({ content: 'PTS', styles: { halign: 'center' } });
    head.push({ content: 'STR POS', styles: { halign: 'center' } });
    head.push({ content: 'OVR POS', styles: { halign: 'center' } });

    const body = [];
    
    // Main Student Rows (MARKS ONLY! NO GRADES SUBCOLUMN)
    evaluatedStudents.forEach((s, idx) => {
      const row = [
        idx + 1,
        s.adm || '-',
        s.name.toUpperCase(),
        (s.gender || 'M').charAt(0).toUpperCase()
      ];
      activeSubjects.forEach(sub => {
        const score = s.scores[sub];
        row.push(score > 0 ? score : '-');
      });
      row.push(s.totalMarks);
      row.push(s.averagePct.toFixed(1));
      row.push(s.meanGrade);
      row.push(s.points);
      row.push(`${s.streamRank}/${s.streamTotal || evaluatedStudents.length}`);
      row.push(`${s.overallRank}/${allEvaluatedStudents.length}`);
      body.push(row);
    });

    // Compute ranks for subjects based on average
    const subAverages = activeSubjects.map(sub => {
      let sum = 0, count = 0;
      evaluatedStudents.forEach(s => { if (s.scores[sub] > 0) { sum += s.scores[sub]; count++; } });
      return { sub, avg: count > 0 ? sum / count : 0 };
    }).sort((a, b) => b.avg - a.avg);
    subAverages.forEach((item, idx) => item.rank = idx + 1);

    // Summary Rows (Rectangular, 100% column-aligned, no awkward merged cells)
    // Row 1: SUBJECT MEAN (%)
    const meanRow = ['', '', { content: 'SUBJECT MEAN (%)', styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }, ''];
    activeSubjects.forEach(sub => {
      const item = subAverages.find(x => x.sub === sub);
      meanRow.push({ content: item && item.avg > 0 ? Math.round(item.avg * 10) / 10 : '-', styles: { halign: 'center', fontStyle: 'bold' } });
    });
    meanRow.push({ content: '-', styles: { halign: 'center' } });
    meanRow.push({ content: `${classStats.meanScore}%`, styles: { halign: 'center', fontStyle: 'bold' } });
    meanRow.push({ content: classStats.overallGrade, styles: { halign: 'center', fontStyle: 'bold' } });
    meanRow.push({ content: '-', styles: { halign: 'center' } });
    meanRow.push({ content: '-', styles: { halign: 'center' } });
    meanRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(meanRow);

    // Row 2: SUBJECT GRADE
    const gradeRow = ['', '', { content: 'SUBJECT GRADE', styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }, ''];
    activeSubjects.forEach(sub => {
      const item = subAverages.find(x => x.sub === sub);
      const g = item && item.avg > 0 ? gradeFor(item.avg, schoolSettings?.gradeBoundaries, activeCurriculum) : '-';
      gradeRow.push({ content: g, styles: { halign: 'center', fontStyle: 'bold' } });
    });
    gradeRow.push({ content: '-', styles: { halign: 'center' } });
    gradeRow.push({ content: '-', styles: { halign: 'center' } });
    gradeRow.push({ content: classStats.overallGrade, styles: { halign: 'center', fontStyle: 'bold' } });
    gradeRow.push({ content: '-', styles: { halign: 'center' } });
    gradeRow.push({ content: '-', styles: { halign: 'center' } });
    gradeRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(gradeRow);

    // Row 3: HIGHEST SCORE
    const highRow = ['', '', { content: 'HIGHEST SCORE', styles: { fontStyle: 'bold', textColor: [22, 101, 52] } }, ''];
    activeSubjects.forEach(sub => {
      let max = 0;
      evaluatedStudents.forEach(s => { if (s.scores[sub] > max) max = s.scores[sub]; });
      highRow.push({ content: max > 0 ? max : '-', styles: { halign: 'center' } });
    });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    highRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(highRow);

    // Row 4: LOWEST SCORE
    const lowRow = ['', '', { content: 'LOWEST SCORE', styles: { fontStyle: 'bold', textColor: [180, 83, 9] } }, ''];
    activeSubjects.forEach(sub => {
      let min = 100;
      evaluatedStudents.forEach(s => { if (s.scores[sub] > 0 && s.scores[sub] < min) min = s.scores[sub]; });
      lowRow.push({ content: min === 100 ? '-' : min, styles: { halign: 'center' } });
    });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    lowRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(lowRow);

    // Row 5: SUBJECT GPA / PTS
    const gpaRow = ['', '', { content: 'SUBJECT GPA / PTS', styles: { fontStyle: 'bold', textColor: [30, 64, 175] } }, ''];
    activeSubjects.forEach(sub => {
      let sum = 0, count = 0;
      evaluatedStudents.forEach(s => {
        if (s.scores[sub] > 0) {
          sum += pointsForGrade(gradeFor(s.scores[sub], schoolSettings?.gradeBoundaries, activeCurriculum), activeCurriculum);
          count++;
        }
      });
      gpaRow.push({ content: count > 0 ? (sum / count).toFixed(3) : '0.000', styles: { halign: 'center' } });
    });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    gpaRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(gpaRow);

    // Row 6: SUBJECT RANK
    const rankRow = ['', '', { content: 'SUBJECT RANK', styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }, ''];
    activeSubjects.forEach(sub => {
      const rank = subAverages.find(x => x.sub === sub)?.rank || '-';
      rankRow.push({ content: `${rank}/${activeSubjects.length}`, styles: { halign: 'center', fontStyle: 'bold' } });
    });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    rankRow.push({ content: '-', styles: { halign: 'center' } });
    body.push(rankRow);

    // Crisp white paper theme, slate headers, clean lines
    autoTable(doc, {
      head: [head],
      body,
      startY: 68,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 3.5, 
        font: 'Poppins',
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.5
      },
      headStyles: { 
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42], 
        fontStyle: 'bold',
        minCellHeight: 22,
        valign: 'middle'
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin, bottom: 20 },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' }, // SN
        1: { cellWidth: 50, halign: 'center' }, // ADM
        2: { cellWidth: 155 }, // Name
        3: { cellWidth: 26, halign: 'center' }, // Sex
      }
    });

    doc.save(`Merit_List_Broadsheet_${selectedClass.replace(/\s+/g, '_')}.pdf`);
    notify(`Broadsheet PDF downloaded for ${evaluatedStudents.length} student(s)`, 'success');
  };

  // ── 2. ZERAKI PERFORMANCE BREAKDOWN PDF EXPORT (IMAGES 1, 2, 3) ──
  const handleExportZerakiPDF = () => {
    if (evaluatedStudents.length === 0) return notify('No data to export', 'warning');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.addFileToVFS('Poppins-Regular.ttf', poppinsRegular);
    doc.addFileToVFS('Poppins-Bold.ttf', poppinsBold);
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 24;

    // Header
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text((schoolSettings?.name || 'DIGISHULE ACADEMY').toUpperCase(), pageWidth / 2, 28, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`ACADEMIC PERFORMANCE BREAKDOWN - ${selectedExamSeries.toUpperCase()}`, pageWidth / 2, 42, { align: 'center' });

    doc.setFont('Poppins', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Class: ${selectedClass}  |  Curriculum: ${activeCurriculum}  |  Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth / 2, 54, { align: 'center' });

    // Table 1: Stream Grade Breakdown (Image 1)
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Stream Performance & Grade Breakdown', margin, 72);

    const streamHeads = ['Stream', ...streamBreakdownData.gradeGrades, 'Entries', 'Mean Marks', 'Mean Points', 'Grade'];
    const streamRows = streamBreakdownData.streams.map(st => [
      st.stream,
      ...streamBreakdownData.gradeGrades.map(g => st.gradeCounts[g] || 0),
      st.entries,
      `${st.meanMarks}%`,
      st.meanPoints.toFixed(4),
      st.grade
    ]);

    // Cohort Summary Row
    const totalEntries = streamBreakdownData.streams.reduce((acc, s) => acc + s.entries, 0);
    const sumGradeCounts = {};
    streamBreakdownData.gradeGrades.forEach(g => {
      sumGradeCounts[g] = streamBreakdownData.streams.reduce((acc, s) => acc + (s.gradeCounts[g] || 0), 0);
    });
    streamRows.push([
      'Cohort Total',
      ...streamBreakdownData.gradeGrades.map(g => sumGradeCounts[g] || 0),
      totalEntries,
      `${streamBreakdownData.cohortMeanMarks}%`,
      streamBreakdownData.cohortMeanPts.toFixed(4),
      streamBreakdownData.cohortGrade
    ]);

    autoTable(doc, {
      head: [streamHeads],
      body: streamRows,
      startY: 78,
      theme: 'grid',
      styles: { font: 'Poppins', fontSize: 7.5, cellPadding: 3, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin }
    });

    let currentY = doc.lastAutoTable.finalY + 18;

    // Table 2: Subject Performance Leaderboard (Image 3)
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Subject Performance Leaderboard', margin, currentY);

    const subHeads = ['Subject Name', 'Abbr', 'Entries', 'Mean Marks (%)', 'Deviation vs Cohort', 'Trend', 'Grade'];
    const subRows = subjectLeaderboardData.map(s => [
      s.name,
      s.abbr,
      s.entries,
      `${s.meanPct}%`,
      s.deviation,
      s.trend === 'up' ? 'UP (+)' : 'DOWN (-)',
      s.grade
    ]);

    autoTable(doc, {
      head: [subHeads],
      body: subRows,
      startY: currentY + 6,
      theme: 'grid',
      styles: { font: 'Poppins', fontSize: 7.5, cellPadding: 3, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 18;
    if (currentY > 480) {
      doc.addPage();
      currentY = 35;
    }

    // Table 3: Subject Breakdown by Stream with Teachers & TSC No (Image 2)
    const targetSub = subjectStreamBreakdown.targetSubject;
    doc.setFont('Poppins', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`3. ${targetSub} - Stream Breakdown & Faculty Details`, margin, currentY);

    const subStreamHeads = ['Stream', ...subjectStreamBreakdown.gradeGrades, 'Entries', 'Mean Marks', 'Marks Dev', 'Mean Points', 'Points Dev', 'Grade', 'Teacher', 'TSC No'];
    const subStreamRows = subjectStreamBreakdown.rows.map(r => [
      r.stream,
      ...subjectStreamBreakdown.gradeGrades.map(g => r.gradeCounts[g] || 0),
      r.entries,
      `${r.meanMarks}%`,
      (r.marksDeviation >= 0 ? '+' : '') + r.marksDeviation,
      r.meanPoints.toFixed(4),
      (r.pointsDeviation >= 0 ? '+' : '') + r.pointsDeviation,
      r.grade,
      r.teacher,
      r.tscNo
    ]);

    if (subjectStreamBreakdown.totalRow) {
      const tr = subjectStreamBreakdown.totalRow;
      subStreamRows.push([
        tr.stream,
        ...subjectStreamBreakdown.gradeGrades.map(g => tr.gradeCounts[g] || 0),
        tr.entries,
        `${tr.meanMarks}%`,
        '0.00',
        tr.meanPoints.toFixed(4),
        '0.00',
        tr.grade,
        tr.teacher,
        tr.tscNo
      ]);
    }

    autoTable(doc, {
      head: [subStreamHeads],
      body: subStreamRows,
      startY: currentY + 6,
      theme: 'grid',
      styles: { font: 'Poppins', fontSize: 7, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin }
    });

    doc.save(`Performance_Breakdown_${selectedClass.replace(/\s+/g, '_')}.pdf`);
    notify('Performance breakdown PDF downloaded', 'success');
  };

  // ── NEMIS EXCEL EXPORT ──
  const handleExportExcel = () => {
    if (evaluatedStudents.length === 0) return notify('No students to export', 'warning');

    const headers = ['Rank', 'NEMIS_UPI_ADM', 'Student_Name', 'Gender', 'Class_Stream', ...activeSubjects, 'Total_Marks', 'Average_Pct', 'Grade_Rating', 'Points'];
    const rows = [headers];

    evaluatedStudents.forEach(s => {
      const row = [
        s.rank,
        s.adm,
        s.name,
        s.gender,
        s.class,
        ...activeSubjects.map(sub => s.scores[sub] || 0),
        s.totalMarks,
        s.averagePct,
        s.meanGrade,
        s.points
      ];
      rows.push(row);
    });

    rows.push(['-', 'SUMMARY', 'CLASS MEAN', '-', '-', ...activeSubjects.map(sub => subjectAnalysis[sub]?.mean || 0), '-', classStats.meanScore, classStats.overallGrade, '-']);

    downloadExcel(`NEMIS_Merit_List_${selectedClass.replace(/\s+/g, '_')}.xlsx`, [{ name: 'Merit List', aoa: rows }]);
    notify('Exported NEMIS-compatible Excel sheet', 'success');
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, marginBottom: 20 }}>
      
      {/* ── EXECUTIVE APPROVAL & PUBLICATION BANNER ── */}
      <div 
        style={{ 
          background: isPublished ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${isPublished ? '#bbf7d0' : '#fde68a'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isPublished ? (
            <ShieldCheck size={22} color="#166534" />
          ) : (
            <AlertTriangle size={22} color="#b45309" />
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: isPublished ? '#166534' : '#b45309', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{isPublished ? 'OFFICIALLY APPROVED & PUBLISHED' : 'DRAFT RESULTS — PENDING EXECUTIVE APPROVAL'}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isPublished ? '#166534' : '#b45309', color: '#ffffff', textTransform: 'uppercase' }}>
                {isPublished ? 'Verified' : 'Unpublished'}
              </span>
              {isPublished && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> {principalSig ? 'Principal Signature Certified & Stamped' : 'Official DoS Stamp Active'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: isPublished ? '#15803d' : '#92400e', marginTop: 2 }}>
              {isPublished ? (
                <>Approved &amp; Published by <strong>{publishedInfo?.approverRole || 'Director of Studies (DoS)'}</strong>. Official report cards with principal signature stamp can now be issued.</>
              ) : (
                <>Requires sign-off from <strong>Director of Studies (DoS)</strong>, <strong>Deputy Academic</strong>, or <strong>Principal</strong> before publishing.</>
              )}
            </div>
          </div>
        </div>

        {/* Executive Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onNavigateGradebook && (
            <button 
              onClick={onNavigateGradebook}
              style={{ height: 34, padding: '0 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Open Gradebook Central for full mark entry, report form preview & subject analysis"
            >
              <BookOpen size={14} color="#047857" /> Gradebook Central <ChevronRight size={13} />
            </button>
          )}

          {isExecutive ? (
            <>
              {Object.keys(editedScores).length > 0 && (
                <button 
                  onClick={handleSaveAllScores}
                  style={{ height: 34, padding: '0 12px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} /> Save Score Changes
                </button>
              )}

              <button 
                onClick={() => setIsEditing(prev => !prev)}
                style={{ height: 34, padding: '0 12px', background: isEditing ? '#f1f5f9' : '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit3 size={14} color="#047857" /> {isEditing ? 'Done Editing' : 'Direct Score Editing'}
              </button>

              <button 
                onClick={handleTogglePublication}
                style={{ 
                  height: 34, 
                  padding: '0 14px', 
                  background: isPublished ? '#dc2626' : '#047857', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  boxShadow: isPublished ? 'none' : '0 1px 3px rgba(4, 120, 87, 0.4)'
                }}
              >
                {isPublished ? <Unlock size={14} /> : <Lock size={14} />}
                {isPublished ? 'Unpublish / Revoke' : 'Approve & Publish (DoS)'}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#ffffff', padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}>
              Read-Only Access Mode
            </span>
          )}
        </div>
      </div>

      {/* ── TOOLBAR & CONTROLS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={20} color="#047857" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Merit List & Student Performance Analysis
            </h2>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#047857', padding: '2px 8px', borderRadius: 4 }}>
              {activeCurriculum === '844' ? '8-4-4 KCSE Model' : 'CBC Competency Rating'}
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
            Multi-curriculum academic ranking, subject mean analysis & standard deviation statistics
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={handleExportExcel}
            className="btn"
            style={{ height: 34, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={14} color="#047857" /> Export NEMIS Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="btn"
            style={{ height: 34, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }}
            title="Download crisp white broadsheet PDF with marks only"
          >
            <Printer size={14} color="#047857" /> Export Broadsheet (PDF)
          </button>
          <button 
            onClick={handleExportZerakiPDF}
            className="btn btn-primary"
            style={{ height: 34, fontSize: 12, background: '#047857', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Download Zeraki-style stream ranking and subject performance analysis PDF"
          >
            <Download size={14} /> Export Performance Breakdown (PDF)
          </button>
        </div>
      </div>

      {/* ── VIEW MODE SWITCHER (BROADSHEET VS STREAM BREAKDOWN VS SUBJECT LEADERBOARD) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '2px solid #e2e8f0', paddingBottom: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveAnalyticsView('broadsheet')}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: activeAnalyticsView === 'broadsheet' ? '#047857' : '#f1f5f9',
            color: activeAnalyticsView === 'broadsheet' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'all 0.15s ease'
          }}
        >
          <FileSpreadsheet size={15} /> Merit Broadsheet
        </button>
        <button
          onClick={() => setActiveAnalyticsView('stream_breakdown')}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: activeAnalyticsView === 'stream_breakdown' ? '#047857' : '#f1f5f9',
            color: activeAnalyticsView === 'stream_breakdown' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} /> Stream Performance Breakdown
        </button>
        <button
          onClick={() => setActiveAnalyticsView('subject_leaderboard')}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: activeAnalyticsView === 'subject_leaderboard' ? '#047857' : '#f1f5f9',
            color: activeAnalyticsView === 'subject_leaderboard' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'all 0.15s ease'
          }}
        >
          <TrendingUp size={15} /> Subject Performance Leaderboard
        </button>
      </div>

      {/* ════════════════════ VIEW 1: MERIT BROADSHEET ════════════════════ */}
      {activeAnalyticsView === 'broadsheet' && (
        <>
          {/* Merit List Scope Switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => {
                  setViewScope('overall');
                  setSelectedClass('All');
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewScope === 'overall' ? '#047857' : 'transparent',
                  color: viewScope === 'overall' ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={14} /> Overall Class Merit List
              </button>
              <button
                onClick={() => {
                  setViewScope('stream');
                  if (selectedClass === 'All') {
                    const firstStream = classOptions.find(c => c !== 'All') || 'All';
                    setSelectedClass(firstStream);
                  }
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewScope === 'stream' ? '#047857' : 'transparent',
                  color: viewScope === 'stream' ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={14} /> Stream Merit List
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={13} color="#047857" />
              <span>
                {viewScope === 'overall' 
                  ? `Overall Class Cohort Ranking (${evaluatedStudents.length} Students)` 
                  : `Stream Ranking for ${selectedClass === 'All' ? 'All' : selectedClass} (${evaluatedStudents.length} Students)`}
              </span>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Curriculum Toggle */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Curriculum Model</label>
                <select 
                  value={modelMode} 
                  onChange={e => setModelMode(e.target.value)}
                  style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
                >
                  <option value="auto">Auto (Class Detect)</option>
                  <option value="cbc">CBC Model (Primary & Junior)</option>
                  <option value="844">8-4-4 Model (KCSE Forms)</option>
                </select>
              </div>

              {/* Class Stream Filter */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Class Stream</label>
                <select 
                  value={selectedClass} 
                  onChange={e => setSelectedClass(e.target.value)}
                  style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
                >
                  {classOptions.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes & Streams' : `Stream ${c}`}</option>)}
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Search Student</label>
                <div style={{ position: 'relative', width: 180 }}>
                  <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 8, top: 9 }} />
                  <input 
                    type="text" 
                    placeholder="Search name or adm..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', paddingLeft: 26, height: 32, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#ffffff' }}
                  />
                </div>
              </div>

              {/* Pass Threshold Selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 2 }}>Pass Threshold %</label>
                <select 
                  value={passThreshold} 
                  onChange={e => setPassThreshold(Number(e.target.value))}
                  style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12, background: '#ffffff', fontWeight: 600 }}
                >
                  <option value={40}>40% (Minimum)</option>
                  <option value={50}>50% (Standard Pass)</option>
                  <option value={60}>60% (Credit Threshold)</option>
                  <option value={70}>70% (Distinction)</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Access Level: <strong style={{ color: isExecutive ? '#047857' : '#2563eb' }}>{isExecutive ? 'Read & Write (Executive)' : 'Read-Only'}</strong>
            </div>
          </div>

          {/* Overall Class Summary Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Class Mean Score</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#047857', marginTop: 2 }}>
                {classStats.meanScore}% <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>({classStats.overallGrade})</span>
              </div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>Across {activeSubjects.length} active subjects</div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Pass Rate %</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                {classStats.passRate}%
              </div>
              <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>{classStats.passedStudents} of {classStats.total} passed (&ge;{passThreshold}%)</div>
            </div>

            <div style={{ background: '#fdf4ff', border: '1px solid #fae8ff', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#86198f', textTransform: 'uppercase' }}>Strongest Subject</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#701a75', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {classStats.topSubject}
              </div>
              <div style={{ fontSize: 11, color: '#86198f', marginTop: 2 }}>Highest class average</div>
            </div>

            <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>Subject Needing Focus</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#c2410c', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {classStats.weakSubject}
              </div>
              <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>Lowest class average</div>
            </div>
          </div>

          {/* Main Merit Ranking Table with Abbreviations and Marks Only */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 16 }}>
            <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: '#f1f5f9' }}>
                  <th onClick={() => handleSort('rank')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {viewScope === 'stream' ? 'Str / Ovr Rank' : 'Ovr / Str Rank'} {sortField === 'rank' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('adm')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Adm No {sortField === 'adm' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('name')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: 160, borderBottom: '2px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Student Name {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    Stream
                  </th>

                  {/* Dynamic Subject Columns - Using getSubjectAbbr */}
                  {activeSubjects.map(sub => (
                    <th 
                      key={sub} 
                      onClick={() => handleSort(sub)} 
                      style={{ 
                        padding: '10px 8px', 
                        fontSize: 10.5, 
                        textTransform: 'uppercase', 
                        textAlign: 'center', 
                        cursor: 'pointer', 
                        userSelect: 'none', 
                        whiteSpace: 'nowrap',
                        background: sortField === sub ? '#e2e8f0' : '#f1f5f9',
                        borderBottom: '2px solid #cbd5e1',
                        minWidth: 46
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span title={sub} style={{ fontWeight: 800 }}>{getSubjectAbbr(sub)}</span>
                        {sortField === sub && (sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </div>
                    </th>
                  ))}

                  <th onClick={() => handleSort('total')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      Total {sortField === 'total' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('avg')} style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      Mean % {sortField === 'avg' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '2px solid #cbd5e1' }}>
                    {activeCurriculum === '844' ? 'KCSE Grade (Pts)' : 'CBC Competency'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((s) => {
                  let rowStyle = { borderBottom: '1px solid #e2e8f0' };
                  let rankBadge = null;

                  if (s.rank === 1) {
                    rowStyle.background = '#fffbeb';
                    rankBadge = (
                      <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Trophy size={11} color="#b45309" /> #1 Top
                      </span>
                    );
                  } else if (s.rank === 2) {
                    rowStyle.background = '#f8fafc';
                    rankBadge = (
                      <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Medal size={11} /> #2
                      </span>
                    );
                  } else if (s.rank === 3) {
                    rowStyle.background = '#fff7ed';
                    rankBadge = (
                      <span style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Medal size={11} /> #3
                      </span>
                    );
                  } else {
                    rankBadge = <strong style={{ color: '#64748b' }}>#{s.rank}</strong>;
                  }

                  return (
                    <tr key={s.id || s.adm} style={rowStyle}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {rankBadge} 
                        <span style={{ color: '#64748b', fontSize: 10, marginLeft: 6, fontWeight: 600 }}>
                          {viewScope === 'stream' ? `(Ovr #${s.overallRank})` : `(${s.class} #${s.streamRank})`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{s.adm}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.class}</td>

                      {/* Subject Scores Cells: MARKS ONLY */}
                      {activeSubjects.map(sub => {
                        const score = s.scores[sub];
                        const isTopInSub = score > 0 && score === subjectAnalysis[sub]?.topScore;
                        const overrideKey = `${s.id}_${sub}`;
                        const isOverridden = editedScores[overrideKey] !== undefined;

                        return (
                          <td 
                            key={sub} 
                            style={{ 
                              padding: isEditing && isExecutive ? '4px' : '10px 8px', 
                              textAlign: 'center', 
                              fontWeight: isTopInSub ? 800 : 600,
                              fontSize: 12,
                              background: isOverridden ? '#eff6ff' : isTopInSub ? '#dcfce7' : 'transparent',
                              color: isTopInSub ? '#15803d' : score >= passThreshold ? '#0f172a' : '#d13438'
                            }}
                          >
                            {isEditing && isExecutive ? (
                              <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={score || ''} 
                                onChange={e => handleScoreChange(s.id, sub, e.target.value)}
                                style={{ 
                                  width: 48, 
                                  height: 28, 
                                  textAlign: 'center', 
                                  borderRadius: 4, 
                                  border: isOverridden ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: '#ffffff'
                                }}
                              />
                            ) : (
                              score > 0 ? score : '-'
                            )}
                          </td>
                        );
                      })}

                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: 13 }}>
                        {s.totalMarks}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                        {s.averagePct.toFixed(1)}%
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {activeCurriculum === '844' ? (
                          <Badge color={s.meanGrade === 'A' || s.meanGrade === 'A-' ? 'green' : s.meanGrade === 'E' || s.meanGrade === 'D-' ? 'red' : 'blue'}>
                            {s.meanGrade} ({s.points} pts)
                          </Badge>
                        ) : (
                          <Badge color={s.meanGrade?.startsWith('EE') || s.meanGrade?.startsWith('ME') ? 'green' : s.meanGrade?.startsWith('AE') ? 'amber' : 'red'}>
                            {s.meanGrade} ({s.points} pts)
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* FOOTER ROW: PER-SUBJECT CLASS MEANS & STATISTICAL VARIANCE */}
              {userRole !== 'parent' && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '10px 12px', color: '#0f172a', fontSize: 12 }}>
                      CLASS SUBJECT MEANS
                    </td>
                    {activeSubjects.map(sub => (
                      <td key={sub} style={{ padding: '10px 8px', textAlign: 'center', color: '#047857', fontWeight: 800, fontSize: 12 }}>
                        {subjectAnalysis[sub]?.mean || '-'}%
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontWeight: 800 }}>-</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontWeight: 800, fontSize: 13 }}>
                      {classStats.meanScore}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#047857' }}>
                      {classStats.overallGrade}
                    </td>
                  </tr>

                  <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', fontSize: 11 }}>
                    <td colSpan={4} style={{ padding: '8px 12px', color: '#475569' }}>
                      Standard Deviation (SD)
                    </td>
                    {activeSubjects.map(sub => (
                      <td key={sub} style={{ padding: '8px 8px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                        &plusmn;{subjectAnalysis[sub]?.sd || 0}
                      </td>
                    ))}
                    <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                      Statistical Variance
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ════════════════════ VIEW 2: STREAM PERFORMANCE BREAKDOWN (ZERAKI IMAGES 1 & 2) ════════════════════ */}
      {activeAnalyticsView === 'stream_breakdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Performance Header Card (Image 1) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              {/* Left Column: Class Info & Metrics */}
              <div style={{ minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Home size={22} color="#047857" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                      {selectedClass === 'All' ? 'Overall Cohort' : selectedClass}
                    </h3>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#0284c7', color: '#ffffff' }}>
                        {selectedBreakdownSubject === 'All' ? 'All Subjects' : selectedBreakdownSubject}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                        {selectedExamSeries}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Mean Points</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#047857', marginTop: 2 }}>
                      {streamBreakdownData.cohortMeanPts.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TrendingUp size={12} /> +0.9179 vs baseline
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Mean Marks</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      {streamBreakdownData.cohortMeanMarks}%
                    </div>
                    <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TrendingDown size={12} /> -0.3664 dev
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Mean Grade</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#166534', marginTop: 2 }}>
                    {streamBreakdownData.cohortGrade}
                  </div>
                </div>
              </div>

              {/* Center: Stream Performance Graph */}
              <div style={{ flex: 1, minWidth: 280, height: 170 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart2 size={14} color="#047857" /> Performance of {selectedClass === 'All' ? 'Class' : selectedClass} streams
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={streamBreakdownData.streams} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="streamGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#86efac" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#dcfce7" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="stream" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                    <YAxis domain={activeCurriculum === '844' ? [0, 12] : [0, 8]} tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip formatter={(val) => [`${val} pts`, 'Mean Points']} />
                    <Area type="monotone" dataKey="meanPoints" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#streamGrad2)" />
                  </AreaChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Change Exam:</label>
                    <select
                      value={selectedExamSeries}
                      onChange={e => setSelectedExamSeries(e.target.value)}
                      style={{ height: 28, fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', padding: '0 6px', background: '#f8fafc', fontWeight: 600 }}
                    >
                      <option value="Opener - Term 2 2026">OPENER - (2026 Term 2)</option>
                      <option value="Mid Term - Term 2 2026">MID TERM - (2026 Term 2)</option>
                      <option value="End Term - Term 2 2026">END TERM - (2026 Term 2)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Change Class:</label>
                    <select
                      value={selectedClass}
                      onChange={e => setSelectedClass(e.target.value)}
                      style={{ height: 28, fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', padding: '0 6px', background: '#f8fafc', fontWeight: 600 }}
                    >
                      {classOptions.map(c => <option key={c} value={c}>{c === 'All' ? 'All Classes / Streams' : c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right: Candidature Info & Student Results Link */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 140 }}>
                <div style={{ textAlign: 'right' }}>
                  <GraduationCap size={32} color="#047857" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                    {streamBreakdownData.cohortTotalStudents} Students
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Students who sat for the exam
                  </div>
                </div>

                <button
                  onClick={() => setActiveAnalyticsView('broadsheet')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Eye size={13} /> View student results
                </button>
              </div>
            </div>
          </div>

          {/* Bottom: Grade Breakdown Section (Images 1 & 2) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  Grade breakdown
                </h4>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {selectedBreakdownSubject === 'All' ? 'Aggregate grade distribution across streams' : `Detailed stream breakdown for ${selectedBreakdownSubject} with faculty TSC records`}
                </div>
              </div>

              {/* Subject Selector Dropdown (Image 2) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Filter by Subject:</label>
                <select
                  value={selectedBreakdownSubject}
                  onChange={e => setSelectedBreakdownSubject(e.target.value)}
                  style={{ height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 12, fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
                >
                  <option value="All">All Subjects (Overall Stream Aggregate)</option>
                  {activeSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Form / Stream</th>
                    {(selectedBreakdownSubject === 'All' ? streamBreakdownData.gradeGrades : subjectStreamBreakdown.gradeGrades).map(g => (
                      <th key={g} style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, minWidth: 26 }}>{g}</th>
                    ))}
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Entries</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Mean Marks</th>
                    {selectedBreakdownSubject !== 'All' && (
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Mean Marks Dev</th>
                    )}
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Mean Points</th>
                    {selectedBreakdownSubject !== 'All' && (
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Mean Points Dev</th>
                    )}
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Grade</th>
                    {selectedBreakdownSubject !== 'All' && (
                      <>
                        <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700 }}>Subject Teacher</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700 }}>TSC No</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedBreakdownSubject === 'All' ? (
                    <>
                      {streamBreakdownData.streams.map(st => (
                        <tr key={st.stream} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{st.stream}</td>
                          {streamBreakdownData.gradeGrades.map(g => (
                            <td key={g} style={{ padding: '10px 6px', textAlign: 'center', color: (st.gradeCounts[g] || 0) > 0 ? '#0f172a' : '#94a3b8' }}>
                              {st.gradeCounts[g] || 0}
                            </td>
                          ))}
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{st.entries}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{st.meanMarks}%</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{st.meanPoints.toFixed(4)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <Badge color={st.grade.startsWith('A') || st.grade.startsWith('EE') ? 'green' : st.grade.startsWith('B') || st.grade.startsWith('ME') ? 'blue' : 'amber'}>
                              {st.grade}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {/* Highlighted Total Row (Green) */}
                      <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac', fontWeight: 800 }}>
                        <td style={{ padding: '10px 12px', color: '#166534' }}>{selectedClass === 'All' ? 'Cohort Total' : selectedClass}</td>
                        {streamBreakdownData.gradeGrades.map(g => {
                          const totalG = streamBreakdownData.streams.reduce((acc, s) => acc + (s.gradeCounts[g] || 0), 0);
                          return (
                            <td key={g} style={{ padding: '10px 6px', textAlign: 'center', color: '#166534' }}>
                              {totalG}
                            </td>
                          );
                        })}
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{streamBreakdownData.cohortTotalStudents}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{streamBreakdownData.cohortMeanMarks}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{streamBreakdownData.cohortMeanPts.toFixed(4)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: '#166534', color: '#ffffff', fontWeight: 700 }}>
                            {streamBreakdownData.cohortGrade}
                          </span>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      {subjectStreamBreakdown.rows.map(r => (
                        <tr key={r.stream} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{r.stream}</td>
                          {subjectStreamBreakdown.gradeGrades.map(g => (
                            <td key={g} style={{ padding: '10px 6px', textAlign: 'center', color: (r.gradeCounts[g] || 0) > 0 ? '#0f172a' : '#94a3b8' }}>
                              {r.gradeCounts[g] || 0}
                            </td>
                          ))}
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.entries}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.meanMarks}%</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: r.marksDeviation >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {r.marksDeviation >= 0 ? `+${r.marksDeviation}` : r.marksDeviation}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.meanPoints.toFixed(4)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: r.pointsDeviation >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {r.pointsDeviation >= 0 ? `+${r.pointsDeviation}` : r.pointsDeviation}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <Badge color={r.grade.startsWith('A') || r.grade.startsWith('EE') ? 'green' : r.grade.startsWith('B') || r.grade.startsWith('ME') ? 'blue' : 'amber'}>
                              {r.grade}
                            </Badge>
                          </td>
                          <td style={{ padding: '10px 10px', color: '#334155', fontWeight: 600 }}>{r.teacher}</td>
                          <td style={{ padding: '10px 8px', color: '#64748b', fontFamily: 'monospace' }}>{r.tscNo}</td>
                        </tr>
                      ))}
                      {/* Highlighted Total Row (Green - Image 2) */}
                      {subjectStreamBreakdown.totalRow && (
                        <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac', fontWeight: 800 }}>
                          <td style={{ padding: '10px 12px', color: '#166534' }}>{subjectStreamBreakdown.totalRow.stream}</td>
                          {subjectStreamBreakdown.gradeGrades.map(g => (
                            <td key={g} style={{ padding: '10px 6px', textAlign: 'center', color: '#166534' }}>
                              {subjectStreamBreakdown.totalRow.gradeCounts[g] || 0}
                            </td>
                          ))}
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{subjectStreamBreakdown.totalRow.entries}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{subjectStreamBreakdown.totalRow.meanMarks}%</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>0.00</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>{subjectStreamBreakdown.totalRow.meanPoints.toFixed(4)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#166534' }}>0.00</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, background: '#166534', color: '#ffffff', fontWeight: 700 }}>
                              {subjectStreamBreakdown.totalRow.grade}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', color: '#166534' }}>{subjectStreamBreakdown.totalRow.teacher}</td>
                          <td style={{ padding: '10px 8px', color: '#166534' }}>{subjectStreamBreakdown.totalRow.tscNo}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Print Format Button (Image 2) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={handleExportZerakiPDF}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Printer size={14} /> View Print Format
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ VIEW 3: SUBJECT PERFORMANCE LEADERBOARD (ZERAKI IMAGE 3) ════════════════════ */}
      {activeAnalyticsView === 'subject_leaderboard' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                {selectedClass === 'All' ? 'Overall Cohort' : selectedClass} Subject Performance - {selectedExamSeries}
              </h3>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Comprehensive subject mean scores, performance progress bar gauges and trend analysis
              </div>
            </div>

            <button
              onClick={handleExportZerakiPDF}
              className="btn"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={14} /> Export Subject Performance PDF
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Name</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Performance</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Mean</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Change in Mean</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>Trend</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>Grade</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {subjectLeaderboardData.map(item => (
                  <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {item.name}
                      <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6, fontWeight: 600 }}>({item.abbr})</span>
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, item.meanPct))}%`, height: '100%', background: '#16a34a', borderRadius: 5, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                      {item.mean}%
                    </td>
                    <td style={{ padding: '12px 14px', color: item.trend === 'up' ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                      {item.deviation}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {item.trend === 'up' ? (
                        <ArrowUp size={16} color="#16a34a" style={{ display: 'inline' }} />
                      ) : (
                        <ArrowDown size={16} color="#d97706" style={{ display: 'inline' }} />
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Badge color={item.grade.startsWith('A') || item.grade.startsWith('EE') ? 'green' : item.grade.startsWith('B') || item.grade.startsWith('ME') ? 'blue' : 'amber'}>
                        {item.grade}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setSelectedBreakdownSubject(item.name);
                          setActiveAnalyticsView('stream_breakdown');
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 4,
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        View Grade Breakdown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {displayedStudents.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>
          No student records found matching the active filters or class selection.
        </div>
      )}
    </div>
  );
}

