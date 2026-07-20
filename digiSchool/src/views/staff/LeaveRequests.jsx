import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { KpiCard, Badge } from '../../components/widgets';
import { Icon } from '../../components/icons';
import { upsertRow } from '../../lib/api';
import Modal from '../../components/Modal';

const LEAVE_COLOR = { Approved: 'green', Pending: 'amber', Rejected: 'red' };

export default function LeaveRequests() {
  const { store, user, canApprove, leaveRequests, setLeaveRequests } = useOutletContext();
  const { notify } = store;

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);

  const leaveTotals = useMemo(() => ({
    total: leaveRequests.length,
    pending: leaveRequests.filter(l => l.status === 'Pending').length,
    approved: leaveRequests.filter(l => l.status === 'Approved').length,
    rejected: leaveRequests.filter(l => l.status === 'Rejected').length,
  }), [leaveRequests]);

  const handleLeaveAction = async (id, action) => {
    const updated = { status: action, approved_by: user?.name || 'Admin' };
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l));
    try {
      const leaveRow = leaveRequests.find(l => l.id === id);
      if (leaveRow) await upsertRow('leave_requests', { ...leaveRow, ...updated });
    } catch (e) { console.warn('Failed to persist leave action:', e.message); }
    notify(`Leave request ${action.toLowerCase()}`, action === 'Approved' ? 'success' : 'warning', 'Leave');
  };

  const submitLeave = async () => {
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason) {
      notify('Please fill all fields', 'warning', 'Leave');
      return;
    }
    const start = new Date(leaveForm.start);
    const end = new Date(leaveForm.end);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    setLeaveSaving(true);
    try {
      const newReq = {
        id: `lr_${Date.now()}`, staff_name: user?.name || 'Staff Member', staff_id: user?.id || null, dept: user?.dept || 'Department',
        type: leaveForm.type, start_date: leaveForm.start, end_date: leaveForm.end, days, reason: leaveForm.reason,
        status: 'Pending', approved_by: null, created_at: new Date().toISOString(),
      };
      await upsertRow('leave_requests', newReq);
      setLeaveRequests(prev => [newReq, ...prev]);
      setShowLeaveModal(false);
      setLeaveForm({ type: 'Annual', start: '', end: '', reason: '' });
      notify('Leave request submitted successfully', 'success', 'Leave');
    } catch (e) {
      notify(`Failed to submit leave: ${e.message}`, 'error', 'Leave');
    } finally { setLeaveSaving(false); }
  };

  return (
    <>
      <div className="stat-tiles">
        <KpiCard iconComponent={<Icon name="clipboard" size={24} />} label="Total Requests" value={leaveTotals.total} />
        <KpiCard iconComponent={<Icon name="clock" size={24} />} label="Pending" value={leaveTotals.pending} accent="#F59E0B" />
        <KpiCard iconComponent={<Icon name="check" size={24} />} label="Approved" value={leaveTotals.approved} accent="#047857" />
        <KpiCard iconComponent={<Icon name="x" size={24} />} label="Rejected" value={leaveTotals.rejected} accent="#EF4444" />
      </div>

      <div className="card card-pad">
        <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Leave Requests</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveModal(true)}>+ Apply for Leave</button>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Staff</th><th>Type</th><th>Duration</th><th>Days</th><th>Reason</th><th>Status</th>{canApprove && <th>Action</th>}</tr></thead>
            <tbody>
              {leaveRequests.map(l => (
                <tr key={l.id}>
                  <td><div style={{ fontWeight: 600 }}>{l.staff_name || l.staff}</div><div className="muted" style={{ fontSize: 11 }}>{l.dept}</div></td>
                  <td><Badge color={l.type === 'Sick' ? 'red' : l.type === 'Emergency' ? 'amber' : 'blue'}>{l.type}</Badge></td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.start_date || l.start} \u2192 {l.end_date || l.end}</td>
                  <td style={{ fontWeight: 600 }}>{l.days}</td>
                  <td style={{ maxWidth: 200, fontSize: 12 }}>{l.reason}</td>
                  <td><Badge color={LEAVE_COLOR[l.status]}>{l.status}</Badge></td>
                  {canApprove && (
                    <td>
                      {l.status === 'Pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-success" onClick={() => handleLeaveAction(l.id, 'Approved')}><Icon name="check" size={14} /></button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleLeaveAction(l.id, 'Rejected')}><Icon name="close" size={14} /></button>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>{l.approved_by || l.approvedBy}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showLeaveModal && (
        <Modal title="Apply for Leave" onClose={() => setShowLeaveModal(false)} footer={
          <div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setShowLeaveModal(false)}>Cancel</button><button className="btn btn-primary" onClick={submitLeave} disabled={leaveSaving}>{leaveSaving ? 'Submitting...' : 'Submit Request'}</button></div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Leave Type *</label>
              <select className="select" value={leaveForm.type} onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}>
                <option>Annual</option><option>Sick</option><option>Personal</option><option>Emergency</option><option>Maternity</option><option>Paternity</option>
              </select>
            </div>
            <div className="grid grid-2">
              <div><label className="field-label">Start Date *</label><input type="date" className="input" value={leaveForm.start} onChange={e => setLeaveForm(p => ({ ...p, start: e.target.value }))} /></div>
              <div><label className="field-label">End Date *</label><input type="date" className="input" value={leaveForm.end} onChange={e => setLeaveForm(p => ({ ...p, end: e.target.value }))} /></div>
            </div>
            <div><label className="field-label">Reason *</label><textarea className="input" rows={3} placeholder="Describe the reason for leave..." value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} /></div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, fontSize: 13, color: '#0369a1' }}>
              â„¹ï¸ Leave requests are reviewed by the Deputy Admin or Principal. You will be notified once a decision is made.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}



