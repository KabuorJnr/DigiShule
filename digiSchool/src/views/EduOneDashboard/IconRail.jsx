import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  iconRail: {
    display: 'none',
    [tokens.breakpoints.xl]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: tokens.colors.white,
      borderRadius: tokens.borderRadius['2xl'],
      width: '4rem',
      paddingTop: '1.25rem',
      paddingBottom: '1.25rem',
      marginRight: '1rem',
      boxShadow: tokens.shadows.sm,
    }
  },
  iconGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem'
  },
  btn: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: tokens.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.slate400,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colors.slate100
    }
  },
  btnActive: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: tokens.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.white,
    backgroundColor: tokens.colors.slate900,
    border: 'none',
    cursor: 'pointer',
  },
  tooltipContainer: {
    position: 'relative'
  },
  tooltip: {
    position: 'absolute',
    left: '2.75rem',
    top: '0.375rem',
    whiteSpace: 'nowrap',
    backgroundColor: tokens.colors.slate900,
    color: tokens.colors.white,
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: '0.25rem 0.625rem',
    borderRadius: tokens.borderRadius.lg
  }
});

export default function IconRail() {
  const classes = useStyles();

  return (
    <div className={classes.iconRail}>
      <div className={classes.iconGroup}>
        <button className={classes.btn} title="Collapse">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        <button className={classes.btn} title="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <div className={classes.tooltipContainer}>
          <button className={classes.btnActive} title="Dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          </button>
          <span className={classes.tooltip}>Dashboard</span>
        </div>
        <button className={classes.btn} title="Students">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
        <button className={classes.btn} title="Fees">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </button>
        <button className={classes.btn} title="Report Cards">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
      </div>
      <div className={classes.iconGroup} style={{ gap: '1rem' }}>
        <button className={classes.btn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
      </div>
    </div>
  );
}
