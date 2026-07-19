import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';

export default function PayrollTab() {
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});
  
  // Fake payroll data for now (since we don't have a full payroll system)
  // In a real system, this would be fetched from `store.payrolls`
  const [payrolls, setPayrolls] = useState([
    { id: 'pr_001', month: '2026-06', totalGross: 1250000, totalDeductions: 350000, totalNet: 900000, status: 'Paid', staffCount: 45, generated_by: 'System' },
    { id: 'pr_002', month: '2026-07', totalGross: 1250000, totalDeductions: 350000, totalNet: 900000, status: 'Pending', staffCount: 45, generated_by: 'System' },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  const pendingPayroll = payrolls.find(p => p.status === 'Pending');

  const handleApprove = async (id) => {
    if (!confirm('Are you sure you want to approve this payroll for payment?')) return;
    
    const pr = payrolls.find(p => p.id === id);
    const updated = payrolls.map(p => 
      p.id === id ? { ...p, status: 'Approved', approved_by: user?.name, approved_at: new Date().toISOString() } : p
    );
    setPayrolls(updated);
    notify(`Payroll for ${pr.month} approved successfully.`, 'success');
    addAuditLog('Payroll Approved', `Approved payroll for ${pr.month}`, pr.totalGross);
  };

  const handlePay = async (id) => {
    const pr = payrolls.find(p => p.id === id);
    const updated = payrolls.map(p => 
      p.id === id ? { ...p, status: 'Paid', paid_by: user?.name, paid_at: new Date().toISOString() } : p
    );
    setPayrolls(updated);
    notify(`Payroll for ${pr.month} marked as Paid.`, 'success');
    addAuditLog('Payroll Paid', `Disbursed payroll for ${pr.month}`, pr.totalNet);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #3B82F6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Month Gross</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(payrolls[0]?.totalGross || 0)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #10B981' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Net Payout</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#10B981' }}>{fmtKES(payrolls[0]?.totalNet || 0)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Staff on Payroll</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{payrolls[0]?.staffCount || 0}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #8B5CF6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ marginTop: 8 }}>
            <Badge color={pendingPayroll ? 'amber' : 'green'}>
              {pendingPayroll ? 'Pending Approval' : 'Up to Date'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">Payroll Runs</div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Staff Count</th>
                <th style={{ textAlign: 'right' }}>Gross Pay</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net Pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map(pr => (
                <tr key={pr.id}>
                  <td style={{ fontWeight: 600 }}>{pr.month}</td>
                  <td>{pr.staffCount}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(pr.totalGross)}</td>
                  <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmtKES(pr.totalDeductions)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmtKES(pr.totalNet)}</td>
                  <td>
                    <Badge color={pr.status === 'Paid' ? 'green' : pr.status === 'Approved' ? 'blue' : 'amber'}>
                      {pr.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {pr.status === 'Pending' && user?.role === 'finance' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleApprove(pr.id)}>Approve</button>
                      )}
                      {pr.status === 'Approved' && user?.role === 'finance' && (
                        <button className="btn btn-sm" style={{ background: '#10B981', color: 'white', borderColor: '#10B981' }} onClick={() => handlePay(pr.id)}>Mark Paid</button>
                      )}
                      <button className="btn btn-sm" onClick={() => setSelectedPayroll(pr)}>View Details</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayroll && (
        <Modal title={`Payroll Details - ${selectedPayroll.month}`} onClose={() => setSelectedPayroll(null)} wide footer={
          <button className="btn" onClick={() => setSelectedPayroll(null)}>Close</button>
        }>
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <div>Detailed employee-level payslips will appear here in a full deployment.</div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Total Gross: <strong>{fmtKES(selectedPayroll.totalGross)}</strong><br/>
              Total Deductions: <strong style={{ color: '#EF4444' }}>{fmtKES(selectedPayroll.totalDeductions)}</strong><br/>
              Total Net: <strong style={{ color: '#10B981' }}>{fmtKES(selectedPayroll.totalNet)}</strong>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
