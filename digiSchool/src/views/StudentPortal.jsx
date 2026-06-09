import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS } from '../data/seed';
import { fetchClassRank } from '../lib/api';

export default function StudentPortal({ store }) {
  const { students, gradeBoundaries, examSchedules, feeStructure } = store;

  // RLS scopes a student to their own record, so it's the only row returned.
  const me = students[0];

  const [rank, setRank] = useState(null);
  useEffect(() => {
    let active = true;
    fetchClassRank()
      .then((r) => { if (active) setRank(r); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const subjects = useMemo(() => {
    if (!me) return [];
    return SUBJECTS.map((sub) => {
      const scores = me.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [me, gradeBoundaries]);

  const overallAvg = subjects.length
    ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1)
    : 0;


  const upcomingExams = (examSchedules || []).filter((e) => e.sessions?.some((s) => s.status === 'Upcoming'));

  const termFees = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0;
  const paid = Math.round(termFees * 0.73); // demo: 73% paid

  if (!me) return null;

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle={`${me.name} · ${me.adm} · Form ${me.class}`} />

      <div className="stat-tiles">
        <KpiCard icon="📊" label="Overall Average" value={`${overallAvg}%`} accent="#1D4ED8" />
        <KpiCard icon="🏆" label="Class Position" value={rank ? `${rank.position} / ${rank.classSize}` : '—'} />
        <KpiCard icon="📝" label="Upcoming Exams" value={upcomingExams.length} accent="#F59E0B" />
        <KpiCard icon="💰" label="Fees Paid" value={`KES ${paid.toLocaleString()}`} accent="#10B981">
          <div style={{ marginTop: 6 }}><ProgressBar value={73} color="#10B981" /></div>
        </KpiCard>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="section-title">My Grades — Term 2</div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Subject</th><th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th><th>Total</th><th>Avg %</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {subjects.map((r) => (
                <tr key={r.subject}>
                  <td style={{ fontWeight: 600 }}>{r.subject}</td>
                  <td>{r.cat1}</td>
                  <td>{r.cat2}</td>
                  <td>{r.midterm}</td>
                  <td>{r.endterm}</td>
                  <td style={{ fontWeight: 700 }}>{r.total}</td>
                  <td style={{ fontWeight: 700 }}>{r.average}</td>
                  <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {upcomingExams.length > 0 && (
        <div className="card card-pad">
          <div className="section-title">Upcoming Exams</div>
          {upcomingExams.map((ex) => (
            <div key={ex.id} style={{ marginBottom: 10 }}>
              <strong>{ex.name}</strong>{' '}
              <span className="muted">({ex.type}) — {ex.startDate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
