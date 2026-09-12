/**
 * Academics dashboard — Sneat design system.
 *
 * THE METRIC THIS DASHBOARD IS ACCOUNTABLE TO: how many classes are meeting
 * their own yearly mean target. A single school-wide mean is not actionable —
 * Form 1 and Form 4 are judged differently — so targets are set per class and
 * per year in Settings → Targets, and this dashboard scores against them.
 * Everything below explains the number: which classes are behind, which
 * subjects drag, how much of the data is actually in (marks completion gates
 * the mean's trustworthiness), and the merit/audit/slip tools that act on it.
 *
 * All computation is carried over unchanged; only presentation was rebuilt.
 */

import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { exportTablePDF, downloadExcel } from '../utils/exporters';
import { studentOverall, gradeFor, pointsForGrade, subjectAverage, is844Class } from '../utils/grading';
import { SUBJECTS, expandClassesWithStreams } from '../data/seed';
import ReportCardModal from '../components/ReportCardModal';
import MeritListModule from '../components/MeritListModule';
import WeeklyBrief from '../components/WeeklyBrief';
import BenchmarkCard from '../components/BenchmarkCard';
import StreamPerformanceGraph from '../components/StreamPerformanceGraph';
import AcademicAnalytics from '../components/AcademicAnalytics';
import ClassSubjectAnalysis from '../components/ClassSubjectAnalysis';
import {
  Download, FileText, Award, CheckCircle2, AlertTriangle, Printer,
  Users, BookOpen, Search, Grid3x3, Layers,
} from 'lucide-react';
import { reportError } from '../lib/errorReporter';
import { computeClassMeanMetrics } from '../lib/targets';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, Spotlight,
  ChartCard, SnBar, TableCard, Tabs, ProgressMetric,
  SnBadge, SnButton, SnEmpty, SNEAT, ClassMeanChart,
} from '../components/sneat';

