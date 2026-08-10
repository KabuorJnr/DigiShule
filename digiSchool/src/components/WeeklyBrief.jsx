import { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { requestAI } from '../lib/aiClient';

// Weekly briefing card for the Principal / DoS / Deputy dashboards.
//
// Takes already-loaded dashboard data and derives a small set of last-week
// metrics on the client. Sends those metrics (numbers only, no PII) to the
// `ai-brief` edge function and renders the three items it returns.
//
// Fail-soft: if the AI isn't configured, the network fails, or the response
// is unparseable, this shows a clean "not available" state instead of a
// broken card.
export default function WeeklyBrief({ store, user }) {
  const schoolName = store?.settings?.name || 'the school';

  // ── Derive last-week metrics from the data we already have loaded ──
  const metrics = useMemo(() => deriveMetrics(store), [store]);
  const canRequest = metrics && (metrics.students_total || metrics.staff_total);

  const [state, setState] = useState({ loading: false, data: null, error: null });

  const fetchBrief = useCallback(async (opts = {}) => {
    if (!canRequest) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await requestAI('principal_weekly', metrics, { schoolName, force: opts.force });
    setState({ loading: false, data: res, error: res.error || null });
  }, [canRequest, metrics, schoolName]);

  useEffect(() => { fetchBrief(); /* runs once per metric change */ }, [fetchBrief]);

  const items = state.data?.parsed?.items || [];
  const cached = state.data?.cached;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={pillStyle}><Sparkles size={14} strokeWidth={1.75} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>This week&#39;s brief</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Three things worth your attention · {user?.role === 'dos' ? 'Director of Studies' : 'Principal'}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchBrief({ force: true })}
          disabled={state.loading || !canRequest}
          title="Refresh"
          style={ghostBtnStyle}
        >
          <RefreshCw size={13} strokeWidth={1.75} className={state.loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* States */}
      {!canRequest && (
        <EmptyState
          icon={<AlertCircle size={16} color="#9ca3af" strokeWidth={1.75} />}
          title="Not enough data yet"
          body="Once students and staff are enrolled, this brief will surface the week's most important changes."
        />
      )}

      {canRequest && state.loading && !items.length && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#6b7280', fontSize: 13 }}>
          <RefreshCw size={14} strokeWidth={1.75} className="spin" />
          Analysing last week's activity…
        </div>
      )}

      {canRequest && state.error && !items.length && (
        <EmptyState
          icon={<AlertCircle size={16} color="#b91c1c" strokeWidth={1.75} />}
          title="AI service is not available right now"
          body={
            /not_configured/i.test(state.error)
              ? 'Open Settings → AI Assistant to paste your Anthropic API key. Same secure model as M-Pesa — the key never touches the browser.'
              : 'We\'ll try again on the next refresh.'
          }
        />
      )}

      {items.length > 0 && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.slice(0, 3).map((it, i) => (
            <li key={i} style={itemStyle}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={numStyle}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {it.title || 'Item'}
                  </div>
                  {it.why_it_matters && (
                    <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.55 }}>{it.why_it_matters}</div>
                  )}
                  {it.suggested_action && (
                    <div style={{ fontSize: 12, color: '#4b5563', marginTop: 6, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, borderLeft: '2px solid #9ca3af' }}>
                      <span style={{ fontWeight: 500 }}>Try:</span> {it.suggested_action}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
          <span>Generated from this school's own data. Numbers only — never names.</span>
          {cached && <span>Cached</span>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function deriveMetrics(store) {
  const students = store?.students || [];
  const teachers = store?.teachers || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Attendance: count records in last 7 days if present.
  const att = Array.isArray(store?.attendanceRecords) ? store.attendanceRecords : [];
  const recentAtt = att.filter((a) => a?.date && new Date(a.date) >= weekAgo);
  const attPresent = recentAtt.filter((a) => String(a.status).toLowerCase() === 'present').length;
  const attTotal = recentAtt.length;
  const attRate = attTotal ? Math.round((attPresent / attTotal) * 100) : null;

  // Fees: defaulters + collected-this-week (best-effort using loaded state).
  const payments = Array.isArray(store?.payments) ? store.payments : [];
  const paymentsThisWeek = payments.filter((p) => p?.date && new Date(p.date) >= weekAgo);
  const collectedThisWeek = paymentsThisWeek.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const defaulters = Array.isArray(store?.defaulters) ? store.defaulters.length : null;

  // Grading: average of published means, if we can find them.
  const meanScores = students.map((s) => Number(s?.overall_mean || s?.mean || 0)).filter(Boolean);
  const overallMean = meanScores.length ? +(meanScores.reduce((a, b) => a + b, 0) / meanScores.length).toFixed(1) : null;

  // Exam schedule pressure: how many exams in the coming 14 days.
  const exams = Array.isArray(store?.examSchedules) ? store.examSchedules : [];
  const upcomingExams = exams.filter((e) => {
    const d = e?.start_date || e?.date;
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= now.getTime() && t <= now.getTime() + 14 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    students_total: students.length,
    staff_total: teachers.length,
    attendance_records_last_7d: attTotal,
    attendance_rate_last_7d_pct: attRate,
    fees_collected_last_7d_kes: collectedThisWeek || null,
    defaulters_count: defaulters,
    overall_mean_score: overallMean,
    upcoming_exams_next_14d: upcomingExams,
    unread_notifications: Array.isArray(store?.notifications)
      ? store.notifications.filter((n) => !n.read).length
      : null,
    generated_at: now.toISOString().slice(0, 10),
  };
}

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '4px 0' }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 18,
};
const pillStyle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: '#111827',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const ghostBtnStyle = {
  height: 30,
  padding: '0 10px',
  borderRadius: 6,
  background: '#ffffff',
  border: '1px solid #d1d5db',
  fontSize: 12,
  color: '#374151',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};
const itemStyle = {
  padding: '10px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#ffffff',
};
const numStyle = {
  width: 22,
  height: 22,
  borderRadius: 6,
  background: '#f3f4f6',
  color: '#111827',
  fontSize: 12,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
