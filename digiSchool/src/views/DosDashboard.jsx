import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchStudents } from '../lib/api';
import { Badge, ProgressBar } from '../components/widgets';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../data/seed';
import { computeStudentReport } from '../utils/grading';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, CheckCircle, Clock, Eye, ShieldCheck, Check, X, Users, BookOpen, Award, AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';

function Stat({ label, value, color, sub, icon: IconComp }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {IconComp && <IconComp size={14} color={color || '#64748b'} />}
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function DosDashboard({ store, user }) {
  const { navigate, notify, settings, teachers = [], examSchedules = [], timetables = {} } = store;
  
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [examPapers, setExamPapers] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const currentSchoolId = user?.school_id || store?.schoolId || store?.settings?.id;

  const fetchAllDosData = async () => {
    setLoading(true);
    
    // 1. Fetch live students using api helper
    try {
      const { data: studentData } = await fetchStudents(0, 2000, { activeOnly: true });
      if (studentData) {
        setStudents(studentData.filter(s => s.status === 'Active'));
      } else {
        setStudents([]);
      }
    } catch (e) {
      console.warn('DoS student fetch error:', e);
    }

    // 2. Fetch live staff/teachers from profiles
    try {
      let staffQuery = supabase.from('profiles').select('*');
      if (currentSchoolId) staffQuery = staffQuery.eq('school_id', currentSchoolId);
      staffQuery = staffQuery.in('role', ['teacher', 'dos', 'deputy_academic', 'principal', 'deputy_admin', 'registrar', 'finance', 'accountant', 'librarian', 'clinic']);
      const { data: staffData } = await staffQuery;
      if (staffData && staffData.length > 0) setStaff(staffData);
    } catch (e) {
      console.warn('DoS staff fetch error:', e);
    }

    // 3. Fetch approvals
    try {
      let appQuery = supabase.from('approval_queue').select('*');
      if (currentSchoolId) appQuery = appQuery.eq('school_id', currentSchoolId);
      const { data: appData } = await appQuery;
      if (appData) setApprovals(appData);
    } catch (e) {
      console.warn('DoS approvals fetch error:', e);
    }

    // 4. Fetch exam papers
    try {
      let paperQuery = supabase.from('exam_papers').select('*');
      if (currentSchoolId) paperQuery = paperQuery.eq('school_id', currentSchoolId);
      const { data: paperData } = await paperQuery;
      if (paperData) setExamPapers(paperData);
    } catch (e) {
      console.warn('DoS exam papers fetch error:', e);
    }

    // 5. Fetch syllabus coverage
    try {
      let covQuery = supabase.from('syllabus_coverage_snapshots').select('*');
      if (currentSchoolId) covQuery = covQuery.eq('school_id', currentSchoolId);
      const { data: covData } = await covQuery;
      if (covData) setCoverage(covData);
    } catch (e) {
      console.warn('DoS coverage fetch error:', e);
    }

    // 6. Fetch lesson observations
    try {
      let obsQuery = supabase.from('lesson_observations').select('*');
      if (currentSchoolId) obsQuery = obsQuery.eq('school_id', currentSchoolId);
      const { data: obsData } = await obsQuery;
      if (obsData) setObservations(obsData);
    } catch (e) {
      console.warn('DoS observations fetch error:', e);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllDosData();
  }, [currentSchoolId]);



  const rawStudents = useMemo(() => {
    return students || [];
  }, [students]);

  const activeStudents = useMemo(() => 
    rawStudents.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending'),
    [rawStudents]
  );

  const rawStaff = useMemo(() => {
    if (store?.teachers && Array.isArray(store.teachers) && store.teachers.length > 0) return store.teachers;
    return staff || [];
  }, [store?.teachers, staff]);

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(settings?.classes || []);
    const dynamic = getDynamicClasses(activeStudents);
    return [...new Set([...saved, ...dynamic])];
  }, [activeStudents, settings]);

  const activeTeacherList = useMemo(() => {
    const list = teachers.length > 0 ? teachers : rawStaff;
    return list.filter(t => t.status !== 'Inactive');
  }, [teachers, rawStaff]);
  const activeTeachers = useMemo(() => activeTeacherList.filter(t => t.status === 'Active').length, [activeTeacherList]);

  // Class enrollment breakdown
  const classEnrollment = useMemo(() => {
    const map = {};
    activeStudents.forEach(s => {
      const cls = s.class || 'Unassigned';
      map[cls] = (map[cls] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([cls, count]) => ({ class: cls, count }));
  }, [activeStudents]);

  // Gender distribution
  const genderDist = useMemo(() => {
    const m = activeStudents.filter(s => s.gender === 'Male').length;
    const f = activeStudents.filter(s => s.gender === 'Female').length;
    return { male: m, female: f, total: activeStudents.length };
  }, [activeStudents]);

  // Staff by role
  const staffByRole = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      const role = s.role || 'Unknown';
      map[role] = (map[role] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({ role, count }));
  }, [staff]);

  // Teacher workload from timetables
  const teacherWorkload = useMemo(() => {
    const counts = {};
    Object.values(timetables).forEach(tt => {
      if (!tt.grid) return;
      tt.grid.forEach(row => {
        row.forEach(cell => {
          if (cell && cell.type === 'lesson' && cell.teacher) {
            counts[cell.teacher] = (counts[cell.teacher] || 0) + 1;
          }
        });
      });
    });
    return Object.entries(counts)
      .map(([name, periods]) => ({ name, periods, isOverload: periods > 27 }))
      .sort((a, b) => b.periods - a.periods);
  }, [timetables]);

  // Marks entry audit per class/subject
  const marksAudit = useMemo(() => {
    const results = [];
    dynamicClasses.forEach(cls => {
      const studentsInClass = activeStudents.filter(s => s.class === cls);
      if (studentsInClass.length === 0) return;
      let classEntered = 0;
      let classTotal = 0;
      SUBJECTS.forEach(sub => {
        const entered = studentsInClass.filter(s => {
          const sc = s.scores?.[sub];
          if (!sc) return false;
          if (typeof sc === 'number') return sc > 0;
          return (Number(sc.a1) || 0) + (Number(sc.a2) || 0) + (Number(sc.a3) || 0) + (Number(sc.a4) || 0) > 0;
        }).length;
        classEntered += entered;
        classTotal += studentsInClass.length;
      });
      const pct = classTotal > 0 ? Math.round((classEntered / classTotal) * 100) : 0;
      results.push({ class: cls, entered: classEntered, total: classTotal, pct, students: studentsInClass.length });
    });
    return results;
  }, [dynamicClasses, activeStudents]);

  const overallMarksPct = useMemo(() => {
    const totalEntered = marksAudit.reduce((a, b) => a + b.entered, 0);
    const totalPossible = marksAudit.reduce((a, b) => a + b.total, 0);
    return totalPossible > 0 ? Math.round((totalEntered / totalPossible) * 100) : 0;
  }, [marksAudit]);

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;
  const pendingPapersCount = examPapers.filter(p => p.moderation_status === 'pending').length;

  // ── HANDLERS ──
  const handleApprove = async (id, table) => {
    try {
      const { error } = await supabase.from(table).update(
        table === 'approval_queue' 
          ? { status: 'approved', reviewer_id: user.id, reviewed_at: new Date().toISOString() } 
          : { moderation_status: 'approved', moderated_by: user.id }
      ).eq('id', id);
      if (error) throw error;
      notify('Approved successfully');
      fetchAllDosData();
    } catch (err) {
      notify('Failed to approve', 'error');
    }
  };

  const handleExportTermlyReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Director of Studies (DoS) Termly Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`School: ${settings?.name || 'School'}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38);
    doc.text(`Total Students: ${activeStudents.length} | Teachers: ${activeTeacherList.length} | Classes: ${dynamicClasses.length}`, 14, 46);

    // Enrollment table
    doc.setFontSize(14);
    doc.text('Class Enrollment Summary', 14, 58);
    doc.autoTable({
      startY: 63,
      head: [['Class', 'Students']],
      body: classEnrollment.map(c => [c.class, c.count]),
    });

    let finalY = doc.lastAutoTable?.finalY || 80;

    // Marks completion
    doc.setFontSize(14);
    doc.text('Marks Entry Completion', 14, finalY + 15);
    doc.autoTable({
      startY: finalY + 20,
      head: [['Class', 'Students', 'Marks Entered', 'Total Possible', 'Completion %']],
      body: marksAudit.map(m => [m.class, m.students, m.entered, m.total, `${m.pct}%`]),
    });

    finalY = doc.lastAutoTable?.finalY || finalY + 40;

    // Teacher workload
    doc.setFontSize(14);
    doc.text('Teacher Workload', 14, finalY + 15);
    doc.autoTable({
      startY: finalY + 20,
      head: [['Teacher', 'Periods/Week', 'Status']],
      body: teacherWorkload.map(t => [t.name, t.periods, t.isOverload ? 'OVERLOADED' : 'Normal']),
    });

    doc.save('DoS_Termly_Report.pdf');
    notify('DoS Termly Report exported as PDF');
  };

  const roleLabels = {
    teacher: 'Teacher', dos: 'Director of Studies', deputy_academic: 'Deputy Academics',
    principal: 'Principal', deputy_admin: 'Deputy Admin', registrar: 'Registrar',
    finance: 'Bursar', accountant: 'Accountant', librarian: 'Librarian', clinic: 'Clinic/Nurse'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Director of Studies (DoS) Portal</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Live registry data, exam office, marks audit & curriculum management</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={fetchAllDosData} disabled={loading}>
            <RefreshCw size={15} style={{ marginRight: 6 }} className={loading ? 'spin' : ''} /> Refresh Data
          </button>
          <button className="btn btn-primary" onClick={handleExportTermlyReport}>
            <Download size={15} style={{ marginRight: 6 }} /> Export Termly Report
          </button>
        </div>
      </div>

      {/* Office Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '18px 24px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 800 }}>Director of Studies Office</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Exam Office · Curriculum · Moderation · Quality Assurance
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <Badge color="green" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'transparent' }}>Term 2 · 2026</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: ShieldCheck },
          { id: 'registry', label: 'Student Registry', icon: Users },
          { id: 'staff', label: 'Staff & Workload', icon: BookOpen },
          { id: 'marks', label: 'Marks Audit', icon: CheckCircle },
          { id: 'moderation', label: 'Approvals & Moderation', icon: FileText },
        ].map(t => (
          <button key={t.id} className={`tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <t.icon size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} /> {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Loading live data from registry...</div>}

      {/* ── TAB: DASHBOARD OVERVIEW ── */}
      {!loading && activeTab === 'overview' && (
        <>
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
            <Stat icon={Users} label="Total Students" value={activeStudents.length} sub={`${genderDist.male}M / ${genderDist.female}F`} color="#047857" />
            <Stat icon={BookOpen} label="Teaching Staff" value={activeTeacherList.length} sub={`${activeTeachers} active`} color="#0EA5E9" />
            <Stat icon={Award} label="Classes" value={dynamicClasses.length} sub={`${classEnrollment.length} with students`} color="#107C10" />
            <Stat icon={FileText} label="Exam Schedules" value={examSchedules.length} sub="Published exams" color="#6366f1" />
          </div>

          <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
            <Stat icon={CheckCircle} label="Marks Completion" value={`${overallMarksPct}%`} sub="Overall entry progress" color={overallMarksPct >= 80 ? '#047857' : '#F59E0B'} />
            <Stat icon={AlertTriangle} label="Pending Approvals" value={pendingApprovalsCount} sub="Schemes & lesson plans" color={pendingApprovalsCount > 0 ? '#F59E0B' : '#047857'} />
            <Stat icon={FileText} label="Papers to Moderate" value={pendingPapersCount} sub="Exam papers pending" color={pendingPapersCount > 0 ? '#F59E0B' : '#047857'} />
            <Stat icon={AlertTriangle} label="Overloaded Teachers" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 periods/week" color="#EF4444" />
          </div>

          {/* Quick Actions */}
          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <h3 className="section-title">Quick Actions</h3>
            <div className="grid grid-4" style={{ gap: 10 }}>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('exams')}>
                <FileText size={16} style={{ marginRight: 6 }} /> Exam Schedules
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('gradebook')}>
                <BookOpen size={16} style={{ marginRight: 6 }} /> Gradebook & Entry
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('academics_dashboard')}>
                <Award size={16} style={{ marginRight: 6 }} /> Merit Lists & Analysis
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('registrar')}>
                <Users size={16} style={{ marginRight: 6 }} /> Class Lists
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('timetable')}>
                <Clock size={16} style={{ marginRight: 6 }} /> Timetable
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => navigate('teacher_management')}>
                <Users size={16} style={{ marginRight: 6 }} /> Teaching Staff
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => setActiveTab('moderation')}>
                <ShieldCheck size={16} style={{ marginRight: 6 }} /> Approvals Queue
              </button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start' }} onClick={() => setActiveTab('marks')}>
                <CheckCircle size={16} style={{ marginRight: 6 }} /> Marks Audit
              </button>
            </div>
          </div>

          {/* Class Enrollment Preview */}
          <div className="grid grid-2" style={{ gap: 24 }}>
            <div className="card card-pad">
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Class Enrollment (Live)</h3>
              <table className="table">
                <thead><tr><th>Class</th><th>Students</th><th>Distribution</th></tr></thead>
                <tbody>
                  {classEnrollment.map(c => (
                    <tr key={c.class}>
                      <td><strong>{c.class}</strong></td>
                      <td style={{ fontWeight: 700 }}>{c.count}</td>
                      <td style={{ width: 160 }}><ProgressBar value={Math.round((c.count / (activeStudents.length || 1)) * 100)} color="#047857" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {classEnrollment.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No students in registry.</div>}
            </div>

            <div className="card card-pad">
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Gender Distribution</h3>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#eff6ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{genderDist.male}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Male</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#fdf2f8', borderRadius: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#db2777' }}>{genderDist.female}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Female</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#047857' }}>{genderDist.total}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total</div>
                </div>
              </div>
              {genderDist.total > 0 && (
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(genderDist.male / genderDist.total) * 100}%`, background: '#2563eb' }}></div>
                  <div style={{ width: `${(genderDist.female / genderDist.total) * 100}%`, background: '#db2777' }}></div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: STUDENT REGISTRY ── */}
      {!loading && activeTab === 'registry' && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Live Student Registry ({activeStudents.length} active)</h3>
            <button className="btn" onClick={() => navigate('registrar')}><Users size={15} style={{ marginRight: 6 }} /> Open Full Registry</button>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>#</th><th>Adm No</th><th>Student Name</th><th>Gender</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {activeStudents.slice(0, 100).map((s, idx) => (
                  <tr key={s.id}>
                    <td>{idx + 1}</td>
                    <td>{s.adm || s.admission_no || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.gender || '-'}</td>
                    <td>{s.class || '-'}</td>
                    <td className="muted">{s.guardianName || s.guardian_name || '-'}</td>
                    <td className="muted">{s.guardianPhone || s.guardian_phone || '-'}</td>
                    <td><Badge color={s.status === 'Active' ? 'green' : 'amber'}>{s.status || 'Active'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activeStudents.length > 100 && <div className="muted" style={{ textAlign: 'center', padding: 12 }}>Showing first 100 of {activeStudents.length} students. Open full registry for all.</div>}
          {activeStudents.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 40 }}>No students found in registry.</div>}
        </div>
      )}

      {/* ── TAB: STAFF & WORKLOAD ── */}
      {!loading && activeTab === 'staff' && (
        <>
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 20 }}>
            <Stat icon={Users} label="Total Staff" value={staff.length} sub="All portal users" color="#0EA5E9" />
            <Stat icon={BookOpen} label="Teachers" value={staff.filter(s => s.role === 'teacher').length} sub="Subject teachers" color="#047857" />
            <Stat icon={AlertTriangle} label="Overloaded" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 periods" color="#EF4444" />
            <Stat icon={Award} label="Staff Roles" value={staffByRole.length} sub="Distinct roles" color="#6366f1" />
          </div>

          <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
            <div className="card card-pad">
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Staff Directory (Live from Database)</h3>
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th><th>Subject/Dept</th></tr></thead>
                <tbody>
                  {staff.map((s, idx) => (
                    <tr key={s.id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{s.full_name || s.name || '-'}</td>
                      <td><Badge color="blue">{roleLabels[s.role] || s.role}</Badge></td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.email || '-'}</td>
                      <td>{s.subject || s.dept || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staff.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No staff records found.</div>}
            </div>

            <div className="card card-pad">
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Teacher Workload (from Timetable)</h3>
              <table className="table">
                <thead><tr><th>Teacher</th><th>Periods/Week</th><th>Status</th></tr></thead>
                <tbody>
                  {teacherWorkload.map((tw, idx) => (
                    <tr key={idx} style={{ background: tw.isOverload ? '#fef2f2' : 'inherit' }}>
                      <td><strong>{tw.name}</strong></td>
                      <td>{tw.periods}</td>
                      <td>{tw.isOverload ? <Badge color="red">Overload</Badge> : <Badge color="green">Normal</Badge>}</td>
                    </tr>
                  ))}
                  {teacherWorkload.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center' }}>No timetable data available.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Staff Distribution by Role</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {staffByRole.map(r => (
                <div key={r.role} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 20px', textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{r.count}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{roleLabels[r.role] || r.role}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: MARKS AUDIT ── */}
      {!loading && activeTab === 'marks' && (
        <>
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 20 }}>
            <Stat icon={CheckCircle} label="Overall Completion" value={`${overallMarksPct}%`} color={overallMarksPct >= 80 ? '#047857' : '#F59E0B'} />
            <Stat icon={BookOpen} label="Classes Tracked" value={marksAudit.length} color="#0EA5E9" />
            <Stat icon={Award} label="Subjects" value={SUBJECTS.length} sub="Active curriculum" color="#6366f1" />
            <Stat icon={Users} label="Total Students" value={activeStudents.length} color="#047857" />
          </div>

          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Marks Entry Progress by Class (Live)</h3>
            <table className="table">
              <thead><tr><th>Class</th><th>Students</th><th>Marks Entered</th><th>Total Possible</th><th>Completion</th><th>Status</th></tr></thead>
              <tbody>
                {marksAudit.map(m => (
                  <tr key={m.class}>
                    <td><strong>{m.class}</strong></td>
                    <td>{m.students}</td>
                    <td style={{ fontWeight: 600 }}>{m.entered}</td>
                    <td className="muted">{m.total}</td>
                    <td style={{ width: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 35 }}>{m.pct}%</span>
                        <div style={{ flex: 1 }}><ProgressBar value={m.pct} color={m.pct === 100 ? '#047857' : m.pct > 0 ? '#F59E0B' : '#EF4444'} /></div>
                      </div>
                    </td>
                    <td><Badge color={m.pct === 100 ? 'green' : m.pct > 0 ? 'amber' : 'red'}>{m.pct === 100 ? 'Complete' : m.pct > 0 ? 'In Progress' : 'Pending'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {marksAudit.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 30 }}>No class data available for marks audit.</div>}
          </div>
        </>
      )}

      {/* ── TAB: APPROVALS & MODERATION ── */}
      {!loading && activeTab === 'moderation' && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#047857"/> Scheme & Lesson Approvals
            </h3>
            <div className="list-flex">
              {approvals.filter(a => a.status === 'pending').map(a => (
                <div key={a.id} className="rank-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{a.item_type === 'scheme_of_work' ? 'Scheme of Work' : 'Lesson Plan'}</span>
                    <div className="muted" style={{ fontSize: 12 }}>{a.profiles?.full_name || 'Teacher'}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleApprove(a.id, 'approval_queue')}>
                    <Check size={14}/> Approve
                  </button>
                </div>
              ))}
              {approvals.filter(a => a.status === 'pending').length === 0 && <span className="muted">No pending approvals.</span>}
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="#047857"/> Exam Paper Moderation
            </h3>
            <div className="list-flex">
              {examPapers.filter(p => p.moderation_status === 'pending').map(p => (
                <div key={p.id} className="rank-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{p.subject} - {p.class}</span>
                    <div className="muted" style={{ fontSize: 12 }}>Set by: {p.profiles?.full_name || 'Unknown'}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleApprove(p.id, 'exam_papers')}>
                    <Check size={14}/> Moderate
                  </button>
                </div>
              ))}
              {examPapers.filter(p => p.moderation_status === 'pending').length === 0 && <span className="muted">No pending exam papers.</span>}
            </div>
          </div>

          <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Syllabus Coverage Tracker</h3>
            <div className="list-flex">
              {coverage.map(c => {
                const pct = Math.round((c.strands_covered / (c.strands_total || 1)) * 100);
                return (
                  <div key={c.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <strong>{c.subject} ({c.class})</strong>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} color={pct >= 80 ? '#047857' : pct >= 50 ? '#F59E0B' : '#EF4444'} />
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Teacher: {c.profiles?.full_name || 'Unknown'}</div>
                  </div>
                );
              })}
              {coverage.length === 0 && <div className="muted" style={{ padding: 12, textAlign: 'center' }}>No coverage snapshots generated yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
