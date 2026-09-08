import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { fetchTable } from '../../lib/api';

export const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

// Resolve the parent's active child (or a student user's own record).
export function getChild(user, store) {
  const students = store?.students || [];
  if (user?.linked_students && user.linked_students[0]) {
    const c = user.linked_students[0];
    // Prefer the full student record (has scores) if we can match it.
    return students.find((s) => s.id === c.id || s.adm === c.adm) || c;
  }
  const sid = user?.student_id || user?.studentId;
  if (sid) return students.find((s) => s.id === sid) || {};
  return {};
}

// Fetch a Supabase table once, with loading state. Defensive: never throws.
export function useTable(key, deps = []) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTable(key)
      .then((r) => { if (active) { setRows(r || []); setLoading(false); } })
      .catch(() => { if (active) { setRows([]); setLoading(false); } });
    return () => { active = false; };
  }, deps);
  return { rows, loading };
}

export function StatCard({ children, style }) {
  return <div className="eom-stat-card" style={style}>{children}</div>;
}

export function Prog({ value }) {
  return <div className="eom-prog"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function DList({ items }) {
  return (
    <div className="eom-list-card">
      {items.map((it, i) => (
        <div className="eom-drow" key={i}>
          <span className="eom-k">{it.k}</span>
          <span className="eom-vv" style={it.color ? { color: it.color } : undefined}>{it.v}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, text }) {
  return (
    <div className="eom-empty">
      {Icon && <Icon />}
      <p>{text}</p>
    </div>
  );
}

export function SecHead({ title, action, onAction }) {
  return (
    <div className="eom-sec">
      <h5>{title}</h5>
      {action && <a onClick={onAction}>{action}</a>}
    </div>
  );
}

const GRADE_COLOR = (pct) => (pct >= 70 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626');
export function SubjectRow({ subject, pct, grade }) {
  return (
    <div className="eom-subj">
      <span className="eom-sn">{subject}</span>
      <div className="eom-sp"><Prog value={pct} /></div>
      <span className="eom-sg eom-num" style={{ color: GRADE_COLOR(pct) }}>{grade}</span>
    </div>
  );
}

export function Loading() {
  return <div className="eom-empty"><p>Loading…</p></div>;
}

// Reusable compose form. `recipients` (optional) renders a "To" dropdown;
// omit it (e.g. a teacher replying to one parent) to hide the selector.
export function Composer({ title = 'New message', recipients, replyTo, onSend, onCancel }) {
  const [to, setTo] = useState(recipients ? recipients[0] : '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo}` : '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!subject.trim() || !body.trim()) { setErr('Add a subject and a message.'); return; }
    setErr(''); setBusy(true);
    try {
      await onSend({ to, subject: subject.trim(), body: body.trim() });
    } catch (e) {
      setBusy(false); setErr(e?.message || 'Could not send. Please try again.');
    }
  };

  return (
    <div className="eom-stat-card eom-composer">
      <div className="eom-composer-title">{title}</div>
      {err && <div className="eom-error" style={{ marginBottom: 10 }}>{err}</div>}
      {recipients && (
        <label className="eom-fieldlabel">To
          <select className="eom-select" value={to} onChange={(e) => setTo(e.target.value)}>
            {recipients.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      )}
      <label className="eom-fieldlabel">Subject
        <input className="eom-tinput" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      </label>
      <label className="eom-fieldlabel">Message
        <textarea className="eom-textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
      </label>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="eom-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="eom-btn-solid" onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : <>Send <Send size={16} /></>}
        </button>
      </div>
    </div>
  );
}
