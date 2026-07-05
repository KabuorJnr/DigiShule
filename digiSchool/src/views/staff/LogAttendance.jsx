import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, KpiCard, Badge } from '../../components/widgets';
import { Icon } from '../../components/icons';
import { upsertRow } from '../../lib/api';
import Modal from '../../components/Modal';
import { secondaryAuthClient, supabase } from '../../lib/supabaseClient';
import { generateSecurePassword, provisionAccount, generateSequentialUsername } from '../../utils/auth';
import RegistrationLoadingModal from '../../components/RegistrationLoadingModal';

const STATUS_COLOR = { Present: 'green', Absent: 'red', 'On Leave': 'amber' };

export default function LogAttendance() {
  const { store, user, canApprove, staff, setStaff } = useOutletContext();
  const { notify } = store;

  const [filter, setFilter] = useState('All');
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Messaging
  const [composeModal, setComposeModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'teacher', dept: '', subject: '', phone: '', empId: '', username: '' });
  const [provisionStep, setProvisionStep] = useState(null);

  const totals = useMemo(() => {
    const activeStaff = staff.filter(s => s.status !== 'Inactive');
    return {
      total: activeStaff.length,
      present: activeStaff.filter((s) => s.status === 'Present').length,
      absent: activeStaff.filter((s) => s.status === 'Absent').length,
      leave: activeStaff.filter((s) => s.status === 'On Leave').length,
    };
  }, [staff]);

  const shown = filter === 'All' 
    ? staff.filter(s => s.status !== 'Inactive') 
    : staff.filter((s) => s.status === filter && s.status !== 'Inactive');

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
    } catch (e) { console.warn('API error ignored for mock:', e.message); }
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify('Staff status updated.', 'info', 'Attendance');
  };

  const offboardStaff = async (id) => {
    const member = staff.find((s) => s.id === id);
    if (!member || !window.confirm(`Are you sure you want to offboard ${member.name}?`)) return;
    const updated = { ...member, status: 'Inactive' };
    try {
      await upsertRow('staff', {
        id: updated.id, name: updated.name, role: updated.role,
        dept: updated.dept, status: updated.status, check_in: updated.checkIn,
      });
    } catch (e) {}
    setStaff((ss) => ss.map((s) => (s.id === id ? updated : s)));
    notify(`${member.name} has been offboarded.`, 'success');
  };

  const submitAddStaff = async () => {
    if (!addForm.name || !addForm.role || !addForm.dept || !addForm.email) {
      notify('Please fill in Name, Email, Role, and Department', 'warning', 'Validation');
      return;
    }
    setProvisionStep('provisioning');
    try {
      const newStaff = {
        id: addForm.empId || `stf_${Date.now()}`, name: addForm.name, role: addForm.role,
        dept: addForm.dept, subject: addForm.subject, email: addForm.email, status: 'Present', check_in: '07:00 AM'
      };
      const staffPayload = { ...newStaff };
      delete staffPayload.email; delete staffPayload.subject;
      setProvisionStep('password');
      const tempPassword = generateSecurePassword(10);
      const username = addForm.username && addForm.username.trim() !== '' ? addForm.username.trim() : await generateSequentialUsername('TCH');
      let staffUserId = null;
      let isExisting = false;
      const { error: signUpError, data: authData } = await secondaryAuthClient.auth.signUp({
        email: addForm.email, password: tempPassword, options: { data: { role: addForm.role, full_name: addForm.name } }
      });
      isExisting = signUpError && signUpError.message.toLowerCase().includes('already');
      if (isExisting) {
        const { data: existingId, error: fetchErr } = await supabase.rpc('get_user_id_by_email', { p_email: addForm.email });
        if (fetchErr) throw new Error(`Could not fetch existing staff: ${fetchErr.message}`);
        staffUserId = existingId;
      } else if (signUpError) { throw new Error(`Auth Error: ${signUpError.message}`); } else { staffUserId = authData?.user?.id; }
      if (staffUserId) {
        const { error: profileErr } = await supabase.from('profiles').insert({
          id: staffUserId, username, full_name: addForm.name, role: addForm.role, dept: addForm.dept, teacher_id: newStaff.id, school_id: store.schoolId || null
        });
        if (profileErr && profileErr.code !== '23505') throw new Error(`Teacher Profile Error: ${profileErr.message}`);
      }
      await upsertRow('staff', staffPayload);
      setStaff(prev => [...prev, { ...newStaff, checkIn: newStaff.check_in }]);
      if (addForm.role === 'teacher') {
        const teacherObj = { id: newStaff.id, name: newStaff.name, subject: newStaff.subject || newStaff.dept, role: 'teacher', emp_id: newStaff.id, phone: addForm.phone, status: 'Active', assignedClass: null };
        if (store.addTeacher) store.addTeacher(teacherObj);
      }
      setProvisionStep('email');
      let emailSent = true;
      try {
        await provisionAccount({ email: addForm.email, username, password: tempPassword, name: addForm.name, role: addForm.role, schoolName: store.settings?.name || 'EduOne' });
      } catch (emailErr) {
        console.error('Email sending failed:', emailErr);
        emailSent = false;
      }
      setProvisionStep('done');
      setTimeout(() => {
        setProvisionStep(null); setShowAddModal(false); setAddForm({ name: '', email: '', role: 'teacher', dept: '', subject: '', phone: '', empId: '' });
        if (emailSent) {
          notify(`${newStaff.name} added & email sent!`, 'success');
        } else {
          notify(`${newStaff.name} was added, but the welcome email could not be sent.`, 'warning');
        }
      }, 1500);
    } catch (e) {
      setProvisionStep(null); notify(`Failed to add staff: ${e.message}`, 'error');
    }
  };

  return (
    <>
      <PageHeader title="Staff Management" subtitle={`Today — ${new Date().toDateString()}`} />
      
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
          {canApprove && <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Add Staff</button>}
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Check-In</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td><td>{s.role}</td><td className="muted">{s.dept}</td><td>{s.checkIn}</td>
                  <td><Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => setSelectedStaff(s)}>View Profile</button>
                      <button className="btn btn-sm" onClick={() => toggleStatus(s.id)}>Change Status</button>
                      {canApprove && <button className="btn btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => offboardStaff(s.id)}>Offboard</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No staff matching this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <Modal title="Add Staff Member" onClose={() => setShowAddModal(false)} footer={
          <div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setShowAddModal(false)}>Cancel</button><button className="btn btn-primary" onClick={submitAddStaff}>Add Staff</button></div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid grid-2">
              <div><label className="field-label">Full Name *</label><input className="input" placeholder="e.g. John Doe" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="field-label">Personal Email *</label><input className="input" type="email" placeholder="e.g. teacher@gmail.com" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Role *</label>
                <select className="select" value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="teacher">Teacher</option><option value="principal">Principal / Admin</option><option value="deputy_academic">Deputy Principal (Academics)</option><option value="deputy_admin">Deputy Principal (Admin)</option><option value="clinic">Clinic / Nurse</option><option value="librarian">Librarian</option><option value="registrar">Registrar</option><option value="finance">Bursar / Finance</option>
                </select>
              </div>
              <div><label className="field-label">Department *</label><input className="input" placeholder="e.g. Science" value={addForm.dept} onChange={e => setAddForm(p => ({ ...p, dept: e.target.value }))} /></div>
            </div>
            <div className="grid grid-2">
              <div><label className="field-label">Subject Taught</label><input className="input" placeholder="e.g. Mathematics" value={addForm.subject} onChange={e => setAddForm(p => ({ ...p, subject: e.target.value }))} /></div>
              <div><label className="field-label">Employee ID</label><input className="input" placeholder="e.g. EMP1024" value={addForm.empId} onChange={e => setAddForm(p => ({ ...p, empId: e.target.value }))} /></div>
            </div>
            <div className="grid grid-2">
              <div><label className="field-label">Phone</label><input className="input" placeholder="07XX XXX XXX" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="field-label">Username</label><input className="input" placeholder="e.g. jdoe24" value={addForm.username || ''} onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} /></div>
            </div>
          </div>
        </Modal>
      )}

      {selectedStaff && (
        <Modal title={`${selectedStaff.name}'s Profile`} onClose={() => setSelectedStaff(null)} footer={
          <div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setSelectedStaff(null)}>Close</button><button className="btn btn-primary" onClick={() => { setComposeModal(selectedStaff); setMessageForm({ subject: '', body: '' }); setSelectedStaff(null); }}>Message Staff</button></div>
        }>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0078D4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>{selectedStaff.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
            <div><h2 style={{ margin: '0 0 4px' }}>{selectedStaff.name}</h2><div style={{ color: '#64748b', fontSize: 14 }}>{selectedStaff.role} · {selectedStaff.dept}</div><div style={{ marginTop: 6 }}><Badge color={STATUS_COLOR[selectedStaff.status]}>{selectedStaff.status}</Badge></div></div>
          </div>
        </Modal>
      )}

      {composeModal && (
        <Modal title={`Message ${composeModal.name}`} onClose={() => setComposeModal(null)} footer={
          <div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setComposeModal(null)}>Cancel</button><button className="btn btn-primary" onClick={async () => {
            if (!messageForm.subject || !messageForm.body) return notify('Subject and Body required', 'warning');
            try {
              await upsertRow('messages', { id: `msg_${Date.now()}`, sender_id: user?.id || 'admin', sender_name: user?.name || user?.role || 'Admin', recipient_role: composeModal.name, student_name: 'Administration', subject: messageForm.subject, body: messageForm.body, status: 'Unread', created_at: new Date().toISOString() });
              notify(`Message sent to ${composeModal.name}`, 'success'); setComposeModal(null);
            } catch (err) { notify(`Failed to send message: ${err.message}`, 'error'); }
          }}>Send Message</button></div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="field-label">Subject</label><input className="input" placeholder="E.g. Performance Review" value={messageForm.subject} onChange={e => setMessageForm(f => ({ ...f, subject: e.target.value }))} /></div>
            <div><label className="field-label">Message</label><textarea className="input" rows={5} placeholder="Type your message here..." value={messageForm.body} onChange={e => setMessageForm(f => ({ ...f, body: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
      
      {provisionStep && <RegistrationLoadingModal step={provisionStep} />}
    </>
  );
}
