/**
 * Deputy Admin dashboard — Sneat design system.
 *
 * THE METRIC THIS DASHBOARD IS ACCOUNTABLE TO: open administrative actions.
 * The deputy's job is a queue — discipline cases, expense approvals, parent
 * meeting requests, leave. The <Spotlight> states how many items are waiting
 * and what share of the workload has been cleared; a clear queue is the goal,
 * so the target is zero. Everything below is that queue, broken out by source.
 *
 * All handlers, data fetching and modals are unchanged; only the presentation
 * layer was rebuilt.
 */

import { useState, useEffect } from 'react';
import { fmtKES } from '../data/modules';

import Modal from '../components/Modal';
import { fetchTable, upsertRow, fetchStudentByQuery } from '../lib/api';
import { exportTablePDF } from '../utils/exporters';
import MediaManager from '../components/MediaManager';
import {
  Download, UserPlus, Shield, CheckCircle2, Key, Mail, Users, Building2,
  CalendarClock, Receipt, AlertTriangle, Image as ImageIcon, Megaphone,
} from 'lucide-react';
import { secondaryAuthClient, supabase } from '../lib/supabaseClient';
import { reportError } from '../lib/errorReporter';
import { apiUrl } from '../lib/apiBase';
import { getTargets } from '../lib/targets';
import {
  SneatPage, Grid, Card, CardHead, CardBody, MetricCard, Spotlight,
  TableCard, RankList, SnBadge, SnButton, SnEmpty,
} from '../components/sneat';

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
    fetchTable('expenses').then(setExpenses).catch((e) => reportError(e, 'views.AdminDashboard'));
    fetchTable('staff').then(setDbStaff).catch((e) => reportError(e, 'views.AdminDashboard'));
    fetchTable('facilities').then(setDbFacilities).catch((e) => reportError(e, 'views.AdminDashboard'));
    fetchTable('disciplinaryRecords').then(setDbDiscipline).catch((e) => reportError(e, 'views.AdminDashboard'));
    fetchTable('parentMeetingRequests').then(setMeetingRequests).catch((e) => reportError(e, 'views.AdminDashboard'));
  }, []);

  const activeStaffList = dbStaff.filter(s => s.status !== 'Inactive');
  const presentStaff = activeStaffList.filter(s => s.status === 'Present' || s.status === 'Active' || s.status === 'active').length;
  const activeStudentsList = (students || []).filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  const operationalFac = dbFacilities.filter(f => f.status === 'Operational').length;
  const pendingLeave = 0;
  const openDiscipline = dbDiscipline.filter(d => d.status === 'Open').length;

  // ── the queue this dashboard is accountable to ──────────────────────────
  const pendingExpenses = expenses.filter(e => e.status === 'Pending');
  const pendingMeetings = meetingRequests.filter(m => m.status === 'Pending');
  const scheduledMeetings = meetingRequests.filter(m => m.status === 'Scheduled');
  const openActions = openDiscipline + pendingExpenses.length + pendingMeetings.length + pendingLeave;
  // Total decisions this term = still open + already settled.
  const settledActions =
    dbDiscipline.filter(d => d.status !== 'Open').length +
    expenses.filter(e => e.status !== 'Pending').length +
    meetingRequests.filter(m => m.status !== 'Pending').length;
  const totalActions = openActions + settledActions;
  const clearedPct = totalActions > 0 ? (settledActions / totalActions) * 100 : 100;
  // Ceiling for the queue, set in Settings → Targets (default 0 = clear it).
  const actionCeiling = getTargets(store?.settings).openActionsCeiling;
  const withinCeiling = openActions <= actionCeiling;

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

      const response = await fetch(apiUrl('/api/send-email'), {
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
    <SneatPage
      flush
      title="Administration"
      subtitle="Student affairs, facilities and staff welfare"
      actions={
        <>
          <SnButton variant="outline" onClick={() => setShowMediaManager(!showMediaManager)}>
            <ImageIcon size={15} /> {showMediaManager ? 'Back to dashboard' : 'Media gallery'}
          </SnButton>
          <SnButton variant="primary" onClick={() => navigate('notices')}>
            <Megaphone size={15} /> Post notice
          </SnButton>
        </>
      }
    >
      {showMediaManager ? (
        <MediaManager notify={notify} user={user} />
      ) : (
        <>
          {/* THE metric: the decision queue. Target is an empty queue. */}
          <Spotlight
            eyebrow={`Open administrative actions — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
            value={openActions}
            caption={
              openActions === 0
                ? 'Queue is clear. Nothing is waiting on an administrative decision.'
                : `${openDiscipline} discipline case${openDiscipline === 1 ? '' : 's'}, ` +
                  `${pendingExpenses.length} expense approval${pendingExpenses.length === 1 ? '' : 's'} and ` +
                  `${pendingMeetings.length} parent meeting request${pendingMeetings.length === 1 ? '' : 's'} need a decision.`
            }
            progress={clearedPct}
            target={{
              label: 'Queue ceiling',
              value: withinCeiling ? `${actionCeiling} — met` : `${actionCeiling}`,
            }}
            stats={[
              { label: 'Discipline cases', value: openDiscipline },
              { label: 'Expense approvals', value: pendingExpenses.length },
              { label: 'Meeting requests', value: pendingMeetings.length },
            ]}
          />

          <Grid cols={4}>
            <MetricCard label="Total students" value={activeStudentsList.length}
              icon={<Users />} tone="primary" foot="Active registry" />
            <MetricCard label="Active staff" value={activeStaffList.length}
              icon={<Shield />} tone="info" foot={`${presentStaff} present today`} />
            <MetricCard label="Facilities" value={dbFacilities.length}
              icon={<Building2 />} tone="secondary" foot={`${operationalFac} operational`}
              progress={dbFacilities.length ? { value: operationalFac, max: dbFacilities.length, tone: 'success' } : undefined} />
            <MetricCard label="Pending leave" value={pendingLeave}
              icon={<CalendarClock />} tone={pendingLeave > 0 ? 'warning' : 'success'} foot="Awaiting approval" />
          </Grid>

          <Card>
            <CardHead title="Principal actions" subtitle="Privileged operations" />
            <CardBody>
              <Grid cols={3}>
                <SnButton variant="outline" onClick={() => setReportDisciplineOpen(true)}>
                  <Shield size={16} /> File disciplinary report
                </SnButton>
                <SnButton variant="primary" onClick={() => setCommissionModalOpen(true)}>
                  <UserPlus size={16} /> Commission staff
                </SnButton>
                <SnButton variant="outline" onClick={() => setResetPasswordOpen(true)}>
                  <Key size={16} /> Reset staff password
                </SnButton>
              </Grid>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Quick actions" subtitle="Jump to a module" />
            <CardBody>
              <Grid cols={3}>
                {[
                  ['staff_attendance', 'Staff attendance'],
                  ['facilities', 'Facilities management'],
                  ['admissions', 'Student records'],
                  ['notices', 'Post notice'],
                  ['finance', 'Finance overview'],
                  ['clinic', 'Health / clinic'],
                  ['library', 'Library'],
                  ['class_teachers', 'Class teachers'],
                  ['settings', 'Settings'],
                ].map(([route, label]) => (
                  <SnButton key={route} variant="ghost" onClick={() => navigate(route)}>{label}</SnButton>
                ))}
              </Grid>
            </CardBody>
          </Card>

          <Grid cols={2}>
            <Card>
              <CardHead
                title="Discipline cases"
                subtitle={`${openDiscipline} open`}
                action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SnButton variant="ghost" onClick={handleDownloadDiscipline} title="Download records">
                      <Download size={14} />
                    </SnButton>
                    <SnButton variant="primary" onClick={() => setReportDisciplineOpen(true)}>File report</SnButton>
                  </div>
                }
              />
              <CardBody>
                {dbDiscipline.length === 0 ? (
                  <SnEmpty icon={<Shield />} title="No discipline cases" message="Filed reports will appear here." />
                ) : (
                  <div className="sn-list">
                    {dbDiscipline.slice(0, 5).map(d => (
                      <div
                        key={d.id}
                        className="sn-list-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setDisciplineModal(d)}
                      >
                        <span className={`sn-icon sn-icon-${d.status === 'Open' ? 'danger' : 'success'}`}><Shield /></span>
                        <div className="sn-list-main">
                          <p className="sn-list-title">{d.student} — {d.category}</p>
                          <p className="sn-list-sub">{d.description}</p>
                          <p className="sn-list-sub">{d.date} · {d.class}</p>
                        </div>
                        <SnBadge tone={d.status === 'Open' ? 'danger' : 'success'}>{d.status}</SnBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Facilities"
                subtitle={`${operationalFac} of ${dbFacilities.length} operational`}
                action={<SnButton variant="ghost" onClick={() => navigate('facilities')}>Manage</SnButton>}
              />
              <CardBody>
                <RankList
                  empty={<SnEmpty icon={<Building2 />} title="No facilities" message="Add facilities to track their status." />}
                  items={dbFacilities.slice(0, 5).map(f => ({
                    id: f.id,
                    title: f.name,
                    sub: `${f.type} · capacity ${f.capacity}`,
                    icon: <Building2 />,
                    tone: f.status === 'Operational' ? 'success' : 'warning',
                    value: f.status,
                  }))}
                />
              </CardBody>
            </Card>
          </Grid>

          <Grid cols={2}>
            <Card>
              <CardHead
                title="Pending leave requests"
                subtitle={`${pendingLeave} awaiting decision`}
                action={<SnButton variant="ghost" onClick={() => navigate('staff/leave')}>Manage leave</SnButton>}
              />
              <CardBody>
                <SnEmpty icon={<CalendarClock />} title="No pending requests" message="Staff leave awaiting approval will appear here." />
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Expense approvals"
                subtitle={`${pendingExpenses.length} awaiting decision`}
                action={<SnButton variant="ghost" onClick={() => navigate('finance')}>Finance module</SnButton>}
              />
              <CardBody>
                {pendingExpenses.length === 0 ? (
                  <SnEmpty icon={<Receipt />} title="No pending expenses" message="Claims awaiting sign-off will appear here." />
                ) : (
                  <div className="sn-list">
                    {pendingExpenses.map(e => (
                      <div key={e.id} className="sn-list-item">
                        <span className="sn-icon sn-icon-warning"><Receipt /></span>
                        <div className="sn-list-main">
                          <p className="sn-list-title">
                            {e.category} <span className="sn-muted" style={{ fontWeight: 400 }}>via {e.requested_by}</span>
                          </p>
                          <p className="sn-list-title" style={{ fontSize: '1rem' }}>{fmtKES(e.amount)}</p>
                          <p className="sn-list-sub">{e.description}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <SnButton variant="primary" onClick={() => handleExpenseAction(e, 'Approved')}>Approve</SnButton>
                          <SnButton variant="ghost" onClick={() => handleExpenseAction(e, 'Rejected')}>Reject</SnButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Grid>

          <Grid cols={2}>
            <Card>
              <CardHead title="Parent meeting requests" subtitle={`${pendingMeetings.length} awaiting decision`} />
              <CardBody>
                {pendingMeetings.length === 0 ? (
                  <SnEmpty icon={<CalendarClock />} title="No pending requests" message="Parent meeting requests will appear here." />
                ) : (
                  <div className="sn-list">
                    {pendingMeetings.map(m => (
                      <div key={m.id} className="sn-list-item" style={{ alignItems: 'flex-start' }}>
                        <div className="sn-list-main">
                          <p className="sn-list-title">
                            {m.parent_name} <span className="sn-muted" style={{ fontWeight: 400 }}>(student: {m.student_name})</span>
                          </p>
                          <p className="sn-list-sub">Requested staff: {m.teacher_name}</p>
                          <p style={{ fontSize: 13, margin: '4px 0 0' }}>&ldquo;{m.reason}&rdquo;</p>
                          <p className="sn-list-sub">Requested {new Date(m.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <SnButton
                            variant="primary"
                            onClick={() => {
                              setSelectedMeeting(m);
                              setScheduleForm({ date: '', time: '', teacher_name: m.teacher_name });
                              setScheduleMeetingOpen(true);
                            }}
                          >
                            Schedule
                          </SnButton>
                          <SnButton variant="ghost" onClick={() => handleRejectMeeting(m)}>Reject</SnButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <TableCard
              title="Upcoming meetings"
              subtitle={`${scheduledMeetings.length} scheduled`}
              action={<SnButton variant="ghost" onClick={() => navigate('school_calendar')}>Calendar</SnButton>}
              rows={[...scheduledMeetings].sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))}
              rowKey={(m) => m.id}
              empty={<SnEmpty icon={<CalendarClock />} title="No scheduled meetings" message="Confirmed parent meetings will appear here." />}
              columns={[
                {
                  key: 'when', header: 'When',
                  render: (m) => new Date(m.scheduled_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
                },
                {
                  key: 'who', header: 'Meeting',
                  render: (m) => (
                    <>
                      <span className="sn-td-strong">{m.parent_name}</span>
                      <br />
                      <span className="sn-muted" style={{ fontSize: 12 }}>with {m.teacher_name}</span>
                    </>
                  ),
                },
                { key: 'status', header: 'Status', render: () => <SnBadge tone="success">Scheduled</SnBadge> },
              ]}
            />
          </Grid>
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
            {disciplineModal.status === 'Open' ? (
              <button className="btn btn-primary" onClick={async () => {
                try {
                  const updated = { ...disciplineModal, status: 'Resolved' };
                  await upsertRow('disciplinaryRecords', updated);
                  setDbDiscipline(prev => prev.map(item => item.id === updated.id ? updated : item));
                  setDisciplineModal(null);
                  notify('Case marked as resolved', 'success');
                } catch (err) {
                  notify(`Failed to resolve case: ${err.message}`, 'error');
                }
              }}>Mark Resolved</button>
            ) : (
              <button className="btn" onClick={async () => {
                try {
                  const updated = { ...disciplineModal, status: 'Open' };
                  await upsertRow('disciplinaryRecords', updated);
                  setDbDiscipline(prev => prev.map(item => item.id === updated.id ? updated : item));
                  setDisciplineModal(null);
                  notify('Case re-opened', 'success');
                } catch (err) {
                  notify(`Failed to re-open case: ${err.message}`, 'error');
                }
              }}>Re-open Case</button>
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
    </SneatPage>
  );
}



