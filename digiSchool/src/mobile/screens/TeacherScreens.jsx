import { useMemo, useState, useEffect } from 'react';
import { BookOpen, Award, MessageSquare, Inbox, CornerUpLeft } from 'lucide-react';
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
      return { label, subject, learners: inClass.length, entered: n, mean, grade: mean ? gradeFor(mean, store.gradeBoundaries, system) : '—' };
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

export function TeacherGradebook({ store, user }) {
  const { classes, loading } = useTeacherContext(store, user);
  if (loading) return <Loading />;
  if (classes.length === 0) return <Empty icon={Award} text="Gradebook appears once you're assigned classes and marks are entered." />;
  return (
    <>
      <SecHead title="Subject performance" />
      <div className="eom-list-card">
        {classes.map((c, i) => (
          <div className="eom-subj" key={i}>
            <div className="eom-sn">{c.label} · {c.subject}<div style={{ fontSize: 11, color: 'var(--eom-muted)', fontWeight: 500 }}>{c.entered}/{c.learners} marked</div></div>
            <div className="eom-sp"><Prog value={c.mean} /></div>
            <span className="eom-sg eom-num">{c.mean ? `${c.mean}%` : '—'}</span>
          </div>
        ))}
      </div>
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
              <span style={{ whiteSpace: 'normal' }}>{(m.body || '').slice(0, 140)}</span>
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
