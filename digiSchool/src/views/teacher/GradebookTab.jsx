import { useOutletContext } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { computeRow, gradeFor, remarkFor, is844Class, pointsForGrade } from '../../utils/grading';
import { Badge } from '../../components/widgets';
import ReportCardEntrySheet from '../../components/ReportCardEntrySheet';
import ClassSubjectAnalysis from '../../components/ClassSubjectAnalysis';
import { exportTablePDF, downloadExcel, exportReportCardsPDF } from '../../utils/exporters';
import { 
  BarChart3, 
  FileText, 
  LayoutGrid, 
  Download, 
  Printer, 
  Search, 
  Users, 
  Award, 
  TrendingUp, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react';

const EXAM_OPTIONS = ['End Term Assessment', 'Mid Term Assessment', 'Opening Assessment', 'Continuous Assessment (CAT)'];

export default function GradebookTab() {
  const { 
    store, 
    subject = 'Mathematics', 
    loadedStudents = [], 
    setLoadedStudents, 
    subjectClasses = [], 
    assignedClass, 
    teacherName = 'Teacher' 
  } = useOutletContext();
  
  const { gradeBoundaries, settings, user, teachers = [] } = store;
  
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'report' | 'analysis'
  const [selectedStream, setSelectedStream] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [outOf, setOutOf] = useState(100); // Raw marks normalize to percentage
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('Term 2');
  const [examTitle, setExamTitle] = useState('End Term Assessment');
  const [examYear, setExamYear] = useState('2026');
  const [selected, setSelected] = useState([]);

  // Pagination State for 180+ student cohorts
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Available classes for this teacher
  const availableClasses = useMemo(() => {
    const set = new Set();
    if (assignedClass) set.add(assignedClass);
    (subjectClasses || []).forEach(c => set.add(c));
    (loadedStudents || []).forEach(s => { if (s.class) set.add(s.class); });
    return Array.from(set);
  }, [assignedClass, subjectClasses, loadedStudents]);

  // Reset pagination on stream, search, subject, or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStream, search, subject, pageSize]);

  // Filter students by selected stream and search query
  const filteredStudents = useMemo(() => {
    return (loadedStudents || []).filter((s) => {
      const matchStream = selectedStream === 'All' || s.class === selectedStream;
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.adm && s.adm.toLowerCase().includes(search.toLowerCase()));
      return matchStream && matchSearch;
    });
  }, [loadedStudents, selectedStream, search]);

  const rows = useMemo(() => {
    return filteredStudents.map((s) => {
      const scores = s.scores?.[subject];
      const row = computeRow(scores);
      const systemType = is844Class(s.class) ? '844' : 'CBC';
      const percentage = row.average <= 4 && row.average > 0 ? Math.round(row.average * 25) : row.average;
      const grade = gradeFor(percentage, gradeBoundaries, systemType);
      const points = pointsForGrade(grade, systemType);
      return { ...s, ...row, percentage, grade, points, systemType, remarks: row.remarks || remarkFor(grade, systemType) };
    });
  }, [filteredStudents, gradeBoundaries, subject]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.average - a.average), [rows]);
  const topPerformer = sortedRows[0]?.average > 0 ? sortedRows[0] : null;

  // Pagination Engine
  const totalStudents = sortedRows.length;
  const effectivePageSize = pageSize === 'all' ? totalStudents || 1 : Number(pageSize);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalStudents / effectivePageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return sortedRows;
    const start = (activePage - 1) * effectivePageSize;
    return sortedRows.slice(start, start + effectivePageSize);
  }, [sortedRows, pageSize, activePage, effectivePageSize]);

  const startIndex = totalStudents === 0 ? 0 : pageSize === 'all' ? 1 : (activePage - 1) * effectivePageSize + 1;
  const endIndex = pageSize === 'all' ? totalStudents : Math.min(totalStudents, activePage * effectivePageSize);

  // Stream average computation
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

  // Selected student for Report Card Form entry
  const currentStudent = useMemo(() => {
    if (!filteredStudents || filteredStudents.length === 0) return null;
    if (selectedStudentId) {
      const found = filteredStudents.find(s => s.id === selectedStudentId);
      if (found) return found;
    }
    return filteredStudents[0];
  }, [filteredStudents, selectedStudentId]);

  const currentStudentIndex = useMemo(() => {
    if (!currentStudent || !filteredStudents.length) return 0;
    const idx = filteredStudents.findIndex(s => s.id === currentStudent.id);
    return idx >= 0 ? idx : 0;
  }, [filteredStudents, currentStudent]);

  const handleNextStudent = () => {
    if (currentStudentIndex < filteredStudents.length - 1) {
      setSelectedStudentId(filteredStudents[currentStudentIndex + 1].id);
    }
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(filteredStudents[currentStudentIndex - 1].id);
    }
  };

  const handleSaveStudentReport = (updated) => {
    store.updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  function saveScore(id, field, value) {
    const target = (loadedStudents || []).find((s) => s.id === id) || (store.students || []).find((s) => s.id === id);
    if (!target) return;
    let v;
    if (field === 'remarks') {
      v = value;
    } else if (String(value).trim().toLowerCase() === 'x') {
      v = 'X';
    } else if (String(value).trim() === '') {
      v = 0;
    } else {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || parsed < 0) {
        store.notify?.('Please enter a valid positive number or mark with "X"', 'warning', 'Gradebook');
        setEditing(null);
        return;
      }
      const maxScore = outOf > 0 ? Number(outOf) : 100;
      const normalizedScore = maxScore !== 100 ? Math.round((parsed / maxScore) * 100) : parsed;
      v = Math.min(100, normalizedScore);
    }
    const currentScores = target.scores || {};
    const currentSubj = currentScores[subject] || {};
    const base = typeof currentSubj === 'object' ? { ...currentSubj } : { average: currentSubj };
    base[field] = v;
    const computed = computeRow(base);
    const updated = {
      ...target,
      scores: {
        ...currentScores,
        [subject]: { ...base, ...computed, score: computed.average, average: computed.average },
      },
    };
    store.updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    setEditing(null);
    store.notify?.(`Saved ${field.toUpperCase()} mark for ${target.name}: ${v}%`, 'success', 'Gradebook');
  }

  // Export handlers for teacher
  const exportPDF = () => {
    const head = ['#', 'Student', 'Adm No.', 'Class', 'Ass. 1 (%)', 'Ass. 2 (%)', 'Ass. 3 (%)', 'Ass. 4 (%)', 'Avg (%)', 'CBC Points', 'Grade', 'Remarks'];
    const body = rows.map((r, i) => [i + 1, r.name, r.adm, r.class, r.a1, r.a2, r.a3, r.a4, `${r.average}%`, `${r.points} pts`, r.grade, r.remarks]);
    exportTablePDF({ 
      school: settings, 
      title: `${subject} Mark Sheet - ${selectedStream === 'All' ? 'All Classes' : selectedStream}`, 
      subtitle: `Teacher: ${teacherName}  |  ${term} ${examYear}`, 
      head, 
      body, 
      filename: `teacher-gradebook-${subject}-${selectedStream}.pdf` 
    });
    store.notify?.('Teacher Gradebook exported as PDF', 'success');
  };

  const exportExcel = () => {
    const aoa = [['#', 'Student', 'Adm No.', 'Class', 'Ass. 1 (%)', 'Ass. 2 (%)', 'Ass. 3 (%)', 'Ass. 4 (%)', 'Avg (%)', 'CBC Points', 'Grade', 'Remarks']];
    rows.forEach((r, i) => aoa.push([i + 1, r.name, r.adm, r.class, r.a1, r.a2, r.a3, r.a4, `${r.average}%`, `${r.points} pts`, r.grade, r.remarks]));
    downloadExcel(`teacher-gradebook-${subject}-${selectedStream}.xlsx`, [{ name: `${subject}`.slice(0, 31), aoa }]);
    store.notify?.('Teacher Gradebook exported as Excel', 'success');
  };

  const generateReportCards = () => {
    let chosen = filteredStudents.filter((r) => selected.includes(r.id));
    if (chosen.length === 0) chosen = filteredStudents;
    if (chosen.length === 0) return store.notify?.('No students found to generate report cards', 'warning');
    exportReportCardsPDF({
      school: settings,
      gradeBoundaries,
      students: chosen,
      subjects: [subject],
      examTitle: `${term} ${examTitle}`,
      termName: term,
      filename: `report-cards-${subject}-${selectedStream}.pdf`,
    });
    store.notify?.(`Generated ${chosen.length} report card(s)`, 'success');
  };

  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getGradeBadgeColor = (grade) => {
    if (!grade || grade === '-') return 'gray';
    if (grade.startsWith('EE') || ['A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(grade)) return 'green';
    if (grade.startsWith('ME')) return 'blue';
    if (grade.startsWith('AE') || ['C', 'C-', 'D+'].includes(grade)) return 'amber';
    return 'red';
  };

  const ScoreCell = ({ r, field, editing, setEditing, saveScore, sortedRows, effectivePageSize, activePage, setCurrentPage, pageSize }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td style={{ padding: '4px 6px', textAlign: field === 'remarks' ? 'left' : 'center' }}>
          <input
            style={{ 
              width: field === 'remarks' ? '140px' : '56px', 
              height: '32px', 
              padding: '0 6px', 
              border: '2px solid #047857', 
              borderRadius: '6px', 
              outline: 'none', 
              textAlign: field === 'remarks' ? 'left' : 'center', 
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "'Poppins', sans-serif",
              background: '#f0fdf4',
              color: '#064e3b',
              boxShadow: '0 0 0 3px rgba(4, 120, 87, 0.15)'
            }}
            type="text"
            inputMode={field === 'remarks' ? undefined : 'numeric'}
            enterKeyHint="next"
            placeholder={field === 'remarks' ? '' : `/${Math.max(1, Number(outOf) || 100)}`}
            autoFocus
            defaultValue={r[field] === 'X' ? 'X' : (r[field] || '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveScore(r.id, field, e.target.value);
                if (field !== 'remarks' && sortedRows) {
                  const idx = sortedRows.findIndex(x => x.id === r.id);
                  const next = sortedRows[idx + 1];
                  if (next) {
                    const nextIdx = idx + 1;
                    const targetPage = Math.floor(nextIdx / effectivePageSize) + 1;
                    if (pageSize !== 'all' && targetPage !== activePage && setCurrentPage) {
                      setCurrentPage(targetPage);
                    }
                    setEditing({ id: next.id, field });
                  }
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
          cursor: 'pointer', 
          minWidth: field === 'remarks' ? '120px' : '48px', 
          textAlign: field === 'remarks' ? 'left' : 'center', 
          fontWeight: field === 'remarks' ? 400 : 600, 
          color: field === 'remarks' ? '#475569' : '#0369A1' 
        }} 
        onClick={() => setEditing({ id: r.id, field })} 
        title={`Click to edit ${field === 'remarks' ? 'remarks' : '(Enter raw mark or %)'}`}
      >
        <div style={{
          padding: '4px 6px',
          borderRadius: 4,
          display: 'inline-block',
          minWidth: field === 'remarks' ? 'auto' : 32
        }}>
          {r[field] !== undefined && r[field] !== null && r[field] !== '' ? (
            r[field] === 'X' ? <span style={{ color: '#dc2626', fontWeight: 700 }}>X (Abs)</span> : (field === 'remarks' ? r[field] : `${r[field]}%`)
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: field === 'remarks' ? 'italic' : 'normal' }}>
              {field === 'remarks' ? '+ Remark' : '—'}
            </span>
          )}
        </div>
      </td>
    );
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", color: '#1e293b' }}>
      
      {/* ── 1. HEADER & COMMAND BAR ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 10, 
            background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)'
          }}>
            <BookOpen size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {subject} Marks Entry & Gradebook
            </h1>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Assigned Teacher: <strong>{teacherName}</strong> · {term} {examYear}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-sm" 
            onClick={exportExcel}
            style={{ fontSize: 12, padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Download size={14} /> Excel
          </button>
          <button 
            className="btn btn-sm" 
            onClick={exportPDF}
            style={{ fontSize: 12, padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      {/* ── 2. SEGMENTED MODE SWITCHER ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        padding: '6px',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: viewMode === 'grid' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: viewMode === 'grid' ? '#ffffff' : 'transparent',
              color: viewMode === 'grid' ? '#047857' : '#475569',
              boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={16} color={viewMode === 'grid' ? '#047857' : '#64748b'} />
            Class Subject Grid (Stream)
          </button>

          <button
            onClick={() => setViewMode('report')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: viewMode === 'report' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: viewMode === 'report' ? '#ffffff' : 'transparent',
              color: viewMode === 'report' ? '#047857' : '#475569',
              boxShadow: viewMode === 'report' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={16} color={viewMode === 'report' ? '#047857' : '#64748b'} />
            Academic Report Form (Student)
          </button>

          <button
            onClick={() => setViewMode('analysis')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: viewMode === 'analysis' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: viewMode === 'analysis' ? '#ffffff' : 'transparent',
              color: viewMode === 'analysis' ? '#047857' : '#475569',
              boxShadow: viewMode === 'analysis' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <BarChart3 size={16} color={viewMode === 'analysis' ? '#047857' : '#64748b'} />
            Subject Performance Analysis
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
          <span style={{ 
            fontSize: 11.5, 
            fontWeight: 600, 
            color: '#64748b',
            background: '#f8fafc',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #e2e8f0'
          }}>
            {viewMode === 'grid' && `📊 Grading ${filteredStudents.length} students in ${subject}`}
            {viewMode === 'report' && '📄 Kenyan Academic Report Form 1:1 view'}
            {viewMode === 'analysis' && `📈 ${subject} performance across streams`}
          </span>
        </div>
      </div>

      {/* ── 3. FILTER & CONFIGURATION TOOLBAR ── */}
      {viewMode !== 'analysis' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            {/* Stream Filter */}
            {availableClasses.length > 1 && (
              <div style={{ minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Assigned Stream
                </label>
                <select 
                  className="select" 
                  value={selectedStream} 
                  onChange={(e) => {
                    setSelectedStream(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  style={{ width: '100%', height: 36, fontSize: 13, fontWeight: 600 }}
                >
                  <option value="All">All Streams ({availableClasses.join(', ')})</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Student Picker (Report Mode) */}
            {viewMode === 'report' && (
              <div style={{ flex: 1, minWidth: 260 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Select Student
                </label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select 
                    className="select" 
                    value={currentStudent?.id || ''} 
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    style={{ flex: 1, height: 36, fontSize: 13, fontWeight: 700, color: '#047857' }}
                  >
                    {filteredStudents.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        {idx + 1}. {s.name} ({s.adm || 'No Adm'}) - {s.class}
                      </option>
                    ))}
                  </select>
                  <button 
                    className="btn btn-sm" 
                    onClick={handlePrevStudent} 
                    disabled={currentStudentIndex === 0}
                    style={{ height: 36, padding: '0 8px' }}
                    title="Previous Student"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    className="btn btn-sm" 
                    onClick={handleNextStudent} 
                    disabled={currentStudentIndex >= filteredStudents.length - 1}
                    style={{ height: 36, padding: '0 8px' }}
                    title="Next Student"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            <div style={{ minWidth: 120 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Term
              </label>
              <select 
                className="select" 
                value={term} 
                onChange={(e) => setTerm(e.target.value)} 
                style={{ width: '100%', height: 36, fontSize: 13 }}
              >
                {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 170 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Assessment
              </label>
              <select 
                className="select" 
                value={examTitle} 
                onChange={(e) => setExamTitle(e.target.value)} 
                style={{ width: '100%', height: 36, fontSize: 13 }}
              >
                {EXAM_OPTIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>

            <div style={{ width: 95 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Marks Out Of
              </label>
              <input 
                className="input" 
                type="number" 
                min="1" 
                max="1000" 
                value={outOf} 
                onChange={(e) => setOutOf(e.target.value.replace(/[^\d]/g, '') || '')}
                style={{ width: '100%', height: 36, textAlign: 'center', fontWeight: 800, fontSize: 13 }}
                title="Raw marks entered normalize automatically to percentages and CBC points."
              />
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Search Student
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                <input 
                  className="input" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  placeholder="Search student or adm..." 
                  style={{ width: '100%', height: 36, paddingLeft: 32, fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stream KPI Ribbon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                <Users size={14} color="#0284c7" />
                Class Size: <strong style={{ color: '#0f172a' }}>{filteredStudents.length} Students</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                <BookOpen size={14} color="#10b981" />
                Graded: <strong style={{ color: '#0f172a' }}>{rows.filter(r => r.average > 0).length} of {rows.length}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                <TrendingUp size={14} color="#8b5cf6" />
                Stream Average: <strong style={{ color: '#0369a1' }}>{colAvg?.average ? `${colAvg.average}%` : '—'}</strong>
                {colAvg?.grade && <Badge color={getGradeBadgeColor(colAvg.grade)}>{colAvg.grade}</Badge>}
              </span>
            </div>

            {topPerformer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', fontWeight: 600 }}>
                <Award size={15} color="#d97706" />
                Top Performer: <span style={{ color: '#0f172a' }}>{topPerformer.name}</span> ({topPerformer.average}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW MODE 1: ACADEMIC REPORT FORM ── */}
      {viewMode === 'report' && (
        <div style={{ marginBottom: 30 }}>
          {currentStudent ? (
            <ReportCardEntrySheet
              student={currentStudent}
              students={loadedStudents}
              onSaveStudent={handleSaveStudentReport}
              onNextStudent={handleNextStudent}
              onPrevStudent={handlePrevStudent}
              onSelectStudent={(id) => setSelectedStudentId(id)}
              currentIndex={currentStudentIndex}
              totalStudents={filteredStudents.length}
              schoolSettings={settings}
              onUpdateSettings={store.setSettings}
              onPublishResults={() => {
                const nextState = !settings?.results_published;
                store.setSettings?.({ results_published: nextState });
                store.notify?.(nextState ? 'Results published' : 'Results unpublished', 'success');
              }}
              teachers={teachers}
              currentUser={user}
              gradeBoundaries={gradeBoundaries}
              examTitle={examTitle}
              termName={term}
              year={examYear}
              outOf={outOf}
              canEditAll={user?.role === 'admin' || user?.role === 'dos' || user?.role === 'deputy_academic'}
              allowedSubjects={[subject]}
            />
          ) : (
            <div className="card card-pad" style={{ textAlign: 'center', padding: '56px 24px', borderRadius: 12 }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                No students found in {selectedStream}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Please select another stream or adjust your search filter above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW MODE 2: CLASS SUBJECT GRID ── */}
      {viewMode === 'grid' && (
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: 12, 
          overflow: 'hidden', 
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
        }}>
          {/* Table Header Controls */}
          <div style={{ 
            padding: '12px 18px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input 
                type="checkbox" 
                checked={selected.length === paginatedRows.length && paginatedRows.length > 0}
                onChange={(e) => setSelected(e.target.checked ? paginatedRows.map((r) => r.id) : [])} 
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                {selected.length > 0 ? (
                  <span style={{ color: '#047857' }}>{selected.length} of {paginatedRows.length} on page Selected</span>
                ) : (
                  <span>Students ({totalStudents})</span>
                )}
              </span>
              {selected.length > 0 && (
                <button 
                  onClick={() => setSelected([])}
                  style={{ fontSize: 11, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                💡 Tip: Press <kbd style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>Enter</kbd> to save & jump to next student
              </span>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={generateReportCards} 
                disabled={!settings?.results_published}
                style={{ fontSize: 12, padding: '5px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                title={!settings?.results_published ? "Report cards must be published by Admin before printing" : ""}
              >
                <Printer size={15} /> 
                Generate Report Cards ({selected.length > 0 ? selected.length : 'All'})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="scroll-x">
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selected.length === paginatedRows.length && paginatedRows.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? paginatedRows.map((r) => r.id) : [])} 
                    />
                  </th>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: 170 }}>Student</th>
                  <th style={{ width: 95 }}>Adm No.</th>
                  <th style={{ width: 85 }}>Class</th>
                  <th style={{ width: 75, textAlign: 'center' }}>Ass. 1</th>
                  <th style={{ width: 75, textAlign: 'center' }}>Ass. 2</th>
                  <th style={{ width: 75, textAlign: 'center' }}>Ass. 3</th>
                  <th style={{ width: 75, textAlign: 'center' }}>Ass. 4</th>
                  <th style={{ width: 85, textAlign: 'center' }}>Average</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Points</th>
                  <th style={{ width: 105, textAlign: 'center' }}>Grade</th>
                  <th style={{ minWidth: 160 }}>Remarks</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((r, i) => {
                  const isAtRisk = r.average > 0 && r.average < 40;
                  const rowNumber = pageSize === 'all' ? i + 1 : (activePage - 1) * effectivePageSize + i + 1;
                  return (
                    <tr 
                      key={r.id} 
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isAtRisk ? '#fff5f5' : (selected.includes(r.id) ? '#f0fdf4' : 'transparent'),
                        borderLeft: isAtRisk ? '3px solid #ef4444' : '3px solid transparent',
                        transition: 'background 0.1s ease'
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selected.includes(r.id)}
                          onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} 
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{rowNumber}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {getInitials(r.name)}
                          </div>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#64748b', fontWeight: 500 }}>{r.adm || '—'}</td>
                      <td><Badge color="gray">{r.class}</Badge></td>
                      <ScoreCell r={r} field="a1" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} effectivePageSize={effectivePageSize} activePage={activePage} setCurrentPage={setCurrentPage} pageSize={pageSize} />
                      <ScoreCell r={r} field="a2" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} effectivePageSize={effectivePageSize} activePage={activePage} setCurrentPage={setCurrentPage} pageSize={pageSize} />
                      <ScoreCell r={r} field="a3" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} effectivePageSize={effectivePageSize} activePage={activePage} setCurrentPage={setCurrentPage} pageSize={pageSize} />
                      <ScoreCell r={r} field="a4" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} effectivePageSize={effectivePageSize} activePage={activePage} setCurrentPage={setCurrentPage} pageSize={pageSize} />
                      
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: r.average > 0 ? (isAtRisk ? '#dc2626' : '#0369a1') : '#94a3b8', fontSize: 13.5 }}>
                          {r.average > 0 ? `${r.average}%` : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {r.points > 0 ? (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                            {r.points} pts
                          </span>
                        ) : '—'}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <Badge color={getGradeBadgeColor(r.grade)}>
                          {r.grade}
                        </Badge>
                      </td>

                      <ScoreCell r={r} field="remarks" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} effectivePageSize={effectivePageSize} activePage={activePage} setCurrentPage={setCurrentPage} pageSize={pageSize} />

                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-sm"
                          onClick={() => {
                            setSelectedStudentId(r.id);
                            setViewMode('report');
                          }}
                          title="Open official Report Form for this student"
                          style={{ 
                            fontSize: 11, 
                            padding: '3px 8px', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6
                          }}
                        >
                          <FileText size={12} color="#047857" /> Report Form
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Class Stream Average Footer */}
                {colAvg && (
                  <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={2}></td>
                    <td style={{ color: '#0f172a', textTransform: 'uppercase', fontSize: 12 }}>
                      Subject Stream Average
                    </td>
                    <td style={{ color: '#64748b' }}>{rows.length} Total</td>
                    <td></td>
                    <td style={{ textAlign: 'center', color: '#0369a1' }}>{colAvg.a1 ? `${colAvg.a1}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#0369a1' }}>{colAvg.a2 ? `${colAvg.a2}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#0369a1' }}>{colAvg.a3 ? `${colAvg.a3}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#0369a1' }}>{colAvg.a4 ? `${colAvg.a4}%` : '—'}</td>
                    <td style={{ textAlign: 'center', color: '#047857', fontSize: 14 }}>
                      {colAvg.average ? `${colAvg.average}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {colAvg.points ? (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                          {colAvg.points} pts
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {colAvg.grade && <Badge color={getGradeBadgeColor(colAvg.grade)}>{colAvg.grade}</Badge>}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation Bar */}
          {totalStudents > 0 && (
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 18px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              {/* Left: Summary & Page Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                  Showing <strong style={{ color: '#0f172a' }}>{startIndex}–{endIndex}</strong> of <strong style={{ color: '#0f172a' }}>{totalStudents}</strong> students in <strong style={{ color: '#047857' }}>{selectedStream === 'All' ? 'All Classes' : selectedStream}</strong>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Per page:</span>
                  {[25, 50, 100, 'all'].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '3px 9px',
                        fontSize: 12,
                        fontWeight: pageSize === size ? 700 : 500,
                        borderRadius: 6,
                        border: pageSize === size ? '1px solid #047857' : '1px solid #e2e8f0',
                        background: pageSize === size ? '#f0fdf4' : '#ffffff',
                        color: pageSize === size ? '#047857' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {size === 'all' ? 'All' : size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Page Navigation */}
              {pageSize !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    className="btn btn-sm"
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    style={{ fontSize: 11.5, padding: '4px 8px', opacity: activePage <= 1 ? 0.4 : 1 }}
                    title="First Page"
                  >
                    « First
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ fontSize: 12, padding: '4px 10px', opacity: activePage <= 1 ? 0.4 : 1 }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - activePage) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) {
                        acc.push({ type: 'ellipsis', key: `e-${p}` });
                      }
                      acc.push({ type: 'page', page: p, key: p });
                      return acc;
                    }, [])
                    .map(item => {
                      if (item.type === 'ellipsis') {
                        return <span key={item.key} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>;
                      }
                      const isCurrent = item.page === activePage;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setCurrentPage(item.page)}
                          style={{
                            minWidth: 30,
                            height: 30,
                            padding: '0 6px',
                            borderRadius: 6,
                            border: isCurrent ? '1px solid #047857' : '1px solid #cbd5e1',
                            background: isCurrent ? '#047857' : '#ffffff',
                            color: isCurrent ? '#ffffff' : '#334155',
                            fontWeight: isCurrent ? 700 : 500,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {item.page}
                        </button>
                      );
                    })}

                  <button
                    className="btn btn-sm"
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ fontSize: 12, padding: '4px 10px', opacity: activePage >= totalPages ? 0.4 : 1 }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    style={{ fontSize: 11.5, padding: '4px 8px', opacity: activePage >= totalPages ? 0.4 : 1 }}
                    title="Last Page"
                  >
                    Last »
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW MODE 3: SUBJECT PERFORMANCE ANALYSIS ── */}
      {viewMode === 'analysis' && (
        <div style={{ marginBottom: 30 }}>
          <ClassSubjectAnalysis 
            students={loadedStudents}
            gradeBoundaries={gradeBoundaries}
            schoolSettings={settings}
            onSelectClass={(className) => {
              setSelectedStream(className);
              setViewMode('grid');
            }}
          />
        </div>
      )}

    </div>
  );
}
