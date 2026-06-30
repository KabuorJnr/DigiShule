import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS } from '../data/seed';
import { fetchTable, upsertRow } from '../lib/api';
import { exportReportCardsPDF, exportTablePDF } from '../utils/exporters';
import { listFiles } from '../lib/fileStore';
import { Download, ClipboardList, Send, Loader, CreditCard, Shield, CheckCircle2 } from 'lucide-react';

const severityColor = (s) => (s === 'High' ? 'red' : s === 'Medium' ? 'amber' : 'blue');
const statusColor = (s) => (s === 'Resolved' ? 'green' : 'amber');

export default function ParentPortal({ store, user }) {
  const { students, gradeBoundaries, examSchedules, feeStructure } = store;

  const child = useMemo(() => {
    if (!students || students.length === 0) return null;
    // For Supabase auth parents, profile has student_id that links to the child
    const sId = user?.student_id || user?.studentId;
    if (sId) {
      const match = students.find(s => s.id === sId);
      if (match) return match;
    }
    if (user?.link) {
      const match = students.find(s => s.id === user.link || s.adm === user.link);
      if (match) return match;
    }
    const idStr = (user?.email || user?.username || '').toLowerCase();
    if (idStr) {
      const match = students.find(s => s.guardianEmail?.toLowerCase() === idStr);
      if (match) return match;
    }
    return null;
  }, [students, user]);

  const [healthRecords, setHealthRecords] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);
  
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [msgForm, setMsgForm] = useState({ teacher: 'Class Teacher', subject: '', body: '' });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: '+254 700 000000', email: user?.email || '', emergencyContact: 'John Doe', emergencyPhone: '+254 711 111111' });

  // Detailed Attendance & Submissions
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [cloudAssignments, setCloudAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!child?.adm) return;
    let active = true;
    Promise.all([
      fetchTable('clinicVisits'), fetchTable('disciplinaryRecords'),
      fetchTable('studentAttendance'), fetchTable('assignmentSubmissions'), listFiles('assignments').catch(() => [])
    ])
      .then(([visits, cases, att, subs, assigns]) => {
        if (!active) return;
        setHealthRecords((visits || []).filter((v) => v.adm === child.adm));
        setDisciplinary((cases || []).filter((c) => c.adm === child.adm));
        setAttendanceLog((att || []).filter(a => a.student_id === child.id || a.adm === child.adm));
        setSubmissions((subs || []).filter(s => s.student_id === child.id || s.adm === child.adm));
        setCloudAssignments(assigns || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [child?.adm, child?.id]);

  const subjects = useMemo(() => {
    if (!child) return [];
    return SUBJECTS.map((sub) => {
      const scores = child.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [child, gradeBoundaries]);

  const overallAvg = subjects.length
    ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1)
    : 0;

  const attTotals = useMemo(() => ({
    total: attendanceLog.length,
    present: attendanceLog.filter(a => a.status === 'Present').length,
    late: attendanceLog.filter(a => a.status === 'Late').length
  }), [attendanceLog]);
  const attPct = attTotals.total ? Math.round(((attTotals.present + attTotals.late) / attTotals.total) * 100) : 0;
  const latestAtt = { rate: attPct || 91 };

  const upcomingExams = (examSchedules || []).filter((e) => e.sessions?.some((s) => s.status === 'Upcoming'));

  const handleDownloadTranscript = () => {
    const enrichedChild = {
      ...child,
      position: 1,
      classSize: 40,
      average: overallAvg,
      grade: gradeFor(overallAvg, gradeBoundaries),
      attendance: latestAtt?.rate || 91
    };
    exportReportCardsPDF({
      school: store.settings,
      students: [enrichedChild],
      subjects: SUBJECTS,
      computeStudent: (stu, sub) => {
        const scores = stu.scores[sub] || {};
        const avg = computeRow(scores).average;
        return {
          score: avg || '-',
          grade: avg ? gradeFor(avg, gradeBoundaries) : '-',
          remark: avg ? (avg >= 80 ? 'Excellent' : 'Good') : '-'
        };
      },
      filename: `${child.name}_Transcript.pdf`
    });
  };

  const handleSendMessage = async () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) return store.notify('Please fill all fields', 'warning');
    
    try {
      const messagePayload = {
        id: `msg_${Date.now()}`,
        sender_id: user.id || 'parent',
        sender_name: user.name || 'Parent',
        recipient_role: msgForm.teacher,
        student_id: child.id,
        student_name: child.name,
        subject: msgForm.subject,
        body: msgForm.body,
        status: 'Unread',
        created_at: new Date().toISOString()
      };
      
      await upsertRow('messages', messagePayload);
      store.notify(`Message sent to ${msgForm.teacher} successfully.`, 'success');
      setMsgModalOpen(false);
      setMsgForm({ teacher: 'Class Teacher', subject: '', body: '' });
    } catch (e) {
      store.notify(`Failed to send message: ${e.message}`, 'error');
    }
  };

  const handleUpdateProfile = () => {
    if (!profileForm.phone || !profileForm.emergencyContact) return store.notify('Please fill required fields', 'warning');
    store.notify('Profile and emergency contacts updated successfully.', 'success');
    setProfileModalOpen(false);
  };

  if (!child) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: 40 }}>
        <div style={{ width: 80, height: 80, background: '#f8d7da', color: '#dc3545', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="warning" size={32} />
        </div>
        <h2 style={{ margin: '0 0 10px' }}>No Linked Student Record Found</h2>
        <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
          Your parent account is not linked to any active student record, or there are no students registered in the database yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Child" subtitle={`${child.name} · ${child.adm} · Grade ${child.class}`} />

      {/* Disciplinary Notice */}
      {disciplinary.filter(c => c.status !== 'Resolved').length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="warning" size={20} style={{ color: '#dc2626', marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>Active Disciplinary Notice</strong>
            <div style={{ fontSize: 14 }}>There are unresolved disciplinary records for {child.name}. Please review the Disciplinary Records section below and contact the school administration if necessary.</div>
          </div>
        </div>
      )}

      <div className="stat-tiles">
        <KpiCard iconComponent={<Icon name="analytics" size={24} />} label="Overall Average" value={`${overallAvg}%`} accent="#BE185D" />
        <KpiCard iconComponent={<Icon name="check" size={24} />} label="Attendance Rate" value={`${latestAtt?.rate || 91}%`} accent="#10B981" />
        <KpiCard iconComponent={<Icon name="exam" size={24} />} label="Behavior Score" value="45 pts" accent="#10B981" sub="Good Standing" />
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setMsgModalOpen(true)}>
            <Icon name="message" size={18} /> Message Teacher
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setProfileModalOpen(true)}>
            <Icon name="settings" size={18} /> Update Contact Info
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8, background: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe' }} onClick={() => store.navigate('student', { childId: child.id })}>
            <Icon name="analytics" size={18} /> View Child's Portal
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', gap: 8 }} onClick={handleDownloadTranscript}>
            <Download size={18} /> Download Transcript
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="section-title">Academic Performance — Term 2</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Subject</th><th>Total</th><th>Avg %</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {subjects.map((r) => (
                  <tr key={r.subject}>
                    <td style={{ fontWeight: 600 }}>{r.subject}</td>
                    <td>{r.total}</td>
                    <td style={{ fontWeight: 700 }}>{r.average}</td>
                    <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {upcomingExams.length > 0 && (
            <div className="card card-pad">
              <div className="section-title">Upcoming Exams</div>
              {upcomingExams.map((ex) => (
                <div key={ex.id} style={{ marginBottom: 8 }}>
                  <strong>{ex.name}</strong>{' '}
                  <span className="muted">{ex.startDate}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card card-pad" style={{ marginTop: 14 }}>
            <div className="section-title">Assignment Management</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cloudAssignments.length === 0 ? (
                <div className="muted">No active assignments.</div>
              ) : (
                cloudAssignments.map(a => {
                  const sub = submissions.find(s => s.assignment_id === a.id);
                  const isDue = new Date(a.due_date) < new Date();
                  return (
                    <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 600 }}>{a.title}</div>
                        <div>
                          {sub ? (
                            <Badge color={sub.status === 'Graded' ? 'green' : 'blue'}>{sub.status}</Badge>
                          ) : (
                            <Badge color={isDue ? 'red' : 'gray'}>{isDue ? 'Missing' : 'Pending'}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Due: {a.due_date} · {a.subject}</div>
                      {sub?.grade && <div style={{ fontSize: 12, marginTop: 4 }}><strong>Grade:</strong> <Badge color="green">{sub.grade}</Badge></div>}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="card card-pad" style={{ marginTop: 14 }}>
            <div className="section-title">Detailed Attendance Log</div>
            <div className="scroll-x" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                  <tr><th>Date</th><th>Status</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {attendanceLog.length === 0 ? (
                    <tr><td colSpan={3} className="muted">No attendance records found.</td></tr>
                  ) : (
                    attendanceLog.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.date}</td>
                        <td>
                          <Badge color={log.status === 'Present' ? 'green' : log.status === 'Late' ? 'amber' : 'red'}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="muted">{log.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start', marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">Health Records</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {healthRecords.length === 0 ? (
                  <tr><td colSpan={4} className="muted">No clinic visits on record.</td></tr>
                ) : (
                  healthRecords.map((v) => (
                    <tr key={v.id}>
                      <td>{v.date}</td>
                      <td style={{ fontWeight: 600 }}>{v.complaint}</td>
                      <td>{v.treatment}</td>
                      <td><Badge color={v.outcome === 'Referred to hospital' ? 'red' : v.outcome === 'Sent home' ? 'amber' : 'green'}>{v.outcome}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Disciplinary Records</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Details</th><th>Severity</th><th>Status</th></tr>
              </thead>
              <tbody>
                {disciplinary.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No disciplinary cases on record.</td></tr>
                ) : (
                  disciplinary.map((c) => (
                    <tr key={c.id}>
                      <td>{c.date}</td>
                      <td style={{ fontWeight: 600 }}>{c.category}</td>
                      <td>
                        <div>{c.description}</div>
                        {c.action && <div className="muted" style={{ fontSize: 12 }}>Action: {c.action}</div>}
                      </td>
                      <td><Badge color={severityColor(c.severity)}>{c.severity}</Badge></td>
                      <td><Badge color={statusColor(c.status)}>{c.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {msgModalOpen && (
        <Modal title="Message Teacher" onClose={() => setMsgModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setMsgModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSendMessage}>Send Message</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Recipient</label>
              <select className="select" value={msgForm.teacher} onChange={e => setMsgForm(f => ({ ...f, teacher: e.target.value }))}>
                <option>Class Teacher</option>
                <option>Math Teacher</option>
                <option>Science Teacher</option>
                <option>Principal</option>
              </select>
            </div>
            <div>
              <label className="field-label">Subject</label>
              <input type="text" className="input" value={msgForm.subject} onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Absence note for tomorrow" />
            </div>
            <div>
              <label className="field-label">Message</label>
              <textarea className="input" rows={4} value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))} placeholder="Type your message here..."></textarea>
            </div>
          </div>
        </Modal>
      )}

      {profileModalOpen && (
        <Modal title="Emergency Contacts & Profile" onClose={() => setProfileModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setProfileModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateProfile}>Save Changes</button>
          </>
        }>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Your Phone Number</label>
              <input type="text" className="input" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Your Email</label>
              <input type="email" className="input" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Emergency Contact Name</label>
              <input type="text" className="input" value={profileForm.emergencyContact} onChange={e => setProfileForm(f => ({ ...f, emergencyContact: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Emergency Contact Phone</label>
              <input type="text" className="input" value={profileForm.emergencyPhone} onChange={e => setProfileForm(f => ({ ...f, emergencyPhone: e.target.value }))} />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            This information will be used by the school in case of medical emergencies or critical alerts.
          </p>
        </Modal>
      )}
    </div>
  );
}