export default function AcademicsDashboard({ store = {}, user = {} }) {
  const { navigate = (() => {}), notify = (() => {}), settings = {}, teachers = [], examSchedules = [] } = store || {};
  const [students, setStudents] = useState([]);
  const [awaitingApprovalCount, setAwaitingApprovalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');

  const rawStudents = useMemo(() => {
    if (store?.students && Array.isArray(store.students) && store.students.length > 0) return store.students;
    return students || [];
  }, [store?.students, students]);

  const activeStudentsList = useMemo(() => rawStudents.filter(
    (s) => !['Inactive', 'Graduated', 'Archived', 'Withdrawn', 'Pending'].includes(s.status)
  ), [rawStudents]);

  const rawStaff = useMemo(() => {
    if (store?.teachers && Array.isArray(store.teachers) && store.teachers.length > 0) return store.teachers;
    return teachers || [];
  }, [store?.teachers, teachers]);

  const dynamicClasses = useMemo(
    () => expandClassesWithStreams(settings?.classes || []),
    [settings]
  );

  useEffect(() => {
    import('../lib/api').then(({ fetchStudents }) => {
      fetchStudents(0, 2000, { activeOnly: true })
        .then((r) => setStudents(r.data || []))
        .catch((e) => reportError(e, 'views.AcademicsDashboard'));
    });

    (async () => {
      try {
        const { count } = await supabase.from('approval_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setAwaitingApprovalCount(count || 0);
      } catch (e) {
        console.warn('Failed to load approvals:', e);
      }
    })();
  }, [store?.schoolId]);

  const activeTeacherList = useMemo(() => rawStaff.filter((t) => t.status !== 'Inactive'), [rawStaff]);
  const activeTeachers = useMemo(() => activeTeacherList.filter((t) => t.status === 'Active').length, [activeTeacherList]);
  const classesCount = dynamicClasses.length;

  // ── merit ranking ────────────────────────────────────────────────────────
  const meritList = useMemo(() => {
    const listToRank = selectedClass === 'All'
      ? activeStudentsList
      : activeStudentsList.filter((s) => s.class === selectedClass);

    const evaluated = listToRank.map((s) => {
      const is844 = is844Class(s.class);
      const overallScore = studentOverall(s, SUBJECTS);
      const meanGradeCode = gradeFor(overallScore, store?.gradeBoundaries, is844 ? '844' : 'CBC');
      const meanPoints = pointsForGrade(meanGradeCode, is844 ? '844' : 'CBC');
      let totalMarks = 0;
      SUBJECTS.forEach((sub) => { totalMarks += subjectAverage(s.scores?.[sub]); });
      return { ...s, totalMarks, meanPercentage: overallScore, meanGradeCode, meanPoints, rawStudent: s };
    });

    evaluated.sort((a, b) => b.meanPercentage - a.meanPercentage);

    let currentRank = 1;
    return evaluated.map((s, idx, arr) => {
      if (idx > 0 && Math.abs(s.meanPercentage - arr[idx - 1].meanPercentage) < 0.01) {
        return { ...s, streamPosition: arr[idx - 1].streamPosition };
      }
      currentRank = idx + 1;
      return { ...s, streamPosition: currentRank };
    });
  }, [activeStudentsList, selectedClass, store?.gradeBoundaries]);

  // ── THE metric ───────────────────────────────────────────────────────────
  const schoolMeanValue = useMemo(() => {
    if (activeStudentsList.length === 0) return 0;
    const sum = activeStudentsList.reduce((acc, s) => acc + studentOverall(s, SUBJECTS), 0);
    return sum / activeStudentsList.length;
  }, [activeStudentsList]);

  const schoolOverallMean = `${schoolMeanValue.toFixed(1)}%`;

  /** Mean per class — shows which streams move the school mean. */
  const meanByClass = useMemo(() => {
    const rows = {};
    activeStudentsList.forEach((s) => {
      const k = s.class || 'Unassigned';
      rows[k] ||= { name: k, total: 0, n: 0 };
      rows[k].total += studentOverall(s, SUBJECTS);
      rows[k].n += 1;
    });
    return Object.values(rows)
      .map((r) => ({ name: r.name, mean: r.n ? Number((r.total / r.n).toFixed(1)) : 0, students: r.n }))
      .sort((a, b) => b.mean - a.mean);
  }, [activeStudentsList]);

  /**
   * Each class against ITS OWN yearly mean target (Settings → Targets).
   * A single school-wide mean would hide that Form 1 and Form 4 are judged
   * differently, so this is the real academic scorecard.
   */
  const classMeanMetrics = useMemo(
    () => computeClassMeanMetrics(settings, meanByClass),
    [settings, meanByClass]
  );

  /** Mean per subject — the other axis of the same number. */
  const meanBySubject = useMemo(() => SUBJECTS.map((sub) => {
    let total = 0; let n = 0;
    activeStudentsList.forEach((s) => {
      const avg = subjectAverage(s.scores?.[sub]);
      if (avg > 0) { total += avg; n += 1; }
    });
    return { name: sub, mean: n ? Number((total / n).toFixed(1)) : 0, entries: n };
  }).filter((r) => r.entries > 0).sort((a, b) => b.mean - a.mean), [activeStudentsList]);

  // ── marks audit ──────────────────────────────────────────────────────────
  const marksAuditMatrix = useMemo(() => {
    const matrix = [];
    const classesToAudit = selectedClass === 'All' ? dynamicClasses : [selectedClass];

    classesToAudit.forEach((cls) => {
      const studentsInClass = activeStudentsList.filter((s) => s.class === cls);
      if (studentsInClass.length === 0) return;

      SUBJECTS.forEach((sub) => {
        const teacherAssigned = rawStaff.find(
          (t) => t.subject === sub || t.dept === sub || (t.subjects && t.subjects.includes(sub))
        )?.name || 'Unassigned';

        const enteredCount = studentsInClass.filter((s) => {
          const sc = s.scores?.[sub];
          if (!sc) return false;
          if (typeof sc === 'number') return true;
          return ['score', 'average', 'a1', 'a2', 'a3', 'a4']
            .some((k) => sc[k] !== undefined && sc[k] !== '');
        }).length;

        const pct = Math.round((enteredCount / studentsInClass.length) * 100);
        matrix.push({
          id: `${cls}_${sub}`, class: cls, subject: sub, teacher: teacherAssigned,
          totalStudents: studentsInClass.length, enteredCount, pct,
          status: pct === 100 ? 'Complete' : pct > 0 ? 'In Progress' : 'Pending Entry',
        });
      });
    });
    return matrix;
  }, [dynamicClasses, selectedClass, activeStudentsList, rawStaff]);

  const auditStats = useMemo(() => {
    const totalUnits = marksAuditMatrix.length || 1;
    const completedUnits = marksAuditMatrix.filter((m) => m.status === 'Complete').length;
    const inProgressUnits = marksAuditMatrix.filter((m) => m.status === 'In Progress').length;
    const pendingUnits = marksAuditMatrix.filter((m) => m.status === 'Pending Entry').length;
    return {
      totalUnits, completedUnits, inProgressUnits, pendingUnits,
      overallPct: Math.round((completedUnits / totalUnits) * 100),
    };
  }, [marksAuditMatrix]);

  // ── exporters ────────────────────────────────────────────────────────────
  const handleExportMeritListPDF = () => {
    if (meritList.length === 0) return notify('No students in current merit list selection', 'warning');
    exportTablePDF({
      school: settings,
      title: `OFFICIAL MERIT RANKING - ${selectedClass === 'All' ? 'ALL STREAMS' : selectedClass.toUpperCase()}`,
      subtitle: `Term 2 · Academic Year 2026 | Total Ranked: ${meritList.length}`,
      head: ['Rank', 'Adm No', 'Student Name', 'Class Stream', 'Total Marks', 'Mean %', 'Grade', 'Points'],
      body: meritList.map((s, idx) => [
        s.streamPosition || idx + 1, s.adm || s.admission_no || '-', s.name, s.class,
        s.totalMarks, `${s.meanPercentage.toFixed(1)}%`, s.meanGradeCode, s.meanPoints.toFixed(1),
      ]),
      filename: `merit_list_${selectedClass === 'All' ? 'school' : selectedClass.replace(/\s+/g, '_')}.pdf`,
    });
    notify(`Merit list PDF downloaded for ${meritList.length} student(s)`, 'success');
  };

  const handleExportMeritListExcel = () => {
    if (meritList.length === 0) return notify('No students in current merit list selection', 'warning');
    const aoa = [['Rank', 'Adm No', 'Student Name', 'Class Stream', 'Total Marks', 'Mean %', 'Grade', 'Points']];
    meritList.forEach((s, idx) => {
      aoa.push([
        s.streamPosition || idx + 1, s.adm || s.admission_no || '-', s.name, s.class,
        s.totalMarks, Number(s.meanPercentage.toFixed(1)), s.meanGradeCode, Number(s.meanPoints.toFixed(1)),
      ]);
    });
    downloadExcel(`Merit_List_${selectedClass}.xlsx`, [{ name: 'Merit Ranking', aoa }]);
    notify('Merit list Excel export complete', 'success');
  };

  const handleExportAuditPDF = () => {
    if (marksAuditMatrix.length === 0) return notify('No audit records to export', 'warning');
    exportTablePDF({
      school: settings,
      title: 'MARKS ENTRY VERIFICATION AUDIT REGISTER',
      subtitle: `Term 2 · Academic Year 2026 | Class Scope: ${selectedClass}`,
      head: ['Class', 'Subject', 'Teacher', 'Entered', 'Total', 'Completion %', 'Status'],
      body: marksAuditMatrix.map((m) => [m.class, m.subject, m.teacher, m.enteredCount, m.totalStudents, `${m.pct}%`, m.status]),
      filename: `Marks_Audit_${selectedClass}.pdf`,
    });
    notify('Marks audit PDF downloaded', 'success');
  };

  const slipRows = useMemo(() => activeStudentsList
    .filter((s) => selectedClass === 'All' || s.class === selectedClass)
    .filter((s) => s.name.toLowerCase().includes(searchStudent.toLowerCase())
      || (s.adm && s.adm.toLowerCase().includes(searchStudent.toLowerCase())))
    .slice(0, 50), [activeStudentsList, selectedClass, searchStudent]);

  const classSelect = (
    <select
      value={selectedClass}
      onChange={(e) => setSelectedClass(e.target.value)}
      style={{ height: 36, borderRadius: 6, border: `1px solid ${SNEAT.border}`, padding: '0 10px', fontSize: 13 }}
    >
      <option value="All">All Streams</option>
      {dynamicClasses.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  return (
    <SneatPage
      flush
      title="Academic performance"
      subtitle={`${settings?.name || 'School'} · Term 2 · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
      actions={
        <>
          <SnButton variant="outline" onClick={() => navigate('gradebook')}>
            <BookOpen size={15} /> Gradebook
          </SnButton>
          <SnButton variant="primary" onClick={handleExportMeritListPDF}>
            <Download size={15} /> Export merit list
          </SnButton>
        </>
      }
    >
      {/* THE metric: classes meeting their own yearly mean target. */}
      <Spotlight
        icon={<Award size={13} />}
        eyebrow={`Classes meeting their mean target — ${classMeanMetrics.year}`}
        value={`${classMeanMetrics.met} / ${classMeanMetrics.total}`}
        caption={
          classMeanMetrics.total === 0
            ? 'No class means yet. They appear once teachers enter marks.'
            : `School mean ${schoolOverallMean} across ${activeStudentsList.length} student${activeStudentsList.length === 1 ? '' : 's'}. ` +
              (classMeanMetrics.worst && !classMeanMetrics.worst.met
                ? `${classMeanMetrics.worst.name} is furthest behind at ${classMeanMetrics.worst.mean.toFixed(1)}% against a ${classMeanMetrics.worst.target}% target. `
                : 'Every class is at or above its target. ') +
              `${auditStats.overallPct}% of marks are in.`
        }
        progress={classMeanMetrics.pct}
        target={{
          label: 'Classes on target',
          value: `${classMeanMetrics.met} of ${classMeanMetrics.total}`,
        }}
        stats={[
          { label: 'School mean', value: schoolOverallMean },
          { label: 'Marks completion', value: `${auditStats.overallPct}%` },
          { label: 'Awaiting approval', value: awaitingApprovalCount },
        ]}
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'class_analysis', label: 'Class & subject analysis' },
          { id: 'merit', label: 'Merit list', count: meritList.length },
          { id: 'audit', label: 'Marks audit', count: `${auditStats.overallPct}%` },
          { id: 'slips', label: 'Result slips', count: activeStudentsList.length },
        ]}
      />

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <>
          <Grid cols={4}>
            <MetricCard label="Enrolled students" value={activeStudentsList.length}
              icon={<Users />} tone="primary" foot="Active registry" />
            <MetricCard label="Teaching faculty" value={activeTeacherList.length}
              icon={<BookOpen />} tone="info" foot={`${activeTeachers} active`} />
            <MetricCard label="Classes & streams" value={`${settings?.classes?.length || 1} / ${classesCount}`}
              icon={<Layers />} tone="secondary" foot="Groups / streams" />
            <MetricCard label="Classes on mean target" value={`${classMeanMetrics.met} / ${classMeanMetrics.total}`}
              icon={<Award />} tone={classMeanMetrics.rollup.status} foot={`${classMeanMetrics.year} targets`}
              progress={{ value: classMeanMetrics.pct, max: 100, tone: classMeanMetrics.rollup.status }} />
          </Grid>

          <Grid cols={4}>
            <MetricCard
              label="Marks completion" value={`${auditStats.overallPct}%`}
              icon={<CheckCircle2 />} tone={auditStats.overallPct >= 80 ? 'success' : 'warning'}
              foot={`${auditStats.completedUnits} of ${auditStats.totalUnits} units`}
              progress={{ value: auditStats.overallPct, max: 100, tone: auditStats.overallPct >= 80 ? 'success' : 'warning' }}
            />
            <MetricCard
              label="Pending entry" value={auditStats.pendingUnits}
              icon={<AlertTriangle />} tone={auditStats.pendingUnits > 0 ? 'danger' : 'success'}
              foot="Class-subject units untouched"
            />
            <MetricCard
              label="Awaiting approval" value={awaitingApprovalCount}
              icon={<FileText />} tone={awaitingApprovalCount > 0 ? 'warning' : 'success'}
              foot="Pending review"
            />
            <MetricCard
              label="Exam schedules" value={examSchedules.length}
              icon={<FileText />} tone="primary" foot="Published exams"
            />
          </Grid>

          {/* What moves the mean */}
          <Grid cols={2}>
            <Card>
              <CardHead
                title="Mean score by class"
                subtitle={`Each class against its own ${classMeanMetrics.year} target`}
                action={<SnButton variant="ghost" onClick={() => navigate('settings')}>Set targets</SnButton>}
              />
              <CardBody>
                <ClassMeanChart
                  rows={classMeanMetrics.rows}
                  empty={<SnEmpty icon={<Award />} title="No class means yet"
                    message="Means appear here once teachers enter marks." />}
                />
              </CardBody>
            </Card>

            <ChartCard title="Mean score by subject" subtitle="Strongest to weakest" height={300}>
              {meanBySubject.length > 0 ? (
                <SnBar data={meanBySubject.slice(0, 10)} xKey="name"
                  series={[{ key: 'mean', name: 'Mean %', color: SNEAT.info }]} />
              ) : (
                <SnBar data={[{ name: 'No marks yet', mean: 0 }]} xKey="name" series={[{ key: 'mean', name: 'Mean %' }]} />
              )}
            </ChartCard>
          </Grid>

          {/* AI brief + benchmarks (existing components, now in Sneat cards) */}
          <Grid cols={2}>
            <WeeklyBrief store={{ ...store, students: activeStudentsList, teachers: rawStaff, settings, examSchedules }} user={user} />
            <BenchmarkCard user={user} />
          </Grid>

          <StreamPerformanceGraph students={activeStudentsList} />
          <AcademicAnalytics students={activeStudentsList} gradeBoundaries={store?.gradeBoundaries} />

          <Card>
            <CardHead title="Timetable studio" subtitle="Design, edit and publish class & teacher timetables"
              action={<SnButton variant="outline" onClick={() => navigate('timetable')}>Open →</SnButton>} />
            <CardBody>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="sn-icon sn-icon-primary sn-icon-lg"><Grid3x3 /></span>
                <div><span className="sn-strong">{Object.keys(store?.timetables || {}).length}</span> published</div>
                <div><span className="sn-strong">{dynamicClasses.length}</span> classes</div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Academic quick tools" />
            <CardBody>
              <Grid cols={4}>
                <SnButton variant="outline" onClick={() => setActiveTab('merit')}><Award size={15} /> Merit list</SnButton>
                <SnButton variant="outline" onClick={() => setActiveTab('audit')}><CheckCircle2 size={15} /> Audit marks</SnButton>
                <SnButton variant="outline" onClick={() => setActiveTab('slips')}><Printer size={15} /> Result slips</SnButton>
                <SnButton variant="outline" onClick={() => setActiveTab('class_analysis')}><Layers size={15} /> Class analysis</SnButton>
              </Grid>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── CLASS & SUBJECT ANALYSIS ── */}
      {activeTab === 'class_analysis' && (
        <ClassSubjectAnalysis
          students={activeStudentsList}
          gradeBoundaries={store?.gradeBoundaries}
          schoolSettings={settings}
        />
      )}

      {/* ── MERIT ── */}
      {activeTab === 'merit' && (
        <>
          <Grid cols={4}>
            <MetricCard label="Students ranked" value={meritList.length} icon={<Users />} tone="primary" />
            <MetricCard label="Top mean" value={meritList[0] ? `${meritList[0].meanPercentage.toFixed(1)}%` : '—'}
              icon={<Award />} tone="success" foot={meritList[0]?.name} />
            <MetricCard label="Scope" value={selectedClass === 'All' ? 'All streams' : selectedClass}
              icon={<Layers />} tone="secondary" />
            <Card className="sn-metric">
              <p className="sn-metric-label">Export</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <SnButton variant="primary" onClick={handleExportMeritListPDF}>PDF</SnButton>
                <SnButton variant="outline" onClick={handleExportMeritListExcel}>Excel</SnButton>
              </div>
            </Card>
          </Grid>

          <MeritListModule
            students={activeStudentsList}
            schoolSettings={store?.settings}
            teachers={rawStaff}
            classes={dynamicClasses}
            userRole={user?.role || store?.user?.role || 'dos'}
            currentStudentId={user?.student_id || user?.id}
            notify={notify}
            onUpdateSettings={store?.updateSettings || ((partial) => store?.setSettings && store.setSettings((prev) => ({ ...prev, ...partial })))}
            onNavigateGradebook={() => store?.navigate && store.navigate('gradebook')}
            onUpdateStudentScores={(editedScores) => {
              Object.entries(editedScores).forEach(([key, val]) => {
                const [studentId, subject] = key.split('_');
                const target = rawStudents.find((s) => String(s.id) === String(studentId));
                if (target) {
                  const currentScores = target.scores || {};
                  const subjectScores = currentScores[subject] || {};
                  const updated = {
                    ...target,
                    scores: {
                      ...currentScores,
                      [subject]: typeof subjectScores === 'object'
                        ? { ...subjectScores, average: val, score: val }
                        : val,
                    },
                  };
                  if (store.updateStudent) store.updateStudent(updated);
                  setStudents((prev) => prev.map((s) => (String(s.id) === String(studentId) ? updated : s)));
                }
              });
            }}
          />
        </>
      )}

      {/* ── AUDIT ── */}
      {activeTab === 'audit' && (
        <>
          <Grid cols={4}>
            <MetricCard label="Overall completion" value={`${auditStats.overallPct}%`}
              icon={<CheckCircle2 />} tone={auditStats.overallPct >= 80 ? 'success' : 'warning'}
              progress={{ value: auditStats.overallPct, max: 100 }} />
            <MetricCard label="Complete" value={auditStats.completedUnits} icon={<CheckCircle2 />} tone="success" />
            <MetricCard label="In progress" value={auditStats.inProgressUnits} icon={<Layers />} tone="warning" />
            <MetricCard label="Pending entry" value={auditStats.pendingUnits} icon={<AlertTriangle />} tone="danger" />
          </Grid>

          <TableCard
            title="Marks entry audit register"
            subtitle="Score submissions across all class subjects"
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {classSelect}
                <SnButton variant="primary" onClick={handleExportAuditPDF}>Export PDF</SnButton>
              </div>
            }
            rows={marksAuditMatrix}
            rowKey={(m) => m.id}
            empty={<SnEmpty icon={<CheckCircle2 />} title="Nothing to audit"
              message="Add classes and students to see marks-entry progress." />}
            columns={[
              { key: 'class', header: 'Class stream', render: (m) => <span className="sn-td-strong">{m.class}</span> },
              { key: 'subject', header: 'Subject' },
              { key: 'teacher', header: 'Teacher' },
              {
                key: 'progress', header: 'Progress', width: 180,
                render: (m) => (
                  <ProgressMetric
                    value={m.pct} max={100} showRow={false}
                    tone={m.pct === 100 ? 'success' : m.pct > 0 ? 'warning' : 'danger'}
                  />
                ),
              },
              { key: 'entered', header: 'Entered', align: 'right', render: (m) => `${m.enteredCount} / ${m.totalStudents}` },
              {
                key: 'status', header: 'Status',
                render: (m) => (
                  <SnBadge tone={m.status === 'Complete' ? 'success' : m.status === 'In Progress' ? 'warning' : 'danger'}>
                    {m.status}
                  </SnBadge>
                ),
              },
            ]}
          />
        </>
      )}

      {/* ── SLIPS ── */}
      {activeTab === 'slips' && (
        <TableCard
          title="Result slips & report cards"
          subtitle="Generate and print official terminal result slips"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={SNEAT.muted} style={{ position: 'absolute', left: 10, top: 11 }} />
                <input
                  type="text"
                  placeholder="Search student or adm…"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  style={{ paddingLeft: 30, height: 36, width: 220, borderRadius: 6, border: `1px solid ${SNEAT.border}`, fontSize: 13 }}
                />
              </div>
              {classSelect}
            </div>
          }
          rows={slipRows}
          rowKey={(s) => s.id}
          empty={<SnEmpty icon={<Printer />} title="No students match"
            message="Adjust the search or stream filter to find a student." />}
          columns={[
            { key: 'adm', header: 'Adm no', render: (s) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.adm || '-'}</span> },
            { key: 'name', header: 'Student name', render: (s) => <span className="sn-td-strong">{s.name}</span> },
            { key: 'class', header: 'Class stream', render: (s) => s.class || '-' },
            { key: 'gender', header: 'Gender', render: (s) => s.gender || '-' },
            {
              key: 'action', header: 'Action',
              render: (s) => (
                <SnButton variant="outline" onClick={() => setSelectedStudentForReport(s)}>
                  View slip
                </SnButton>
              ),
            },
          ]}
        />
      )}

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
    </SneatPage>
  );
}
