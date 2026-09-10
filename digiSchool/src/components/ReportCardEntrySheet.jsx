import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  percentageToCbcGrade, 
  percentageToCbcPoints, 
  cbcOfficialComment, 
  calculateSubjectDeviation,
  GRADE_DESCRIPTORS_TABLE,
  CBC_BOUNDARIES,
  KCSE_BOUNDARIES,
  computeRow,
  gradeFor,
  pointsForGrade,
  fullGradeName,
  is844Class
} from '../utils/grading';
import { ChevronLeft, ChevronRight, Save, Printer, Download, Sparkles, Plus, Trash2, CheckCircle2, Upload, ShieldCheck, Check } from 'lucide-react';

// Default subjects for CBC Senior School (Grade 10+) or Junior School
const DEFAULT_SENIOR_SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Geography',
  'Christian Religious Education (CRE)',
  'Islamic Religious Education (IRE)',
  'Business Studies',
  'Agriculture',
  'Computer Studies',
  'Home Science',
  'Music',
  'Art & Design',
  'Community Service Learning'
];

const DEFAULT_JUNIOR_SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Integrated Science',
  'Social Studies',
  'Religious Education (CRE)',
  'Islamic Religious Education (IRE)',
  'Pre-Technical Studies',
  'Creative Arts & Sports',
  'Agriculture & Nutrition'
];

