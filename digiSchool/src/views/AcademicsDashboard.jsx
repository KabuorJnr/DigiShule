import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Badge, ProgressBar } from '../components/widgets';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { studentOverall, gradeFor, pointsForGrade, subjectAverage, is844Class } from '../utils/grading';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../data/seed';
import ReportCardModal from '../components/ReportCardModal';
import { Download, FileText, Award, CheckCircle2, Clock, AlertTriangle, Printer, Users, BookOpen, Search } from 'lucide-react';

function Stat({ label, value, color, sub, icon: IconComp }) {
  const accent = color || '#047857';
  return (
    <div 
      style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        justify: 'space-between',
        minHeight: 100,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
        {IconComp && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconComp size={15} color={accent} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>

      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
    </div>
  );
}

export default function AcademicsDashboard({ store = {}, user = {} }) {
  const { navigate = (() => {}), notify = (() => {}), settings = {}, teachers = [], examSchedules = [] } = store || {};
  const [students, setStudents] = useState([]);
  const [awaitingApprovalCount, setAwaitingApprovalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview'); // overview | merit | audit | slips
  
  // Selection states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');

  const rawStudents = useMemo(() => {
    if (store?.students && Array.isArray(store.students) && store.students.length > 0) return store.students;
    return students || [];
  }, [store?.students, students]);

  const activeStudentsList = useMemo(() => {
    return rawStudents.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  }, [rawStudents]);

  const rawStaff = useMemo(() => {
    if (store?.teachers && Array.isArray(store.teachers) && store.teachers.length > 0) return store.teachers;
    return teachers || [];
  }, [store?.teachers, teachers]);

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(settings?.classes || []);
    const dynamic = getDynamicClasses(activeStudentsList);
    return [...new Set([...saved, ...dynamic])];
  }, [activeStudentsList, settings]);

  useEffect(() => {
    import('../lib/api').then(({ fetchStudents }) => {
      fetchStudents(0, 2000, { activeOnly: true }).then(r => setStudents(r.data || [])).catch(() => {});
    });

    const fetchApprovals = async () => {
      try {
        const { count: approvalCount } = await supabase.from('approval_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setAwaitingApprovalCount(approvalCount || 0);
      } catch (e) {
        console.warn('Failed to load approvals:', e);
      }
    };
    fetchApprovals();
  }, [store?.schoolId]);

  const activeTeacherList = useMemo(() => rawStaff.filter(t => t.status !== 'Inactive'), [rawStaff]);
  const activeTeachers = useMemo(() => activeTeacherList.filter(t => t.status === 'Active').length, [activeTeacherList]);
  const classesCount = dynamicClasses.length;

  // ── MERIT LIST & RANKINGS ──
  const meritList = useMemo(() => {
    const listToRank = selectedClass === 'All'
      ? activeStudentsList
      : activeStudentsList.filter(s => s.class === selectedClass);

    const evaluated = listToRank.map(s => {
      const is844 = is844Class(s.class);
      const overallScore = studentOverall(s, SUBJECTS);
      const meanGradeCode = gradeFor(overallScore, store?.gradeBoundaries, is844 ? '844' : 'CBC');
      const meanPoints = pointsForGrade(meanGradeCode, is844 ? '844' : 'CBC');

      let totalMarks = 0;
      SUBJECTS.forEach(sub => {
        totalMarks += subjectAverage(s.scores?.[sub]);
      });

      return {
        ...s,
        totalMarks,
        meanPercentage: overallScore,
        meanGradeCode,
        meanPoints,
        rawStudent: s,
      };
    });

    evaluated.sort((a, b) => b.meanPercentage - a.meanPercentage);

    let currentRank = 1;
    return evaluated.map((s, idx, arr) => {
      if (idx > 0 && Math.abs(s.meanPercentage - arr[idx - 1].meanPercentage) < 0.01) {
        return { ...s, streamPosition: arr[idx - 1].streamPosition };
      } else {
        currentRank = idx + 1;
        return { ...s, streamPosition: currentRank };
      }
    });
  }, [activeStudentsList, selectedClass, store?.gradeBoundaries]);

  const schoolOverallMean = useMemo(() => {
    if (activeStudentsList.length === 0) return '0.0%';
    const sum = activeStudentsList.reduce((acc, s) => {
      return acc + studentOverall(s, SUBJECTS);
    }, 0);
    return `${(sum / activeStudentsList.length).toFixed(1)}%`;
  }, [activeStudentsList]);

  // ── MARKS AUDIT ──
  const marksAuditMatrix = useMemo(() => {
    const matrix = [];
    const classesToAudit = selectedClass === 'All' ? dynamicClasses : [selectedClass];

    classesToAudit.forEach(cls => {
      const studentsInClass = activeStudentsList.filter(s => s.class === cls);
      if (studentsInClass.length === 0) return;

      SUBJECTS.forEach(sub => {
        const teacherAssigned = rawStaff.find(t => t.subject === sub || t.dept === sub || (t.subjects && t.subjects.includes(sub)))?.name || 'Unassigned';
        const enteredCount = studentsInClass.filter(s => {
          const sc = s.scores?.[sub];
          if (!sc) return false;
          if (typeof sc === 'number') return true;
          if (sc.score !== undefined && sc.score !== '') return true;
          if (sc.average !== undefined && sc.average !== '') return true;
          if (sc.a1 !== undefined && sc.a1 !== '') return true;
          if (sc.a2 !== undefined && sc.a2 !== '') return true;
          if (sc.a3 !== undefined && sc.a3 !== '') return true;
          if (sc.a4 !== undefined && sc.a4 !== '') return true;
          return false;
        }).length;

        const pct = Math.round((enteredCount / studentsInClass.length) * 100);
        matrix.push({
          id: `${cls}_${sub}`,
          class: cls,
          subject: sub,
          teacher: teacherAssigned,
          totalStudents: studentsInClass.length,
          enteredCount,
          pct,
          status: pct === 100 ? 'Complete' : pct > 0 ? 'In Progress' : 'Pending Entry'
        });
      });
    });

    return matrix;
  }, [dynamicClasses, selectedClass, activeStudentsList, rawStaff]);

  const auditStats = useMemo(() => {
    const totalUnits = marksAuditMatrix.length || 1;
    const completedUnits = marksAuditMatrix.filter(m => m.status === 'Complete').length;
    const inProgressUnits = marksAuditMatrix.filter(m => m.status === 'In Progress').length;
    const pendingUnits = marksAuditMatrix.filter(m => m.status === 'Pending Entry').length;
    const overallPct = Math.round((completedUnits / totalUnits) * 100);
    return { totalUnits, completedUnits, inProgressUnits, pendingUnits, overallPct };
  }, [marksAuditMatrix]);

  // Exporters
  const handleExportMeritListPDF = () => {
    if (meritList.length === 0) return notify('No students in current merit list selection', 'warning');
    const head = ['Rank', 'Adm No', 'Student Name', 'Class Stream', 'Total Marks', 'Mean %', 'Grade', 'Points'];
    const body = meritList.map((s, idx) => [
      s.streamPosition || idx + 1,
      s.adm || s.admission_no || '-',
      s.name,
      s.class,
      s.totalMarks,
      `${s.meanPercentage.toFixed(1)}%`,
      s.meanGradeCode,
      s.meanPoints.toFixed(1)
    ]);

    exportTablePDF({
      school: settings,
      title: `OFFICIAL MERIT RANKING - ${selectedClass === 'All' ? 'ALL STREAMS' : selectedClass.toUpperCase()}`,
      subtitle: `Term 2 · Academic Year 2026 | Total Ranked: ${meritList.length}`,
      head,
      body,
      filename: `merit_list_${selectedClass === 'All' ? 'school' : selectedClass.replace(/\s+/g, '_')}.pdf`
    });
    notify(`Merit list PDF downloaded for ${meritList.length} student(s)`, 'success');
  };

  const handleExportMeritListExcel = () => {
    if (meritList.length === 0) return notify('No students in current merit list selection', 'warning');
    const aoa = [
      ['Rank', 'Adm No', 'Student Name', 'Class Stream', 'Total Marks', 'Mean %', 'Grade', 'Points']
    ];
    meritList.forEach((s, idx) => {
      aoa.push([
        s.streamPosition || idx + 1,
        s.adm || s.admission_no || '-',
        s.name,
        s.class,
        s.totalMarks,
        Number(s.meanPercentage.toFixed(1)),
        s.meanGradeCode,
        Number(s.meanPoints.toFixed(1))
      ]);
    });

    downloadExcel(`Merit_List_${selectedClass}.xlsx`, [{ name: 'Merit Ranking', aoa }]);
    notify('Merit list Excel export complete', 'success');
  };

  const handleExportAuditPDF = () => {
    if (marksAuditMatrix.length === 0) return notify('No audit records to export', 'warning');
    const head = ['Class', 'Subject', 'Teacher', 'Entered', 'Total', 'Completion %', 'Status'];
    const body = marksAuditMatrix.map(m => [
      m.class,
      m.subject,
      m.teacher,
      m.enteredCount,
      m.totalStudents,
      `${m.pct}%`,
      m.status
    ]);

    exportTablePDF({
      school: settings,
      title: 'MARKS ENTRY VERIFICATION AUDIT REGISTER',
      subtitle: `Term 2 · Academic Year 2026 | Class Scope: ${selectedClass}`,
      head,
      body,
      filename: `Marks_Audit_${selectedClass}.pdf`
    });
    notify('Marks audit PDF downloaded', 'success');
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 40 }}>
      {/* ── TOP TOOLBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Academic Merit & Performance Hub
            </h1>
            <span style={{ background: '#047857', color: '#ffffff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
              Academic Office
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Merit list generation, subject performance analysis, marks verification & official result slips
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => navigate('gradebook')}
            style={{ 
              height: 36, 
              padding: '0 14px', 
              borderRadius: 6, 
              background: '#ffffff', 
              border: '1px solid #cbd5e1', 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#334155',
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              cursor: 'pointer' 
            }}
          >
            <BookOpen size={14} /> Open Gradebook
          </button>
          <button 
            onClick={handleExportMeritListPDF}
            style={{ 
              height: 36, 
              padding: '0 16px', 
              borderRadius: 6, 
              background: '#047857', 
              border: 'none', 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#ffffff',
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(4, 120, 87, 0.3)' 
            }}
          >
            <Download size={14} /> Export Merit List (PDF)
          </button>
        </div>
      </div>

      {/* ── COMPACT EMERALD HEADER BANNER ── */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', 
          border: '1px solid #047857',
          borderRadius: 8, 
          padding: '14px 20px', 
          display: 'flex', 
          justify: 'space-between', 
          alignItems: 'center', 
          marginBottom: 16,
          color: '#ffffff',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {settings?.name || 'Academic Office'}
            </span>
            <span style={{ color: '#047857', fontSize: 10 }}>•</span>
            <span style={{ fontSize: 11, color: '#a7f3d0' }}>Term 2 · 2026 Academic Year</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
            Academic Performance & Examination Analytics
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
            Merit Ranking · Subject Means · Audit Register · Result Slips
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.08)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Clock size={13} color="#6ee7b7" />
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── CORPORATE EMERALD TAB NAVIGATION ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', marginBottom: 16, background: '#ffffff', borderRadius: '8px 8px 0 0', padding: '0 8px' }}>
        {[
          { id: 'overview', label: 'Academic Summary', icon: Award },
          { id: 'merit', label: 'Merit List & Performance', icon: Award, badge: meritList.length },
          { id: 'audit', label: 'Marks Entry Audit', icon: CheckCircle2, badge: `${auditStats.overallPct}%` },
          { id: 'slips', label: 'Result Slips & Cards', icon: Printer, badge: activeStudentsList.length },
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #047857' : '3px solid transparent',
                color: isActive ? '#047857' : '#64748b',
                fontWeight: isActive ? 700 : 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <t.icon size={15} color={isActive ? '#047857' : '#64748b'} />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: isActive ? '#dcfce7' : '#f1f5f9', color: isActive ? '#047857' : '#475569' }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: ACADEMIC SUMMARY ── */}
      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <Stat icon={Users} label="Total Enrolled Students" value={activeStudentsList.length} sub="Active Registry" color="#047857" />
            <Stat icon={BookOpen} label="Teaching Faculty" value={activeTeacherList.length} sub={`${activeTeachers} Active Faculty`} color="#047857" />
            <Stat icon={Award} label="Classes & Streams" value={`${settings?.classes?.length || 1} / ${classesCount}`} sub="Active Streams" color="#047857" />
            <Stat icon={Award} label="Overall Mean Score" value={schoolOverallMean} sub="Across All Subjects" color="#047857" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <Stat icon={FileText} label="Total Exam Schedules" value={examSchedules.length} sub="Published Exams" color="#047857" />
            <Stat icon={CheckCircle2} label="Marks Completion" value={`${auditStats.overallPct}%`} sub={`${auditStats.completedUnits} / ${auditStats.totalUnits} Units`} color={auditStats.overallPct >= 80 ? '#047857' : '#d97706'} />
            <Stat icon={AlertTriangle} label="Awaiting Approval" value={awaitingApprovalCount} sub="Pending Review" color={awaitingApprovalCount > 0 ? '#d97706' : '#047857'} />
            <Stat icon={BookOpen} label="Curriculum Subjects" value={SUBJECTS.length} sub="Active Subjects" color="#047857" />
          </div>

          {/* Quick Tools Grid */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Academic Quick Tools</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <button className="btn" style={{ height: 40, justifyContent: 'flex-start', fontSize: 13 }} onClick={() => setActiveTab('merit')}>
                <Award size={15} style={{ marginRight: 6 }} /> Merit List Generator
              </button>
              <button className="btn" style={{ height: 40, justifyContent: 'flex-start', fontSize: 13 }} onClick={() => setActiveTab('audit')}>
                <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Audit Marks Entry
              </button>
              <button className="btn" style={{ height: 40, justifyContent: 'flex-start', fontSize: 13 }} onClick={() => setActiveTab('slips')}>
                <Printer size={15} style={{ marginRight: 6 }} /> Result Slips Hub
              </button>
              <button className="btn" style={{ height: 40, justifyContent: 'flex-start', fontSize: 13 }} onClick={() => navigate('gradebook')}>
                <FileText size={15} style={{ marginRight: 6 }} /> Gradebook Review
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: MERIT LIST & PERFORMANCE ── */}
      {activeTab === 'merit' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Official Merit Ranking & Analysis</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Ranked {meritList.length} student(s) in selected scope</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ height: 34, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 12 }}
              >
                <option value="All">All Classes & Streams</option>
                {dynamicClasses.map(c => <option key={c} value={c}>Stream {c}</option>)}
              </select>

              <button className="btn" onClick={handleExportMeritListExcel} style={{ height: 34, fontSize: 12 }}>
                Excel Export
              </button>
              <button className="btn btn-primary" onClick={handleExportMeritListPDF} style={{ height: 34, fontSize: 12, background: '#047857', border: 'none' }}>
                PDF Export
              </button>
            </div>
          </div>

          <div className="scroll-x">
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Rank</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Adm No</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Student Name</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Stream</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Total Marks</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Mean %</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Grade</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Points</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {meritList.map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td><strong style={{ color: '#047857' }}>#{s.streamPosition || idx + 1}</strong></td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.adm || s.admission_no || '-'}</span></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                    <td>{s.class}</td>
                    <td style={{ fontWeight: 700, color: '#047857' }}>{s.totalMarks}</td>
                    <td style={{ fontWeight: 700 }}>{s.meanPercentage.toFixed(1)}%</td>
                    <td>
                      <Badge color={s.meanGradeCode === 'A' || s.meanGradeCode === 'EE' ? 'green' : s.meanGradeCode === 'E' || s.meanGradeCode === 'BE' ? 'red' : 'blue'}>
                        {s.meanGradeCode}
                      </Badge>
                    </td>
                    <td>{s.meanPoints.toFixed(1)}</td>
                    <td>
                      <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSelectedStudentForReport(s.rawStudent)}>
                        Result Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meritList.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 30 }}>No students found in merit ranking selection.</div>}
        </div>
      )}

      {/* ── TAB 3: MARKS AUDIT ── */}
      {activeTab === 'audit' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Marks Entry Audit Register</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Audit score submissions across all class subjects</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ height: 34, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 12 }}
              >
                <option value="All">All Streams</option>
                {dynamicClasses.map(c => <option key={c} value={c}>Stream {c}</option>)}
              </select>

              <button className="btn btn-primary" onClick={handleExportAuditPDF} style={{ height: 34, fontSize: 12, background: '#047857', border: 'none' }}>
                Export Audit PDF
              </button>
            </div>
          </div>

          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Class Stream</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Subject</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Teacher</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase', width: 140 }}>Progress</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Entered / Total</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {marksAuditMatrix.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.class}</strong></td>
                  <td style={{ fontWeight: 600 }}>{m.subject}</td>
                  <td>{m.teacher}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32 }}>{m.pct}%</span>
                      <div style={{ flex: 1 }}><ProgressBar value={m.pct} color={m.pct === 100 ? '#047857' : m.pct > 0 ? '#d97706' : '#d13438'} /></div>
                    </div>
                  </td>
                  <td className="muted">{m.enteredCount} of {m.totalStudents}</td>
                  <td>
                    <Badge color={m.status === 'Complete' ? 'green' : m.status === 'In Progress' ? 'amber' : 'red'}>
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 4: RESULT SLIPS & CARDS ── */}
      {activeTab === 'slips' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Result Slips & Report Cards Hub</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Generate and print official terminal result slips</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                <input 
                  type="text" 
                  placeholder="Search student or adm..." 
                  value={searchStudent} 
                  onChange={(e) => setSearchStudent(e.target.value)}
                  style={{ width: '100%', paddingLeft: 30, height: 34, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ height: 34, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 12 }}
              >
                <option value="All">All Streams</option>
                {dynamicClasses.map(c => <option key={c} value={c}>Stream {c}</option>)}
              </select>
            </div>
          </div>

          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Adm No</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Student Name</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Class Stream</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Gender</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeStudentsList
                .filter(s => selectedClass === 'All' || s.class === selectedClass)
                .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || (s.adm && s.adm.toLowerCase().includes(searchStudent.toLowerCase())))
                .slice(0, 50)
                .map(s => (
                  <tr key={s.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.adm || '-'}</span></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                    <td><strong>{s.class || '-'}</strong></td>
                    <td>{s.gender || '-'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '3px 10px', background: '#047857', border: 'none' }} onClick={() => setSelectedStudentForReport(s)}>
                        View Result Slip
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Result Slip Modal */}
      {selectedStudentForReport && (
        <ReportCardModal
          student={selectedStudentForReport}
          students={activeStudentsList}
          subjects={SUBJECTS}
          gradeBoundaries={store?.gradeBoundaries}
          examTitle="Term 2 Main Examination"
          termName="Term 2"
          schoolSettings={store?.settings}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
    </div>
  );
}
