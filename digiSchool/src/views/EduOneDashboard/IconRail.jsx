import React from 'react';
import { createUseStyles } from 'react-jss';
import { tokens } from './theme';
import { Icon, NAV_ICON_MAP } from '../../components/icons';
import { PanelLeftClose, Settings } from 'lucide-react';

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
    position: 'relative',
    '&:hover $tooltip': {
      display: 'block'
    }
  },
  tooltip: {
    display: 'none',
    position: 'absolute',
    left: '3rem',
    top: '0.375rem',
    whiteSpace: 'nowrap',
    backgroundColor: tokens.colors.slate900,
    color: tokens.colors.white,
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: '0.25rem 0.625rem',
    borderRadius: tokens.borderRadius.lg,
    zIndex: 50
  }
});

export default function IconRail({ nav, isNavActive, store, collapsed, setCollapsed }) {
  const classes = useStyles();

  // Extract top-level items to show in the rail (max 6 to avoid overflow)
  const topItems = [];
  nav?.forEach(section => {
    section.items.forEach(item => {
      if (topItems.length < 6 && item.icon) {
        topItems.push(item);
      }
    });
  });

  return (
    <div className={classes.iconRail}>
      <div className={classes.iconGroup}>
        <div className={classes.tooltipContainer}>
          <button className={classes.btn} onClick={() => setCollapsed(!collapsed)}>
            <PanelLeftClose size={16} />
          </button>
          <span className={classes.tooltip}>Toggle Sidebar</span>
        </div>
        
        {topItems.map(item => {
          const active = isNavActive(item);
          return (
            <div key={item.id} className={classes.tooltipContainer}>
              <button 
                className={active ? classes.btnActive : classes.btn} 
                onClick={() => {
                  if (item.view) store.navigate(item.view, { tab: item.tab, action: item.action, filter: item.filter });
                }}
              >
                <Icon name={NAV_ICON_MAP[item.icon] || item.icon} size={16} fallback={item.icon} />
              </button>
              <span className={classes.tooltip}>{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className={classes.iconGroup} style={{ gap: '1rem' }}>
        <button className={classes.btn}>
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
