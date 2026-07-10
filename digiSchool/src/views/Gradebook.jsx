import { useState, useMemo, useEffect } from 'react';
import { fetchStudents } from '../lib/api';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { CLASSES, SUBJECTS, getDynamicClasses, expandClassesWithStreams } from '../data/seed';
import { computeRow, gradeFor, remarkFor, subjectAverage } from '../utils/grading';
import { exportTablePDF, downloadExcel, exportReportCardsPDF } from '../utils/exporters';

const GRADE_COLORS = { EE: '#10B981', ME: '#3B82F6', AE: '#F59E0B', BE: '#EF4444', '-': '#9CA3AF' };
const ASSESS_OPTIONS = ['All', 'Assessment 1', 'Assessment 2', 'Assessment 3', 'Assessment 4'];

export default function Gradebook({ store }) {
  const { updateStudent, gradeBoundaries, settings, setSettings, notify } = store;
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [term, setTerm] = useState('Term 2');
  const [assessment, setAssessment] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {id, field}
  const [selected, setSelected] = useState([]);
  
  const [loadedStudents, setLoadedStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const { data } = await fetchStudents(0, 200, { class: cls });
        if (active) setLoadedStudents(data);
      } catch (e) {
        notify('Failed to load gradebook', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [cls]);

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(settings?.classes || []);
    return saved.length ? saved : CLASSES;
  }, [settings]);

  const classStudents = useMemo(
    () => loadedStudents.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [loadedStudents, search]
  );

  const rows = useMemo(() =>
    classStudents.map((s) => {
      const r = computeRow(s.scores?.[subject]);
      const grade = gradeFor(r.average, gradeBoundaries);
      return { ...s, ...r, grade, remarks: r.remarks || remarkFor(grade) };
    }), [classStudents, subject, gradeBoundaries]);

  const colAvg = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = (k) => rows.reduce((a, b) => a + (b[k] || 0), 0);
    const validCount = (k) => rows.filter(b => b[k] > 0).length || 1;
    const avg = (k) => Math.round((sum(k) / validCount(k)) * 10) / 10;
    return { a1: avg('a1'), a2: avg('a2'), a3: avg('a3'), a4: avg('a4'), average: avg('average') };
  }, [rows]);

  // performance summary
  const gradeDist = useMemo(() => {
    const counts = { EE: 0, ME: 0, AE: 0, BE: 0 };
    rows.forEach((r) => { if (r.grade !== '-') counts[r.grade] = (counts[r.grade] || 0) + 1; });
    return Object.entries(counts).map(([grade, value]) => ({ grade, value }));
  }, [rows]);

  const top5 = useMemo(() => [...rows].sort((a, b) => b.average - a.average).slice(0, 5), [rows]);
  const atRisk = useMemo(() => rows.filter((r) => r.average > 0 && r.average < 2.0), [rows]);
  const subjectCompare = useMemo(() =>
    SUBJECTS.map((sub) => {
      const avg = classStudents.reduce((a, s) => a + subjectAverage(s.scores?.[sub]), 0) / (classStudents.length || 1);
      return { subject: sub.slice(0, 4), avg: Math.round(avg * 10) / 10 };
    }), [classStudents]);

  function saveScore(id, field, value) {
    const v = field === 'remarks' ? value : Math.max(0, Math.min(4, Number(value) || 0));
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const currentScores = target.scores || {};
      const subjectScores = currentScores[subject] || {};
      const updated = { ...target, scores: { ...currentScores, [subject]: { ...subjectScores, [field]: v } } };
      updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    setEditing(null);
  }

  function flagStudent(id) {
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const updated = { ...target, flagged: true };
      updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    notify('Student flagged for support', 'success', 'Gradebook');
  }

  function exportPDF() {
    const head = ['#', 'Student', 'Adm No.', 'Ass. 1', 'Ass. 2', 'Ass. 3', 'Ass. 4', 'Avg Rubric', 'Competency', 'Remarks'];
    const body = rows.map((r, i) => [i + 1, r.name, r.adm, r.a1, r.a2, r.a3, r.a4, r.average, r.grade, r.remarks]);
    exportTablePDF({ school: settings, title: `Gradebook — Grade ${cls} • ${subject}`, subtitle: `${term} • ${assessment}`, head, body, filename: `gradebook-${cls}-${subject}.pdf` });
    notify('Gradebook exported as PDF', 'success', 'Export');
  }
  function exportExcel() {
    const aoa = [['#', 'Student', 'Adm No.', 'Ass. 1', 'Ass. 2', 'Ass. 3', 'Ass. 4', 'Avg Rubric', 'Competency', 'Remarks']];
    rows.forEach((r, i) => aoa.push([i + 1, r.name, r.adm, r.a1, r.a2, r.a3, r.a4, r.average, r.grade, r.remarks]));
    downloadExcel(`gradebook-${cls}-${subject}.xlsx`, [{ name: `${cls} ${subject}`.slice(0, 31), aoa }]);
    notify('Gradebook exported as Excel', 'success', 'Export');
  }

  function generateReportCards() {
    const chosen = rows.filter((r) => selected.includes(r.id));
    if (chosen.length === 0) return notify('Select at least one student', 'warning');
    const ranked = [...classStudents].map((s) => {
      const avg = SUBJECTS.reduce((a, sub) => a + subjectAverage(s.scores?.[sub]), 0) / SUBJECTS.length;
      return { id: s.id, avg };
    }).sort((a, b) => b.avg - a.avg);
    const posOf = (id) => ranked.findIndex((x) => x.id === id) + 1;

    const enriched = chosen.map((r) => {
      const overall = Math.round((SUBJECTS.reduce((a, sub) => a + subjectAverage(r.scores?.[sub]), 0) / SUBJECTS.length) * 10) / 10;
      return {
        name: r.name, adm: r.adm, class: r.class,
        scores: r.scores,
        average: overall,
        grade: gradeFor(overall, gradeBoundaries),
        position: posOf(r.id),
        classSize: classStudents.length,
        attendance: 88 + (posOf(r.id) % 10),
      };
    });
    exportReportCardsPDF({
      school: settings,
      gradeBoundaries: gradeBoundaries,
      students: enriched,
      subjects: SUBJECTS,
      computeStudent: (stu, sub) => {
        const rr = computeRow(stu.scores?.[sub]);
        const g = gradeFor(rr.average, gradeBoundaries);
        return { score: rr.average, grade: g, remark: rr.remarks || remarkFor(g) };
      },
      filename: `report-cards-${cls}.pdf`,
    });
    notify(`Generated ${chosen.length} report card(s)`, 'success', 'Report Cards');
  }

  const ScoreCell = ({ r, field, editing, setEditing, saveScore }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            className="score-input"
            style={{ width: field === 'remarks' ? '120px' : '40px', padding: '0 4px' }}
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
    <div>
      <PageHeader
        title="Gradebook Review"
        subtitle="Inspect, edit and analyse student performance"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {(store.user?.role?.includes('Admin') || store.user?.role?.includes('Principal') || store.user?.role?.includes('Deputy')) && (
              <button 
                className={`btn ${settings?.results_published ? 'btn-danger' : 'btn-primary'}`} 
                onClick={togglePublishResults}
              >
                <Icon name={settings?.results_published ? "close" : "check"} size={16} /> 
                {settings?.results_published ? 'Unpublish Results' : 'Publish Results'}
              </button>
            )}
            <button className="btn" onClick={exportExcel}><Icon name="file" size={16} /> Export Excel</button>
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
          </div>
        }
      />

      <div className="toolbar">
        <div><label className="field-label">Class</label>
          <select className="select" value={cls} onChange={(e) => { setCls(e.target.value); setSelected([]); }} style={{ width: 120 }}>
            {dynamicClasses.map((c) => <option key={c} value={c}>Grade {c}</option>)}
          </select></div>
        <div><label className="field-label">Subject</label>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: 150 }}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div><label className="field-label">Term</label>
          <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 120 }}>
            {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div><label className="field-label">Assessment Type</label>
          <select className="select" value={assessment} onChange={(e) => setAssessment(e.target.value)} style={{ width: 130 }}>
            {ASSESS_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select></div>
        <div style={{ flex: 1, minWidth: 180 }}><label className="field-label">Search student</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" /></div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <strong>{selected.length} selected for report cards</strong>
          <button className="btn btn-primary btn-sm" onClick={generateReportCards}><Icon name="print" size={16} style={{ marginRight: 6 }} /> Generate Report Cards</button>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.length === rows.length && rows.length > 0}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                </th>
                <th>#</th><th>Student Name</th><th>Adm. No.</th>
                <th>Ass. 1</th><th>Ass. 2</th><th>Ass. 3</th><th>Ass. 4</th>
                <th>Avg Rubric</th><th>Grade</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={r.average < 40 ? { background: '#fee2e2' } : undefined}>
                  <td><input type="checkbox" checked={selected.includes(r.id)}
                    onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
                  <td>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.name} {r.flagged && <Badge color="amber">Flagged</Badge>}
                  </td>
                  <td>{r.adm}</td>
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
              {colAvg && (
                <tr style={{ background: '#eef2f7', fontWeight: 700 }}>
                  <td></td><td></td><td>Class Average</td><td></td>
                  <td>{colAvg.a1}</td><td>{colAvg.a2}</td><td>{colAvg.a3}</td><td>{colAvg.a4}</td>
                  <td>{colAvg.average}</td><td></td><td></td>
                </tr>
              )}
              {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)' }}>No students match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance summary */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <h3 className="section-title">Competency Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={gradeDist} dataKey="value" nameKey="grade" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.grade}: ${e.value}`}>
                {gradeDist.map((d) => <Cell key={d.grade} fill={GRADE_COLORS[d.grade]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card card-pad">
          <h3 className="section-title">Subject Comparison (class average)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={subjectCompare} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="avg" name="Avg Rubric" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 className="section-title">Top 5 Students</h3>
          <div className="list-flex">
            {top5.map((r, i) => (
              <div key={r.id} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <span style={{ flex: 1 }}>{r.name}</span>
                <strong>{r.average}</strong>
                <Badge color={r.grade === 'EE' || r.grade === 'ME' ? 'green' : 'amber'}>{r.grade}</Badge>
              </div>
            ))}
            {top5.length === 0 && <span className="muted">No data.</span>}
          </div>
        </div>
        <div className="card card-pad">
          <h3 className="section-title">At-Risk Students (avg rubric &lt; 2.0)</h3>
          <div className="list-flex">
            {atRisk.map((r) => (
              <div key={r.id} className="rank-row">
                <span style={{ flex: 1 }}>{r.name} <span className="muted">({r.average})</span></span>
                {r.flagged ? <Badge color="amber">Flagged</Badge> : (
                  <button className="btn btn-sm" onClick={() => flagStudent(r.id)}>Flag for Support</button>
                )}
              </div>
            ))}
            {atRisk.length === 0 && <span className="muted">No at-risk students in this subject. <Icon name="check" size={16} style={{ verticalAlign: 'text-bottom' }} /></span>}
          </div>
        </div>
      </div>
    </div>
  );
}
