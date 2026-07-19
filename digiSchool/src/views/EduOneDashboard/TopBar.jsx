import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import { Search, Bell, Menu } from 'lucide-react';
import { ROLES } from '../../data/users';

const useStyles = createUseStyles({
  topBar: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '0.75rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: tokens.shadows.sm,
    gap: '1rem',
    marginBottom: '1.25rem'
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 1
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    color: tokens.colors.slate900,
    margin: 0,
    display: 'none',
    [tokens.breakpoints.lg]: {
      display: 'block'
    }
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    padding: '0.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.slate900,
    [tokens.breakpoints.lg]: {
      display: 'none'
    }
  },
  searchContainer: {
    position: 'relative',
    maxWidth: '400px',
    width: '100%',
    display: 'none',
    [tokens.breakpoints.lg]: {
      display: 'block'
    }
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: tokens.colors.slate400
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.5rem 0.5rem 2rem',
    backgroundColor: tokens.colors.slate50,
    border: `1px solid ${tokens.colors.slate100}`,
    borderRadius: tokens.borderRadius.xl,
    fontSize: '0.875rem',
    outline: 'none',
    color: tokens.colors.slate900,
    '&:focus': {
      border: `1px solid ${tokens.colors.slate200}`
    }
  },
  searchResults: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.5rem',
    background: tokens.colors.white,
    border: `1px solid ${tokens.colors.slate200}`,
    borderRadius: tokens.borderRadius.lg,
    boxShadow: tokens.shadows.md,
    zIndex: 1000,
    overflow: 'hidden'
  },
  searchHeading: {
    fontSize: '11px',
    fontWeight: 600,
    color: tokens.colors.slate400,
    textTransform: 'uppercase',
    marginBottom: '0.5rem'
  },
  searchItem: {
    padding: '0.375rem 0.25rem',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: tokens.colors.slate50
    }
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  returnBtn: {
    backgroundColor: '#D13438',
    color: tokens.colors.white,
    padding: '0.375rem 0.75rem',
    borderRadius: tokens.borderRadius.lg,
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  bellBtn: {
    background: 'none',
    border: 'none',
    position: 'relative',
    cursor: 'pointer',
    color: tokens.colors.slate600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.25rem'
  },
  bellBadge: {
    position: 'absolute',
    top: '0',
    right: '0',
    backgroundColor: '#ef4444',
    color: tokens.colors.white,
    fontSize: '9px',
    fontWeight: 'bold',
    minWidth: '14px',
    height: '14px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 2px'
  }
});

export default function TopBar({
  settings,
  currentUser,
  unreadCount,
  setNotifOpen,
  searchQuery,
  setSearchQuery,
  showSearchResults,
  setShowSearchResults,
  searchResults,
  searchInputRef,
  store,
  activeRoleOverride,
  setActiveRoleOverride,
  setView,
  setViewParams,
  navigateRouter,
  notify,
  setMobileMenuOpen,
  mobileMenuOpen
}) {
  const classes = useStyles();

  return (
    <header className={classes.topBar}>
      <div className={classes.leftGroup}>
        <button 
          className={classes.menuBtn} 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu size={20} />
        </button>
        <h1 className={classes.title}>{settings?.name || 'Dashboard'}</h1>
        
        <div className={classes.searchContainer} ref={searchInputRef}>
          <Search size={14} className={classes.searchIcon} />
          <input 
            type="text" 
            placeholder="Search students, staff..." 
            className={classes.searchInput}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
            onFocus={() => setShowSearchResults(true)}
          />
          {showSearchResults && searchQuery.trim() && (
            <div className={classes.searchResults}>
              {searchResults.students.length > 0 && (
                <div style={{ padding: '8px 12px', borderBottom: searchResults.staff.length > 0 ? `1px solid ${tokens.colors.slate100}` : 'none' }}>
                  <div className={classes.searchHeading}>Students</div>
                  {searchResults.students.map(s => (
                    <div key={s.id} className={classes.searchItem} 
                          onClick={() => {
                            setSearchQuery('');
                            setShowSearchResults(false);
                            const role = currentUser?.role;
                            if (role === 'student' || role === 'parent') {
                              store.navigate(ROLES[role]?.home || 'overview');
                            } else if (role === 'nurse' || role === 'clinic') {
                              store.navigate('clinic');
                            } else {
                              store.navigate('registrar', { search: s.name });
                            }
                          }}>
                      <strong>{s.name}</strong> <span style={{ opacity: 0.6, fontSize: '12px' }}>{s.adm || ''} · {s.class || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.staff.length > 0 && (
                <div style={{ padding: '8px 12px' }}>
                  <div className={classes.searchHeading}>Staff</div>
                  {searchResults.staff.map(t => (
                    <div key={t.id} className={classes.searchItem} 
                          onClick={() => { setSearchQuery(''); setShowSearchResults(false); store.navigate('staff_attendance', { search: t.name }); }}>
                      <strong>{t.name}</strong> <span style={{ opacity: 0.6, fontSize: '12px' }}>{t.dept || t.role || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.students.length === 0 && searchResults.staff.length === 0 && (
                <div style={{ padding: '16px', fontSize: '13px', color: tokens.colors.slate400, textAlign: 'center' }}>No results found for "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={classes.rightGroup}>
        {activeRoleOverride && (
          <button 
            className={classes.returnBtn} 
            onClick={() => {
              setActiveRoleOverride(null);
              const home = ROLES[currentUser.role].home || 'overview';
              setView(home);
              setViewParams({});
              navigateRouter(`/portal/${home}`);
              notify('Returned to Principal Office', 'info', 'Office Visit');
            }}
          >
            Return to Principal Office
          </button>
        )}
        <button className={classes.bellBtn} onClick={() => setNotifOpen(true)} aria-label="Notifications">
          <Bell size={18} />
          {unreadCount > 0 && <span className={classes.bellBadge}>{unreadCount}</span>}
        </button>
      </div>
    </header>
  );
}
