import { useState, useEffect } from 'react';
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
  return <div className="eo-stat-card" style={style}>{children}</div>;
}

export function Prog({ value }) {
  return <div className="eo-prog"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function DList({ items }) {
  return (
    <div className="eo-list-card">
      {items.map((it, i) => (
        <div className="eo-drow" key={i}>
          <span className="eo-k">{it.k}</span>
          <span className="eo-vv" style={it.color ? { color: it.color } : undefined}>{it.v}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, text }) {
  return (
    <div className="eo-empty">
      {Icon && <Icon />}
      <p>{text}</p>
    </div>
  );
}

export function SecHead({ title, action, onAction }) {
  return (
    <div className="eo-sec">
      <h5>{title}</h5>
      {action && <a onClick={onAction}>{action}</a>}
    </div>
  );
}

const GRADE_COLOR = (pct) => (pct >= 70 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626');
export function SubjectRow({ subject, pct, grade }) {
  return (
    <div className="eo-subj">
      <span className="eo-sn">{subject}</span>
      <div className="eo-sp"><Prog value={pct} /></div>
      <span className="eo-sg eo-num" style={{ color: GRADE_COLOR(pct) }}>{grade}</span>
    </div>
  );
}

export function Loading() {
  return <div className="eo-empty"><p>Loading…</p></div>;
}