export default function ReportCardEntrySheet({
  student,
  students = [],
  onSaveStudent,
  onNextStudent,
  onPrevStudent,
  onSelectStudent = null,
  currentIndex = 0,
  totalStudents = 1,
  schoolSettings = {},
  onUpdateSettings,
  onPublishResults,
  teachers = [],
  currentUser = null,
  gradeBoundaries = [],
  examTitle = 'End Term Assessment',
  termName = 'Term 2',
  year = '2026',
  outOf = 100,
  canEditAll = true,
  allowedSubjects = []
}) {
  // NOTE: the "no student" guard lives after all hooks (below) so hooks are
  // never called conditionally (React rules-of-hooks). Hook bodies that read
  // `student` use optional chaining to stay safe when it is null.
  const isSenior = useMemo(() => {
    const cls = String(student?.class || '').toLowerCase();
    return cls.includes('10') || cls.includes('11') || cls.includes('12') || cls.includes('form');
  }, [student?.class]);

  const is844 = useMemo(() => is844Class(student?.class), [student?.class]);
  const systemType = is844 ? '844' : 'CBC';

  const isExecutive = useMemo(() => {
    const role = (currentUser?.role || '').toLowerCase();
    return ['dos', 'deputy_academic', 'principal', 'admin', 'super_admin'].includes(role);
  }, [currentUser]);

  // CRITICAL: Always force correct boundaries based on curriculum type.
  // The store's gradeBoundaries may contain KCSE grades even for CBC students.
  const effectiveBoundaries = useMemo(() => {
    return is844 ? KCSE_BOUNDARIES : CBC_BOUNDARIES;
  }, [is844]);

  // Determine subjects list: start with existing student scores, union with default subjects
  const [subjectsList, setSubjectsList] = useState([]);
  const [scoresData, setScoresData] = useState({});
  const [pathway, setPathway] = useState(student?.pathway || 'STEM');
  const [classTeacherRemarks, setClassTeacherRemarks] = useState('');
  const [principalRemarks, setPrincipalRemarks] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [activeSubjectInput, setActiveSubjectInput] = useState(null);

  // Scanned principal signature & DoS published status
  const [localSignature, setLocalSignature] = useState(schoolSettings.signature || schoolSettings.principal_signature || '');
  const [localPublished, setLocalPublished] = useState(!!schoolSettings.results_published);

  useEffect(() => {
    if (schoolSettings.signature || schoolSettings.principal_signature) {
      setLocalSignature(schoolSettings.signature || schoolSettings.principal_signature);
    }
  }, [schoolSettings.signature, schoolSettings.principal_signature]);

  useEffect(() => {
    setLocalPublished(!!schoolSettings.results_published);
  }, [schoolSettings.results_published]);

  const isPublished = !!(localPublished || schoolSettings.results_published);
  const principalSignature = localSignature || schoolSettings.signature || schoolSettings.principal_signature || '';

  // Toggle Publish Results (DoS)
  const handleTogglePublish = () => {
    const nextState = !isPublished;
    setLocalPublished(nextState);
    if (onPublishResults) {
      onPublishResults();
    } else if (onUpdateSettings) {
      onUpdateSettings({ ...schoolSettings, results_published: nextState });
    }
    setSaveStatus(nextState ? 'Results published! Principal signature applied' : 'Results unpublished');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Upload Principal Signature image directly
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') {
        setLocalSignature(dataUrl);
        if (onUpdateSettings) {
          onUpdateSettings({ ...schoolSettings, signature: dataUrl });
        }
        setSaveStatus('Principal signature uploaded');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sync state when student prop changes
  useEffect(() => {
    if (!student) return;

    const existingScores = student.scores || {};
    const existingSubjectKeys = Object.keys(existingScores).filter(Boolean);
    const defaults = isSenior ? DEFAULT_SENIOR_SUBJECTS : DEFAULT_JUNIOR_SUBJECTS;
    
    // Combine existing subjects with defaults, avoiding duplicates
    const combined = Array.from(new Set([...existingSubjectKeys, ...defaults]));
    setSubjectsList(combined);

    // Build structured scores dictionary
    const initialScores = {};
    combined.forEach((sub) => {
      const raw = existingScores[sub];
      let val = '';
      let comment = '';
      let teacher = '';

      if (raw !== undefined && raw !== null) {
        if (typeof raw === 'number') {
          val = raw;
        } else if (typeof raw === 'object') {
          val = raw.score !== undefined ? raw.score : (raw.average !== undefined ? raw.average : (raw.a1 !== undefined ? raw.a1 : ''));
          comment = raw.comment || raw.remarks || '';
          teacher = raw.teacher || '';
        }
      }

      // If no teacher, try looking up teacher assigned to this subject
      if (!teacher) {
        const assigned = (teachers || []).find(t => 
          (t.subject && t.subject.toLowerCase() === sub.toLowerCase()) ||
          (Array.isArray(t.subjects) && t.subjects.some(s => s.toLowerCase() === sub.toLowerCase()))
        );
        if (assigned) teacher = assigned.name;
      }

      // If no comment yet, compute default CBC comment if score exists
      if (val !== '' && !comment) {
        const pct = typeof val === 'number' ? val : Number(val);
        if (!isNaN(pct) && pct > 0) {
          const g = percentageToCbcGrade(pct, effectiveBoundaries);
          comment = cbcOfficialComment(g, sub);
        }
      }

      initialScores[sub] = {
        val: val === 'X' ? 'X' : (val !== '' ? Number(val) : ''),
        comment: comment,
        teacher: teacher
      };
    });

    setScoresData(initialScores);
    setPathway(student.pathway || (isSenior ? 'STEM' : 'General'));
    
    // Default remarks
    const fName = (student.name || '').split(' ')[0] || 'The student';
    setClassTeacherRemarks(
      student.classTeacherRemarks || 
      `${fName}, you're meeting the expected standards with solid effort. Continue this positive momentum, and you'll continue to excel.`
    );
    setPrincipalRemarks(
      student.principalRemarks || 
      `${fName}, you are performing well and meeting expectations. Your progress is steady, and with continued focus and dedication, you will continue to grow. Keep up the good work - you're on track for success!`
    );
    setSaveStatus('');
  }, [student.id, isSenior, effectiveBoundaries]);

  // Compute Class Benchmarks / Averages for Deviation Calculation
  const classAverages = useMemo(() => {
    const avgs = {};
    subjectsList.forEach((sub) => {
      const validScores = students
        .map(s => {
          const sc = s.scores?.[sub];
          if (sc === undefined || sc === null) return null;
          if (typeof sc === 'number') return sc;
          if (typeof sc === 'object') {
            const v = sc.score !== undefined ? sc.score : sc.average;
            return v !== undefined && v !== null && v !== 'X' ? Number(v) : null;
          }
          return null;
        })
        .filter(v => v !== null && !isNaN(v) && v > 0);

      avgs[sub] = validScores.length > 0 
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : 65; // Default benchmark 65%
    });
    return avgs;
  }, [students, subjectsList]);

  // Handle score change for a subject
  const handleScoreChange = (sub, rawInput) => {
    let finalVal = '';
    const trimmed = String(rawInput).trim();

    if (trimmed.toLowerCase() === 'x') {
      finalVal = 'X';
    } else if (trimmed === '') {
      finalVal = '';
    } else {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        const max = Math.max(1, Number(outOf) || 100);
        // Normalize to percentage 0-100
        finalVal = Math.max(0, Math.min(100, Math.round((num / max) * 100)));
      }
    }

    setScoresData(prev => {
      const current = prev[sub] || { val: '', comment: '', teacher: '' };
      let newComment = current.comment;
      
      // Auto-update comment if empty or already set to an official comment
      if (typeof finalVal === 'number' && (!newComment || newComment.length < 3)) {
        const g = percentageToCbcGrade(finalVal, effectiveBoundaries);
        newComment = cbcOfficialComment(g, sub);
      }

      return {
        ...prev,
        [sub]: {
          ...current,
          val: finalVal,
          comment: newComment
        }
      };
    });
  };

  // Handle comment change
  const handleCommentChange = (sub, text) => {
    setScoresData(prev => ({
      ...prev,
      [sub]: {
        ...(prev[sub] || {}),
        comment: text
      }
    }));
  };

  // Handle teacher change
  const handleTeacherChange = (sub, text) => {
    setScoresData(prev => ({
      ...prev,
      [sub]: {
        ...(prev[sub] || {}),
        teacher: text
      }
    }));
  };

  // Auto-fill all official comments
  const handleAutoFillAllComments = () => {
    setScoresData(prev => {
      const next = { ...prev };
      subjectsList.forEach(sub => {
        const row = next[sub];
        if (row && typeof row.val === 'number') {
          const g = percentageToCbcGrade(row.val, effectiveBoundaries);
          next[sub] = { ...row, comment: cbcOfficialComment(g, sub) };
        }
      });
      return next;
    });
    setSaveStatus('Auto-filled comments');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  // Calculated Rows
  const tableRows = useMemo(() => {
    return subjectsList.map(sub => {
      const data = scoresData[sub] || { val: '', comment: '', teacher: '' };
      const scoreNum = typeof data.val === 'number' ? data.val : null;
      const benchmark = classAverages[sub] || 65;
      
      let devObj = { dev: 0, text: '-', arrow: '', color: '#94a3b8' };
      let grade = '-';
      let points = 0;

      if (scoreNum !== null) {
        devObj = calculateSubjectDeviation(scoreNum, benchmark);
        grade = is844 ? gradeFor(scoreNum, effectiveBoundaries, '844') : percentageToCbcGrade(scoreNum, effectiveBoundaries);
        points = is844 ? pointsForGrade(grade, '844') : percentageToCbcPoints(scoreNum, 8, effectiveBoundaries);
      } else if (data.val === 'X') {
        grade = 'X';
      }

      return {
        subject: sub,
        scoreVal: data.val,
        scoreNum,
        devObj,
        grade,
        points,
        comment: data.comment,
        teacher: data.teacher,
        benchmark
      };
    });
  }, [subjectsList, scoresData, classAverages, effectiveBoundaries, is844]);

  // Overall KPIs Calculation
  const kpis = useMemo(() => {
    const gradedRows = tableRows.filter(r => r.scoreNum !== null);
    const count = gradedRows.length;

    if (count === 0) {
      return {
        perfLevelCode: '—',
        perfLevelFull: '—',
        totalMarks: '0/0',
        totalMarksDev: { text: '-', arrow: '', color: '#94a3b8' },
        totalPoints: '0/0',
        totalPointsDev: { text: '-', arrow: '', color: '#94a3b8' },
        meanPoints: is844 ? '0/12' : '0/8',
        meanPointsDev: { text: '-', arrow: '', color: '#94a3b8' }
      };
    }

    const totalMarks = gradedRows.reduce((a, b) => a + b.scoreNum, 0);
    const maxMarks = count * 100;
    const totalPoints = gradedRows.reduce((a, b) => a + b.points, 0);
    const maxPoints = count * (is844 ? 12 : 8);
    const meanMarks = totalMarks / count;
    const meanPoints = totalPoints / count;

    // Performance level is grade of mean mark
    const perfLevelCode = is844 
      ? gradeFor(Math.round(meanMarks), effectiveBoundaries, '844')
      : percentageToCbcGrade(Math.round(meanMarks), effectiveBoundaries);
    const perfLevelFull = fullGradeName(perfLevelCode, systemType);

    // Benchmarks
    const totalBenchmark = gradedRows.reduce((a, b) => a + b.benchmark, 0);
    const marksDev = Math.round(totalMarks - totalBenchmark);
    const totalMarksDev = {
      text: marksDev > 0 ? `+${marksDev}` : `${marksDev}`,
      arrow: marksDev > 0 ? '↗' : (marksDev < 0 ? '↘' : '→'),
      color: marksDev > 0 ? '#16a34a' : (marksDev < 0 ? '#dc2626' : '#64748b')
    };

    // Points benchmark
    const benchmarkExpected = count * (is844 ? 6 : 5);
    const pointsDev = totalPoints - benchmarkExpected;
    const totalPointsDev = {
      text: pointsDev > 0 ? `+${pointsDev}` : `${pointsDev}`,
      arrow: pointsDev > 0 ? '↗' : (pointsDev < 0 ? '↘' : '→'),
      color: pointsDev > 0 ? '#16a34a' : (pointsDev < 0 ? '#dc2626' : '#64748b')
    };

    // Mean Points Dev
    const targetMeanBenchmark = is844 ? 6.0 : 5.0;
    const meanDev = (meanPoints - targetMeanBenchmark).toFixed(2);
    const meanPointsDev = {
      text: Number(meanDev) > 0 ? `+${meanDev}` : `${meanDev}`,
      arrow: Number(meanDev) > 0 ? '↗' : (Number(meanDev) < 0 ? '↘' : '→'),
      color: Number(meanDev) > 0 ? '#16a34a' : (Number(meanDev) < 0 ? '#dc2626' : '#64748b')
    };

    return {
      perfLevelCode,
      perfLevelFull,
      totalMarks: `${totalMarks}/${maxMarks}`,
      totalMarksDev,
      totalPoints: `${totalPoints}/${maxPoints}`,
      totalPointsDev,
      meanPoints: `${(Math.round(meanPoints * 10) / 10).toFixed(1)}/${is844 ? 12 : 8}`,
      meanPointsDev
    };
  }, [tableRows, effectiveBoundaries, is844, systemType]);

  // Persist student marks
  const handleSave = () => {
    const updatedScores = { ...(student.scores || {}) };

    subjectsList.forEach(sub => {
      const entry = scoresData[sub];
      if (entry) {
        const prevSub = updatedScores[sub] || {};
        const isObj = typeof prevSub === 'object';
        const numVal = entry.val === 'X' ? 'X' : (entry.val !== '' ? Number(entry.val) : 0);

        updatedScores[sub] = {
          ...(isObj ? prevSub : {}),
          score: numVal,
          average: numVal,
          remarks: entry.comment,
          comment: entry.comment,
          teacher: entry.teacher
        };
      }
    });

    const updatedStudent = {
      ...student,
      scores: updatedScores,
      pathway: pathway,
      classTeacherRemarks: classTeacherRemarks,
      principalRemarks: principalRemarks
    };

    if (onSaveStudent) {
      onSaveStudent(updatedStudent);
    }

    setSaveStatus('Marks Saved Successfully');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  const handleSaveAndNext = () => {
    handleSave();
    if (onNextStudent) {
      setTimeout(() => onNextStudent(), 150);
    }
  };

  // Keyboard navigation between subject inputs
  const inputRefs = useRef({});
  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextSub = subjectsList[index + 1];
      if (nextSub && inputRefs.current[nextSub]) {
        inputRefs.current[nextSub].focus();
      } else {
        handleSave();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevSub = subjectsList[index - 1];
      if (prevSub && inputRefs.current[prevSub]) {
        inputRefs.current[prevSub].focus();
      }
    }
  };

  // Printable action
  const handlePrint = () => {
    window.print();
  };

  // Check if teacher has permission to edit a specific subject
  const canEditSubject = (sub) => {
    if (canEditAll) return true;
    return allowedSubjects.some(s => s.toLowerCase() === sub.toLowerCase());
  };

  // Data for the mini trend line chart
  const chartPoints = useMemo(() => {
    return tableRows.map((r, i) => {
      const score = r.scoreNum !== null ? r.scoreNum : 0;
      const classAvg = r.benchmark || 65;
      return {
        label: r.subject.substring(0, 3).toUpperCase(),
        score,
        classAvg,
        hasScore: r.scoreNum !== null
      };
    });
  }, [tableRows]);

  const teacherName = (teachers && teachers.length > 0) ? teachers[0].name : 'Wyclife Amisi Odhiambo';
  const principalName = schoolSettings.principal || 'Dr. Joshua Harisson Miyawa';
  const schoolName = schoolSettings.name || 'Homa Bay School';
  const schoolAddress = schoolSettings.address || 'P. O. Box 22- 40300 Homa Bay, Kenya';
  const schoolPhone = schoolSettings.phone || schoolSettings.tel || '0714556342';
  const schoolEmail = schoolSettings.email || 'homabayhomabay@gmail.com';

  // Guard placed after all hooks so hooks are always called in the same order.
  if (!student) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: 18, color: '#475569' }}>No student selected</h3>
        <p className="muted">Please select a student from the gradebook to view or enter marks.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', color: '#1e293b', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      
      {/* Top Interactive Toolbar */}
      <div className="no-print" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: '#ffffff', 
        padding: '12px 18px', 
        borderRadius: 8, 
        border: '1px solid #cbd5e1', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Pager controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            className="btn btn-sm" 
            onClick={onPrevStudent} 
            disabled={currentIndex <= 0}
            title="Previous Student"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', padding: '0 4px' }}>
            Student {currentIndex + 1} of {totalStudents}
          </div>

          <button 
            className="btn btn-sm" 
            onClick={onNextStudent} 
            disabled={currentIndex >= totalStudents - 1}
            title="Next Student"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Status notification */}
        {saveStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '4px 12px', borderRadius: 20 }}>
            <CheckCircle2 size={15} /> {saveStatus}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Publish Results (DoS/Executive Only) */}
          {isExecutive && (
            <button 
              type="button"
              className="btn btn-sm" 
              onClick={handleTogglePublish}
              title={isPublished ? "Results are published with verified Principal Signature" : "Publish results now to apply Principal signature"}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                background: isPublished ? '#15803d' : '#f0fdf4', 
                color: isPublished ? '#ffffff' : '#166534', 
                borderColor: isPublished ? '#15803d' : '#86efac', 
                fontWeight: 700 
              }}
            >
              <ShieldCheck size={15} /> {isPublished ? 'Published (DoS)' : 'Publish Results (DoS)'}
            </button>
          )}
          <button 
            className="btn btn-sm" 
            onClick={handleAutoFillAllComments}
            title="Auto-fill official CBC comments for all graded subjects"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderColor: '#cbd5e1' }}
          >
            <Sparkles size={15} color="#d97706" /> Auto-Fill Remarks
          </button>
          <button 
            className="btn btn-sm" 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} /> Print
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={15} /> Save Marks
          </button>
          <button 
            className="btn btn-sm" 
            onClick={handleSaveAndNext}
            title="Save and advance to next student"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0284c7', color: '#fff', borderColor: '#0284c7' }}
          >
            Save & Next <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Student Quick-Switcher Ribbon */}
      {students && students.length > 1 && (
        <div className="no-print" style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '4px 2px 12px',
          marginBottom: 16,
          scrollbarWidth: 'thin'
        }}>
          {students.map((st) => {
            const isCurrent = st.id === student.id;
            const initials = st.name ? st.name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'ST';
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectStudent ? onSelectStudent(st.id) : null}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: isCurrent ? '2px solid #047857' : '1px solid #cbd5e1',
                  background: isCurrent ? '#ecfdf5' : '#ffffff',
                  color: isCurrent ? '#065f46' : '#475569',
                  cursor: onSelectStudent ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  boxShadow: isCurrent ? '0 2px 6px rgba(4, 120, 87, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title={`${st.name} (${st.adm || 'No Adm'})`}
              >
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isCurrent ? '#047857' : '#f1f5f9',
                  color: isCurrent ? '#ffffff' : '#475569',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {initials}
                </span>
                <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500 }}>
                  {st.name.split(/\s+/)[0]} {st.adm ? `(${st.adm})` : ''}
                </span>
                {isCurrent && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#047857' }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* The Printable Academic Report Form (Exact Replica of Uploaded Image) */}
      <div 
        id="academic-report-card-sheet"
        className="font-poppins"
        style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: 4, 
          padding: '24px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          position: 'relative',
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* School Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 12 }}>
          {/* Logo */}
          <div style={{ position: 'absolute', left: 0, top: 0 }}>
            {schoolSettings.logo ? (
              <img src={schoolSettings.logo} alt="Logo" style={{ width: 72, height: 72, objectFit: 'contain' }} />
            ) : (
              <div style={{ 
                width: 68, 
                height: 68, 
                background: 'linear-gradient(135deg, #1e3a8a, #0284c7)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                border: '2px solid #0369a1'
              }}>
                {schoolName.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* School Contact Details */}
          <div style={{ textAlign: 'center', padding: '0 80px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.5px' }}>
              {schoolName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 3 }}>
              Address: {schoolAddress}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 1 }}>
              Tel: {schoolPhone}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 1 }}>
              Email: {schoolEmail}
            </div>
          </div>
        </div>

        {/* Academic Report Ribbon */}
        <div style={{ 
          background: '#1e3a8a', 
          color: '#ffffff', 
          textAlign: 'center', 
          padding: '8px 12px', 
          fontSize: 13, 
          fontWeight: 800, 
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          borderRadius: 2,
          marginBottom: 16
        }}>
          ACADEMIC REPORT FORM - {student.class ? (student.class.toUpperCase().includes('GRADE') ? student.class.toUpperCase() : `GRADE ${student.class.toUpperCase()}`) : 'GRADE 10'} - {examTitle.toUpperCase()} - ({year} {termName.toUpperCase()})
        </div>

        {/* Student Profile & Graph Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 20 }}>
          {/* Left: Student Details */}
          <div style={{ display: 'flex', gap: 14, flex: 1 }}>
            {/* Student Photo / Silhouette */}
            <div style={{ 
              width: 90, 
              height: 100, 
              background: '#cbd5e1', 
              borderRadius: 3, 
              border: '1px solid #94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1" style={{ width: 64, height: 64 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a8a', marginBottom: 4 }}>
                {student.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                ADMNO: <span style={{ fontWeight: 800, color: '#1e293b' }}>{student.adm || student.admission_no || student.id}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                GRADE: <span style={{ fontWeight: 800, color: '#1e293b' }}>{student.class ? (student.class.toLowerCase().includes('grade') ? student.class : `Grade ${student.class}`) : 'Grade 10'}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                PATHWAY: 
                <select 
                  className="no-print"
                  value={pathway} 
                  onChange={(e) => setPathway(e.target.value)}
                  style={{ 
                    fontSize: 12, 
                    fontWeight: 800, 
                    color: '#0284c7', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: 4,
                    padding: '1px 6px',
                    background: '#f8fafc'
                  }}
                >
                  <option value="STEM">STEM</option>
                  <option value="Arts & Sports Science">Arts & Sports Science</option>
                  <option value="Social Sciences">Social Sciences</option>
                  <option value="General">General</option>
                </select>
                <span className="print-only" style={{ fontWeight: 800, color: '#1e293b' }}>{pathway}</span>
              </div>
            </div>
          </div>

          {/* Right: Trend Chart (Subject Performance - Student vs Class) */}
          <div style={{ width: 380, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.2px' }}>
                Subject Performance · Student vs Class
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#15803d' }}>
                  <span style={{ width: 10, height: 3, background: '#16a34a', borderRadius: 2 }}></span> Student
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                  <span style={{ width: 10, height: 2, background: '#94a3b8' }}></span> Class Avg
                </span>
              </div>
            </div>

            {/* SVG Chart Line */}
            <div style={{ 
              height: 110, 
              background: '#f8fafc', 
              border: '1px solid #cbd5e1', 
              borderRadius: 4,
              position: 'relative',
              padding: '4px 6px'
            }}>
              {(() => {
                const N = Math.max(1, chartPoints.length);
                const plotLeft = 28;
                const plotRight = 348;
                const plotW = plotRight - plotLeft;
                const plotTop = 10;
                const plotBottom = 68;
                const plotH = plotBottom - plotTop;
                const labelY = plotBottom + 12;

                const getX = (i) => N > 1 ? Math.round(plotLeft + (i * (plotW / (N - 1)))) : Math.round((plotLeft + plotRight) / 2);
                const getY = (val) => Math.round(plotBottom - ((Math.max(0, Math.min(100, val)) / 100) * plotH));

                const evaluatedPoints = chartPoints
                  .map((d, i) => ({ ...d, x: getX(i), y: getY(d.score), idx: i }))
                  .filter(d => d.hasScore);

                return (
                  <svg viewBox="0 0 360 90" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Y-axis Guidelines & Reference Labels */}
                    <line x1={plotLeft} y1={plotTop} x2={plotRight} y2={plotTop} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <text x={plotLeft - 4} y={plotTop + 3} textAnchor="end" fontSize="7.5" fill="#94a3b8" fontWeight="600">100</text>

                    <line x1={plotLeft} y1={getY(50)} x2={plotRight} y2={getY(50)} stroke="#f1f5f9" strokeDasharray="2 2" />
                    <text x={plotLeft - 4} y={getY(50) + 3} textAnchor="end" fontSize="7.5" fill="#94a3b8" fontWeight="600">50</text>

                    <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#cbd5e1" strokeWidth="1" />
                    <text x={plotLeft - 4} y={plotBottom + 3} textAnchor="end" fontSize="7.5" fill="#94a3b8" fontWeight="600">0</text>

                    <line x1={plotLeft} y1={plotTop - 2} x2={plotLeft} y2={plotBottom} stroke="#cbd5e1" strokeWidth="1" />

                    {/* Class Benchmark Line (Dashed Gray) */}
                    <polyline 
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth="1.5" 
                      strokeDasharray="3 2"
                      points={chartPoints.map((d, i) => `${getX(i)},${getY(d.classAvg)}`).join(' ')} 
                    />

                    {/* Student Score Line (Gold) - Only connects evaluated subjects so no false plunge */}
                    {evaluatedPoints.length > 1 && (
                      <polyline 
                        fill="none" 
                        stroke="#b8860b" 
                        strokeWidth="2.2" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={evaluatedPoints.map(d => `${d.x},${d.y}`).join(' ')} 
                      />
                    )}

                    {/* Subject dots & text labels */}
                    {chartPoints.map((d, i) => {
                      const cx = getX(i);
                      const cy = getY(d.score);
                      return (
                        <g key={i}>
                          {d.hasScore ? (
                            <>
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r="3.5" 
                                fill="#b8860b" 
                                stroke="#ffffff" 
                                strokeWidth="1.5" 
                              />
                              {evaluatedPoints.length <= 4 && (
                                <text 
                                  x={cx} 
                                  y={cy - 5} 
                                  textAnchor="middle" 
                                  fontSize="7.5" 
                                  fontWeight="800" 
                                  fill="#15803d"
                                >
                                  {d.score}%
                                </text>
                              )}
                            </>
                          ) : (
                            <circle 
                              cx={cx} 
                              cy={plotBottom} 
                              r="1.5" 
                              fill="#cbd5e1" 
                            />
                          )}

                          {/* Subject X-Axis Label: rendered directly inside SVG aligned with cx */}
                          <text 
                            x={cx} 
                            y={labelY} 
                            textAnchor="middle" 
                            fontSize={N > 8 ? "7" : "8"} 
                            fontWeight={d.hasScore ? "700" : "500"} 
                            fill={d.hasScore ? "#1e293b" : "#64748b"}
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>

        {/* KPIs Summary Bar */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          background: '#f8fafc', 
          border: '1px solid #cbd5e1', 
          borderRadius: 2, 
          padding: '10px 14px',
          marginBottom: 18,
          textAlign: 'center'
        }}>
          {/* Performance Level */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Performance Level</div>
            <div style={{ 
              fontSize: is844 ? 18 : 14, 
              fontWeight: 800, 
              color: is844 ? '#1e3a8a' : (kpis.perfLevelCode.startsWith('EE') ? '#15803d' : (kpis.perfLevelCode.startsWith('ME') ? '#0284c7' : '#b45309')), 
              marginTop: 2, 
              lineHeight: 1.25 
            }}>
              {is844 ? kpis.perfLevelCode : kpis.perfLevelFull}
            </div>
            {!is844 && kpis.perfLevelCode !== '—' && (
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                Grade Band: <span style={{ color: '#0f172a', fontWeight: 800 }}>{kpis.perfLevelCode}</span>
              </div>
            )}
          </div>

          {/* Total Marks */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Marks</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span>{kpis.totalMarks}</span>
              {kpis.totalMarksDev.text !== '-' && (
                <span style={{ fontSize: 13, fontWeight: 700, color: kpis.totalMarksDev.color }}>
                  {kpis.totalMarksDev.text} {kpis.totalMarksDev.arrow}
                </span>
              )}
            </div>
          </div>

          {/* Total Points */}
          <div style={{ borderRight: '1px solid #e2e8f0', padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Points</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span>{kpis.totalPoints}</span>
              {kpis.totalPointsDev.text !== '-' && (
                <span style={{ fontSize: 13, fontWeight: 700, color: kpis.totalPointsDev.color }}>
                  {kpis.totalPointsDev.text} {kpis.totalPointsDev.arrow}
                </span>
              )}
            </div>
          </div>

          {/* Mean Points */}
          <div style={{ padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Mean Points</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span>{kpis.meanPoints}</span>
              {kpis.meanPointsDev.text !== '-' && (
                <span style={{ fontSize: 13, fontWeight: 700, color: kpis.meanPointsDev.color }}>
                  {kpis.meanPointsDev.text} {kpis.meanPointsDev.arrow}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Subjects Marks Entry Table */}
        <div style={{ marginBottom: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '24%' }}>
                  SUBJECTS
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '12%' }}>
                  MARKS (%)
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '9%' }}>
                  DEV.
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '10%' }}>
                  GRADE
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1', width: '28%' }}>
                  COMMENT
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#1e293b', width: '17%' }}>
                  TEACHER
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, index) => {
                const canEditThis = canEditSubject(r.subject);
                return (
                  <tr key={r.subject} style={{ borderBottom: '1px solid #cbd5e1' }}>
                    {/* Subject Name */}
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                      {r.subject}
                    </td>

                    {/* MARKS Input (0-100% or raw normalized) */}
                    <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                      <input 
                        ref={(el) => (inputRefs.current[r.subject] = el)}
                        type="text"
                        inputMode="numeric"
                        disabled={!canEditThis}
                        value={r.scoreVal === 'X' ? 'X' : (r.scoreVal !== '' ? `${r.scoreVal}%` : '')}
                        onChange={(e) => {
                          const val = e.target.value.replace('%', '');
                          handleScoreChange(r.subject, val);
                        }}
                        onFocus={(e) => {
                          setActiveSubjectInput(r.subject);
                          e.target.select();
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        placeholder={`/${outOf}`}
                        title={canEditThis ? "Type mark and press Enter to advance" : "Restricted: Assigned to other subject"}
                        style={{
                          width: '100%',
                          maxWidth: 64,
                          height: 28,
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: 13,
                          color: canEditThis ? '#0369a1' : '#64748b',
                          background: canEditThis ? '#ffffff' : '#f1f5f9',
                          border: activeSubjectInput === r.subject ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          borderRadius: 4,
                          outline: 'none',
                          cursor: canEditThis ? 'text' : 'not-allowed'
                        }}
                      />
                    </td>

                    {/* DEV. Column */}
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, color: r.devObj.color, borderRight: '1px solid #cbd5e1' }}>
                      {r.devObj.text !== '-' ? `${r.devObj.text} ${r.devObj.arrow}` : '—'}
                    </td>

                    {/* GRADE & Points */}
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                      {r.grade !== '-' ? (
                        <span style={{ 
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: r.grade.startsWith('EE') ? '#ecfdf5' : (r.grade.startsWith('ME') ? '#eff6ff' : (r.grade.startsWith('AE') ? '#fffbeb' : '#fef2f2')),
                          color: r.grade.startsWith('EE') ? '#047857' : (r.grade.startsWith('ME') ? '#1d4ed8' : (r.grade.startsWith('AE') ? '#b45309' : '#b91c1c')),
                          border: `1px solid ${r.grade.startsWith('EE') ? '#a7f3d0' : (r.grade.startsWith('ME') ? '#bfdbfe' : (r.grade.startsWith('AE') ? '#fde68a' : '#fecaca'))}`
                        }}>
                          {r.grade}
                        </span>
                      ) : '—'}
                    </td>

                    {/* COMMENT (Editable, auto-filled with official CBC remarks) */}
                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>
                      <input 
                        type="text"
                        disabled={!canEditThis}
                        value={r.comment || ''}
                        onChange={(e) => handleCommentChange(r.subject, e.target.value)}
                        placeholder="CBC Official Remark"
                        style={{
                          width: '100%',
                          height: 28,
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: 4,
                          padding: '0 6px',
                          background: canEditThis ? '#ffffff' : '#f8fafc',
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* TEACHER (Assigned or editable) */}
                    <td style={{ padding: '4px 6px' }}>
                      <input 
                        type="text"
                        disabled={!canEditThis}
                        value={r.teacher || ''}
                        onChange={(e) => handleTeacherChange(r.subject, e.target.value)}
                        placeholder="Teacher Name"
                        style={{
                          width: '100%',
                          height: 28,
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: 4,
                          padding: '0 6px',
                          background: canEditThis ? '#ffffff' : '#f8fafc',
                          outline: 'none'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Remarks Section (Class Teacher & Chief Principal) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Class Teacher Remarks */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 2, padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
              Class Teacher Remarks: <span style={{ fontWeight: 600, color: '#475569' }}>{teacherName}</span>
            </div>
            
            <textarea 
              rows={3}
              value={classTeacherRemarks}
              onChange={(e) => setClassTeacherRemarks(e.target.value)}
              style={{
                width: '100%',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                padding: '6px',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                background: '#fafafa'
              }}
            />

            {/* Signature Area */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Signature:</span>
              <div style={{ position: 'relative', width: 120, height: 24, borderBottom: '1px solid #475569' }}>
                <svg viewBox="0 0 100 24" style={{ position: 'absolute', bottom: 2, left: 4, width: 80, height: 20 }}>
                  <path d="M5,18 Q25,2 45,16 T85,6" stroke="#1d4ed8" strokeWidth="1.8" fill="none" />
                </svg>
              </div>
            </div>
          </div>

          {/* Chief Principal Remarks with Stamp & Signature */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 2, padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Chief Principal Remarks: <span style={{ fontWeight: 600, color: '#475569' }}>{principalName}</span></span>
              {isPublished && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', padding: '1px 7px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={11} /> Published &amp; Certified
                </span>
              )}
            </div>

            <textarea 
              rows={3}
              value={principalRemarks}
              onChange={(e) => setPrincipalRemarks(e.target.value)}
              style={{
                width: '100%',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                padding: '6px',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                background: '#fafafa'
              }}
            />

            {/* Rubber Stamp and Signature */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Signature:</span>
                <div style={{ 
                  position: 'relative', 
                  width: 130, 
                  height: 32, 
                  borderBottom: '1px solid #475569',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center'
                }}>
                  {isPublished && principalSignature ? (
                    <img 
                      src={principalSignature} 
                      alt="Chief Principal Signature" 
                      style={{ 
                        position: 'absolute', 
                        bottom: 2, 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        maxHeight: 34, 
                        maxWidth: 120, 
                        objectFit: 'contain',
                        pointerEvents: 'none' 
                      }} 
                    />
                  ) : isPublished && !principalSignature ? (
                    <svg viewBox="0 0 100 24" style={{ position: 'absolute', bottom: 2, left: 4, width: 80, height: 20 }}>
                      <path d="M4,16 C30,4 50,22 88,8" stroke="#1d4ed8" strokeWidth="1.8" fill="none" />
                    </svg>
                  ) : (
                    <span className="no-print" style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginBottom: 2 }}>
                      (Applies on Publish)
                    </span>
                  )}
                </div>

                {/* DoS inline triggers */}
                {isExecutive && (
                  <div className="no-print" style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
                    <label 
                      title={principalSignature ? "Replace Principal Signature" : "Upload Scanned Principal Signature"}
                      style={{ 
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 4, 
                        fontSize: 10, 
                        fontWeight: 700, 
                        color: '#0369a1', 
                        background: '#f0f9ff', 
                        border: '1px solid #bae6fd', 
                        borderRadius: 4, 
                        padding: '2px 6px' 
                      }}
                    >
                      <Upload size={11} /> {principalSignature ? 'Change Sig' : 'Upload Sig'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSignatureUpload} />
                    </label>

                    {!isPublished && (
                      <button 
                        type="button" 
                        onClick={handleTogglePublish}
                        title="Click to publish results and stamp Principal signature"
                        style={{ 
                          cursor: 'pointer', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 3, 
                          fontSize: 10, 
                          fontWeight: 700, 
                          color: '#15803d', 
                          background: '#f0fdf4', 
                          border: '1px solid #86efac', 
                          borderRadius: 4, 
                          padding: '2px 6px' 
                        }}
                      >
                        <ShieldCheck size={11} /> Publish to Sign
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Official Rubber Stamp Box */}
              <div style={{ position: 'relative' }}>
                {schoolSettings.stamp ? (
                  <img 
                    src={schoolSettings.stamp} 
                    alt="School Stamp" 
                    style={{ 
                      maxHeight: 48, 
                      maxWidth: 120, 
                      objectFit: 'contain',
                      transform: 'rotate(-4deg)',
                      opacity: 0.92
                    }} 
                  />
                ) : (
                  <div style={{ 
                    border: '2px solid #1d4ed8', 
                    color: '#1d4ed8', 
                    borderRadius: 4, 
                    padding: '2px 8px', 
                    fontSize: 8.5, 
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: 1.2,
                    transform: 'rotate(-2deg)',
                    opacity: 0.9
                  }}>
                    <div>CHIEF PRINCIPAL</div>
                    <div>{schoolName.toUpperCase()}</div>
                    <div>{schoolAddress.split(',')[0]}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Official KNEC GRADE DESCRIPTORS Reference Table */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 4, textTransform: 'uppercase' }}>
            GRADE DESCRIPTORS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: 10.5, textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #94a3b8' }}>
                <th style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8', textAlign: 'left', width: 130, fontWeight: 700 }}>
                  Performance Level
                </th>
                <th colSpan={2} style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8', fontWeight: 700 }}>
                  Exceeding Expectations
                </th>
                <th colSpan={2} style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8', fontWeight: 700 }}>
                  Meeting Expectations
                </th>
                <th colSpan={2} style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8', fontWeight: 700 }}>
                  Approaching Expectations
                </th>
                <th colSpan={2} style={{ padding: '4px 6px', fontWeight: 700 }}>
                  Below Expectations
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '4px 6px', fontWeight: 700, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>
                  Actual Performance
                </td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>EE1</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>EE2</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>ME1</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>ME2</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>AE1</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>AE2</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>BE1</td>
                <td style={{ padding: '4px 6px' }}>BE2</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '4px 6px', fontWeight: 700, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>
                  Points
                </td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>8</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>7</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>6</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>5</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>4</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>3</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>2</td>
                <td style={{ padding: '4px 6px' }}>1</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 6px', fontWeight: 700, borderRight: '1px solid #94a3b8', textAlign: 'left' }}>
                  Range (%)
                </td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>90-100</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>75-89</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>58-74</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>41-57</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>31-40</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #94a3b8' }}>21-30</td>
                <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>11-20</td>
                <td style={{ padding: '4px 6px' }}>0-10</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Verification Code & QR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          <div style={{ width: 50, height: 50, border: '1px solid #cbd5e1', padding: 2, flexShrink: 0, background: '#fff' }}>
            <QRCodeSVG value={`https://digishule.com/verify?adm=${student.adm || student.id}&term=${termName}`} size={44} level="M" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b' }}>
              Verification Code: {student.adm ? student.adm.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() : 'P6AK6F'}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
              Scan to access interactive student profile on DigiShule Analytics.
            </div>
            <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 600 }}>
              Your username: {(student.adm || 'student').toLowerCase()}@{schoolName.toLowerCase().replace(/\s+/g, '')}.ac.ke
            </div>
          </div>
        </div>

      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
            padding: 0 !important;
          }
          #academic-report-card-sheet {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .print-only {
            display: inline-block !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
