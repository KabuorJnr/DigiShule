import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Package, Truck, FileText, Send, Plus } from 'lucide-react';

export default function ProcurementTab() {
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

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: 12, borderRadius: 8 }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending PO Approvals</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {purchaseOrders.filter(p => p.status === 'Pending Approval').length}
            </div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#F0FDF4', color: '#10B981', padding: 12, borderRadius: 8 }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Approved POs</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {purchaseOrders.filter(p => p.status === 'Approved').length}
            </div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#FEF2F2', color: '#EF4444', padding: 12, borderRadius: 8 }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Active Tenders</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {tenders.filter(t => t.status === 'Open').length}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Purchase Orders</div>
          <button className="btn btn-primary" onClick={() => notify('Create PO form would open here')}>New PO</button>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>PO ID</th>
                <th>Vendor</th>
                <th>Items / Description</th>
                <th>Requested By</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Purchase Orders found.</td></tr>
              )}
              {purchaseOrders.map(po => (
                <tr key={po.id}>
                  <td>{po.date}</td>
                  <td className="muted">{po.id}</td>
                  <td style={{ fontWeight: 600 }}>{po.vendor}</td>
                  <td>{po.items}</td>
                  <td className="muted">{po.requested_by}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(po.amount)}</td>
                  <td>
                    <Badge color={po.status === 'Approved' ? 'green' : po.status === 'Rejected' ? 'red' : 'amber'}>
                      {po.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {po.status === 'Pending Approval' && user?.role === 'finance' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleApprove(po.id)}>Approve</button>
                          <button className="btn btn-sm" style={{ color: '#EF4444' }} onClick={() => handleReject(po.id)}>Reject</button>
                        </>
                      )}
                      <button className="btn btn-sm" onClick={() => setSelectedPO(po)}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Tenders & Procurement Bids</div>
          <button className="btn btn-primary" onClick={() => setShowTenderForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={16} /> Publish Tender
          </button>
        </div>

        <div className="scroll-x">
          <table className="table">
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
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Tenders published yet.</td></tr>
              )}
              {tenders.map(tnd => (
                <tr key={tnd.id}>
                  <td className="muted">{tnd.id}</td>
                  <td style={{ fontWeight: 600 }}>{tnd.title}</td>
                  <td>{tnd.description}</td>
                  <td>{tnd.deadline}</td>
                  <td>
                    <Badge color={tnd.status === 'Open' ? 'green' : 'gray'}>
                      {tnd.status}
                    </Badge>
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
          <div style={{ padding: '8px 0' }}>
            <p><strong>Vendor:</strong> {selectedPO.vendor}</p>
            <p><strong>Items:</strong> {selectedPO.items}</p>
            <p><strong>Amount:</strong> {fmtKES(selectedPO.amount)}</p>
            <p><strong>Requested By:</strong> {selectedPO.requested_by}</p>
            <p><strong>Status:</strong> {selectedPO.status}</p>
          </div>
        </Modal>
      )}

      {showTenderForm && (
        <Modal title="Publish New Tender" onClose={() => setShowTenderForm(false)}>
          <form onSubmit={handlePublishTender}>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Tender Title</label>
              <input className="input" required value={tenderForm.title} onChange={e => setTenderForm({...tenderForm, title: e.target.value})} placeholder="e.g. Supply of Term 3 Textbooks" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Description / Requirements</label>
              <textarea className="input" rows="4" value={tenderForm.description} onChange={e => setTenderForm({...tenderForm, description: e.target.value})} placeholder="Detailed requirements..." />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Submission Deadline</label>
              <input type="date" className="input" required value={tenderForm.deadline} onChange={e => setTenderForm({...tenderForm, deadline: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowTenderForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Publish Tender</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
