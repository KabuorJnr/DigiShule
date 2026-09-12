/**
 * sneat/ — EduOne dashboard component library, modelled on the Sneat admin
 * template.
 *
 * The organising idea: a dashboard is accountable to ONE metric. Every screen
 * opens with a <Spotlight> naming that metric, its target and progress toward
 * it, then supports it with <MetricCard> tiles and charts that explain the
 * number. Components here exist to make that shape cheap to build.
 *
 * Styling lives in src/styles/sneat.css and is scoped under `.sneat`, which
 * <SneatPage> applies — dropping these into a view cannot restyle the rest of
 * the app.
 *
 * Charts use recharts (already a project dependency).
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import '../../styles/sneat.css';

/* ── palette helpers ─────────────────────────────────────────────────────── */

/**
 * JS mirror of the CSS tokens in src/styles/sneat.css.
 *
 * Charts are rendered by recharts and by our own SVG, neither of which can
 * read CSS custom properties, so these MUST be kept in step with the `.sneat`
 * token block — otherwise cards go green while charts stay on the old palette.
 */
export const SNEAT = {
  primary: '#047857',
  primaryLight: '#059669',
  primaryDeep: '#064E3B',
  success: '#10B981',
  successDark: '#059669',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#0891B2',
  secondary: '#64748B',
  heading: '#32475C',
  body: '#697A8D',
  muted: '#A1ACB8',
  border: '#E7E7F1',
  track: '#E7EBEF',
};

/**
 * Ordered palette for multi-series charts — a green-led ramp that stays
 * distinguishable in sequence and keeps red reserved for genuinely bad values.
 */
export const SERIES_COLORS = [
  SNEAT.primary,      // dark green
  SNEAT.info,         // teal
  SNEAT.success,      // emerald
  SNEAT.warning,      // amber
  SNEAT.primaryDeep,  // deep green
  SNEAT.secondary,    // slate
  SNEAT.danger,       // red, last
];

const TONES = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];
const tone = (t) => (TONES.includes(t) ? t : 'primary');

/* ── page scaffold ───────────────────────────────────────────────────────── */

/**
 * Dashboard root. Applies the `.sneat` scope that every style here depends on,
 * so this must wrap any other component in this module.
 */
