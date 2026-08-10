import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Badge, ProgressBar } from '../components/widgets';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { studentOverall, gradeFor, pointsForGrade, subjectAverage, is844Class } from '../utils/grading';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../data/seed';
import ReportCardModal from '../components/ReportCardModal';
import MeritListModule from '../components/MeritListModule';
import WeeklyBrief from '../components/WeeklyBrief';
import BenchmarkCard from '../components/BenchmarkCard';
import StreamPerformanceGraph from '../components/StreamPerformanceGraph';
import { Download, FileText, Award, CheckCircle2, Clock, AlertTriangle, Printer, Users, BookOpen, Search, Grid3x3, Zap } from 'lucide-react';
import { reportError } from '../lib/errorReporter';

function Stat({ label, value, color, sub, icon: IconComp }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 96,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{label}</span>
        {IconComp && <IconComp size={16} color="#9ca3af" strokeWidth={1.75} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 'auto' }}>{sub}</div>}
      <div style={{ display: 'none' }}>{color}</div>
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

  // Only classes an admin has explicitly added in Settings. We used to
  // union with getDynamicClasses(students) which surfaced stale class values
  // on student records — the "phantom classes" problem.
  const dynamicClasses = useMemo(() => {
    return expandClassesWithStreams(settings?.classes || []);
  }, [settings]);

  useEffect(() => {
    import('../lib/api').then(({ fetchStudents }) => {
      fetchStudents(0, 2000, { activeOnly: true }).then(r => setStudents(r.data || [])).catch((e) => reportError(e, 'views.AcademicsDashboard'));
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
    <div style={{ background: '#fafafa', minHeight: '100vh', paddingBottom: 40 }}>
      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            {settings?.name || 'School'} · Term 2 · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px' }}>
            Academic Merit &amp; Performance
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Merit list generation, subject performance analysis, marks verification &amp; official result slips.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('gradebook')}
            style={{ height: 34, padding: '0 14px', borderRadius: 6, background: '#ffffff', border: '1px solid #d1d5db', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <BookOpen size={14} strokeWidth={1.75} /> Gradebook
          </button>
          <button
            onClick={handleExportMeritListPDF}
            style={{ height: 34, padding: '0 14px', borderRadius: 6, background: '#111827', border: '1px solid #111827', fontSize: 13, fontWeight: 500, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Download size={14} strokeWidth={1.75} /> Export Merit List
          </button>
        </div>
      </div>

      {/* ── TIMETABLE STUDIO QUICK ACCESS ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Grid3x3 size={18} color="#4b5563" strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Timetable Studio</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Design, edit and publish class &amp; teacher timetables.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#6b7280' }}>
            <div><span style={{ fontWeight: 600, color: '#111827' }}>{Object.keys(store?.timetables || {}).length}</span> published</div>
            <div><span style={{ fontWeight: 600, color: '#111827' }}>{dynamicClasses.length}</span> classes</div>
          </div>
          <button
            onClick={() => navigate('timetable')}
            style={{ height: 34, padding: '0 14px', borderRadius: 6, background: '#ffffff', border: '1px solid #d1d5db', fontSize: 13, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            Open <span style={{ marginLeft: 2 }}>→</span>
          </button>
        </div>
      </div>

      {/* ── AI: WEEKLY BRIEF + BENCHMARKS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 20 }}>
        <WeeklyBrief store={{ ...store, students: activeStudentsList, teachers: rawStaff, settings, examSchedules }} user={user} />
        <BenchmarkCard user={user} />
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20, gap: 4, flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'merit', label: 'Merit list', badge: meritList.length },
          { id: 'audit', label: 'Marks audit', badge: `${auditStats.overallPct}%` },
          { id: 'slips', label: 'Result slips', badge: activeStudentsList.length },
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
                color: isActive ? '#111827' : '#6b7280',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge !== 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 10, background: '#f3f4f6', color: '#4b5563' }}>
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

          {/* Stream Performance Graph */}
          <div style={{ marginBottom: 16 }}>
            <StreamPerformanceGraph students={activeStudentsList} />
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
        <MeritListModule 
          students={activeStudentsList}
          schoolSettings={store?.settings}
          teachers={rawStaff}
          classes={dynamicClasses}
          userRole={user?.role || 'dos'}
          currentStudentId={user?.student_id || user?.id}
          notify={notify}
        />
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
