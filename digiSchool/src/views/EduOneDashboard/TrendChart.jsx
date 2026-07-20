import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
    gap: '1.25rem',
    [tokens.breakpoints.lg]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '1.25rem',
    boxShadow: tokens.shadows.sm
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.25rem'
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: tokens.colors.slate500,
    margin: 0
  },
  filterPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    color: tokens.colors.slate400,
    border: `1px solid ${tokens.colors.slate200}`,
    borderRadius: tokens.borderRadius.lg,
    padding: '0.25rem 0.5rem'
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  value: {
    fontSize: '1.875rem',
    fontWeight: 800,
    color: tokens.colors.slate900,
    margin: 0
  },
  trend: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: tokens.colors.emerald500,
    display: 'flex',
    alignItems: 'center'
  },
  chartWrap: {
    width: '100%',
    height: '8rem'
  },
  xAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: tokens.colors.slate400,
    marginTop: '0.25rem'
  }
});

export default function TrendChart() {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.card}>
        <div className={classes.headerRow}>
          <p className={classes.title}>Attendance Rate</p>
          <div className={classes.filterPill}>Last 3 months
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div className={classes.valueRow}>
          <span className={classes.value}>93%</span>
          <span className={classes.trend}>&uarr; 2%</span>
        </div>
        <svg viewBox="0 0 300 130" className={classes.chartWrap}>
          <defs>
            <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polyline fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            points="0,55 50,55 100,90 150,90 200,35 250,35 300,35" />
          <polygon fill="url(#gradPurple)" points="0,55 50,55 100,90 150,90 200,35 250,35 300,35 300,130 0,130" />
        </svg>
        <div className={classes.xAxis}>
          <span>May</span><span>Jun</span><span>Jul</span>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.headerRow}>
          <p className={classes.title}>Fee Collection Trend</p>
          <div className={classes.filterPill}>Last term
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div className={classes.valueRow}>
          <span className={classes.value}>KES 3.4M</span>
          <span className={classes.trend}>&uarr; 8%</span>
        </div>
        <svg viewBox="0 0 300 130" className={classes.chartWrap}>
          <defs>
            <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polyline fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            points="0,100 50,100 100,70 150,70 200,50 250,20 300,20" />
          <polygon fill="url(#gradAmber)" points="0,100 50,100 100,70 150,70 200,50 250,20 300,20 300,130 0,130" />
        </svg>
        <div className={classes.xAxis}>
          <span>May</span><span>Jun</span><span>Jul</span>
        </div>
      </div>
    </div>
  );
}



