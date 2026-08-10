import { useEffect, useState, useCallback } from 'react';
import { BarChart3, RefreshCw, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { fetchSchoolDaily, fetchLatestBenchmarks, refreshWarehouse } from '../lib/warehouseClient';

// Benchmark card — school-facing UI for the data warehouse.
//
// Shows the caller's school's latest numbers next to anonymised peer medians
// / top-quartile from ALL reporting schools. This is the seed of the
// benchmarking product that eventually charges governments, donors and
// principals for peer analytics. It's intentionally cheap to render (two
// warehouse queries, no live joins) and fails soft when the warehouse
// migration isn't deployed yet.
//
// Metrics shown:
//   • Students on roll
//   • Staff on roll
//   • Attendance rate (7-day average)
//   • Fees collected (7-day sum)
//
// Missing warehouse data → clean "not yet available" state with a Refresh
// button (calls the warehouse-refresh edge function, admin-only server-side).
export default function BenchmarkCard({ user }) {
  const canRefresh = ['principal', 'deputy_admin', 'deputy_academic', 'dos'].includes(user?.role);
  const [state, setState] = useState({ loading: true, daily: [], bench: null, error: null });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const [daily, bench] = await Promise.all([fetchSchoolDaily(14), fetchLatestBenchmarks()]);
    setState({
      loading: false,
      daily: daily.rows,
      bench: bench.row,
      error: daily.error || bench.error || null,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const res = await refreshWarehouse(30);
      if (!res.ok) setState((s) => ({ ...s, error: res.error || 'Refresh failed' }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  // ── Derive display metrics from the raw fact rows ──
  const summary = summarise(state.daily);
  const bench = state.bench;
  const hasAnyData = state.daily.length > 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={pillStyle}><BarChart3 size={14} strokeWidth={1.75} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Your school vs. peers</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Anonymised medians across all reporting schools · last 7 days
            </div>
          </div>
        </div>
        {canRefresh && (
          <button onClick={handleRefresh} disabled={busy || state.loading}
            title="Recompute warehouse metrics for your school"
            style={ghostBtnStyle}>
            <RefreshCw size={13} strokeWidth={1.75} className={busy ? 'spin' : ''} /> Refresh
          </button>
        )}
      </div>

      {state.loading && !hasAnyData && (
        <div style={{ color: '#6b7280', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={14} strokeWidth={1.75} className="spin" /> Loading warehouse…
        </div>
      )}

      {!state.loading && !hasAnyData && (
        <EmptyState
          title="No warehouse data for your school yet"
          body={
            canRefresh
              ? 'Click Refresh to compute the first snapshot from your live data. This runs on the server and takes a few seconds.'
              : 'Ask an administrator to refresh the warehouse. It computes daily rollups of attendance, fees, and enrolment.'
          }
        />
      )}

      {hasAnyData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Metric
            label="Students on roll"
            value={fmtInt(summary.students)}
            peerValue={bench ? fmtInt(bench.median_students_per_school) : null}
            direction={compareInt(summary.students, bench?.median_students_per_school)}
          />
          <Metric
            label="Staff on roll"
            value={fmtInt(summary.staff)}
            peerValue={bench ? fmtInt(bench.median_staff_per_school) : null}
            direction={compareInt(summary.staff, bench?.median_staff_per_school)}
          />
          <Metric
            label="Attendance (7-day)"
            value={fmtPct(summary.attendanceRate)}
            peerValue={bench ? fmtPct(bench.median_attendance_rate_pct) : null}
            direction={compareNum(summary.attendanceRate, bench?.median_attendance_rate_pct)}
            top={bench ? `top 25% ≥ ${fmtPct(bench.p75_attendance_rate_pct)}` : null}
          />
          <Metric
            label="Fees collected (7-day)"
            value={fmtKES(summary.feesCollected)}
            peerValue={bench ? fmtKES(bench.median_fees_collected_kes) : null}
            direction={compareNum(summary.feesCollected, bench?.median_fees_collected_kes)}
            top={bench ? `top 25% ≥ ${fmtKES(bench.p75_fees_collected_kes)}` : null}
          />
        </div>
      )}

      {hasAnyData && bench && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6', fontSize: 11, color: '#9ca3af' }}>
          Peer medians from {bench.schools_reporting} reporting school{bench.schools_reporting === 1 ? '' : 's'} on {bench.date}.
          Peers are anonymised — no school names or IDs are exposed.
        </div>
      )}
      {state.error && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#b91c1c' }}>{state.error}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function summarise(daily) {
  if (!daily.length) return { students: null, staff: null, attendanceRate: null, feesCollected: null };
  // Most-recent day for point-in-time values.
  const latest = daily[daily.length - 1];
  // 7-day roll-up for flow metrics.
  const last7 = daily.slice(-7);
  const feesCollected = last7.reduce((s, r) => s + Number(r.fees_collected_kes || 0), 0);
  const rates = last7.map((r) => Number(r.attendance_rate_pct)).filter((v) => Number.isFinite(v));
  const attendanceRate = rates.length ? +(rates.reduce((s, v) => s + v, 0) / rates.length).toFixed(1) : null;
  return {
    students: latest.students_active ?? null,
    staff: latest.staff_active ?? null,
    attendanceRate,
    feesCollected,
  };
}

function fmtInt(v) { return v == null ? '—' : Number(v).toLocaleString(); }
function fmtPct(v) { return v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(1)}%`; }
function fmtKES(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(0)}k`;
  return `KES ${n.toLocaleString()}`;
}
function compareNum(mine, peer) {
  if (mine == null || peer == null) return 'flat';
  const m = Number(mine), p = Number(peer);
  if (!Number.isFinite(m) || !Number.isFinite(p) || p === 0) return 'flat';
  const diff = (m - p) / p;
  if (diff > 0.05) return 'up';
  if (diff < -0.05) return 'down';
  return 'flat';
}
function compareInt(mine, peer) { return compareNum(mine, peer); }

function Metric({ label, value, peerValue, direction, top }) {
  const dirIcon =
    direction === 'up' ? <ArrowUp size={12} strokeWidth={2} color="#15803d" /> :
    direction === 'down' ? <ArrowDown size={12} strokeWidth={2} color="#b45309" /> :
    <Minus size={12} strokeWidth={2} color="#9ca3af" />;
  const dirColor = direction === 'up' ? '#15803d' : direction === 'down' ? '#b45309' : '#6b7280';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', background: '#ffffff' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 0.2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1 }}>{value}</div>
      {peerValue !== null && (
        <div style={{ marginTop: 8, fontSize: 11, color: dirColor, display: 'flex', alignItems: 'center', gap: 4 }}>
          {dirIcon}
          <span>Peers: {peerValue}</span>
        </div>
      )}
      {top && <div style={{ marginTop: 4, fontSize: 10, color: '#9ca3af' }}>{top}</div>}
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 18,
};
const pillStyle = {
  width: 32, height: 32, borderRadius: 8, background: '#111827', color: '#ffffff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const ghostBtnStyle = {
  height: 30, padding: '0 10px', borderRadius: 6, background: '#ffffff', border: '1px solid #d1d5db',
  fontSize: 12, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
};
