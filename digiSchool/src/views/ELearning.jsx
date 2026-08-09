import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { Video, ExternalLink, Folder, Calendar, ClipboardCheck } from 'lucide-react';
import { SUBJECTS, getSubjectMeta, expandClassesWithStreams } from '../data/seed';
import * as elearning from '../lib/elearningStore';

const MANAGER_ROLES = ['teacher', 'principal', 'deputy_academic', 'dos'];

export default function ELearning({ store, user }) {
  const canManage = MANAGER_ROLES.includes(user?.role);
  const schoolId = store?.schoolId || store?.settings?.school_id || 'default';
  const notify = store?.notify || (() => {});

  const classes = useMemo(() => {
    const list = expandClassesWithStreams(store?.settings?.classes || []);
    return ['All', ...list];
  }, [store?.settings]);

  // The viewer's own class/stream (students & parents)
  const viewerClass = useMemo(() => {
    if (canManage) return null;
    const list = store?.students || [];
    const id = user?.student_id || user?.studentId || user?.link || user?.id;
    const me = list.find((s) => s.id === id || s.adm === user?.username) || list[0];
    return me?.class || null;
  }, [canManage, store?.students, user]);

  const [catalog, setCatalog] = useState([]);
  const [subject, setSubject] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [query, setQuery] = useState('');
  
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attendanceClass, setAttendanceClass] = useState(null); // Which liveClass to mark attendance for

  useEffect(() => {
    setCatalog(elearning.loadCatalog(schoolId));
  }, [schoolId]);

  const persist = (next) => {
    setCatalog(next);
    elearning.saveCatalog(schoolId, next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const forClass = (l) => !l.klass || l.klass === 'All';
    return catalog.filter((l) => {
      // Hard visibility scope: students/parents only see their own class + all-class lessons.
      if (viewerClass && !(forClass(l) || l.klass === viewerClass)) return false;
      // Optional class filter (managers browsing a specific stream).
      if (classFilter !== 'All' && !(forClass(l) || l.klass === classFilter)) return false;
      if (subject !== 'All' && l.subject !== subject) return false;
      if (q && !(`${l.title} ${l.description} ${l.teacher}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [catalog, subject, classFilter, viewerClass, query]);

  const subjectsInUse = useMemo(() => {
    const s = new Set(catalog.map((l) => l.subject));
    return ['All', ...SUBJECTS.filter((sub) => s.has(sub))];
  }, [catalog]);

  function handleScheduleClass(liveClass) {
    persist([liveClass, ...catalog]);
    setScheduleOpen(false);
    notify('Live class scheduled', 'success', 'Live Classes');
  }

  async function handleDelete(liveClass) {
    if (!window.confirm(`Delete the scheduled class "${liveClass.title}"?`)) return;
    try {
      const updated = await elearning.deleteClass(liveClass.id, schoolId);
      setCatalog(updated);
      notify('Class deleted', 'success', 'Live Classes');
    } catch (e) {
      notify('Delete failed', 'error', 'Live Classes');
    }
  }

  return (
    <div>
      <PageHeader
        title="Live Classes"
        subtitle="Join live online classes and access class resources"
        actions={canManage && (
          <button className="btn btn-primary" onClick={() => setScheduleOpen(true)}>
            <Calendar size={16} /> Schedule Class
          </button>
        )}
      />

      {/* Filters */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" placeholder="Search classes…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        {canManage ? (
          <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 170 }} title="Filter by target class">
            {classes.map((c) => <option key={c} value={c}>{c === 'All' ? 'All classes' : `Grade ${c}`}</option>)}
          </select>
        ) : viewerClass && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 16, padding: '4px 12px' }}>
            Your class: Grade {viewerClass}
          </span>
        )}
      </div>

      {/* Subject chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 20px' }}>
        {subjectsInUse.map((s) => {
          const active = subject === s;
          const color = s === 'All' ? '#0284c7' : getSubjectMeta(s).color;
          return (
            <button key={s} onClick={() => setSubject(s)}
              style={{
                border: `1px solid ${active ? color : '#e2e8f0'}`, background: active ? color : '#fff',
                color: active ? '#fff' : '#475569', borderRadius: 16, padding: '5px 14px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {catalog.length === 0
            ? (canManage ? <>No classes scheduled yet. Click <strong>Schedule Class</strong> to add your first one.</> : <>No live classes are currently scheduled. Check back soon.</>)
            : <>No classes match your filters.</>}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((liveClass) => (
            <LiveClassCard
              key={liveClass.id}
              liveClass={liveClass}
              canManage={canManage}
              onDelete={() => handleDelete(liveClass)}
              onMarkAttendance={() => setAttendanceClass(liveClass)}
            />
          ))}
        </div>
      )}

      {scheduleOpen && (
        <ScheduleModal
          user={user}
          classes={classes}
          onClose={() => setScheduleOpen(false)}
          onSave={handleScheduleClass}
        />
      )}

      {attendanceClass && (
        <LiveClassAttendanceModal
          liveClass={attendanceClass}
          store={store}
          onClose={() => setAttendanceClass(null)}
        />
      )}
    </div>
  );
}

function LiveClassCard({ liveClass, canManage, onDelete, onMarkAttendance }) {
  const meta = getSubjectMeta(liveClass.subject);
  
  const formatTime = (timeStr) => {
    if (!timeStr) return 'Ongoing / TBD';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Poster */}
      <div style={{ position: 'relative', height: 110, padding: 0,
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <Video size={24} color={meta.color} />
        </span>
        <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5 }}>{meta.initials}</span>
        {liveClass.demo && <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)', color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>DEMO</span>}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{liveClass.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>{liveClass.subject}{liveClass.klass && liveClass.klass !== 'All' ? ` · Grade ${liveClass.klass}` : ''} · {liveClass.teacher}</div>
        
        <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Calendar size={14} />
          {formatTime(liveClass.scheduledTime)}
        </div>

        {liveClass.description && <div className="muted" style={{ fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 4 }}>{liveClass.description}</div>}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 12, flexWrap: 'wrap' }}>
          {liveClass.meetingLink && (
            <a href={liveClass.meetingLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1, minWidth: 84, padding: '6px 10px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ExternalLink size={14} /> Join Class
            </a>
          )}
          {liveClass.resourceLink && (
            <a href={liveClass.resourceLink} target="_blank" rel="noreferrer" className="btn" style={{ flex: 1, minWidth: 84, padding: '6px 10px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Folder size={14} /> Resources
            </a>
          )}
          {canManage && (
            <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={onMarkAttendance} title="Mark Attendance">
              <ClipboardCheck size={14} />
            </button>
          )}
          {canManage && (
            <button className="btn" style={{ padding: '6px 10px', fontSize: 13, color: '#dc2626' }} onClick={onDelete} title="Delete class">
              <Icon name="warning" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ user, classes, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [klass, setKlass] = useState('All');
  const [description, setDescription] = useState('');
  
  const [meetingLink, setMeetingLink] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  const canSave = title.trim() && meetingLink.trim();

  function submit() {
    if (!canSave) return;
    const liveClass = {
      id: (crypto.randomUUID ? crypto.randomUUID() : `live-${Date.now()}`),
      subject, title: title.trim(), description: description.trim(),
      teacher: user?.name || 'Teacher', teacherId: user?.id || null,
      klass, 
      meetingLink: meetingLink.trim(),
      resourceLink: resourceLink.trim(),
      scheduledTime: scheduledTime,
      createdAt: new Date().toISOString(),
    };
    onSave(liveClass);
  }

  return (
    <Modal title="Schedule Live Class" wide onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>Schedule Class</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <div>
            <label className="field-label">Topic / Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Intro to Algebra" autoFocus />
          </div>
          <div>
            <label className="field-label">Subject</label>
            <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        
        <div className="grid grid-2" style={{ gap: 14 }}>
          <div>
            <label className="field-label">Class</label>
            <select className="select" value={klass} onChange={(e) => setKlass(e.target.value)}>
              {classes.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Classes' : `Grade ${c}`}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Date & Time</label>
            <input type="datetime-local" className="input" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label">Meeting Link (Zoom, Google Meet, Teams) *</label>
          <input type="url" className="input" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." />
        </div>

        <div>
          <label className="field-label">Resource Link (e.g., Google Drive Folder, Shared PDF)</label>
          <input type="url" className="input" value={resourceLink} onChange={(e) => setResourceLink(e.target.value)} placeholder="https://docs.google.com/..." />
        </div>
        
        <div>
          <label className="field-label">Description (Optional)</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will be covered in this session?" rows={3} style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  );
}

function LiveClassAttendanceModal({ liveClass, store, onClose }) {
  const schoolId = store?.schoolId || store?.settings?.school_id || 'default';
  
  const targetStudents = useMemo(() => {
    const all = store.students || [];
    if (liveClass.klass === 'All' || !liveClass.klass) return all;
    return all.filter((s) => s.class === liveClass.klass);
  }, [store.students, liveClass.klass]);

  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    setAttendance(elearning.getLiveAttendance(schoolId, liveClass.id));
  }, [schoolId, liveClass.id]);

  function handleSave() {
    elearning.saveLiveAttendance(schoolId, liveClass.id, attendance);
    if (store.notify) store.notify('Attendance saved!', 'success');
    onClose();
  }

  function markAll(status) {
    const next = { ...attendance };
    targetStudents.forEach((s) => { next[s.adm] = status; });
    setAttendance(next);
  }

  return (
    <Modal title={`Attendance: ${liveClass.title}`} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Attendance</button>
      </>
    }>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {targetStudents.length} student{targetStudents.length !== 1 ? 's' : ''} in {liveClass.klass === 'All' ? 'all classes' : `Grade ${liveClass.klass}`}.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => markAll('Present')} style={{ color: '#047857', borderColor: '#047857' }}>All Present</button>
          <button className="btn btn-sm" onClick={() => markAll('Absent')} style={{ color: '#EF4444', borderColor: '#EF4444' }}>All Absent</button>
        </div>
      </div>

      {targetStudents.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8 }}>
          No students found for this class.
        </div>
      ) : (
        <div className="scroll-x" style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
              <tr>
                <th style={{ width: 80 }}>Adm</th>
                <th>Name</th>
                <th style={{ width: 180, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {targetStudents.map((s) => {
                const status = attendance[s.adm];
                return (
                  <tr key={s.adm}>
                    <td className="muted" style={{ fontSize: 13 }}>{s.adm}</td>
                    <td style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 20, padding: 4, gap: 4 }}>
                        <button
                          onClick={() => setAttendance({ ...attendance, [s.adm]: 'Present' })}
                          style={{
                            border: 'none', background: status === 'Present' ? '#10b981' : 'transparent',
                            color: status === 'Present' ? '#fff' : '#64748b', borderRadius: 16, padding: '4px 12px',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => setAttendance({ ...attendance, [s.adm]: 'Absent' })}
                          style={{
                            border: 'none', background: status === 'Absent' ? '#ef4444' : 'transparent',
                            color: status === 'Absent' ? '#fff' : '#64748b', borderRadius: 16, padding: '4px 12px',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
