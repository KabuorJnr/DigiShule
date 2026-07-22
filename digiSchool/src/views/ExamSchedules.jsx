import { useState, useMemo } from 'react';
import Modal from '../components/Modal';
import { PageHeader, Badge } from '../components/widgets';
import { Icon } from '../components/icons';
import { SUBJECTS, CLASSES, getDynamicClasses } from '../data/seed';
import { exportTablePDF, downloadExcel } from '../utils/exporters';

const EXAM_TYPES = ['Mid-Term', 'End-Term', 'Mock', 'CAT'];
const STATUSES = ['Upcoming', 'In Progress', 'Completed', 'Cancelled'];
const statusColor = { Upcoming: 'blue', 'In Progress': 'amber', Completed: 'green', Cancelled: 'red' };

export default function ExamSchedules({ store, params = {} }) {
  const { examSchedules, setExamSchedules, venues, setVenues, notify, settings, teachers = [] } = store;
  const [examType, setExamType] = useState('End-Term');
  const [year, setYear] = useState('2026');
  const [term, setTerm] = useState('Term 2');
  const [mode, setMode] = useState('list'); // list | calendar
  const [mainTab, setMainTab] = useState('schedules'); // schedules | venues
  const [createOpen, setCreateOpen] = useState(params.openCreate || false);
  const [editSession, setEditSession] = useState(null);
  const [selected, setSelected] = useState([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const [chipDetail, setChipDetail] = useState(null);

  const dynamicClasses = useMemo(() => {
    if (settings?.classes?.length) {
      return settings.classes.map(c => c.name);
    }
    return [...new Set(getDynamicClasses(store.students).map(c => c.replace(/\s*[A-Z]$/, '')))];
  }, [settings?.classes, store.students]);

  const flat = useMemo(() =>
    examSchedules.flatMap((s) =>
      s.sessions.map((sess) => ({ ...sess, scheduleId: s.id, scheduleName: s.name, type: s.type }))
    ), [examSchedules]);

  const sorted = useMemo(() => {
    const arr = [...flat];
    arr.sort((a, b) => {
      const x = a[sortKey] ?? '';
      const y = b[sortKey] ?? '';
      return sortDir === 'asc' ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
    });
    return arr;
  }, [flat, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function updateSession(sessionId, patch) {
    setExamSchedules((prev) =>
      prev.map((s) => ({ ...s, sessions: s.sessions.map((ss) => (ss.id === sessionId ? { ...ss, ...patch } : ss)) }))
    );
  }
  function deleteSession(sessionId) {
    setExamSchedules((prev) => prev.map((s) => ({ ...s, sessions: s.sessions.filter((ss) => ss.id !== sessionId) })));
    setSelected((sel) => sel.filter((id) => id !== sessionId));
    notify('Exam session deleted', 'success', 'Exam Schedules');
  }
  function cycleStatus(session) {
    const idx = STATUSES.indexOf(session.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    updateSession(session.id, { status: next });
    notify(`Status changed to ${next}`, 'info', 'Exam Schedules');
  }

  function bulkCancel() {
    selected.forEach((id) => updateSession(id, { status: 'Cancelled' }));
    notify(`${selected.length} sessions cancelled`, 'success', 'Exam Schedules');
    setSelected([]);
  }
  function bulkReschedule(date) {
    selected.forEach((id) => updateSession(id, { date }));
    notify(`${selected.length} sessions rescheduled to ${date}`, 'success', 'Exam Schedules');
    setSelected([]);
    setRescheduleOpen(false);
  }

  function exportPDF() {
    const head = ['Date', 'Class', 'Subject', 'Start', 'End', 'Venue', 'Invigilator', 'Status'];
    const body = sorted.map((s) => [s.date, s.classes, s.subject, s.start, s.end, s.venue, s.invigilator, s.status]);
    exportTablePDF({ school: settings, title: 'Examination Timetable', subtitle: `${examType}  |  ${term} ${year}`, head, body, filename: `exam-schedule-${year}.pdf` });
    notify('Exam timetable exported as PDF', 'success', 'Export');
  }
  function exportExcel() {
    const aoa = [['Date', 'Class', 'Subject', 'Start', 'End', 'Venue', 'Invigilator', 'Status']];
    sorted.forEach((s) => aoa.push([s.date, s.classes, s.subject, s.start, s.end, s.venue, s.invigilator, s.status]));
    downloadExcel(`exam-schedule-${year}.xlsx`, [{ name: 'Exams', aoa }]);
    notify('Exam timetable exported as Excel', 'success', 'Export');
  }

  const venueUsage = (name) => flat.filter((s) => s.venue === name).length;

  return (
    <div>
      <PageHeader
        title="Exam Schedules"
        subtitle="Plan, schedule and track examinations"
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Schedule Exam</button>
            <button className="btn" onClick={exportPDF}><Icon name="file" size={16} /> Export PDF</button>
            <button className="btn" onClick={exportExcel}><Icon name="chart" size={16} /> Export Excel</button>
            <button className="btn" onClick={() => notify('Import dialog (demo)', 'info', 'Import')}><Icon name="download" size={16} /> Import</button>
          </>
        }
      />

      <div className="toolbar">
        <div>
          <label className="field-label">Exam Type</label>
          <select className="select" value={examType} onChange={(e) => setExamType(e.target.value)} style={{ width: 150 }}>
            {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Year</label>
          <select className="select" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 110 }}>
            {['2025', '2026', '2027'].map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Term</label>
          <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 120 }}>
            {['Term 1', 'Term 2', 'Term 3'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${mainTab === 'schedules' ? ' active' : ''}`} onClick={() => setMainTab('schedules')}>Schedules</button>
        <button className={`tab${mainTab === 'venues' ? ' active' : ''}`} onClick={() => setMainTab('venues')}>Venues</button>
      </div>

      {mainTab === 'schedules' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div className="seg">
              <button className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}><Icon name="calendar" size={16} /> Calendar View</button>
              <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}><Icon name="list" size={16} /> List View</button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, background: '#f0f6ff' }}>
              <strong>{selected.length} selected</strong>
              <button className="btn btn-danger btn-sm" onClick={bulkCancel}>Cancel Selected</button>
              <button className="btn btn-sm" onClick={() => setRescheduleOpen(true)}>Reschedule Selected</button>
              <button className="btn btn-sm" onClick={() => setSelected([])}>Clear</button>
            </div>
          )}

          {mode === 'list' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox"
                          checked={selected.length === sorted.length && sorted.length > 0}
                          onChange={(e) => setSelected(e.target.checked ? sorted.map((s) => s.id) : [])} />
                      </th>
                      {['date', 'classes', 'subject', 'start', 'end', 'venue', 'invigilator', 'status'].map((k) => (
                        <th key={k} style={{ cursor: 'pointer' }} onClick={() => toggleSort(k)}>
                          {k === 'classes' ? 'Class' : k.charAt(0).toUpperCase() + k.slice(1)}
                          {sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => (
                      <tr key={s.id}>
                        <td><input type="checkbox" checked={selected.includes(s.id)}
                          onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} /></td>
                        <td>{s.date}</td>
                        <td>{s.classes}</td>
                        <td>{s.subject}</td>
                        <td>{s.start}</td>
                        <td>{s.end}</td>
                        <td>{s.venue}</td>
                        <td>{s.invigilator}</td>
                        <td><Badge color={statusColor[s.status]}>{s.status}</Badge></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm" onClick={() => setEditSession(s)}>Edit</button>{' '}
                          <button className="btn btn-sm" onClick={() => cycleStatus(s)}>Status</button>{' '}
                          <button className="btn btn-sm btn-danger" onClick={() => deleteSession(s.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {sorted.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)' }}>No exam sessions.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mode === 'calendar' && <CalendarView sessions={flat} onChip={setChipDetail} />}
        </>
      )}

      {mainTab === 'venues' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAddVenueOpen(true)}><Icon name="plus" size={14} /> Add Venue</button>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Venue Name</th><th>Capacity</th><th>Exam Sessions Assigned</th><th>Status</th></tr></thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.capacity}</td>
                    <td>{venueUsage(v.name)}</td>
                    <td><Badge color={v.status === 'available' ? 'green' : 'amber'}>{v.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateScheduleModal
          defaultType={examType}
          onClose={() => setCreateOpen(false)}
          venues={venues}
          teachers={teachers}
          dynamicClasses={dynamicClasses}
          onSave={(schedule) => {
            setExamSchedules((prev) => [...prev, schedule]);
            notify('Exam schedule saved', 'success', 'Exam Schedules');
            setCreateOpen(false);
          }}
        />
      )}

      {editSession && (
        <EditSessionModal
          session={editSession}
          venues={venues}
          teachers={teachers}
          onClose={() => setEditSession(null)}
          onSave={(patch) => { updateSession(editSession.id, patch); setEditSession(null); notify('Exam session updated', 'success', 'Exam Schedules'); }}
        />
      )}

      {rescheduleOpen && (
        <RescheduleModal onClose={() => setRescheduleOpen(false)} onConfirm={bulkReschedule} />
      )}

      {addVenueOpen && (
        <AddVenueModal
          onClose={() => setAddVenueOpen(false)}
          onSave={(v) => { setVenues((prev) => [...prev, { ...v, id: `v${Date.now()}` }]); notify('Venue added', 'success', 'Venues'); setAddVenueOpen(false); }}
        />
      )}

      {chipDetail && (
        <Modal title="Session Details" onClose={() => setChipDetail(null)} footer={<button className="btn btn-primary" onClick={() => setChipDetail(null)}>Close</button>}>
          <p><strong>{chipDetail.subject}</strong> - {chipDetail.classes}</p>
          <p className="muted">{chipDetail.date}  |  {chipDetail.start}â€“{chipDetail.end}</p>
          <p>Venue: {chipDetail.venue}</p>
          <p>Invigilator: {chipDetail.invigilator}</p>
          <Badge color={statusColor[chipDetail.status]}>{chipDetail.status}</Badge>
        </Modal>
      )}
    </div>
  );
}

function CalendarView({ sessions, onChip }) {
  const dates = sessions.map((s) => s.date).sort();
  const base = dates[0] ? new Date(dates[0]) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = first.toLocaleString('en', { month: 'long', year: 'numeric' });

  const byDate = {};
  sessions.forEach((s) => { (byDate[s.date] ||= []).push(s); });

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card card-pad">
      <h3 className="section-title">{monthName}</h3>
      <div className="cal-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const items = byDate[dateStr] || [];
          return (
            <div key={i} className="cal-cell">
              <div className="cal-date">{d}</div>
              {items.map((s) => (
                <div key={s.id} className="cal-chip"
                  style={{ background: s.status === 'Cancelled' ? '#94a3b8' : '#1E3A5F' }}
                  onClick={() => onChip(s)} title={`${s.subject} ${s.start}`}>
                  {s.subject}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionRows({ rows, setRows, venues, dynamicClasses, teachers = [] }) {
  const clashing = rows.map((r, i) =>
    rows.some((o, j) => i !== j && r.classes && r.classes === o.classes && r.date && r.date === o.date && r.start < o.end && o.start < r.end)
  );
  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Class(es)</th><th>Subject</th><th>Start</th><th>End</th><th>Venue</th><th>Invigilator</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={clashing[i] ? { background: '#fee2e2' } : undefined} title={clashing[i] ? 'Clash: overlapping session for this class' : ''}>
              <td><input className="input" type="date" value={r.date} style={{ height: 32, width: 140 }} onChange={(e) => update(i, { date: e.target.value })} /></td>
              <td>
                <select className="select" value={r.classes} style={{ height: 32, width: 110 }} onChange={(e) => update(i, { classes: e.target.value })}>
                  <option value="">Select</option>
                  {dynamicClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="All Grades">All Grades</option>
                </select>
              </td>
              <td>
                <select className="select" value={r.subject} style={{ height: 32, width: 120 }} onChange={(e) => update(i, { subject: e.target.value })}>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td><input className="input" type="time" value={r.start} style={{ height: 32, width: 110 }} onChange={(e) => update(i, { start: e.target.value })} /></td>
              <td><input className="input" type="time" value={r.end} style={{ height: 32, width: 110 }} onChange={(e) => update(i, { end: e.target.value })} /></td>
              <td>
                <select className="select" value={r.venue} style={{ height: 32, width: 130 }} onChange={(e) => update(i, { venue: e.target.value })}>
                  {venues.map((v) => <option key={v.id}>{v.name}</option>)}
                </select>
              </td>
              <td>
                <select className="select" value={r.invigilator} style={{ height: 32, width: 130 }} onChange={(e) => update(i, { invigilator: e.target.value })}>
                   <option value="">Select Invigilator</option>
                   {teachers.map((t) => <option key={t.id}>{t.name}</option>)}
                 </select>
              </td>
              <td><button className="btn btn-icon btn-sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateScheduleModal({ onClose, onSave, defaultType, venues, dynamicClasses, teachers = [] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const defaultTeacherName = teachers.length > 0 ? teachers[0].name : '';
  const [rows, setRows] = useState([
    { date: '', classes: 'Grade 7', subject: 'Mathematics', start: '08:00', end: '10:00', venue: venues[0]?.name || '', invigilator: defaultTeacherName },
  ]);

  function save() {
    const id = `ex${Date.now()}`;
    const sessions = rows.map((r, i) => ({ id: `${id}-s${i}`, ...r, status: 'Upcoming' }));
    onSave({ id, name: name || `${type} Examinations`, type, startDate, endDate, sessions });
  }

  return (
    <Modal
      title="Create New Exam Schedule"
      wide
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Schedule</button></>}
    >
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div><label className="field-label">Exam Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. End-Term 2" /></div>
        <div><label className="field-label">Exam Type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>{EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div><label className="field-label">Start Date</label><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="field-label">End Date</label><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <label className="field-label">Sessions</label>
      <SessionRows rows={rows} setRows={setRows} venues={venues} dynamicClasses={dynamicClasses} teachers={teachers} />
      <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setRows((rs) => [...rs, { date: '', classes: dynamicClasses[0] || '', subject: 'English', start: '08:00', end: '10:00', venue: venues[0]?.name || '', invigilator: '' }])}>+ Add Session</button>
    </Modal>
  );
}

function EditSessionModal({ session, onClose, onSave, venues, teachers = [] }) {
  const [f, setF] = useState({ ...session });
  const up = (patch) => setF((p) => ({ ...p, ...patch }));
  return (
    <Modal title="Edit Exam Session" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(f)}>Save</button></>}>
      <div className="grid grid-2" style={{ gap: 14 }}>
        <div><label className="field-label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => up({ date: e.target.value })} /></div>
        <div><label className="field-label">Class(es)</label><input className="input" value={f.classes} onChange={(e) => up({ classes: e.target.value })} /></div>
        <div><label className="field-label">Subject</label>
          <select className="select" value={f.subject} onChange={(e) => up({ subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="field-label">Status</label>
          <select className="select" value={f.status} onChange={(e) => up({ status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="field-label">Start</label><input className="input" type="time" value={f.start} onChange={(e) => up({ start: e.target.value })} /></div>
        <div><label className="field-label">End</label><input className="input" type="time" value={f.end} onChange={(e) => up({ end: e.target.value })} /></div>
        <div><label className="field-label">Venue</label>
          <select className="select" value={f.venue} onChange={(e) => up({ venue: e.target.value })}>{venues.map((v) => <option key={v.id}>{v.name}</option>)}</select></div>
        <div><label className="field-label">Invigilator</label>
          <select className="select" value={f.invigilator} onChange={(e) => up({ invigilator: e.target.value })}>
             <option value="">Select Invigilator</option>
             {teachers.map((t) => <option key={t.id}>{t.name}</option>)}
           </select>
        </div>
      </div>
    </Modal>
  );
}

function RescheduleModal({ onClose, onConfirm }) {
  const [date, setDate] = useState('');
  return (
    <Modal title="Reschedule Selected Sessions" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!date} onClick={() => onConfirm(date)}>Reschedule</button></>}>
      <label className="field-label">New Date</label>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    </Modal>
  );
}

function AddVenueModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [status, setStatus] = useState('available');
  return (
    <Modal title="Add Venue" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!name} onClick={() => onSave({ name, capacity: Number(capacity), status })}>Save</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label className="field-label">Venue Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="field-label">Capacity</label><input className="input" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        <div><label className="field-label">Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="available">available</option><option value="maintenance">maintenance</option></select></div>
      </div>
    </Modal>
  );
}



