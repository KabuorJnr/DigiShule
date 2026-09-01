import { useMemo, useState, useEffect } from 'react';
import {
  Users, GraduationCap, CalendarDays, ClipboardList, Clock,
  Check, X, Search,
} from 'lucide-react';
import { upsertRow } from '../../lib/api';
import { useTable, StatCard, DList, Empty, SecHead, Loading } from './kit';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---- Students directory ----
export function AdminStudents({ store }) {
  const students = store.students || [];
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? students.filter((x) => (x.name || '').toLowerCase().includes(s) || String(x.adm || '').toLowerCase().includes(s) || (x.class || '').toLowerCase().includes(s)) : students;
    return [...base].sort((a, b) => (a.class || '').localeCompare(b.class || '') || (a.name || '').localeCompare(b.name || ''));
  }, [students, q]);
  if (students.length === 0) return <Empty icon={Users} text="No students in the system yet." />;
  return (
    <>
      <div className="eom-searchbar"><Search /><input className="eom-searchinput" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${students.length} students…`} /></div>
      <div className="eom-list-card">
        {list.slice(0, 120).map((s) => (
          <div className="eom-li" key={s.id} style={{ cursor: 'default' }}>
            <span className="eom-lic" style={{ background: 'var(--eom-blue-50)', color: 'var(--eom-blue)' }}><GraduationCap /></span>
            <div className="eom-lt"><b>{s.name}</b><span>{s.adm || '—'} · {s.class || 'Unassigned'}</span></div>
          </div>
        ))}
        {list.length === 0 && <div className="eom-ni-empty">No students match “{q}”.</div>}
      </div>
    </>
  );
}

// ---- Teachers directory ----
export function AdminTeachers({ store }) {
  const teachers = (store.teachers || []).filter((t) => t.status !== 'Inactive');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? teachers.filter((t) => (t.name || '').toLowerCase().includes(s) || (t.subject || '').toLowerCase().includes(s)) : teachers;
  }, [teachers, q]);
  if (teachers.length === 0) return <Empty icon={Users} text="No teaching staff recorded yet." />;
  return (
    <>
      <div className="eom-searchbar"><Search /><input className="eom-searchinput" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${teachers.length} teachers…`} /></div>
      <div className="eom-list-card">
        {list.slice(0, 120).map((t) => (
          <div className="eom-li" key={t.id} style={{ cursor: 'default' }}>
            <span className="eom-lic" style={{ background: 'var(--eom-info-100)', color: 'var(--eom-info)' }}><Users /></span>
            <div className="eom-lt"><b>{t.name}</b><span>{t.subject || t.department || 'Staff'}{t.assignedClass ? ` · Class teacher ${t.assignedClass}` : ''}</span></div>
          </div>
        ))}
        {list.length === 0 && <div className="eom-ni-empty">No teachers match “{q}”.</div>}
      </div>
    </>
  );
}

