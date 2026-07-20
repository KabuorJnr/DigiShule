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
          <div style={{ flex: 1 }}>
            <strong>{settings.name || <img src="/eduone-logo.png" alt="EduOne" style={{ height: 28, verticalAlign: 'middle', background: 'white', borderRadius: 4, padding: '4px 6px' }} />}</strong>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{role.portal}</div>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {nav.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: section.section === 'CORE' ? 8 : 16 }}>
            {!collapsed && section.section !== 'CORE' && (
              <div style={{ padding: '0 20px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
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
                    <span className="nav-icon"><Icon name={NAV_ICON_MAP[item.icon] || item.icon} size={16} fallback={item.icon} /></span>
                    {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                    {!collapsed && hasSub && (isExpanded ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />)}
                  </button>
                  {!collapsed && hasSub && isExpanded && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '4px 0', borderLeft: '2px solid rgba(255,255,255,0.1)', marginLeft: 30, marginTop: 2, marginBottom: 4 }}>
                      {item.sub.map(subItem => (
                        <button
                          key={subItem.id}
                          className={`nav-item${isNavActive(subItem) ? ' active' : ''}`}
                          style={{ padding: '6px 20px 6px 16px', minHeight: 32, fontSize: 13, opacity: isNavActive(subItem) ? 1 : 0.7 }}
                          onClick={() => handleAction(subItem)}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isNavActive(subItem) ? '#fff' : 'rgba(255,255,255,0.3)', marginRight: 10 }}></span>
                          {subItem.label}
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



