import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import { Icon } from '../components/icons';
import { fetchTable, upsertRow } from '../lib/api';
import Modal from '../components/Modal';
import RegistrationLoadingModal from '../components/RegistrationLoadingModal';
import { generateSecurePassword, provisionAccount, generateSequentialUsername } from '../utils/auth';
import { secondaryAuthClient, supabase } from '../lib/supabaseClient';

const STATUS_COLOR = { Present: 'green', Absent: 'red', 'On Leave': 'amber' };
const LEAVE_COLOR = { Approved: 'green', Pending: 'amber', Rejected: 'red' };

export default function StaffAttendance({ store, user }) {
  const { notify } = store;
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState('attendance');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Messaging Staff
  const [composeModal, setComposeModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'Teacher', dept: '', subject: '', phone: '', empId: '' });
  const [provisionStep, setProvisionStep] = useState(null);

  // Recruitment State
  const [jobApps, setJobApps] = useState([]);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ date: '', time: '', type: 'In-person', notes: '' });
  const [selectedApp, setSelectedApp] = useState(null);

  const canApprove = user && (user.role === 'principal' || user.role === 'deputy_admin' || user.role === 'deputy_academic');

  useEffect(() => {
    fetchTable('staff')
      .then((rows) => setStaff(rows
        .map((s) => ({ ...s, checkIn: s.check_in }))
        .sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => notify(`Failed to load staff: ${e.message}`, 'error'));
      
    fetchTable('job_applications')
      .then((rows) => {
        if (rows && rows.length > 0) setJobApps(rows);
        else setJobApps([]);
      })
      .catch((e) => setJobApps([]));
  }, [notify]);

  const totals = useMemo(() => {
    const activeStaff = staff.filter(s => s.status !== 'Inactive');
    return {
      total: activeStaff.length,
      present: activeStaff.filter((s) => s.status === 'Present').length,
      absent: activeStaff.filter((s) => s.status === 'Absent').length,
      leave: activeStaff.filter((s) => s.status === 'On Leave').length,
    };
  }, [staff]);

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
      console.warn('API error ignored for mock:', e.message);
    }
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify('Staff status updated.', 'info', 'Attendance');
  };

  const offboardStaff = async (id) => {
    const member = staff.find((s) => s.id === id);
    if (!member || !confirm(`Are you sure you want to offboard ${member.name}? This will remove them from the active staff list.`)) return;
    
    const updated = { ...member, status: 'Inactive' };
    try {
      await upsertRow('staff', {
        id: updated.id, name: updated.name, role: updated.role,
        dept: updated.dept, status: updated.status, check_in: updated.checkIn,
      });
    } catch (e) {
      console.warn('API error ignored for mock:', e.message);
    }
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify(`${member.name} has been offboarded.`, 'success', 'Staff Management');
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

  const submitAddStaff = async () => {
    if (!addForm.name || !addForm.role || !addForm.dept || !addForm.email) {
      notify('Please fill in Name, Email, Role, and Department', 'warning', 'Validation');
      return;
    }
    setProvisionStep('provisioning');
    
    try {
      const newStaff = {
        id: addForm.empId || `stf_${Date.now()}`,
        name: addForm.name,
        role: addForm.role,
        dept: addForm.dept,
        subject: addForm.subject,
        email: addForm.email,
        status: 'Present',
        check_in: '07:00 AM'
      };

      setProvisionStep('password');
      const tempPassword = generateSecurePassword(10);
      const username = await generateSequentialUsername('TCH');
      
      const { error: signUpError, data: authData } = await secondaryAuthClient.auth.signUp({
        email: addForm.email,
        password: tempPassword,
        options: { data: { role: addForm.role.toLowerCase() === 'teacher' ? 'teacher' : 'admin' } }
      });
      
      if (signUpError && !signUpError.message.includes('already')) {
        throw new Error(signUpError.message);
      }

      if (authData?.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          username,
          full_name: addForm.name,
          role: addForm.role.toLowerCase() === 'teacher' ? 'teacher' : 'admin',
          dept: addForm.dept,
          teacher_id: newStaff.id,
          school_id: store.schoolId || null
        });
      }

      await upsertRow('staff', newStaff);
      setStaff(prev => [...prev, { ...newStaff, checkIn: newStaff.check_in }]);
      
      if (addForm.role === 'Teacher') {
        const teacherObj = {
          id: newStaff.id,
          name: newStaff.name,
          subject: newStaff.subject || newStaff.dept,
          role: 'teacher',
          emp_id: newStaff.id,
          phone: addForm.phone,
          status: 'Active',
          assignedClass: null
        };
        if (store.addTeacher) store.addTeacher(teacherObj);
      }
      
      setProvisionStep('email');
      await provisionAccount({
        email: addForm.email,
        username,
        password: tempPassword,
        name: addForm.name,
        role: 'teacher',
        schoolName: store.settings?.name || 'EduOne'
      });
      
      setProvisionStep('done');
      setTimeout(() => {
        setProvisionStep(null);
        setShowAddModal(false);
        setAddForm({ name: '', email: '', role: 'Teacher', dept: '', subject: '', phone: '', empId: '' });
        notify(`${newStaff.name} added & email sent!`, 'success', 'Staff Management');
      }, 1500);

    } catch (e) {
      setProvisionStep(null);
      notify(`Failed to add staff: ${e.message}`, 'error', 'Error');
    }
  };

  const scheduleInterview = async () => {
    if (!interviewForm.date || !interviewForm.time) {
      notify('Please select date and time', 'warning');
      return;
    }
    const updated = {
      ...selectedApp,
      status: 'Interview Scheduled',
      interview_date: interviewForm.date,
      interview_time: interviewForm.time,
      interview_type: interviewForm.type,
      notes: interviewForm.notes
    };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
      
      // Auto-schedule in school events for admins
      await upsertRow('schoolEvents', {
        id: `ev_int_${Date.now()}`,
        title: `Interview: ${updated.applicant_name} (${updated.role})`,
        desc: `${updated.interview_type} interview. Notes: ${updated.notes}`,
        date: updated.interview_date,
        type: 'meeting'
      });

      notify('Interview scheduled and added to calendar', 'success');
      setShowInterviewModal(false);
    } catch (e) {
      notify(`Error scheduling interview: ${e.message}`, 'error');
    }
  };

  const hireApplicant = async (app) => {
    setAddForm({ name: app.applicant_name, email: app.email || '', role: app.role, dept: app.department || '', subject: app.department || '', phone: app.phone || '', empId: '' });
    setShowAddModal(true);
    // Mark app as hired
    const updated = { ...app, status: 'Hired' };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (e) {
      console.error(e);
    }
  };

  const rejectApplicant = async (app) => {
    const updated = { ...app, status: 'Rejected' };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
      notify(`Applicant ${app.applicant_name} rejected`, 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const addNewDummyApp = async () => {
    const newApp = {
      id: `app_${Date.now()}`,
      applicant_name: 'New Candidate',
      role: 'Teacher',
      department: 'Mathematics',
      phone: '0700000000',
      email: 'candidate@example.com',
      experience_years: 3,
      status: 'New',
      applied_date: new Date().toISOString().slice(0, 10),
    };
    try {
      await upsertRow('job_applications', newApp);
      setJobApps(prev => [newApp, ...prev]);
      notify('New dummy application received (for demo)', 'success');
    } catch (e) {
      notify('Error adding application', 'error');
    }
  };

  const shown = filter === 'All' 
    ? staff.filter(s => s.status !== 'Inactive') 
    : staff.filter((s) => s.status === filter && s.status !== 'Inactive');

  return (
    <div>
      <PageHeader title="Staff Management" subtitle={`Today — ${new Date().toDateString()}`} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button className={`tab${tab === 'attendance' ? ' active' : ''}`} onClick={() => setTab('attendance')}>
          <Icon name="users" size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Staff Roster
        </button>
        <button className={`tab${tab === 'leave' ? ' active' : ''}`} onClick={() => setTab('leave')}>
          <Icon name="clipboard" size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Leave Requests
          {leaveTotals.pending > 0 && <Badge color="amber" style={{ marginLeft: 8 }}>{leaveTotals.pending}</Badge>}
        </button>
        {canApprove && (
          <button className={`tab${tab === 'recruitment' ? ' active' : ''}`} onClick={() => setTab('recruitment')}>
            <Icon name="file" size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Recruitment & HR
          </button>
        )}
      </div>

      {tab === 'attendance' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<Icon name="users" size={24} />} label="Total Staff" value={totals.total} />
            <KpiCard iconComponent={<Icon name="check" size={24} />} label="Present" value={totals.present} accent="#10B981" />
            <KpiCard iconComponent={<Icon name="x" size={24} />} label="Absent" value={totals.absent} accent="#EF4444" />
            <KpiCard iconComponent={<Icon name="clipboard" size={24} />} label="On Leave" value={totals.leave} accent="#F59E0B" />
          </div>

          <div className="card card-pad">
            <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['All', 'Present', 'Absent', 'On Leave'].map((f) => (
                  <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              {canApprove && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                  + Add Staff
                </button>
              )}
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Department</th><th>Check-In</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.role}</td>
                      <td className="muted">{s.dept}</td>
                      <td>{s.checkIn}</td>
                      <td><Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => setSelectedStaff(s)}>View Profile</button>
                          <button className="btn btn-sm" onClick={() => toggleStatus(s.id)}>Change Status</button>
                          {canApprove && (
                            <button className="btn btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => offboardStaff(s.id)}>Offboard</button>
                          )}
                        </div>
                      </td>
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
            <KpiCard iconComponent={<Icon name="clipboard" size={24} />} label="Total Requests" value={leaveTotals.total} />
            <KpiCard iconComponent={<Icon name="clock" size={24} />} label="Pending" value={leaveTotals.pending} accent="#F59E0B" />
            <KpiCard iconComponent={<Icon name="check" size={24} />} label="Approved" value={leaveTotals.approved} accent="#10B981" />
            <KpiCard iconComponent={<Icon name="x" size={24} />} label="Rejected" value={leaveTotals.rejected} accent="#EF4444" />
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
                              <button className="btn btn-sm btn-success" onClick={() => handleLeaveAction(l.id, 'Approved')}><Icon name="check" size={14} /></button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleLeaveAction(l.id, 'Rejected')}><Icon name="close" size={14} /></button>
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

      {showAddModal && (
        <Modal title="Add Staff Member" onClose={() => setShowAddModal(false)}
          footer={
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAddStaff}>Add Staff</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Full Name *</label>
                <input className="input" placeholder="e.g. John Doe" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Personal Email *</label>
                <input className="input" type="email" placeholder="e.g. teacher@gmail.com" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Role *</label>
                <select className="select" value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}>
                  <option>Teacher</option>
                  <option>Administrator</option>
                  <option>Nurse</option>
                  <option>Librarian</option>
                  <option>Finance</option>
                  <option>Support Staff</option>
                </select>
              </div>
              <div>
                <label className="field-label">Department *</label>
                <input className="input" placeholder="e.g. Science" value={addForm.dept} onChange={e => setAddForm(p => ({ ...p, dept: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Subject Taught</label>
                <input className="input" placeholder="e.g. Mathematics" value={addForm.subject} onChange={e => setAddForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Employee ID (Optional)</label>
                <input className="input" placeholder="e.g. EMP1024" value={addForm.empId} onChange={e => setAddForm(p => ({ ...p, empId: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Phone (Optional)</label>
                <input className="input" placeholder="07XX XXX XXX" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedStaff && (() => {
        const fullProfile = store.teachers?.find(t => t.name === selectedStaff.name) || selectedStaff;
        const subject = fullProfile.subject || selectedStaff.dept;
        const assignedClass = fullProfile.assignedClass || 'None';
        
        // Calculate average performance for their subject
        let subjectAvg = 0;
        let totalStudents = 0;
        if (store.students) {
          const scores = store.students.map(st => st.scores?.[subject]).filter(Boolean);
          if (scores.length > 0) {
            let sum = 0;
            scores.forEach(s => {
              const rowAvg = (s.a1 + s.a2 + s.a3 + s.a4) / 4;
              sum += (rowAvg / 4) * 100; // Normalize 1-4 scale to percentage roughly
            });
            subjectAvg = (sum / scores.length).toFixed(1);
            totalStudents = scores.length;
          }
        }

        return (
          <Modal title={`${selectedStaff.name}'s Profile`} onClose={() => setSelectedStaff(null)} footer={
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setSelectedStaff(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                setComposeModal(selectedStaff);
                setMessageForm({ subject: '', body: '' });
                setSelectedStaff(null);
              }}>Message Staff</button>
            </div>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0078D4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
                  {selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px' }}>{selectedStaff.name}</h2>
                  <div style={{ color: '#64748b', fontSize: 14 }}>{selectedStaff.role} · {selectedStaff.dept}</div>
                  <div style={{ marginTop: 6 }}><Badge color={STATUS_COLOR[selectedStaff.status]}>{selectedStaff.status}</Badge></div>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: 16 }}>
                <div className="card" style={{ padding: 16, background: '#f8fafc', border: 'none' }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Teaching Assignment</div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}><strong>Subject:</strong> {subject}</div>
                  <div style={{ fontSize: 14 }}><strong>Class Teacher:</strong> {assignedClass}</div>
                </div>
                
                <div className="card" style={{ padding: 16, background: '#f8fafc', border: 'none' }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Subject Performance</div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}><strong>Students Taught:</strong> {totalStudents}</div>
                  <div style={{ fontSize: 14 }}><strong>Average Score:</strong> {subjectAvg > 0 ? `${subjectAvg}%` : 'N/A'}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 16, background: '#f8fafc', border: 'none' }}>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Recent Activity</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#334155' }}>
                  <li style={{ marginBottom: 6 }}>Checked in today at {selectedStaff.checkIn || '07:30 AM'}</li>
                  <li style={{ marginBottom: 6 }}>Submitted 2 assignments for {assignedClass !== 'None' ? assignedClass : 'Grade 8'}</li>
                  <li>Logged 3 behavior incidents this week</li>
                </ul>
              </div>

            </div>
          </Modal>
        );
      })()}

      {composeModal && (
        <Modal title={`Message ${composeModal.name}`} onClose={() => setComposeModal(null)} footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setComposeModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => {
              if (!messageForm.subject || !messageForm.body) return notify('Subject and Body required', 'warning');
              try {
                await upsertRow('messages', {
                  id: `msg_${Date.now()}`,
                  sender_id: user?.id || 'admin',
                  sender_name: user?.name || user?.role || 'Admin',
                  recipient_role: composeModal.name, // specifically address by name
                  student_name: 'Administration', // context for teacher inbox
                  subject: messageForm.subject,
                  body: messageForm.body,
                  status: 'Unread',
                  created_at: new Date().toISOString()
                });

                // Send email simultaneously
                if (composeModal.email) {
                  try {
                    await fetch('/api/send-message', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: composeModal.email,
                        name: composeModal.name,
                        subject: messageForm.subject,
                        body: messageForm.body,
                        schoolName: store.settings?.name || 'EduOne'
                      })
                    });
                  } catch (e) {
                    console.error('Email send error:', e);
                  }
                }

                notify(`Message sent to ${composeModal.name} via Portal & Email`, 'success');
                setComposeModal(null);
              } catch (err) {
                notify(`Failed to send message: ${err.message}`, 'error');
              }
            }}>Send Message</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Subject</label>
              <input className="input" placeholder="E.g. Performance Review" value={messageForm.subject} onChange={e => setMessageForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Message</label>
              <textarea className="input" rows={5} placeholder="Type your message here..." value={messageForm.body} onChange={e => setMessageForm(f => ({ ...f, body: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
      {tab === 'recruitment' && canApprove && (
        <>
          <div className="card card-pad">
            <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Job Applications</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={addNewDummyApp}>Simulate App</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Hire Directly</button>
              </div>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Applicant</th><th>Applied Role</th><th>Exp. (Yrs)</th><th>Applied Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {jobApps.map(app => (
                    <tr key={app.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{app.applicant_name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{app.email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{app.role}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{app.department}</div>
                      </td>
                      <td>{app.experience_years} yrs</td>
                      <td className="muted">{app.applied_date}</td>
                      <td>
                        <Badge color={app.status === 'Hired' ? 'green' : app.status === 'Rejected' ? 'red' : app.status === 'Interview Scheduled' ? 'blue' : 'amber'}>
                          {app.status}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {app.status !== 'Hired' && app.status !== 'Rejected' && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApp(app); setShowInterviewModal(true); }}>Schedule Interview</button>
                              <button className="btn btn-sm btn-success" onClick={() => hireApplicant(app)}>Hire</button>
                              <button className="btn btn-sm btn-danger" onClick={() => rejectApplicant(app)}>Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jobApps.length === 0 && (
                    <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No active job applications.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showInterviewModal && selectedApp && (
        <Modal title={`Schedule Interview: ${selectedApp.applicant_name}`} onClose={() => setShowInterviewModal(false)} footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setShowInterviewModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={scheduleInterview}>Schedule & Add to Calendar</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Date *</label>
                <input type="date" className="input" value={interviewForm.date} onChange={e => setInterviewForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Time *</label>
                <input type="time" className="input" value={interviewForm.time} onChange={e => setInterviewForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="select" value={interviewForm.type} onChange={e => setInterviewForm(f => ({ ...f, type: e.target.value }))}>
                <option>In-person</option>
                <option>Video Call (Zoom/Meet)</option>
                <option>Phone Call</option>
              </select>
            </div>
            <div>
              <label className="field-label">Email Address (for Invite)</label>
              <input type="email" className="input" placeholder="applicant@example.com" value={interviewForm.email} onChange={e => setInterviewForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Notes / Instructions</label>
              <textarea className="input" rows={3} placeholder="e.g. Bring copies of certificates" value={interviewForm.notes} onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {provisionStep && <RegistrationLoadingModal step={provisionStep} />}

    </div>
  );
}
