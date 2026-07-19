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
  const [logs, setLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Messaging Staff
  const [composeModal, setComposeModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'teacher', dept: '', subject: '', phone: '', empId: '', username: '' });
  const [provisionStep, setProvisionStep] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // Recruitment State
  const [jobApps, setJobApps] = useState([]);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ date: '', time: '', type: 'In-person', notes: '' });
  const [selectedApp, setSelectedApp] = useState(null);

  const canApprove = user && (user.role === 'principal' || user.role === 'deputy_admin' || user.role === 'deputy_academic');

  // Reverse lookup: auth user UUID → staff record (for resolving log staff_id to names)
  const [uidToStaffMap, setUidToStaffMap] = useState({});

  // Fetch staff + logs (reusable for polling)
  const refreshStaffData = () => {
    Promise.all([
      fetchTable('staff'),
      fetchTable('staff_attendance_logs'),
      supabase.from('profiles').select('id, teacher_id, full_name')
    ]).then(([staffRows, logRows, { data: profs }]) => {
      // profMap: staff.id (teacher_id) → auth user UUID
      const profMap = {};
      // uidStaffMap: auth user UUID → staff record (for log lookups)
      const uidStaffMap = {};
      if (profs && staffRows) {
        profs.forEach(p => {
          if (p.teacher_id) {
            profMap[p.teacher_id] = p.id;
            const matchedStaff = staffRows.find(s => s.id === p.teacher_id);
            if (matchedStaff) {
              uidStaffMap[p.id] = matchedStaff;
            }
          }
        });
      }
      // Also map staff by their own id (for direct matches)
      if (staffRows) {
        staffRows.forEach(s => { uidStaffMap[s.id] = s; });
      }
      setUidToStaffMap(uidStaffMap);

      if (logRows) {
        setLogs(logRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
      
      const todayStr = new Date().toLocaleDateString();
      const logsToday = (logRows || []).filter(l => new Date(l.created_at).toLocaleDateString() === todayStr);

      if (staffRows) {
        setStaff(staffRows.map((s) => {
          const uId = profMap[s.id] || s.id;
          const myLogs = logsToday.filter(l => l.staff_id === uId || l.staff_id === s.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const checkInStr = myLogs.length > 0 ? new Date(myLogs[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          
          let derivedStatus = s.status;
          if (s.status !== 'Inactive' && s.status !== 'On Leave') {
            derivedStatus = myLogs.length > 0 ? 'Present' : 'Absent';
          }
          
          return { ...s, checkIn: checkInStr, status: derivedStatus };
        }).sort((a, b) => a.name.localeCompare(b.name)));
      }
    }).catch((e) => notify(`Failed to load attendance data: ${e.message}`, 'error'));
  };

  useEffect(() => {
    // Initial load
    refreshStaffData();

    fetchTable('job_applications')
      .then((rows) => {
        if (rows && rows.length > 0) setJobApps(rows);
        else setJobApps([]);
      })
      .catch((e) => setJobApps([]));

    // Load leave requests from database
    fetchTable('leave_requests')
      .then((rows) => {
        if (rows && rows.length > 0) setLeaveRequests(rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      })
      .catch(() => {});

    // Poll staff + logs every 30 seconds for near real-time updates
    const pollId = setInterval(refreshStaffData, 30000);
    return () => clearInterval(pollId);
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

  // Helper: resolve a log's staff_id to a staff record using the uidToStaffMap
  const resolveStaffFromLog = (staffId) => {
    return uidToStaffMap[staffId] || staff.find(s => s.id === staffId) || null;
  };

  const handleExportLogs = () => {
    if (!logs || logs.length === 0) {
      notify('No logs available to export.', 'info');
      return;
    }
    
    const headers = ['Staff Name', 'Role', 'Date', 'Check In', 'Check Out', 'Status'];
    
    const csvRows = [headers.join(',')];
    
    logs.forEach(l => {
      const s = resolveStaffFromLog(l.staff_id) || { name: 'Unknown', role: 'Unknown' };
      const inTime = l.check_in_time ? new Date(l.check_in_time).toLocaleTimeString() : '';
      const outTime = l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString() : '';
      
      const row = [
        `"${s.name}"`,
        s.role || 'Staff',
        l.date,
        `"${inTime}"`,
        `"${outTime}"`,
        l.status || 'Present'
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `staff_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        dept: updated.dept, status: updated.status, check_in: updated.check_in || null,
      });
    } catch (e) {
      alert('Failed to update status: ' + e.message);
      console.error(e);
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
        dept: updated.dept, status: updated.status, check_in: updated.check_in || null,
      });
    } catch (e) {
      alert('Failed to offboard: ' + e.message);
      console.error(e);
    }
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify(`${member.name} has been offboarded.`, 'success', 'Staff Management');
  };

  const handleLeaveAction = async (id, action) => {
    const updated = { status: action, approved_by: user?.name || 'Admin' };
    setLeaveRequests(prev => prev.map(l =>
      l.id === id ? { ...l, ...updated } : l
    ));
    try {
      const leaveRow = leaveRequests.find(l => l.id === id);
      if (leaveRow) await upsertRow('leave_requests', { ...leaveRow, ...updated });
    } catch (e) {
      console.warn('Failed to persist leave action:', e.message);
    }
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
        id: `lr_${Date.now()}`,
        staff_name: user?.name || 'Staff Member',
        staff_id: user?.id || null,
        dept: user?.dept || 'Department',
        type: leaveForm.type,
        start_date: leaveForm.start,
        end_date: leaveForm.end,
        days,
        reason: leaveForm.reason,
        status: 'Pending',
        approved_by: null,
        created_at: new Date().toISOString(),
      };
      await upsertRow('leave_requests', newReq);
      setLeaveRequests(prev => [newReq, ...prev]);
      setShowLeaveModal(false);
      setLeaveForm({ type: 'Annual', start: '', end: '', reason: '' });
      notify('Leave request submitted successfully', 'success', 'Leave');
    } catch (e) {
      notify(`Failed to submit leave: ${e.message}`, 'error', 'Leave');
    } finally {
      setLeaveSaving(false);
    }
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
        status: 'Absent',
        check_in: ''
      };

      const staffPayload = { ...newStaff };
      delete staffPayload.email;
      delete staffPayload.subject;

      setProvisionStep('password');
      const tempPassword = generateSecurePassword(10);
      const username = addForm.username && addForm.username.trim() !== '' 
        ? addForm.username.trim() 
        : await generateSequentialUsername('TCH');
      
      let staffUserId = null;
      let isExisting = false;
      
      const { error: signUpError, data: authData } = await secondaryAuthClient.auth.signUp({
        email: addForm.email,
        password: tempPassword,
        options: { data: { role: addForm.role, full_name: addForm.name, school_id: store.schoolId } }
      });
      
      isExisting = signUpError && signUpError.message.toLowerCase().includes('already');
      if (isExisting) {
        const { data: existingId, error: fetchErr } = await supabase.rpc('get_user_id_by_email', { p_email: addForm.email });
        if (fetchErr) throw new Error(`Could not fetch existing user: ${fetchErr.message}`);
        
        let query = supabase.from('profiles').select('id').eq('id', existingId).eq('role', addForm.role);
        if (store.schoolId) query = query.eq('school_id', store.schoolId);
        else query = query.is('school_id', null);
        
        const { data: existingProfiles, error: profileCheckErr } = await query;
        if (profileCheckErr) throw new Error(`Profile check error: ${profileCheckErr.message}`);
        
        if (existingProfiles && existingProfiles.length > 0) {
          notify(`This user is already registered as a ${addForm.role}. Duplicate accounts for the same role are not allowed.`, 'error');
          setProvisionStep(null);
          return;
        }
        
        staffUserId = existingId;
      } else if (signUpError) {
        throw new Error(`Auth Error: ${signUpError.message}`);
      } else {
        staffUserId = authData?.user?.id;
      }

      if (staffUserId) {
        const { error: profileErr } = await supabase.from('profiles').insert({
          id: staffUserId,
          username,
          full_name: addForm.name,
          role: addForm.role,
          dept: addForm.dept,
          teacher_id: newStaff.id,
          school_id: store.schoolId || null
        });
        if (profileErr && profileErr.code !== '23505') throw new Error(`Teacher Profile Error: ${profileErr.message}`);
      }

      await upsertRow('staff', staffPayload);
      setStaff(prev => [...prev, { ...newStaff, checkIn: '' }]);
      
      if (addForm.role === 'teacher' || addForm.role === 'dos') {
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
      let emailSent = true;
      try {
        await provisionAccount({
          email: addForm.email,
          username,
          password: tempPassword,
          name: addForm.name,
          role: addForm.role,
          schoolName: store.settings?.name || 'EduOne'
        });
      } catch (emailErr) {
        console.error('Email sending failed:', emailErr);
        emailSent = false;
      }
      
      setProvisionStep('done');
      setTimeout(() => {
        setProvisionStep(null);
        setShowAddModal(false);
        setAddForm({ name: '', email: '', role: 'teacher', dept: '', subject: '', phone: '', empId: '' });
        
        setCreatedCredentials({
          name: newStaff.name,
          email: addForm.email,
          username: username,
          password: isExisting ? '(Already exists. Use original password)' : tempPassword,
          emailSent: emailSent,
          isExisting: isExisting
        });

        if (emailSent) {
          notify(`${newStaff.name} added & email sent!`, 'success', 'Staff Management');
        } else {
          notify(`${newStaff.name} was added, but the welcome email could not be sent.`, 'warning', 'Staff Management');
        }
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
        <button className={`tab${tab === 'logs' ? ' active' : ''}`} onClick={() => setTab('logs')}>
          <Icon name="clock" size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> EduOne Logs
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }} onClick={handleExportLogs}>
                    Export Logs
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                    + Add Staff
                  </button>
                </div>
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
                      <td className="check-in-col">{s.checkIn || ''}</td>
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

      {tab === 'logs' && (
        <div className="card card-pad">
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>EduOne Attendance Clock-In History</h3>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Staff Member</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Location Data</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const staffMember = resolveStaffFromLog(l.staff_id) || { name: 'Unknown Staff' };
                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{staffMember.name}</td>
                      <td>{l.date}</td>
                      <td style={{ color: '#059669', fontWeight: 500 }}>
                        {l.check_in_time ? new Date(l.check_in_time).toLocaleTimeString() : '-'}
                      </td>
                      <td style={{ color: '#dc2626', fontWeight: 500 }}>
                        {l.check_out_time ? new Date(l.check_out_time).toLocaleTimeString() : '-'}
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {l.location_lat ? `Lat: ${l.location_lat.toFixed(4)}, Lng: ${l.location_lng.toFixed(4)}` : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No EduOne logs recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                        <div style={{ fontWeight: 600 }}>{l.staff_name || l.staff}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{l.dept}</div>
                      </td>
                      <td><Badge color={l.type === 'Sick' ? 'red' : l.type === 'Emergency' ? 'amber' : 'blue'}>{l.type}</Badge></td>
                      <td className="muted" style={{ fontSize: 12 }}>{l.start_date || l.start} → {l.end_date || l.end}</td>
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
                  <option value="teacher">Teacher</option>
                  <option value="principal">Principal / Admin</option>
                  <option value="deputy_academic">Deputy Principal (Academics)</option>
                  <option value="dos">Director of Studies (DoS)</option>
                  <option value="deputy_admin">Deputy Principal (Admin)</option>
                  <option value="clinic">Clinic / Nurse</option>
                  <option value="librarian">Librarian</option>
                  <option value="registrar">Registrar</option>
                  <option value="finance">Bursar / Finance</option>
                </select>
              </div>
              <div>
                <label className="field-label">Department *</label>
                <input className="input" placeholder="e.g. Science" value={addForm.dept} onChange={e => setAddForm(p => ({ ...p, dept: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Subjects Taught</label>
                <input className="input" placeholder="e.g. Mathematics, English" value={addForm.subject} onChange={e => setAddForm(p => ({ ...p, subject: e.target.value }))} />
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
              <div>
                <label className="field-label">Username (Optional)</label>
                <input className="input" placeholder="e.g. jdoe24" value={addForm.username || ''} onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedStaff && (() => {
        const fullProfile = store.teachers?.find(t => t.name === selectedStaff.name) || selectedStaff;
        const subject = fullProfile.subject || selectedStaff.dept;
        const assignedClass = fullProfile.assignedClass || 'None';
        
        let totalStudents = 0;
        let gradedStudents = 0;
        let sumScores = 0;

        if (subject && store.students) {
          store.students.forEach(s => {
            if (s.scores?.[subject]) {
              totalStudents++;
              const sc = s.scores[subject];
              const valid = [sc.a1, sc.a2, sc.a3, sc.a4].filter(v => Number(v) > 0);
              if (valid.length > 0) {
                gradedStudents++;
                sumScores += (valid.reduce((a, b) => a + Number(b), 0) / valid.length) * 25;
              }
            }
          });
        }

        let subjectAvg = gradedStudents > 0 ? (sumScores / gradedStudents).toFixed(1) : '-';
        totalStudents = totalStudents || '-';

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
                  <li style={{ marginBottom: 6 }}>
                    {selectedStaff.checkIn ? `Checked in today at ${selectedStaff.checkIn}` : 'Not checked in today yet'}
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    {gradedStudents > 0 ? `Recorded ${gradedStudents} scores in ${subject} gradebook` : `Assigned as teacher for ${subject}`}
                  </li>
                  <li>
                    {assignedClass !== 'None' ? `Responsible for ${assignedClass} as Class Teacher` : 'No Class Teacher assignment'}
                  </li>
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
                const schoolId = store?.schoolId || 'demo';
                await upsertRow('notifications', {
                  id: `notif_${Date.now()}`,
                  title: messageForm.subject,
                  message: messageForm.body,
                  body: messageForm.body,
                  posted_by: user?.name || 'Administration',
                  role: 'Admin',
                  audience: [composeModal.email || composeModal.id],
                  school_id: schoolId,
                  read: false,
                  created_at: new Date().toISOString()
                });

                // Send email simultaneously
                if (composeModal.email) {
                  try {
                    const { data } = await supabase.auth.getSession();
                    const token = data?.session?.access_token || '';

                    await fetch('/api/send-message', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
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
      
      {createdCredentials && (
        <Modal 
          title="Staff Account Created" 
          onClose={() => setCreatedCredentials(null)}
          footer={<button className="btn btn-primary" onClick={() => setCreatedCredentials(null)}>Done</button>}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', marginBottom: 16 }}>
              <Icon name="check" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>{createdCredentials.name} Added</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              The staff member has been added to the system.
              {createdCredentials.isExisting && (
                <span style={{ color: '#ef4444', display: 'block', marginTop: 4, fontWeight: 500 }}>
                  Note: This email was already registered. They must log in with their existing password.
                </span>
              )}
              {!createdCredentials.emailSent && !createdCredentials.isExisting && (
                <span style={{ color: '#ef4444', display: 'block', marginTop: 4, fontWeight: 500 }}>
                  Note: The welcome email failed to send. Please share the credentials below manually.
                </span>
              )}
            </p>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>Temporary Login Credentials</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 12px', fontSize: 14 }}>
              <div style={{ color: '#64748b' }}>Portal URL:</div>
              <div style={{ fontWeight: 500 }}>https://www.edu1app.tech</div>
              
              <div style={{ color: '#64748b' }}>Email:</div>
              <div style={{ fontWeight: 500, userSelect: 'all' }}>{createdCredentials.email}</div>
              
              <div style={{ color: '#64748b' }}>Username:</div>
              <div style={{ fontWeight: 500, userSelect: 'all' }}>{createdCredentials.username}</div>
              
              <div style={{ color: '#64748b' }}>Password:</div>
              <div style={{ fontWeight: 700, userSelect: 'all', fontFamily: 'monospace', letterSpacing: 1, color: createdCredentials.isExisting ? '#ef4444' : '#0078D4' }}>{createdCredentials.password}</div>
            </div>
          </div>
          
          <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
            Instruct the staff member to log in using the email/username and password above. They can change this password after logging in.
          </div>
        </Modal>
      )}

    </div>
  );
}
