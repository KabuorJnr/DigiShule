import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import { fetchTable, upsertRow } from '../lib/api';
import Modal from '../components/Modal';
import { LEAVE_REQUESTS as SEED_LEAVE } from '../data/seed';

const STATUS_COLOR = { Present: 'green', Absent: 'red', 'On Leave': 'amber' };
const LEAVE_COLOR = { Approved: 'green', Pending: 'amber', Rejected: 'red' };

export default function StaffAttendance({ store, user }) {
  const { notify } = store;
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState('attendance');
  const [leaveRequests, setLeaveRequests] = useState(SEED_LEAVE);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });

  const canApprove = user && (user.role === 'principal' || user.role === 'deputy_admin' || user.role === 'deputy_academic');

  useEffect(() => {
    fetchTable('staff')
      .then((rows) => setStaff(rows
        .map((s) => ({ ...s, checkIn: s.check_in }))
        .sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => notify(`Failed to load staff: ${e.message}`, 'error'));
  }, [notify]);

  const totals = useMemo(() => ({
    total: staff.length,
    present: staff.filter((s) => s.status === 'Present').length,
    absent: staff.filter((s) => s.status === 'Absent').length,
    leave: staff.filter((s) => s.status === 'On Leave').length,
  }), [staff]);

  const leaveTotals = useMemo(() => ({
    total: leaveRequests.length,
    pending: leaveRequests.filter(l => l.status === 'Pending').length,
    approved: leaveRequests.filter(l => l.status === 'Approved').length,
    rejected: leaveRequests.filter(l => l.status === 'Rejected').length,
  }), [leaveRequests]);

  const toggleStatus = async (id) => {
    const member = staff.find((s) => s.id === id);
    if (!member) return;
    const cycle = ['Present', 'Absent', 'On Leave'];
    const next = cycle[(cycle.indexOf(member.status) + 1) % cycle.length];
    const updated = { ...member, status: next };
    try {
      await upsertRow('staff', {
        id: updated.id, name: updated.name, role: updated.role,
        dept: updated.dept, status: updated.status, check_in: updated.checkIn,
      });
    } catch (e) {
      notify(`Could not update status: ${e.message}`, 'error');
      return;
    }
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify('Staff status updated.', 'info', 'Attendance');
  };

  const handleLeaveAction = (id, action) => {
    setLeaveRequests(prev => prev.map(l =>
      l.id === id ? { ...l, status: action, approvedBy: user?.name || 'Admin' } : l
    ));
    notify(`Leave request ${action.toLowerCase()}`, action === 'Approved' ? 'success' : 'warning', 'Leave');
  };

  const submitLeave = () => {
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason) {
      notify('Please fill all fields', 'warning', 'Leave');
      return;
    }
    const start = new Date(leaveForm.start);
    const end = new Date(leaveForm.end);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const newReq = {
      id: `lr${Date.now()}`,
      staff: user?.name || 'Staff Member',
      dept: user?.dept || 'Department',
      type: leaveForm.type,
      start: leaveForm.start,
      end: leaveForm.end,
      days,
      reason: leaveForm.reason,
      status: 'Pending',
      approvedBy: null,
      date: new Date().toISOString().slice(0, 10),
    };
    setLeaveRequests(prev => [newReq, ...prev]);
    setShowLeaveModal(false);
    setLeaveForm({ type: 'Annual', start: '', end: '', reason: '' });
    notify('Leave request submitted successfully', 'success', 'Leave');
  };

  const shown = filter === 'All' ? staff : staff.filter((s) => s.status === filter);

  return (
    <div>
      <PageHeader title="Staff Management" subtitle={`Today — ${new Date().toDateString()}`} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button className={`tab${tab === 'attendance' ? ' active' : ''}`} onClick={() => setTab('attendance')}>
          👥 Attendance
        </button>
        <button className={`tab${tab === 'leave' ? ' active' : ''}`} onClick={() => setTab('leave')}>
          📋 Leave Requests
          {leaveTotals.pending > 0 && <Badge color="amber" style={{ marginLeft: 8 }}>{leaveTotals.pending}</Badge>}
        </button>
      </div>

      {tab === 'attendance' && (
        <>
          <div className="stat-tiles">
            <KpiCard icon="👥" label="Total Staff" value={totals.total} />
            <KpiCard icon="✅" label="Present" value={totals.present} accent="#10B981" />
            <KpiCard icon="❌" label="Absent" value={totals.absent} accent="#EF4444" />
            <KpiCard icon="📋" label="On Leave" value={totals.leave} accent="#F59E0B" />
          </div>

          <div className="card card-pad">
            <div className="toolbar" style={{ marginBottom: 14 }}>
              {['All', 'Present', 'Absent', 'On Leave'].map((f) => (
                <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Department</th><th>Check-In</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.role}</td>
                      <td className="muted">{s.dept}</td>
                      <td>{s.checkIn}</td>
                      <td><Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge></td>
                      <td><button className="btn btn-sm" onClick={() => toggleStatus(s.id)}>Change</button></td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No staff matching this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'leave' && (
        <>
          <div className="stat-tiles">
            <KpiCard icon="📋" label="Total Requests" value={leaveTotals.total} />
            <KpiCard icon="⏳" label="Pending" value={leaveTotals.pending} accent="#F59E0B" />
            <KpiCard icon="✅" label="Approved" value={leaveTotals.approved} accent="#10B981" />
            <KpiCard icon="❌" label="Rejected" value={leaveTotals.rejected} accent="#EF4444" />
          </div>

          <div className="card card-pad">
            <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Leave Requests</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveModal(true)}>
                + Apply for Leave
              </button>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Staff</th><th>Type</th><th>Duration</th><th>Days</th><th>Reason</th><th>Status</th>{canApprove && <th>Action</th>}</tr>
                </thead>
                <tbody>
                  {leaveRequests.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.staff}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{l.dept}</div>
                      </td>
                      <td><Badge color={l.type === 'Sick' ? 'red' : l.type === 'Emergency' ? 'amber' : 'blue'}>{l.type}</Badge></td>
                      <td className="muted" style={{ fontSize: 12 }}>{l.start} → {l.end}</td>
                      <td style={{ fontWeight: 600 }}>{l.days}</td>
                      <td style={{ maxWidth: 200, fontSize: 12 }}>{l.reason}</td>
                      <td><Badge color={LEAVE_COLOR[l.status]}>{l.status}</Badge></td>
                      {canApprove && (
                        <td>
                          {l.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-success" onClick={() => handleLeaveAction(l.id, 'Approved')}>✓</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleLeaveAction(l.id, 'Rejected')}>✕</button>
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>{l.approvedBy}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showLeaveModal && (
        <Modal title="Apply for Leave" onClose={() => setShowLeaveModal(false)}
          footer={
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitLeave}>Submit Request</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Leave Type *</label>
              <select className="select" value={leaveForm.type} onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}>
                <option>Annual</option>
                <option>Sick</option>
                <option>Personal</option>
                <option>Emergency</option>
                <option>Maternity</option>
                <option>Paternity</option>
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Start Date *</label>
                <input type="date" className="input" value={leaveForm.start} onChange={e => setLeaveForm(p => ({ ...p, start: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">End Date *</label>
                <input type="date" className="input" value={leaveForm.end} onChange={e => setLeaveForm(p => ({ ...p, end: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Reason *</label>
              <textarea className="input" rows={3} placeholder="Describe the reason for leave..." value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, fontSize: 13, color: '#0369a1' }}>
              ℹ️ Leave requests are reviewed by the Deputy Admin or Principal. You will be notified once a decision is made.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
