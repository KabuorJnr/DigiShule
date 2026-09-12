/**
 * Director of Studies — metrics dashboard.
 *
 * THE METRIC THIS DASHBOARD IS ACCOUNTABLE TO: how many classes are meeting
 * their own yearly mean target (set per class, per year in Settings →
 * Targets; streams inherit their level's target).
 *
 * This screen is deliberately METRICS ONLY. The DoS's working tools — merit
 * lists, the student register, faculty records, the marks-audit matrix and
 * the approvals queue — live in their own modules; this page reports on them
 * and links out, rather than embedding them. Keeping it read-only is what
 * makes it scannable.
 */

import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchStudents } from '../lib/api';
import { computeClassMeanMetrics, computeTargetMetrics } from '../lib/targets';
import { studentOverall } from '../utils/grading';
import { SUBJECTS, expandClassesWithStreams } from '../data/seed';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Download, FileText, CheckCircle, Users, BookOpen, Award, AlertTriangle,
  RefreshCw, Layers, CalendarDays, UserCheck, ClipboardCheck, Gauge,
} from 'lucide-react';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, TargetCard,
  Spotlight, ChartCard, SnBar, SnDonut, ClassMeanTable, RankList,
  SnButton, SnEmpty, SNEAT,
} from '../components/sneat';

