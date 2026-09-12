import { useState, useMemo, useEffect } from 'react';
import { expandClassesWithStreams, SUBJECTS } from '../data/seed';
import { computeTargetMetrics, computeEnrolmentMetrics } from '../lib/targets';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, TargetCard, Spotlight,
  ChartCard, SnLine, SnDonut, RankList, ProgressMetric, SnBadge, SnButton, ClassMeanChart,
  SnEmpty, SNEAT,
} from '../components/sneat';
import Modal from '../components/Modal';
import StaffMeetingModal, { canCallStaffMeeting } from '../components/StaffMeetingModal';
import { Icon } from '../components/icons';
import { computeRow } from '../utils/grading';
import { GraduationCap, Users, CheckCircle2, DollarSign, TrendingDown, Clock, UserCheck, Building, FileText, Megaphone, CalendarDays, CreditCard, AlertCircle, Award, Target, UserPlus, BookOpen } from 'lucide-react';


const ALERT_ICON_MAP = {
  'users': Users,
  'document': FileText,
  'academic': GraduationCap,
  'alert': AlertCircle,
  'facility': Building,
  'finance': DollarSign,
};

// Admissions were removed from here — enrolment is the Registrar's job and
// lives on their dashboard, not the principal's quick actions.
const QUICK_ACTIONS = [
  { icon: Megaphone, label: 'Send Mass Broadcast', desc: 'SMS/Email to staff & parents', view: 'overview', action: 'broadcast' },
  { icon: CalendarDays, label: 'Schedule Staff Meeting', desc: 'Alerts every teacher', action: 'staffMeeting' },
  { icon: CreditCard, label: 'Fee Structure', desc: 'Update school fees', view: 'finance' },
];

