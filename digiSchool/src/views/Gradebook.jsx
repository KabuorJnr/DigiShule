import { useState, useMemo, useEffect } from 'react';
import { fetchStudents } from '../lib/api';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Badge, EmptyState } from '../components/widgets';
import { CLASSES, SUBJECTS, getDynamicClasses, expandClassesWithStreams } from '../data/seed';
import { computeRow, gradeFor, remarkFor, subjectAverage, is844Class, pointsForGrade } from '../utils/grading';
import { exportTablePDF, downloadExcel, exportReportCardsPDF } from '../utils/exporters';
import ReportCardEntrySheet from '../components/ReportCardEntrySheet';
import ClassSubjectAnalysis from '../components/ClassSubjectAnalysis';
import { 
  FileText, 
  LayoutGrid, 
  BarChart3, 
  Download, 
  Printer, 
  Check, 
  X, 
  Search, 
  ShieldCheck, 
  Users, 
  Award, 
  AlertTriangle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  BookOpen,
  Filter,
  Trophy,
  Medal,
  Lightbulb
} from 'lucide-react';

const GRADE_COLORS = { 
  EE: '#059669', EE1: '#059669', EE2: '#10b981',
  ME: '#2563eb', ME1: '#2563eb', ME2: '#3b82f6',
  AE: '#d97706', AE1: '#d97706', AE2: '#f59e0b',
  BE: '#dc2626', BE1: '#dc2626', BE2: '#f43f5e',
  A: '#059669', 'A-': '#10b981', 'B+': '#059669', B: '#2563eb', 'B-': '#3b82f6', 'C+': '#2563eb', 
  C: '#d97706', 'C-': '#f59e0b', 'D+': '#d97706', 
  D: '#dc2626', 'D-': '#f43f5e', E: '#dc2626', '-': '#9CA3AF' 
};

const ASSESS_OPTIONS = ['All', 'Assessment 1', 'Assessment 2', 'Assessment 3', 'Assessment 4'];
const EXAM_OPTIONS = ['End Term Assessment', 'Mid Term Assessment', 'Opening Assessment', 'Continuous Assessment (CAT)'];

