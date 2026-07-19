import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import { Icon, NAV_ICON_MAP } from '../../components/icons';
import { ChevronDown, ChevronRight } from 'lucide-react';

const useStyles = createUseStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    marginBottom: '1.5rem'
  },
  heading: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: tokens.colors.slate400,
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    margin: 0
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: tokens.borderRadius.xl,
    color: tokens.colors.slate500,
    fontSize: '0.875rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    '&:hover': {
      backgroundColor: tokens.colors.slate50
    }
  },
  navItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: tokens.borderRadius.xl,
    backgroundColor: tokens.colors.slate900,
    color: tokens.colors.white,
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left'
  },
  subContainer: {
    background: tokens.colors.slate50,
    padding: '0.375rem 0',
    borderLeft: `2px solid ${tokens.colors.slate200}`,
    marginLeft: '1.5rem',
    marginTop: '0.25rem',
    marginBottom: '0.25rem',
    borderRadius: '0 0.5rem 0.5rem 0',
    display: 'flex',
    flexDirection: 'column'
  },
  subItem: {
    padding: '0.5rem 1rem',
    minHeight: '2.25rem',
    fontSize: '0.8125rem',
    background: 'transparent',
    border: 'none',
    color: tokens.colors.slate500,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%'
  },
  subItemActive: {
    padding: '0.5rem 1rem',
    minHeight: '2.25rem',
    fontSize: '0.8125rem',
    background: 'transparent',
    border: 'none',
    color: tokens.colors.slate900,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%'
  },
  dotActive: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: tokens.colors.slate900,
    marginRight: '0.75rem',
    flexShrink: 0
  },
  dotInactive: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: tokens.colors.slate300,
    marginRight: '0.75rem',
    flexShrink: 0
  }
});

export default function NavSection({ nav, isNavActive, expandedNav, toggleNav, store, collapsed }) {
  const classes = useStyles();

  return (
    <>
      {nav?.map((section, sIdx) => (
        <div key={sIdx} style={{ marginBottom: section.section === 'CORE' ? '0.5rem' : '1.5rem' }}>
          {!collapsed && section.section !== 'CORE' && (
            <p className={classes.heading}>{section.section}</p>
          )}
          <nav className={classes.container} style={{ marginBottom: 0 }}>
            {section.items.map((item) => {
              const hasSub = item.sub && item.sub.length > 0;
              const isExpanded = expandedNav[item.id];
              const active = isNavActive(item);

              return (
                <div key={item.id}>
                  <button
                    className={active ? classes.navItemActive : classes.navItem}
                    onClick={() => {
                      if (hasSub) toggleNav(item.id);
                      else if (item.action === 'logout') { /* Handled elsewhere typically */ }
                      else if (item.view) {
                        store.navigate(item.view, { tab: item.tab, action: item.action, filter: item.filter });
                      }
                    }}
                    title={item.label}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem' }}>
                      <Icon name={NAV_ICON_MAP[item.icon] || item.icon} size={18} fallback={item.icon} />
                    </span>
                    {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                    {!collapsed && hasSub && (
                      isExpanded ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />
                    )}
                  </button>
                  {!collapsed && hasSub && isExpanded && (
                    <div className={classes.subContainer}>
                      {item.sub.map(subItem => {
                        const subActive = isNavActive(subItem);
                        return (
                          <button
                            key={subItem.id}
                            className={subActive ? classes.subItemActive : classes.subItem}
                            onClick={() => {
                              if (subItem.view) {
                                store.navigate(subItem.view, { tab: subItem.tab, action: subItem.action, filter: subItem.filter });
                              }
                            }}
                          >
                            <span className={subActive ? classes.dotActive : classes.dotInactive}></span>
                            <span style={{ flex: 1 }}>{subItem.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );
}
