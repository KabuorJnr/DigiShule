import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { Badge, ProgressBar } from '../components/widgets';
import { exportTablePDF, downloadCSV, downloadExcel, exportReportCardsPDF } from '../utils/exporters';
import { computeStudentReport, is844Class } from '../utils/grading';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../data/seed';
import ReportCardModal from '../components/ReportCardModal';
import { Download, FileText, Award, CheckCircle2, Clock, AlertTriangle, Printer, Users, BookOpen, ShieldCheck } from 'lucide-react';

function Stat({ label, value, color, sub }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function AcademicsDashboard({ store, user }) {
  const { navigate, notify, settings, teachers = [], examSchedules = [] } = store;
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({ top_subjects: [] });
  const [awaitingApprovalCount, setAwaitingApprovalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview'); // overview | merit | audit | slips | exams
  
  // Selection states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');

  const rawStudents = useMemo(() => {
    if (students && students.length > 0) return students;
    if (store?.students && store.students.length > 0) return store.students;
    return [];
  }, [students, store?.students]);

  const activeStudentsList = useMemo(() => {
    return rawStudents.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  }, [rawStudents]);

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(settings?.classes || []);
    const dynamic = getDynamicClasses(activeStudentsList);
    return [...new Set([...saved, ...dynamic])];
  }, [activeStudentsList, settings]);

  useEffect(() => {
    import('../lib/api').then(({ fetchStudents, fetchAcademicAnalytics }) => {
      fetchStudents(0, 1000).then(r => setStudents(r.data || [])).catch(() => {});
      fetchAcademicAnalytics().then(r => setAnalytics(r || { top_subjects: [] })).catch(() => {});
    });

    const fetchApprovals = async () => {
      try {
        const { count: approvalCount } = await supabase.from('approval_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('school_id', store.schoolId);
          
        const { count: paperCount } = await supabase.from('exam_papers')
          .select('*', { count: 'exact', head: true })
          .eq('moderation_status', 'pending')
          .eq('school_id', store.schoolId);
          
        setAwaitingApprovalCount((approvalCount || 0) + (paperCount || 0));
      } catch (err) {
        console.error(err);
      }
    };
    if (store.schoolId) fetchApprovals();
  }, [store.schoolId]);
  
  const classesCount = settings.levels?.length || dynamicClasses.length || 0;
  const activeTeacherList = teachers.filter(t => t.status !== 'Inactive');
  const activeTeachers = activeTeacherList.filter(t => t.status === 'Active').length;

  // ── MERIT LIST COMPUTATION ──
  const meritList = useMemo(() => {
    const list = activeStudentsList.map(s => {
      const report = computeStudentReport({
        student: s,
        students: activeStudentsList,
        subjects: SUBJECTS,
        examTitle: 'Term 1 Opening Exam',
        termName: 'Term 1',
        gradeBoundaries: store.gradeBoundaries
      });
      return {
        id: s.id,
        adm: s.adm || s.admission_no || s.id || '-',
        name: s.name,
        class: s.class || '-',
        gender: s.gender || '-',
        totalMarks: report?.totalMarks || 0,
        meanPercentage: report?.meanPercentage || 0,
        meanGradeCode: report?.meanGradeCode || '-',
        meanGradeFull: report?.meanGradeFull || '-',
        meanPoints: report?.meanPoints || 0,
        streamPosition: report?.streamPosition || '-',
        overallPosition: report?.overallPosition || '-',
        rawStudent: s
      };
    });

    const filtered = selectedClass === 'All'
      ? list
      : list.filter(s => s.class === selectedClass || (s.class && s.class.startsWith(selectedClass)));

    return filtered.sort((a, b) => b.totalMarks - a.totalMarks);
  }, [activeStudentsList, selectedClass, store.gradeBoundaries]);

  // Overall Mean Score across school
  const schoolOverallMean = useMemo(() => {
    if (meritList.length === 0) return '0.0%';
    const totalPct = meritList.reduce((acc, s) => acc + s.meanPercentage, 0);
    return (totalPct / meritList.length).toFixed(1) + '%';
  }, [meritList]);

  // ── MARKS ENTRY AUDIT COMPUTATION ──
  const marksAuditMatrix = useMemo(() => {
    const matrix = [];
    const classesToAudit = selectedClass === 'All' ? dynamicClasses : [selectedClass];

    classesToAudit.forEach(cls => {
      const studentsInClass = activeStudentsList.filter(s => s.class === cls);
      if (studentsInClass.length === 0) return;

      SUBJECTS.forEach(sub => {
        const teacherAssigned = teachers.find(t => t.subject === sub || t.dept === sub || (t.subjects && t.subjects.includes(sub)))?.name || 'Unassigned';
        const enteredCount = studentsInClass.filter(s => {
          const sc = s.scores?.[sub];
          if (!sc) return false;
          if (typeof sc === 'number') return sc > 0;
          if (sc.score !== undefined) return Number(sc.score) > 0;
          if (sc.average !== undefined) return Number(sc.average) > 0;
          return (Number(sc.a1) || 0) + (Number(sc.a2) || 0) + (Number(sc.a3) || 0) + (Number(sc.a4) || 0) > 0;
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
  }, [dynamicClasses, selectedClass, activeStudentsList, teachers]);

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
    const head = ['Rank', 'Adm No', 'Student Name', 'Class', 'Total Marks', 'Mean %', 'Grade', 'Points', 'Stream Pos'];
    const body = meritList.map((s, idx) => [
      idx + 1,
      s.adm,
      s.name,
      s.class,
      s.totalMarks,
      `${s.meanPercentage.toFixed(1)}%`,
      s.meanGradeCode,
      s.meanPoints.toFixed(1),
      s.streamPosition
    ]);

    exportTablePDF({
      school: settings,
      title: `OFFICIAL MERIT LIST - ${selectedClass === 'All' ? 'ALL CLASSES' : selectedClass.toUpperCase()}`,
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
      ['Rank', 'Adm No', 'Student Name', 'Class', 'Gender', 'Total Marks', 'Mean %', 'Grade', 'Points', 'Stream Position', 'Overall Position'],
      ...meritList.map((s, idx) => [
        idx + 1,
        s.adm,
        s.name,
        s.class,
        s.gender,
        s.totalMarks,
        s.meanPercentage,
        s.meanGradeCode,
        s.meanPoints,
        s.streamPosition,
        s.overallPosition
      ])
    ];
    downloadExcel(`merit_list_${selectedClass === 'All' ? 'school' : selectedClass.replace(/\s+/g, '_')}.xlsx`, [{ name: 'Merit List', aoa }]);
    notify('Merit list exported as Excel', 'success');
  };

  const handleExportAuditPDF = () => {
    if (marksAuditMatrix.length === 0) return notify('No audit records to export', 'warning');
    const head = ['Class', 'Subject', 'Assigned Teacher', 'Progress', 'Entered / Total', 'Status'];
    const body = marksAuditMatrix.map(m => [
      m.class,
      m.subject,
      m.teacher,
      `${m.pct}%`,
      `${m.enteredCount} / ${m.totalStudents}`,
      m.status
    ]);
    exportTablePDF({
      school: settings,
      title: 'MARKS ENTRY AUDIT & VERIFICATION REGISTER',
      subtitle: `DOS Office Audit · Date: ${new Date().toLocaleDateString()}`,
      head,
      body,
      filename: 'Marks_Entry_Audit_Register.pdf'
    });
    notify('Marks Entry Audit PDF downloaded', 'success');
  };

  const handleExportBatchResultSlips = () => {
    const listToExport = selectedClass === 'All' ? activeStudentsList : activeStudentsList.filter(s => s.class === selectedClass);
    if (listToExport.length === 0) return notify('No students found for generating result slips', 'warning');
    notify(`Generating Result Slips for ${listToExport.length} student(s)...`, 'info');
    exportReportCardsPDF({
      school: settings,
      gradeBoundaries: store.gradeBoundaries,
      students: listToExport,
      subjects: SUBJECTS,
      examTitle: 'Term 1 Opening Exam',
      termName: 'Term 1',
      filename: `result_slips_${selectedClass === 'All' ? 'school' : selectedClass.replace(/\s+/g, '_')}.pdf`
    });
    notify(`Generated ${listToExport.length} Result Slip(s)`, 'success');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Director of Studies (DOS) & Academic Hub</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Exam office management, merit lists, result analysis, and marks entry verification</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => navigate('gradebook')}>
            <FileText size={16} style={{ marginRight: 6 }} /> Open Gradebook
          </button>
          <button className="btn" onClick={() => navigate('exams')}>
            <BookOpen size={16} style={{ marginRight: 6 }} /> Exam Schedules
          </button>
        </div>
      </div>

      {/* Header Office Banner */}
      <div style={{ background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', color: '#fff', padding: '18px 24px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, boxShadow: '0 4px 12px rgba(4, 120, 87, 0.15)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 800 }}>Academic Affairs & Examination Office</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Director of Studies (DOS) · Merit Ranking · Marks Audit · Result Slips
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <Badge color="green" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'transparent' }}>Term 2 · 2026</Badge>
        </div>
      </div>

      {/* DOS Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
        <button className={`tab${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>
          <ShieldCheck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Academic Overview
        </button>
        <button className={`tab${activeTab === 'merit' ? ' active' : ''}`} onClick={() => setActiveTab('merit')}>
          <Award size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Merit List & Performance
        </button>
        <button className={`tab${activeTab === 'audit' ? ' active' : ''}`} onClick={() => setActiveTab('audit')}>
          <CheckCircle2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Marks Entry Audit
          {auditStats.pendingUnits > 0 && <Badge color="amber" style={{ marginLeft: 8 }}>{auditStats.pendingUnits} Pending</Badge>}
        </button>
        <button className={`tab${activeTab === 'slips' ? ' active' : ''}`} onClick={() => setActiveTab('slips')}>
          <Printer size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Result Slips & Cards
        </button>
      </div>

      {/* ── TAB 1: ACADEMIC OVERVIEW ── */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
            <Stat label="Total Enrolled" value={activeStudentsList.length} sub="Active students" color="#047857" />
            <Stat label="Teaching Faculty" value={activeTeacherList.length} sub={`${activeTeachers} active`} color="#0EA5E9" />
            <Stat label="Classes & Streams" value={classesCount} sub="Active class levels" color="#107C10" />
            <Stat label="Overall Mean Score" value={schoolOverallMean} sub="Across all subjects" color="#047857" />
          </div>

          <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
            <Stat label="Total Exams" value={examSchedules.length} sub={`${examSchedules.length} schedules published`} />
            <Stat label="Marks Completion" value={`${auditStats.overallPct}%`} sub={`${auditStats.completedUnits} / ${auditStats.totalUnits} complete`} color={auditStats.overallPct >= 90 ? '#107C10' : '#F59E0B'} />
            <Stat label="Awaiting Approval" value={awaitingApprovalCount} sub="Pending DoS review" color="#D13438" />
            <Stat label="Subject Count" value={SUBJECTS.length} sub="Active curriculum" color="#FFB900" />
          </div>

          {/* Quick Actions */}
          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <h3 className="section-title">DOS Quick Tools</h3>
            <div className="grid grid-4" style={{ gap: 10 }}>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => setActiveTab('merit')}>
                <Award size={16} style={{ marginRight: 6 }} /> Merit List Generator
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => setActiveTab('audit')}>
                <CheckCircle2 size={16} style={{ marginRight: 6 }} /> Audit Marks Entry
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => setActiveTab('slips')}>
                <Printer size={16} style={{ marginRight: 6 }} /> Result Slips Hub
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('gradebook')}>
                <FileText size={16} style={{ marginRight: 6 }} /> Gradebook Review
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: MERIT LIST & PERFORMANCE ── */}
      {activeTab === 'merit' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Class Performance & Official Merit List</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Ranked performance order based on total marks and mean percentages</p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Filter Class:</label>
                <select className="select" style={{ width: 150 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  <option value="All">All Classes</option>
                  {dynamicClasses.map(c => <option key={c} value={c}>Grade {c}</option>)}
                </select>
                <button className="btn btn-primary" style={{ gap: 6 }} onClick={handleExportMeritListPDF}>
                  <Printer size={15} /> Download Merit List (PDF)
                </button>
                <button className="btn" style={{ gap: 6 }} onClick={handleExportMeritListExcel}>
                  <Download size={15} /> Export Excel
                </button>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong>Showing {meritList.length} ranked student(s)</strong>
              <span className="muted" style={{ fontSize: 12 }}>Class Filter: {selectedClass}</span>
            </div>

            {meritList.length === 0 ? (
              <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No students found in current merit selection.</div>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Adm No</th>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Total Marks</th>
                      <th>Mean %</th>
                      <th>Grade</th>
                      <th>Points</th>
                      <th>Stream Pos</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meritList.map((s, idx) => (
                      <tr key={s.id}>
                        <td>
                          <span style={{ 
                            fontWeight: 800, 
                            color: idx === 0 ? '#d97706' : idx === 1 ? '#475569' : idx === 2 ? '#b45309' : '#0f172a',
                            fontSize: idx < 3 ? 15 : 13 
                          }}>
                            #{idx + 1} {idx === 0 && '🥇'} {idx === 1 && '🥈'} {idx === 2 && '🥉'}
                          </span>
                        </td>
                        <td>{s.adm}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.class}</td>
                        <td style={{ fontWeight: 700, color: '#047857' }}>{s.totalMarks}</td>
                        <td style={{ fontWeight: 700 }}>{s.meanPercentage.toFixed(1)}%</td>
                        <td>
                          <Badge color={s.meanGradeCode === 'A' || s.meanGradeCode === 'EE' ? 'green' : s.meanGradeCode === 'E' || s.meanGradeCode === 'BE' ? 'red' : 'blue'}>
                            {s.meanGradeCode}
                          </Badge>
                        </td>
                        <td>{s.meanPoints.toFixed(1)}</td>
                        <td className="muted">{s.streamPosition}</td>
                        <td>
                          <button className="btn btn-sm" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => setSelectedStudentForReport(s.rawStudent)}>
                            <FileText size={13} style={{ marginRight: 4 }} /> Result Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB 3: MARKS ENTRY AUDIT ── */}
      {activeTab === 'audit' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Marks Entry Verification & Audit Register</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Audit subject teachers' score submission progress across all active classes</p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Filter Class:</label>
                <select className="select" style={{ width: 150 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  <option value="All">All Classes</option>
                  {dynamicClasses.map(c => <option key={c} value={c}>Grade {c}</option>)}
                </select>
                <button className="btn btn-primary" style={{ gap: 6 }} onClick={handleExportAuditPDF}>
                  <Printer size={15} /> Download Audit Register (PDF)
                </button>
              </div>
            </div>
          </div>

          <div className="stat-tiles" style={{ marginBottom: 20 }}>
            <KpiCard iconComponent={<BookOpen size={20} />} label="Total Class Units" value={auditStats.totalUnits} />
            <KpiCard iconComponent={<CheckCircle2 size={20} />} label="100% Completed" value={auditStats.completedUnits} accent="#047857" />
            <KpiCard iconComponent={<Clock size={20} />} label="In Progress" value={auditStats.inProgressUnits} accent="#F59E0B" />
            <KpiCard iconComponent={<AlertTriangle size={20} />} label="Pending Entry" value={auditStats.pendingUnits} accent="#EF4444" />
          </div>

          <div className="card card-pad">
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Assigned Teacher</th>
                  <th>Progress</th>
                  <th>Entered / Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {marksAuditMatrix.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.class}</strong></td>
                    <td style={{ fontWeight: 600 }}>{m.subject}</td>
                    <td>{m.teacher}</td>
                    <td style={{ width: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 35 }}>{m.pct}%</span>
                        <div style={{ flex: 1 }}><ProgressBar value={m.pct} color={m.pct === 100 ? '#047857' : m.pct > 0 ? '#F59E0B' : '#EF4444'} /></div>
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
        </>
      )}

      {/* ── TAB 4: RESULT SLIPS & REPORT CARDS ── */}
      {activeTab === 'slips' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Official Result Slips & Report Cards Hub</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Generate and print official student result slips for terminal exams</p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select className="select" style={{ width: 150 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  <option value="All">All Classes</option>
                  {dynamicClasses.map(c => <option key={c} value={c}>Grade {c}</option>)}
                </select>
                <button className="btn btn-primary" style={{ gap: 6 }} onClick={handleExportBatchResultSlips}>
                  <Printer size={15} /> Print Batch Result Slips (PDF)
                </button>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ marginBottom: 16 }}>
              <input 
                className="input" 
                placeholder="Search student name or adm number..." 
                value={searchStudent} 
                onChange={e => setSearchStudent(e.target.value)} 
                style={{ maxWidth: 350 }}
              />
            </div>

            <table className="table">
              <thead>
                <tr><th>Adm No</th><th>Student Name</th><th>Class</th><th>Gender</th><th>Action</th></tr>
              </thead>
              <tbody>
                {activeStudentsList
                  .filter(s => selectedClass === 'All' || s.class === selectedClass)
                  .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || (s.adm && s.adm.toLowerCase().includes(searchStudent.toLowerCase())))
                  .slice(0, 50)
                  .map(s => (
                    <tr key={s.id}>
                      <td>{s.adm || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.class || '-'}</td>
                      <td>{s.gender || '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setSelectedStudentForReport(s)}>
                          <FileText size={13} /> View Result Slip
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Result Slip Modal */}
      {selectedStudentForReport && (
        <ReportCardModal
          student={selectedStudentForReport}
          students={activeStudentsList}
          subjects={SUBJECTS}
          gradeBoundaries={store.gradeBoundaries}
          examTitle="Term 1 Opening Exam"
          termName="Term 1"
          schoolSettings={store.settings}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
    </div>
  );
}
