// Small reusable presentational widgets.

export function KpiCard({ icon, label, value, sub, accent, children }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: accent || 'var(--text)' }}>{value}</span>
      </div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

export function Sparkline({ data, color = '#1E3A5F', width = 120, height = 32 }) {
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
  const c = color || (value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--accent)' : 'var(--danger)');
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, value)}%`, background: c }} />
    </div>
  );
}

export function Badge({ children, color = 'gray' }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>{title}</h2>
        {subtitle && <p className="muted" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}
