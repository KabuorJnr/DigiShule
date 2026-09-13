// Small reusable presentational widgets — restyled to the Sneat design system.
//
// These are used by dashboards that have NOT yet been converted to the
// components in src/components/sneat (DoS, Teacher, Parent, Student, Overview,
// and most finance sub-tabs). Restyling them here is what gives those screens
// the Sneat look without touching each file.
//
// WHY INLINE STYLES: the Sneat CSS in src/styles/sneat.css is scoped under
// `.sneat`, which only the converted dashboards apply. These widgets render
// outside that scope, so their tokens are inlined rather than inherited.
// When a screen is migrated to sneat/, prefer <MetricCard> over <KpiCard>.

const SN = {
  primary: '#047857',
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
  card: '#FFFFFF',
  radius: 10,
  radiusSm: 6,
  shadow: '0 2px 6px 0 rgba(67, 89, 113, 0.12)',
};

/** Map the legacy hex `accent` prop onto a Sneat tone. */
function toneFromAccent(accent) {
  switch (accent) {
    case '#D13438':
    case '#EF4444':
      return { fg: SN.danger, bg: 'rgba(220, 38, 38, 0.14)' };
    case '#F59E0B':
    case '#FFB900':
      return { fg: SN.warning, bg: 'rgba(245, 158, 11, 0.16)' };
    case '#0EA5E9':
    case '#38BDF8':
      return { fg: SN.info, bg: 'rgba(8, 145, 178, 0.14)' };
    case '#64748B':
      return { fg: SN.secondary, bg: 'rgba(100, 116, 139, 0.14)' };
    default:
      return { fg: SN.primary, bg: 'rgba(4, 120, 87, 0.14)' };
  }
}

export function KpiCard({ icon, iconComponent, label, value, sub, accent, children }) {
  const valStr = String(value ?? '');
  // Long values (e.g. "KES 12,480,000") step down so the card never overflows.
  const fontSize = valStr.length > 16 ? 17 : valStr.length > 11 ? 20 : 24;
  const { fg, bg } = toneFromAccent(accent);

  return (
    <div
      style={{
        background: SN.card,
        borderRadius: SN.radius,
        boxShadow: SN.shadow,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100%',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: SN.body }}>{label}</span>
          <div
            style={{
              fontSize,
              fontWeight: 600,
              color: SN.heading,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginTop: 6,
              overflowWrap: 'anywhere',
            }}
          >
            {value}
          </div>
        </div>
        {iconComponent ? (
          <span
            style={{
              color: fg,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: SN.radiusSm,
              flex: '0 0 auto',
            }}
          >
            {iconComponent}
          </span>
        ) : (
          icon && <span style={{ fontSize: 20 }}>{icon}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 13, color: SN.muted }}>{sub}</div>}
      {children}
    </div>
  );
}

export function Sparkline({ data, color = SN.primary, width = 120, height = 32 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const c = color || (pct >= 80 ? SN.success : pct >= 60 ? SN.primary : pct >= 35 ? SN.warning : SN.danger);
  return (
    <div style={{ height: 8, borderRadius: 999, background: SN.track, overflow: 'hidden', width: '100%' }}>
      <span
        style={{
          display: 'block',
          height: '100%',
          width: `${pct}%`,
          background: c,
          borderRadius: 999,
          transition: 'width 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

const BADGE_TONES = {
  blue: { bg: 'rgba(8, 145, 178, 0.14)', fg: '#0295B3' },
  amber: { bg: 'rgba(245, 158, 11, 0.16)', fg: '#B87A00' },
  green: { bg: 'rgba(16, 185, 129, 0.16)', fg: SN.successDark },
  red: { bg: 'rgba(220, 38, 38, 0.14)', fg: SN.danger },
  gray: { bg: 'rgba(100, 116, 139, 0.14)', fg: SN.secondary },
  purple: { bg: 'rgba(4, 120, 87, 0.14)', fg: SN.primary },
};

export function Badge({ children, color = 'gray' }) {
  const t = BADGE_TONES[color] || BADGE_TONES.gray;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: SN.radiusSm,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        background: t.bg,
        color: t.fg,
      }}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: SN.heading, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 14, color: SN.body }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

// Consistent empty state for any list/table/section that has no data yet.
export function EmptyState({ icon, title = 'Nothing here yet', message, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        color: SN.muted,
      }}
    >
      {icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: SN.radiusSm,
            background: 'rgba(100, 116, 139, 0.14)',
            color: SN.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          {icon}
        </div>
      )}
      <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: SN.heading }}>{title}</h4>
      {message && <p style={{ margin: 0, fontSize: 13, maxWidth: '32ch' }}>{message}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
