import { useOutletContext } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { computeRow, gradeFor, is844Class, pointsForGrade } from '../../utils/grading';
import { BarChart3, FileText, LayoutGrid } from 'lucide-react';
import { Badge } from '../../components/widgets';
import ReportCardEntrySheet from '../../components/ReportCardEntrySheet';

export default function GradebookTab() {
  const { store, subject, loadedStudents, setLoadedStudents } = useOutletContext();
  const { gradeBoundaries, settings, user, teachers = [] } = store;
  
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'report'
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [outOf, setOutOf] = useState(100); // Raw marks normalize to percentage

  const rows = useMemo(() => {
    return loadedStudents.map((s) => {
      const scores = s.scores?.[subject];
      const row = computeRow(scores);
      const systemType = is844Class(s.class) ? '844' : 'CBC';
      const percentage = row.average <= 4 && row.average > 0 ? Math.round(row.average * 25) : row.average;
      const grade = gradeFor(percentage, gradeBoundaries, systemType);
      const points = pointsForGrade(grade, systemType);
      return { ...s, ...row, percentage, grade, points, systemType };
    });
  }, [loadedStudents, gradeBoundaries, subject]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.average - a.average), [rows]);
  const topPerformer = sortedRows[0]?.average > 0 ? sortedRows[0] : null;

  // Selected student for Report Card Form entry
  const currentStudent = useMemo(() => {
    if (!loadedStudents || loadedStudents.length === 0) return null;
    if (selectedStudentId) {
      const found = loadedStudents.find(s => s.id === selectedStudentId);
      if (found) return found;
    }
    return loadedStudents[0];
  }, [loadedStudents, selectedStudentId]);

  const currentStudentIndex = useMemo(() => {
    if (!currentStudent || !loadedStudents.length) return 0;
    const idx = loadedStudents.findIndex(s => s.id === currentStudent.id);
    return idx >= 0 ? idx : 0;
  }, [loadedStudents, currentStudent]);

  const handleNextStudent = () => {
    if (currentStudentIndex < loadedStudents.length - 1) {
      setSelectedStudentId(loadedStudents[currentStudentIndex + 1].id);
    }
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(loadedStudents[currentStudentIndex - 1].id);
    }
  };

  const handleSaveStudentReport = (updated) => {
    store.updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  function saveScore(id, field, value) {
    const target = loadedStudents.find((s) => s.id === id);
    if (!target) return;
    let v;
    if (field === 'remarks') {
      v = value;
    } else if (String(value).trim().toLowerCase() === 'x') {
      v = 'X';
    } else if (String(value).trim() === '') {
      v = 0;
    } else {
      const max = Math.max(1, Number(outOf) || 100);
      v = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / max * 100)));
    }
    const currentScores = target.scores || {};
    const subjectScores = currentScores[subject] || {};
    const updated = { ...target, scores: { ...currentScores, [subject]: { ...subjectScores, [field]: v, score: v, average: v } } };
    store.updateStudent(updated);
    setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    setEditing(null);
  }

  const ScoreCell = ({ r, field, editing, setEditing, saveScore, sortedRows }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            style={{ 
              width: field === 'remarks' ? '120px' : '52px', 
              height: '28px', 
              padding: '0 4px', 
              border: '1px solid #065f46', 
              borderRadius: '4px', 
              outline: 'none', 
              textAlign: field === 'remarks' ? 'left' : 'center', 
              fontWeight: 600 
            }}
            type="text"
            inputMode={field === 'remarks' ? undefined : 'numeric'}
            enterKeyHint="next"
            placeholder={field === 'remarks' ? '' : `/${Math.max(1, Number(outOf) || 100)}`}
            autoFocus
            defaultValue={r[field] === 'X' ? 'X' : (r[field] || '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveScore(r.id, field, e.target.value);
                if (field !== 'remarks' && sortedRows) {
                  const idx = sortedRows.findIndex(x => x.id === r.id);
                  const next = sortedRows[idx + 1];
                  if (next) setEditing({ id: next.id, field });
                }
              }
              if (e.key === 'Escape') setEditing(null);
            }}
            onBlur={(e) => saveScore(r.id, field, e.target.value)}
          />
        </td>
      );
    }
    return (
      <td 
        style={{ 
          cursor: 'pointer', 
          minWidth: field === 'remarks' ? '120px' : '48px', 
          textAlign: field === 'remarks' ? 'left' : 'center', 
          fontWeight: field === 'remarks' ? 400 : 600, 
          color: field === 'remarks' ? '#475569' : '#0369A1' 
        }} 
        onClick={() => setEditing({ id: r.id, field })} 
        title={`Click to edit ${field === 'remarks' ? 'remarks' : '(0-100% or raw marks)'}`}
      >
        {r[field] !== undefined && r[field] !== null && r[field] !== '' ? (r[field] === 'X' ? 'X' : (field === 'remarks' ? r[field] : `${r[field]}%`)) : (field === 'remarks' ? 'Add remark...' : '-')}
      </td>
    );
  };

  return (
    <div className="card card-pad">
      {/* Header & Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>{subject} - Marks Entry & Gradebook</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6 }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Marks out of:</span>
            <input 
              className="input" 
              type="number" 
              min="1" 
              max="1000" 
              value={outOf} 
              onChange={(e) => setOutOf(e.target.value.replace(/[^\d]/g, '') || '')}
              style={{ width: 64, height: 26, textAlign: 'center', padding: '0 4px', fontSize: 12, fontWeight: 700 }}
              title="Raw marks entered are automatically converted to percentages and CBC points."
            />
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
          >
            <LayoutGrid size={15} /> Class Subject Grid
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'report' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('report')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
          >
            <FileText size={15} /> Academic Report Form
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: Academic Report Form Entry */}
      {viewMode === 'report' && (
        <div style={{ marginTop: 8 }}>
          {currentStudent ? (
            <ReportCardEntrySheet
              student={currentStudent}
              students={loadedStudents}
              onSaveStudent={handleSaveStudentReport}
              onNextStudent={handleNextStudent}
              onPrevStudent={handlePrevStudent}
              currentIndex={currentStudentIndex}
              totalStudents={loadedStudents.length}
              schoolSettings={settings}
              teachers={teachers}
              currentUser={user}
              gradeBoundaries={gradeBoundaries}
              examTitle="End Term Assessment"
              termName="Term 2"
              year="2026"
              outOf={outOf}
              canEditAll={user?.role === 'admin' || user?.role === 'dos' || user?.role === 'deputy_academic'}
              allowedSubjects={[subject]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <BarChart3 size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div className="muted">No students found.</div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: Class Subject Grid */}
      {viewMode === 'grid' && (
        <div>
          {topPerformer && (
            <div style={{ fontSize: 12, color: '#107C10', background: '#f0fdf4', borderRadius: 6, padding: '4px 10px', border: '1px solid #bbf7d0', marginBottom: 12, display: 'inline-block' }}>
              Top: {topPerformer.name} ({topPerformer.average}% · {topPerformer.points} pts)
            </div>
          )}

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
                    <th>Ass. 1 (%)</th><th>Ass. 2 (%)</th><th>Ass. 3 (%)</th><th>Ass. 4 (%)</th>
                    <th>Avg (%)</th>
                    <th>CBC Points</th>
                    <th>CBC Grade</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, i) => (
                    <tr key={r.id} style={r.average > 0 && r.average < 40 ? { background: '#fee2e2' } : undefined}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="muted">{r.adm}</td>
                      <td><Badge color="gray">{r.class}</Badge></td>
                      <ScoreCell r={r} field="a1" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} />
                      <ScoreCell r={r} field="a2" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} />
                      <ScoreCell r={r} field="a3" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} />
                      <ScoreCell r={r} field="a4" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} />
                      <td style={{ fontWeight: 700, color: '#0369A1' }}>{r.average > 0 ? `${r.average}%` : '-'}</td>
                      <td>
                        {r.points > 0 ? (
                          <Badge color="blue">{r.points} pts</Badge>
                        ) : '-'}
                      </td>
                      <td>
                        <Badge color={r.grade?.startsWith('EE') || r.grade?.startsWith('ME') || ['A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(r.grade) ? 'green' : r.grade?.startsWith('AE') || ['C', 'C-', 'D+'].includes(r.grade) ? 'amber' : 'red'}>
                          {r.grade}
                        </Badge>
                      </td>
                      <ScoreCell r={r} field="remarks" editing={editing} setEditing={setEditing} saveScore={saveScore} sortedRows={sortedRows} />
                      <td>
                        <button 
                          className="btn btn-sm"
                          onClick={() => {
                            setSelectedStudentId(r.id);
                            setViewMode('report');
                          }}
                          style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Open official Report Form for this student"
                        >
                          <FileText size={13} /> Report Form
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
