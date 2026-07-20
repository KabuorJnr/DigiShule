import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { createUseStyles } from 'react-jss';
import { Package, Truck, FileText, Activity } from 'lucide-react';

const useStyles = createUseStyles({
  dashboardContainer: {
    padding: '0'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statCard: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e0e4ea',
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  statCardGreen: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0D9488', borderRadius: '0 4px 4px 0' } },
  statCardBlue: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0056b3', borderRadius: '0 4px 4px 0' } },
  statCardRed: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#BB0000', borderRadius: '0 4px 4px 0' } },
  statCardOrange: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#f0ad4e', borderRadius: '0 4px 4px 0' } },
  
  statLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#707070',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#333333',
    lineHeight: 1.2
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e0e4ea',
    padding: '1.5rem',
    marginBottom: '1.5rem'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#333',
    margin: '0 0 1rem 0'
  }
});

export default function ProcDashboard() {
  const classes = useStyles();
  const { purchaseOrders, tenders } = useOutletContext();

  return (
    <div className={classes.dashboardContainer}>
      <div className={classes.statsGrid}>
        <div className={`${classes.statCard} ${classes.statCardOrange}`}>
          <div className={classes.statLabel}>
            <Package size={16} /> Pending Approvals
          </div>
          <div className={classes.statValue}>
            {purchaseOrders?.filter(p => p.status === 'Pending Approval').length || 0}
          </div>
        </div>
        
        <div className={`${classes.statCard} ${classes.statCardGreen}`}>
          <div className={classes.statLabel}>
            <Truck size={16} /> Approved POs
          </div>
          <div className={classes.statValue}>
            {purchaseOrders?.filter(p => p.status === 'Approved').length || 0}
          </div>
        </div>
        
        <div className={`${classes.statCard} ${classes.statCardBlue}`}>
          <div className={classes.statLabel}>
            <FileText size={16} /> Active Tenders
          </div>
          <div className={classes.statValue}>
            {tenders?.filter(t => t.status === 'Open').length || 0}
          </div>
        </div>

        <div className={`${classes.statCard} ${classes.statCardRed}`}>
          <div className={classes.statLabel}>
            <Activity size={16} /> Bids Received
          </div>
          <div className={classes.statValue}>
            0
          </div>
        </div>
      </div>

      <div className={classes.card}>
        <h3 className={classes.cardTitle}>Recent Activity</h3>
        <p style={{ color: '#707070', fontSize: '0.9rem' }}>Welcome to the EduOne Procurement Portal. Navigate to the Tenders Manager or Purchase Orders from the sidebar to manage your procurement lifecycle.</p>
      </div>
    </div>
  );
}
