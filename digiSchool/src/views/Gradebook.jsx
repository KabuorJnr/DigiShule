import { useState, useMemo, useEffect } from 'react';
import { fetchStudents } from '../lib/api';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { CLASSES, SUBJECTS, getDynamicClasses, expandClassesWithStreams } from '../data/seed';
import { computeRow, gradeFor, remarkFor, subjectAverage, is844Class, pointsForGrade } from '../utils/grading';
import { exportTablePDF, downloadExcel, exportReportCardsPDF } from '../utils/exporters';
import ReportCardEntrySheet from '../components/ReportCardEntrySheet';
import ClassSubjectAnalysis from '../components/ClassSubjectAnalysis';

const GRADE_COLORS = { EE: '#047857', ME: '#047857', AE: '#F59E0B', BE: '#EF4444', A: '#047857', 'A-': '#047857', 'B+': '#047857', B: '#047857', 'B-': '#047857', 'C+': '#047857', C: '#F59E0B', 'C-': '#F59E0B', 'D+': '#F59E0B', D: '#EF4444', 'D-': '#EF4444', E: '#EF4444', '-': '#9CA3AF' };
const ASSESS_OPTIONS = ['All', 'Assessment 1', 'Assessment 2', 'Assessment 3', 'Assessment 4'];
const EXAM_OPTIONS = ['End Term Assessment', 'Mid Term Assessment', 'Opening Assessment', 'Continuous Assessment (CAT)'];

