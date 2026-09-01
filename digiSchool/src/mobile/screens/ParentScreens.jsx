import { useMemo } from 'react';
import { Wallet, CalendarDays, Stethoscope, MessageSquare, Award, Inbox, CreditCard } from 'lucide-react';
import { computeRow, gradeFor, is844Class } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import { fmtKES, getChild, useTable, StatCard, Prog, DList, Empty, SecHead, SubjectRow, Loading } from './kit';

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
        <div className="eo-cap">Outstanding balance {outstanding > 0
          ? <span className="eo-badge eo-warn">Due</span>
          : <span className="eo-badge eo-up">Cleared</span>}</div>
        <div className="eo-big eo-num">{fmtKES(outstanding)} <small>/ {fmtKES(termFees)}</small></div>
        <Prog value={pct} />
        <div className="eo-split">
          <div className="eo-cell"><div className="eo-l">Paid</div><div className="eo-v eo-num">{fmtKES(paid)}</div></div>
          <div className="eo-cell"><div className="eo-l">Term fees</div><div className="eo-v eo-num">{fmtKES(termFees)}</div></div>
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
      <div className="eo-mini-grid">
        <StatCard><div className="eo-l" style={{ fontSize: 12, color: 'var(--eo-muted)', fontWeight: 600 }}>Mean grade</div><div className="eo-big eo-num" style={{ fontSize: 26 }}>{gradeFor(mean, boundaries, system)}</div></StatCard>
        <StatCard><div className="eo-l" style={{ fontSize: 12, color: 'var(--eo-muted)', fontWeight: 600 }}>Mean score</div><div className="eo-big eo-num" style={{ fontSize: 26 }}>{mean}%</div></StatCard>
      </div>
      <SecHead title={`Subjects · ${child.name || ''}`} />
      <div className="eo-list-card">
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
        <div className="eo-cap">Attendance rate</div>
        <div className="eo-big eo-num">{total ? `${rate}%` : '—'}</div>
        <Prog value={rate} />
        <div className="eo-split">
          <div className="eo-cell"><div className="eo-l">Present</div><div className="eo-v eo-num" style={{ color: '#059669' }}>{present}</div></div>
          <div className="eo-cell"><div className="eo-l">Absent</div><div className="eo-v eo-num" style={{ color: '#DC2626' }}>{absent}</div></div>
          <div className="eo-cell"><div className="eo-l">Late</div><div className="eo-v eo-num" style={{ color: '#D97706' }}>{late}</div></div>
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
      <div className="eo-list-card">
        {mine.slice(0, 40).map((v) => (
          <div className="eo-li" key={v.id} style={{ cursor: 'default' }}>
            <span className="eo-lic" style={{ background: 'var(--eo-bad-100)', color: 'var(--eo-bad)' }}><Stethoscope /></span>
            <div className="eo-lt"><b>{v.complaint || 'Clinic visit'}</b><span>{v.treatment || v.outcome || '—'}</span></div>
            <span className="eo-rt">{String(v.date || '').slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ParentMessages({ store, user }) {
  const child = getChild(user, store);
  const { rows, loading } = useTable('messages');
  const mine = useMemo(() => (rows || []).filter((m) =>
    m.recipient_role === 'parent' &&
    ((m.recipient_id && user?.id && m.recipient_id === user.id) || m.student_id === child.id || m.student_id === child.adm)
  ).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), [rows, child.id, child.adm, user?.id]);

  if (loading) return <Loading />;
  if (mine.length === 0) return <Empty icon={Inbox} text="No messages from the school or clinic yet." />;
  return (
    <>
      <SecHead title="Inbox" />
      <div className="eo-list-card">
        {mine.slice(0, 40).map((m) => (
          <div className="eo-li" key={m.id} style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <span className="eo-lic" style={{ background: 'var(--eo-info-100)', color: 'var(--eo-info)' }}><MessageSquare /></span>
            <div className="eo-lt">
              <b>{m.subject || 'Message'}</b>
              <span style={{ whiteSpace: 'normal' }}>{(m.body || '').slice(0, 140)}</span>
            </div>
            <span className="eo-rt">{String(m.created_at || '').slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
