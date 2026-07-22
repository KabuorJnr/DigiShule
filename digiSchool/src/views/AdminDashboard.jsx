import { useState, useEffect } from 'react';
import { Badge, ProgressBar } from '../components/widgets';
import { fmtKES } from '../data/modules';

import Modal from '../components/Modal';
import { fetchTable, upsertRow, fetchStudentByQuery } from '../lib/api';
import { exportTablePDF } from '../utils/exporters';
import MediaManager from '../components/MediaManager';
import { Download, UserPlus, Shield, CheckCircle2, Key } from 'lucide-react';
import { secondaryAuthClient, supabase } from '../lib/supabaseClient';

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
  const { navigate, notify, students } = store;
  const [disciplineModal, setDisciplineModal] = useState(null);
  const [reportDisciplineOpen, setReportDisciplineOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    adm: '',
    category: 'Absenteeism',
    description: '',
    action: '',
    severity: 'Medium'
  });
  const [leaveActions, setLeaveActions] = useState({});
  const [expenses, setExpenses] = useState([]);
  
  const [dbStaff, setDbStaff] = useState([]);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [dbFacilities, setDbFacilities] = useState([]);
  const [dbDiscipline, setDbDiscipline] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]);

  // Meeting Schedule Modal
  const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', teacher_name: '' });

  // Staff Commissioning State
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionForm, setCommissionForm] = useState({ name: '', email: '', role: 'admin' });
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionSuccess, setCommissionSuccess] = useState(false);
  const [commissionGeneratedPassword, setCommissionGeneratedPassword] = useState('');

  // Reset Staff Password State
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetPasswordSending, setResetPasswordSending] = useState(false);

  const handleResetStaffPassword = async () => {
    if (!resetPasswordEmail.trim()) return notify('Please enter the staff email', 'warning');
    setResetPasswordSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetPasswordEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      notify(`Password reset link sent to ${resetPasswordEmail}`, 'success', 'Password Reset');
      setResetPasswordOpen(false);
      setResetPasswordEmail('');
    } catch (err) {
      notify(`Failed to send reset: ${err.message}`, 'error');
    } finally {
      setResetPasswordSending(false);
    }
  };

  useEffect(() => {
    fetchTable('expenses').then(setExpenses).catch(() => {});
    fetchTable('staff').then(setDbStaff).catch(() => {});
    fetchTable('facilities').then(setDbFacilities).catch(() => {});
    fetchTable('disciplinaryRecords').then(setDbDiscipline).catch(() => {});
    fetchTable('parentMeetingRequests').then(setMeetingRequests).catch(() => {});
  }, []);

  const activeStaffList = dbStaff.filter(s => s.status !== 'Inactive');
  const presentStaff = activeStaffList.filter(s => s.status === 'Present' || s.status === 'Active' || s.status === 'active').length;
  const activeStudentsList = (students || []).filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  const operationalFac = dbFacilities.filter(f => f.status === 'Operational').length;
  const pendingLeave = 0;
  const openDiscipline = dbDiscipline.filter(d => d.status === 'Open').length;

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

  const handleReportDiscipline = async () => {
    if (!reportForm.adm || !reportForm.description) return notify('Please fill all required fields.', 'warning');
    
    try {
      const studentObj = await fetchStudentByQuery('adm', reportForm.adm);
      if (!studentObj) return notify('Student not found with this ADM number.', 'error');
      const payload = {
        id: `disc_${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        student: studentObj.name,
        adm: studentObj.adm,
        class: studentObj.class,
        category: reportForm.category,
        description: reportForm.description,
        action: reportForm.action,
        severity: reportForm.severity,
        status: 'Open'
      };
      await upsertRow('disciplinaryRecords', payload);
      setDbDiscipline(prev => [payload, ...prev]);
      notify('Disciplinary report filed successfully.', 'success');
      setReportDisciplineOpen(false);
      setReportForm({ adm: '', category: 'Absenteeism', description: '', action: '', severity: 'Medium' });
    } catch (err) {
      notify(`Failed to file report: ${err.message}`, 'error');
    }
  };

  const handleDownloadDiscipline = () => {
    const head = ['Date', 'Student', 'Class', 'Category', 'Severity', 'Status'];
    const body = dbDiscipline.map(d => [
      d.date, d.student, d.class, d.category, d.severity, d.status
    ]);
    exportTablePDF({
      school: store.settings,
      title: 'Disciplinary Records',
      subtitle: `Exported on ${new Date().toLocaleDateString()}`,
      head,
      body,
      filename: `Discipline_Records_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  const handleScheduleMeeting = async () => {
    if (!scheduleForm.date || !scheduleForm.time) return notify('Please select date and time', 'warning');
    try {
      const scheduledDt = `${scheduleForm.date}T${scheduleForm.time}:00`;
      const updated = { ...selectedMeeting, status: 'Scheduled', scheduled_date: scheduledDt, teacher_name: scheduleForm.teacher_name };
      
      // Save meeting request
      await upsertRow('parentMeetingRequests', updated);

      setMeetingRequests(prev => prev.map(m => m.id === updated.id ? updated : m));
      notify(`Meeting scheduled and ${scheduleForm.teacher_name} tagged successfully.`, 'success');
      setScheduleMeetingOpen(false);
      setSelectedMeeting(null);
      setScheduleForm({ date: '', time: '', teacher_name: '' });
    } catch (e) {
      notify(`Failed to schedule meeting: ${e.message}`, 'error');
    }
  };

  const handleRejectMeeting = async (meeting) => {
    try {
      const updated = { ...meeting, status: 'Rejected' };
      await upsertRow('parentMeetingRequests', updated);
      setMeetingRequests(prev => prev.map(m => m.id === updated.id ? updated : m));
      notify('Meeting request rejected.', 'success');
    } catch (e) {
      notify(`Failed to reject meeting: ${e.message}`, 'error');
    }
  };

  const handleCommissionStaff = async () => {
    if (!commissionForm.name || !commissionForm.email || !commissionForm.role) {
      return notify('Please fill all required fields.', 'warning');
    }
    
    setCommissionSaving(true);
    try {
      const email = commissionForm.email.trim();
      const schoolId = store.settings?.id || localStorage.getItem('eduone_school_id');

      // 1. Generate temp password and 6-digit PIN
      const tempPass = `EduOne@${Math.floor(1000 + Math.random() * 9000)}`;
      const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 2. Create Auth User using secondary client to preserve Principal session
      const { data: authData, error: authErr } = await secondaryAuthClient.auth.signUp({
        email,
        password: tempPass,
        options: { data: { role: commissionForm.role, full_name: commissionForm.name } }
      });
      
      let finalUserId = null;
      if (authErr && authErr.message.toLowerCase().includes('already')) {
        const { data: existingId, error: fetchErr } = await supabase.rpc('get_user_id_by_email', { p_email: email });
        if (fetchErr) throw new Error(`Could not fetch existing user: ${fetchErr.message}`);
        finalUserId = existingId;
      } else if (authErr) {
        throw new Error(`Auth Error: ${authErr.message}`);
      } else {
        finalUserId = authData?.user?.id;
      }
      
      if (!finalUserId) throw new Error('Failed to create credentials.');
      
      // 3. Create Profile
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: finalUserId,
        username: email,
        full_name: commissionForm.name,
        role: commissionForm.role,
        school_id: schoolId
      });
      if (profileErr) throw new Error(`Profile Error: ${profileErr.message}`);
      
      // 4. Create Pending Staff Record with PIN
      const newStaff = {
        id: finalUserId,
        name: commissionForm.name,
        role: commissionForm.role,
        dept: 'General',
        status: 'Pending',
        school_id: schoolId,
        pin: tempPin
      };
      
      await upsertRow('staff', newStaff);
      setDbStaff(prev => [...prev, newStaff]);
      
      // 4.5 Create Teacher Record if applicable
      if (commissionForm.role === 'teacher' || commissionForm.role === 'class teacher' || commissionForm.role === 'dos') {
        const teacherObj = {
          id: finalUserId,
          name: commissionForm.name,
          subject: 'General',
          role: 'teacher',
          emp_id: finalUserId,
          status: 'Pending',
          school_id: schoolId,
          assigned_class: null
        };
        await upsertRow('teachers', teacherObj);
        if (store.addTeacher) store.addTeacher({ ...teacherObj, assignedClass: null });
      }
      
      // 5. Send Email Automatically via Vercel API
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      
      const payload = {
        email,
        name: commissionForm.name,
        role: commissionForm.role,
        password: tempPass,
        activationPin: tempPin,
        schoolName: store.settings?.name || 'EduOne School Portal'
      };

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error('Email sending failed:', await response.text());
        notify('Account created, but failed to send the email automatically.', 'warning');
      }
      
      setCommissionSuccess(true);
    } catch (err) {
      notify(`Failed to commission staff: ${err.message}`, 'error');
    } finally {
      setCommissionSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Deputy Admin Dashboard</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Administration overview - student affairs, facilities, staff welfare</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setShowMediaManager(!showMediaManager)}>
            {showMediaManager ? 'Back to dashboard' : 'Media gallery manager'}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('notices')}>Post notice</button>
        </div>
      </div>

      {showMediaManager ? (
        <MediaManager notify={notify} user={user} />
      ) : (
        <>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            padding: '24px 32px',
            borderRadius: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative background glow */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-5%',
              width: 350,
              height: 350,
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0,0,0,0) 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Shield size={24} color="#047857" />
                Administration Office
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8', fontWeight: 400 }}>
                Managing discipline, boarding, facilities, and staff welfare
              </p>
            </div>
            
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 13, color: '#38bdf8', marginTop: 6, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
                Term 2 · Academic Year 2026
              </div>
            </div>
          </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <Stat label="Total Students" value={activeStudentsList.length} color="#047857" />
        <Stat label="Active Staff" value={activeStaffList.length} color="#047857" sub={`${presentStaff} Present Today`} />
        <Stat label="Facilities" value={dbFacilities.length} color="#047857" sub={`${operationalFac} Operational`} />
        <Stat label="Pending Leaves" value={pendingLeave} color="#F59E0B" />
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h3 className="section-title">Principal Quick Actions</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setReportDisciplineOpen(true)}>
            <Shield size={18} /> File Disciplinary Report
          </button>
          <button className="btn btn-primary" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setCommissionModalOpen(true)}>
            <UserPlus size={18} /> Commission Staff
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setResetPasswordOpen(true)}>
            <Key size={18} /> Reset Staff Password
          </button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-4" style={{ gap: 10 }}>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('staff_attendance')}>Staff Attendance</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('facilities')}>Facilities Management</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('admissions')}>Student Records</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('notices')}>Post Notice</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('finance')}>Finance Overview</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('clinic')}>Health / Clinic</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('library')}>Library</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('class_teachers')}>Class Teachers</button>
          <button className="btn" style={{ height: 48, justifyContent: 'flex-start' }} onClick={() => navigate('settings')}>Settings</button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ color: '#000000', margin: 0 }}>Discipline Cases</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleDownloadDiscipline} title="Download Records">
                <Download size={14} />
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setReportDisciplineOpen(true)}>File Report</button>
            </div>
          </div>
          {dbDiscipline.slice(0, 5).map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setDisciplineModal(d)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.student} - {d.category}</div>
                <div className="muted" style={{ fontSize: 12 }}>{d.description}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{d.date} · {d.class}</div>
              </div>
              <Badge color={d.status === 'Open' ? 'red' : 'green'}>{d.status}</Badge>
            </div>
          ))}
          {dbDiscipline.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '10px 0' }}>No discipline cases recorded.</div>}
        </div>

        <div className="card card-pad">
          <h3 className="section-title" style={{ color: '#000000' }}>Facilities Overview</h3>
          {dbFacilities.slice(0, 5).map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{f.type} · Capacity: {f.capacity}</div>
              </div>
              <Badge color={f.status === 'Operational' ? 'green' : 'amber'}>{f.status}</Badge>
            </div>
          ))}
          {dbFacilities.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '10px 0' }}>No facilities added.</div>}
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('facilities')}>
            Manage Facilities
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, color: '#000000' }}>Pending Leave Requests</h3>
            <button className="btn btn-sm" onClick={() => navigate('staff/leave')}>Manage Leave</button>
          </div>
          <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No pending requests</p>
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

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, color: '#000000' }}>Parent Meeting Requests</h3>
          </div>
          {meetingRequests.filter(m => m.status === 'Pending').map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.parent_name} <span className="muted" style={{ fontWeight: 400 }}>(Student: {m.student_name})</span></div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Requested Staff: {m.teacher_name}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>"{m.reason}"</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Requested on: {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={() => { setSelectedMeeting(m); setScheduleForm({ date: '', time: '', teacher_name: m.teacher_name }); setScheduleMeetingOpen(true); }}>Schedule</button>
                <button className="btn btn-sm" onClick={() => handleRejectMeeting(m)}>Reject</button>
              </div>
            </div>
          ))}
          {meetingRequests.filter(m => m.status === 'Pending').length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No pending meeting requests</p>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, color: '#000000' }}>Upcoming Events</h3>
            <button className="btn btn-sm" onClick={() => navigate('school_calendar')}>View Global Calendar</button>
          </div>
          <div className="scroll-x" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {(() => {
              const scheduled = meetingRequests.filter(m => m.status === 'Scheduled');
              if (scheduled.length === 0) return <p className="muted" style={{ padding: 16 }}>No scheduled meetings.</p>;
              
              const grouped = scheduled.reduce((acc, m) => {
                const date = new Date(m.scheduled_date);
                const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                if (!acc[month]) acc[month] = [];
                acc[month].push(m);
                return acc;
              }, {});

              return Object.entries(grouped).map(([month, meetings]) => (
                <div key={month} style={{ marginBottom: 16 }}>
                  <div style={{ background: '#f8fafc', padding: '6px 12px', fontWeight: 600, color: '#334155', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    {month}
                  </div>
                  <table className="table" style={{ marginTop: 0 }}>
                    <thead style={{ display: 'none' }}><tr><th></th><th></th><th></th></tr></thead>
                    <tbody>
                      {meetings.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).map(m => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: 'nowrap', width: '20%' }}>{new Date(m.scheduled_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>Meeting: {m.parent_name}</div>
                            <div className="muted" style={{ fontSize: 12 }}>With: {m.teacher_name}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}><Badge color="green">Scheduled</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
      </>
      )}

      {resetPasswordOpen && (
        <Modal title="Reset Staff Password" onClose={() => setResetPasswordOpen(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setResetPasswordOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetStaffPassword} disabled={resetPasswordSending}>
              {resetPasswordSending ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        }>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
            Enter the staff member's email address. They will receive a link to set a new password.
          </p>
          <label className="field-label">Staff Email Address</label>
          <input
            type="email"
            className="input"
            placeholder="e.g. nurse@school.ac.ke"
            value={resetPasswordEmail}
            onChange={e => setResetPasswordEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResetStaffPassword()}
            style={{ marginTop: 4 }}
          />
          <div style={{ marginTop: 12 }}>
            {['clinic', 'librarian', 'nurse'].map(role => {
              const found = dbStaff.find(s => s.role?.toLowerCase() === role);
              if (!found) return null;
              return (
                <button key={role} className="btn btn-sm" style={{ marginRight: 6, marginBottom: 6 }}
                  onClick={() => setResetPasswordEmail(found.id || '')}>
                  Use: {found.name} ({role})
                </button>
              );
            })}
          </div>
        </Modal>
      )}

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

      {reportDisciplineOpen && (
        <Modal title="File Disciplinary Report" onClose={() => setReportDisciplineOpen(false)} footer={
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setReportDisciplineOpen(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }} onClick={handleReportDiscipline}>File Report</button>
          </div>
        }>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Student ADM Number</label>
              <input type="text" className="input" value={reportForm.adm} onChange={e => setReportForm(f => ({ ...f, adm: e.target.value }))} placeholder="e.g. ADM-101" />
            </div>
            <div>
              <label className="field-label">Category</label>
              <select className="select" value={reportForm.category} onChange={e => setReportForm(f => ({ ...f, category: e.target.value }))}>
                <option>Absenteeism</option>
                <option>Bullying</option>
                <option>Vandalism</option>
                <option>Insubordination</option>
                <option>Dress Code</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Description of Incident</label>
              <textarea className="input" rows={3} value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} placeholder="Provide details..."></textarea>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Action Taken (Optional)</label>
              <textarea className="input" rows={2} value={reportForm.action} onChange={e => setReportForm(f => ({ ...f, action: e.target.value }))} placeholder="E.g., Warning given, Parents called..."></textarea>
            </div>
            <div>
              <label className="field-label">Severity</label>
              <select className="select" value={reportForm.severity} onChange={e => setReportForm(f => ({ ...f, severity: e.target.value }))}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {scheduleMeetingOpen && selectedMeeting && (
        <Modal title="Schedule Parent Meeting" onClose={() => { setScheduleMeetingOpen(false); setSelectedMeeting(null); }} footer={
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => { setScheduleMeetingOpen(false); setSelectedMeeting(null); }}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleScheduleMeeting}>Schedule Meeting</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
              <div><strong>Parent:</strong> {selectedMeeting.parent_name}</div>
              <div><strong>Student:</strong> {selectedMeeting.student_name}</div>
              <div><strong>Requested Staff:</strong> {selectedMeeting.teacher_name}</div>
              <div style={{ marginTop: 8 }}><strong>Reason:</strong> {selectedMeeting.reason}</div>
            </div>
            
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div>
                <label className="field-label">Date</label>
                <input type="date" className="input" value={scheduleForm.date} onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Time</label>
                <input type="time" className="input" value={scheduleForm.time} onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Assign / Tag Teacher (CC)</label>
                <select className="select" value={scheduleForm.teacher_name} onChange={e => setScheduleForm(f => ({ ...f, teacher_name: e.target.value }))}>
                  <option value={selectedMeeting.teacher_name}>{selectedMeeting.teacher_name} (Requested)</option>
                  {dbStaff.filter(s => s.name !== selectedMeeting.teacher_name).map(s => (
                    <option key={s.id} value={s.name}>{s.name} - {s.role}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {commissionModalOpen && (
        <Modal title="Commission Staff Account" onClose={() => setCommissionModalOpen(false)} footer={null}>
          {commissionSuccess ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle2 size={64} color="#047857" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ margin: '0 0 8px' }}>Staff Commissioned!</h3>
              <p className="muted">The account has been created for <strong>{commissionForm.email}</strong>.</p>
              <div style={{ background: '#f1f5f9', padding: '24px 16px', borderRadius: '8px', margin: '24px 0', textAlign: 'center' }}>
                <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Mail size={20} color="#047857" /> 
                  Activation Email Sent Successfully
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>The staff member will receive an email with their PIN to activate their account.</p>
              <button className="btn" style={{ marginTop: 24, width: '100%' }} onClick={() => setCommissionModalOpen(false)}>Done</button>
            </div>
          ) : (
            <>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Full Name</label>
                  <input className="input" value={commissionForm.name} onChange={e => setCommissionForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Doe" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Email Address (Used for Login & Invite)</label>
                  <input type="email" className="input" value={commissionForm.email} onChange={e => setCommissionForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. jane@school.edu" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Role</label>
                  <select className="select" value={commissionForm.role} onChange={e => setCommissionForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    <option value="deputy_admin">Deputy Principal (Admin)</option>
                    <option value="deputy_academic">Deputy Principal (Academics)</option>
                    <option value="dos">Director of Studies (DoS)</option>
                    <option value="clinic">Clinic / Nurse</option>
                    <option value="librarian">Librarian</option>
                    <option value="finance">Bursar / Finance</option>
                    <option value="registrar">Registrar</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setCommissionModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCommissionStaff} disabled={commissionSaving}>
                  {commissionSaving ? 'Sending Invite...' : 'Commission Account'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}