export default function DosDashboard({ store, user }) {
  const { navigate, notify, settings, teachers = [], examSchedules = [], timetables = {} } = store;

  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [examPapers, setExamPapers] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentSchoolId = user?.school_id || store?.schoolId || store?.settings?.id;

  const fetchAllDosData = async () => {
    setLoading(true);
    try {
      const { data: studentData } = await fetchStudents(0, 2000, { activeOnly: true });
      setStudents(studentData ? studentData.filter(s => s.status === 'Active') : []);
    } catch (e) { console.warn('DoS student fetch error:', e); }

    try {
      let q = supabase.from('profiles').select('*');
      if (currentSchoolId) q = q.eq('school_id', currentSchoolId);
      q = q.in('role', ['teacher', 'dos', 'deputy_academic', 'principal', 'deputy_admin', 'registrar', 'finance', 'accountant', 'librarian', 'clinic']);
      const { data } = await q;
      if (data && data.length > 0) setStaff(data);
    } catch (e) { console.warn('DoS staff fetch error:', e); }

    try {
      let q = supabase.from('approval_queue').select('*');
      if (currentSchoolId) q = q.eq('school_id', currentSchoolId);
      const { data } = await q;
      if (data) setApprovals(data);
    } catch (e) { console.warn('DoS approvals fetch error:', e); }

    try {
      let q = supabase.from('exam_papers').select('*');
      if (currentSchoolId) q = q.eq('school_id', currentSchoolId);
      const { data } = await q;
      if (data) setExamPapers(data);
    } catch (e) { console.warn('DoS exam papers fetch error:', e); }

    try {
      let q = supabase.from('syllabus_coverage_snapshots').select('*');
      if (currentSchoolId) q = q.eq('school_id', currentSchoolId);
      const { data } = await q;
      if (data) setCoverage(data);
    } catch (e) { console.warn('DoS coverage fetch error:', e); }

    try {
      let q = supabase.from('lesson_observations').select('*');
      if (currentSchoolId) q = q.eq('school_id', currentSchoolId);
      const { data } = await q;
      if (data) setObservations(data);
    } catch (e) { console.warn('DoS observations fetch error:', e); }

    setLoading(false);
  };

  useEffect(() => { fetchAllDosData(); }, [currentSchoolId]);

  // ── source data ──────────────────────────────────────────────────────────
  const rawStudents = useMemo(() => {
    if (students?.length > 0) return students;
    if (store?.students?.length > 0) return store.students;
    return [];
  }, [store?.students, students]);

  const activeStudents = useMemo(
    () => rawStudents.filter(s => !['Inactive', 'Graduated', 'Archived', 'Withdrawn', 'Pending'].includes(s.status)),
    [rawStudents]
  );

  const rawStaff = useMemo(() => {
    if (store?.teachers?.length > 0) return store.teachers;
    return staff || [];
  }, [store?.teachers, staff]);

  const dynamicClasses = useMemo(
    () => expandClassesWithStreams(settings?.classes || []),
    [settings]
  );

  const activeTeacherList = useMemo(() => {
    const list = teachers.length > 0 ? teachers : rawStaff;
    return list.filter(t => t.status !== 'Inactive');
  }, [teachers, rawStaff]);

  const activeTeachers = useMemo(
    () => activeTeacherList.filter(t => t.status === 'Active').length,
    [activeTeacherList]
  );

  // ── academic metrics ─────────────────────────────────────────────────────
  const meanByClass = useMemo(() => {
    const rows = {};
    activeStudents.forEach((st) => {
      const k = st.class || 'Unassigned';
      rows[k] ||= { name: k, total: 0, n: 0 };
      rows[k].total += studentOverall(st, SUBJECTS);
      rows[k].n += 1;
    });
    return Object.values(rows)
      .map(r => ({ name: r.name, mean: r.n ? Number((r.total / r.n).toFixed(1)) : 0, students: r.n }))
      .sort((a, b) => b.mean - a.mean);
  }, [activeStudents]);

  const classMeanMetrics = useMemo(
    () => computeClassMeanMetrics(settings, meanByClass),
    [settings, meanByClass]
  );

  const schoolMean = useMemo(() => {
    if (!activeStudents.length) return 0;
    return activeStudents.reduce((a, s) => a + studentOverall(s, SUBJECTS), 0) / activeStudents.length;
  }, [activeStudents]);

  const meanBySubject = useMemo(() => SUBJECTS.map((sub) => {
    let total = 0; let n = 0;
    activeStudents.forEach((s) => {
      const sc = s.scores?.[sub];
      const v = typeof sc === 'number' ? sc : Number(sc?.average ?? sc?.score ?? 0);
      if (v > 0) { total += v; n += 1; }
    });
    return { name: sub, mean: n ? Number((total / n).toFixed(1)) : 0, entries: n };
  }).filter(r => r.entries > 0).sort((a, b) => b.mean - a.mean), [activeStudents]);

  // ── marks entry ──────────────────────────────────────────────────────────
  const marksAudit = useMemo(() => {
    const results = [];
    dynamicClasses.forEach(cls => {
      const inClass = activeStudents.filter(s => s.class === cls);
      if (inClass.length === 0) return;
      let entered = 0; let total = 0;
      SUBJECTS.forEach(sub => {
        entered += inClass.filter(s => {
          const sc = s.scores?.[sub];
          if (!sc) return false;
          if (typeof sc === 'number') return true;
          return ['score', 'average', 'a1', 'a2', 'a3', 'a4'].some(k => sc[k] !== undefined && sc[k] !== '');
        }).length;
        total += inClass.length;
      });
      results.push({
        class: cls, entered, total,
        pct: total > 0 ? Math.round((entered / total) * 100) : 0,
        students: inClass.length,
      });
    });
    return results;
  }, [dynamicClasses, activeStudents]);

  const overallMarksPct = useMemo(() => {
    const e = marksAudit.reduce((a, b) => a + b.entered, 0);
    const t = marksAudit.reduce((a, b) => a + b.total, 0);
    return t > 0 ? Math.round((e / t) * 100) : 0;
  }, [marksAudit]);

  // ── workload & quality queue ─────────────────────────────────────────────
  const teacherWorkload = useMemo(() => {
    const counts = {};
    Object.values(timetables).forEach(tt => {
      if (!tt.grid) return;
      tt.grid.forEach(row => row.forEach(cell => {
        if (cell && cell.type === 'lesson' && cell.teacher) {
          counts[cell.teacher] = (counts[cell.teacher] || 0) + 1;
        }
      }));
    });
    const valid = new Set(activeTeacherList.map(t => String(t.name || '').toLowerCase()));
    return Object.entries(counts)
      .filter(([name]) => valid.has(name.toLowerCase()))
      .map(([name, periods]) => ({ name, periods, isOverload: periods > 27 }))
      .sort((a, b) => b.periods - a.periods);
  }, [timetables, activeTeacherList]);

  const overloadedCount = teacherWorkload.filter(t => t.isOverload).length;
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;
  const pendingPapersCount = examPapers.filter(p => p.moderation_status === 'pending').length;
  const totalPendingActionCount = pendingApprovalsCount + pendingPapersCount;

  /** Average syllabus coverage from the latest snapshots. */
  const syllabusPct = useMemo(() => {
    if (!coverage.length) return null;
    const vals = coverage.map(c => Number(c.coverage_pct ?? c.percent ?? c.pct ?? 0)).filter(n => n > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [coverage]);

  // Timetable + teacher-allocation coverage against the school's targets.
  const opsMetrics = useMemo(() => computeTargetMetrics({
    settings,
    students: activeStudents,
    teachers: activeTeacherList,
    classes: dynamicClasses,
    timetables,
    subjects: settings?.subjects?.length ? settings.subjects : SUBJECTS,
    classMeans: meanByClass,
  }), [settings, activeStudents, activeTeacherList, dynamicClasses, timetables, meanByClass]);

  const genderDist = useMemo(() => ({
    male: activeStudents.filter(s => s.gender === 'Male').length,
    female: activeStudents.filter(s => s.gender === 'Female').length,
  }), [activeStudents]);

  const classEnrollment = useMemo(() => {
    const map = {};
    activeStudents.forEach(s => { const c = s.class || 'Unassigned'; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([name, students]) => ({ name, students }));
  }, [activeStudents]);

  const handleExportTermlyReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${settings?.name || 'School'} — DoS Termly Metrics`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 14, 25);
    doc.autoTable({
      startY: 32,
      head: [['Class', 'Students', 'Mean %', 'Target %', 'Gap', 'Marks entered %']],
      body: classMeanMetrics.rows.map(r => {
        const audit = marksAudit.find(m => m.class === r.name);
        return [r.name, r.students ?? '-', r.mean.toFixed(1), r.target, r.gap.toFixed(1), audit ? `${audit.pct}%` : '-'];
      }),
    });
    doc.save(`DoS_Metrics_${new Date().toISOString().slice(0, 10)}.pdf`);
    notify?.('Termly metrics exported', 'success', 'DoS');
  };

  return (
    <SneatPage
      flush
      title="Director of Studies"
      subtitle={`${settings?.name || 'School'} · Academic performance at a glance`}
      actions={
        <>
          <SnButton variant="outline" onClick={fetchAllDosData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </SnButton>
          <SnButton variant="primary" onClick={handleExportTermlyReport}>
            <Download size={14} /> Export metrics
          </SnButton>
        </>
      }
    >
      {/* THE metric */}
      <Spotlight
        icon={<Award size={13} />}
        eyebrow={`Classes meeting their mean target — ${classMeanMetrics.year}`}
        value={`${classMeanMetrics.met} / ${classMeanMetrics.total}`}
        caption={
          classMeanMetrics.total === 0
            ? 'No class means yet — they appear once marks are entered. Set per-class targets in Settings → Targets.'
            : (classMeanMetrics.worst && !classMeanMetrics.worst.met
                ? `${classMeanMetrics.worst.name} is furthest behind at ${classMeanMetrics.worst.mean.toFixed(1)}% against a ${classMeanMetrics.worst.target}% target. `
                : 'Every class is at or above its target. ') +
              `School mean ${schoolMean.toFixed(1)}% · ${overallMarksPct}% of marks are in.`
        }
        progress={classMeanMetrics.pct}
        target={{ label: 'Classes on target', value: `${classMeanMetrics.met} of ${classMeanMetrics.total}` }}
        stats={[
          { label: 'School mean', value: `${schoolMean.toFixed(1)}%` },
          { label: 'Marks completion', value: `${overallMarksPct}%` },
          { label: 'Pending moderation', value: totalPendingActionCount },
        ]}
      />

      {/* Academic quality */}
      <Grid cols={4}>
        <MetricCard
          label="Classes on mean target" value={`${classMeanMetrics.met} / ${classMeanMetrics.total}`}
          icon={<Award />} tone={classMeanMetrics.rollup.status}
          foot={`${classMeanMetrics.year} targets`}
          progress={{ value: classMeanMetrics.pct, max: 100, tone: classMeanMetrics.rollup.status }}
        />
        <MetricCard
          label="School mean score" value={`${schoolMean.toFixed(1)}%`}
          icon={<Gauge />} tone="primary"
          foot={`${activeStudents.length} students · reference only`}
        />
        <MetricCard
          label="Marks completion" value={`${overallMarksPct}%`}
          icon={<CheckCircle />} tone={overallMarksPct >= 80 ? 'success' : overallMarksPct >= 40 ? 'warning' : 'danger'}
          foot="Score entry progress"
          progress={{ value: overallMarksPct, max: 100, tone: overallMarksPct >= 80 ? 'success' : 'warning' }}
        />
        <MetricCard
          label="Syllabus coverage" value={syllabusPct !== null ? `${syllabusPct}%` : '—'}
          icon={<BookOpen />} tone={syllabusPct === null ? 'secondary' : syllabusPct >= 70 ? 'success' : 'warning'}
          foot={syllabusPct === null ? 'No snapshots recorded' : 'Latest snapshots'}
          progress={syllabusPct !== null ? { value: syllabusPct, max: 100 } : undefined}
        />
      </Grid>

      {/* Capacity & allocation */}
      <Grid cols={4}>
        <MetricCard label="Active students" value={activeStudents.length} icon={<Users />} tone="primary" foot="On the register" />
        <MetricCard label="Teaching faculty" value={activeTeacherList.length} icon={<UserCheck />} tone="info" foot={`${activeTeachers} active`} />
        <TargetCard metric={opsMetrics.timetables} label="Timetable coverage" icon={<CalendarDays />} />
        <TargetCard metric={opsMetrics.classTeachers} label="Class-teacher coverage" icon={<Layers />} />
      </Grid>

      {/* Moderation queue */}
      <Grid cols={4}>
        <MetricCard
          label="Pending approvals" value={pendingApprovalsCount}
          icon={<ClipboardCheck />} tone={pendingApprovalsCount > 0 ? 'warning' : 'success'}
          foot="Schemes & lesson plans"
        />
        <MetricCard
          label="Papers to moderate" value={pendingPapersCount}
          icon={<FileText />} tone={pendingPapersCount > 0 ? 'warning' : 'success'}
          foot="Exam papers pending"
        />
        <MetricCard
          label="Overloaded staff" value={overloadedCount}
          icon={<AlertTriangle />} tone={overloadedCount > 0 ? 'danger' : 'success'}
          foot="More than 27 periods/week"
        />
        <MetricCard
          label="Lesson observations" value={observations.length}
          icon={<ClipboardCheck />} tone="secondary" foot="Recorded this term"
        />
      </Grid>

      {/* Where the mean comes from */}
      <Grid cols={2}>
        <Card>
          <CardHead
            title="Mean score by class"
            subtitle={`Each class against its own ${classMeanMetrics.year} target`}
            action={<SnButton variant="ghost" onClick={() => navigate && navigate('settings')}>Set targets</SnButton>}
          />
          <CardBody>
            <ClassMeanTable
              rows={classMeanMetrics.rows}
              empty={<SnEmpty icon={<Award />} title="No class means yet"
                message="Means appear here once teachers enter marks." />}
            />
          </CardBody>
        </Card>

        <ChartCard title="Mean score by subject" subtitle="Strongest to weakest" height={300}>
          {meanBySubject.length > 0 ? (
            <SnBar data={meanBySubject} xKey="name" series={[{ key: 'mean', name: 'Mean %', color: SNEAT.info }]} />
          ) : (
            <SnBar data={[{ name: 'No marks yet', mean: 0 }]} xKey="name" series={[{ key: 'mean', name: 'Mean %' }]} />
          )}
        </ChartCard>
      </Grid>

      <Grid cols="8-4">
        <ChartCard title="Marks entry by class" subtitle="Percent of score slots filled" height={300}>
          {marksAudit.length > 0 ? (
            <SnBar data={marksAudit.map(m => ({ name: m.class, pct: m.pct }))} xKey="name"
              series={[{ key: 'pct', name: 'Entered %' }]} />
          ) : (
            <SnBar data={[{ name: 'No classes', pct: 0 }]} xKey="name" series={[{ key: 'pct', name: 'Entered %' }]} />
          )}
        </ChartCard>

        <ChartCard title="Gender balance" subtitle="Active register" height={300} raw>
          <SnDonut
            data={[
              { name: 'Male', value: genderDist.male, color: SNEAT.info },
              { name: 'Female', value: genderDist.female, color: SNEAT.primary },
            ]}
            centerValue={String(activeStudents.length)}
            centerLabel="students"
          />
        </ChartCard>
      </Grid>

      <Grid cols={2}>
        <ChartCard title="Enrolment by class" height={300}>
          {classEnrollment.length > 0 ? (
            <SnBar data={classEnrollment} xKey="name" series={[{ key: 'students', name: 'Students' }]} />
          ) : (
            <SnBar data={[{ name: 'No students', students: 0 }]} xKey="name" series={[{ key: 'students', name: 'Students' }]} />
          )}
        </ChartCard>

        <Card>
          <CardHead title="Teacher workload" subtitle="Periods per week · over 27 is an overload"
            action={<SnButton variant="ghost" onClick={() => navigate && navigate('timetable')}>Timetable</SnButton>} />
          <CardBody>
            <RankList
              empty={<SnEmpty icon={<Users />} title="No workload data"
                message="Publish class timetables to see period loads." />}
              items={teacherWorkload.slice(0, 6).map(t => ({
                id: t.name,
                title: t.name,
                sub: `${t.periods} period${t.periods === 1 ? '' : 's'} / week`,
                value: String(t.periods),
                icon: <UserCheck />,
                tone: t.isOverload ? 'danger' : 'primary',
                progress: Math.min(100, (t.periods / 32) * 100),
              }))}
            />
          </CardBody>
        </Card>
      </Grid>
    </SneatPage>
  );
}
