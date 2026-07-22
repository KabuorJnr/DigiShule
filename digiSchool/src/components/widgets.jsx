// Small reusable presentational widgets.

export function KpiCard({ icon, iconComponent, label, value, sub, accent, children }) {
  const valStr = String(value || '');
  const fontSize = valStr.length > 13 ? 15 : valStr.length > 9 ? 18 : 24;

  const isAlert = accent === '#D13438' || accent === '#EF4444' || accent === '#F59E0B';
  const iconColor = isAlert ? accent : '#047857';

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{label}</span>
        {iconComponent ? (
          <span style={{ color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: isAlert ? `${iconColor}15` : 'rgba(4,120,87,0.08)' }}>{iconComponent}</span>
        ) : (
          <span style={{ fontSize: 20 }}>{icon}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
        <span style={{ fontSize, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      </div>
      {sub && <div className="muted" style={{ fontSize: 12, color: '#64748B' }}>{sub}</div>}
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



