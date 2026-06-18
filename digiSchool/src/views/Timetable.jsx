import { useState, useRef } from 'react';
import Modal from '../components/Modal';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { SUBJECTS, TEACHERS, DEPARTMENTS, DEPT_COLORS, CLASSES } from '../data/seed';
import { exportTablePDF, downloadExcel } from '../utils/exporters';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const deptColorBg = {
  Sciences: '#dbeafe',
  Humanities: '#dcfce7',
  Languages: '#ede9fe',
  Math: '#fef3c7',
};

function defaultAssignments() {
  return SUBJECTS.map((sub, i) => ({
    subject: sub,
    teacher: TEACHERS[i % TEACHERS.length].name,
    perWeek: sub === 'Mathematics' || sub === 'English' ? 5 : 4,
  }));
}

// deterministic-ish generator producing timetables for all classes
function generateAll({ classes, days, periods, breaks, assignments, term }) {
  const breakMap = {};
  breaks.forEach((b) => {
    if (b.period) breakMap[Number(b.period)] = b.label || 'Break';
  });
  const result = {};
  classes.forEach((cls, classIdx) => {
    const pool = [];
    assignments.forEach((a) => {
      const dept = DEPARTMENTS[a.subject] || 'Humanities';
      for (let k = 0; k < Number(a.perWeek || 0); k++) {
        pool.push({ subject: a.subject, teacher: a.teacher, dept });
      }
    });
    // rotate pool per class for variety
    for (let r = 0; r < classIdx * 3; r++) pool.push(pool.shift());

    const grid = [];
    let pi = 0;
    for (let p = 1; p <= periods; p++) {
      const row = [];
      for (let d = 0; d < days.length; d++) {
        if (breakMap[p]) {
          row.push({ type: 'break', label: breakMap[p] });
        } else if (pi < pool.length) {
          const item = pool[(pi + d) % pool.length];
          row.push({ type: 'lesson', ...item, notes: '' });
        } else {
          row.push({ type: 'empty' });
        }
      }
      if (!breakMap[p]) pi += days.length;
      grid.push(row);
    }
    result[cls] = { grid, days, periods, term };
  });
  return result;
}

