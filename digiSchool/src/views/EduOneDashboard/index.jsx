import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import IconRail from './IconRail';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatCard from './StatCard';
import TrendChart from './TrendChart';
import ClassBalanceTable from './ClassBalanceTable';

const useStyles = createUseStyles({
  '@global': {
    '*': {
      fontFamily: "'Inter', sans-serif"
    },
    body: {
      backgroundColor: tokens.colors.bg,
      margin: 0
    }
  },
  layout: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    padding: '1.5rem',
    boxSizing: 'border-box',
    gap: 0
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    overflowY: 'auto',
    paddingBottom: '0.5rem',
    '&::-webkit-scrollbar': { display: 'none' },
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  }
});

export default function Dashboard() {
  const classes = useStyles();

  return (
    <div className={classes.layout}>
      <IconRail />
      <Sidebar />
      <main className={classes.mainContent}>
        <TopBar />
        <StatCard />
        <TrendChart />
        <ClassBalanceTable />
      </main>
    </div>
  );
}
