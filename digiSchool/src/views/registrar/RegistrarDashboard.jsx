/**
 * Registrar dashboard — Sneat design system.
 *
 * THE METRIC THIS DASHBOARD IS ACCOUNTABLE TO: students admitted against the
 * school's admission target (Settings → Targets). The registrar's job is to
 * fill the roll and keep the register clean, so the spotlight tracks intake
 * and the tiles below cover capacity, record completeness and class balance.
 */

import { useMemo, useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  UserPlus, Users, UserCheck, IdCard, School, AlertTriangle,
  ArrowLeftRight, PieChart as PieIcon, ClipboardList,
} from 'lucide-react';
import { expandClassesWithStreams } from '../../data/seed';
import { computeTargetMetrics, getTargets, computeEnrolmentMetrics } from '../../lib/targets';
import { fetchTable } from '../../lib/api';
import { reportError } from '../../lib/errorReporter';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, TargetCard,
  Spotlight, ChartCard, SnBar, SnDonut, TableCard, RankList,
  SnBadge, SnButton, SnEmpty, SNEAT,
} from '../../components/sneat';

const ACTIVE = (s) =>
  !['Inactive', 'Graduated', 'Archived', 'Withdrawn', 'Pending'].includes(s.status);

export default function RegistrarDashboard() {
  const context = useOutletContext() || {};
  const store = context.store || {};
  const navigate = useNavigate();
  const settings = store.settings || {};

  const [admissions, setAdmissions] = useState([]);

  useEffect(() => {
    fetchTable('admissions')
      .then(setAdmissions)
      .catch((e) => reportError(e, 'views.RegistrarDashboard'));
  }, []);

  const allStudents = store.students || [];
  const activeStudents = useMemo(() => allStudents.filter(ACTIVE), [allStudents]);
  const classes = useMemo(
    () => expandClassesWithStreams(settings?.classes || []),
    [settings]
  );

  const targets = getTargets(settings);

  // Admissions recorded this calendar year — the registrar's intake number.
  const admittedThisYear = useMemo(() => {
    const year = new Date().getFullYear();
    const fromStudents = allStudents.filter((s) => {
      const d = s.admission_date || s.created_at || s.date_joined;
      return d && new Date(d).getFullYear() === year;
    }).length;
    const fromAdmissions = admissions.filter((a) => {
      const d = a.date || a.created_at;
      return d && new Date(d).getFullYear() === year;
    }).length;
    return Math.max(fromStudents, fromAdmissions);
  }, [allStudents, admissions]);

  const metrics = useMemo(() => computeTargetMetrics({
    settings,
    students: activeStudents,
    teachers: store.teachers || [],
    classes,
    timetables: store.timetables || {},
    admittedThisYear,
  }), [settings, activeStudents, store.teachers, classes, store.timetables, admittedThisYear]);

  // ── register health ──────────────────────────────────────────────────────
  const male = activeStudents.filter((s) => s.gender === 'Male').length;
  const female = activeStudents.filter((s) => s.gender === 'Female').length;
  const flagged = activeStudents.filter((s) => s.flagged).length;
  const pendingAdmissions = admissions.filter((a) => a.status === 'Pending').length;
  const unassigned = activeStudents.filter((s) => !s.class).length;

  /** Records missing a field the Ministry's NEMIS upload requires. */
  const incompleteRecords = useMemo(() => activeStudents.filter(
    (s) => !s.adm || !s.upi || !s.birth_cert || !s.gender || !s.class
  ), [activeStudents]);
  const completePct = activeStudents.length
    ? ((activeStudents.length - incompleteRecords.length) / activeStudents.length) * 100
    : 0;

  const byClass = useMemo(() => {
    const rows = {};
    classes.forEach((c) => { rows[c] = { name: c, students: 0 }; });
    activeStudents.forEach((s) => {
      const k = s.class || 'Unassigned';
      rows[k] ||= { name: k, students: 0 };
      rows[k].students += 1;
    });
    return Object.values(rows).sort((a, b) => b.students - a.students);
  }, [activeStudents, classes]);

  const recentAdmissions = useMemo(() => [...admissions]
    .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
    .slice(0, 6), [admissions]);

  const enrolment = useMemo(
    () => computeEnrolmentMetrics(settings, activeStudents.length),
    [settings, activeStudents.length]
  );

  const goal = targets.admissionTarget > 0 ? targets.admissionTarget : targets.enrolmentCapacity;

  return (
    <SneatPage
      flush
      title="Registrar"
      subtitle={`Admissions, enrolment and student records — ${settings?.name || 'School'}`}
      actions={
        <>
          <SnButton variant="primary" onClick={() => navigate('enroll')}>
            <UserPlus size={15} /> New enrolment
          </SnButton>
          <SnButton variant="outline" onClick={() => navigate('transfers')}>
            <ArrowLeftRight size={15} /> Transfers & exits
          </SnButton>
        </>
      }
    >
      {/* THE metric */}
      <Spotlight
        icon={<UserPlus size={13} />}
        eyebrow={`Admissions — ${new Date().getFullYear()}`}
        value={goal > 0 ? `${admittedThisYear} / ${goal}` : String(admittedThisYear)}
        caption={
          goal > 0
            ? `${admittedThisYear} student${admittedThisYear === 1 ? '' : 's'} admitted against a target of ${goal}. ` +
              `${Math.max(0, goal - admittedThisYear)} place${goal - admittedThisYear === 1 ? '' : 's'} left to fill.`
            : `${admittedThisYear} student${admittedThisYear === 1 ? '' : 's'} admitted this year. ` +
              'Set an admission target in Settings → Targets to track progress.'
        }
        progress={metrics.admissions.pct}
        target={{ label: 'Admission target', value: goal > 0 ? `${goal} students` : 'not set' }}
        stats={[
          { label: 'Total on register', value: activeStudents.length },
          { label: 'Pending applications', value: pendingAdmissions },
          { label: 'Records complete', value: `${completePct.toFixed(0)}%` },
        ]}
      />

      {/* Targets this office owns */}
      <Grid cols={4}>
        <TargetCard metric={metrics.admissions} label="Admissions vs target" icon={<UserPlus />} />
        <TargetCard metric={metrics.enrolment} label="Enrolment vs capacity" icon={<School />} />
        <MetricCard
          label="Record completeness" value={`${completePct.toFixed(1)}%`}
          icon={<IdCard />} tone={completePct >= 95 ? 'success' : completePct >= 80 ? 'warning' : 'danger'}
          foot={`${incompleteRecords.length} record${incompleteRecords.length === 1 ? '' : 's'} missing NEMIS fields`}
          progress={{ value: completePct, max: 100, tone: completePct >= 95 ? 'success' : 'warning' }}
        />
        <MetricCard
          label="Unassigned students" value={unassigned}
          icon={<AlertTriangle />} tone={unassigned > 0 ? 'danger' : 'success'}
          foot={unassigned > 0 ? 'Not yet placed in a class' : 'Every student has a class'}
        />
      </Grid>

      {/* Register composition */}
      <Grid cols={4}>
        <MetricCard
          label="Students enrolled"
          value={enrolment.expected > 0 ? `${enrolment.actual} / ${enrolment.expected}` : String(enrolment.actual)}
          icon={<Users />} tone={enrolment.status}
          foot={
            enrolment.expected > 0
              ? `${enrolment.term} plan${enrolment.variance < 0 ? ` · ${Math.abs(enrolment.variance)} short` : enrolment.variance > 0 ? ` · ${enrolment.variance} over` : ' · on plan'}`
              : 'No term target set'
          }
          progress={enrolment.expected > 0 ? { value: enrolment.pct, max: 100, tone: enrolment.status } : undefined}
        />
        <MetricCard label="Male" value={male} icon={<UserCheck />} tone="info"
          foot={activeStudents.length ? `${((male / activeStudents.length) * 100).toFixed(0)}% of roll` : '—'} />
        <MetricCard label="Female" value={female} icon={<UserCheck />} tone="secondary"
          foot={activeStudents.length ? `${((female / activeStudents.length) * 100).toFixed(0)}% of roll` : '—'} />
        <MetricCard label="Flagged records" value={flagged} icon={<AlertTriangle />}
          tone={flagged > 0 ? 'warning' : 'success'} foot="Need review" />
      </Grid>

      <Grid cols="8-4">
        <ChartCard title="Students per class" subtitle="Where the roll sits" height={300}>
          {byClass.length > 0 ? (
            <SnBar data={byClass} xKey="name" series={[{ key: 'students', name: 'Students' }]} />
          ) : (
            <SnBar data={[{ name: 'No classes', students: 0 }]} xKey="name" series={[{ key: 'students', name: 'Students' }]} />
          )}
        </ChartCard>

        <ChartCard title="Gender balance" subtitle="Active register" height={300} raw>
          <SnDonut
            data={[
              { name: 'Male', value: male, color: SNEAT.info },
              { name: 'Female', value: female, color: SNEAT.primary },
            ]}
            centerValue={String(activeStudents.length)}
            centerLabel="students"
          />
        </ChartCard>
      </Grid>

      <Grid cols="4-8">
        <Card>
          <CardHead title="Class placement" subtitle="Students placed per class"
            action={<SnButton variant="ghost" onClick={() => navigate('')}>Register</SnButton>} />
          <CardBody>
            <RankList
              empty={<SnEmpty icon={<School />} title="No classes yet"
                message="Add classes in Settings → Academic to place students." />}
              items={byClass.slice(0, 6).map((c) => ({
                id: c.name,
                title: c.name,
                sub: `${c.students} student${c.students === 1 ? '' : 's'}`,
                value: String(c.students),
                icon: <School />,
                tone: c.name === 'Unassigned' ? 'danger' : 'primary',
                progress: byClass[0]?.students ? (c.students / byClass[0].students) * 100 : 0,
              }))}
            />
          </CardBody>
        </Card>

        <TableCard
          title="Recent admissions"
          subtitle="Latest applications and enrolments"
          action={<SnButton variant="ghost" onClick={() => navigate('enroll')}>New enrolment</SnButton>}
          rows={recentAdmissions}
          rowKey={(a, i) => a.id || i}
          empty={<SnEmpty icon={<ClipboardList />} title="No admissions recorded"
            message="New applications and enrolments will appear here." />}
          columns={[
            { key: 'name', header: 'Applicant', render: (a) => <span className="sn-td-strong">{a.name || a.student_name || '—'}</span> },
            { key: 'class', header: 'Class', render: (a) => a.class || a.applying_for || '—' },
            { key: 'date', header: 'Date', render: (a) => (a.date || a.created_at || '').toString().slice(0, 10) || '—' },
            {
              key: 'status', header: 'Status',
              render: (a) => (
                <SnBadge tone={a.status === 'Admitted' ? 'success' : a.status === 'Rejected' ? 'danger' : 'warning'}>
                  {a.status || 'Pending'}
                </SnBadge>
              ),
            },
          ]}
        />
      </Grid>

      {/* Records that would fail a NEMIS upload */}
      {incompleteRecords.length > 0 && (
        <TableCard
          title="Records needing attention"
          subtitle="Missing a field required for NEMIS export"
          action={<SnButton variant="ghost" onClick={() => navigate('')}>Open register</SnButton>}
          rows={incompleteRecords.slice(0, 8)}
          rowKey={(s) => s.id}
          columns={[
            { key: 'name', header: 'Student', render: (s) => <span className="sn-td-strong">{s.name}</span> },
            { key: 'adm', header: 'Adm no', render: (s) => s.adm || <SnBadge tone="danger">missing</SnBadge> },
            { key: 'upi', header: 'UPI', render: (s) => s.upi || <SnBadge tone="danger">missing</SnBadge> },
            { key: 'birth_cert', header: 'Birth cert', render: (s) => s.birth_cert || <SnBadge tone="danger">missing</SnBadge> },
            { key: 'class', header: 'Class', render: (s) => s.class || <SnBadge tone="danger">unassigned</SnBadge> },
          ]}
        />
      )}
    </SneatPage>
  );
}
