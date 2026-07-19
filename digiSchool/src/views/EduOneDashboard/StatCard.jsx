import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
    gap: '1.25rem',
    [tokens.breakpoints.sm]: {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    }
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '1.25rem',
    boxShadow: tokens.shadows.sm
  },
  topSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  iconBox: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: tokens.borderRadius.xl,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  value: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: tokens.colors.slate900,
    lineHeight: 1,
    margin: 0
  },
  label: {
    fontSize: '0.75rem',
    color: tokens.colors.slate400,
    marginTop: '0.25rem',
    margin: 0
  },
  link: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: tokens.colors.slate500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    textDecoration: 'none'
  }
});

export default function StatCard() {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.card}>
        <div className={classes.topSection}>
          <div className={classes.iconBox} style={{ backgroundColor: tokens.colors.amber100 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div>
            <p className={classes.value}>842</p>
            <p className={classes.label}>Active Students</p>
          </div>
        </div>
        <a href="#" className={classes.link}>View details <span>&rarr;</span></a>
      </div>

      <div className={classes.card}>
        <div className={classes.topSection}>
          <div className={classes.iconBox} style={{ backgroundColor: tokens.colors.emerald100 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <p className={classes.value}>KES 3.4M</p>
            <p className={classes.label}>Fees Collected</p>
          </div>
        </div>
        <a href="#" className={classes.link}>View details <span>&rarr;</span></a>
      </div>

      <div className={classes.card}>
        <div className={classes.topSection}>
          <div className={classes.iconBox} style={{ backgroundColor: tokens.colors.blue100 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <p className={classes.value}>1,206</p>
            <p className={classes.label}>SMS Sent Today</p>
          </div>
        </div>
        <a href="#" className={classes.link}>View details <span>&rarr;</span></a>
      </div>
    </div>
  );
}
