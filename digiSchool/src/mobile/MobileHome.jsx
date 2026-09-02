import { useMemo } from 'react';
import {
  Search, Wallet, CalendarDays, Award, Stethoscope, MessageSquare, BookOpen,
  Users, BarChart3, GraduationCap, ArrowRight, PlayCircle, ClipboardList, Bell, Clock, Receipt,
} from 'lucide-react';
import { studentOverall, gradeFor, is844Class, CBC_BOUNDARIES, KCSE_BOUNDARIES } from '../utils/grading';
import MobileClockIn from './MobileClockIn';

function QA({ icon: Icon, label, color, onClick }) {
  return (
    <button className="eom-qa" onClick={onClick}>
      <span className="eom-ico" style={{ background: `color-mix(in srgb, ${color} 13%, #fff)`, color }}><Icon /></span>
      <span>{label}</span>
    </button>
  );
}
function Kpi({ icon: Icon, color, value, label }) {
  return (
    <div className="eom-kpi">
      <span className="eom-ic" style={{ background: `color-mix(in srgb, ${color} 13%, #fff)`, color }}><Icon /></span>
      <div className="eom-v eom-num">{value}</div>
      <div className="eom-l">{label}</div>
    </div>
  );
}
function HeroCard({ icon: Icon, tag, title, text, cta, onCta }) {
  return (
    <div className="eom-hero-card">
      {tag && <span className="eom-pill">{tag}</span>}
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {cta && <button className="eom-cta" onClick={onCta}>{cta} <ArrowRight /></button>}
      {Icon && <span className="eom-hero-ico"><Icon /></span>}
    </div>
  );
}

const BLUE = '#1E5FE0', GOOD = '#059669', WARN = '#D97706', INFO = '#2563EB', BAD = '#DC2626';

