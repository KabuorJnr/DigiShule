import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { BookOpen } from 'lucide-react';

export default function JournalTab() {
  const { store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});

  const [entries, setEntries] = useState([
    { id: 'JNL-001', date: '2026-07-18', description: 'Depreciation of Fixed Assets', debit_account: 'Depreciation Expense', credit_account: 'Accumulated Depreciation', amount: 150000, status: 'Pending Approval', preparer: 'Jane Smith' },
    { id: 'JNL-002', date: '2026-07-15', description: 'Accrual for Audit Fees', debit_account: 'Audit Fee Expense', credit_account: 'Accrued Expenses Liability', amount: 80000, status: 'Approved', preparer: 'Jane Smith' },
    { id: 'JNL-003', date: '2026-07-01', description: 'Prepaid Rent Amortization', debit_account: 'Rent Expense', credit_account: 'Prepaid Rent', amount: 120000, status: 'Approved', preparer: 'Michael Brown' },
  ]);

  const handleApprove = (id) => {
    if (!confirm('Approve this Journal Entry?')) return;
    const jnl = entries.find(j => j.id === id);
    setEntries(prev => prev.map(j => j.id === id ? { ...j, status: 'Approved' } : j));
    notify('Journal Entry Approved', 'success');
    addAuditLog('Journal Entry Approved', `Approved JNL ${jnl.id} - ${jnl.description}`, jnl.amount);
  };

  const handleReject = (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    const jnl = entries.find(j => j.id === id);
    setEntries(prev => prev.map(j => j.id === id ? { ...j, status: 'Rejected' } : j));
    notify('Journal Entry Rejected', 'error');
    addAuditLog('Journal Entry Rejected', `Rejected JNL ${jnl.id}. Reason: ${reason}`);
  };

  return (
    <div>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={20} color="#047857" />
            General Journal Entries
          </div>
          <button className="btn btn-primary" onClick={() => notify('New Journal Entry form would open here')}>New Entry</button>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry ID</th>
                <th>Description</th>
                <th>Account (Debit)</th>
                <th>Account (Credit)</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td className="muted">{entry.id}</td>
                  <td style={{ fontWeight: 600 }}>{entry.description}</td>
                  <td style={{ color: '#047857' }}>{entry.debit_account}</td>
                  <td style={{ color: '#EF4444' }}>{entry.credit_account}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(entry.amount)}</td>
                  <td>
                    <Badge color={entry.status === 'Approved' ? 'green' : entry.status === 'Rejected' ? 'red' : 'amber'}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {entry.status === 'Pending Approval' && user?.role === 'finance' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleApprove(entry.id)}>Approve</button>
                          <button className="btn btn-sm" style={{ color: '#EF4444' }} onClick={() => handleReject(entry.id)}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



