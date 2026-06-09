import { useMemo } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';

export default function TeacherPortal({ store, user }) {
  const { students, gradeBoundaries } = store;
  const teacherName = user?.name || 'Teacher';
  // Find the linked teacher record
  const subject = user?.dept || 'Mathematics';

  // Students in classes this teacher covers — show their grades for the teacher's subject
  const rows = useMemo(() => {
    return students
      .filter((s) => s.scores[subject])
      .map((s) => {
        const scores = s.scores[subject];
        const row = computeRow(scores);
        const grade = gradeFor(row.average, gradeBoundaries);
        return { ...s, ...row, grade };
      });
  }, [students, gradeBoundaries, subject]);

  const classes = [...new Set(rows.map((r) => r.class))];
  const avgOverall = rows.length ? (rows.reduce((s, r) => s + r.average, 0) / rows.length).toFixed(1) : 0;
  const atRisk = rows.filter((r) => r.average < 40).length;

  return (
    <div>
      <PageHeader title="My Classes" subtitle={`${teacherName} — ${subject}`} />

      <div className="stat-tiles">
        <KpiCard icon="🧑‍🏫" label="My Subject" value={subject} />
        <KpiCard icon="🎓" label="Total Students" value={rows.length} sub={`${classes.length} classes`} />
        <KpiCard icon="📊" label="Subject Average" value={`${avgOverall}%`} accent="#0369A1" />
        <KpiCard icon="⚠️" label="At Risk (< 40%)" value={atRisk} accent={atRisk > 0 ? '#EF4444' : '#10B981'} />
      </div>

      <div className="card card-pad">
        <div className="section-title">{subject} Gradebook (all classes)</div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Student</th><th>Adm No.</th><th>Class</th>
                <th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th>
                <th>Total</th><th>Avg %</th><th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={r.average < 40 ? { background: '#fef2f2' } : undefined}>
                  <td className="muted">{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="muted">{r.adm}</td>
                  <td>{r.class}</td>
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
    </div>
  );
}
