import { useOutletContext } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { computeRow, gradeFor } from '../../utils/grading';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../../components/widgets';

export default function GradebookTab() {
  const { store, subject, loadedStudents, setLoadedStudents } = useOutletContext();
  const { gradeBoundaries } = store;
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    return loadedStudents.map((s) => {
      const scores = s.scores?.[subject];
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { ...s, ...row, grade };
    });
  }, [loadedStudents, gradeBoundaries, subject]);

  const topPerformer = rows.reduce((best, r) => (!best || r.average > best.average ? r : best), null);

  function saveScore(id, field, value) {
    const v = field === 'remarks' ? value : Math.max(0, Math.min(4, Number(value) || 0));
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const currentScores = target.scores || {};
      const subjectScores = currentScores[subject] || {};
      const updated = { ...target, scores: { ...currentScores, [subject]: { ...subjectScores, [field]: v } } };
      store.updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    setEditing(null);
  }

  const ScoreCell = ({ r, field, editing, setEditing, saveScore }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            style={{ width: field === 'remarks' ? '120px' : '48px', height: '28px', padding: '0 4px', border: '1px solid #065f46', borderRadius: '4px', outline: 'none' }}
            type={field === 'remarks' ? "text" : "number"}
            autoFocus
            defaultValue={r[field]}
            onKeyDown={(e) => { if (e.key === 'Enter') saveScore(r.id, field, e.target.value); if (e.key === 'Escape') setEditing(null); }}
            onBlur={(e) => saveScore(r.id, field, e.target.value)}
          />
        </td>
      );
    }
    return (
      <td 
        style={{ cursor: 'pointer', minWidth: field === 'remarks' ? '120px' : '40px', fontWeight: field === 'remarks' ? 400 : 600, color: field === 'remarks' ? '#475569' : '#0369A1' }} 
        onClick={() => setEditing({ id: r.id, field })} 
        title={`Click to edit ${field === 'remarks' ? 'remarks' : '(1-4)'}`}
      >
        {r[field] || (field === 'remarks' ? 'Add remark...' : '-')}
      </td>
    );
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>{subject} - Student Results</div>
        {topPerformer && (
          <div style={{ fontSize: 12, color: '#107C10', background: '#f0fdf4', borderRadius: 6, padding: '4px 10px', border: '1px solid #bbf7d0' }}>
            Top: {topPerformer.name} ({topPerformer.average}%)
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <BarChart3 size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <div className="muted">No students found to grade. Please check your assigned class.</div>
        </div>
      ) : (
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Student</th><th>Adm No.</th><th>Class</th>
                <th>Ass. 1</th><th>Ass. 2</th><th>Ass. 3</th><th>Ass. 4</th>
                <th>Avg Rubric</th><th>Grade</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.average - a.average)
                .map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="muted">{r.adm}</td>
                    <td><Badge color="gray">{r.class}</Badge></td>
                    <ScoreCell r={r} field="a1" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                    <ScoreCell r={r} field="a2" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                    <ScoreCell r={r} field="a3" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                    <ScoreCell r={r} field="a4" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                    <td style={{ fontWeight: 700 }}>{r.average || '-'}</td>
                    <td>
                      <Badge color={r.grade === 'EE' || r.grade === 'ME' ? 'green' : r.grade === 'AE' ? 'amber' : 'red'}>
                        {r.grade}
                      </Badge>
                    </td>
                    <ScoreCell r={r} field="remarks" editing={editing} setEditing={setEditing} saveScore={saveScore} />
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}



