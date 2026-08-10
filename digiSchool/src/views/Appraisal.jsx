import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { fetchTable, upsertRow } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Performance Appraisal & Development (TPAD)
//
// Structure follows the Teachers Service Commission (Kenya) TPAD tool:
// seven teaching standards, each with several elements a teacher is rated on.
// Each element is scored 1–4 by the appraiser (Deputy Principal / Principal),
// with an optional evidence link. The cycle runs per term with a mid-term
// self-review and an end-of-term appraiser rating.
//
// We persist to a Supabase `appraisals` table; if it doesn't exist yet the
// module falls back to localStorage so schools can start using it while the
// table is provisioned.
// ─────────────────────────────────────────────────────────────────────────────

const RATING_LABELS = {
  1: 'Unsatisfactory',
  2: 'Approaching Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
};

const TSC_STANDARDS = [
  {
    id: 'S1',
    title: 'Professional Knowledge & Application',
    elements: [
      { id: 'S1E1', text: 'Demonstrates mastery of subject content and pedagogy' },
      { id: 'S1E2', text: 'Prepares professional documents (schemes, lesson plans, records of work)' },
      { id: 'S1E3', text: 'Uses appropriate teaching-learning resources' },
    ],
  },
  {
    id: 'S2',
    title: 'Teaching, Learning & Assessment',
    elements: [
      { id: 'S2E1', text: 'Delivers lessons effectively, engaging all learners' },
      { id: 'S2E2', text: 'Uses varied assessment methods to check learning' },
      { id: 'S2E3', text: 'Provides timely feedback and remedial support' },
    ],
  },
  {
    id: 'S3',
    title: 'Professional Ethics, Values & Conduct',
    elements: [
      { id: 'S3E1', text: 'Adheres to the TSC Code of Regulations and Code of Conduct' },
      { id: 'S3E2', text: 'Punctuality, attendance and professional grooming' },
      { id: 'S3E3', text: 'Integrity in duties, records and dealings with learners' },
    ],
  },
  {
    id: 'S4',
    title: 'Learner Protection, Safety, Discipline & Teacher Conduct',
    elements: [
      { id: 'S4E1', text: 'Maintains a safe and orderly learning environment' },
      { id: 'S4E2', text: 'Handles learner discipline in line with policy (no corporal punishment)' },
      { id: 'S4E3', text: 'Identifies and reports child protection concerns' },
    ],
  },
  {
    id: 'S5',
    title: 'Promotion of Co-curricular Activities',
    elements: [
      { id: 'S5E1', text: 'Actively participates in a co-curricular activity' },
      { id: 'S5E2', text: 'Mentors learners in life-skills and talent development' },
    ],
  },
  {
    id: 'S6',
    title: 'Professional Development',
    elements: [
      { id: 'S6E1', text: 'Undertakes TPD / in-service training modules' },
      { id: 'S6E2', text: 'Applies learnings from professional development in practice' },
    ],
  },
  {
    id: 'S7',
    title: 'Collaboration with Parents, Guardians & the Wider Community',
    elements: [
      { id: 'S7E1', text: 'Communicates learner progress to parents/guardians' },
      { id: 'S7E2', text: 'Participates in school-community engagement events' },
    ],
  },
];

const ALL_ELEMENTS = TSC_STANDARDS.flatMap(s => s.elements);
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

// ── Persistence layer ─────────────────────────────────────────────────────
const LS_KEY = (schoolId) => `eduone_appraisals_${schoolId || 'default'}`;

