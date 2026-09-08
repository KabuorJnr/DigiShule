import React, { useMemo } from 'react';
import { computeStudentReport, subjectAverage } from '../utils/grading';

// Parent-facing results summary in the familiar "Zeraki" layout: a header strip,
// position / mean-grade / KCPE tiles, and a Student-vs-Class subject chart.
// Read-only; all figures are derived from the child's report and class cohort.
export default function ResultsSummary({
  child,
  classmates = [],
  gradeBoundaries = [],
  settings = {},
  examTitle = 'End Term Exam',
  termName = 'Term 2',
}) {
  const cohort = classmates && classmates.length ? classmates : (child ? [child] : []);

  const report = useMemo(() => {
    if (!child) return null;
    try {
      return computeStudentReport({
        student: child,
        students: cohort,
        subjects: [],
        examTitle,
        termName,
        gradeBoundaries,
      });
    } catch {
      return null;
    }
  }, [child, cohort, gradeBoundaries, examTitle, termName]);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.subjectRows.map((row) => {
      const vals = cohort
        .map((s) => subjectAverage((s.scores || {})[row.subject]))
        .filter((v) => v > 0);
      const classAvg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
      return {
        name: row.subject,
        short: (row.subject || '').substring(0, 3).toUpperCase(),
        student: Number(row.score) || 0,
        classAvg,
      };
    });
  }, [report, cohort]);

  if (!child || !report) return null;

  const fmtPos = (p) => String(p || '—').replace(/\s+of\s+/i, ' / ');
  const kcpe = child.kcpe || child.kcpe_marks || null;

  const GREEN = '#047857';
  const n = chartData.length || 1;
  // Chart geometry: equal centred columns, 10% top/bottom padding.
  const xFor = (i) => (i + 0.5) * (100 / n);
  const yFor = (v) => 10 + (100 - Math.max(0, Math.min(100, v))) / 100 * 80;
  const studentPts = chartData.map((d, i) => `${xFor(i)},${yFor(d.student)}`).join(' ');
  const classPts = chartData.map((d, i) => `${xFor(i)},${yFor(d.classAvg)}`).join(' ');

  const Tile = ({ label, value, sub }) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: GREEN, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
      {/* Header strip */}
      <div style={{ background: GREEN, color: '#fff', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{settings.name || 'School'}</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>{report.className} · {examTitle}</div>
      </div>

      {/* Student name banner */}
      <div style={{ background: '#f0fdf4', borderBottom: '1px solid #dcfce7', padding: '10px 18px', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>{report.studentName}</div>
        <div style={{ fontSize: 12, color: '#15803d' }}>ADM {report.admissionNo} · {termName}</div>
      </div>

      {/* Position / grade / KCPE tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0' }}>
        <Tile label="Overall Position" value={fmtPos(report.overallPosition)} />
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <Tile label="Stream Position" value={fmtPos(report.streamPosition)} />
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <Tile label="Mean Grade" value={report.meanGradeCode || report.meanGradeFull || '—'} />
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <Tile label="KCPE" value={kcpe != null ? kcpe : '—'} />
      </div>

      {/* Student vs Class chart */}
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Student vs Class Averages</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 3, background: GREEN, borderRadius: 2 }} /> {report.studentName.split(' ')[0]}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 3, background: '#cbd5e1', borderRadius: 2 }} /> Class</span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 13 }}>No subject scores available yet.</div>
        ) : (
          <div style={{ position: 'relative', height: 180, borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {[25, 50, 75].map((g) => (
                <line key={g} x1="0" y1={yFor(g)} x2="100" y2={yFor(g)} stroke="#f1f5f9" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              ))}
              <polyline fill="none" stroke="#cbd5e1" strokeWidth="2" vectorEffect="non-scaling-stroke" points={classPts} />
              <polyline fill="none" stroke={GREEN} strokeWidth="2" vectorEffect="non-scaling-stroke" points={studentPts} />
              {chartData.map((d, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(d.student)} r="3.5" fill={GREEN} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <div style={{ display: 'flex', marginTop: 4 }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#64748b' }} title={d.name}>{d.short}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
