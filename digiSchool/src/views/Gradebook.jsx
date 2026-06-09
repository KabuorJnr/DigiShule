import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { PageHeader, Badge } from '../components/widgets';
import { CLASSES, SUBJECTS } from '../data/seed';
import { computeRow, gradeFor, remarkFor, subjectAverage } from '../utils/grading';
import { exportTablePDF, downloadExcel, exportReportCardsPDF } from '../utils/exporters';

const GRADE_COLORS = { A: '#10B981', B: '#3B82F6', C: '#F59E0B', D: '#F97316', E: '#EF4444' };
const ASSESS_OPTIONS = ['All', 'CAT 1', 'CAT 2', 'Midterm', 'End-Term'];

export default function Gradebook({ store }) {
  const { students, updateStudent, gradeBoundaries, settings, notify } = store;
  const [cls, setCls] = useState('1A');
  const [subject, setSubject] = useState('Mathematics');
  const [term, setTerm] = useState('Term 2');
  const [assessment, setAssessment] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {id, field}
  const [selected, setSelected] = useState([]);

  const classStudents = useMemo(
    () => students.filter((s) => s.class === cls && s.name.toLowerCase().includes(search.toLowerCase())),
    [students, cls, search]
  );

  const rows = useMemo(() =>
    classStudents.map((s) => {
      const r = computeRow(s.scores[subject]);
      const grade = gradeFor(r.average, gradeBoundaries);
      return { ...s, ...r, grade, remarks: remarkFor(grade) };
    }), [classStudents, subject, gradeBoundaries]);

  const colAvg = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = (k) => rows.reduce((a, b) => a + b[k], 0);
    const avg = (k) => Math.round((sum(k) / rows.length) * 10) / 10;
    return { cat1: avg('cat1'), cat2: avg('cat2'), midterm: avg('midterm'), endterm: avg('endterm'), total: avg('total'), average: avg('average') };
  }, [rows]);

  // performance summary
  const gradeDist = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    rows.forEach((r) => { counts[r.grade] = (counts[r.grade] || 0) + 1; });
    return Object.entries(counts).map(([grade, value]) => ({ grade, value }));
  }, [rows]);

  const top5 = useMemo(() => [...rows].sort((a, b) => b.average - a.average).slice(0, 5), [rows]);
  const atRisk = useMemo(() => rows.filter((r) => r.average < 40), [rows]);
  const subjectCompare = useMemo(() =>
    SUBJECTS.map((sub) => {
      const avg = classStudents.reduce((a, s) => a + subjectAverage(s.scores[sub]), 0) / (classStudents.length || 1);
      return { subject: sub.slice(0, 4), avg: Math.round(avg * 10) / 10 };
    }), [classStudents]);

  function saveScore(id, field, value) {
    const v = Math.max(0, Math.min(field === 'cat1' || field === 'cat2' ? 30 : 100, Number(value) || 0));
    const target = students.find((s) => s.id === id);
    if (target) {
      updateStudent({ ...target, scores: { ...target.scores, [subject]: { ...target.scores[subject], [field]: v } } });
    }
    setEditing(null);
  }

  function flagStudent(id) {
    const target = students.find((s) => s.id === id);
    if (target) updateStudent({ ...target, flagged: true });
    notify('Student flagged for support', 'success', 'Gradebook');
  }

  function exportPDF() {
    const head = ['#', 'Student', 'Adm No.', 'CAT1', 'CAT2', 'Mid', 'End', 'Total', 'Avg %', 'Grade', 'Remarks'];
    const body = rows.map((r, i) => [i + 1, r.name, r.adm, r.cat1, r.cat2, r.midterm, r.endterm, r.total, r.average, r.grade, r.remarks]);
    exportTablePDF({ school: settings, title: `Gradebook — Form ${cls} • ${subject}`, subtitle: `${term} • ${assessment}`, head, body, filename: `gradebook-${cls}-${subject}.pdf` });
    notify('Gradebook exported as PDF', 'success', 'Export');
  }
  function exportExcel() {
    const aoa = [['#', 'Student', 'Adm No.', 'CAT1', 'CAT2', 'Midterm', 'End-Term', 'Total', 'Average %', 'Grade', 'Remarks']];
    rows.forEach((r, i) => aoa.push([i + 1, r.name, r.adm, r.cat1, r.cat2, r.midterm, r.endterm, r.total, r.average, r.grade, r.remarks]));
    downloadExcel(`gradebook-${cls}-${subject}.xlsx`, [{ name: `${cls} ${subject}`.slice(0, 31), aoa }]);
    notify('Gradebook exported as Excel', 'success', 'Export');
  }

  function generateReportCards() {
    const chosen = rows.filter((r) => selected.includes(r.id));
    if (chosen.length === 0) return notify('Select at least one student', 'warning');
    const ranked = [...classStudents].map((s) => {
      const avg = SUBJECTS.reduce((a, sub) => a + subjectAverage(s.scores[sub]), 0) / SUBJECTS.length;
      return { id: s.id, avg };
    }).sort((a, b) => b.avg - a.avg);
    const posOf = (id) => ranked.findIndex((x) => x.id === id) + 1;

    const enriched = chosen.map((r) => {
      const overall = Math.round((SUBJECTS.reduce((a, sub) => a + subjectAverage(r.scores[sub]), 0) / SUBJECTS.length) * 10) / 10;
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
      students: enriched,
      subjects: SUBJECTS,
      computeStudent: (stu, sub) => {
        const rr = computeRow(stu.scores[sub]);
        const g = gradeFor(rr.average, gradeBoundaries);
        return { score: rr.average, grade: g, remark: remarkFor(g) };
      },
      filename: `report-cards-${cls}.pdf`,
    });
    notify(`Generated ${chosen.length} report card(s)`, 'success', 'Report Cards');
  }

  const ScoreCell = ({ r, field }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            className="score-input"
            type="number"
            autoFocus
            defaultValue={r[field]}
            onKeyDown={(e) => { if (e.key === 'Enter') saveScore(r.id, field, e.target.value); if (e.key === 'Escape') setEditing(null); }}
            onBlur={(e) => saveScore(r.id, field, e.target.value)}
          />
        </td>
      );
    }
    return <td className="editable-cell" onClick={() => setEditing({ id: r.id, field })} title="Click to edit">{r[field]}</td>;
  };

  return (
    <div>
      <PageHeader
        title="Gradebook Review"
        subtitle="Inspect, edit and analyse student performance"
        actions={
          <>
            <button className="btn" onClick={exportPDF}>📄 Export Gradebook PDF</button>
            <button className="btn" onClick={exportExcel}>📊 Export Excel</button>
          </>
        }
      />

      <div className="toolbar">
        <div><label className="field-label">Class</label>
          <select className="select" value={cls} onChange={(e) => { setCls(e.target.value); setSelected([]); }} style={{ width: 120 }}>
            {CLASSES.map((c) => <option key={c} value={c}>Form {c}</option>)}
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
          <button className="btn btn-primary btn-sm" onClick={generateReportCards}>🖨️ Generate Report Cards</button>
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
                <th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th>
                <th>Total</th><th>Average %</th><th>Grade</th><th>Remarks</th>
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
                  <ScoreCell r={r} field="cat1" />
                  <ScoreCell r={r} field="cat2" />
                  <ScoreCell r={r} field="midterm" />
                  <ScoreCell r={r} field="endterm" />
                  <td><strong>{r.total}</strong></td>
                  <td>{r.average}</td>
                  <td><Badge color={r.grade === 'A' || r.grade === 'B' ? 'green' : r.grade === 'C' ? 'amber' : 'red'}>{r.grade}</Badge></td>
                  <td>{r.remarks}</td>
                </tr>
              ))}
              {colAvg && (
                <tr style={{ background: '#eef2f7', fontWeight: 700 }}>
                  <td></td><td></td><td>Class Average</td><td></td>
                  <td>{colAvg.cat1}</td><td>{colAvg.cat2}</td><td>{colAvg.midterm}</td><td>{colAvg.endterm}</td>
                  <td>{colAvg.total}</td><td>{colAvg.average}%</td><td></td><td></td>
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
          <h3 className="section-title">Grade Distribution</h3>
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
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="avg" name="Avg %" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
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
                <strong>{r.average}%</strong>
                <Badge color={r.grade === 'A' || r.grade === 'B' ? 'green' : 'amber'}>{r.grade}</Badge>
              </div>
            ))}
            {top5.length === 0 && <span className="muted">No data.</span>}
          </div>
        </div>
        <div className="card card-pad">
          <h3 className="section-title">At-Risk Students (avg &lt; 40%)</h3>
          <div className="list-flex">
            {atRisk.map((r) => (
              <div key={r.id} className="rank-row">
                <span style={{ flex: 1 }}>{r.name} <span className="muted">({r.average}%)</span></span>
                {r.flagged ? <Badge color="amber">Flagged</Badge> : (
                  <button className="btn btn-sm" onClick={() => flagStudent(r.id)}>Flag for Support</button>
                )}
              </div>
            ))}
            {atRisk.length === 0 && <span className="muted">No at-risk students in this subject. 🎉</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