export default function Gradebook({ store }) {
  const { updateStudent, gradeBoundaries, settings, setSettings, notify, user, teachers = [] } = store;
  
  // View mode: 'report' for official Kenyan Academic Report Form, 'grid' for class subject table, 'analysis' for comparative analytics
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
  
  // Pagination State for high student count (e.g. 180 students)
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [loadedStudents, setLoadedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Subject permission check for teachers
  const teacherRecord = useMemo(() => {
    if (user?.role !== 'teacher') return null;
    return (teachers || store.teachers || []).find(t => 
      t.id === user?.id || 
      t.id === user?.teacher_id || 
      (t.email && user?.email && t.email.toLowerCase() === user.email.toLowerCase()) ||
      t.emp_id === user?.id || 
      t.emp_id === user?.teacher_id ||
      (t.name && user?.name && t.name.toLowerCase() === user.name.toLowerCase()) ||
      (t.full_name && user?.full_name && t.full_name.toLowerCase() === user.full_name.toLowerCase())
    ) || null;
  }, [user, teachers, store.teachers]);

  const teacherAssignedClass = useMemo(() => {
    return teacherRecord?.assignedClass || 
           teacherRecord?.assigned_class || 
           teacherRecord?.class || 
           user?.assignedClass || 
           user?.assigned_class || 
           user?.class || 
           null;
  }, [teacherRecord, user]);

  const allowedSubjects = useMemo(() => {
    if (!user || user.role !== 'teacher') return SUBJECTS;
    const subjList = [];
    if (user.subject) subjList.push(user.subject);
    if (user.dept) subjList.push(user.dept);
    if (teacherRecord?.subject) subjList.push(teacherRecord.subject);
    if (teacherRecord?.dept) subjList.push(teacherRecord.dept);
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
    if (user.role === 'principal' || user.role === 'parent' || user.role === 'student') return false;
    if (user.role === 'dos' || user.role === 'deputy_academic' || user.role === 'admin' || user.dept === 'dos') return true;
    if (user.role !== 'teacher') return true;
    
    // Class teachers can edit their class
    if (teacherAssignedClass && cls && (
      teacherAssignedClass.toLowerCase() === cls.toLowerCase() ||
      cls.toLowerCase().startsWith(teacherAssignedClass.toLowerCase()) ||
      teacherAssignedClass.toLowerCase().startsWith(cls.toLowerCase())
    )) {
      return true;
    }

    // Flexible subject matching
    const targetSub = subject.toLowerCase().trim();
    const isMatched = allowedSubjects.some(s => {
      const as = s.toLowerCase().trim();
      return as === targetSub || as.includes(targetSub) || targetSub.includes(as);
    });
    return isMatched || allowedSubjects.length === SUBJECTS.length;
  }, [user, allowedSubjects, subject, teacherAssignedClass, cls]);

  // Extract classes from students for a complete stream list, falling back to settings
  const dynamicClasses = useMemo(() => {
    if (store.students && store.students.length > 0) {
      return getDynamicClasses(store.students);
    }
    return expandClassesWithStreams(settings?.classes || []);
  }, [settings, store.students]);

  // Auto-select teacher's assigned class if none selected, or first class
  useEffect(() => {
    if (!cls && dynamicClasses && dynamicClasses.length > 0) {
      if (teacherAssignedClass) {
        const found = dynamicClasses.find(c => 
          c.toLowerCase() === teacherAssignedClass.toLowerCase() ||
          c.toLowerCase().startsWith(teacherAssignedClass.toLowerCase())
        );
        setCls(found || dynamicClasses[0]);
      } else {
        setCls(dynamicClasses[0]);
      }
    }
  }, [cls, dynamicClasses, teacherAssignedClass]);

  // Immediate in-memory student baseline from store.students so students are NEVER blank
  const inMemoryClassStudents = useMemo(() => {
    if (!store.students || store.students.length === 0) return [];
    if (!cls || cls === 'All') return store.students.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated');
    const target = cls.trim().toLowerCase();
    return store.students.filter(s => {
      if (!s.class) return false;
      if (s.status === 'Inactive' || s.status === 'Graduated') return false;
      const sc = s.class.trim().toLowerCase();
      return sc === target || sc.startsWith(target) || target.startsWith(sc);
    });
  }, [store.students, cls]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!cls) return;
      // Instantly load in-memory students so teacher sees students without delay!
      if (inMemoryClassStudents.length > 0) {
        setLoadedStudents(inMemoryClassStudents);
        if (!selectedStudentId) setSelectedStudentId(inMemoryClassStudents[0].id);
      }
      setLoading(true);
      try {
        const { data } = await fetchStudents(0, 500, { class: cls, activeOnly: true });
        if (active) {
          if (data && data.length > 0) {
            setLoadedStudents(data);
            if (!selectedStudentId) {
              setSelectedStudentId(data[0].id);
            }
          } else if (inMemoryClassStudents.length > 0) {
            setLoadedStudents(inMemoryClassStudents);
          }
        }
      } catch (e) {
        console.warn('Gradebook fetchStudents fallback:', e);
        if (active && inMemoryClassStudents.length > 0) {
          setLoadedStudents(inMemoryClassStudents);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [cls]);

  // If store.students is updated, sync loadedStudents so teacher sees changes live!
  useEffect(() => {
    if (inMemoryClassStudents.length > 0 && loadedStudents.length === 0) {
      setLoadedStudents(inMemoryClassStudents);
    }
  }, [inMemoryClassStudents]);

  // Reset pagination on class, search, or subject change
  useEffect(() => {
    setCurrentPage(1);
  }, [cls, search, subject, pageSize]);

  const classStudents = useMemo(
    () => loadedStudents.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.adm && s.adm.toLowerCase().includes(search.toLowerCase()))),
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

  // Pagination slicing
  const totalStudents = rows.length;
  const effectivePageSize = pageSize === 'all' ? totalStudents || 1 : Number(pageSize);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalStudents / effectivePageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return rows;
    const start = (activePage - 1) * effectivePageSize;
    return rows.slice(start, start + effectivePageSize);
  }, [rows, pageSize, activePage, effectivePageSize]);

  const startIndex = totalStudents === 0 ? 0 : pageSize === 'all' ? 1 : (activePage - 1) * effectivePageSize + 1;
  const endIndex = pageSize === 'all' ? totalStudents : Math.min(totalStudents, activePage * effectivePageSize);

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

  // Clean Competency summary with non-zero filtering and proper palette
  const gradeDist = useMemo(() => {
    const counts = {};
    rows.forEach((r) => {
      if (r.grade && r.grade !== '-') {
        counts[r.grade] = (counts[r.grade] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, val]) => val > 0)
      .map(([grade, value]) => ({
        grade,
        value,
        color: GRADE_COLORS[grade] || '#059669',
        pct: rows.length > 0 ? Math.round((value / rows.length) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const top5 = useMemo(() => [...rows].sort((a, b) => b.average - a.average).slice(0, 5), [rows]);
  const atRisk = useMemo(() => rows.filter((r) => r.average > 0 && r.average < 40), [rows]);
  
  const subjectCompare = useMemo(() =>
    SUBJECTS.map((sub) => {
      const avg = classStudents.reduce((a, s) => a + subjectAverage(s.scores?.[sub]), 0) / (classStudents.length || 1);
      return { 
        subject: sub.length > 8 ? sub.slice(0, 7) + '..' : sub,
        fullName: sub,
        avg: Math.round(avg * 10) / 10 
      };
    }).filter(s => s.avg > 0 || classStudents.length > 0), [classStudents]);

  function saveScore(id, field, value) {
    if (!canEditCurrentSubject) {
      notify(`Access Restricted: You are assigned to teach ${allowedSubjects.join(', ')}. You cannot modify marks for ${subject}.`, 'warning', 'Subject Permission');
      setEditing(null);
      return;
    }
    const target = loadedStudents.find((s) => s.id === id) || store.students?.find(s => s.id === id);
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
        notify('Please enter a valid positive number or mark with "X"', 'warning', 'Gradebook');
        setEditing(null);
        return;
      }
      const maxScore = outOf > 0 ? outOf : 100;
      const normalizedScore = maxScore !== 100 ? Math.round((parsed / maxScore) * 100) : parsed;
      v = Math.min(100, normalizedScore);
    }
    const current = target.scores?.[subject] || {};
    const base = typeof current === 'object' ? { ...current } : { average: current };
    base[field] = v;
    const computed = computeRow(base);
    const updated = {
      ...target,
      scores: {
        ...(target.scores || {}),
        [subject]: { ...base, ...computed, score: computed.average, average: computed.average },
      },
    };
    updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    setEditing(null);
    notify(`Saved ${field.toUpperCase()} mark for ${target.name}: ${v}%`, 'success', 'Gradebook');
  }

  function flagStudent(id) {
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const updated = { ...target, flagged: true };
      updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    notify('Student flagged for remedial support', 'success', 'Gradebook');
  }

  const handleApproveResults = () => {
    setSettings({ results_approved: !settings.results_approved });
    notify(settings.results_approved ? 'Results approval revoked' : 'Results approved successfully', 'success');
  };

  const handlePublishResults = () => {
    setSettings({ results_published: !settings.results_published });
    notify(settings.results_published ? 'Results unpublished' : 'Results published & official stamps certified', 'success');
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

  // Helper for student initials avatar
  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for grade badge color
  const getGradeBadgeColor = (grade) => {
    if (!grade || grade === '-') return 'gray';
    if (grade.startsWith('EE') || ['A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(grade)) return 'green';
    if (grade.startsWith('ME')) return 'blue';
    if (grade.startsWith('AE') || ['C', 'C-', 'D+'].includes(grade)) return 'amber';
    return 'red';
  };

  const ScoreCell = ({ r, field, editing, setEditing, saveScore }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td style={{ padding: '4px 6px', textAlign: field === 'remarks' ? 'left' : 'center' }}>
          <input
            style={{
              width: field === 'remarks' ? '150px' : '62px',
              height: '34px',
              padding: '0 8px',
              border: '2px solid #059669',
              borderRadius: '6px',
              outline: 'none',
              textAlign: field === 'remarks' ? 'left' : 'center',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "'Poppins', sans-serif",
              background: '#f0fdf4',
              color: '#064e3b',
              boxShadow: '0 0 0 3px rgba(5, 150, 105, 0.18)'
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
                if (field !== 'remarks') {
                  const idx = rows.findIndex((x) => x.id === r.id);
                  const next = rows[idx + 1];
                  if (next) {
                    if (pageSize !== 'all' && idx + 1 >= activePage * effectivePageSize) {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
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
    const hasValue = r[field] !== undefined && r[field] !== null && r[field] !== '' && r[field] !== 0;
    return (
      <td 
        style={{ 
          cursor: canEditCurrentSubject ? 'pointer' : 'not-allowed', 
          minWidth: field === 'remarks' ? '130px' : '56px', 
          textAlign: field === 'remarks' ? 'left' : 'center',
          padding: '6px 4px',
          opacity: canEditCurrentSubject ? 1 : 0.65
        }} 
        onClick={() => {
          if (!canEditCurrentSubject) {
            notify(`Access Restricted: You are assigned to teach ${allowedSubjects.join(', ')}. You cannot modify marks for ${subject}.`, 'warning', 'Subject Permission');
            return;
          }
          setEditing({ id: r.id, field });
        }}
        title={canEditCurrentSubject ? `Click to edit ${field === 'remarks' ? 'remarks' : '(Enter raw mark or %)'}` : `View only: Assigned to teach ${allowedSubjects.join(', ')}`}
      >
        <div style={{
          padding: field === 'remarks' ? '4px 8px' : '4px 8px',
          borderRadius: 6,
          background: hasValue ? (field === 'remarks' ? '#f8fafc' : '#f0fdf4') : '#ffffff',
          border: hasValue ? (field === 'remarks' ? '1px solid #e2e8f0' : '1px solid #bbf7d0') : '1px dashed #cbd5e1',
          display: 'inline-block',
          minWidth: field === 'remarks' ? 'auto' : 38,
          color: r[field] === 'X' ? '#dc2626' : (field === 'remarks' ? '#334155' : '#065f46'),
          fontWeight: field === 'remarks' ? 400 : 700,
          fontSize: 12.5,
          transition: 'all 0.15s ease'
        }}>
          {r[field] !== undefined && r[field] !== null && r[field] !== '' ? (
            r[field] === 'X' ? <span style={{ color: '#dc2626', fontWeight: 800 }}>X (Abs)</span> : (field === 'remarks' ? r[field] : `${r[field]}%`)
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: field === 'remarks' ? 'italic' : 'normal', fontSize: 11 }}>
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Gradebook & Academic Central
                </h1>
                {settings?.results_published && (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    background: '#eff6ff', 
                    color: '#1d4ed8', 
                    border: '1px solid #bfdbfe', 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 11, 
                    fontWeight: 700 
                  }}>
                    <ShieldCheck size={13} /> Certified & Published
                  </span>
                )}
                {settings?.results_approved && !settings?.results_published && (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    background: '#ecfdf5', 
                    color: '#047857', 
                    border: '1px solid #a7f3d0', 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    fontSize: 11, 
                    fontWeight: 700 
                  }}>
                    <Check size={13} /> Approved by Deputy
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {term} · {examYear} Assessment Cycle · Official CBC & 8-4-4 Marks Engine
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Triggers */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['deputy_academic', 'dos', 'principal', 'admin'].includes(user?.role || store.user?.role)) && (
            <button 
              className={`btn btn-sm ${settings?.results_approved ? 'btn-danger' : 'btn-primary'}`} 
              onClick={handleApproveResults}
              style={{ fontSize: 12, padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {settings?.results_approved ? <X size={15} /> : <Check size={15} />} 
              {settings?.results_approved ? 'Revoke Approval' : 'Approve Results'}
            </button>
          )}

          {(['dos', 'principal', 'admin'].includes(user?.role || store.user?.role)) && (
            <button 
              className={`btn btn-sm ${settings?.results_published ? 'btn-danger' : 'btn-primary'}`} 
              onClick={handlePublishResults}
              style={{ fontSize: 12, padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              title={settings?.results_published ? 'Retract official publication' : 'Publish official results and stamp principal signature on all report cards'}
            >
              <ShieldCheck size={15} /> 
              {settings?.results_published ? 'Unpublish Results (DoS)' : 'Publish & Stamp (DoS)'}
            </button>
          )}

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

      {/* ── 2. RECONSTRUCTED SEGMENTED MODE SWITCHER ── */}
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
            onClick={() => setEntryMode('report')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: entryMode === 'report' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: entryMode === 'report' ? '#ffffff' : 'transparent',
              color: entryMode === 'report' ? '#047857' : '#475569',
              boxShadow: entryMode === 'report' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={16} color={entryMode === 'report' ? '#047857' : '#64748b'} />
            Academic Report Form (Student)
          </button>

          <button
            onClick={() => setEntryMode('grid')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: entryMode === 'grid' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: entryMode === 'grid' ? '#ffffff' : 'transparent',
              color: entryMode === 'grid' ? '#047857' : '#475569',
              boxShadow: entryMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={16} color={entryMode === 'grid' ? '#047857' : '#64748b'} />
            Class Subject Grid (Stream)
          </button>

          <button
            onClick={() => setEntryMode('analysis')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: entryMode === 'analysis' ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              background: entryMode === 'analysis' ? '#ffffff' : 'transparent',
              color: entryMode === 'analysis' ? '#047857' : '#475569',
              boxShadow: entryMode === 'analysis' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <BarChart3 size={16} color={entryMode === 'analysis' ? '#047857' : '#64748b'} />
            Class & Subject Analysis
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
            {entryMode === 'report' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileText size={13} /> Official Kenyan Report Form 1:1 view</span>}
            {entryMode === 'grid' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BarChart3 size={13} /> Batch marks for {cls || 'selected stream'}</span>}
            {entryMode === 'analysis' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TrendingUp size={13} /> Cross-stream &amp; department benchmarks</span>}
          </span>
        </div>
      </div>

      {/* ── 3. UNIFIED CONTROL & FILTER COMMAND BAR ── */}
      {entryMode !== 'analysis' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)'
        }}>
          {/* Row 1: Primary Target Selectors */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Class / Stream
              </label>
              <select 
                className="select" 
                value={cls} 
                onChange={(e) => { 
                  setCls(e.target.value); 
                  setSelected([]); 
                  setSelectedStudentId(null);
                }} 
                style={{ width: '100%', height: 36, fontSize: 13, fontWeight: 600 }}
              >
                {dynamicClasses.map((c) => <option key={c} value={c}>Grade {c}</option>)}
              </select>
            </div>

            {entryMode === 'grid' && (
              <div style={{ minWidth: 170 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Curriculum Subject
                </label>
                <select 
                  className="select" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  style={{ width: '100%', height: 36, fontSize: 13, fontWeight: 600, color: '#0f172a' }}
                >
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}

            {entryMode === 'report' && (
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
                    {classStudents.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        {idx + 1}. {s.name} ({s.adm || 'No Adm'})
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
                    disabled={currentStudentIndex >= classStudents.length - 1}
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
                Academic Term
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
                Assessment Cycle
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
                title="Raw marks entered normalize automatically to percentages and CBC points."
                style={{ width: '100%', height: 36, textAlign: 'center', fontWeight: 800, fontSize: 13 }} 
              />
            </div>

            {entryMode === 'grid' && (
              <div style={{ minWidth: 130 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Filter Column
                </label>
                <select 
                  className="select" 
                  value={assessment} 
                  onChange={(e) => setAssessment(e.target.value)} 
                  style={{ width: '100%', height: 36, fontSize: 13 }}
                >
                  {ASSESS_OPTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            )}

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
                  placeholder="Search by name or adm..." 
                  style={{ width: '100%', height: 36, paddingLeft: 32, fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Executive KPI Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
            marginTop: 4
          }}>
            {/* 1. Cohort Size */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#eff6ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Users size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Stream Cohort
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                  {classStudents.length} Students
                </div>
              </div>
            </div>

            {/* 2. Graded Progress */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#f0fdf4',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <BookOpen size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Marks Entered
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', marginTop: 1 }}>
                  {rows.filter(r => r.average > 0).length} <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>of {rows.length}</span>
                </div>
              </div>
            </div>

            {/* 3. Subject Mean */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#faf5ff',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <TrendingUp size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Subject Average
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#0369a1' }}>
                    {colAvg?.average ? `${colAvg.average}%` : '—'}
                  </span>
                  {colAvg?.grade && <Badge color={getGradeBadgeColor(colAvg.grade)}>{colAvg.grade}</Badge>}
                </div>
              </div>
            </div>

            {/* 4. Stream Leader */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Award size={18} />
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Top Performer
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', marginTop: 1 }}>
                  {top5[0] ? top5[0].name : '—'} {top5[0] && <span style={{ color: '#059669', fontSize: 11.5 }}>({top5[0].average}%)</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!canEditCurrentSubject && entryMode === 'grid' && (
        <div style={{ 
          background: '#fffbeb', 
          border: '1px solid #fef3c7', 
          color: '#92400e', 
          padding: '10px 16px', 
          borderRadius: 8, 
          marginBottom: 16, 
          fontSize: 13, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10 
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <strong>Subject Permission Restriction:</strong> You are logged in as a Subject Teacher for <strong>{allowedSubjects.join(', ')}</strong>. Marks for <strong>{subject}</strong> are in view-only mode.
          </div>
        </div>
      )}

      {/* ── VIEW MODE 1: OFFICIAL ACADEMIC REPORT FORM ENTRY ── */}
      {entryMode === 'report' && (
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
            <div className="card">
              <EmptyState
                icon={<Users size={22} />}
                title={`No students found in ${cls || 'this class'}`}
                message="Please select another class or adjust your search filter above."
              />
            </div>
          )}
        </div>
      )}

      {/* ── VIEW MODE 2: CLASS SUBJECT GRID ENTRY ── */}
      {entryMode === 'grid' && (
        <>
          {/* Main Grid Card */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid #cbd5e1', 
            borderRadius: 12, 
            overflow: 'hidden', 
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
          }}>
            {/* Table Header Bar */}
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
                  checked={selected.length === rows.length && rows.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {selected.length > 0 ? (
                    <span style={{ color: '#047857' }}>{selected.length} of {rows.length} Students Selected</span>
                  ) : (
                    <span>All Students in {cls} ({rows.length})</span>
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
                <span style={{ fontSize: 11.5, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lightbulb size={13} color="#d97706" /> Tip: Press <kbd style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>Enter</kbd> to save &amp; jump to next student
                </span>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={generateReportCards} 
                  disabled={user?.role === 'teacher' && !settings?.results_published} 
                  style={{ fontSize: 12, padding: '5px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                  title={user?.role === 'teacher' && !settings?.results_published ? "Report cards must be published by Admin before generating" : ""}
                >
                  <Printer size={15} /> 
                  Generate Report Cards ({selected.length > 0 ? selected.length : 'All'})
                </button>
              </div>
            </div>

            {/* High-Fidelity Table */}
            <div className="scroll-x">
              <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                    <th style={{ width: 36, textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>
                      <input 
                        type="checkbox" 
                        checked={selected.length === rows.length && rows.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} 
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ width: 44, textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>#</th>
                    <th style={{ minWidth: 190, color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Student</th>
                    <th style={{ width: 100, color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Adm No.</th>
                    <th style={{ width: 78, textAlign: 'center', background: '#f0fdf4', color: '#065f46', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #86efac' }}>Ass. 1</th>
                    <th style={{ width: 78, textAlign: 'center', background: '#f0fdf4', color: '#065f46', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #86efac' }}>Ass. 2</th>
                    <th style={{ width: 78, textAlign: 'center', background: '#f0fdf4', color: '#065f46', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #86efac' }}>Ass. 3</th>
                    <th style={{ width: 78, textAlign: 'center', background: '#f0fdf4', color: '#065f46', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #86efac' }}>Ass. 4</th>
                    <th style={{ width: 95, textAlign: 'center', color: '#0369a1', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Average</th>
                    <th style={{ width: 95, textAlign: 'center', color: '#1d4ed8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Points</th>
                    <th style={{ width: 115, textAlign: 'center', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Performance</th>
                    <th style={{ minWidth: 160, color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Remarks</th>
                    <th style={{ width: 110, textAlign: 'center', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #cbd5e1' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r, i) => {
                    const isAtRisk = r.average > 0 && r.average < 40;
                    const rowNum = pageSize === 'all' ? i + 1 : (activePage - 1) * effectivePageSize + i + 1;
                    return (
                      <tr 
                        key={r.id} 
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isAtRisk ? '#fff5f5' : (selected.includes(r.id) ? '#f0fdf4' : 'transparent'),
                          borderLeft: isAtRisk ? '3px solid #ef4444' : '3px solid transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={selected.includes(r.id)}
                            onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{rowNum}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)'
                            }}>
                              {getInitials(r.name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, lineHeight: 1.25 }}>
                                {r.name}
                              </div>
                              {r.flagged && (
                                <span style={{ 
                                  fontSize: 9.5, 
                                  background: '#fef2f2', 
                                  color: '#dc2626', 
                                  border: '1px solid #fecaca',
                                  padding: '1px 5px', 
                                  borderRadius: 4, 
                                  fontWeight: 800, 
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em',
                                  marginTop: 2,
                                  display: 'inline-block'
                                }}>
                                  Support Flag
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#64748b', fontWeight: 600, fontSize: 12.5 }}>{r.adm || '—'}</td>
                        <ScoreCell r={r} field="a1" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                        <ScoreCell r={r} field="a2" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                        <ScoreCell r={r} field="a3" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                        <ScoreCell r={r} field="a4" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                        
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ 
                              fontWeight: 800, 
                              color: r.average >= 75 ? '#059669' : r.average >= 58 ? '#2563eb' : r.average >= 31 ? '#d97706' : (r.average > 0 ? '#dc2626' : '#94a3b8'), 
                              fontSize: 14 
                            }}>
                              {r.average > 0 ? `${r.average}%` : '—'}
                            </span>
                            {r.average > 0 && (
                              <div style={{ width: 42, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ 
                                  width: `${Math.min(100, r.average)}%`, 
                                  height: '100%', 
                                  background: r.average >= 75 ? '#059669' : r.average >= 58 ? '#2563eb' : r.average >= 31 ? '#d97706' : '#dc2626',
                                  borderRadius: 2
                                }} />
                              </div>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {r.points > 0 ? (
                            <span style={{ 
                              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                              color: '#1d4ed8', 
                              border: '1px solid #bfdbfe',
                              padding: '2px 8px', 
                              borderRadius: 12, 
                              fontSize: 11.5, 
                              fontWeight: 800 
                            }}>
                              {r.points} pts
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <Badge color={getGradeBadgeColor(r.grade)}>
                            {r.grade}
                          </Badge>
                        </td>

                        <ScoreCell r={r} field="remarks" editing={editing} setEditing={setEditing} saveScore={saveScore} />

                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-sm"
                            onClick={() => {
                              setSelectedStudentId(r.id);
                              setEntryMode('report');
                            }}
                            title="Open official Report Form for this student"
                            style={{ 
                              fontSize: 11.5, 
                              padding: '4px 10px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 5,
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              fontWeight: 600
                            }}
                          >
                            <FileText size={13} color="#059669" /> Report Form
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
                        Stream Class Average
                      </td>
                      <td style={{ color: '#64748b' }}>{rows.length} Total</td>
                      <td style={{ textAlign: 'center', color: '#065f46', fontWeight: 800, background: '#f0fdf4' }}>{colAvg.a1 ? `${colAvg.a1}%` : '—'}</td>
                      <td style={{ textAlign: 'center', color: '#065f46', fontWeight: 800, background: '#f0fdf4' }}>{colAvg.a2 ? `${colAvg.a2}%` : '—'}</td>
                      <td style={{ textAlign: 'center', color: '#065f46', fontWeight: 800, background: '#f0fdf4' }}>{colAvg.a3 ? `${colAvg.a3}%` : '—'}</td>
                      <td style={{ textAlign: 'center', color: '#065f46', fontWeight: 800, background: '#f0fdf4' }}>{colAvg.a4 ? `${colAvg.a4}%` : '—'}</td>
                      <td style={{ textAlign: 'center', color: '#059669', fontSize: 14.5 }}>
                        {colAvg.average ? `${colAvg.average}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {colAvg.points ? (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 }}>
                            {colAvg.points} pts
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge color={getGradeBadgeColor(colAvg.grade)}>{colAvg.grade}</Badge>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                        No students found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                marginBottom: 20,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}
            >
              {/* Left: Summary & Page Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                  Showing <strong style={{ color: '#0f172a' }}>{startIndex}–{endIndex}</strong> of <strong style={{ color: '#0f172a' }}>{totalStudents}</strong> students in <strong style={{ color: '#047857' }}>{cls || 'Class'}</strong>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                  <span>Rows per page:</span>
                  {[25, 50, 100, 'all'].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: pageSize === size ? '1px solid #047857' : '1px solid #e2e8f0',
                        background: pageSize === size ? '#ecfdf5' : '#ffffff',
                        color: pageSize === size ? '#047857' : '#475569',
                        fontWeight: pageSize === size ? 700 : 500,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {size === 'all' ? `All (${totalStudents})` : size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Page Navigation Buttons */}
              {pageSize !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: activePage <= 1 ? '#f8fafc' : '#ffffff',
                      color: activePage <= 1 ? '#94a3b8' : '#334155',
                      cursor: activePage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                    title="First Page"
                  >
                    « First
                  </button>

                  <button
                    disabled={activePage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: activePage <= 1 ? '#f8fafc' : '#ffffff',
                      color: activePage <= 1 ? '#94a3b8' : '#334155',
                      cursor: activePage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  {/* Page numbers (smart window) */}
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - activePage) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) => {
                      if (item === '...') {
                        return <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>;
                      }
                      const isCurr = item === activePage;
                      return (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          style={{
                            width: 32,
                            height: 30,
                            borderRadius: 6,
                            border: isCurr ? '1px solid #047857' : '1px solid #cbd5e1',
                            background: isCurr ? '#047857' : '#ffffff',
                            color: isCurr ? '#ffffff' : '#334155',
                            fontWeight: isCurr ? 700 : 500,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                        >
                          {item}
                        </button>
                      );
                    })}

                  <button
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: activePage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: activePage >= totalPages ? '#94a3b8' : '#334155',
                      cursor: activePage >= totalPages ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>

                  <button
                    disabled={activePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: activePage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: activePage >= totalPages ? '#94a3b8' : '#334155',
                      cursor: activePage >= totalPages ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                    title="Last Page"
                  >
                    Last »
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 4. ANALYTICS & INSIGHTS CARDS (GRID MODE) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Competency Distribution Donut */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Competency Distribution</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Curriculum performance bands for {subject}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#047857' }}>
                  <Award size={14} color="#047857" /> {rows.length} Graded
                </div>
              </div>

              {/* Modern visual layout: Doughnut on left, breakdown on right */}
              <div style={{ display: 'grid', gridTemplateColumns: gradeDist.length > 0 ? '160px 1fr' : '1fr', gap: 16, alignItems: 'center' }}>
                {gradeDist.length > 0 ? (
                  <div style={{ position: 'relative', width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie 
                          data={gradeDist} 
                          dataKey="value" 
                          nameKey="grade" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={50}
                          outerRadius={75} 
                          paddingAngle={3}
                          cornerRadius={4}
                        >
                          {gradeDist.map((d) => <Cell key={d.grade} fill={d.color} />)}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => [`${value} Students (${rows.length > 0 ? Math.round((value / rows.length) * 100) : 0}%)`, `${name} Band`]} 
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 12 }}
                          itemStyle={{ color: '#ffffff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{rows.length}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>Students</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>No graded scores yet</div>
                )}

                {/* Clean band breakdown table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {gradeDist.map((d) => (
                    <div key={d.grade} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', borderRadius: 6, background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.grade}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{d.value}</span>
                        <span style={{ fontSize: 11, color: '#64748b', minWidth: 34, textAlign: 'right' }}>{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject Comparison Across Classes */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Subject Performance Benchmark</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Class average % across curriculum subjects</div>
                </div>
                {subjectCompare.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>
                    <TrendingUp size={14} color="#1d4ed8" /> Mean: {Math.round((subjectCompare.reduce((a, b) => a + b.avg, 0) / (subjectCompare.length || 1)) * 10) / 10}%
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={subjectCompare} margin={{ top: 15, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    formatter={(v, name, props) => [`${v}%`, `${props?.payload?.fullName || 'Subject'} Class Average`]} 
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 12 }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                    {subjectCompare.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.avg >= 70 ? '#059669' : entry.avg >= 50 ? '#2563eb' : entry.avg >= 40 ? '#d97706' : '#dc2626'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard & Support Spotlight */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {/* Top 5 Leaderboard */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="#d97706" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Top 5 High Performers</h3>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 12 }}>
                  Honor Roll
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {top5.map((r, i) => (
                  <div 
                    key={r.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: i === 0 ? '#f0fdf4' : '#f8fafc',
                      border: i === 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ 
                      width: 26, 
                      height: 26, 
                      borderRadius: '50%', 
                      background: i === 0 ? '#fef3c7' : (i === 1 ? '#f1f5f9' : (i === 2 ? '#ffedd5' : '#f8fafc')),
                      border: i === 0 ? '1px solid #fde68a' : (i === 1 ? '1px solid #cbd5e1' : (i === 2 ? '1px solid #fed7aa' : '1px solid #e2e8f0')),
                      color: i === 0 ? '#b45309' : (i === 1 ? '#475569' : (i === 2 ? '#c2410c' : '#64748b')),
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {i === 0 ? <Trophy size={14} color="#d97706" /> : (i === 1 ? <Medal size={14} color="#64748b" /> : (i === 2 ? <Medal size={14} color="#b45309" /> : `${i + 1}`))}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {r.name}
                      </div>
                      <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, r.average)}%`, height: '100%', background: '#059669', borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#059669', fontWeight: 800, fontSize: 13.5 }}>{r.average}%</div>
                      <div style={{ marginTop: 2 }}><Badge color={getGradeBadgeColor(r.grade)}>{r.grade}</Badge></div>
                    </div>
                  </div>
                ))}
                {top5.length === 0 && <span className="muted" style={{ fontSize: 12, padding: 12, textAlign: 'center' }}>No student scores recorded yet.</span>}
              </div>
            </div>

            {/* At-Risk Remedial Spotlight */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} color="#dc2626" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Remedial Support Spotlight (&lt; 40%)
                  </h3>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: atRisk.length > 0 ? '#dc2626' : '#059669', background: atRisk.length > 0 ? '#fee2e2' : '#f0fdf4', border: atRisk.length > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 12 }}>
                  {atRisk.length} flagged
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {atRisk.map((r) => (
                  <div 
                    key={r.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#fef2f2',
                      border: '1px solid #fecaca'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                        Current Mark: <strong>{r.average}%</strong> · {r.points} CBC Points ({r.grade})
                      </div>
                    </div>
                    {r.flagged ? (
                      <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                        Flagged for Remedial
                      </span>
                    ) : (
                      <button 
                        className="btn btn-sm" 
                        onClick={() => flagStudent(r.id)}
                        style={{ fontSize: 11, padding: '4px 10px', background: '#ffffff', border: '1px solid #fca5a5', color: '#b91c1c', fontWeight: 600 }}
                      >
                        Flag for Support
                      </button>
                    )}
                  </div>
                ))}
                {atRisk.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 12px', color: '#059669' }}>
                    <Check size={28} style={{ margin: '0 auto 8px', background: '#f0fdf4', padding: 4, borderRadius: '50%', border: '1px solid #bbf7d0' }} />
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>No at-risk students in this subject!</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>All evaluated students are scoring &ge; 40%.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VIEW MODE 3: CLASS & SUBJECT ANALYSIS ── */}
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

    </div>
  );
}