export default function Gradebook({ store }) {
  const { updateStudent, gradeBoundaries, settings, setSettings, notify, user, teachers = [] } = store;
  
  // View mode: 'report' for official Kenyan Academic Report Form format, 'grid' for class subject table
  const [entryMode, setEntryMode] = useState('report');
  
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [term, setTerm] = useState('Term 2');
  const [examTitle, setExamTitle] = useState('End Term Assessment');
  const [examYear, setExamYear] = useState('2026');
  const [assessment, setAssessment] = useState('All');
  const [outOf, setOutOf] = useState(100); // "marks out of" — raw marks convert to %
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {id, field}
  const [selected, setSelected] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  
  const [loadedStudents, setLoadedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Subject permission check for teachers
  const teacherRecord = useMemo(() => {
    if (user?.role !== 'teacher') return null;
    return (teachers || []).find(t => t.id === user.id || t.email === user.email || t.name === user.name) || null;
  }, [user, teachers]);

  const allowedSubjects = useMemo(() => {
    if (!user || user.role !== 'teacher') return SUBJECTS;
    const subjList = [];
    if (user.subject) subjList.push(user.subject);
    if (user.dept) subjList.push(user.dept);
    if (teacherRecord?.subject) subjList.push(teacherRecord.subject);
    if (teacherRecord?.subjects && Array.isArray(teacherRecord.subjects)) subjList.push(...teacherRecord.subjects);
    const unique = [...new Set(subjList.filter(Boolean))];
    return unique.length > 0 ? unique : SUBJECTS;
  }, [user, teacherRecord]);

  const canEditAll = useMemo(() => {
    if (!user) return true;
    if (user.role === 'principal' || user.role === 'parent' || user.role === 'student') return false;
    if (user.role === 'dos' || user.role === 'deputy_academic' || user.role === 'admin' || user.dept === 'dos') return true;
    return false;
  }, [user]);

  const canEditCurrentSubject = useMemo(() => {
    if (!user) return true;
    if (user.role === 'principal') return false;
    if (user.role === 'dos' || user.role === 'deputy_academic' || user.role === 'admin' || user.dept === 'dos') return true;
    if (user.role !== 'teacher') return true;
    return allowedSubjects.includes(subject);
  }, [user, allowedSubjects, subject]);

  // Extract classes from students for a complete stream list, falling back to settings
  const dynamicClasses = useMemo(() => {
    if (store.students && store.students.length > 0) {
      return getDynamicClasses(store.students);
    }
    return expandClassesWithStreams(settings?.classes || []);
  }, [settings, store.students]);

  // Auto-select first class if none selected
  useEffect(() => {
    if (!cls && dynamicClasses && dynamicClasses.length > 0) {
      setCls(dynamicClasses[0]);
    }
  }, [cls, dynamicClasses]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const { data } = await fetchStudents(0, 200, { class: cls });
        if (active) {
          setLoadedStudents(data);
          if (data.length > 0 && !selectedStudentId) {
            setSelectedStudentId(data[0].id);
          }
        }
      } catch (e) {
        notify('Failed to load gradebook', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [cls]);

  const classStudents = useMemo(
    () => loadedStudents.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [loadedStudents, search]
  );

  // Active student for Report Card Form entry
  const currentStudent = useMemo(() => {
    if (!classStudents || classStudents.length === 0) return null;
    if (selectedStudentId) {
      const found = classStudents.find(s => s.id === selectedStudentId);
      if (found) return found;
    }
    return classStudents[0];
  }, [classStudents, selectedStudentId]);

  const currentStudentIndex = useMemo(() => {
    if (!currentStudent || !classStudents.length) return 0;
    const idx = classStudents.findIndex(s => s.id === currentStudent.id);
    return idx >= 0 ? idx : 0;
  }, [classStudents, currentStudent]);

  const handleNextStudent = () => {
    if (currentStudentIndex < classStudents.length - 1) {
      setSelectedStudentId(classStudents[currentStudentIndex + 1].id);
    }
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(classStudents[currentStudentIndex - 1].id);
    }
  };

  const handleSaveStudentReport = (updated) => {
    updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const rows = useMemo(() =>
    classStudents.map((s) => {
      const r = computeRow(s.scores?.[subject]);
      const systemType = is844Class(s.class) ? '844' : 'CBC';
      const percentage = r.average <= 4 && r.average > 0 ? Math.round(r.average * 25) : r.average;
      const grade = gradeFor(percentage, gradeBoundaries, systemType);
      const points = pointsForGrade(grade, systemType);
      return { ...s, ...r, percentage, grade, points, systemType, remarks: r.remarks || remarkFor(grade, systemType) };
    }), [classStudents, subject, gradeBoundaries]);

  const colAvg = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = (k) => rows.reduce((a, b) => a + (b[k] || 0), 0);
    const validCount = (k) => rows.filter(b => b[k] > 0).length || 1;
    const avg = (k) => Math.round((sum(k) / validCount(k)) * 10) / 10;
    const avgScore = avg('average');
    const system = rows[0]?.systemType || 'CBC';
    const avgGrade = gradeFor(avgScore, gradeBoundaries, system);
    const avgPoints = pointsForGrade(avgGrade, system);
    return { a1: avg('a1'), a2: avg('a2'), a3: avg('a3'), a4: avg('a4'), average: avgScore, points: avgPoints, grade: avgGrade };
  }, [rows, gradeBoundaries]);

  // Performance summary with standard CBC / 844 grouping
  const gradeDist = useMemo(() => {
    const counts = { EE: 0, ME: 0, AE: 0, BE: 0 };
    rows.forEach((r) => {
      if (r.grade && r.grade !== '-') {
        let cat = 'BE';
        if (r.grade.startsWith('EE') || ['A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(r.grade)) cat = 'EE';
        else if (r.grade.startsWith('ME') || ['C', 'C-', 'D+'].includes(r.grade)) cat = 'ME';
        else if (r.grade.startsWith('AE') || ['D', 'D-'].includes(r.grade)) cat = 'AE';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([grade, value]) => ({ grade, value }));
  }, [rows]);

  const top5 = useMemo(() => [...rows].sort((a, b) => b.average - a.average).slice(0, 5), [rows]);
  const atRisk = useMemo(() => rows.filter((r) => r.average > 0 && r.average < 40), [rows]);
  const subjectCompare = useMemo(() =>
    SUBJECTS.map((sub) => {
      const avg = classStudents.reduce((a, s) => a + subjectAverage(s.scores?.[sub]), 0) / (classStudents.length || 1);
      return { subject: sub.slice(0, 4), avg: Math.round(avg * 10) / 10 };
    }), [classStudents]);

  function saveScore(id, field, value) {
    if (!canEditCurrentSubject) {
      notify(`Access Restricted: You are assigned to teach ${allowedSubjects.join(', ')}. You cannot modify marks for ${subject}.`, 'warning', 'Subject Permission');
      setEditing(null);
      return;
    }
    const target = loadedStudents.find((s) => s.id === id);
    if (!target) return;
    let v;
    if (field === 'remarks') {
      v = value;
    } else if (String(value).trim().toLowerCase() === 'x') {
      v = 'X';
    } else if (String(value).trim() === '') {
      v = 0;
    } else {
      const max = Math.max(1, Number(outOf) || 100);
      v = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / max * 100)));
    }
    if (target) {
      const currentScores = target.scores || {};
      const subjectScores = currentScores[subject] || {};
      const updated = { ...target, scores: { ...currentScores, [subject]: { ...subjectScores, [field]: v, score: v, average: v } } };
      updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    setEditing(null);
  }

  function flagStudent(id) {
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const updated = { ...target, flagged: true };
      updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    notify('Student flagged for support', 'success', 'Gradebook');
  }

  const handleApproveResults = () => {
    setSettings({ results_approved: !settings.results_approved });
    notify(settings.results_approved ? 'Results approval revoked' : 'Results approved', 'success');
  };

  const handlePublishResults = () => {
    setSettings({ results_published: !settings.results_published });
    notify(settings.results_published ? 'Results unpublished' : 'Results published', 'success');
  };

  function exportPDF() {
    const head = ['#', 'Student', 'Adm No.', 'Ass. 1 (%)', 'Ass. 2 (%)', 'Ass. 3 (%)', 'Ass. 4 (%)', 'Avg (%)', 'CBC Points', 'Grade/Level', 'Remarks'];
    const body = rows.map((r, i) => [i + 1, r.name, r.adm, r.a1, r.a2, r.a3, r.a4, `${r.average}%`, `${r.points} pts`, r.grade, r.remarks]);
    exportTablePDF({ school: settings, title: `Gradebook - Grade ${cls}  |  ${subject}`, subtitle: `${term}  |  ${assessment}`, head, body, filename: `gradebook-${cls}-${subject}.pdf` });
    notify('Gradebook exported as PDF', 'success', 'Export');
  }

  function exportExcel() {
    const aoa = [['#', 'Student', 'Adm No.', 'Ass. 1 (%)', 'Ass. 2 (%)', 'Ass. 3 (%)', 'Ass. 4 (%)', 'Avg (%)', 'CBC Points', 'Grade/Level', 'Remarks']];
    rows.forEach((r, i) => aoa.push([i + 1, r.name, r.adm, r.a1, r.a2, r.a3, r.a4, `${r.average}%`, `${r.points} pts`, r.grade, r.remarks]));
    downloadExcel(`gradebook-${cls}-${subject}.xlsx`, [{ name: `${cls} ${subject}`.slice(0, 31), aoa }]);
    notify('Gradebook exported as Excel', 'success', 'Export');
  }

  function generateReportCards() {
    let chosen = loadedStudents.filter((r) => selected.includes(r.id));
    if (chosen.length === 0) {
      chosen = loadedStudents.filter((r) => !cls || r.class === cls);
    }
    if (chosen.length === 0) return notify('No students found for generating report cards', 'warning');
    exportReportCardsPDF({
      school: settings,
      gradeBoundaries: gradeBoundaries,
      students: chosen,
      subjects: SUBJECTS,
      examTitle: `${term} ${examTitle}`,
      termName: term,
      filename: `report-cards-${cls || 'all'}.pdf`,
    });
    notify(`Generated ${chosen.length} report card(s)`, 'success', 'Report Cards');
  }

  const ScoreCell = ({ r, field, editing, setEditing, saveScore }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            className="score-input"
            style={{ width: field === 'remarks' ? '120px' : '52px', padding: '0 4px' }}
            type="text"
            inputMode={field === 'remarks' ? undefined : 'numeric'}
            enterKeyHint="next"
            placeholder={field === 'remarks' ? '' : `/${Math.max(1, Number(outOf) || 100)}`}
            autoFocus
            defaultValue={r[field]}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveScore(r.id, field, e.target.value);
                if (field !== 'remarks') {
                  const idx = rows.findIndex((x) => x.id === r.id);
                  const next = rows[idx + 1];
                  if (next) setEditing({ id: next.id, field });
                }
              }
              if (e.key === 'Escape') setEditing(null);
            }}
            onBlur={(e) => saveScore(r.id, field, e.target.value)}
          />
        </td>
      );
    }
    return (
      <td 
        style={{ 
          cursor: canEditCurrentSubject ? 'pointer' : 'not-allowed', 
          minWidth: field === 'remarks' ? '120px' : '40px', 
          fontWeight: field === 'remarks' ? 400 : 600, 
          color: field === 'remarks' ? '#475569' : '#0369A1',
          opacity: canEditCurrentSubject ? 1 : 0.7 
        }} 
        onClick={() => {
          if (!canEditCurrentSubject) {
            notify(`Access Restricted: You are assigned to teach ${allowedSubjects.join(', ')}. You cannot modify marks for ${subject}.`, 'warning', 'Subject Permission');
            return;
          }
          setEditing({ id: r.id, field });
        }}
        title={canEditCurrentSubject ? `Click to edit ${field === 'remarks' ? 'remarks' : '(0-100%)'}` : `View only: Assigned to teach ${allowedSubjects.join(', ')}`}
      >
        {r[field] || (field === 'remarks' ? 'Add remark...' : '-')}
      </td>
    );
  };

  return (
    <div>
      <PageHeader
        title="Gradebook & Academic Marks Entry"
        subtitle="Record student scores in official Kenyan Academic Report Form or Class Subject Grid"
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(store.user?.role === 'deputy_academic' || store.user?.role === 'dos') && (
              <button 
                className={`btn ${settings?.results_approved ? 'btn-danger' : 'btn-primary'}`} 
                onClick={handleApproveResults}
              >
                <Icon name={settings?.results_approved ? "close" : "check"} size={16} /> 
                {settings?.results_approved ? 'Revoke Approval' : 'Approve Results'}
              </button>
            )}
            {(store.user?.role === 'dos') && settings?.results_approved && (
              <button 
                className={`btn ${settings?.results_published ? 'btn-danger' : 'btn-primary'}`} 
                onClick={handlePublishResults}
              >
                <Icon name={settings?.results_published ? "close" : "check"} size={16} /> 
                {settings?.results_published ? 'Unpublish Results (DoS)' : 'Publish Results (DoS)'}
              </button>
            )}
            <button className="btn" onClick={exportExcel}><Icon name="file" size={16} /> Export Excel</button>
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
          </div>
        }
      />

      {/* Mode Switcher Banner: Official Report Form vs Class Grid */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: '#ffffff', 
        padding: '8px 12px', 
        borderRadius: 8, 
        border: '1px solid #cbd5e1', 
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Entry Format:</span>
          
          <button 
            className={`btn btn-sm ${entryMode === 'report' ? 'btn-primary' : ''}`}
            onClick={() => setEntryMode('report')}
            style={{ 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              boxShadow: entryMode === 'report' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none'
            }}
          >
            <Icon name="file" size={16} /> 📄 Academic Report Form Entry (Per Student)
          </button>

          <button 
            className={`btn btn-sm ${entryMode === 'grid' ? 'btn-primary' : ''}`}
            onClick={() => setEntryMode('grid')}
            style={{ 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              boxShadow: entryMode === 'grid' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none'
            }}
          >
            <Icon name="chart" size={16} /> 📊 Class Subject Grid Entry (All Students)
          </button>

          <button 
            className={`btn btn-sm ${entryMode === 'analysis' ? 'btn-primary' : ''}`}
            onClick={() => setEntryMode('analysis')}
            style={{ 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              boxShadow: entryMode === 'analysis' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none'
            }}
          >
            <Icon name="chart" size={16} /> 📈 Class & Subject Analysis
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
          {entryMode === 'report' ? '1:1 Visual match with official Kenya CBC Academic Report Form' : (entryMode === 'analysis' ? 'Group results per class and choose subjects to analyze' : 'Batch mark entry for entire stream')}
        </div>
      </div>

      {/* Global Toolbar Filters (Report & Grid Modes) */}
      {entryMode !== 'analysis' && (
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div>
            <label className="field-label">Class</label>
            <select 
              className="select" 
              value={cls} 
              onChange={(e) => { 
                setCls(e.target.value); 
                setSelected([]); 
                setSelectedStudentId(null);
              }} 
              style={{ width: 140 }}
            >
              {dynamicClasses.map((c) => <option key={c} value={c}>Grade {c}</option>)}
            </select>
          </div>

          {entryMode === 'report' && (
            <div>
              <label className="field-label">Select Student</label>
              <select 
                className="select" 
                value={currentStudent?.id || ''} 
                onChange={(e) => setSelectedStudentId(e.target.value)}
                style={{ width: 220, fontWeight: 700, color: '#1e3a8a' }}
              >
                {classStudents.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {idx + 1}. {s.name} ({s.adm || 'No Adm'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {entryMode === 'grid' && (
            <div>
              <label className="field-label">Subject</label>
              <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: 160 }}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="field-label">Term</label>
            <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 110 }}>
              {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Exam Assessment</label>
            <select className="select" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} style={{ width: 170 }}>
              {EXAM_OPTIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Marks out of</label>
            <input 
              className="input" 
              type="number" 
              min="1" 
              max="1000" 
              value={outOf}
              onChange={(e) => setOutOf(e.target.value.replace(/[^\d]/g, '') || '')}
              title="Raw marks entered normalize automatically to percentages and CBC points."
              style={{ width: 85, textAlign: 'center', fontWeight: 700 }} 
            />
          </div>

          {entryMode === 'grid' && (
            <div>
              <label className="field-label">Assessment Column</label>
              <select className="select" value={assessment} onChange={(e) => setAssessment(e.target.value)} style={{ width: 130 }}>
                {ASSESS_OPTIONS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">Search student</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" />
          </div>
        </div>
      )}

      {!canEditCurrentSubject && entryMode === 'grid' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="warning" size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong>Subject Permission Restriction:</strong> You are logged in as a Subject Teacher for <strong>{allowedSubjects.join(', ')}</strong>. Results for <strong>{subject}</strong> are view-only.
          </div>
        </div>
      )}

      {/* -------------------- VIEW MODE 3: CLASS & SUBJECT ANALYSIS -------------------- */}
      {entryMode === 'analysis' && (
        <div style={{ marginBottom: 30 }}>
          <ClassSubjectAnalysis 
            students={store.students && store.students.length > 0 ? store.students : loadedStudents}
            gradeBoundaries={gradeBoundaries}
            schoolSettings={settings}
            onSelectClass={(className) => {
              setCls(className);
              setEntryMode('grid');
            }}
          />
        </div>
      )}

      {/* -------------------- VIEW MODE 1: OFFICIAL ACADEMIC REPORT FORM ENTRY -------------------- */}
      {entryMode === 'report' && (
        <div style={{ marginBottom: 30 }}>
          {currentStudent ? (
            <ReportCardEntrySheet
              student={currentStudent}
              students={loadedStudents}
              onSaveStudent={handleSaveStudentReport}
              onNextStudent={handleNextStudent}
              onPrevStudent={handlePrevStudent}
              currentIndex={currentStudentIndex}
              totalStudents={classStudents.length}
              schoolSettings={settings}
              onUpdateSettings={setSettings}
              onPublishResults={handlePublishResults}
              teachers={teachers}
              currentUser={user}
              gradeBoundaries={gradeBoundaries}
              examTitle={examTitle}
              termName={term}
              year={examYear}
              outOf={outOf}
              canEditAll={canEditAll}
              allowedSubjects={allowedSubjects}
            />
          ) : (
            <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 8 }}>No students found in {cls || 'this class'}</div>
              <p className="muted">Please select another class or adjust your search filter.</p>
            </div>
          )}
        </div>
      )}

      {/* -------------------- VIEW MODE 2: CLASS SUBJECT GRID ENTRY -------------------- */}
      {entryMode === 'grid' && (
        <>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <strong>{selected.length} selected for report cards</strong>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={generateReportCards} 
                disabled={user?.role === 'teacher' && !settings?.results_published} 
                title={user?.role === 'teacher' && !settings?.results_published ? "Report cards must be published by Admin before generating" : ""}
              >
                <Icon name="print" size={16} style={{ marginRight: 6 }} /> Generate Report Cards
              </button>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={selected.length === rows.length && rows.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                    </th>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Adm. No.</th>
                    <th>Ass. 1 (%)</th><th>Ass. 2 (%)</th><th>Ass. 3 (%)</th><th>Ass. 4 (%)</th>
                    <th>Avg (%)</th>
                    <th>CBC Points</th>
                    <th>Performance Level</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={r.average > 0 && r.average < 40 ? { background: '#fee2e2' } : undefined}>
                      <td><input type="checkbox" checked={selected.includes(r.id)}
                        onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
                      <td>{i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.name} {r.flagged && <Badge color="amber">Flagged</Badge>}
                      </td>
                      <td>{r.adm}</td>
                      <ScoreCell r={r} field="a1" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                      <ScoreCell r={r} field="a2" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                      <ScoreCell r={r} field="a3" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                      <ScoreCell r={r} field="a4" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                      <td style={{ fontWeight: 700, color: '#0369A1' }}>{r.average > 0 ? `${r.average}%` : '-'}</td>
                      <td>
                        {r.points > 0 ? (
                          <Badge color="blue">{r.points} pts</Badge>
                        ) : '-'}
                      </td>
                      <td>
                        <Badge color={r.grade?.startsWith('EE') || r.grade?.startsWith('ME') || ['A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(r.grade) ? 'green' : r.grade?.startsWith('AE') || ['C', 'C-', 'D+'].includes(r.grade) ? 'amber' : 'red'}>
                          {r.grade}
                        </Badge>
                      </td>
                      <ScoreCell r={r} field="remarks" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                      <td>
                        <button 
                          className="btn btn-sm"
                          onClick={() => {
                            setSelectedStudentId(r.id);
                            setEntryMode('report');
                          }}
                          title="Open official Report Form marks entry for this student"
                          style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Icon name="file" size={13} /> Report Form
                        </button>
                      </td>
                    </tr>
                  ))}
                  {colAvg && (
                    <tr style={{ background: '#eef2f7', fontWeight: 700 }}>
                      <td></td><td></td><td>Class Average</td><td></td>
                      <td>{colAvg.a1 ? `${colAvg.a1}%` : '-'}</td>
                      <td>{colAvg.a2 ? `${colAvg.a2}%` : '-'}</td>
                      <td>{colAvg.a3 ? `${colAvg.a3}%` : '-'}</td>
                      <td>{colAvg.a4 ? `${colAvg.a4}%` : '-'}</td>
                      <td style={{ color: '#0369A1' }}>{colAvg.average ? `${colAvg.average}%` : '-'}</td>
                      <td>{colAvg.points ? <Badge color="blue">{colAvg.points} pts</Badge> : '-'}</td>
                      <td>{colAvg.grade ? <Badge color="green">{colAvg.grade}</Badge> : '-'}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                  {rows.length === 0 && <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--muted)' }}>No students match.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance summary charts */}
          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            <div className="card card-pad">
              <h3 className="section-title">Competency Distribution</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={gradeDist} dataKey="value" nameKey="grade" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.grade}: ${e.value}`}>
                    {gradeDist.map((d) => <Cell key={d.grade} fill={GRADE_COLORS[d.grade] || '#047857'} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card card-pad">
              <h3 className="section-title">Subject Comparison (class average)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={subjectCompare} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="avg" name="Class Mean %" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card card-pad">
              <h3 className="section-title">Top 5 Students</h3>
              <div className="list-flex">
                {top5.map((r, i) => (
                  <div key={r.id} className="rank-row">
                    <span className="rank-num">{i + 1}</span>
                    <span style={{ flex: 1 }}>{r.name}</span>
                    <strong style={{ color: '#0369A1' }}>{r.average}% ({r.points} pts)</strong>
                    <Badge color={r.grade?.startsWith('EE') || r.grade?.startsWith('ME') || ['A', 'A-', 'B+', 'B'].includes(r.grade) ? 'green' : 'amber'}>{r.grade}</Badge>
                  </div>
                ))}
                {top5.length === 0 && <span className="muted">No data.</span>}
              </div>
            </div>
            <div className="card card-pad">
              <h3 className="section-title">At-Risk Students (mean score &lt; 40%)</h3>
              <div className="list-flex">
                {atRisk.map((r) => (
                  <div key={r.id} className="rank-row">
                    <span style={{ flex: 1 }}>{r.name} <span className="muted">({r.average}% · {r.points} pts)</span></span>
                    {r.flagged ? <Badge color="amber">Flagged</Badge> : (
                      <button className="btn btn-sm" onClick={() => flagStudent(r.id)}>Flag for Support</button>
                    )}
                  </div>
                ))}
                {atRisk.length === 0 && <span className="muted">No at-risk students in this subject. <Icon name="check" size={16} style={{ verticalAlign: 'text-bottom' }} /></span>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
