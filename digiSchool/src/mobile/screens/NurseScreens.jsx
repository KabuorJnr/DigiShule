import { useMemo, useState } from 'react';
import { Stethoscope, Search, Plus, X, Check } from 'lucide-react';
import { upsertRow } from '../../lib/api';
import { useTable, StatCard, Empty, SecHead, Loading } from './kit';

const OUTCOMES = ['Returned to class', 'Sent home', 'Referred to hospital'];
const OUTCOME_COLOR = { 'Returned to class': '#059669', 'Sent home': '#D97706', 'Referred to hospital': '#DC2626' };

// Log-a-visit form: search/pick a student, capture complaint/treatment/outcome,
// save to clinic_visits (same shape as the desktop Clinic screen). A random
// UUID id works whether the column is uuid or text.
function LogVisitForm({ store, user, onSaved, onCancel }) {
  const students = store.students || [];
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [complaint, setComplaint] = useState('');
  const [treatment, setTreatment] = useState('');
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return students.filter((x) => (x.name || '').toLowerCase().includes(s) || String(x.adm || '').toLowerCase().includes(s)).slice(0, 8);
  }, [students, q]);

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (!picked && !q.trim()) return setErr('Choose a student.');
    if (!complaint.trim()) return setErr('Enter the complaint / symptoms.');
    setBusy(true);
    const id = (globalThis.crypto?.randomUUID?.() || `c${Date.now()}${Math.random().toString(16).slice(2)}`);
    const visit = {
      id, date: new Date().toISOString().slice(0, 10),
      student: picked?.name || q.trim(),
      student_id: picked?.id || null,
      adm: picked?.adm || '-',
      complaint: complaint.trim(), treatment: treatment.trim(), outcome,
      created_at: new Date().toISOString(),
    };
    try {
      await upsertRow('clinicVisits', visit);
      store.notify?.(`Visit logged for ${visit.student}.`, 'success', 'Clinic');
      onSaved(visit);
    } catch (e2) {
      setErr(e2?.message || 'Could not log the visit.');
    } finally { setBusy(false); }
  };

  return (
    <form className="eom-stat-card" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: 15, color: 'var(--eom-ink)' }}>Log a clinic visit</b>
        <button type="button" className="eom-link" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>
      {err && <div className="eom-error">{err}</div>}

      <div className="eom-field"><label>Student</label>
        {picked ? (
          <div className="eom-input" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{picked.name} <span style={{ color: 'var(--eom-muted)', fontWeight: 500 }}>· {picked.adm || '—'} · {picked.class || ''}</span></span>
            <button type="button" className="eom-link" onClick={() => { setPicked(null); setQ(''); }}>Change</button>
          </div>
        ) : (
          <>
            <div className="eom-input"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${students.length} students by name or adm…`} autoFocus /></div>
            {matches.length > 0 && (
              <div className="eom-list-card" style={{ marginTop: 8 }}>
                {matches.map((s) => (
                  <button type="button" className="eom-li" key={s.id} onClick={() => { setPicked(s); }}>
                    <span className="eom-lic" style={{ background: 'var(--eom-blue-50)', color: 'var(--eom-blue)' }}><Stethoscope /></span>
                    <div className="eom-lt"><b>{s.name}</b><span>{s.adm || '—'} · {s.class || 'Unassigned'}</span></div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {picked?.medicalInfo && (
        <div className="eom-error" style={{ background: 'var(--eom-warn-100)', color: '#7f1d1d' }}>⚠ {picked.medicalInfo}</div>
      )}

      <div className="eom-field"><label>Complaint / symptoms</label>
        <div className="eom-input"><input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Headache" /></div></div>
      <div className="eom-field"><label>Treatment / action taken</label>
        <div className="eom-input"><input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Paracetamol, rested" /></div></div>
      <div className="eom-field"><label>Outcome</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {OUTCOMES.map((o) => (
            <button type="button" key={o} onClick={() => setOutcome(o)}
              className={`eom-chip${outcome === o ? ' eom-on' : ''}`}>{o}</button>
          ))}
        </div>
      </div>

      <button className="eom-btn" type="submit" disabled={busy}>{busy ? <span className="eom-spin" /> : <><Check size={18} /> Save visit</>}</button>
    </form>
  );
}

// The nurse's Clinic screen: log a visit + review recent visits.
export function NurseClinic({ store, user, params }) {
  const { rows, loading } = useTable('clinicVisits');
  const [logging, setLogging] = useState(() => Boolean(params?.logging));
  const [added, setAdded] = useState([]);

  const visits = useMemo(() => {
    const all = [...added, ...(rows || [])];
    const seen = new Set();
    return all.filter((v) => (v.id && !seen.has(v.id) && seen.add(v.id)))
      .sort((a, b) => String(b.date || b.created_at).localeCompare(String(a.date || a.created_at)));
  }, [rows, added]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = visits.filter((v) => String(v.date).slice(0, 10) === today).length;

  if (loading) return <Loading />;
  return (
    <>
      <StatCard>
        <div className="eom-cap">Clinic visits</div>
        <div className="eom-split" style={{ marginTop: 4 }}>
          <div className="eom-cell"><div className="eom-l">Today</div><div className="eom-v eom-num">{todayCount}</div></div>
          <div className="eom-cell"><div className="eom-l">Total</div><div className="eom-v eom-num">{visits.length}</div></div>
        </div>
        {!logging && (
          <button className="eom-btn" style={{ marginTop: 14 }} onClick={() => setLogging(true)}><Plus size={18} /> Log a visit</button>
        )}
      </StatCard>

      {logging && (
        <LogVisitForm store={store} user={user}
          onCancel={() => setLogging(false)}
          onSaved={(v) => { setAdded((a) => [v, ...a]); setLogging(false); }} />
      )}

      <SecHead title="Recent visits" />
      {visits.length === 0 ? (
        <Empty icon={Stethoscope} text="No clinic visits logged yet. Tap “Log a visit” to record one." />
      ) : (
        <div className="eom-list-card">
          {visits.slice(0, 60).map((v) => (
            <div className="eom-li" key={v.id} style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="eom-lic" style={{ background: 'var(--eom-bad-100)', color: 'var(--eom-bad)' }}><Stethoscope /></span>
              <div className="eom-lt">
                <b>{v.student}{v.adm && v.adm !== '-' ? ` · ${v.adm}` : ''}</b>
                <span>{v.complaint}{v.treatment ? ` — ${v.treatment}` : ''}</span>
                <span style={{ color: OUTCOME_COLOR[v.outcome] || 'var(--eom-muted)', fontWeight: 700 }}>{v.outcome}</span>
              </div>
              <span className="eom-rt">{String(v.date || '').slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
