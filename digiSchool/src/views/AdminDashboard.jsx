import { useState, useEffect } from 'react';
import { Badge, ProgressBar } from '../components/widgets';
import { STAFF, FACILITIES, DISCIPLINARY_RECORDS, fmtKES } from '../data/modules';
import { LEAVE_REQUESTS } from '../data/seed';
import Modal from '../components/Modal';
import { fetchTable, upsertRow } from '../lib/api';

function Stat({ label, value, color, sub }) {
  return (
    <div className="card card-pad">
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', marginBottom: 2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard({ store, user }) {
  const { navigate, notify } = store;
  const [disciplineModal, setDisciplineModal] = useState(null);
  const [leaveActions, setLeaveActions] = useState({});
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    fetchTable('expenses').then(setExpenses).catch(() => {});
  }, []);

  const presentStaff = STAFF.filter(s => s.status === 'Present').length;
  const operationalFac = FACILITIES.filter(f => f.status === 'Operational').length;
  const pendingLeave = LEAVE_REQUESTS.filter(l => l.status === 'Pending').length;
  const openDiscipline = DISCIPLINARY_RECORDS.filter(d => d.status === 'Open').length;

  const handleLeaveAction = (id, action) => {
    setLeaveActions(prev => ({ ...prev, [id]: action }));
    notify(`Leave request ${action.toLowerCase()}`, action === 'Approved' ? 'success' : 'warning', 'Leave');
  };

  const handleExpenseAction = async (expense, action) => {
    try {
      const updated = { ...expense, status: action };
      await upsertRow('expenses', updated);
      setExpenses(prev => prev.map(e => e.id === expense.id ? updated : e));
      notify(`Expense ${action.toLowerCase()} successfully.`);
    } catch (e) {
      notify(`Failed to update expense: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Deputy Admin Dashboard</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Administration overview — student affairs, facilities, staff welfare</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('notices')}>Post Notice</button>
      </div>

      <div style={{ background: '#0f766e', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Administration Office</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
            Managing discipline, boarding, facilities, and staff welfare
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, opacity: 0.9 }}>
          <div>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>Term 2 · Academic Year 2026</div>
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="Total Staff" value={STAFF.length} sub={`${presentStaff} present today`} color="#0f766e" />
        <Stat label="Leave Requests" value={pendingLeave} sub="Pending approval" color="#FFB900" />
        <Stat label="Discipline Cases" value={openDiscipline} sub="Open cases" color="#D13438" />
        <Stat label="Facilities" value={`${operationalFac}/${FACILITIES.length}`} sub="Operational" color="#107C10" />
      </div>

      {/* Quick Actions */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('staff')}>Staff Attendance</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('facilities')}>Facilities Management</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>Student Records</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('notices')}>Post Notice</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('finance')}>Finance Overview</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('clinic')}>Health / Clinic</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('library')}>Library</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('settings')}>Settings</button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* Discipline Cases */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e' }}>Discipline Cases</h3>
          {DISCIPLINARY_RECORDS.map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setDisciplineModal(d)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.student} — {d.category}</div>
                <div className="muted" style={{ fontSize: 12 }}>{d.description}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{d.date} · {d.class}</div>
              </div>
              <Badge color={d.status === 'Open' ? 'red' : 'green'}>{d.status}</Badge>
            </div>
          ))}
        </div>

        {/* Facilities */}
        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#0f766e' }}>Facilities Overview</h3>
          {FACILITIES.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{f.type} · Capacity: {f.capacity}</div>
              </div>
              <Badge color={f.status === 'Operational' ? 'green' : 'amber'}>{f.status}</Badge>
            </div>
          ))}
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('facilities')}>
            Manage Facilities
          </button>
        </div>
      </div>

      {/* Leave Requests & Expense Approvals */}
      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, color: '#0f766e' }}>Pending Leave Requests</h3>
            <button className="btn btn-sm" onClick={() => navigate('staff')}>Manage Leave</button>
          </div>
          {LEAVE_REQUESTS.filter(l => l.status === 'Pending').map(l => {
            const action = leaveActions[l.id];
            return (
              <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{l.staff} — {l.type} Leave</div>
                  <div className="muted" style={{ fontSize: 12 }}>{l.start} to {l.end} ({l.days} days)</div>
                  <div className="muted" style={{ fontSize: 11 }}>{l.reason}</div>
                </div>
                {action ? (
                  <Badge color={action === 'Approved' ? 'green' : 'red'}>{action}</Badge>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-success" onClick={() => handleLeaveAction(l.id, 'Approved')}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleLeaveAction(l.id, 'Rejected')}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
          {LEAVE_REQUESTS.filter(l => l.status === 'Pending').length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No pending requests</p>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, color: '#dc2626' }}>Pending Expense Approvals</h3>
            <button className="btn btn-sm" onClick={() => navigate('finance')}>Finance Module</button>
          </div>
          {expenses.filter(e => e.status === 'Pending').map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{e.category} <span className="muted" style={{ fontWeight: 400 }}>via {e.requested_by}</span></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{fmtKES(e.amount)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{e.description}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn btn-sm btn-success" onClick={() => handleExpenseAction(e, 'Approved')}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleExpenseAction(e, 'Rejected')}>Reject</button>
              </div>
            </div>
          ))}
          {expenses.filter(e => e.status === 'Pending').length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No pending expenses</p>
          )}
        </div>
      </div>

      {/* Discipline Modal */}
      {disciplineModal && (
        <Modal title="Discipline Case Details" onClose={() => setDisciplineModal(null)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setDisciplineModal(null)}>Close</button>
            {disciplineModal.status === 'Open' && (
              <button className="btn btn-primary" onClick={() => { setDisciplineModal(null); notify('Case marked as resolved', 'success'); }}>Mark Resolved</button>
            )}
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><span className="field-label">Student</span><div style={{ fontWeight: 600 }}>{disciplineModal.student}</div></div>
            <div><span className="field-label">Class</span><div>{disciplineModal.class}</div></div>
            <div><span className="field-label">Category</span><div><Badge color="red">{disciplineModal.category}</Badge></div></div>
            <div><span className="field-label">Date</span><div>{disciplineModal.date}</div></div>
            <div><span className="field-label">Description</span><div style={{ lineHeight: 1.5 }}>{disciplineModal.description}</div></div>
            <div><span className="field-label">Action Taken</span><div>{disciplineModal.action || 'Pending review'}</div></div>
            <div><span className="field-label">Status</span><div><Badge color={disciplineModal.status === 'Open' ? 'red' : 'green'}>{disciplineModal.status}</Badge></div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
