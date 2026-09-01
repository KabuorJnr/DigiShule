import { useMemo, useState, useEffect } from 'react';
import { Wallet, CalendarDays, Stethoscope, MessageSquare, Award, Inbox, CreditCard, PenLine } from 'lucide-react';
import { computeRow, gradeFor, is844Class } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import { upsertRow } from '../../lib/api';
import { fmtKES, getChild, useTable, StatCard, Prog, DList, Empty, SecHead, SubjectRow, Loading, Composer } from './kit';

// Non-teacher recipients have no inbox of their own; mirror those into the
// notifications feed (same as the desktop parent portal) so staff receive them.
const OFFICE_AUDIENCE = {
  'School Administration': ['admins'], 'Finance Office': ['finance'],
  'Health Center': ['nurse'], 'Principal': ['principal'],
};

const paidStatuses = (p) => p.status !== 'Verification Pending' && p.status !== 'Pending';

function levelsFor(store) {
  const s = store?.settings || {};
  return s.classes?.length ? s.classes.map((c) => c.name) : (s.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
}

export function ParentFees({ store, user }) {
  const child = getChild(user, store);
  const { rows: payments, loading } = useTable('payments');
  const feeStructure = store.feeStructure || [];
  const levels = levelsFor(store);
  const myLevel = levels.find((l) => child.class?.startsWith(l)) || child.class || levels[0];

  const mine = useMemo(
    () => (payments || []).filter((p) => p.student_id === child.id || p.adm === child.adm),
    [payments, child.id, child.adm]
  );
  const termFees = feeStructure.reduce((s, f) => s + (Number(f[myLevel]) || 0), 0);
  const paid = mine.filter(paidStatuses).reduce((a, p) => a + Number(p.amount || 0), 0);
  const outstanding = Math.max(0, termFees - paid);
  const pct = termFees > 0 ? (paid / termFees) * 100 : 0;

  if (loading) return <Loading />;
  return (
    <>
      <StatCard>
        <div className="eom-cap">Outstanding balance {outstanding > 0
          ? <span className="eom-badge eom-warn">Due</span>
          : <span className="eom-badge eom-up">Cleared</span>}</div>
        <div className="eom-big eom-num">{fmtKES(outstanding)}</div>
        <Prog value={pct} />
        <div className="eom-split">
          <div className="eom-cell"><div className="eom-l">Paid</div><div className="eom-v eom-num">{fmtKES(paid)}</div></div>
          <div className="eom-cell"><div className="eom-l">Term fees</div><div className="eom-v eom-num">{fmtKES(termFees)}</div></div>
        </div>
      </StatCard>

      <SecHead title="Payment history" />
      {mine.length === 0 ? (
        <Empty icon={CreditCard} text="No payments recorded yet for this term." />
      ) : (
        <DList items={mine.slice(0, 40).map((p) => ({
          k: `${(p.created_at || p.date || '').slice(0, 10)} · ${p.method || p.channel || 'Payment'}`,
          v: fmtKES(p.amount),
          color: paidStatuses(p) ? '#059669' : '#D97706',
        }))} />
      )}
    </>
  );
}

export function ParentResults({ store, user }) {
  const child = getChild(user, store);
  const boundaries = store.gradeBoundaries;
  const system = is844Class(child.class) ? '844' : 'CBC';
  const subjects = useMemo(() => {
    if (!child?.scores) return [];
    return SUBJECTS.map((sub) => {
      const scores = child.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const pct = row.average <= 4 && row.average > 0 ? Math.round(row.average * 25) : row.average;
      return { subject: sub, pct, grade: gradeFor(pct, boundaries, system) };
    }).filter(Boolean).sort((a, b) => b.pct - a.pct);
  }, [child, boundaries, system]);

  const mean = subjects.length ? Math.round(subjects.reduce((s, r) => s + r.pct, 0) / subjects.length) : 0;

  if (subjects.length === 0) return <Empty icon={Award} text="No results published yet. They'll appear here once marks are entered." />;
  return (
    <>
      <div className="eom-mini-grid">
        <StatCard><div className="eom-l" style={{ fontSize: 12, color: 'var(--eom-muted)', fontWeight: 600 }}>Mean grade</div><div className="eom-big eom-num" style={{ fontSize: 26 }}>{gradeFor(mean, boundaries, system)}</div></StatCard>
        <StatCard><div className="eom-l" style={{ fontSize: 12, color: 'var(--eom-muted)', fontWeight: 600 }}>Mean score</div><div className="eom-big eom-num" style={{ fontSize: 26 }}>{mean}%</div></StatCard>
      </div>
      <SecHead title={`Subjects · ${child.name || ''}`} />
      <div className="eom-list-card">
        {subjects.map((s) => <SubjectRow key={s.subject} subject={s.subject} pct={s.pct} grade={s.grade} />)}
      </div>
    </>
  );
}

export function ParentAttendance({ store, user }) {
  const child = getChild(user, store);
  const { rows, loading } = useTable('studentAttendance');
  const mine = useMemo(
    () => (rows || []).filter((a) => a.student_id === child.id || a.adm === child.adm)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [rows, child.id, child.adm]
  );
  const total = mine.length;
  const present = mine.filter((a) => /present/i.test(a.status)).length;
  const absent = mine.filter((a) => /absent/i.test(a.status)).length;
  const late = mine.filter((a) => /late/i.test(a.status)).length;
  const rate = total ? Math.round((present / total) * 100) : 0;

  if (loading) return <Loading />;
  return (
    <>
      <StatCard>
        <div className="eom-cap">Attendance rate</div>
        <div className="eom-big eom-num">{total ? `${rate}%` : '—'}</div>
        <Prog value={rate} />
        <div className="eom-split">
          <div className="eom-cell"><div className="eom-l">Present</div><div className="eom-v eom-num" style={{ color: '#059669' }}>{present}</div></div>
          <div className="eom-cell"><div className="eom-l">Absent</div><div className="eom-v eom-num" style={{ color: '#DC2626' }}>{absent}</div></div>
          <div className="eom-cell"><div className="eom-l">Late</div><div className="eom-v eom-num" style={{ color: '#D97706' }}>{late}</div></div>
        </div>
      </StatCard>
      <SecHead title="Recent days" />
      {mine.length === 0 ? (
        <Empty icon={CalendarDays} text="No attendance records yet." />
      ) : (
        <DList items={mine.slice(0, 40).map((a) => ({
          k: String(a.date || '').slice(0, 10),
          v: a.status,
          color: /present/i.test(a.status) ? '#059669' : /absent/i.test(a.status) ? '#DC2626' : '#D97706',
        }))} />
      )}
    </>
  );
}

export function ParentClinic({ store, user }) {
  const child = getChild(user, store);
  const { rows, loading } = useTable('clinicVisits');
  const mine = useMemo(
    () => (rows || []).filter((v) => v.student_id === child.id || v.adm === child.adm)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [rows, child.id, child.adm]
  );
  if (loading) return <Loading />;
  if (mine.length === 0) return <Empty icon={Stethoscope} text="No clinic visits recorded. We'll notify you if your child visits the clinic." />;
  return (
    <>
      <SecHead title="Clinic visits" />
      <div className="eom-list-card">
        {mine.slice(0, 40).map((v) => (
          <div className="eom-li" key={v.id} style={{ cursor: 'default' }}>
            <span className="eom-lic" style={{ background: 'var(--eom-bad-100)', color: 'var(--eom-bad)' }}><Stethoscope /></span>
            <div className="eom-lt"><b>{v.complaint || 'Clinic visit'}</b><span>{v.treatment || v.outcome || '—'}</span></div>
            <span className="eom-rt">{String(v.date || '').slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ParentMessages({ store, user }) {
  const child = getChild(user, store);
  const { rows, loading } = useTable('messages');
  const [items, setItems] = useState([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    setItems((rows || []).filter((m) =>
      m.recipient_role === 'parent' &&
      ((m.recipient_id && user?.id && m.recipient_id === user.id) || m.student_id === child.id || m.student_id === child.adm)
    ).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }, [rows, child.id, child.adm, user?.id]);

  const send = async ({ to, subject, body }) => {
    const now = new Date().toISOString();
    await upsertRow('messages', {
      id: `msg_${Date.now()}`,
      sender_id: user?.id || 'parent', sender_name: user?.name || 'Parent', sender_role: 'parent',
      recipient_role: to, student_id: child.id, student_name: child.name,
      subject, body, status: 'Unread', created_at: now,
    });
    const audience = OFFICE_AUDIENCE[to];
    if (audience) {
      try {
        await upsertRow('notifications', {
          id: `pmsg_${Date.now()}`, title: `Parent message: ${subject}`,
          message: `From ${user?.name || 'a parent'} (re ${child.name || 'their child'}): ${body}`.slice(0, 240),
          body: `From ${user?.name || 'a parent'} regarding ${child.name || 'their child'}:\n\n${body}`,
          posted_by: user?.name || 'Parent', role: 'parent', audience, read: false, created_at: now,
        });
      } catch { /* message already saved */ }
    }
    setComposing(false);
  };

  if (loading) return <Loading />;
  return (
    <>
      {composing ? (
        <Composer
          title="New message"
          recipients={['Class Teacher', 'School Administration', 'Finance Office', 'Health Center', 'Principal']}
          onSend={send} onCancel={() => setComposing(false)}
        />
      ) : (
        <>
          <div className="eom-sec"><h5>Inbox</h5><a onClick={() => setComposing(true)}>New message</a></div>
          {items.length === 0 ? (
            <Empty icon={Inbox} text="No messages yet. Tap “New message” to contact the school." />
          ) : (
            <div className="eom-list-card">
              {items.slice(0, 40).map((m) => (
                <div className="eom-li" key={m.id} style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span className="eom-lic" style={{ background: 'var(--eom-info-100)', color: 'var(--eom-info)' }}><MessageSquare /></span>
                  <div className="eom-lt">
                    <b>{m.subject || 'Message'}</b>
                    <span className="eom-msg-body">{m.body || ''}</span>
                  </div>
                  <span className="eom-rt">{String(m.created_at || '').slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
          <button className="eom-fab" onClick={() => setComposing(true)} aria-label="New message"><PenLine /></button>
        </>
      )}
    </>
  );
}
