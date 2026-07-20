import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { upsertRow } from '../../lib/api';
import Modal from '../../components/Modal';

export default function Recruitment() {
  const { store, canApprove, jobApps, setJobApps } = useOutletContext();
  const { notify } = store;

  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ date: '', time: '', type: 'In-person', notes: '' });
  const [selectedApp, setSelectedApp] = useState(null);
  
  if (!canApprove) return null;

  const scheduleInterview = async () => {
    if (!interviewForm.date || !interviewForm.time) {
      notify('Please select date and time', 'warning');
      return;
    }
    const updated = {
      ...selectedApp, status: 'Interview Scheduled',
      interview_date: interviewForm.date, interview_time: interviewForm.time,
      interview_type: interviewForm.type, notes: interviewForm.notes
    };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
      await upsertRow('schoolEvents', {
        id: `ev_int_${Date.now()}`,
        title: `Interview: ${updated.applicant_name} (${updated.role})`,
        desc: `${updated.interview_type} interview. Notes: ${updated.notes}`,
        date: updated.interview_date, type: 'meeting'
      });
      notify('Interview scheduled and added to calendar', 'success');
      setShowInterviewModal(false);
    } catch (e) {
      notify(`Error scheduling interview: ${e.message}`, 'error');
    }
  };

  const hireApplicant = async (app) => {
    // Ideally this would trigger the add staff modal from LogAttendance, 
    // but for now we just mark as hired
    const updated = { ...app, status: 'Hired' };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
      notify(`Applicant ${app.applicant_name} hired! You can now add them to the system.`, 'success');
    } catch (e) { console.error(e); }
  };

  const rejectApplicant = async (app) => {
    const updated = { ...app, status: 'Rejected' };
    try {
      await upsertRow('job_applications', updated);
      setJobApps(prev => prev.map(a => a.id === updated.id ? updated : a));
      notify(`Applicant ${app.applicant_name} rejected`, 'info');
    } catch (e) { console.error(e); }
  };

  return (
    <>
      <div className="card card-pad">
        <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Job Applications</h3>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Applicant</th><th>Applied Role</th><th>Exp. (Yrs)</th><th>Applied Date</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {jobApps.map(app => (
                <tr key={app.id}>
                  <td><div style={{ fontWeight: 600 }}>{app.applicant_name}</div><div className="muted" style={{ fontSize: 11 }}>{app.email}</div></td>
                  <td><div style={{ fontWeight: 600 }}>{app.role}</div><div className="muted" style={{ fontSize: 11 }}>{app.department}</div></td>
                  <td>{app.experience_years} yrs</td><td className="muted">{app.applied_date}</td>
                  <td><Badge color={app.status === 'Hired' ? 'green' : app.status === 'Rejected' ? 'red' : app.status === 'Interview Scheduled' ? 'blue' : 'amber'}>{app.status}</Badge></td>
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
              {jobApps.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No active job applications.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showInterviewModal && selectedApp && (
        <Modal title={`Schedule Interview: ${selectedApp.applicant_name}`} onClose={() => setShowInterviewModal(false)} footer={
          <div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setShowInterviewModal(false)}>Cancel</button><button className="btn btn-primary" onClick={scheduleInterview}>Schedule & Add to Calendar</button></div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid grid-2">
              <div><label className="field-label">Date *</label><input type="date" className="input" value={interviewForm.date} onChange={e => setInterviewForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label className="field-label">Time *</label><input type="time" className="input" value={interviewForm.time} onChange={e => setInterviewForm(f => ({ ...f, time: e.target.value }))} /></div>
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="select" value={interviewForm.type} onChange={e => setInterviewForm(f => ({ ...f, type: e.target.value }))}>
                <option>In-person</option><option>Video Call (Zoom/Meet)</option><option>Phone Call</option>
              </select>
            </div>
            <div><label className="field-label">Email Address (for Invite)</label><input type="email" className="input" placeholder="applicant@example.com" value={interviewForm.email} onChange={e => setInterviewForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="field-label">Notes / Instructions</label><textarea className="input" rows={3} placeholder="e.g. Bring copies of certificates" value={interviewForm.notes} onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}



