import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '1.25rem',
    boxShadow: tokens.shadows.sm,
    flex: 1
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem'
  },
  tabGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: tokens.colors.slate50,
    borderRadius: tokens.borderRadius.xl,
    padding: '0.25rem'
  },
  tabBtnActive: {
    padding: '0.375rem 0.75rem',
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: tokens.colors.white,
    boxShadow: tokens.shadows.sm,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: tokens.colors.slate900,
    border: 'none',
    cursor: 'pointer'
  },
  tabBtn: {
    padding: '0.375rem 0.75rem',
    borderRadius: tokens.borderRadius.lg,
    fontSize: '0.875rem',
    color: tokens.colors.slate400,
    background: 'none',
    border: 'none',
    cursor: 'pointer'
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
  columnTitle: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: tokens.colors.slate400,
    marginBottom: '0.75rem',
    margin: 0
  },
  rowList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  classNameText: {
    width: '6rem',
    fontSize: '0.875rem',
    color: tokens.colors.slate600,
    flexShrink: 0
  },
  track: {
    flex: 1,
    height: '0.625rem',
    backgroundColor: tokens.colors.slate100,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    background: `linear-gradient(90deg, ${tokens.colors.brandAccent} 0%, ${tokens.colors.brandPrimary} 100%)`,
    borderRadius: tokens.borderRadius.full
  }
});

export default function ClassBalanceTable() {
  const classes = useStyles();

  return (
    <div className={classes.card}>
      <div className={classes.headerRow}>
        <div className={classes.tabGroup}>
          <button className={classes.tabBtnActive}>Fee Balance</button>
          <button className={classes.tabBtn}>Attendance</button>
          <button className={classes.tabBtn}>Enrollment</button>
        </div>
        <div className={classes.filterPill}>This term
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <p className={classes.columnTitle}>Class</p>
      <div className={classes.rowList}>
        <div className={classes.row}>
          <span className={classes.classNameText}>Form 4A</span>
          <div className={classes.track}><div className={classes.fill} style={{ width: '92%' }}></div></div>
        </div>
        <div className={classes.row}>
          <span className={classes.classNameText}>Form 3B</span>
          <div className={classes.track}><div className={classes.fill} style={{ width: '74%' }}></div></div>
        </div>
        <div className={classes.row}>
          <span className={classes.classNameText}>Form 2A</span>
          <div className={classes.track}><div className={classes.fill} style={{ width: '58%' }}></div></div>
        </div>
        <div className={classes.row}>
          <span className={classes.classNameText}>Form 2B</span>
          <div className={classes.track}><div className={classes.fill} style={{ width: '41%' }}></div></div>
        </div>
        <div className={classes.row}>
          <span className={classes.classNameText}>Form 1A</span>
          <div className={classes.track}><div className={classes.fill} style={{ width: '63%' }}></div></div>
        </div>
      </div>
    </div>
  );
}
