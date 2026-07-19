import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';

const useStyles = createUseStyles({
  topBar: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius['2xl'],
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: tokens.shadows.sm
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    color: tokens.colors.slate900,
    margin: 0
  },
  userWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  avatar: {
    width: '2rem',
    height: '2rem',
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.slate200
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: tokens.colors.slate700
  }
});

export default function TopBar() {
  const classes = useStyles();
  return (
    <div className={classes.topBar}>
      <h1 className={classes.title}>Dashboard</h1>
      <div className={classes.userWrap}>
        <div className={classes.avatar}></div>
        <span className={classes.userName}>Riverside Secondary</span>
      </div>
    </div>
  );
}
