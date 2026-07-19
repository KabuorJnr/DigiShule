import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  card: {
    background: `linear-gradient(135deg, ${tokens.colors.brandPrimary} 0%, ${tokens.colors.brandSecondary} 100%)`,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '1rem',
    color: '#ffffff',
    position: 'relative',
    overflow: 'hidden'
  },
  iconBox: {
    width: '2rem',
    height: '2rem',
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem'
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.25,
    margin: 0
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0.25rem',
    marginBottom: '0.625rem'
  },
  progressTrack: {
    width: '100%',
    height: '0.375rem',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
    marginBottom: '0.75rem'
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.amber300,
    borderRadius: tokens.borderRadius.full
  },
  btnLight: {
    width: '100%',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: tokens.borderRadius.lg,
    padding: '0.5rem 0',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '0.5rem'
  },
  btnDark: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: tokens.borderRadius.lg,
    padding: '0.5rem 0',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem'
  }
});

export default function UsageCard() {
  const classes = useStyles();

  return (
    <div className={classes.card}>
      <div className={classes.iconBox}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <p className={classes.title}>SMS Credit Limit</p>
      <p className={classes.subtitle}>8,240 / 15,000 &nbsp; Monthly</p>
      <div className={classes.progressTrack}>
        <div className={classes.progressFill} style={{ width: '55%' }}></div>
      </div>
      <button className={classes.btnLight}>Learn more</button>
      <button className={classes.btnDark}>
        Upgrade plan
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
}
