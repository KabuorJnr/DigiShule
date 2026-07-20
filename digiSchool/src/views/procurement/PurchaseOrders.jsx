import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createUseStyles } from 'react-jss';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Truck, Plus, Send } from 'lucide-react';

const useStyles = createUseStyles({
  veribidContainer: { fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif', color: '#1a1a2e' },
  card: { background: '#fff', borderRadius: '10px', border: '1px solid #e0e4ea', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  cardHeader: { padding: '0.8rem 1.1rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e', margin: 0 },
  btnPrimary: { background: '#006233', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' } },
  btnGhost: { background: 'transparent', color: '#006233', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.32rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #ddd', cursor: 'pointer', transition: 'all 0.15s', '&:hover': { background: '#f0faf4' } },
  dataTable: { width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', '& thead': { background: '#fafbfc', borderBottom: '2px solid #e0e4ea' }, '& th': { padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, '& td': { padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }, '& tbody tr:hover': { background: '#f8fdf9' } },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' },
  badgePending: { background: '#fff3cd', color: '#856404' },
  badgeApproved: { background: '#d4edda', color: '#155724' },
  badgeRejected: { background: '#f8d7da', color: '#721c24' },
});

export default function PurchaseOrders() {
  const classes = useStyles();
  const { purchaseOrders, setPurchaseOrders, addAuditLog, user } = useOutletContext();
  const [showPOModal, setShowPOModal] = useState(false);
  const [newPO, setNewPO] = useState({ vendor: '', items: '', amount: '' });

  const handleCreatePO = () => {
    if(!newPO.vendor || !newPO.amount) return;
    const po = {
      ...newPO,
      id: `po_${Date.now()}`,
      amount: Number(newPO.amount),
      status: 'Pending Approval',
      requested_by: user?.name || 'Procurement Officer',
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    
    setPurchaseOrders(prev => [po, ...prev]);
    upsertRow('purchase_orders', po).catch(() => {});
    addAuditLog('Created PO', `PO for ${po.vendor}`, po.amount);
    setNewPO({ vendor: '', items: '', amount: '' });
    setShowPOModal(false);
  };

  return (
    <div className={classes.veribidContainer}>
      <div className={classes.card}>
        <div className={classes.cardHeader}>
          <h3 className={classes.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={18} color="#0056b3" /> Purchase Orders</h3>
          <button className={classes.btnPrimary} onClick={() => setShowPOModal(true)}><Plus size={16} /> New PO</button>
        </div>
        <div style={{ padding: '0' }}>
          <table className={classes.dataTable}>
            <thead>
              <tr>
                <th>PO ID</th>
                <th>Vendor</th>
                <th>Items</th>
                <th>Requested By</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'monospace' }}>{po.id.substring(0,8)}</td>
                  <td style={{ fontWeight: 600 }}>{po.vendor}</td>
                  <td style={{ color: '#666', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{po.items}</td>
                  <td>{po.requested_by}</td>
                  <td style={{ fontWeight: 700 }}>{fmtKES(po.amount)}</td>
                  <td>
                    <span className={`${classes.badge} ${po.status === 'Approved' ? classes.badgeApproved : po.status === 'Rejected' ? classes.badgeRejected : classes.badgePending}`}>
                      {po.status}
                    </span>
                  </td>
                </tr>
              ))}
              {purchaseOrders.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No purchase orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPOModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowPOModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label>Vendor Name</label>
              <input type="text" value={newPO.vendor} onChange={e => setNewPO({...newPO, vendor: e.target.value})} className="input" placeholder="e.g. Text Book Centre" />
            </div>
            <div>
              <label>Items/Description</label>
              <input type="text" value={newPO.items} onChange={e => setNewPO({...newPO, items: e.target.value})} className="input" placeholder="e.g. 500x Exercise Books" />
            </div>
            <div>
              <label>Total Amount (KES)</label>
              <input type="number" value={newPO.amount} onChange={e => setNewPO({...newPO, amount: e.target.value})} className="input" placeholder="e.g. 25000" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleCreatePO}>Submit PO</button>
              <button className="btn btn-ghost" onClick={() => setShowPOModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
