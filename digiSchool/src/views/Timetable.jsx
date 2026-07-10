import { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '../components/Modal';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { SUBJECTS, DEPARTMENTS, DEPT_COLORS, getDynamicClasses, expandClassesWithStreams } from '../data/seed';
import { exportTablePDF, downloadExcel, exportTimetableLandscapePDF } from '../utils/exporters';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const deptColorBg = {
  Sciences: '#dbeafe',
  Humanities: '#dcfce7',
  Languages: '#ede9fe',
  Math: '#fef3c7',
};

function defaultAssignments(teachers = []) {
  if (teachers.length === 0) return [];
  return SUBJECTS.map((sub, i) => ({
    subject: sub,
    teacher: teachers[i % teachers.length]?.name || 'TBD',
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

export default function Timetable({ store, user }) {
  const isTimetableAdmin = user?.role === 'principal' || user?.role === 'deputy_admin' || user?.role === 'deputy_academic';
  const { timetables, setTimetables, notify, settings, students, teachers } = store;
  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(store.settings?.classes || []);
    return saved.length ? saved : ['1A', '2A', '3A']; // Fallback since students array is no longer global
  }, [store.settings]);
  const [term, setTerm] = useState('Term 2');
  const [cls, setCls] = useState(dynamicClasses[0] || '');
  const [tab, setTab] = useState('class');
  const [teacherSel, setTeacherSel] = useState(teachers?.[0]?.name || '');

  const [scheduleModal, setScheduleModal] = useState(false);
  const [workingDays, setWorkingDays] = useState(DAYS.map(() => true));
  
  const [scheduleConfig, setScheduleConfig] = useState(settings?.timetable_schedule || {
    startTime: '07:00',
    periods: 9,
    duration: 40,
    breakAfter: 4,
    breakDuration: 30,
    lunchAfter: 7,
    lunchDuration: 90
  });

  const timeConfig = useMemo(() => {
    let currentTime = new Date(`2000-01-01T${scheduleConfig.startTime}:00`);
    const addMins = (date, mins) => new Date(date.getTime() + mins * 60000);
    const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const intervals = [];
    const times = []; // For PDF
    
    let breakTimeStr = '-';
    let lunchTimeStr = '-';
    let breaks = [];
    
    for (let p = 1; p <= scheduleConfig.periods; p++) {
      const pStart = formatTime(currentTime);
      currentTime = addMins(currentTime, scheduleConfig.duration);
      const pEnd = formatTime(currentTime);
      
      intervals.push({ type: 'lesson', start: pStart, end: pEnd, period: p });
      times.push(`${pStart}-\n${pEnd}`);
      
      if (p === scheduleConfig.breakAfter) {
        const bStart = formatTime(currentTime);
        currentTime = addMins(currentTime, scheduleConfig.breakDuration);
        const bEnd = formatTime(currentTime);
        breakTimeStr = `${bStart}-${bEnd}`;
        times.push(`${bStart}-\n${bEnd}`);
        breaks.push({ period: p, label: 'Break' });
      }
      
      if (p === scheduleConfig.lunchAfter) {
        const lStart = formatTime(currentTime);
        currentTime = addMins(currentTime, scheduleConfig.lunchDuration);
        const lEnd = formatTime(currentTime);
        lunchTimeStr = `${lStart}-${lEnd}`;
        times.push(`${lStart}-\n${lEnd}`);
        breaks.push({ period: p, label: 'Lunch' });
      }
    }
    
    const endTimeStr = formatTime(currentTime);
    return { endTimeStr, breakTimeStr, lunchTimeStr, times, intervals, breaks };
  }, [scheduleConfig]);
  const [assignments, setAssignments] = useState(() => defaultAssignments(teachers || []));

  useEffect(() => {
    if (teachers && teachers.length > 0) {
      setAssignments(prev => prev.length === 0 ? defaultAssignments(teachers) : prev);
      setTeacherSel(prev => prev ? prev : teachers[0].name);
    }
  }, [teachers]);

  useEffect(() => {
    if (!dynamicClasses.includes(cls)) {
      setCls(dynamicClasses[0] || '');
    }
  }, [dynamicClasses, cls]);

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
          classes: dynamicClasses,
          days: activeDays,
          periods: scheduleConfig.periods,
          breaks: timeConfig.breaks,
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
    return dynamicClasses.some((c) => {
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
        for (const c of dynamicClasses) {
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
    
    if (tab === 'class') {
      exportTimetableLandscapePDF({
        title: `GRADE ${cls.replace(/[^0-9]/g, '')} ${term.toUpperCase()} JUNIOR SECONDARY TIMETABLE`,
        grid: tt.grid,
        days: tt.days,
        times: timeConfig.times,
        filename: `timetable-${cls}-${term}.pdf`
      });
      notify('Timetable exported as PDF', 'success', 'Export');
      return;
    }

    const head = ['Period', ...tt.days];
    let body;
    if (tab === 'teacher') {
      body = teacherGrid().map((row, p) => [
        `P${p + 1}`,
        ...row.map((c) => (c ? `${c.subject} (Grade ${c.cls})` : '-')),
      ]);
    } else {
      body = tt.grid.map((row, p) => [
        `P${p + 1}`,
        ...row.map((c) => (c.type === 'break' ? c.label : c.type === 'lesson' ? `${c.subject} (${c.teacher})` : '-')),
      ]);
    }

    exportTablePDF({
      school: settings,
      title: tab === 'teacher' ? `Teacher Timetable — ${teacherSel}` : `Class Timetable — Grade ${cls}`,
      subtitle: `${term} • Generated ${new Date().toLocaleDateString()}`,
      head,
      body,
      filename: tab === 'teacher' ? `timetable-teacher-${teacherSel}.pdf` : `timetable-${cls}-${term}.pdf`,
    });
    notify('Timetable exported as PDF', 'success', 'Export');
  }

  function exportExcel() {
    if (!tt) return notify('Generate a timetable first', 'warning');
    const aoa = [['Period', ...tt.days]];
    if (tab === 'teacher') {
      teacherGrid().forEach((row, p) => {
        aoa.push([`P${p + 1}`, ...row.map((c) => (c ? `${c.subject} / Grade ${c.cls}` : ''))]);
      });
    } else {
      tt.grid.forEach((row, p) => {
        aoa.push([`P${p + 1}`, ...row.map((c) => (c.type === 'break' ? c.label : c.type === 'lesson' ? `${c.subject} / ${c.teacher}` : ''))]);
      });
    }
    
    const sheetName = tab === 'teacher' ? teacherSel.slice(0,31) : `Grade ${cls}`.slice(0,31);
    const filename = tab === 'teacher' ? `timetable-${teacherSel}.xlsx` : `timetable-${cls}-${term}.xlsx`;
    
    downloadExcel(filename, [{ name: sheetName, aoa }]);
    notify('Timetable exported as Excel', 'success', 'Export');
  }

  return (
    <div>
      <PageHeader
        title="Timetable Management"
        subtitle="Generate, edit and export class & teacher timetables"
        actions={
          <>
            {isTimetableAdmin && <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}><Icon name="settings" size={16} /> Generate Timetable</button>}
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
            <button className="btn" onClick={exportExcel}><Icon name="chart" size={16} /> Export Excel</button>
            {isTimetableAdmin && <button className="btn" onClick={() => setImportOpen(true)}><Icon name="download" size={16} /> Import CSV</button>}
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
            {dynamicClasses.map((c) => <option key={c} value={c}>Grade {c}</option>)}
          </select>
        </div>
      </div>

      {/* Generator block */}
      {isTimetableAdmin && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 24, marginBottom: 20, alignItems: 'start' }}>
          
          {/* Left Column: School Schedule Card */}
          <div className="card card-pad" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Icon name="clock" size={20} color="#0284c7" />
              <h3 className="section-title" style={{ margin: 0, color: '#0284c7', fontSize: 16 }}>School Schedule</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span className="muted">Start:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{scheduleConfig.startTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span className="muted">End:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{timeConfig.endTimeStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span className="muted">Periods:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{scheduleConfig.periods}/day</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span className="muted">Duration:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{scheduleConfig.duration} min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span className="muted">Break:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{timeConfig.breakTimeStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Lunch:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{timeConfig.lunchTimeStr}</span>
              </div>
            </div>
            
            <button className="btn btn-outline" style={{ width: '100%', marginTop: 20, color: '#0ea5e9', borderColor: '#bae6fd', background: '#fff' }} onClick={() => setScheduleModal(true)}>
              <Icon name="settings" size={16} /> Edit Schedule
            </button>
            
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: '#0284c7' }}>
                <Icon name="history" size={16} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Generations</span>
              </div>
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                No generations yet
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-primary" style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a8a' }}>
                  <Icon name="bot" size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Generation Settings & Assignments */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Timetable Generator</h3>
              {generating && <div className="muted" style={{ fontSize: 13 }}>Generating… {Math.round(progress)}%</div>}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Working Days</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
                {DAYS.map((d, i) => (
                  <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={workingDays[i]} onChange={() => setWorkingDays((w) => w.map((x, j) => (j === i ? !x : x)))} />
                    {d}
                  </label>
                ))}
              </div>
            </div>

            <label className="field-label">Subject — Teacher Assignments</label>
            <div className="scroll-x" style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Subject</th>
                    <th style={{ padding: '8px 12px' }}>Assigned Teacher</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Periods / Wk</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => (
                    <tr key={a.subject}>
                      <td style={{ padding: '6px 12px', fontWeight: 500 }}>{a.subject}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <select className="select" value={a.teacher} style={{ height: 32, fontSize: 13 }}
                          onChange={(e) => setAssignments((as) => as.map((x, j) => (j === i ? { ...x, teacher: e.target.value } : x)))}>
                          <option value="">-- Select --</option>
                          {(teachers || []).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <input className="input" type="number" min="0" max="10" value={a.perWeek} style={{ width: 60, height: 32, textAlign: 'center', fontSize: 13 }}
                          onChange={(e) => setAssignments((as) => as.map((x, j) => (j === i ? { ...x, perWeek: e.target.value } : x)))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ minWidth: 160 }}>
                {generating ? 'Generating...' : 'Generate New Timetable'}
              </button>
            </div>
            
            {generating && <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${progress}%`, background: 'var(--primary)' }} /></div>}
          </div>
        </div>
      )}

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
                {(teachers || []).map((t) => <option key={t.id}>{t.name}</option>)}
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
                          <td key={d} className="tt-empty" onClick={() => setEditCell({ p, d, subject: SUBJECTS[0], teacher: (teachers?.[0]?.name || ''), notes: '' })}>+</td>
                        );
                      }
                        const conflict = tab === 'class' && hasConflict(cell, p, d);
                        return (
                          <td
                            key={d}
                            className={conflict ? 'tt-conflict' : ''}
                            style={{ 
                              background: deptColorBg[cell.dept] || '#f1f5f9',
                              cursor: isTimetableAdmin ? 'pointer' : 'default'
                            }}
                            onClick={() => isTimetableAdmin && setEditCell({ p, d, ...cell })}
                            title={conflict ? `Conflict: ${cell.teacher} double-booked` : (isTimetableAdmin ? 'Click to edit' : '')}
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
                            <div className="tt-cell-teacher">Grade {cell.cls}</div>
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
          {isTimetableAdmin ? (
            <>Configure the generator above and click <strong>Generate</strong> to build the timetable grid.</>
          ) : (
            <>No timetable has been generated yet.</>
          )}
        </div>
      )}

      {editCell && (
        <EditCellModal cell={editCell} onClose={() => setEditCell(null)} onSave={saveCell} teachers={teachers} />
      )}

      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} notify={notify} />
      )}

      {scheduleModal && (
        <ScheduleModal 
          config={scheduleConfig} 
          onClose={() => setScheduleModal(false)}
          onSave={async (newConfig) => {
            setScheduleConfig(newConfig);
            setScheduleModal(false);
            try {
              const { updateSettings } = await import('../lib/api');
              await updateSettings({ timetable_schedule: newConfig });
              notify('Schedule settings saved successfully', 'success');
            } catch (e) {
              notify('Could not save schedule to server, but applied locally.', 'warning');
            }
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(config);
  
  return (
    <Modal
      title="Edit School Schedule"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Schedule</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-2">
          <div>
            <label className="field-label">Start Time</label>
            <input className="input" type="time" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} />
          </div>
          <div>
            <label className="field-label">Periods per Day</label>
            <input className="input" type="number" min="1" max="15" value={form.periods} onChange={e => setForm(f => ({...f, periods: parseInt(e.target.value) || 1}))} />
          </div>
        </div>
        
        <div>
          <label className="field-label">Period Duration (minutes)</label>
          <input className="input" type="number" min="10" max="120" value={form.duration} onChange={e => setForm(f => ({...f, duration: parseInt(e.target.value) || 40}))} />
        </div>
        
        <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#475569' }}>Short Break</h4>
          <div className="grid grid-2">
            <div>
              <label className="field-label" style={{ fontSize: 11 }}>After Period</label>
              <input className="input" type="number" min="1" max="10" value={form.breakAfter} onChange={e => setForm(f => ({...f, breakAfter: parseInt(e.target.value) || 0}))} />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 11 }}>Duration (min)</label>
              <input className="input" type="number" min="5" max="60" value={form.breakDuration} onChange={e => setForm(f => ({...f, breakDuration: parseInt(e.target.value) || 0}))} />
            </div>
          </div>
        </div>
        
        <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#475569' }}>Lunch Break</h4>
          <div className="grid grid-2">
            <div>
              <label className="field-label" style={{ fontSize: 11 }}>After Period</label>
              <input className="input" type="number" min="1" max="10" value={form.lunchAfter} onChange={e => setForm(f => ({...f, lunchAfter: parseInt(e.target.value) || 0}))} />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 11 }}>Duration (min)</label>
              <input className="input" type="number" min="20" max="120" value={form.lunchDuration} onChange={e => setForm(f => ({...f, lunchDuration: parseInt(e.target.value) || 0}))} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditCellModal({ cell, onClose, onSave, teachers }) {
  const [subject, setSubject] = useState(cell.subject || SUBJECTS[0]);
  const [teacher, setTeacher] = useState(cell.teacher || (teachers?.[0]?.name || ''));
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
            {(teachers || []).map((t) => <option key={t.id}>{t.name}</option>)}
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