// ---- Exams ----
export function AdminExams({ store }) {
  const exams = store.examSchedules || [];
  const rows = useMemo(() => [...exams].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [exams]);
  if (rows.length === 0) return <Empty icon={ClipboardList} text="No exams scheduled yet." />;
  return (
    <>
      <SecHead title="Exam schedule" />
      <div className="eom-list-card">
        {rows.slice(0, 60).map((e, i) => (
          <div className="eom-li" key={e.id || i} style={{ cursor: 'default' }}>
            <span className="eom-lic" style={{ background: 'var(--eom-warn-100)', color: 'var(--eom-warn)' }}><ClipboardList /></span>
            <div className="eom-lt"><b>{e.title || e.name || e.subject || 'Exam'}</b><span>{[e.class || e.level, e.subject].filter(Boolean).join(' · ') || '—'}</span></div>
            <span className="eom-rt">{String(e.date || '').slice(0, 10)}{e.time ? ` ${e.time}` : ''}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ---- Timetable (per class) ----
export function AdminTimetable({ store }) {
  const timetables = store.timetables || {};
  const classes = Object.keys(timetables).filter((k) => timetables[k]?.grid);
  const [cls, setCls] = useState(classes[0] || '');
  const periods = useMemo(() => {
    const tt = timetables[cls];
    if (!tt?.grid) return [];
    const days = tt.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const todayName = DAY_NAMES[new Date().getDay()];
    let di = days.indexOf(todayName); if (di === -1) di = 0;
    const out = [];
    for (let p = 0; p < tt.grid.length; p++) {
      const cell = tt.grid[p]?.[di];
      if (cell && cell.subject) out.push({ period: p + 1, subject: cell.subject, teacher: cell.teacher, day: days[di] });
    }
    return out;
  }, [timetables, cls]);

  if (classes.length === 0) return <Empty icon={CalendarDays} text="No timetables published yet." />;
  return (
    <>
      <div className="eom-searchbar" style={{ padding: 0 }}>
        <select className="eom-select" style={{ margin: 0, border: 0, background: 'transparent', fontWeight: 700 }} value={cls} onChange={(e) => setCls(e.target.value)}>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {periods.length === 0 ? <Empty icon={CalendarDays} text={`No periods today for ${cls}.`} /> : (
        <>
          <SecHead title={`${periods[0]?.day || 'Today'} · ${cls}`} />
          <div className="eom-list-card">
            {periods.map((p) => (
              <div className="eom-tt" key={p.period}>
                <span className="eom-ttime">P{p.period}</span><span className="eom-tbar" />
                <div className="eom-tbody"><b>{p.subject}</b><span>{p.teacher || ''}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---- Approvals (leave requests) ----
export function AdminApprovals() {
  const { rows, loading } = useTable('leave_requests');
  const [items, setItems] = useState([]);
  useEffect(() => { setItems((rows || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))); }, [rows]);

  const act = async (l, status) => {
    const updated = { ...l, status, reviewed_at: new Date().toISOString() };
    setItems((prev) => prev.map((x) => (x.id === l.id ? updated : x)));
    try { await upsertRow('leave_requests', updated); } catch { /* optimistic */ }
  };

  if (loading) return <Loading />;
  const pending = items.filter((l) => (l.status || 'Pending') === 'Pending');
  const done = items.filter((l) => (l.status || 'Pending') !== 'Pending');
  return (
    <>
      <SecHead title={`Pending approvals${pending.length ? ` · ${pending.length}` : ''}`} />
      {pending.length === 0 ? <Empty icon={Clock} text="No pending leave requests." /> : (
        <div className="eom-list-card">
          {pending.map((l) => (
            <div className="eom-li" key={l.id} style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="eom-lic" style={{ background: 'var(--eom-warn-100)', color: 'var(--eom-warn)' }}><Clock /></span>
              <div className="eom-lt">
                <b>{l.staff_name || 'Staff'} · {l.type || 'Leave'}</b>
                <span style={{ whiteSpace: 'normal' }}>{[l.start, l.end].filter(Boolean).join(' → ')}{l.reason ? ` · ${l.reason}` : ''}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="eom-btn-solid" style={{ height: 34, flex: 'none', padding: '0 12px' }} onClick={() => act(l, 'Approved')}><Check size={15} /> Approve</button>
                  <button className="eom-btn-ghost" style={{ height: 34, flex: 'none', padding: '0 12px' }} onClick={() => act(l, 'Rejected')}><X size={15} /> Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <SecHead title="Recently reviewed" />
          <DList items={done.slice(0, 20).map((l) => ({ k: `${l.staff_name || 'Staff'} · ${l.type || 'Leave'}`, v: l.status, color: l.status === 'Approved' ? '#059669' : '#DC2626' }))} />
        </>
      )}
    </>
  );
}

// ---- Attendance overview (today) ----
export function AdminAttendance({ store }) {
  const { rows, loading } = useTable('studentAttendance');
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const t = (rows || []).filter((a) => String(a.date || '').slice(0, 10) === today);
    const present = t.filter((a) => /present/i.test(a.status)).length;
    const absent = t.filter((a) => /absent/i.test(a.status)).length;
    const late = t.filter((a) => /late/i.test(a.status)).length;
    const marked = t.length;
    return { present, absent, late, marked, rate: marked ? Math.round((present / marked) * 100) : 0 };
  }, [rows, today]);

  if (loading) return <Loading />;
  return (
    <>
      <StatCard>
        <div className="eom-cap">Student attendance today</div>
        <div className="eom-big eom-num">{stats.marked ? `${stats.rate}%` : '—'}</div>
        <div className="eom-split">
          <div className="eom-cell"><div className="eom-l">Present</div><div className="eom-v eom-num" style={{ color: '#059669' }}>{stats.present}</div></div>
          <div className="eom-cell"><div className="eom-l">Absent</div><div className="eom-v eom-num" style={{ color: '#DC2626' }}>{stats.absent}</div></div>
          <div className="eom-cell"><div className="eom-l">Late</div><div className="eom-v eom-num" style={{ color: '#D97706' }}>{stats.late}</div></div>
        </div>
      </StatCard>
      <DList items={[
        { k: 'Records marked today', v: stats.marked },
        { k: 'Total students', v: (store.students || []).length },
      ]} />
      {stats.marked === 0 && <p className="eom-markhint">No attendance has been marked yet today.</p>}
    </>
  );
}