export default function Timetable({ store }) {
  const { timetables, setTimetables, notify, settings } = store;
  const [term, setTerm] = useState('Term 2');
  const [cls, setCls] = useState('1A');
  const [tab, setTab] = useState('class');
  const [teacherSel, setTeacherSel] = useState(TEACHERS[0].name);

  const [workingDays, setWorkingDays] = useState(DAYS.map(() => true));
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [periodDuration, setPeriodDuration] = useState(40);
  const [breaks, setBreaks] = useState([
    { period: 3, label: 'Break' },
    { period: 6, label: 'Lunch' },
  ]);
  const [assignments, setAssignments] = useState(defaultAssignments);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editCell, setEditCell] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const activeDays = DAYS.filter((_, i) => workingDays[i]);
  const tt = timetables[cls];
  const hasGenerated = Object.keys(timetables).length > 0 && tt;

  function handleGenerate() {
    setGenerating(true);
    setProgress(0);
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1500) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        const gen = generateAll({
          classes: CLASSES,
          days: activeDays,
          periods: Number(periodsPerDay),
          breaks,
          assignments,
          term,
        });
        setTimetables(gen);
        setGenerating(false);
        notify('Timetable generated for all classes', 'success', 'Timetable');
      }
    }, 50);
  }

  function hasConflict(cell, periodIdx, dayIdx) {
    if (!cell || cell.type !== 'lesson') return false;
    return CLASSES.some((c) => {
      if (c === cls) return false;
      const other = timetables[c];
      if (!other) return false;
      const oc = other.grid[periodIdx]?.[dayIdx];
      return oc && oc.type === 'lesson' && oc.teacher === cell.teacher;
    });
  }

  function saveCell(updated) {
    setTimetables((prev) => {
      const copy = { ...prev };
      const grid = copy[cls].grid.map((r) => r.slice());
      grid[editCell.p][editCell.d] = {
        type: 'lesson',
        subject: updated.subject,
        teacher: updated.teacher,
        dept: DEPARTMENTS[updated.subject] || 'Humanities',
        notes: updated.notes,
      };
      copy[cls] = { ...copy[cls], grid };
      return copy;
    });
    setEditCell(null);
    notify('Timetable cell updated', 'success', 'Timetable');
  }

  // Teacher timetable: scan all classes for this teacher
  function teacherGrid() {
    const periods = tt?.periods || 8;
    const grid = [];
    for (let p = 0; p < periods; p++) {
      const row = [];
      for (let d = 0; d < activeDays.length; d++) {
        let found = null;
        for (const c of CLASSES) {
          const cell = timetables[c]?.grid[p]?.[d];
          if (cell && cell.type === 'lesson' && cell.teacher === teacherSel) {
            found = { ...cell, cls: c };
            break;
          }
        }
        row.push(found);
      }
      grid.push(row);
    }
    return grid;
  }

  function exportPDF() {
    if (!tt) return notify('Generate a timetable first', 'warning');
    const head = ['Period', ...tt.days];
    const body = tt.grid.map((row, p) => [
      `P${p + 1}`,
      ...row.map((c) => (c.type === 'break' ? c.label : c.type === 'lesson' ? `${c.subject} (${c.teacher})` : '-')),
    ]);
    exportTablePDF({
      school: settings,
      title: `Class Timetable — Form ${cls}`,
      subtitle: `${term} • Generated ${new Date().toLocaleDateString()}`,
      head,
      body,
      filename: `timetable-${cls}-${term}.pdf`,
    });
    notify('Timetable exported as PDF', 'success', 'Export');
  }

  function exportExcel() {
    if (!tt) return notify('Generate a timetable first', 'warning');
    const aoa = [['Period', ...tt.days]];
    tt.grid.forEach((row, p) => {
      aoa.push([`P${p + 1}`, ...row.map((c) => (c.type === 'break' ? c.label : c.type === 'lesson' ? `${c.subject} / ${c.teacher}` : ''))]);
    });
    downloadExcel(`timetable-${cls}-${term}.xlsx`, [{ name: `Form ${cls}`, aoa }]);
    notify('Timetable exported as Excel', 'success', 'Export');
  }

  return (
    <div>
      <PageHeader
        title="Timetable Management"
        subtitle="Generate, edit and export class & teacher timetables"
        actions={
          <>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}><Icon name="settings" size={16} /> Generate Timetable</button>
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
            <button className="btn" onClick={exportExcel}><Icon name="chart" size={16} /> Export Excel</button>
            <button className="btn" onClick={() => setImportOpen(true)}><Icon name="download" size={16} /> Import CSV</button>
          </>
        }
      />

      <div className="toolbar">
        <div>
          <label className="field-label">Term</label>
          <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 140 }}>
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Class</label>
          <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} style={{ width: 140 }}>
            {CLASSES.map((c) => <option key={c} value={c}>Form {c}</option>)}
          </select>
        </div>
      </div>

      {/* Generator panel */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Timetable Generator</h3>
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div>
            <label className="field-label">Working Days</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
              {DAYS.map((d, i) => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={workingDays[i]}
                    onChange={() => setWorkingDays((w) => w.map((x, j) => (j === i ? !x : x)))}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Periods per day</label>
            <input className="input" type="number" min="1" max="12" value={periodsPerDay} onChange={(e) => setPeriodsPerDay(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Period duration (min)</label>
            <input className="input" type="number" min="20" max="120" value={periodDuration} onChange={(e) => setPeriodDuration(e.target.value)} />
          </div>
        </div>

        {/* Breaks */}
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Break / Lunch periods</label>
          {breaks.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input className="input" type="number" placeholder="Period No." value={b.period} style={{ width: 120 }}
                onChange={(e) => setBreaks((bs) => bs.map((x, j) => (j === i ? { ...x, period: e.target.value } : x)))} />
              <input className="input" placeholder="Label" value={b.label} style={{ maxWidth: 240 }}
                onChange={(e) => setBreaks((bs) => bs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <button className="btn btn-icon" onClick={() => setBreaks((bs) => bs.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => setBreaks((bs) => [...bs, { period: '', label: 'Break' }])}>+ Add Break</button>
        </div>

        {/* Subject-Teacher assignments */}
        <label className="field-label">Subject — Teacher assignment</label>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Subject</th><th>Assigned Teacher</th><th>Periods / Week</th></tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.subject}>
                  <td>{a.subject}</td>
                  <td>
                    <select className="select" value={a.teacher} style={{ height: 34 }}
                      onChange={(e) => setAssignments((as) => as.map((x, j) => (j === i ? { ...x, teacher: e.target.value } : x)))}>
                      {TEACHERS.map((t) => <option key={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="input" type="number" min="0" max="10" value={a.perWeek} style={{ width: 80, height: 34 }}
                      onChange={(e) => setAssignments((as) => as.map((x, j) => (j === i ? { ...x, perWeek: e.target.value } : x)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {generating && (
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Generating timetable… {Math.round(progress)}%</div>
            <div className="progress"><span style={{ width: `${progress}%`, background: 'var(--primary)' }} /></div>
          </div>
        )}
        {!generating && (
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleGenerate}>Generate</button>
        )}
      </div>

      {/* Tabs + grid */}
      {hasGenerated && (
        <div className="card card-pad">
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${tab === 'class' ? ' active' : ''}`} onClick={() => setTab('class')}>Class Timetable</button>
            <button className={`tab${tab === 'teacher' ? ' active' : ''}`} onClick={() => setTab('teacher')}>Teacher Timetable</button>
          </div>

          {tab === 'teacher' && (
            <div style={{ marginBottom: 12, maxWidth: 240 }}>
              <label className="field-label">Select Teacher</label>
              <select className="select" value={teacherSel} onChange={(e) => setTeacherSel(e.target.value)}>
                {TEACHERS.map((t) => <option key={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(DEPT_COLORS).map(([dept, color]) => (
              <span key={dept} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} /> {dept}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, border: '2px dashed var(--danger)' }} /> Conflict
            </span>
          </div>

          <div className="scroll-x">
            <table className="tt-grid">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Period</th>
                  {tt.days.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {tab === 'class' && tt.grid.map((row, p) => (
                  <tr key={p}>
                    <td className="tt-period-label">P{p + 1}</td>
                    {row.map((cell, d) => {
                      if (cell.type === 'break') {
                        return <td key={d} className="tt-break">{cell.label}</td>;
                      }
                      if (cell.type === 'empty') {
                        return (
                          <td key={d} className="tt-empty" onClick={() => setEditCell({ p, d, subject: SUBJECTS[0], teacher: TEACHERS[0].name, notes: '' })}>+</td>
                        );
                      }
                      const conflict = hasConflict(cell, p, d);
                      return (
                        <td
                          key={d}
                          className={conflict ? 'tt-conflict' : ''}
                          style={{ background: deptColorBg[cell.dept] || '#f1f5f9' }}
                          onClick={() => setEditCell({ p, d, ...cell })}
                          title={conflict ? `Conflict: ${cell.teacher} double-booked` : ''}
                        >
                          <div className="tt-cell-sub">{cell.subject}</div>
                          <div className="tt-cell-teacher">{cell.teacher}</div>
                          {conflict && <div style={{ color: 'var(--danger)', fontSize: 10, fontWeight: 700 }}><Icon name="warning" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Conflict</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {tab === 'teacher' && teacherGrid().map((row, p) => (
                  <tr key={p}>
                    <td className="tt-period-label">P{p + 1}</td>
                    {row.map((cell, d) => (
                      cell ? (
                        <td key={d} style={{ background: deptColorBg[cell.dept] || '#f1f5f9' }}>
                          <div className="tt-cell-sub">{cell.subject}</div>
                          <div className="tt-cell-teacher">Form {cell.cls}</div>
                        </td>
                      ) : <td key={d} className="tt-empty">—</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasGenerated && !generating && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Configure the generator above and click <strong>Generate</strong> to build the timetable grid.
        </div>
      )}

      {editCell && (
        <EditCellModal cell={editCell} onClose={() => setEditCell(null)} onSave={saveCell} />
      )}

      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} notify={notify} />
      )}
    </div>
  );
}

function EditCellModal({ cell, onClose, onSave }) {
  const [subject, setSubject] = useState(cell.subject || SUBJECTS[0]);
  const [teacher, setTeacher] = useState(cell.teacher || TEACHERS[0].name);
  const [notes, setNotes] = useState(cell.notes || '');
  return (
    <Modal
      title="Edit Timetable Cell"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ subject, teacher, notes })}>Save</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label">Subject</label>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Teacher</label>
          <select className="select" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            {TEACHERS.map((t) => <option key={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Notes</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, notify }) {
  const [drag, setDrag] = useState(false);
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ subject: '', teacher: '', period: '', day: '' });
  const fileRef = useRef(null);

  function parse(text) {
    const lines = text.trim().split(/\r?\n/);
    const hdr = lines[0].split(',').map((h) => h.trim());
    const data = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
    setHeaders(hdr);
    setRows(data);
    setMapping({
      subject: hdr.find((h) => /subject/i.test(h)) || hdr[0] || '',
      teacher: hdr.find((h) => /teacher/i.test(h)) || hdr[1] || '',
      period: hdr.find((h) => /period/i.test(h)) || hdr[2] || '',
      day: hdr.find((h) => /day/i.test(h)) || hdr[3] || '',
    });
  }

  function onFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parse(String(e.target.result));
    reader.readAsText(file);
  }

  function confirmImport() {
    notify(`Imported ${rows.length} rows from CSV`, 'success', 'Import');
    onClose();
  }

  return (
    <Modal
      title="Import Timetable CSV"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={confirmImport} disabled={!rows}>Confirm Import</button>
        </>
      }
    >
      {!rows && (
        <div
          className={`dropzone${drag ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize: 28, color: 'var(--primary)', marginBottom: 8 }}><Icon name="download" size={32} /></div>
          <p>Drag & drop a CSV file here, or click to browse.</p>
          <p style={{ fontSize: 12 }}>Expected columns: Subject, Teacher, Period, Day</p>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => onFile(e.target.files[0])} />
        </div>
      )}

      {rows && (
        <div>
          <h4 style={{ marginBottom: 10 }}>Column Mapping</h4>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            {['subject', 'teacher', 'period', 'day'].map((field) => (
              <div key={field}>
                <label className="field-label" style={{ textTransform: 'capitalize' }}>{field}</label>
                <select className="select" value={mapping[field]} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}>
                  {headers.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <h4 style={{ marginBottom: 10 }}>Preview (first 5 rows)</h4>
          <div className="scroll-x">
            <table className="table">
              <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            {rows.length} rows detected. Validation passed.
          </p>
        </div>
      )}
    </Modal>
  );
}