// `user` comes from LegacyViewLoader alongside `store`; it carries the role
// that gates who may call a staff meeting.
export default function Overview({ store, user }) {
  const { navigate, notify } = store;
  const currentUser = user || store.user || { role: store.role, name: store.settings?.principal };
  const fullTrend = [];
  const [alertModal, setAlertModal] = useState(null);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [staffMeetingOpen, setStaffMeetingOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ audience: 'All Parents', message: '', type: 'SMS & Email' });

  // Real data state for metrics
  const [dbStaff, setDbStaff] = useState([]);
  const [dbPayments, setDbPayments] = useState([]);
  const [dbInvoices, setDbInvoices] = useState([]);
  const [dbAdmissions, setDbAdmissions] = useState([]);
  const [dbAttendance, setDbAttendance] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);

  useEffect(() => {
    import('../lib/api').then(({ fetchTable }) => {
      Promise.all([
        fetchTable('staff').catch(() => []),
        fetchTable('financePayments').catch(() => []),
        fetchTable('invoices').catch(() => []),
        fetchTable('admissions').catch(() => []),
        fetchTable('studentAttendance').catch(() => []),
        fetchTable('schoolEvents').catch(() => [])
      ]).then(([staffData, pays, invs, adm, att, events]) => {
        setDbStaff(staffData || []);
        setDbPayments(pays || []);
        setDbInvoices(invs || []);
        setDbAdmissions(adm || []);
        setDbAttendance(att || []);
        setDbEvents(events || []);
      });
    });
  }, []);

  const handleBroadcast = () => {
    if (!broadcastForm.message.trim()) return notify('Please enter a message to broadcast', 'warning');
    notify(`Broadcast queued for ${broadcastForm.audience} via ${broadcastForm.type}.`, 'success');
    setBroadcastModalOpen(false);
    setBroadcastForm({ audience: 'All Parents', message: '', type: 'SMS & Email' });
  };

  const sparkData = fullTrend.slice(-12).map((d) => d.present);
  const activeStudents = (store.students || []).filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  const totalStudents = activeStudents.length;

  // Class distribution — derived from the actual enrolled students.
  const classDistData = useMemo(() => {
    const counts = {};
    activeStudents.forEach(s => {
      const c = s.class || 'Unassigned';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeStudents]);

  // Real Staff Metrics
  const activeStaffList = dbStaff.filter(t => t.status !== 'Inactive');
  const totalTeachers = activeStaffList.length > 0 ? activeStaffList.length : (store.teachers?.length || 0);
  const activeTeachers = activeStaffList.length > 0 ? activeStaffList.filter(t => t.status !== 'On Leave').length : (store.teachers?.filter(t => t.status === 'active' || t.status === 'Active' || t.status === 'Present').length || 0);
  const onLeave = totalTeachers - activeTeachers;

  // Real Attendance — today's student attendance rate from the DB.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysAtt = dbAttendance.filter(a => (a.date || '').slice(0, 10) === todayStr);
  const presentToday = todaysAtt.filter(a => String(a.status).toLowerCase() === 'present').length;
  const attRate = todaysAtt.length > 0 ? ((presentToday / todaysAtt.length) * 100).toFixed(1) : null;

  // Real Revenue Metrics
  const totalRevenue = dbPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const revStr = totalRevenue > 1000000 ? `${(totalRevenue / 1000000).toFixed(1)}M` : (totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue.toString());

  // Monthly revenue trend — bucket real payments by calendar month.
  const displayTrend = useMemo(() => {
    if (dbPayments.length === 0) return [];
    const buckets = {};
    dbPayments.forEach(p => {
      const d = p.date || p.created_at || p.paid_at;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt)) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, revenue]) => {
        const [y, m] = key.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
        return { month: label, revenue };
      });
  }, [dbPayments]);

  // Real Outstanding Fees
  const totalInvoiced = dbInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const outstandingFees = Math.max(0, totalInvoiced - totalRevenue);
  const outStr = outstandingFees > 1000000 ? `${(outstandingFees / 1000000).toFixed(1)}M` : (outstandingFees > 1000 ? `${(outstandingFees / 1000).toFixed(0)}K` : outstandingFees.toString());

  // Real Admissions
  const pendingApps = dbAdmissions.filter(a => a.status === 'Pending').length;

  const maleCount = activeStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = activeStudents.filter(s => s.gender === 'Female').length;
  const malePct = totalStudents ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePct = totalStudents ? Math.round((femaleCount / totalStudents) * 100) : 0;

  const boardingCount = activeStudents.filter(s => {
    const t = String(s.boarding || s.residence || s.type || '').toLowerCase();
    return s.boarding === true || t.includes('board');
  }).length;
  const dayCount = totalStudents - boardingCount;

  // ── Academic Performance — a key school indicator computed from real scores ──
  const academic = useMemo(() => {
    const studentAverages = [];
    activeStudents.forEach(st => {
      const scores = st.scores || {};
      const subjPercents = [];
      Object.keys(scores).forEach(sub => {
        const row = computeRow(scores[sub]);
        if (row.average > 0) {
          const pct = row.average <= 4 ? Math.round(row.average * 25) : row.average;
          subjPercents.push(pct);
        }
      });
      if (subjPercents.length) {
        studentAverages.push(subjPercents.reduce((a, b) => a + b, 0) / subjPercents.length);
      }
    });
    const assessed = studentAverages.length;
    const mean = assessed ? studentAverages.reduce((a, b) => a + b, 0) / assessed : 0;
    const bands = [
      { key: 'Exceeding', tone: 'success', count: 0 },
      { key: 'Meeting', tone: 'primary', count: 0 },
      { key: 'Approaching', tone: 'warning', count: 0 },
      { key: 'Below', tone: 'danger', count: 0 },
    ];
    studentAverages.forEach(avg => {
      if (avg >= 75) bands[0].count++;
      else if (avg >= 50) bands[1].count++;
      else if (avg >= 30) bands[2].count++;
      else bands[3].count++;
    });
    return { assessed, mean, bands };
  }, [activeStudents]);

  /**
   * Mean per class — the unit mean targets are actually set against. A
   * school-wide mean hides that Form 1 and Form 4 are different problems.
   */
  const classMeanRows = useMemo(() => {
    const rows = {};
    activeStudents.forEach((st) => {
      const subjPercents = [];
      Object.keys(st.scores || {}).forEach((sub) => {
        const row = computeRow(st.scores[sub]);
        if (row.average > 0) {
          subjPercents.push(row.average <= 4 ? Math.round(row.average * 25) : row.average);
        }
      });
      if (!subjPercents.length) return;
      const avg = subjPercents.reduce((a, b) => a + b, 0) / subjPercents.length;
      const k = st.class || 'Unassigned';
      rows[k] ||= { name: k, total: 0, students: 0 };
      rows[k].total += avg;
      rows[k].students += 1;
    });
    return Object.values(rows)
      .map((r) => ({ name: r.name, mean: r.students ? r.total / r.students : 0, students: r.students }))
      .sort((a, b) => b.mean - a.mean);
  }, [activeStudents]);

  // ── Targets ──────────────────────────────────────────────────────────────
  // Every goal the school set in Settings → Targets, resolved against live
  // data. This is what the principal's dashboard is accountable to.
  const schoolClasses = useMemo(
    () => expandClassesWithStreams(store.settings?.classes || []),
    [store.settings]
  );

  const admittedThisYear = useMemo(() => {
    const year = new Date().getFullYear();
    const fromStudents = (store.students || []).filter((s) => {
      const d = s.admission_date || s.created_at || s.date_joined;
      return d && new Date(d).getFullYear() === year;
    }).length;
    const fromAdmissions = dbAdmissions.filter((a) => {
      const d = a.date || a.created_at;
      return d && new Date(d).getFullYear() === year;
    }).length;
    return Math.max(fromStudents, fromAdmissions);
  }, [store.students, dbAdmissions]);

  const staffPresentPct = activeStaffList.length
    ? (activeStaffList.filter((s) => ['Present', 'Active', 'active'].includes(s.status)).length / activeStaffList.length) * 100
    : 0;

  const metrics = useMemo(() => computeTargetMetrics({
    settings: store.settings,
    students: activeStudents,
    teachers: (store.teachers && store.teachers.length ? store.teachers : dbStaff),
    classes: schoolClasses,
    timetables: store.timetables || {},
    subjects: store.settings?.subjects?.length ? store.settings.subjects : SUBJECTS,
    collected: totalRevenue,
    billed: totalInvoiced,
    admittedThisYear,
    classMeans: classMeanRows,
    attendancePct: attRate !== null ? Number(attRate) : 0,
    staffPresentPct,
  }), [store.settings, store.teachers, store.timetables, activeStudents, dbStaff,
       schoolClasses, totalRevenue, totalInvoiced, admittedThisYear, classMeanRows,
       attRate, staffPresentPct]);

  // The eight targets shown on this dashboard, and how many are being met.
  const trackedTargets = useMemo(() => [
    metrics.fees, metrics.admissions, metrics.timetables, metrics.classTeachers,
    metrics.subjectAllocation, metrics.meanScore, metrics.attendance, metrics.staffAttendance,
  ].filter((m) => m && m.target > 0), [metrics]);

  // How many students the school should have this term, vs how many it has.
  const enrolment = useMemo(
    () => computeEnrolmentMetrics(store.settings, totalStudents),
    [store.settings, totalStudents]
  );

  const targetsMet = trackedTargets.filter((m) => m.met).length;
  const offTrack = trackedTargets.filter((m) => !m.met).sort((a, b) => a.pct - b.pct);
  const overallProgress = trackedTargets.length
    ? trackedTargets.reduce((sum, m) => sum + m.pct, 0) / trackedTargets.length
    : 0;

  const displayClassDist = totalStudents > 0 ? classDistData : [];
  const displayAlerts = [];
  // Upcoming events — real school calendar events dated from today onward.
  const displayEvents = useMemo(() => {
    return (dbEvents || [])
      .filter(e => e.date && e.date >= todayStr)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
      .map(e => ({ id: e.id, title: e.title, date: e.date, desc: e.desc || e.type || '' }));
  }, [dbEvents]);

  return (
    <SneatPage
      flush
      title="School overview"
      subtitle={`Welcome back, ${store.settings.principal || 'Principal'}. Here's where the school stands against its targets.`}
      actions={
        <>
          <SnButton variant="outline" onClick={() => setBroadcastModalOpen(true)}>
            <Megaphone size={15} /> Broadcast
          </SnButton>
          <SnButton variant="primary" onClick={() => navigate('settings')}>
            <Target size={15} /> Set targets
          </SnButton>
        </>
      }
    >
      {/* THE metric: how much of the school's target set is being met. */}
      <Spotlight
        icon={<Target size={13} />}
        eyebrow={`School targets — ${store.settings.currentTerm || 'this term'}`}
        value={`${targetsMet} / ${trackedTargets.length}`}
        caption={
          trackedTargets.length === 0
            ? 'No targets configured yet. Set them in Settings → Targets.'
            : targetsMet === trackedTargets.length
              ? 'Every target the school set is currently being met.'
              : `${trackedTargets.length - targetsMet} target${trackedTargets.length - targetsMet === 1 ? '' : 's'} still short — ` +
                `${offTrack.map((m) => m.label.toLowerCase()).slice(0, 3).join(', ')}` +
                `${offTrack.length > 3 ? ` and ${offTrack.length - 3} more` : ''}.`
        }
        progress={overallProgress}
        target={{ label: 'Targets met', value: `${targetsMet} of ${trackedTargets.length}` }}
        stats={[
          { label: 'Students enrolled', value: totalStudents },
          { label: 'Fee collection', value: `${metrics.fees.current.toFixed(0)}%` },
          { label: "Today's attendance", value: attRate !== null ? `${attRate}%` : '—' },
        ]}
      />

      {/* Every target the school set, each against its own goal. */}
      <Card>
        <CardHead
          title="Targets"
          subtitle="Set in Settings → Targets. Each tile shows progress toward the school's own goal."
          action={<SnButton variant="ghost" onClick={() => navigate('settings')}>Edit targets</SnButton>}
        />
        <CardBody>
          <Grid cols={4}>
            <TargetCard metric={metrics.fees} icon={<DollarSign />}
              onClick={() => navigate('finance')} />
            <TargetCard metric={metrics.admissions} icon={<UserPlus />}
              onClick={() => navigate('admissions')} />
            <TargetCard metric={metrics.timetables} icon={<CalendarDays />}
              onClick={() => navigate('timetable')} />
            <TargetCard metric={metrics.classTeachers} icon={<UserCheck />}
              onClick={() => navigate('class_teachers')} />
            <TargetCard metric={metrics.subjectAllocation} icon={<BookOpen />}
              onClick={() => navigate('class_teachers')} />
            <TargetCard metric={metrics.meanScore} icon={<Award />}
              onClick={() => navigate('gradebook')} />
            <TargetCard metric={metrics.attendance} icon={<CheckCircle2 />} />
            <TargetCard metric={metrics.staffAttendance} icon={<Users />}
              onClick={() => navigate('staff_attendance')} />
          </Grid>
        </CardBody>
      </Card>

      {/* Headline operating numbers */}
      <Grid cols={4}>
        <MetricCard
          label="Students enrolled"
          value={enrolment.expected > 0 ? `${enrolment.actual} / ${enrolment.expected}` : String(enrolment.actual)}
          icon={<GraduationCap />}
          tone={enrolment.status}
          foot={
            enrolment.expected > 0
              ? `${enrolment.term} plan${enrolment.variance < 0 ? ` · ${Math.abs(enrolment.variance)} short` : enrolment.variance > 0 ? ` · ${enrolment.variance} over` : ' · on plan'}`
              : 'No term target set'
          }
          progress={enrolment.expected > 0 ? { value: enrolment.pct, max: 100, tone: enrolment.status } : undefined}
        />
        <MetricCard label="Teaching staff" value={totalTeachers} icon={<Users />} tone="info"
          foot={`${activeTeachers} active · ${onLeave} on leave`} />
        <MetricCard label="Total revenue" value={`KES ${revStr}`} icon={<DollarSign />} tone="success"
          foot="Collected to date" onClick={() => navigate('finance', { tab: 'payments' })} />
        <MetricCard label="Outstanding fees" value={`KES ${outStr}`} icon={<TrendingDown />}
          tone={outstandingFees > 0 ? 'warning' : 'success'}
          foot={outstandingFees > 0 ? 'View defaulters →' : 'All clear'}
          onClick={() => navigate('finance', { tab: 'defaulters' })} />
      </Grid>

      <Grid cols={4}>
        <MetricCard label="Pending applications" value={pendingApps} icon={<Clock />}
          tone={pendingApps > 0 ? 'warning' : 'success'} foot="Admissions portal" />
        <MetricCard label="Gender ratio" value={`${malePct}% M · ${femalePct}% F`} icon={<UserCheck />}
          tone="secondary" foot={totalStudents > 0 ? 'Active register' : 'N/A'} />
        <MetricCard label="Boarding / day" value={`${boardingCount} / ${dayCount}`} icon={<Building />}
          tone="secondary" foot={totalStudents > 0 ? 'Enrolment type' : 'N/A'} />
        <MetricCard label="Classes" value={schoolClasses.length} icon={<CalendarDays />} tone="primary"
          foot={`${metrics.raw.classesWithTimetable} with a timetable`} />
      </Grid>

      {/* Trends */}
      <Grid cols="8-4">
        <ChartCard title="Monthly revenue" subtitle="Payments received, last 12 months" height={300}>
          {displayTrend.length > 0 ? (
            <SnLine data={displayTrend} xKey="month" series={[{ key: 'revenue', name: 'Revenue' }]} />
          ) : (
            <SnLine data={[{ month: 'No data', revenue: 0 }]} xKey="month" series={[{ key: 'revenue', name: 'Revenue' }]} />
          )}
        </ChartCard>

        <ChartCard title="Class distribution" subtitle="Students per class" height={300} raw>
          {displayClassDist.length > 0 ? (
            <SnDonut data={displayClassDist} centerValue={String(totalStudents)} centerLabel="students" />
          ) : (
            <SnDonut data={[{ name: 'No students', value: 1 }]} centerValue="0" centerLabel="students" />
          )}
        </ChartCard>
      </Grid>

      {/* Academic performance */}
      <Card>
        <CardHead
          title="Mean score by class"
          subtitle={`Each class against its own ${metrics.classMeans.year} target — ${metrics.classMeans.met} of ${metrics.classMeans.total} meeting it`}
          action={<SnButton variant="ghost" onClick={() => navigate('gradebook')}>Open gradebook</SnButton>}
        />
        <CardBody>
          {metrics.classMeans.total > 0 ? (
            <Grid cols={2}>
              <ClassMeanChart rows={metrics.classMeans.rows} />

              <div>
                <div className="sn-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  Performance distribution · {academic.assessed} student{academic.assessed === 1 ? '' : 's'} assessed
                </div>
                {academic.bands.map((b) => {
                  const pct = academic.assessed ? Math.round((b.count / academic.assessed) * 100) : 0;
                  return (
                    <div key={b.key} style={{ marginBottom: 10 }}>
                      <ProgressMetric
                        label={b.key}
                        value={pct}
                        max={100}
                        valueLabel={`${b.count} (${pct}%)`}
                        tone={b.tone}
                      />
                    </div>
                  );
                })}

                {metrics.classMeans.worst && !metrics.classMeans.worst.met && (
                  <div style={{ marginTop: 16, fontSize: 13 }}>
                    <SnBadge tone="danger">Furthest behind</SnBadge>{' '}
                    <span className="sn-strong">{metrics.classMeans.worst.name}</span>{' '}
                    <span className="sn-muted">
                      {metrics.classMeans.worst.mean.toFixed(1)}% vs {metrics.classMeans.worst.target}% target
                      ({metrics.classMeans.worst.gap.toFixed(1)})
                    </span>
                  </div>
                )}
              </div>
            </Grid>
          ) : (
            <SnEmpty icon={<Award />} title="No graded assessments yet"
              message="Class means appear here once teachers enter scores." />
          )}
        </CardBody>
      </Card>

      {/* Attention + events + actions */}
      <Grid cols={3}>
        <Card>
          <CardHead title="Needs attention" subtitle="Targets currently short of goal" />
          <CardBody>
            <RankList
              empty={<SnEmpty icon={<CheckCircle2 />} title="Everything on target"
                message="No target is currently behind." />}
              items={offTrack.slice(0, 5).map((m) => ({
                id: m.label,
                title: m.label,
                sub: m.caption || `${m.current.toFixed(0)}${m.unit === '%' ? '%' : ''} of ${m.target}${m.unit === '%' ? '%' : ''}`,
                value: `${Math.round(m.pct)}%`,
                tone: m.status,
                icon: <AlertCircle />,
                progress: m.pct,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Upcoming events" subtitle="From the school calendar"
            action={<SnButton variant="ghost" onClick={() => navigate('school_calendar')}>Calendar</SnButton>} />
          <CardBody>
            <RankList
              empty={<SnEmpty icon={<CalendarDays />} title="No upcoming events"
                message="Scheduled events will appear here." />}
              items={displayEvents.map((e) => ({
                id: e.id,
                title: e.title,
                sub: `${e.date}${e.desc ? ` · ${e.desc}` : ''}`,
                icon: <CalendarDays />,
                tone: 'info',
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Quick actions" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_ACTIONS.filter((qa) => qa.action !== 'staffMeeting' || canCallStaffMeeting(currentUser?.role)).map((qa) => {
                const QaIcon = qa.icon;
                return (
                  <SnButton
                    key={qa.label}
                    variant="ghost"
                    onClick={() => {
                      if (qa.action === 'broadcast') {
                        setBroadcastModalOpen(true);
                      } else if (qa.action === 'staffMeeting') {
                        setStaffMeetingOpen(true);
                      } else {
                        navigate(qa.view);
                        notify(`Opening ${qa.label}`, 'info', 'Navigation');
                      }
                    }}
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                  >
                    <QaIcon size={16} /> {qa.label}
                  </SnButton>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </Grid>
      {staffMeetingOpen && (
        <StaffMeetingModal
          user={currentUser}
          settings={store.settings}
          notify={notify}
          onClose={() => setStaffMeetingOpen(false)}
        />
      )}

      {alertModal && (
        <Modal
          title="Alert Details"
          onClose={() => setAlertModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setAlertModal(null)}>Dismiss</button>}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div className="alert-icon" style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={22} /></div>
            <div>
              <h4 style={{ marginBottom: 6 }}>{alertModal.message}</h4>
              <p className="muted" style={{ margin: 0 }}>Logged {alertModal.time}.</p>
              <p style={{ marginTop: 10 }}>
                This alert was generated by the EduOne monitoring system. Review the relevant module
                for full context and take any required action.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {broadcastModalOpen && (
        <Modal
          title="Send Mass Broadcast"
          onClose={() => setBroadcastModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setBroadcastModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBroadcast}>Send Broadcast</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Target Audience</label>
                <select className="select" value={broadcastForm.audience} onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}>
                  <option>All Parents</option>
                  <option>All Staff</option>
                  <option>Grade 7 Parents</option>
                  <option>Grade 8 Parents</option>
                  <option>Grade 9 Parents</option>
                  <option>All Students</option>
                </select>
              </div>
              <div>
                <label className="field-label">Delivery Method</label>
                <select className="select" value={broadcastForm.type} onChange={e => setBroadcastForm(f => ({ ...f, type: e.target.value }))}>
                  <option>SMS & Email</option>
                  <option>SMS Only</option>
                  <option>Email Only</option>
                  <option>App Notification</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Message Content</label>
              <textarea 
                className="input" 
                rows={5} 
                placeholder="Type your message here... Note: SMS messages will be split if over 160 characters."
                value={broadcastForm.message}
                onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Estimated reach: ~{broadcastForm.audience === 'All Staff' ? totalTeachers : broadcastForm.audience === 'All Students' ? totalStudents : totalStudents} recipients. Broadcasts are dispatched within 2-5 minutes of queuing.
            </div>
          </div>
        </Modal>
      )}
    </SneatPage>
  );
}



