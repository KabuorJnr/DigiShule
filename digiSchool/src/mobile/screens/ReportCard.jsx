import { useMemo } from 'react';
import { Award } from 'lucide-react';
import { computeStudentReport } from '../../utils/grading';
import { getChild, StatCard, Empty } from './kit';

const gradeColor = (pct) => (pct >= 70 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626');

// A student's full report card — subjects with score/grade/remark plus mean and
// position — built with the same computeStudentReport used by the desktop
// ReportCardModal. Reachable from the parent's and student's Results screen.
export function ReportCard({ store, user, params }) {
  const child = params?.student || getChild(user, store);
  const students = store.students || [];

  const report = useMemo(() => computeStudentReport({
    student: child,
    students,
    examTitle: store.settings?.currentExam || 'End of Term Exam',
    termName: store.settings?.currentTerm || 'This Term',
    gradeBoundaries: store.gradeBoundaries,
  }), [child, students, store.settings, store.gradeBoundaries]);

  const scored = (report?.subjectRows || []).filter((r) => r.score > 0);
  if (!report || scored.length === 0) {
    return <Empty icon={Award} text="No report card yet — it appears once this term's marks are entered." />;
  }
  const showPosition = students.length > 1;

  return (
    <>
      <StatCard>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--eom-ink)' }}>{report.studentName}</div>
        <div style={{ fontSize: 12.5, color: 'var(--eom-muted)', fontWeight: 600 }}>
          {report.className}{report.admissionNo ? ` · Adm ${report.admissionNo}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--eom-muted)', marginTop: 2 }}>{report.examTitle} · {report.termName}</div>
        <div className="eom-split" style={{ marginTop: 14 }}>
          <div className="eom-cell"><div className="eom-l">Mean score</div><div className="eom-v eom-num">{report.meanPercentageText}</div></div>
          <div className="eom-cell"><div className="eom-l">Mean grade</div><div className="eom-v eom-num" style={{ color: gradeColor(report.meanPercentage) }}>{report.meanGradeCode}</div></div>
          {showPosition && <div className="eom-cell"><div className="eom-l">Position</div><div className="eom-v eom-num">{report.streamPosition}</div></div>}
        </div>
      </StatCard>

      <div className="eom-sec"><h5>Subjects</h5></div>
      <div className="eom-list-card">
        {scored.map((r) => (
          <div className="eom-rcrow" key={r.subject}>
            <div className="eom-rcsub"><b>{r.subject}</b><span>{r.remark || ''}</span></div>
            <span className="eom-rcscore eom-num">{r.percentageText}</span>
            <span className="eom-rcgrade eom-num" style={{ color: gradeColor(r.score) }}>{r.gradeCode}</span>
          </div>
        ))}
      </div>
      <p className="eom-markhint">Grades are derived from the school's grading scale. Positions reflect the learners visible to your account.</p>
    </>
  );
}
