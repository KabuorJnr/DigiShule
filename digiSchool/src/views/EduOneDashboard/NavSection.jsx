import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

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
    textDecoration: 'none',
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
    textDecoration: 'none'
  },
  integrationIcon: {
    width: '1rem',
    height: '1rem',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.white,
    fontSize: '9px',
    fontWeight: 'bold'
  }
});

export default function NavSection() {
  const classes = useStyles();

  return (
    <>
      <p className={classes.heading}>SCHOOL</p>
      <nav className={classes.container}>
        <a href="#" className={classes.navItemActive}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          Dashboard
        </a>
        <a href="#" className={classes.navItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Students
        </a>
        <a href="#" className={classes.navItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Fees
        </a>
        <a href="#" className={classes.navItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Attendance
        </a>
        <a href="#" className={classes.navItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Report Cards
        </a>
        <a href="#" className={classes.navItem}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          SMS Broadcast
        </a>
      </nav>

      <p className={classes.heading}>INTEGRATIONS</p>
      <nav className={classes.container} style={{ marginBottom: 0 }}>
        <a href="#" className={classes.navItem}>
          <span className={classes.integrationIcon} style={{ backgroundColor: tokens.colors.emerald500 }}>M</span>
          M-Pesa
        </a>
        <a href="#" className={classes.navItem}>
          <span className={classes.integrationIcon} style={{ backgroundColor: tokens.colors.blue600 }}>N</span>
          NEMIS
        </a>
        <a href="#" className={classes.navItem}>
          <span className={classes.integrationIcon} style={{ backgroundColor: tokens.colors.slate900 }}>K</span>
          KNEC
        </a>
      </nav>
    </>
  );
}
