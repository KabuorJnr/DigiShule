import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createUseStyles } from 'react-jss';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Package, Truck, FileText, Send, Plus, CheckCircle, XCircle } from 'lucide-react';

const useStyles = createUseStyles({
  veribidContainer: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    color: '#1a1a2e'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statCard: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e0e4ea',
    padding: '1rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    transition: 'box-shadow 0.2s',
    '&:hover': {
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
    }
  },
  statCardGreen: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#006233', borderRadius: '0 4px 4px 0' } },
  statCardBlue: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0056b3', borderRadius: '0 4px 4px 0' } },
  statCardRed: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#BB0000', borderRadius: '0 4px 4px 0' } },
  statCardOrange: { '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#f0ad4e', borderRadius: '0 4px 4px 0' } },
  
  statLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#777',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1a1a2e',
    lineHeight: 1.2
  },

  card: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e0e4ea',
    overflow: 'hidden',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  cardHeader: {
    padding: '0.8rem 1.1rem',
    borderBottom: '1px solid #eee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fafbfc'
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0
  },
  
  btnPrimary: { background: '#006233', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } },
  btnDanger: { background: '#BB0000', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } },
  btnGhost: { background: 'transparent', color: '#006233', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #ddd', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { background: '#f0faf4' } },

  dataTable: {
    width: '100%',
    fontSize: '0.82rem',
    borderCollapse: 'collapse',
    '& thead': { background: '#fafbfc', borderBottom: '2px solid #e0e4ea' },
    '& th': { padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
    '& td': { padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
    '& tbody tr': { transition: 'background 0.1s' },
    '& tbody tr:hover': { background: '#f8fdf9' }
  },

  badge: { display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' },
  badgeOpen: { background: '#cce5ff', color: '#004085' },
  badgeApproved: { background: '#d4edda', color: '#155724' },
  badgePending: { background: '#fff3cd', color: '#856404' },
  badgeRejected: { background: '#f8d7da', color: '#721c24' },
});

export default function ProcurementTab() {
  const classes = useStyles();
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});

  const purchaseOrders = store?.purchaseOrders || [];
  const tenders = store?.tenders || [];
  const setPurchaseOrders = store?.setPurchaseOrders || (() => {});
  const setTenders = store?.setTenders || (() => {});

  const [selectedPO, setSelectedPO] = useState(null);
  
  // Tender Form State
  const [showTenderForm, setShowTenderForm] = useState(false);
  const [tenderForm, setTenderForm] = useState({ title: '', description: '', deadline: '' });

  const handleApprove = async (id) => {
    if (!confirm('Approve this Purchase Order?')) return;
    try {
      const po = purchaseOrders.find(p => p.id === id);
      const updatedPo = { ...po, status: 'Approved' };
      await upsertRow('purchase_orders', updatedPo);

      setPurchaseOrders(prev => prev.map(p => p.id === id ? updatedPo : p));
      notify('Purchase Order Approved', 'success');
      addAuditLog('PO Approved', `Approved PO to ${po.vendor}`, po.amount);
    } catch(e) {
      notify(e.message, 'error');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const po = purchaseOrders.find(p => p.id === id);
      const updatedPo = { ...po, status: 'Rejected' };
      await upsertRow('purchase_orders', updatedPo);

      setPurchaseOrders(prev => prev.map(p => p.id === id ? updatedPo : p));
      notify('Purchase Order Rejected', 'error');
      addAuditLog('PO Rejected', `Rejected PO to ${po.vendor}. Reason: ${reason}`);
    } catch(e) {
      notify(e.message, 'error');
    }
  };

  const handlePublishTender = async (e) => {
    e.preventDefault();
    if(!tenderForm.title || !tenderForm.deadline) return notify('Title and deadline are required.', 'error');

    try {
      const newTender = {
        id: `tnd_${Date.now()}`,
        title: tenderForm.title,
        description: tenderForm.description,
        deadline: tenderForm.deadline,
        status: 'Open',
        published: true
      };

      await upsertRow('tenders', newTender);
      setTenders([newTender, ...tenders]);
      notify('Tender Published Successfully', 'success');
      addAuditLog('Tender Published', `Published tender: ${newTender.title}`);
      setShowTenderForm(false);
      setTenderForm({ title: '', description: '', deadline: '' });
    } catch(e) {
      notify(e.message, 'error');
    }
  };

  const getBadgeClass = (status) => {
    switch(status) {
      case 'Approved': return classes.badgeApproved;
      case 'Pending Approval': return classes.badgePending;
      case 'Rejected': return classes.badgeRejected;
      case 'Open': return classes.badgeOpen;
      default: return classes.badgePending;
    }
  };

  return (
    <div className={classes.veribidContainer}>
      <div className={classes.statsGrid}>
        <div className={`${classes.statCard} ${classes.statCardOrange}`}>
          <div className={classes.statLabel}>
            <Package size={14} /> Pending Approvals
          </div>
          <div className={classes.statValue}>
            {purchaseOrders.filter(p => p.status === 'Pending Approval').length}
          </div>
        </div>
        
        <div className={`${classes.statCard} ${classes.statCardGreen}`}>
          <div className={classes.statLabel}>
            <Truck size={14} /> Approved POs
          </div>
          <div className={classes.statValue}>
            {purchaseOrders.filter(p => p.status === 'Approved').length}
          </div>
        </div>
        
        <div className={`${classes.statCard} ${classes.statCardBlue}`}>
          <div className={classes.statLabel}>
            <FileText size={14} /> Active Tenders
          </div>
          <div className={classes.statValue}>
            {tenders.filter(t => t.status === 'Open').length}
          </div>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.cardHeader}>
          <h2 className={classes.cardTitle}>Purchase Orders</h2>
          <button className={classes.btnPrimary} onClick={() => notify('Create PO form would open here')}>
            <Plus size={16} /> New PO
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.dataTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>PO ID</th>
                <th>Vendor</th>
                <th>Items / Description</th>
                <th>Requested By</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#999' }}>No Purchase Orders found.</td></tr>
              )}
              {purchaseOrders.map(po => (
                <tr key={po.id}>
                  <td style={{ color: '#555' }}>{po.date}</td>
                  <td style={{ color: '#999', fontSize: '0.75rem' }}>{po.id}</td>
                  <td style={{ fontWeight: 600, color: '#0056b3' }}>{po.vendor}</td>
                  <td>{po.items}</td>
                  <td style={{ color: '#555' }}>{po.requested_by}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(po.amount)}</td>
                  <td>
                    <span className={`${classes.badge} ${getBadgeClass(po.status)}`}>{po.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {po.status === 'Pending Approval' && user?.role === 'finance' && (
                        <>
                          <button className={classes.btnGhost} style={{ background: '#d4edda', borderColor: '#c3e6cb', color: '#155724' }} onClick={() => handleApprove(po.id)}>
                            <CheckCircle size={14} />
                          </button>
                          <button className={classes.btnGhost} style={{ background: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' }} onClick={() => handleReject(po.id)}>
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      <button className={classes.btnGhost} onClick={() => setSelectedPO(po)}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.cardHeader}>
          <h2 className={classes.cardTitle}>Tenders & Procurement Bids</h2>
          <button className={classes.btnPrimary} onClick={() => setShowTenderForm(true)}>
            <Send size={16} /> Publish Tender
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.dataTable}>
            <thead>
              <tr>
                <th>Tender ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenders.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#999' }}>No Tenders published yet.</td></tr>
              )}
              {tenders.map(tnd => (
                <tr key={tnd.id}>
                  <td style={{ color: '#999', fontSize: '0.75rem' }}>{tnd.id}</td>
                  <td style={{ fontWeight: 600, color: '#0056b3' }}>{tnd.title}</td>
                  <td>{tnd.description}</td>
                  <td style={{ color: '#555' }}>{tnd.deadline}</td>
                  <td>
                    <span className={`${classes.badge} ${getBadgeClass(tnd.status)}`}>{tnd.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPO && (
        <Modal title={`PO Details - ${selectedPO.id}`} onClose={() => setSelectedPO(null)} footer={
          <button className="btn" onClick={() => setSelectedPO(null)}>Close</button>
        }>
          <div style={{ padding: '8px 0', fontSize: '0.9rem', color: '#1a1a2e' }}>
            <p style={{ marginBottom: 8 }}><strong>Vendor:</strong> {selectedPO.vendor}</p>
            <p style={{ marginBottom: 8 }}><strong>Items:</strong> {selectedPO.items}</p>
            <p style={{ marginBottom: 8 }}><strong>Amount:</strong> {fmtKES(selectedPO.amount)}</p>
            <p style={{ marginBottom: 8 }}><strong>Requested By:</strong> {selectedPO.requested_by}</p>
            <p style={{ marginBottom: 8 }}>
              <strong>Status:</strong> <span className={`${classes.badge} ${getBadgeClass(selectedPO.status)}`}>{selectedPO.status}</span>
            </p>
          </div>
        </Modal>
      )}

      {showTenderForm && (
        <Modal title="Publish New Tender" onClose={() => setShowTenderForm(false)}>
          <form onSubmit={handlePublishTender}>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>Tender Title</label>
              <input className="input" required value={tenderForm.title} onChange={e => setTenderForm({...tenderForm, title: e.target.value})} placeholder="e.g. Supply of Term 3 Textbooks" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>Description / Requirements</label>
              <textarea className="input" rows="4" value={tenderForm.description} onChange={e => setTenderForm({...tenderForm, description: e.target.value})} placeholder="Detailed requirements..." />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="field-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>Submission Deadline</label>
              <input type="date" className="input" required value={tenderForm.deadline} onChange={e => setTenderForm({...tenderForm, deadline: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className={classes.btnGhost} onClick={() => setShowTenderForm(false)}>Cancel</button>
              <button type="submit" className={classes.btnPrimary}>Publish Tender</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