// Adaptive home. `role` picks the layout; `store` supplies live data; `open`
// pushes an in-shell screen by name.
export default function MobileHome({ role, store, user, open }) {
  const students = store.students || [];
  const teachers = store.teachers || [];
  const settings = store.settings || {};

  const system = useMemo(() => {
    const n844 = students.filter((s) => is844Class(s.class)).length;
    return students.length && n844 > students.length / 2 ? '844' : 'CBC';
  }, [students]);
  const boundaries = system === '844' ? KCSE_BOUNDARIES : CBC_BOUNDARIES;

  const schoolMean = useMemo(() => {
    const vals = students.map((s) => studentOverall(s)).filter((v) => v > 0);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [students]);

  const search = <div className="eom-searchbar"><Search /> Search students, staff, records…</div>;

  if (['principal', 'deputy_academic', 'deputy_admin', 'dos', 'registrar', 'admin', 'finance', 'accountant', 'bursar', 'librarian', 'support', 'procurement', 'clinic', 'nurse'].includes(role)) {
    return (
      <>
        <MobileClockIn user={user} store={store} />
        {search}
        <HeroCard icon={GraduationCap} tag={(settings.name || 'Your school').toUpperCase()}
          title="School at a glance" text="The numbers that need you — academics, fees and staff."
          cta="Open academics" onCta={() => open('admin_academics')} />
        <div className="eom-mini-grid">
          <Kpi icon={Users} color={BLUE} value={students.length} label="Students" />
          <Kpi icon={Users} color={INFO} value={teachers.length} label="Teaching staff" />
          <Kpi icon={BarChart3} color={GOOD} value={schoolMean > 0 ? `${schoolMean}%` : '—'} label="School mean" />
          <Kpi icon={Award} color={WARN} value={schoolMean > 0 ? gradeFor(schoolMean, boundaries, system) : '—'} label="Mean grade" />
        </div>
        <div className="eom-sec"><h5>Quick actions</h5></div>
        <div className="eom-qa-grid">
          <QA icon={BarChart3} label="Academics" color={BLUE} onClick={() => open('admin_academics')} />
          <QA icon={Wallet} label="Finance" color={GOOD} onClick={() => open('admin_finance')} />
          <QA icon={Users} label="Staff" color={INFO} onClick={() => open('admin_staff')} />
          <QA icon={Bell} label="Notices" color={WARN} onClick={() => open('admin_notices')} />
        </div>
        <div className="eom-sec"><h5>More</h5></div>
        <div className="eom-qa-grid">
          <QA icon={GraduationCap} label="Students" color={BLUE} onClick={() => open('admin_students')} />
          <QA icon={Users} label="Teachers" color={INFO} onClick={() => open('admin_teachers')} />
          <QA icon={ClipboardList} label="Exams" color={WARN} onClick={() => open('admin_exams')} />
          <QA icon={CalendarDays} label="Timetable" color={GOOD} onClick={() => open('admin_timetable')} />
          <QA icon={Clock} label="Approvals" color={BAD} onClick={() => open('admin_approvals')} />
          <QA icon={Receipt} label="Expenses" color={GOOD} onClick={() => open('admin_expenses')} />
          <QA icon={CalendarDays} label="Attendance" color={BLUE} onClick={() => open('admin_attendance')} />
        </div>
      </>
    );
  }

  if (role === 'teacher' || role === 'class teacher') {
    const me = teachers.find((t) => t.id === user?.teacher_id || t.name === user?.name) || {};
    const subject = me.subject || user?.dept || 'your subject';
    return (
      <>
        <MobileClockIn user={user} store={store} />
        {search}
        <HeroCard icon={ClipboardList} tag="TEACHER"
          title="Your classes today" text="Track your subjects, learners and messages in one place."
          cta="View classes" onCta={() => open('teacher_classes')} />
        <div className="eom-mini-grid">
          <Kpi icon={Users} color={BLUE} value={students.length} label="Learners" />
          <Kpi icon={BookOpen} color={INFO} value={subject} label="Subject" />
        </div>
        <div className="eom-sec"><h5>Quick actions</h5></div>
        <div className="eom-qa-grid">
          <QA icon={CalendarDays} label="Attendance" color={GOOD} onClick={() => open('teacher_attendance')} />
          <QA icon={Award} label="Marks" color={WARN} onClick={() => open('teacher_gradebook')} />
          <QA icon={BookOpen} label="Classes" color={BLUE} onClick={() => open('teacher_classes')} />
          <QA icon={MessageSquare} label="Messages" color={INFO} onClick={() => open('teacher_messages')} />
        </div>
      </>
    );
  }

  if (role === 'student') {
    const me = students.find((s) => s.id === (user?.student_id || user?.studentId)) || (user?.linked_students && user.linked_students[0]) || {};
    const overall = me.scores ? studentOverall(me) : 0;
    return (
      <>
        {search}
        <HeroCard icon={BookOpen} tag={(me.class || 'MY CLASS').toUpperCase()}
          title="Welcome back to class" text="Your timetable, results and resources, all here."
          cta="View timetable" onCta={() => open('student_timetable')} />
        <div className="eom-mini-grid">
          <Kpi icon={Award} color={WARN} value={overall > 0 ? gradeFor(overall, boundaries, system) : '—'} label="Mean grade" />
          <Kpi icon={BarChart3} color={GOOD} value={overall > 0 ? `${overall}%` : '—'} label="Mean score" />
        </div>
        <div className="eom-sec"><h5>Quick actions</h5></div>
        <div className="eom-qa-grid">
          <QA icon={CalendarDays} label="Timetable" color={BLUE} onClick={() => open('student_timetable')} />
          <QA icon={Award} label="Results" color={WARN} onClick={() => open('student_results')} />
          <QA icon={PlayCircle} label="Learn" color={GOOD} onClick={() => open('student_learn')} />
          <QA icon={Wallet} label="Fees" color={INFO} onClick={() => open('student_finance')} />
        </div>
      </>
    );
  }

  // Parent (default)
  const child = (user?.linked_students && user.linked_students[0]) || {};
  const childName = child.name || 'your child';
  return (
    <>
      {search}
      <HeroCard icon={GraduationCap} tag="THIS TERM"
        title={`${childName}'s progress`} text="Attendance, results and fees — all in one place."
        cta="View results" onCta={() => open('parent_results')} />
      <div className="eom-sec"><h5>Quick actions</h5></div>
      <div className="eom-qa-grid">
        <QA icon={Wallet} label="Fees" color={BLUE} onClick={() => open('parent_fees')} />
        <QA icon={CalendarDays} label="Attendance" color={GOOD} onClick={() => open('parent_attendance')} />
        <QA icon={Award} label="Results" color={WARN} onClick={() => open('parent_results')} />
        <QA icon={Stethoscope} label="Clinic" color={BAD} onClick={() => open('parent_clinic')} />
      </div>
      <div className="eom-sec"><h5>Messages</h5><a onClick={() => open('parent_messages')}>Open</a></div>
      <div className="eom-list-card">
        <button className="eom-li" onClick={() => open('parent_messages')}>
          <span className="eom-lic" style={{ background: 'var(--eom-info-100)', color: 'var(--eom-info)' }}><MessageSquare /></span>
          <div className="eom-lt"><b>School &amp; clinic messages</b><span>Tap to open your inbox</span></div>
        </button>
      </div>
    </>
  );
}
