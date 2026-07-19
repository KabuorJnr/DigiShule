import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { Package, Truck } from 'lucide-react';

export default function ProcurementTab() {
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});

  const [procurements, setProcurements] = useState([
    { id: 'po_001', date: '2026-07-10', vendor: 'TextBook Centre', items: 'Term 3 Textbooks', amount: 450000, status: 'Pending Approval', requested_by: 'Library Dept' },
    { id: 'po_002', date: '2026-07-12', vendor: 'Kensalt', items: 'Kitchen Supplies (Salt, Spices)', amount: 15000, status: 'Approved', requested_by: 'Kitchen Dept' },
    { id: 'po_003', date: '2026-07-15', vendor: 'Simba Coach', items: 'Transport for Academic Trip', amount: 80000, status: 'Pending Approval', requested_by: 'Deputy Academics' },
  ]);

  const [selectedPO, setSelectedPO] = useState(null);

  const handleApprove = (id) => {
    if (!confirm('Approve this Purchase Order?')) return;
    const po = procurements.find(p => p.id === id);
    setProcurements(prev => prev.map(p => p.id === id ? { ...p, status: 'Approved' } : p));
    notify('Purchase Order Approved', 'success');
    addAuditLog('PO Approved', `Approved PO to ${po.vendor}`, po.amount);
  };

  const handleReject = (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    const po = procurements.find(p => p.id === id);
    setProcurements(prev => prev.map(p => p.id === id ? { ...p, status: 'Rejected' } : p));
    notify('Purchase Order Rejected', 'error');
    addAuditLog('PO Rejected', `Rejected PO to ${po.vendor}. Reason: ${reason}`);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: 12, borderRadius: 8 }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Approvals</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {procurements.filter(p => p.status === 'Pending Approval').length}
            </div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#F0FDF4', color: '#10B981', padding: 12, borderRadius: 8 }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Approved POs (This Month)</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {procurements.filter(p => p.status === 'Approved').length}
            </div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#FEF2F2', color: '#EF4444', padding: 12, borderRadius: 8 }}>
            <span style={{ fontWeight: 'bold', fontSize: 20 }}>KES</span>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Pending Value</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {fmtKES(procurements.filter(p => p.status === 'Pending Approval').reduce((s, p) => s + p.amount, 0))}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
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
              {procurements.map(po => (
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
    </div>
  );
}
