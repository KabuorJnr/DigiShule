import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import { Icon, NAV_ICON_MAP } from '../../components/icons';
import { ChevronDown, ChevronRight, Key, LogOut, PanelLeft, PanelLeftClose } from 'lucide-react';
import NavSection from './NavSection';

const useStyles = createUseStyles({
  noScrollbar: {
    '&::-webkit-scrollbar': { display: 'none' },
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  sidebar: {
    display: 'none',
    [tokens.breakpoints.lg]: {
      display: 'flex',
      flexDirection: 'column',
      width: '260px',
      backgroundColor: tokens.colors.white,
      borderRadius: tokens.borderRadius['2xl'],
      marginRight: '1rem',
      boxShadow: tokens.shadows.sm,
      overflow: 'hidden',
      transition: 'width 0.2s ease',
    }
  },
  sidebarCollapsed: {
    width: '4rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.25rem 1rem 1.25rem'
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    overflow: 'hidden'
  },
  logoBox: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: tokens.borderRadius.lg,
    background: `linear-gradient(135deg, ${tokens.colors.brandPrimary} 0%, ${tokens.colors.brandSecondary} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  brandText: {
    fontWeight: 'bold',
    fontSize: '17px',
    color: tokens.colors.slate900,
    letterSpacing: '-0.025em',
    whiteSpace: 'nowrap'
  },
  iconBtn: {
    width: '2rem',
    height: '2rem',
    borderRadius: tokens.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.slate400,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: tokens.colors.slate100
    }
  },
  searchWrap: {
    padding: '0 1.25rem'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: tokens.colors.slate50,
    border: `1px solid ${tokens.colors.slate100}`,
    borderRadius: tokens.borderRadius.xl,
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    color: tokens.colors.slate400,
    overflow: 'hidden'
  },
  searchSlash: {
    fontSize: '0.75rem',
    border: `1px solid ${tokens.colors.slate200}`,
    borderRadius: '0.25rem',
    padding: '0.125rem 0.375rem'
  },
  scrollArea: {
    padding: '0 1.25rem',
    marginTop: '1.5rem',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto'
  },
  footer: {
    padding: '1.25rem',
    borderTop: `1px solid ${tokens.colors.slate100}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  userProfileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem'
  },
  avatar: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.brandPrimary,
    color: tokens.colors.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: 'bold',
    flexShrink: 0
  },
  footerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: tokens.borderRadius.lg,
    color: tokens.colors.slate500,
    fontSize: '0.875rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colors.slate50
    }
  }
});

export default function Sidebar({ nav, isNavActive, expandedNav, toggleNav, currentUser, role, settings, handleLogout, store, setChangePasswordOpen, collapsed, setCollapsed }) {
  const classes = useStyles();

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
    : 'U';

  return (
    <aside className={`${classes.sidebar} ${collapsed ? classes.sidebarCollapsed : ''}`}>
      <div className={classes.header}>
        <div className={classes.brandWrap}>
          <div className={classes.logoBox}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" strokeWidth="1.6"/></svg>
          </div>
          {!collapsed && <span className={classes.brandText}>{settings?.name || 'EduOne'}</span>}
        </div>
        <button className={classes.iconBtn} onClick={() => setCollapsed(!collapsed)} title="Toggle Sidebar">
          {collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {!collapsed && (
        <div className={classes.searchWrap}>
          <div className={classes.searchBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{ flex: 1 }}>Search</span>
            <span className={classes.searchSlash}>/</span>
          </div>
        </div>
      )}

      <div className={`${classes.scrollArea} ${classes.noScrollbar}`}>
        <NavSection 
          nav={nav} 
          isNavActive={isNavActive} 
          expandedNav={expandedNav} 
          toggleNav={toggleNav} 
          store={store} 
          collapsed={collapsed}
        />
      </div>

      <div className={classes.footer}>
        {!collapsed ? (
          <>
            <div className={classes.userProfileRow}>
              <div className={classes.avatar}>{initials}</div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <strong style={{ fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: tokens.colors.slate900 }}>{currentUser?.name}</strong>
                <span style={{ fontSize: '11px', color: tokens.colors.slate500 }}>{role?.label}</span>
              </div>
            </div>
            <button className={classes.footerBtn} onClick={() => setChangePasswordOpen(true)}>
              <Key size={14} /> <span>Change Password</span>
            </button>
            <button className={classes.footerBtn} onClick={handleLogout} style={{ color: '#ef4444' }}>
              <LogOut size={14} /> <span>Logout</span>
            </button>
          </>
        ) : (
          <>
             <div className={classes.avatar} style={{ margin: '0 auto 0.5rem auto' }}>{initials}</div>
             <button className={classes.footerBtn} onClick={() => setChangePasswordOpen(true)} style={{ padding: '0.5rem', justifyContent: 'center' }}>
              <Key size={14} />
            </button>
            <button className={classes.footerBtn} onClick={handleLogout} style={{ color: '#ef4444', padding: '0.5rem', justifyContent: 'center' }}>
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}



