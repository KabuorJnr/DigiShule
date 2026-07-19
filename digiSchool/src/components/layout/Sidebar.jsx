import { Icon, NAV_ICON_MAP } from '../icons';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function Sidebar({
  collapsed,
  settings,
  role,
  nav,
  expandedNav,
  isNavActive,
  toggleNav,
  handleAction
}) {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="logo-box">
          {settings.logo ? <img src={settings.logo} alt="logo" /> : <img src="/logo.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        </div>
        {!collapsed && (
          <div className="brand-text" style={{ flex: 1 }}>
            <strong>{settings.name || <img src="/eduone-logo.png" alt="EduOne" style={{ height: 28, verticalAlign: 'middle', background: 'transparent', borderRadius: 4, padding: '4px 6px' }} />}</strong>
            <div className="muted">{role.portal}</div>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {nav.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: section.section === 'CORE' ? 8 : 16 }}>
            {!collapsed && section.section !== 'CORE' && (
              <div style={{ padding: '0 16px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {section.section}
              </div>
            )}
            {section.items.map((item) => {
              const hasSub = item.sub && item.sub.length > 0;
              const isExpanded = expandedNav[item.id];
              return (
                <div key={item.id}>
                  <button
                    className={`nav-item${isNavActive(item) ? ' active' : ''}`}
                    onClick={() => {
                      if (hasSub) toggleNav(item.id);
                      else handleAction(item);
                    }}
                    title={item.label}
                  >
                    <span className="nav-icon"><Icon name={NAV_ICON_MAP[item.icon] || item.icon} size={18} fallback={item.icon} /></span>
                    {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && hasSub && (isExpanded ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />)}
                  </button>
                  {!collapsed && hasSub && isExpanded && (
                    <div style={{ background: '#f8fafc', padding: '6px 0', borderLeft: '2px solid #e2e8f0', marginLeft: 24, marginTop: 4, marginBottom: 4, borderRadius: '0 8px 8px 0' }}>
                      {item.sub.map(subItem => (
                        <button
                          key={subItem.id}
                          className={`nav-item${isNavActive(subItem) ? ' active' : ''}`}
                          style={{ padding: '8px 16px 8px 16px', minHeight: 36, fontSize: 13, background: 'transparent', boxShadow: 'none', color: isNavActive(subItem) ? '#6366f1' : '#6b7280' }}
                          onClick={() => handleAction(subItem)}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isNavActive(subItem) ? '#6366f1' : '#cbd5e1', marginRight: 12 }}></span>
                          <span style={{ fontWeight: isNavActive(subItem) ? 600 : 500 }}>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
