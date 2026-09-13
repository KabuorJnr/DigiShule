/**
 * SneatDevPreview — dev-only gallery of the Sneat dashboard system (/sneat-dev).
 *
 * Exists so the design system can be inspected without a signed-in session,
 * and so any change to src/components/sneat is visible in one place. Gated by
 * import.meta.env.DEV in App.jsx; never ships to production.
 */

import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, Spotlight,
  ChartCard, SnBar, SnLine, SnArea, SnDonut, SnGauge, TableCard, RankList,
  ProgressMetric, SnBadge, SnButton, SnEmpty, TrendBadge, SNEAT,
} from '../components/sneat';
import {
  Users, Wallet, TrendingUp, AlertTriangle, GraduationCap,
  CalendarCheck, BookOpen, Inbox,
} from 'lucide-react';

const termTrend = [
  { name: 'Wk 1', collected: 1.2, expected: 2.0 },
  { name: 'Wk 2', collected: 2.1, expected: 3.0 },
  { name: 'Wk 3', collected: 3.4, expected: 4.0 },
  { name: 'Wk 4', collected: 4.0, expected: 5.0 },
  { name: 'Wk 5', collected: 5.2, expected: 6.0 },
  { name: 'Wk 6', collected: 6.1, expected: 7.0 },
];

const meanByForm = [
  { name: 'Form 1', mean: 58.2 },
  { name: 'Form 2', mean: 61.4 },
  { name: 'Form 3', mean: 55.8 },
  { name: 'Form 4', mean: 64.1 },
];

const subjectSplit = [
  { name: 'Mathematics', mean: 52.1 },
  { name: 'English', mean: 63.4 },
  { name: 'Kiswahili', mean: 60.2 },
  { name: 'Biology', mean: 58.7 },
  { name: 'Chemistry', mean: 49.8 },
];

const feeSplit = [
  { name: 'Collected', value: 6.1, color: SNEAT.primary },
  { name: 'Outstanding', value: 2.4, color: SNEAT.warning },
];

