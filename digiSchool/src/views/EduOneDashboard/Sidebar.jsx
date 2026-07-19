import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import NavSection from './NavSection';
import UsageCard from './UsageCard';

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
      overflow: 'hidden'
    }
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
    gap: '0.5rem'
  },
  logoBox: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: tokens.borderRadius.lg,
    background: `linear-gradient(135deg, ${tokens.colors.brandPrimary} 0%, ${tokens.colors.brandSecondary} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandText: {
    fontWeight: 'bold',
    fontSize: '17px',
    color: tokens.colors.slate900,
    letterSpacing: '-0.025em'
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
    color: tokens.colors.slate400
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
    overflowY: 'auto'
  },
  usageWrap: {
    padding: '0.75rem 1.25rem 1.25rem 1.25rem'
  },
  footer: {
    padding: '0 1.25rem 1.25rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem'
  },
  switchTrack: {
    width: '2.75rem',
    height: '1.5rem',
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.amber400,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: '0 0.125rem',
    border: 'none',
    cursor: 'pointer'
  },
  switchDot: {
    width: '1.25rem',
    height: '1.25rem',
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.white,
    boxShadow: tokens.shadows.sm,
    transition: 'transform .18s ease',
    transform: 'translateX(1.25rem)'
  }
});

export default function Sidebar() {
  const classes = useStyles();

  return (
    <aside className={classes.sidebar}>
      <div className={classes.header}>
        <div className={classes.brandWrap}>
          <div className={classes.logoBox}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" strokeWidth="1.6"/></svg>
          </div>
          <span className={classes.brandText}>EduOne</span>
        </div>
        <button className={classes.iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>

      <div className={classes.searchWrap}>
        <div className={classes.searchBox}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style={{ flex: 1 }}>Search</span>
          <span className={classes.searchSlash}>/</span>
        </div>
      </div>

      <div className={`${classes.scrollArea} ${classes.noScrollbar}`}>
        <NavSection />
      </div>

      <div className={classes.usageWrap}>
        <UsageCard />
      </div>

      <div className={classes.footer}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
        <button className={classes.switchTrack}>
          <span className={classes.switchDot}></span>
        </button>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </div>
    </aside>
  );
}
