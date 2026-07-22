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
      <div className="sidebar-brand" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ 
          width: 38, height: 38, borderRadius: 8, background: '#ffffff', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          padding: 4, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' 
        }}>
          {settings?.logo ? (
            <img src={settings.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <img src="/logo.png" alt="DigiShule Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <strong style={{ color: '#ffffff', fontSize: 15, fontWeight: 800, letterSpacing: '0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {settings?.name || 'DigiShule'}
            </strong>
            <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 2 }}>
              {role?.portal || 'Portal'}
            </span>
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



