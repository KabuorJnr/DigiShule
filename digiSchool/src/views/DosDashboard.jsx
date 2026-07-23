import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchStudents } from '../lib/api';
import { Badge, ProgressBar } from '../components/widgets';
import { SUBJECTS, expandClassesWithStreams, getDynamicClasses } from '../data/seed';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  Download, FileText, CheckCircle, Clock, ShieldCheck, Check, 
  Users, BookOpen, Award, AlertTriangle, Printer, RefreshCw, Search, Filter,
  Sparkles, Layers, ArrowUpRight, CheckCircle2, UserCheck
} from 'lucide-react';

function Stat({ label, value, color, sub, icon: IconComp, trend }) {
  return (
    <div 
      className="card card-pad" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justify: 'space-between',
        borderRadius: 12,
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {IconComp && (
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: `${color}12`, 
              display: 'flex', 
              alignItems: 'center', 
              justify: 'center' 
            }}>
              <IconComp size={16} color={color || '#64748b'} />
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
        </div>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#047857', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
            {trend}
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: color || '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</div>
        {sub && <div className="muted" style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color || '#64748b', opacity: 0.8 }} />
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

  // Search & Filters state
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('All');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('All');

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
    rawStaff.forEach(s => {
      const role = s.role || 'Unknown';
      map[role] = (map[role] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({ role, count }));
  }, [rawStaff]);

  // Teacher workload from timetables (filtered to actual profiles)
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
    
    const validNames = new Set(activeTeacherList.map(t => t.name.toLowerCase()));
    
    return Object.entries(counts)
      .filter(([name]) => validNames.has(name.toLowerCase()))
      .map(([name, periods]) => ({ name, periods, isOverload: periods > 27 }))
      .sort((a, b) => b.periods - a.periods);
  }, [timetables, activeTeacherList]);

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
          if (typeof sc === 'number') return true;
          if (sc.score !== undefined && sc.score !== '') return true;
          if (sc.average !== undefined && sc.average !== '') return true;
          if (sc.a1 !== undefined && sc.a1 !== '') return true;
          if (sc.a2 !== undefined && sc.a2 !== '') return true;
          if (sc.a3 !== undefined && sc.a3 !== '') return true;
          if (sc.a4 !== undefined && sc.a4 !== '') return true;
          return false;
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
  const totalPendingActionCount = pendingApprovalsCount + pendingPapersCount;

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      const matchSearch = !studentSearch || 
        s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
        (s.adm || s.admission_no || '').toLowerCase().includes(studentSearch.toLowerCase());
      const matchClass = studentClassFilter === 'All' || s.class === studentClassFilter;
      return matchSearch && matchClass;
    });
  }, [activeStudents, studentSearch, studentClassFilter]);

  // Filtered Staff List
  const filteredStaff = useMemo(() => {
    return rawStaff.filter(s => {
      const name = s.full_name || s.name || '';
      const email = s.email || '';
      const matchSearch = !staffSearch || 
        name.toLowerCase().includes(staffSearch.toLowerCase()) || 
        email.toLowerCase().includes(staffSearch.toLowerCase());
      const matchRole = staffRoleFilter === 'All' || s.role === staffRoleFilter;
      return matchSearch && matchRole;
    });
  }, [rawStaff, staffSearch, staffRoleFilter]);

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

  // Dynamic time greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── HEADER TOOLBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Director of Studies (DoS) Portal</h2>
            <Badge color="blue" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
              Live System
            </Badge>
          </div>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Academic oversight, exam office management, marks audit & curriculum quality control
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={fetchAllDosData} 
            disabled={loading}
            style={{ borderRadius: 8, height: 40, background: '#ffffff', border: '1px solid #cbd5e1', fontWeight: 600 }}
          >
            <RefreshCw size={15} style={{ marginRight: 6 }} className={loading ? 'spin' : ''} /> Refresh Data
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleExportTermlyReport}
            style={{ borderRadius: 8, height: 40, background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', border: 'none', fontWeight: 600, boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)' }}
          >
            <Download size={15} style={{ marginRight: 6 }} /> Export Termly Report
          </button>
        </div>
      </div>

      {/* ── EXECUTIVE HERO BANNER ── */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', 
          color: '#fff', 
          padding: '24px 28px', 
          borderRadius: 16, 
          display: 'flex', 
          justify: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24, 
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} color="#10b981" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 1 }}>{greeting}, Director of Studies</span>
          </div>
          <h3 style={{ margin: 0, fontSize: 22, color: '#ffffff', fontWeight: 800, letterSpacing: '-0.3px' }}>
            {settings?.name || 'Academic Command Center'}
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Exam Office</span> · <span>Curriculum Quality</span> · <span>Moderation</span> · <span>Syllabus Assurance</span>
          </p>
        </div>
        <div style={{ textAlign: 'right', position: 'relative', zIndex: 2 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <Clock size={14} color="#94a3b8" />
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <span style={{ 
            background: 'rgba(255, 255, 255, 0.12)', 
            color: '#34d399', 
            padding: '6px 14px', 
            borderRadius: 20, 
            fontSize: 12, 
            fontWeight: 700, 
            border: '1px solid rgba(52, 211, 153, 0.25)',
            display: 'inline-block'
          }}>
            Term 2 · 2026 Academic Year
          </span>
        </div>
        
        {/* Subtle decorative glow circle */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', filter: 'blur(30px)', pointerEvents: 'none' }} />
      </div>

      {/* ── TABS BAR WITH NOTIFICATION BADGES ── */}
      <div 
        style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 24, 
          borderBottom: '1px solid #e2e8f0', 
          paddingBottom: 4,
          flexWrap: 'wrap' 
        }}
      >
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: ShieldCheck },
          { id: 'registry', label: 'Student Registry', icon: Users, badge: activeStudents.length },
          { id: 'staff', label: 'Staff & Workload', icon: BookOpen, badge: rawStaff.length },
          { id: 'marks', label: 'Marks Audit', icon: CheckCircle, badge: `${overallMarksPct}%` },
          { id: 'moderation', label: 'Approvals & Moderation', icon: FileText, badge: totalPendingActionCount, alert: totalPendingActionCount > 0 },
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
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: isActive ? '3px solid #047857' : '3px solid transparent',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#047857' : '#64748b',
                fontWeight: isActive ? 700 : 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.03)' : 'none'
              }}
            >
              <t.icon size={16} color={isActive ? '#047857' : '#64748b'} /> 
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span 
                  style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    padding: '2px 7px', 
                    borderRadius: 12, 
                    background: t.alert ? '#ef4444' : isActive ? '#dcfce7' : '#f1f5f9',
                    color: t.alert ? '#ffffff' : isActive ? '#047857' : '#475569',
                    marginLeft: 2
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <RefreshCw size={28} color="#047857" className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Loading Live Academic Registry Data...</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Syncing student scores, staff workloads, and moderation queues</div>
        </div>
      )}

      {/* ── TAB 1: DASHBOARD OVERVIEW ── */}
      {!loading && activeTab === 'overview' && (
        <>
          {/* Primary KPI Grid */}
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
            <Stat icon={Users} label="Total Active Students" value={activeStudents.length} sub={`${genderDist.male} Male / ${genderDist.female} Female`} color="#047857" trend="Active Registry" />
            <Stat icon={BookOpen} label="Teaching Staff" value={activeTeacherList.length} sub={`${activeTeachers} Active Faculty`} color="#0EA5E9" trend="Assigned" />
            <Stat icon={Award} label="Classes / Streams" value={`${settings?.classes?.length || 1} / ${dynamicClasses.length}`} sub={`${classEnrollment.length} Active Streams`} color="#107C10" />
            <Stat icon={FileText} label="Exam Schedules" value={examSchedules.length} sub="Published Timetables" color="#6366f1" />
          </div>

          {/* Secondary KPI Grid */}
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 24 }}>
            <Stat icon={CheckCircle} label="Marks Completion" value={`${overallMarksPct}%`} sub="Overall Entry Progress" color={overallMarksPct >= 80 ? '#047857' : '#F59E0B'} />
            <Stat icon={AlertTriangle} label="Pending Approvals" value={pendingApprovalsCount} sub="Schemes & Lesson Plans" color={pendingApprovalsCount > 0 ? '#F59E0B' : '#047857'} />
            <Stat icon={FileText} label="Papers to Moderate" value={pendingPapersCount} sub="Exam Papers Pending Review" color={pendingPapersCount > 0 ? '#F59E0B' : '#047857'} />
            <Stat icon={AlertTriangle} label="Overloaded Teachers" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 Periods / Week" color="#EF4444" />
          </div>

          {/* Quick Actions Hub */}
          <div className="card card-pad" style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#047857" />
                <h3 className="section-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>DOS Quick Management Hub</h3>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>Instant academic tools & shortcuts</span>
            </div>
            
            <div className="grid grid-4" style={{ gap: 12 }}>
              {[
                { label: 'Merit Lists & Analysis', icon: Award, route: 'academics_dashboard', desc: 'Rankings & means' },
                { label: 'Gradebook & Entry', icon: BookOpen, route: 'gradebook', desc: 'Marks entry portal' },
                { label: 'Exam Schedules', icon: FileText, route: 'exams', desc: 'Manage dates & rooms' },
                { label: 'Class Registers', icon: Users, route: 'registrar', desc: 'Full student lists' },
                { label: 'School Timetable', icon: Clock, route: 'timetable', desc: 'Master schedule' },
                { label: 'Teaching Faculty', icon: UserCheck, route: 'teacher_management', desc: 'Workload & staff' },
                { label: 'Approvals Queue', icon: ShieldCheck, tab: 'moderation', desc: `${totalPendingActionCount} Pending items` },
                { label: 'Marks Audit Matrix', icon: CheckCircle2, tab: 'marks', desc: `${overallMarksPct}% Progress` },
              ].map((act, idx) => (
                <div
                  key={idx}
                  onClick={() => act.route ? navigate(act.route) : setActiveTab(act.tab)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#047857';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 120, 87, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <act.icon size={17} color="#0284c7" />
                    </div>
                    <ArrowUpRight size={15} color="#94a3b8" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{act.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{act.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class Enrollment & Gender Visualizer */}
          <div className="grid grid-2" style={{ gap: 24 }}>
            {/* Live Enrollment */}
            <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 className="section-title" style={{ fontSize: 15, margin: 0, fontWeight: 700 }}>Class Enrollment Breakdown</h3>
                <span className="muted" style={{ fontSize: 12 }}>{classEnrollment.length} Active Streams</span>
              </div>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Class / Stream</th>
                    <th style={{ textAlign: 'right' }}>Students</th>
                    <th style={{ width: 160 }}>Share of School</th>
                  </tr>
                </thead>
                <tbody>
                  {classEnrollment.map(c => {
                    const share = Math.round((c.count / (activeStudents.length || 1)) * 100);
                    return (
                      <tr key={c.class}>
                        <td><strong>{c.class}</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.count}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}><ProgressBar value={share} color="#047857" /></div>
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 28 }}>{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {classEnrollment.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No students in registry.</div>}
            </div>

            {/* Gender Distribution */}
            <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Gender & Student Demographics</h3>
                
                <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px', background: '#eff6ff', borderRadius: 10, border: '1px solid #dbeafe' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{genderDist.male}</div>
                    <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 700, marginTop: 6 }}>Male Students</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{genderDist.total > 0 ? Math.round((genderDist.male / genderDist.total) * 100) : 0}% of total</div>
                  </div>

                  <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px', background: '#fdf2f8', borderRadius: 10, border: '1px solid #fce7f3' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#db2777', lineHeight: 1 }}>{genderDist.female}</div>
                    <div style={{ fontSize: 12, color: '#9d174d', fontWeight: 700, marginTop: 6 }}>Female Students</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{genderDist.total > 0 ? Math.round((genderDist.female / genderDist.total) * 100) : 0}% of total</div>
                  </div>

                  <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#047857', lineHeight: 1 }}>{genderDist.total}</div>
                    <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700, marginTop: 6 }}>Total Enrolled</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>100% Active</div>
                  </div>
                </div>

                {genderDist.total > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#475569' }}>
                      <span>Gender Ratio Progress</span>
                      <span>{genderDist.male} M : {genderDist.female} F</span>
                    </div>
                    <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                      <div style={{ width: `${(genderDist.male / genderDist.total) * 100}%`, background: '#2563eb' }} title={`Male: ${genderDist.male}`} />
                      <div style={{ width: `${(genderDist.female / genderDist.total) * 100}%`, background: '#db2777' }} title={`Female: ${genderDist.female}`} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>Managed via Live Registry</span>
                <button className="btn btn-sm" onClick={() => navigate('registrar')} style={{ fontSize: 12 }}>Open Registrar Hub</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: STUDENT REGISTRY ── */}
      {!loading && activeTab === 'registry' && (
        <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Live Student Registry</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Showing {filteredStudents.length} of {activeStudents.length} active students</p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 12 }} />
                <input 
                  type="text" 
                  placeholder="Search student or adm..." 
                  value={studentSearch} 
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 32, height: 38, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              {/* Class Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} color="#64748b" />
                <select 
                  value={studentClassFilter} 
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 13 }}
                >
                  <option value="All">All Classes & Streams</option>
                  {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <button className="btn btn-primary" onClick={() => navigate('registrar')} style={{ height: 38, borderRadius: 8 }}>
                <Users size={15} style={{ marginRight: 6 }} /> Open Full Registrar
              </button>
            </div>
          </div>

          <div className="scroll-x">
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Adm No</th>
                  <th>Student Name</th>
                  <th>Gender</th>
                  <th>Class / Stream</th>
                  <th>Guardian</th>
                  <th>Contact Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.slice(0, 100).map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td>{idx + 1}</td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>{s.adm || s.admission_no || '-'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 30, 
                          height: 30, 
                          borderRadius: '50%', 
                          background: s.gender === 'Female' ? '#fce7f3' : '#e0f2fe',
                          color: s.gender === 'Female' ? '#db2777' : '#0284c7',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center'
                        }}>
                          {(s.name || 'S').charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</span>
                      </div>
                    </td>
                    <td>{s.gender || '-'}</td>
                    <td><strong>{s.class || '-'}</strong></td>
                    <td className="muted">{s.guardianName || s.guardian_name || '-'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.guardianPhone || s.guardian_phone || '-'}</td>
                    <td><Badge color={s.status === 'Active' ? 'green' : 'amber'}>{s.status || 'Active'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredStudents.length > 100 && (
            <div className="muted" style={{ textAlign: 'center', padding: 14, background: '#f8fafc', borderRadius: 8, marginTop: 12 }}>
              Showing first 100 of {filteredStudents.length} students. Use filters or open full Registrar for all.
            </div>
          )}
          {filteredStudents.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: 40 }}>
              No matching students found in active registry.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: STAFF & WORKLOAD ── */}
      {!loading && activeTab === 'staff' && (
        <>
          {/* Staff Stats */}
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 20 }}>
            <Stat icon={Users} label="Total Staff Members" value={rawStaff.length} sub="Portal User Accounts" color="#0EA5E9" />
            <Stat icon={BookOpen} label="Subject Teachers" value={rawStaff.filter(s => s.role === 'teacher').length} sub="Active Faculty" color="#047857" />
            <Stat icon={AlertTriangle} label="Overloaded Staff" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 Periods / Week" color="#EF4444" />
            <Stat icon={Award} label="Staff Roles" value={staffByRole.length} sub="Distinct Administrative Roles" color="#6366f1" />
          </div>

          {/* Controls Bar for Staff */}
          <div className="card card-pad" style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Staff & Faculty Directory</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Live records from database profiles</p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 12 }} />
                  <input 
                    type="text" 
                    placeholder="Search staff name or email..." 
                    value={staffSearch} 
                    onChange={(e) => setStaffSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: 32, height: 38, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>

                <select 
                  value={staffRoleFilter} 
                  onChange={(e) => setStaffRoleFilter(e.target.value)}
                  style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 13 }}
                >
                  <option value="All">All Staff Roles</option>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
            {/* Staff Table */}
            <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Staff Profiles</h3>
              <div className="scroll-x">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Staff Name</th>
                      <th>Role</th>
                      <th>Subject / Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s, idx) => (
                      <tr key={s.id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.full_name || s.name || '-'}</td>
                        <td><Badge color="blue">{roleLabels[s.role] || s.role}</Badge></td>
                        <td>{s.subject || s.dept || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredStaff.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No staff records found matching filter.</div>}
            </div>

            {/* Workload Table */}
            <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Teacher Workload (from Timetable)</h3>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Teacher Name</th>
                    <th>Periods / Week</th>
                    <th>Workload Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherWorkload.map((tw, idx) => (
                    <tr key={idx} style={{ background: tw.isOverload ? '#fef2f2' : 'transparent' }}>
                      <td><strong>{tw.name}</strong></td>
                      <td style={{ fontWeight: 700 }}>{tw.periods} Periods</td>
                      <td>
                        {tw.isOverload ? (
                          <Badge color="red" style={{ background: '#fee2e2', color: '#991b1b' }}>Overload (&gt;27)</Badge>
                        ) : (
                          <Badge color="green">Normal Workload</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {teacherWorkload.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                        No timetable workloads mapped to registered staff profiles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Breakdown Chips */}
          <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 className="section-title" style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Staff Role Distribution</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {staffByRole.map(r => (
                <div 
                  key={r.role} 
                  style={{ 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0',
                    borderRadius: 10, 
                    padding: '14px 20px', 
                    textAlign: 'center', 
                    minWidth: 130 
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{r.count}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 4 }}>{roleLabels[r.role] || r.role}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TAB 4: MARKS AUDIT ── */}
      {!loading && activeTab === 'marks' && (
        <>
          <div className="grid grid-4" style={{ gap: 16, marginBottom: 20 }}>
            <Stat icon={CheckCircle} label="Overall Completion" value={`${overallMarksPct}%`} color={overallMarksPct >= 80 ? '#047857' : '#F59E0B'} />
            <Stat icon={BookOpen} label="Classes Audited" value={marksAudit.length} color="#0EA5E9" />
            <Stat icon={Award} label="Subjects" value={SUBJECTS.length} sub="Curriculum Subjects" color="#6366f1" />
            <Stat icon={Users} label="Total Students" value={activeStudents.length} color="#047857" />
          </div>

          <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 className="section-title" style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>Marks Entry Progress by Class (Live)</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Audits all subject entries across all class streams</p>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('gradebook')}>
                Open Gradebook Portal
              </button>
            </div>

            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Class / Stream</th>
                  <th>Students</th>
                  <th>Marks Entered</th>
                  <th>Total Possible</th>
                  <th>Completion Progress</th>
                  <th>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {marksAudit.map(m => (
                  <tr key={m.class}>
                    <td><strong>{m.class}</strong></td>
                    <td>{m.students}</td>
                    <td style={{ fontWeight: 700, color: '#047857' }}>{m.entered}</td>
                    <td className="muted">{m.total}</td>
                    <td style={{ width: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36 }}>{m.pct}%</span>
                        <div style={{ flex: 1 }}>
                          <ProgressBar value={m.pct} color={m.pct === 100 ? '#047857' : m.pct > 0 ? '#F59E0B' : '#EF4444'} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge color={m.pct === 100 ? 'green' : m.pct > 0 ? 'amber' : 'red'}>
                        {m.pct === 100 ? '100% Complete' : m.pct > 0 ? 'In Progress' : 'Pending Entry'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {marksAudit.length === 0 && (
              <div className="muted" style={{ textAlign: 'center', padding: 30 }}>
                No class data available for marks audit.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB 5: APPROVALS & MODERATION ── */}
      {!loading && activeTab === 'moderation' && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* Scheme & Lesson Plan Approvals */}
          <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <ShieldCheck size={18} color="#047857"/> Schemes of Work & Lesson Plans
              </h3>
              <Badge color={pendingApprovalsCount > 0 ? 'amber' : 'green'}>
                {pendingApprovalsCount} Pending
              </Badge>
            </div>

            <div className="list-flex" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {approvals.filter(a => a.status === 'pending').map(a => (
                <div 
                  key={a.id} 
                  style={{ 
                    display: 'flex', 
                    justify: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 14px', 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    border: '1px solid #e2e8f0' 
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{a.item_type === 'scheme_of_work' ? 'Scheme of Work' : 'Lesson Plan'}</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Submitted by: {a.profiles?.full_name || 'Teacher'}</div>
                  </div>
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => handleApprove(a.id, 'approval_queue')}
                    style={{ borderRadius: 6 }}
                  >
                    <Check size={14} style={{ marginRight: 4 }} /> Approve Document
                  </button>
                </div>
              ))}
              {approvals.filter(a => a.status === 'pending').length === 0 && (
                <div className="muted" style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8 }}>
                  No pending schemes or lesson plans awaiting approval.
                </div>
              )}
            </div>
          </div>

          {/* Exam Paper Moderation */}
          <div className="card card-pad" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <FileText size={18} color="#047857"/> Exam Paper Moderation Queue
              </h3>
              <Badge color={pendingPapersCount > 0 ? 'amber' : 'green'}>
                {pendingPapersCount} Pending
              </Badge>
            </div>

            <div className="list-flex" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {examPapers.filter(p => p.moderation_status === 'pending').map(p => (
                <div 
                  key={p.id} 
                  style={{ 
                    display: 'flex', 
                    justify: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 14px', 
                    background: '#f8fafc', 
                    borderRadius: 8, 
                    border: '1px solid #e2e8f0' 
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.subject} ({p.class})</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Paper Set by: {p.profiles?.full_name || 'Unknown'}</div>
                  </div>
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => handleApprove(p.id, 'exam_papers')}
                    style={{ borderRadius: 6 }}
                  >
                    <Check size={14} style={{ marginRight: 4 }} /> Approve Paper
                  </button>
                </div>
              ))}
              {examPapers.filter(p => p.moderation_status === 'pending').length === 0 && (
                <div className="muted" style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8 }}>
                  No pending exam papers in moderation queue.
                </div>
              )}
            </div>
          </div>

          {/* Syllabus Coverage Tracker */}
          <div className="card card-pad" style={{ gridColumn: '1 / -1', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 className="section-title" style={{ fontSize: 16, marginBottom: 16, fontWeight: 700 }}>Syllabus & Curriculum Coverage Tracker</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {coverage.map(c => {
                const pct = Math.round((c.strands_covered / (c.strands_total || 1)) * 100);
                return (
                  <div key={c.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                      <strong>{c.subject} ({c.class})</strong>
                      <span style={{ fontWeight: 700, color: pct >= 80 ? '#047857' : '#f59e0b' }}>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} color={pct >= 80 ? '#047857' : pct >= 50 ? '#F59E0B' : '#EF4444'} />
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Teacher: {c.profiles?.full_name || 'Unknown'}</div>
                  </div>
                );
              })}
              {coverage.length === 0 && (
                <div className="muted" style={{ padding: 24, textAlign: 'center', gridColumn: '1 / -1' }}>
                  No syllabus coverage snapshots generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
