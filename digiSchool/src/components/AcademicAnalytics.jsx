import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell } from 'recharts';
import { BarChart2, PieChart } from 'lucide-react';
import { subjectAverage, studentOverall, gradeFor, is844Class, CBC_BOUNDARIES, KCSE_BOUNDARIES } from '../utils/grading';

// Ink tokens (text never wears the series colour) + a recessive grid.
const INK = '#111827', SUB = '#6b7280', GRID = '#e5e7eb';
const PERF = '#047857'; // single magnitude hue, matches the dashboard
// Ordinal quality ramp for grade tiers (best → worst): green → amber → red.
const tierColor = (q) => (q < 0.34 ? '#047857' : q < 0.67 ? '#d97706' : '#dc2626');

function Card({ icon: Icon, title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', minHeight: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={INK} strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{title}</div>
          <div style={{ fontSize: 12, color: SUB }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, color: INK, marginBottom: 2 }}>{label}</div>
      <div style={{ color: SUB }}>{payload[0].value}{unit}</div>
    </div>
  );
}

export default function AcademicAnalytics({ students = [], gradeBoundaries }) {
  // Curriculum: use whichever system most students fall under, so the grade
  // distribution is a single coherent scale rather than mixing CBC + KCSE.
  const system = useMemo(() => {
    const n844 = students.filter((s) => is844Class(s.class)).length;
    return n844 > students.length / 2 ? '844' : 'CBC';
  }, [students]);
  const boundaries = (gradeBoundaries && gradeBoundaries.length ? gradeBoundaries : (system === '844' ? KCSE_BOUNDARIES : CBC_BOUNDARIES));

  // Subject performance: mean % per subject, over students who have a score.
  const subjectData = useMemo(() => {
    const keys = new Set();
    students.forEach((s) => Object.keys(s.scores || {}).forEach((k) => keys.add(k)));
    const rows = [];
    keys.forEach((sub) => {
      let sum = 0, n = 0;
      students.forEach((s) => {
        const v = subjectAverage(s.scores?.[sub]);
        if (v > 0) { sum += v; n += 1; }
      });
      if (n > 0) rows.push({ subject: sub, mean: Math.round((sum / n) * 10) / 10, entered: n });
    });
    return rows.sort((a, b) => b.mean - a.mean);
  }, [students]);

  // Grade distribution: student count per mean-grade, ordered best → worst.
  const gradeData = useMemo(() => {
    const order = boundaries.map((b) => b.grade); // already best → worst
    const counts = Object.fromEntries(order.map((g) => [g, 0]));
    students.forEach((s) => {
      const g = gradeFor(studentOverall(s, undefined), boundaries, system);
      if (counts[g] === undefined) counts[g] = 0;
      counts[g] += 1;
    });
    const n = order.length;
    return order
      .map((g, i) => ({ grade: g, count: counts[g] || 0, q: n > 1 ? i / (n - 1) : 0 }))
      .filter((r) => r.count > 0 || order.length <= 12);
  }, [students, boundaries, system]);

  const hasData = subjectData.length > 0;

  if (!hasData) {
    return (
      <Card icon={BarChart2} title="Performance Analytics" subtitle="Grade distribution & subject means">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 13 }}>
          No marks entered yet — analytics appear once scores are recorded.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
      <Card icon={BarChart2} title="Subject Performance" subtitle="Mean score (%) per subject — highest first">
        <ResponsiveContainer width="100%" height={Math.max(220, subjectData.length * 34)}>
          <BarChart data={subjectData} layout="vertical" margin={{ top: 4, right: 34, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: SUB }} stroke={GRID} />
            <YAxis type="category" dataKey="subject" width={130} tick={{ fontSize: 11, fill: INK }} stroke={GRID} />
            <Tooltip cursor={{ fill: '#f9fafb' }} content={<ChartTip unit="%" />} />
            <Bar dataKey="mean" fill={PERF} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              <LabelList dataKey="mean" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: SUB, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card icon={PieChart} title="Grade Distribution" subtitle={`Students per mean grade · ${system === '844' ? '8-4-4 / KCSE' : 'CBC'}`}>
        <ResponsiveContainer width="100%" height={Math.max(220, subjectData.length * 34)}>
          <BarChart data={gradeData} margin={{ top: 20, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="grade" tick={{ fontSize: 11, fill: INK }} stroke={GRID} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: SUB }} stroke={GRID} />
            <Tooltip cursor={{ fill: '#f9fafb' }} content={<ChartTip unit=" students" />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: SUB, fontWeight: 600 }} />
              {gradeData.map((r) => <Cell key={r.grade} fill={tierColor(r.q)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