export function SneatPage({ title, subtitle, actions, children, theme, flush = false }) {
  return (
    <div className="sneat" data-sn-theme={theme || undefined}>
      {/* `flush` drops the page padding for dashboards rendered inside the
          portal's .content wrapper, which already pads 24px. */}
      <div className={`sn-page ${flush ? 'sn-page-flush' : ''}`}>
        {(title || actions) && (
          <header className="sn-page-head">
            <div>
              {title && <h1 className="sn-page-title">{title}</h1>}
              {subtitle && <p className="sn-page-sub">{subtitle}</p>}
            </div>
            {actions && <div className="sn-page-actions">{actions}</div>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

/** Responsive grid. `cols`: 4 | 3 | 2 | '8-4' | '4-8'. */
export function Grid({ cols = 4, children, style }) {
  return <div className={`sn-grid sn-grid-${cols}`} style={style}>{children}</div>;
}

/* ── card primitives ─────────────────────────────────────────────────────── */

export function Card({ children, className = '', hover = false, style }) {
  return (
    <section className={`sn-card ${hover ? 'sn-card-hover' : ''} ${className}`} style={style}>
      {children}
    </section>
  );
}

export function CardHead({ title, subtitle, action }) {
  return (
    <div className="sn-card-head">
      <div>
        {title && <h2 className="sn-card-title">{title}</h2>}
        {subtitle && <p className="sn-card-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, tight = false, flush = false, style }) {
  const cls = flush ? 'sn-card-flush' : tight ? 'sn-card-body-tight' : 'sn-card-body';
  return <div className={cls} style={style}>{children}</div>;
}

/* ── trend delta ─────────────────────────────────────────────────────────── */

/**
 * Signed change indicator. Pass `value` as a number (percent or absolute).
 * `invert` flips the colour logic for metrics where down is good — arrears,
 * absenteeism, open discipline cases.
 */
export function TrendBadge({ value, suffix = '%', invert = false, label }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const good = invert ? n < 0 : n > 0;
  const dir = n === 0 ? 'flat' : good ? 'up' : 'down';
  const arrow = n === 0 ? '→' : n > 0 ? '↑' : '↓';
  return (
    <span className={`sn-trend sn-trend-${dir}`}>
      {arrow} {Math.abs(n).toFixed(Math.abs(n) < 10 ? 1 : 0)}{suffix}
      {label && <span className="sn-muted" style={{ fontWeight: 400 }}> {label}</span>}
    </span>
  );
}

/* ── metric card ─────────────────────────────────────────────────────────── */

/** Scale the value down as it gets longer so "KES 12,480,000" still fits. */
function valueClass(value) {
  const len = String(value ?? '').length;
  if (len > 16) return 'sn-metric-value is-xlong';
  if (len > 11) return 'sn-metric-value is-long';
  return 'sn-metric-value';
}

/**
 * The workhorse tile: one supporting metric.
 *
 * label   — what is measured
 * value   — the number itself (pre-formatted)
 * icon    — a lucide-react icon element
 * tone    — colour of the icon tile
 * trend   — numeric delta; rendered as a TrendBadge
 * foot    — extra caption, or any node
 * progress— { value, max, tone } renders a bar beneath (for "against target")
 */
export function MetricCard({
  label, value, icon, tone: t = 'primary', trend, trendSuffix = '%',
  trendInvert = false, trendLabel, foot, progress, onClick,
}) {
  const clickable = typeof onClick === 'function';
  return (
    <Card
      hover={clickable}
      className="sn-metric"
      style={clickable ? { cursor: 'pointer' } : undefined}
    >
      <div
        className="sn-metric-top"
        onClick={onClick}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        <div style={{ minWidth: 0 }}>
          <p className="sn-metric-label">{label}</p>
          <p className={valueClass(value)}>{value}</p>
        </div>
        {icon && <span className={`sn-icon sn-icon-${tone(t)}`}>{icon}</span>}
      </div>

      {(trend !== undefined || foot) && (
        <div className="sn-metric-foot">
          {trend !== undefined && (
            <TrendBadge value={trend} suffix={trendSuffix} invert={trendInvert} label={trendLabel} />
          )}
          {foot && <span>{foot}</span>}
        </div>
      )}

      {progress && (
        <div style={{ marginTop: '0.75rem' }}>
          <ProgressMetric
            value={progress.value}
            max={progress.max}
            tone={progress.tone || t}
            showRow={false}
          />
        </div>
      )}
    </Card>
  );
}

/* ── spotlight ───────────────────────────────────────────────────────────── */

/**
 * The headline metric a dashboard is judged against.
 *
 * eyebrow  — the metric's name ("Fee collection rate")
 * value    — its current value, large
 * caption  — plain-language read of what it means
 * target   — { value, label } the number it should hit
 * progress — 0–100 completion toward target
 * stats    — [{ label, value }] two or three supporting figures
 */
export function Spotlight({ eyebrow, value, caption, progress, stats = [], target, icon, ring = true }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className="sn-spotlight">
      <div>
        <p className="sn-spotlight-eyebrow">{icon}{eyebrow}</p>
        <p className="sn-spotlight-value">{value}</p>
        {caption && <p className="sn-spotlight-caption">{caption}</p>}

        {/* The ring restates progress-to-target next to the headline number. */}
        {ring && target && (
          <div className="sn-ring" style={{ marginTop: '1.1rem' }}>
            <ProgressRing pct={pct} />
            <div>
              <p className="sn-ring-value">{Math.round(pct)}% of target</p>
              <p className="sn-ring-label">{target.label || 'Target'}: {target.value}</p>
            </div>
          </div>
        )}
      </div>

      <div className="sn-spotlight-side">
        {target && (
          <>
            <div className="sn-spotlight-stat">
              <span>{target.label || 'Target'}</span>
              <b>{target.value}</b>
            </div>
            <div className="sn-progress-track" aria-label={`${Math.round(pct)}% of target`}>
              <div className="sn-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {stats.map((s) => (
          <div className="sn-spotlight-stat" key={s.label}>
            <span>{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Circular progress indicator used by the spotlight. */
export function ProgressRing({ pct = 0, size = 62, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <svg className="sn-ring-svg" width={size} height={size} aria-hidden="true">
      <circle className="sn-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
      <circle
        className="sn-ring-bar"
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c - (c * p) / 100}
      />
    </svg>
  );
}

/**
 * A metric rendered directly from a descriptor produced by
 * lib/targets.js → computeTargetMetrics(). Keeps every "against target" tile
 * consistent without each dashboard re-deriving tone, percent and caption.
 */
export function TargetCard({ metric: m, label, icon, onClick }) {
  if (!m) return null;
  const value = m.unit === '%' ? `${m.current.toFixed(1)}%` : String(Math.round(m.current));
  const targetLabel = m.target > 0
    ? (m.lowerIsBetter ? `ceiling ${Math.round(m.target)}` : `target ${m.unit === '%' ? `${Math.round(m.target)}%` : Math.round(m.target)}`)
    : 'no target set';
  return (
    <MetricCard
      label={label || m.label}
      value={value}
      icon={icon}
      tone={m.status}
      onClick={onClick}
      foot={<>{m.caption ? `${m.caption} · ` : ''}{targetLabel}</>}
      progress={{ value: m.pct, max: 100, tone: m.status }}
    />
  );
}

/* ── progress ────────────────────────────────────────────────────────────── */

export function ProgressMetric({ label, value, max = 100, tone: t = 'primary', showRow = true, valueLabel }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
  const color = {
    primary: SNEAT.primary, success: SNEAT.success, warning: SNEAT.warning,
    danger: SNEAT.danger, info: SNEAT.info, secondary: SNEAT.secondary,
  }[tone(t)];
  return (
    <div>
      {showRow && (
        <div className="sn-progress-row">
          <span>{label}</span>
          <b>{valueLabel ?? `${Math.round(pct)}%`}</b>
        </div>
      )}
      <div className="sn-progress-track">
        <div className="sn-progress-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ── badge / empty ───────────────────────────────────────────────────────── */

export function SnBadge({ children, tone: t = 'secondary' }) {
  return <span className={`sn-badge sn-badge-${tone(t)}`}>{children}</span>;
}

export function SnEmpty({ icon, title = 'No data yet', message }) {
  return (
    <div className="sn-empty">
      {icon && <div className="sn-empty-icon">{icon}</div>}
      <h4>{title}</h4>
      {message && <p>{message}</p>}
    </div>
  );
}

export function SnButton({ children, variant = 'primary', onClick, type = 'button', ...rest }) {
  return (
    <button type={type} className={`sn-btn sn-btn-${variant}`} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/* ── tabs ────────────────────────────────────────────────────────────────── */

/**
 * Underlined tab bar.
 * items: [{ id, label, count }]  ·  value/onChange are controlled.
 */
export function Tabs({ items = [], value, onChange }) {
  return (
    <div className="sn-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`sn-tab ${value === t.id ? 'is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && t.count !== null && t.count !== 0 && (
            <span className="sn-tab-count">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── charts ──────────────────────────────────────────────────────────────── */

const axisProps = {
  tick: { fill: SNEAT.muted, fontSize: 12 },
  axisLine: false,
  tickLine: false,
};

const tooltipProps = {
  contentStyle: {
    borderRadius: 8,
    border: `1px solid ${SNEAT.border}`,
    boxShadow: '0 2px 6px 0 rgba(67,89,113,0.12)',
    fontSize: 13,
    color: SNEAT.heading,
  },
  cursor: { fill: 'rgba(105,108,255,0.06)' },
};

/**
 * Card wrapper for any chart. Keeps header treatment consistent and gives
 * recharts a fixed pixel height (ResponsiveContainer needs a bounded parent).
 */
export function ChartCard({ title, subtitle, action, height = 300, children, flush = false, raw = false }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} action={action} />
      <CardBody tight={!flush} flush={flush}>
        {/* `raw` skips ResponsiveContainer for charts that size themselves —
            SnDonut/SnGauge are plain SVG and would be mangled by it. */}
        {raw ? (
          <div
            className="sn-chart"
            style={{ minHeight: height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {children}
          </div>
        ) : (
          <div className="sn-chart" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Vertical bars. `series`: [{ key, name, color }]. */
export function SnBar({ data, xKey, series = [], stacked = false, height }) {
  return (
    <BarChart data={data} height={height} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="4 4" stroke={SNEAT.border} vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} />
      <YAxis {...axisProps} />
      <Tooltip {...tooltipProps} />
      {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: SNEAT.body }} />}
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.name || s.key}
          stackId={stacked ? 'a' : undefined}
          fill={s.color || SERIES_COLORS[i % SERIES_COLORS.length]}
          radius={stacked ? 0 : [6, 6, 0, 0]}
          maxBarSize={38}
        />
      ))}
    </BarChart>
  );
}

/** Trend line. */
export function SnLine({ data, xKey, series = [], height }) {
  return (
    <LineChart data={data} height={height} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="4 4" stroke={SNEAT.border} vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} />
      <YAxis {...axisProps} />
      <Tooltip {...tooltipProps} />
      {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: SNEAT.body }} />}
      {series.map((s, i) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name || s.key}
          stroke={s.color || SERIES_COLORS[i % SERIES_COLORS.length]}
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 0, fill: s.color || SERIES_COLORS[i % SERIES_COLORS.length] }}
          activeDot={{ r: 5 }}
        />
      ))}
    </LineChart>
  );
}

/** Filled trend — good for cumulative money over a term. */
export function SnArea({ data, xKey, series = [], height }) {
  return (
    <AreaChart data={data} height={height} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <defs>
        {series.map((s, i) => {
          const c = s.color || SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <linearGradient key={s.key} id={`sn-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c} stopOpacity={0.02} />
            </linearGradient>
          );
        })}
      </defs>
      <CartesianGrid strokeDasharray="4 4" stroke={SNEAT.border} vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} />
      <YAxis {...axisProps} />
      <Tooltip {...tooltipProps} />
      {series.map((s, i) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name || s.key}
          stroke={s.color || SERIES_COLORS[i % SERIES_COLORS.length]}
          strokeWidth={2.5}
          fill={`url(#sn-grad-${s.key})`}
        />
      ))}
    </AreaChart>
  );
}

/* ── donut / gauge ───────────────────────────────────────────────────────
 * Hand-rolled SVG rather than recharts' <Pie>, because the house style needs
 * three things recharts will not give us cleanly: percentage labels sitting ON
 * each arc, a raised white inner disc, and a thin offset outer ring.
 * ---------------------------------------------------------------------- */

/** Point on a circle. 0° is 12 o'clock; angles run clockwise. */
function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Filled ring segment between two radii. */
function arcPath(cx, cy, rOuter, rInner, start, end) {
  const large = end - start > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, start);
  const p2 = polar(cx, cy, rOuter, end);
  const p3 = polar(cx, cy, rInner, end);
  const p4 = polar(cx, cy, rInner, start);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * Donut chart in the EduOne house style: a thick two-tone ring with the
 * percentage printed on each segment, a raised white disc in the middle
 * carrying the headline figure, and a thin accent ring just outside.
 *
 * Props mirror the previous recharts version so existing callers keep working:
 *   data        [{ name, value, color? }]
 *   centerValue headline shown on the inner disc
 *   centerLabel caption under it
 *   showLegend  legend beneath the ring (default true)
 *   minLabelPct hide on-arc labels for slivers below this share (default 6%)
 *
 * Renders responsively from a viewBox, so it must NOT be wrapped in recharts'
 * ResponsiveContainer — use <ChartCard raw>.
 */
export function SnDonut({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  centerLabel,
  centerValue,
  showLegend = true,
  minLabelPct = 6,
  height = 260,
}) {
  const segments = useMemo(() => {
    const rows = (data || [])
      .map((d, i) => ({
        name: d[nameKey],
        value: Math.max(0, Number(d[valueKey]) || 0),
        color: d.color || SERIES_COLORS[i % SERIES_COLORS.length],
      }))
      .filter((d) => d.value > 0);
    const total = rows.reduce((s, d) => s + d.value, 0);
    let angle = 0;
    return {
      total,
      rows: rows.map((d) => {
        const share = total > 0 ? (d.value / total) * 100 : 0;
        const start = angle;
        const sweep = (share / 100) * 360;
        angle += sweep;
        return { ...d, share, start, end: start + sweep };
      }),
    };
  }, [data, nameKey, valueKey]);

  // Geometry in viewBox units.
  const S = 200;
  const c = S / 2;
  const rOuter = 82;
  const rInner = 54;
  const rMid = (rOuter + rInner) / 2;
  const rAccent = 92;

  const { rows, total } = segments;
  const single = rows.length === 1 || rows.some((r) => r.share >= 99.99);
  const uid = useMemo(() => `dn${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ width: '100%', maxWidth: height, height: 'auto', display: 'block' }}>
        <defs>
          <filter id={`${uid}-disc`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(15,23,42,0.22)" />
          </filter>
          <filter id={`${uid}-ring`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(15,23,42,0.16)" />
          </filter>
        </defs>

        {/* Thin accent ring, offset outside the donut. */}
        <circle
          cx={c} cy={c} r={rAccent}
          fill="none"
          stroke={rows[0]?.color || SNEAT.primary}
          strokeWidth="1.5"
          opacity="0.55"
        />

        <g filter={`url(#${uid}-ring)`}>
          {total === 0 ? (
            <circle cx={c} cy={c} r={rMid} fill="none" stroke={SNEAT.border} strokeWidth={rOuter - rInner} />
          ) : single ? (
            <circle
              cx={c} cy={c} r={rMid}
              fill="none"
              stroke={rows[0].color}
              strokeWidth={rOuter - rInner}
            />
          ) : (
            rows.map((r) => (
              <path
                key={r.name}
                d={arcPath(c, c, rOuter, rInner, r.start, r.end)}
                fill={r.color}
              />
            ))
          )}
        </g>

        {/* Percentage printed on the arc itself. */}
        {total > 0 && rows.map((r) => {
          if (r.share < minLabelPct) return null;
          const mid = (r.start + r.end) / 2;
          const p = polar(c, c, rMid, single ? 0 : mid);
          return (
            <text
              key={`${r.name}-lbl`}
              x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="central"
              style={{ fill: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              {Math.round(r.share)}%
            </text>
          );
        })}

        {/* Raised white disc carrying the headline figure. */}
        <circle cx={c} cy={c} r={rInner - 3} fill="#fff" filter={`url(#${uid}-disc)`} />

        {centerValue !== undefined && (
          <text
            x={c} y={centerLabel ? c - 6 : c}
            textAnchor="middle" dominantBaseline="central"
            style={{ fill: SNEAT.heading, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={c} y={c + 15}
            textAnchor="middle" dominantBaseline="central"
            style={{ fill: SNEAT.muted, fontSize: 11, fontWeight: 500 }}
          >
            {centerLabel}
          </text>
        )}
      </svg>

      {showLegend && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {rows.map((r) => (
            <span key={`${r.name}-lg`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: SNEAT.body }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.color, flex: '0 0 auto' }} />
              {r.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single-percentage gauge in the same style — one filled arc against a muted
 * remainder. Use for a rate against a target (collection rate, attendance).
 */
export function SnGauge({ value = 0, label, caption, color = SNEAT.primary, track = '#E7E7F1', size = 200 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <SnDonut
      height={size}
      showLegend={false}
      centerValue={`${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`}
      centerLabel={label}
      data={[
        { name: label || 'Achieved', value: pct, color },
        { name: caption || 'Remaining', value: 100 - pct, color: track },
      ]}
    />
  );
}

/* ── table + list ────────────────────────────────────────────────────────── */

/**
 * Card-wrapped table.
 * columns: [{ key, header, align, width, render(row) }]
 */
export function TableCard({ title, subtitle, action, columns = [], rows = [], empty, rowKey }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} action={action} />
      {rows.length === 0 ? (
        <CardBody>{empty || <SnEmpty />}</CardBody>
      ) : (
        <div className="sn-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="sn-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={rowKey ? rowKey(r, i) : (r.id ?? i)}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={c.align === 'right' ? 'sn-td-num' : undefined}
                      style={{ textAlign: c.align || 'left' }}
                    >
                      {c.render ? c.render(r, i) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Per-class mean against each class's own yearly target.
 *
 * Takes the `rows` from lib/targets.js → computeClassMeanMetrics(). Shared by
 * the Principal, DoS and Deputy Academic dashboards so the same numbers are
 * presented the same way everywhere.
 */
export function ClassMeanTable({ rows = [], empty, showStudents = true }) {
  if (!rows.length) {
    return empty || <SnEmpty title="No class means yet" message="Means appear once marks are entered." />;
  }
  return (
    <div className="sn-list">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="sn-progress-row">
            <span>
              <span className="sn-strong">{r.name}</span>
              {showStudents && r.students !== undefined && (
                <span className="sn-muted"> · {r.students} student{r.students === 1 ? '' : 's'}</span>
              )}
              {!r.hasExplicitTarget && (
                <span className="sn-muted" style={{ fontSize: 11 }}> · default target</span>
              )}
            </span>
            <span>
              <b>{r.mean.toFixed(1)}%</b>
              <span className="sn-muted"> / {r.target}%</span>{' '}
              <span
                style={{
                  fontWeight: 600,
                  color: r.met ? 'var(--sn-success-dark)' : 'var(--sn-danger)',
                }}
              >
                {r.gap >= 0 ? '+' : ''}{r.gap.toFixed(1)}
              </span>
            </span>
          </div>
          <div className="sn-progress-track">
            <div
              className="sn-progress-bar"
              style={{
                width: `${Math.max(0, Math.min(100, r.pct))}%`,
                background: r.met ? SNEAT.success : r.pct >= 80 ? SNEAT.primary : r.pct >= 50 ? SNEAT.warning : SNEAT.danger,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ranked rows with an icon/avatar, label, sub-label and value. */
export function RankList({ items = [], empty }) {
  if (!items.length) return empty || <SnEmpty />;
  return (
    <div className="sn-list">
      {items.map((it, i) => (
        <div className="sn-list-item" key={it.id ?? it.title ?? i}>
          {it.icon && <span className={`sn-icon sn-icon-${tone(it.tone)}`}>{it.icon}</span>}
          <div className="sn-list-main">
            <p className="sn-list-title">{it.title}</p>
            {it.sub && <p className="sn-list-sub">{it.sub}</p>}
            {it.progress !== undefined && (
              <div style={{ marginTop: 6 }}>
                <ProgressMetric value={it.progress} max={100} tone={it.tone} showRow={false} />
              </div>
            )}
          </div>
          {it.value !== undefined && <span className="sn-list-value">{it.value}</span>}
        </div>
      ))}
    </div>
  );
}
