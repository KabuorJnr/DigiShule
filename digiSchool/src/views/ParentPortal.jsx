import { useMemo } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS, ATTENDANCE_RECORDS } from '../data/seed';

export default function ParentPortal({ store }) {
  const { students, gradeBoundaries, examSchedules, feeStructure } = store;

  // Demo parent's child = first student of 1A
  const child = students.find((s) => s.class === '1A') || students[0];

  const subjects = useMemo(() => {
    return SUBJECTS.map((sub) => {
      const scores = child.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [child, gradeBoundaries]);

  const overallAvg = subjects.length
    ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1)
    : 0;

  // Attendance (school-wide rate used as proxy)
  const latestAtt = ATTENDANCE_RECORDS[ATTENDANCE_RECORDS.length - 1];

  const termFees = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0;
  const paid = Math.round(termFees * 0.73);
  const balance = termFees - paid;

  const upcomingExams = (examSchedules || []).filter((e) => e.sessions?.some((s) => s.status === 'Upcoming'));

  return (
    <div>
      <PageHeader title="My Child" subtitle={`${child.name} · ${child.adm} · Form ${child.class}`} />

      <div className="stat-tiles">
        <KpiCard icon="📊" label="Overall Average" value={`${overallAvg}%`} accent="#BE185D" />
        <KpiCard icon="✅" label="Attendance Rate" value={`${latestAtt?.rate || 91}%`} accent="#10B981" />
        <KpiCard icon="💰" label="Fees Balance" value={`KES ${balance.toLocaleString()}`} accent={balance > 0 ? '#EF4444' : '#10B981'} />
        <KpiCard icon="📝" label="Upcoming Exams" value={upcomingExams.length} accent="#F59E0B" />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="section-title">Academic Performance — Term 2</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Subject</th><th>Total</th><th>Avg %</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {subjects.map((r) => (
                  <tr key={r.subject}>
                    <td style={{ fontWeight: 600 }}>{r.subject}</td>
                    <td>{r.total}</td>
                    <td style={{ fontWeight: 700 }}>{r.average}</td>
                    <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="section-title">Fee Statement</div>
            <table className="table">
              <tbody>
                <tr><td className="muted">Term Total</td><td style={{ fontWeight: 700 }}>KES {termFees.toLocaleString()}</td></tr>
                <tr><td className="muted">Amount Paid</td><td style={{ fontWeight: 700, color: '#10B981' }}>KES {paid.toLocaleString()}</td></tr>
                <tr><td className="muted">Balance</td><td style={{ fontWeight: 700, color: '#EF4444' }}>KES {balance.toLocaleString()}</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}><ProgressBar value={73} color="#10B981" /></div>
          </div>

          {upcomingExams.length > 0 && (
            <div className="card card-pad">
              <div className="section-title">Upcoming Exams</div>
              {upcomingExams.map((ex) => (
                <div key={ex.id} style={{ marginBottom: 8 }}>
                  <strong>{ex.name}</strong>{' '}
                  <span className="muted">{ex.startDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
