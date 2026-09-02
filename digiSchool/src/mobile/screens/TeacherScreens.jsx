import { useMemo, useState, useEffect, useRef } from 'react';
import { BookOpen, Award, MessageSquare, Inbox, CornerUpLeft, Users, Check, UserX } from 'lucide-react';
import { subjectAverage, gradeFor, is844Class } from '../../utils/grading';
import { upsertRow } from '../../lib/api';
import { useTable, Empty, SecHead, Loading, Prog, Composer } from './kit';

function useTeacherContext(store, user) {
  const teachers = store.teachers || [];
  const students = store.students || [];
  const me = teachers.find((t) => t.id === user?.teacher_id || t.name === user?.name) || {};
  const { rows: assignments, loading: aLoading } = useTable('subjectAssignments');
  const { rows: subjects, loading: sLoading } = useTable('subjects');

  const classes = useMemo(() => {
    const subMap = {};
    (subjects || []).forEach((s) => { subMap[s.id] = s.name; });
    const mine = (assignments || []).filter((a) => a.status === 'assigned' && (a.teacher_id === me.id || a.teacher_id === user?.id));
    return mine.map((a) => {
      const label = `${a.class_name}${a.stream_name ? ' ' + a.stream_name : ''}`;
      const subject = subMap[a.subject_id] || a.subject_name || a.subject_id;
      const inClass = students.filter((s) => s.class === label || s.class === a.class_name);
      let sum = 0, n = 0;
      inClass.forEach((s) => { const v = subjectAverage(s.scores?.[subject]); if (v > 0) { sum += v; n += 1; } });
      const mean = n ? Math.round((sum / n) * 10) / 10 : 0;
      const system = is844Class(label) ? '844' : 'CBC';
      return { label, className: a.class_name, subject, learners: inClass.length, entered: n, mean, grade: mean ? gradeFor(mean, store.gradeBoundaries, system) : '—' };
    });
  }, [assignments, subjects, students, me.id, user?.id, store.gradeBoundaries]);

  return { me, classes, loading: aLoading || sLoading };
}