export default function SneatDevPreview() {
  return (
    <SneatPage
      title="Sneat design system"
      subtitle="Dev preview — every dashboard primitive with representative EduOne data"
      actions={<>
        <SnButton variant="outline">Export</SnButton>
        <SnButton variant="primary">New entry</SnButton>
      </>}
    >
      {/* The metric a dashboard is accountable to. */}
      <Spotlight
        eyebrow="Fee collection rate — Term 2, 2026"
        value="71.8%"
        caption="KES 6.10M collected of KES 8.50M billed. 2.4M outstanding across 184 students."
        progress={71.8}
        target={{ label: 'Term target', value: '90%' }}
        stats={[
          { label: 'Collected', value: 'KES 6.10M' },
          { label: 'Outstanding', value: 'KES 2.40M' },
          { label: 'Defaulters', value: '184' },
        ]}
      />

      {/* Supporting metrics. */}
      <Grid cols={4}>
        <MetricCard
          label="Active students" value="842" icon={<Users />} tone="primary"
          trend={3.2} trendLabel="vs last term"
        />
        <MetricCard
          label="Collected this term" value="KES 6.10M" icon={<Wallet />} tone="success"
          trend={12.4} trendLabel="vs last term"
        />
        <MetricCard
          label="Outstanding" value="KES 2.40M" icon={<AlertTriangle />} tone="warning"
          trend={-8.1} trendInvert trendLabel="vs last term"
        />
        <MetricCard
          label="Mean score" value="59.8" icon={<GraduationCap />} tone="info"
          trend={1.4} trendLabel="vs last exam"
        />
      </Grid>

      {/* Metric-against-target tiles. */}
      <Grid cols={4}>
        <MetricCard
          label="Attendance rate" value="94.2%" icon={<CalendarCheck />} tone="success"
          foot="Target 95%" progress={{ value: 94.2, max: 100, tone: 'success' }}
        />
        <MetricCard
          label="Syllabus coverage" value="68%" icon={<BookOpen />} tone="primary"
          foot="Week 6 of 13" progress={{ value: 68, max: 100 }}
        />
        <MetricCard
          label="Open discipline cases" value="12" icon={<AlertTriangle />} tone="danger"
          trend={-25} trendInvert trendLabel="vs last month"
        />
        <MetricCard
          label="Staff present today" value="38 / 41" icon={<Users />} tone="secondary"
          foot="92.7% of active staff"
        />
      </Grid>

      {/* Charts. */}
      <Grid cols="8-4">
        <ChartCard
          title="Collection vs expected"
          subtitle="KES millions, cumulative by week"
          height={320}
        >
          <SnArea
            data={termTrend}
            xKey="name"
            series={[
              { key: 'expected', name: 'Expected', color: SNEAT.secondary },
              { key: 'collected', name: 'Collected', color: SNEAT.primary },
            ]}
          />
        </ChartCard>

        <ChartCard title="Fee composition" subtitle="Term 2" height={320} raw>
          <SnDonut data={feeSplit} centerValue="71.8%" centerLabel="collected" />
        </ChartCard>
      </Grid>

      <Grid cols="4-8">
        <ChartCard title="Mean score by form" height={300}>
          <SnBar data={meanByForm} xKey="name" series={[{ key: 'mean', name: 'Mean' }]} />
        </ChartCard>

        <ChartCard
          title="Subject performance"
          subtitle="Mean score, all forms"
          height={300}
        >
          <SnLine data={subjectSplit} xKey="name" series={[{ key: 'mean', name: 'Mean score' }]} />
        </ChartCard>
      </Grid>

      {/* Donut / gauge house style. */}
      <Card>
        <CardHead title="Donuts & gauges" subtitle="Thick ring, on-arc percentages, raised centre disc" />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
            <SnGauge value={95} label="collected" />
            <SnGauge value={72} label="attendance" color={SNEAT.info} />
            <SnGauge value={48} label="coverage" color={SNEAT.warning} />
            <SnGauge value={23} label="at risk" color={SNEAT.danger} />
            <SnDonut
              height={170}
              data={[
                { name: 'Form 1', value: 51 },
                { name: 'Form 2', value: 45 },
                { name: 'Form 3', value: 38 },
                { name: 'Form 4', value: 42 },
              ]}
              centerValue="176"
              centerLabel="students"
            />
          </div>
        </CardBody>
      </Card>

      {/* Table + list. */}
      <Grid cols="8-4">
        <TableCard
          title="Top fee balances"
          subtitle="Highest outstanding, current term"
          action={<SnButton variant="ghost">View all</SnButton>}
          columns={[
            { key: 'name', header: 'Student', render: (r) => <span className="sn-td-strong">{r.name}</span> },
            { key: 'klass', header: 'Class' },
            { key: 'balance', header: 'Balance', align: 'right' },
            { key: 'status', header: 'Status', render: (r) => <SnBadge tone={r.tone}>{r.status}</SnBadge> },
          ]}
          rows={[
            { id: 1, name: 'Achieng Otieno', klass: 'Form 4 East', balance: 'KES 48,200', status: 'Critical', tone: 'danger' },
            { id: 2, name: 'Brian Kiptoo', klass: 'Form 3 West', balance: 'KES 41,000', status: 'Critical', tone: 'danger' },
            { id: 3, name: 'Cynthia Wanjiru', klass: 'Form 2 North', balance: 'KES 27,500', status: 'Overdue', tone: 'warning' },
            { id: 4, name: 'Daniel Mwangi', klass: 'Form 1 South', balance: 'KES 12,300', status: 'On plan', tone: 'info' },
          ]}
        />

        <Card>
          <CardHead title="Class collection" subtitle="Percent of billed amount" />
          <CardBody>
            <RankList
              items={[
                { id: 1, title: 'Form 4 East', sub: '42 students', value: '92%', progress: 92, tone: 'success', icon: <GraduationCap /> },
                { id: 2, title: 'Form 3 West', sub: '38 students', value: '78%', progress: 78, tone: 'primary', icon: <GraduationCap /> },
                { id: 3, title: 'Form 2 North', sub: '45 students', value: '64%', progress: 64, tone: 'warning', icon: <GraduationCap /> },
                { id: 4, title: 'Form 1 South', sub: '51 students', value: '51%', progress: 51, tone: 'danger', icon: <GraduationCap /> },
              ]}
            />
          </CardBody>
        </Card>
      </Grid>

      {/* Remaining primitives. */}
      <Grid cols={3}>
        <Card>
          <CardHead title="Progress metrics" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <ProgressMetric label="Term 1 coverage" value={100} tone="success" />
              <ProgressMetric label="Term 2 coverage" value={68} tone="primary" />
              <ProgressMetric label="Term 3 coverage" value={0} tone="secondary" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Badges & trends" />
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <SnBadge tone="primary">Primary</SnBadge>
              <SnBadge tone="success">Paid</SnBadge>
              <SnBadge tone="warning">Overdue</SnBadge>
              <SnBadge tone="danger">Critical</SnBadge>
              <SnBadge tone="info">On plan</SnBadge>
              <SnBadge tone="secondary">Archived</SnBadge>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <TrendBadge value={12.4} label="up" />
              <TrendBadge value={-8.1} label="down" />
              <TrendBadge value={-8.1} invert label="inverted" />
              <TrendBadge value={0} label="flat" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Empty state" />
          <CardBody>
            <SnEmpty
              icon={<Inbox />}
              title="No pending approvals"
              message="Expense claims awaiting sign-off will appear here."
            />
          </CardBody>
        </Card>
      </Grid>
    </SneatPage>
  );
}