async function loadAppraisals(schoolId) {
  try {
    const rows = await fetchTable('appraisals');
    if (Array.isArray(rows)) return rows;
  } catch { /* table might not exist yet */ }
  try {
    const raw = localStorage.getItem(LS_KEY(schoolId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveAppraisal(schoolId, appraisal) {
  try {
    await upsertRow('appraisals', appraisal);
    return;
  } catch { /* fall back below */ }
  try {
    const raw = localStorage.getItem(LS_KEY(schoolId));
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.id === appraisal.id);
    if (idx >= 0) list[idx] = appraisal; else list.push(appraisal);
    localStorage.setItem(LS_KEY(schoolId), JSON.stringify(list));
  } catch { /* ignore */ }
}

function newAppraisal({ teacher, term, year, appraiserId, appraiserName, schoolId }) {
  const ratings = {};
  ALL_ELEMENTS.forEach(e => { ratings[e.id] = { score: 0, evidence: '', appraiser_note: '' }; });
  return {
    id: (crypto.randomUUID ? crypto.randomUUID() : `apr_${Date.now()}_${teacher.id}`),
    teacher_id: teacher.id,
    teacher_name: teacher.name,
    term, year,
    appraiser_id: appraiserId,
    appraiser_name: appraiserName,
    school_id: schoolId,
    status: 'draft',                  // draft → mid_review → end_review → signed
    goals: '',
    self_review: '',                  // teacher's mid-term self assessment
    appraiser_comment: '',            // deputy's end-of-cycle overall comment
    teacher_ack: false,               // teacher signature/ack
    ratings,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function overallScore(appraisal) {
  if (!appraisal) return 0;
  const scores = Object.values(appraisal.ratings || {}).map(r => Number(r.score) || 0).filter(Boolean);
  if (!scores.length) return 0;
  return (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2);
}

function overallLabel(mean) {
  const n = Number(mean);
  if (!n) return '—';
  if (n >= 3.5) return RATING_LABELS[4];
  if (n >= 2.5) return RATING_LABELS[3];
  if (n >= 1.5) return RATING_LABELS[2];
  return RATING_LABELS[1];
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Appraisal({ store, user }) {
  const teachers = store.teachers || [];
  const schoolId = store.schoolId;
  const notify = store.notify || (() => {});
  const canAppraise = ['principal', 'deputy_admin', 'deputy_academic'].includes(user?.role);

  const year = String(new Date().getFullYear());
  const [term, setTerm] = useState('Term 1');
  const [appraisals, setAppraisals] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(teachers[0]?.id || '');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await loadAppraisals(schoolId);
    setAppraisals(rows);
  }, [schoolId]);

  useEffect(() => { refresh(); }, [refresh]);

  const forCycle = useMemo(() => appraisals.filter(a => a.term === term && String(a.year) === year), [appraisals, term, year]);
  const cycleByTeacher = useMemo(() => {
    const m = {};
    forCycle.forEach(a => { m[a.teacher_id] = a; });
    return m;
  }, [forCycle]);

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const selectedAppraisal = selectedTeacher ? cycleByTeacher[selectedTeacher.id] : null;

  async function startCycleFor(teacher) {
    if (!canAppraise) return;
    const rec = newAppraisal({ teacher, term, year, appraiserId: user?.id, appraiserName: user?.name, schoolId });
    await saveAppraisal(schoolId, rec);
    setAppraisals(prev => [...prev, rec]);
    setSelectedTeacherId(teacher.id);
    notify(`Started ${term} ${year} appraisal for ${teacher.name}`, 'success', 'Appraisal');
  }

  async function updateAppraisal(patch) {
    if (!selectedAppraisal) return;
    const next = { ...selectedAppraisal, ...patch, updated_at: new Date().toISOString() };
    setAppraisals(prev => prev.map(a => a.id === next.id ? next : a));
    setBusy(true);
    try { await saveAppraisal(schoolId, next); } finally { setBusy(false); }
  }

  function updateRating(elementId, patch) {
    if (!selectedAppraisal) return;
    const nextRatings = { ...selectedAppraisal.ratings, [elementId]: { ...selectedAppraisal.ratings[elementId], ...patch } };
    updateAppraisal({ ratings: nextRatings });
  }

  // Cycle-summary stats for the header strip.
  const started = forCycle.length;
  const midReviewed = forCycle.filter(a => a.self_review?.trim()).length;
  const rated = forCycle.filter(a => Object.values(a.ratings || {}).some(r => Number(r.score))).length;
  const signed = forCycle.filter(a => a.teacher_ack).length;

  return (
    <div>
      <PageHeader
        title="Teacher Appraisal (TPAD)"
        subtitle="Teacher Performance Appraisal & Development — 7 standards · 22 elements"
        actions={
          <>
            <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} style={{ height: 34 }}>
              {TERMS.map(t => <option key={t}>{t}</option>)}
            </select>
          </>
        }
      />

      {/* ── Cycle summary strip ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { k: 'Started', v: started },
          { k: 'Mid-term self review', v: midReviewed },
          { k: 'Appraiser rated', v: rated },
          { k: 'Signed & closed', v: signed },
        ].map(x => (
          <div key={x.k} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{x.k}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginTop: 4 }}>{x.v}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}> / {teachers.length}</span></div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 280px) 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Teacher list ──────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Teachers ({teachers.length})</div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {teachers.length === 0 && <div style={{ padding: 14, color: '#6b7280', fontSize: 13 }}>No teachers on staff yet.</div>}
            {teachers.map(t => {
              const rec = cycleByTeacher[t.id];
              const mean = overallScore(rec);
              const isActive = selectedTeacherId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeacherId(t.id)}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    padding: '10px 14px', background: isActive ? '#f3f4f6' : '#fff',
                    borderLeft: isActive ? '3px solid #111827' : '3px solid transparent',
                    borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {rec ? (rec.teacher_ack ? 'Signed' : rec.appraiser_comment ? 'Rated' : rec.self_review ? 'Self-reviewed' : 'Draft') : 'Not started'}
                    </div>
                  </div>
                  {rec && <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', background: '#f3f4f6', padding: '2px 8px', borderRadius: 12 }}>{mean}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Appraisal editor ──────────────────────────────────── */}
        <div>
          {!selectedTeacher && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, color: '#6b7280', fontSize: 14 }}>
              Choose a teacher from the list to open their appraisal.
            </div>
          )}

          {selectedTeacher && !selectedAppraisal && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{selectedTeacher.name}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>No appraisal cycle has been started for {term} {year}.</div>
              {canAppraise ? (
                <button onClick={() => startCycleFor(selectedTeacher)}
                  style={{ height: 36, padding: '0 14px', borderRadius: 6, background: '#111827', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="plus" size={14} /> Start {term} appraisal
                </button>
              ) : (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Only the Deputy Principal / Principal can start an appraisal cycle.</div>
              )}
            </div>
          )}

          {selectedAppraisal && (
            <AppraisalEditor
              appraisal={selectedAppraisal}
              teacher={selectedTeacher}
              canAppraise={canAppraise}
              isAppraisee={user?.id === selectedTeacher.id}
              busy={busy}
              onChange={updateAppraisal}
              onRating={updateRating}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AppraisalEditor({ appraisal, teacher, canAppraise, isAppraisee, busy, onChange, onRating }) {
  const mean = overallScore(appraisal);
  const label = overallLabel(mean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{teacher.name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {appraisal.term} {appraisal.year} · Appraiser: {appraisal.appraiser_name || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Overall</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#111827' }}>{mean}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        </div>
      </div>

      {/* Goals + self-review */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionBox title="Term goals" busy={busy}>
          <textarea
            className="input"
            rows={4}
            value={appraisal.goals || ''}
            disabled={!canAppraise && !isAppraisee}
            onChange={(e) => onChange({ goals: e.target.value })}
            placeholder="What should this teacher achieve this term?"
          />
        </SectionBox>
        <SectionBox title="Mid-term self review (teacher)" busy={busy}>
          <textarea
            className="input"
            rows={4}
            value={appraisal.self_review || ''}
            disabled={!isAppraisee && !canAppraise}
            onChange={(e) => onChange({ self_review: e.target.value })}
            placeholder="How is progress against these goals so far?"
          />
        </SectionBox>
      </div>

      {/* Rubric */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Standards &amp; ratings</div>
        {TSC_STANDARDS.map((std, i) => (
          <div key={std.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
            <div style={{ padding: '10px 14px', background: '#fafafa', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {std.id}. {std.title}
            </div>
            {std.elements.map((el) => {
              const r = appraisal.ratings[el.id] || { score: 0, evidence: '', appraiser_note: '' };
              return (
                <div key={el.id} style={{ padding: '12px 14px', borderTop: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 14, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#111827' }}>{el.text}</div>
                    <input
                      className="input"
                      placeholder="Evidence link or reference (optional)"
                      value={r.evidence}
                      disabled={!canAppraise && !isAppraisee}
                      onChange={(e) => onRating(el.id, { evidence: e.target.value })}
                      style={{ fontSize: 12, height: 30, marginTop: 8 }}
                    />
                    {canAppraise && (
                      <input
                        className="input"
                        placeholder="Appraiser note (optional)"
                        value={r.appraiser_note}
                        onChange={(e) => onRating(el.id, { appraiser_note: e.target.value })}
                        style={{ fontSize: 12, height: 30, marginTop: 6 }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4].map(n => {
                      const active = Number(r.score) === n;
                      return (
                        <button
                          key={n}
                          onClick={() => canAppraise && onRating(el.id, { score: n })}
                          disabled={!canAppraise}
                          title={RATING_LABELS[n]}
                          style={{
                            width: 36, height: 34, borderRadius: 6, border: `1px solid ${active ? '#111827' : '#d1d5db'}`,
                            background: active ? '#111827' : '#fff', color: active ? '#fff' : '#374151',
                            fontWeight: 600, cursor: canAppraise ? 'pointer' : 'not-allowed', fontSize: 13,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Appraiser comment + sign-off */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionBox title="Appraiser overall comment" busy={busy}>
          <textarea
            className="input"
            rows={4}
            value={appraisal.appraiser_comment || ''}
            disabled={!canAppraise}
            onChange={(e) => onChange({ appraiser_comment: e.target.value })}
            placeholder="Overall assessment, strengths and areas to develop."
          />
        </SectionBox>
        <SectionBox title="Teacher acknowledgement" busy={busy}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#111827' }}>
            <input
              type="checkbox"
              checked={!!appraisal.teacher_ack}
              disabled={!isAppraisee}
              onChange={(e) => onChange({ teacher_ack: e.target.checked, status: e.target.checked ? 'signed' : appraisal.status })}
            />
            I have read this appraisal and acknowledge the ratings and comments.
          </label>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
            {isAppraisee ? 'Tick the box to sign — you may still request changes with your appraiser.' : 'Only the teacher can sign their own appraisal.'}
          </div>
        </SectionBox>
      </div>
    </div>
  );
}

function SectionBox({ title, children, busy }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
        {busy && <div style={{ fontSize: 11, color: '#9ca3af' }}>Saving…</div>}
      </div>
      {children}
    </div>
  );
}