export function TeacherClasses({ store, user }) {
  const { classes, loading } = useTeacherContext(store, user);
  if (loading) return <Loading />;
  if (classes.length === 0) return <Empty icon={BookOpen} text="No classes assigned yet. Your school admin assigns subjects to teachers." />;
  return (
    <>
      <SecHead title="My classes" />
      <div className="eom-list-card">
        {classes.map((c, i) => (
          <div className="eom-li" key={i} style={{ cursor: 'default' }}>
            <span className="eom-lic" style={{ background: 'var(--eom-blue-50)', color: 'var(--eom-blue)' }}><BookOpen /></span>
            <div className="eom-lt"><b>{c.label} · {c.subject}</b><span>{c.learners} learners</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TeacherGradebook({ store, user, open }) {
  const { classes, loading } = useTeacherContext(store, user);
  if (loading) return <Loading />;
  if (classes.length === 0) return <Empty icon={Award} text="Gradebook appears once you're assigned classes." />;
  return (
    <>
      <SecHead title="Enter & review marks" />
      <div className="eom-list-card">
        {classes.map((c, i) => (
          <button className="eom-subj" key={i} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => open('teacher_marks', { label: c.label, className: c.className, subject: c.subject })}>
            <div className="eom-sn">{c.label} · {c.subject}<div style={{ fontSize: 11, color: 'var(--eom-muted)', fontWeight: 500 }}>{c.entered}/{c.learners} marked · tap to enter marks</div></div>
            <div className="eom-sp"><Prog value={c.mean} /></div>
            <span className="eom-sg eom-num">{c.mean ? `${c.mean}%` : '—'}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const ASSESSMENTS = [['a1', 'Exam 1'], ['a2', 'Exam 2'], ['a3', 'Exam 3'], ['a4', 'Exam 4']];
const ABSENT = 'X'; // absent sentinel: stored as the string 'X', ignored by grading (subjectAverage treats non-numeric as 0/skip)

// Zeraki-style marks entry: pick an exam slot, set the "out of" max, then key
// raw marks straight down the list — the keyboard's next/Enter jumps to the
// following student, marks are converted to % and grades derive automatically.
export function TeacherMarks({ store, params }) {
  const { label, className, subject } = params || {};
  const students = useMemo(
    () => (store.students || []).filter((s) => s.class === label || s.class === className)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [store.students, label, className]
  );
  const [assessment, setAssessment] = useState('a1');
  const [maxMarks, setMaxMarks] = useState(100);
  const [marks, setMarks] = useState({});     // studentId -> raw string (out of maxMarks) or 'X'
  const [saved, setSaved] = useState(null);
  const inputs = useRef([]);

  const max = Math.max(1, Number(maxMarks) || 100);

  // (Re)seed the raw inputs from the stored percentages whenever the exam slot
  // or the "out of" value changes, so raw = round(pct * max / 100).
  useEffect(() => {
    const next = {};
    students.forEach((s) => {
      const stored = s.scores?.[subject]?.[assessment];
      if (stored === ABSENT) next[s.id] = ABSENT;
      else if (typeof stored === 'number') next[s.id] = String(Math.round((stored * max) / 100));
      else next[s.id] = '';
    });
    setMarks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, max, students.length, subject]);

  // Persist one student's mark: '' clears, 'X' = absent, else % = raw/max*100.
  const persist = (s, rawVal) => {
    const cur = s.scores || {};
    const subj = { ...(cur[subject] || {}) };
    if (rawVal === '' || rawVal == null) delete subj[assessment];
    else if (rawVal === ABSENT) subj[assessment] = ABSENT;
    else subj[assessment] = Math.max(0, Math.min(100, Math.round((Number(rawVal) || 0) / max * 100)));
    store.updateStudent?.({ ...s, scores: { ...cur, [subject]: subj } });
    setSaved(s.id); setTimeout(() => setSaved((x) => (x === s.id ? null : x)), 1000);
  };

  const onChange = (s, val) => {
    // keep only digits, cap at the max
    let v = val.replace(/[^\d]/g, '');
    if (v !== '' && Number(v) > max) v = String(max);
    setMarks((m) => ({ ...m, [s.id]: v }));
  };
  const toggleAbsent = (s, idx) => {
    const isAbs = marks[s.id] === ABSENT;
    const v = isAbs ? '' : ABSENT;
    setMarks((m) => ({ ...m, [s.id]: v }));
    persist(s, v);
    if (!isAbs) focusNext(idx);
  };
  const focusNext = (idx) => {
    const el = inputs.current[idx + 1];
    if (el) { el.focus(); el.select?.(); }
  };

  const entered = students.filter((s) => { const v = marks[s.id]; return v !== '' && v != null; }).length;

  if (students.length === 0) return <Empty icon={Users} text={`No learners found in ${label || 'this class'}.`} />;
  return (
    <>
      <div className="eom-mk-setup">
        <div className="eom-assess">
          {ASSESSMENTS.map(([k, lbl]) => (
            <button key={k} className={`eom-assess-btn${assessment === k ? ' eom-on' : ''}`} onClick={() => setAssessment(k)}>{lbl}</button>
          ))}
        </div>
        <div className="eom-mk-outof">
          <label>Marks out of</label>
          <input className="eom-num" type="number" inputMode="numeric" min="1" max="1000"
            value={maxMarks} onChange={(e) => setMaxMarks(e.target.value.replace(/[^\d]/g, ''))} />
          <span className="eom-mk-count">{entered}/{students.length} entered</span>
        </div>
      </div>

      <div className="eom-list-card">
        {students.map((s, idx) => {
          const isAbs = marks[s.id] === ABSENT;
          return (
            <div className="eom-markrow" key={s.id}>
              <span className="eom-mk-adm">{s.adm || '—'}</span>
              <div className="eom-marklt"><b>{s.name}</b></div>
              {saved === s.id && <span className="eom-marksaved"><Check size={14} /></span>}
              <input
                ref={(el) => { inputs.current[idx] = el; }}
                className={`eom-markin eom-num${isAbs ? ' eom-abs' : ''}`}
                type={isAbs ? 'text' : 'number'} inputMode="numeric" enterKeyHint="next"
                value={isAbs ? ABSENT : (marks[s.id] ?? '')}
                readOnly={isAbs}
                onChange={(e) => onChange(s, e.target.value)}
                onBlur={(e) => !isAbs && persist(s, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); persist(s, e.target.value); focusNext(idx); } }}
                placeholder="—"
              />
              <button className="eom-mk-abs-btn" title={isAbs ? 'Clear' : 'Mark absent'} onClick={() => toggleAbsent(s, idx)}>
                <UserX size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="eom-markhint">Key each mark out of {max} and press <b>next</b> to jump to the student below. Tap the person icon to mark <b>Absent (X)</b>. Grades and % are worked out automatically.</p>
    </>
  );
}

const STATUSES = ['Present', 'Absent', 'Late'];
const STATUS_COLOR = { Present: '#059669', Absent: '#DC2626', Late: '#D97706' };

export function TeacherAttendance({ store, user }) {
  const { classes, loading } = useTeacherContext(store, user);
  const me = (store.teachers || []).find((t) => t.id === user?.teacher_id || t.name === user?.name) || {};
  const cls = me.assignedClass || classes[0]?.label || classes[0]?.className || '';
  const students = useMemo(
    () => (store.students || []).filter((s) => s.class === cls).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [store.students, cls]
  );
  const { rows: att } = useTable('studentAttendance');
  const today = new Date().toISOString().slice(0, 10);
  const [state, setState] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const seed = {};
    (att || []).forEach((a) => { if (String(a.date || '').slice(0, 10) === today && a.adm) seed[a.adm] = a.status; });
    setState(seed);
  }, [att, today]);

  const save = async () => {
    setSaving(true); setDone(false);
    try {
      await Promise.all(students.map((s) => upsertRow('student_attendance', {
        id: `att_${s.adm}_${today}`, date: today, student_id: s.id, adm: s.adm,
        class: cls, status: state[s.adm] || 'Present', recorded_by: user?.name || 'Teacher',
      })));
      setDone(true); setTimeout(() => setDone(false), 1800);
    } catch { /* store shows errors via its own path */ } finally { setSaving(false); }
  };

  if (loading) return <Loading />;
  if (!cls) return <Empty icon={Users} text="You're not assigned as a class teacher, so there's no register to mark." />;
  if (students.length === 0) return <Empty icon={Users} text={`No learners found in ${cls}.`} />;
  return (
    <>
      <div className="eom-sec"><h5>{cls} · {today}</h5></div>
      <div className="eom-list-card">
        {students.map((s) => (
          <div className="eom-markrow" key={s.id}>
            <div className="eom-marklt"><b>{s.name}</b><span>{s.adm || ''}</span></div>
            <div className="eom-att-seg">
              {STATUSES.map((st) => (
                <button key={st} className={`eom-att-btn${(state[s.adm] || 'Present') === st ? ' eom-on' : ''}`}
                  style={(state[s.adm] || 'Present') === st ? { background: STATUS_COLOR[st], borderColor: STATUS_COLOR[st], color: '#fff' } : undefined}
                  onClick={() => setState((p) => ({ ...p, [s.adm]: st }))}>{st[0]}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="eom-btn-solid" style={{ height: 50, width: '100%' }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : done ? <><Check size={17} /> Saved</> : 'Save register'}
      </button>
    </>
  );
}

export function TeacherMessages({ store, user }) {
  const students = store.students || [];
  const me = (store.teachers || []).find((t) => t.id === user?.teacher_id || t.name === user?.name) || {};
  const assignedClass = me.assignedClass || null;
  const teacherName = user?.name || '';
  const { rows, loading } = useTable('messages');

  const [items, setItems] = useState([]);
  const [replyTo, setReplyTo] = useState(null); // the message being replied to

  useEffect(() => {
    setItems((rows || []).filter((m) => {
      if (m.recipient_id && user?.id) return String(m.recipient_id) === String(user.id);
      if (!m.recipient_role) return false;
      const role = String(m.recipient_role).toLowerCase().trim();
      if (role === 'class teacher' && assignedClass && m.student_id) {
        const stu = students.find((s) => s.id === m.student_id || s.adm === m.student_id);
        if (stu && stu.class === assignedClass) return true;
      }
      if (teacherName && role === teacherName.toLowerCase().trim()) return true;
      return false;
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }, [rows, assignedClass, teacherName, students, user?.id]);

  const sendReply = async ({ subject, body }) => {
    const msg = replyTo;
    const now = new Date().toISOString();
    // Mark the incoming message replied, and deliver a new message back to the
    // parent (routed by their user id + student link) — same as desktop.
    await upsertRow('messages', { ...msg, status: 'Replied', reply: body, replied_at: now });
    await upsertRow('messages', {
      id: `msg_${Date.now()}`,
      sender_id: user?.id || teacherName, sender_name: teacherName, sender_role: 'teacher',
      recipient_role: 'parent', recipient_id: msg.sender_id || null,
      student_id: msg.student_id || null, student_name: msg.student_name || null,
      subject, body, status: 'Unread', created_at: now,
    });
    setItems((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'Replied' } : m)));
    setReplyTo(null);
  };

  if (loading) return <Loading />;
  if (replyTo) {
    return (
      <Composer
        title={`Reply · ${replyTo.student_name || 'Parent'}`}
        replyTo={replyTo.subject || 'your message'}
        onSend={sendReply} onCancel={() => setReplyTo(null)}
      />
    );
  }
  if (items.length === 0) return <Empty icon={Inbox} text="No messages from parents yet." />;
  return (
    <>
      <SecHead title="Parent messages" />
      <div className="eom-list-card">
        {items.slice(0, 40).map((m) => (
          <button className="eom-li" key={m.id} style={{ alignItems: 'flex-start' }} onClick={() => setReplyTo(m)}>
            <span className="eom-lic" style={{ background: 'var(--eom-info-100)', color: 'var(--eom-info)' }}><MessageSquare /></span>
            <div className="eom-lt">
              <b>{m.subject || 'Message'}{m.student_name ? ` · ${m.student_name}` : ''}</b>
              <span className="eom-msg-body">{m.body || ''}</span>
              <span style={{ color: 'var(--eom-blue)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <CornerUpLeft size={13} /> {m.status === 'Replied' ? 'Replied · tap to reply again' : 'Tap to reply'}
              </span>
            </div>
            <span className="eom-rt">{String(m.created_at || '').slice(0, 10)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
