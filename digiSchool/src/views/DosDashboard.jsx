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
  Layers, ArrowUpRight, CheckCircle2, UserCheck, ChevronRight
} from 'lucide-react';

// Corporate Dark Emerald Stat Card
function Stat({ label, value, color, sub, icon: IconComp, badge }) {
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

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {value}
        </div>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: `${accent}14`, padding: '2px 8px', borderRadius: 4 }}>
            {badge}
          </span>
        )}
      </div>

      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
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

  // Search & Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('All');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('All');

  const currentSchoolId = user?.school_id || store?.schoolId || store?.settings?.id;

  const fetchAllDosData = async () => {
    setLoading(true);
    
    try {
      const { data: studentData } = await fetchStudents(0, 2000, { activeOnly: true });
      setStudents(studentData ? studentData.filter(s => s.status === 'Active') : []);
    } catch (e) {
      console.warn('DoS student fetch error:', e);
    }

    try {
      let staffQuery = supabase.from('profiles').select('*');
      if (currentSchoolId) staffQuery = staffQuery.eq('school_id', currentSchoolId);
      staffQuery = staffQuery.in('role', ['teacher', 'dos', 'deputy_academic', 'principal', 'deputy_admin', 'registrar', 'finance', 'accountant', 'librarian', 'clinic']);
      const { data: staffData } = await staffQuery;
      if (staffData && staffData.length > 0) setStaff(staffData);
    } catch (e) {
      console.warn('DoS staff fetch error:', e);
    }

    try {
      let appQuery = supabase.from('approval_queue').select('*');
      if (currentSchoolId) appQuery = appQuery.eq('school_id', currentSchoolId);
      const { data: appData } = await appQuery;
      if (appData) setApprovals(appData);
    } catch (e) {
      console.warn('DoS approvals fetch error:', e);
    }

    try {
      let paperQuery = supabase.from('exam_papers').select('*');
      if (currentSchoolId) paperQuery = paperQuery.eq('school_id', currentSchoolId);
      const { data: paperData } = await paperQuery;
      if (paperData) setExamPapers(paperData);
    } catch (e) {
      console.warn('DoS exam papers fetch error:', e);
    }

    try {
      let covQuery = supabase.from('syllabus_coverage_snapshots').select('*');
      if (currentSchoolId) covQuery = covQuery.eq('school_id', currentSchoolId);
      const { data: covData } = await covQuery;
      if (covData) setCoverage(covData);
    } catch (e) {
      console.warn('DoS coverage fetch error:', e);
    }

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

  const rawStudents = useMemo(() => students || [], [students]);

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

  // Teacher workload
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

  // Marks audit
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

  // Filtered Lists
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      const matchSearch = !studentSearch || 
        s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
        (s.adm || s.admission_no || '').toLowerCase().includes(studentSearch.toLowerCase());
      const matchClass = studentClassFilter === 'All' || s.class === studentClassFilter;
      return matchSearch && matchClass;
    });
  }, [activeStudents, studentSearch, studentClassFilter]);

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

  // Handlers
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
    doc.setFontSize(16);
    doc.text('Director of Studies (DoS) Academic Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`School: ${settings?.name || 'School'}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);
    doc.text(`Total Students: ${activeStudents.length} | Teachers: ${activeTeacherList.length} | Streams: ${dynamicClasses.length}`, 14, 40);

    doc.setFontSize(13);
    doc.text('Class Enrollment Summary', 14, 50);
    doc.autoTable({
      startY: 54,
      head: [['Class Stream', 'Enrolled Students']],
      body: classEnrollment.map(c => [c.class, c.count]),
    });

    let finalY = doc.lastAutoTable?.finalY || 70;

    doc.setFontSize(13);
    doc.text('Marks Entry Audit Summary', 14, finalY + 12);
    doc.autoTable({
      startY: finalY + 16,
      head: [['Class', 'Students', 'Entered', 'Total Possible', 'Completion %']],
      body: marksAudit.map(m => [m.class, m.students, m.entered, m.total, `${m.pct}%`]),
    });

    doc.save('DoS_Academic_Report.pdf');
    notify('DoS Academic Report exported as PDF');
  };

  const roleLabels = {
    teacher: 'Teacher', dos: 'Director of Studies', deputy_academic: 'Deputy Academics',
    principal: 'Principal', deputy_admin: 'Deputy Admin', registrar: 'Registrar',
    finance: 'Bursar', accountant: 'Accountant', librarian: 'Librarian', clinic: 'Clinic/Nurse'
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 40 }}>
      {/* ── TOP TOOLBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Director of Studies Portal
            </h1>
            <span style={{ background: '#047857', color: '#ffffff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
              Academic Office
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Academic oversight, exam office management & curriculum quality assurance
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={fetchAllDosData} 
            disabled={loading}
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
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button 
            onClick={handleExportTermlyReport}
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
            <Download size={14} /> Export Report (PDF)
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
              {settings?.name || 'Academic Command Center'}
            </span>
            <span style={{ color: '#047857', fontSize: 10 }}>•</span>
            <span style={{ fontSize: 11, color: '#a7f3d0' }}>Term 2 · 2026 Academic Year</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
            Director of Studies Executive Dashboard
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
            Curriculum Management · Exam Moderation · Marks Verification
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
          { id: 'overview', label: 'Academic Overview', icon: ShieldCheck },
          { id: 'registry', label: 'Student Registry', icon: Users, badge: activeStudents.length },
          { id: 'staff', label: 'Faculty & Workload', icon: BookOpen, badge: rawStaff.length },
          { id: 'marks', label: 'Marks Audit Matrix', icon: CheckCircle, badge: `${overallMarksPct}%` },
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
                <span style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  padding: '1px 6px', 
                  borderRadius: 4, 
                  background: t.alert ? '#fee2e2' : isActive ? '#dcfce7' : '#f1f5f9',
                  color: t.alert ? '#991b1b' : isActive ? '#047857' : '#475569'
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <RefreshCw size={24} color="#047857" className="spin" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Loading Live Academic Records...</div>
        </div>
      )}

      {/* ── TAB 1: ACADEMIC OVERVIEW ── */}
      {!loading && activeTab === 'overview' && (
        <>
          {/* Balanced 4-Column Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <Stat icon={Users} label="Total Enrolled Students" value={activeStudents.length} sub={`${genderDist.male} Male / ${genderDist.female} Female`} color="#047857" badge="Active" />
            <Stat icon={BookOpen} label="Teaching Faculty" value={activeTeacherList.length} sub={`${activeTeachers} Active Members`} color="#047857" badge="Assigned" />
            <Stat icon={Award} label="Classes / Streams" value={`${settings?.classes?.length || 1} / ${dynamicClasses.length}`} sub={`${classEnrollment.length} Active Streams`} color="#047857" badge="Structure" />
            <Stat icon={FileText} label="Published Exams" value={examSchedules.length} sub="Term Exam Schedules" color="#047857" badge="Exams" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <Stat icon={CheckCircle} label="Marks Completion" value={`${overallMarksPct}%`} sub="Overall Entry Progress" color={overallMarksPct >= 80 ? '#047857' : '#d97706'} />
            <Stat icon={AlertTriangle} label="Pending Approvals" value={pendingApprovalsCount} sub="Schemes & Lesson Plans" color={pendingApprovalsCount > 0 ? '#d97706' : '#047857'} />
            <Stat icon={FileText} label="Papers to Moderate" value={pendingPapersCount} sub="Exam Papers Pending" color={pendingPapersCount > 0 ? '#d97706' : '#047857'} />
            <Stat icon={AlertTriangle} label="Overloaded Staff" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 Periods / Week" color="#d13438" />
          </div>

          {/* Quick Management Hub */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="#047857" /> Executive Quick Actions
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Shortcuts to core academic modules</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
                    padding: '12px 14px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#047857';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{act.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{act.desc}</div>
                  </div>
                  <ChevronRight size={15} color="#94a3b8" />
                </div>
              ))}
            </div>
          </div>

          {/* Balanced 2-Column Enrollment & Gender Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Enrollment */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Stream Enrollment</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>{classEnrollment.length} Active Streams</span>
              </div>
              <table className="table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Class Stream</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Students</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase', width: 140 }}>Share</th>
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
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 26 }}>{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {classEnrollment.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 16 }}>No students in registry.</div>}
            </div>

            {/* Demographics */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Gender Demographics</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{genderDist.male}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginTop: 2 }}>Male</div>
                  </div>
                  <div style={{ background: '#fdf2f8', border: '1px solid #fce7f3', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#db2777' }}>{genderDist.female}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9d174d', marginTop: 2 }}>Female</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#047857' }}>{genderDist.total}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', marginTop: 2 }}>Total</div>
                  </div>
                </div>

                {genderDist.total > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      <span>Ratio Breakdown</span>
                      <span>{genderDist.male} M : {genderDist.female} F</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(genderDist.male / genderDist.total) * 100}%`, background: '#2563eb' }} />
                      <div style={{ width: `${(genderDist.female / genderDist.total) * 100}%`, background: '#db2777' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Live Registry State</span>
                <button className="btn btn-sm" onClick={() => navigate('registrar')} style={{ fontSize: 12 }}>Open Registrar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: STUDENT REGISTRY ── */}
      {!loading && activeTab === 'registry' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Live Student Registry</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Showing {filteredStudents.length} of {activeStudents.length} active students</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                <input 
                  type="text" 
                  placeholder="Search student or adm..." 
                  value={studentSearch} 
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 30, height: 34, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <select 
                value={studentClassFilter} 
                onChange={(e) => setStudentClassFilter(e.target.value)}
                style={{ height: 34, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 12 }}
              >
                <option value="All">All Streams</option>
                {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button className="btn btn-primary" onClick={() => navigate('registrar')} style={{ height: 34, borderRadius: 6, fontSize: 12, background: '#047857', border: 'none' }}>
                Open Full Registrar
              </button>
            </div>
          </div>

          <div className="scroll-x">
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>#</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Adm No</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Student Name</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Gender</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Class Stream</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Guardian</th>
                  <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.slice(0, 100).map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td>{idx + 1}</td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.adm || s.admission_no || '-'}</span></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                    <td>{s.gender || '-'}</td>
                    <td><strong>{s.class || '-'}</strong></td>
                    <td className="muted">{s.guardianName || s.guardian_name || '-'}</td>
                    <td><Badge color={s.status === 'Active' ? 'green' : 'amber'}>{s.status || 'Active'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStudents.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 30 }}>No matching students found.</div>}
        </div>
      )}

      {/* ── TAB 3: FACULTY & WORKLOAD ── */}
      {!loading && activeTab === 'staff' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <Stat icon={Users} label="Total Staff" value={rawStaff.length} sub="Registered Portal Users" color="#047857" />
            <Stat icon={BookOpen} label="Subject Teachers" value={rawStaff.filter(s => s.role === 'teacher').length} sub="Active Faculty" color="#047857" />
            <Stat icon={AlertTriangle} label="Overloaded Staff" value={teacherWorkload.filter(t => t.isOverload).length} sub="> 27 Periods / Week" color="#d13438" />
            <Stat icon={Award} label="Staff Roles" value={staffByRole.length} sub="Distinct Roles" color="#047857" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Staff Directory</h3>
              <table className="table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>#</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Name</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Role</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s, idx) => (
                    <tr key={s.id || idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{s.full_name || s.name || '-'}</td>
                      <td><Badge color="green">{roleLabels[s.role] || s.role}</Badge></td>
                      <td>{s.subject || s.dept || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStaff.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No staff profiles found.</div>}
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Teacher Workload</h3>
              <table className="table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Teacher Name</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Periods/Wk</th>
                    <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherWorkload.map((tw, idx) => (
                    <tr key={idx} style={{ background: tw.isOverload ? '#fef2f2' : 'transparent' }}>
                      <td><strong>{tw.name}</strong></td>
                      <td style={{ fontWeight: 700 }}>{tw.periods}</td>
                      <td>
                        {tw.isOverload ? (
                          <Badge color="red">Overload (&gt;27)</Badge>
                        ) : (
                          <Badge color="green">Normal</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {teacherWorkload.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>No workload mapped.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 4: MARKS AUDIT ── */}
      {!loading && activeTab === 'marks' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Marks Entry Audit Register</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>Live completion audit across all class streams</span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('gradebook')} style={{ background: '#047857', border: 'none' }}>
              Open Gradebook
            </button>
          </div>

          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Class Stream</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Students</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Marks Entered</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Total Possible</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase', width: 160 }}>Completion %</th>
                <th style={{ fontSize: 11, textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {marksAudit.map(m => (
                <tr key={m.class}>
                  <td><strong>{m.class}</strong></td>
                  <td>{m.students}</td>
                  <td style={{ fontWeight: 700, color: '#047857' }}>{m.entered}</td>
                  <td className="muted">{m.total}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32 }}>{m.pct}%</span>
                      <div style={{ flex: 1 }}><ProgressBar value={m.pct} color={m.pct === 100 ? '#047857' : m.pct > 0 ? '#d97706' : '#d13438'} /></div>
                    </div>
                  </td>
                  <td>
                    <Badge color={m.pct === 100 ? 'green' : m.pct > 0 ? 'amber' : 'red'}>
                      {m.pct === 100 ? 'Complete' : m.pct > 0 ? 'In Progress' : 'Pending'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 5: APPROVALS & MODERATION ── */}
      {!loading && activeTab === 'moderation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Schemes */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Schemes & Lesson Plans</h3>
              <Badge color={pendingApprovalsCount > 0 ? 'amber' : 'green'}>{pendingApprovalsCount} Pending</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvals.filter(a => a.status === 'pending').map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.item_type === 'scheme_of_work' ? 'Scheme of Work' : 'Lesson Plan'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>By: {a.profiles?.full_name || 'Teacher'}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleApprove(a.id, 'approval_queue')} style={{ background: '#047857', border: 'none' }}>Approve</button>
                </div>
              ))}
              {approvals.filter(a => a.status === 'pending').length === 0 && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No pending schemes.</div>}
            </div>
          </div>

          {/* Exam Papers */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Exam Paper Moderation</h3>
              <Badge color={pendingPapersCount > 0 ? 'amber' : 'green'}>{pendingPapersCount} Pending</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {examPapers.filter(p => p.moderation_status === 'pending').map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.subject} ({p.class})</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Set by: {p.profiles?.full_name || 'Unknown'}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleApprove(p.id, 'exam_papers')} style={{ background: '#047857', border: 'none' }}>Moderate</button>
                </div>
              ))}
              {examPapers.filter(p => p.moderation_status === 'pending').length === 0 && <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No pending papers.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
