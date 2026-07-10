import { useOutletContext } from 'react-router-dom';
import { KpiCard, Badge } from '../../components/widgets';
import { computeRow, gradeFor } from '../../utils/grading';
import { BookOpen, BarChart3, AlertTriangle, FolderOpen, Bell, Calendar, ClipboardList, PlaneTakeoff, MessageSquare, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import EduOneWidget from '../../components/EduOneWidget';
import { upsertRow } from '../../lib/api';

export default function TeacherDashboard() {
  const { 
    store, user, teacherName, subject, assignedClass,
    loadedStudents, messages, setMessages,
    leaveRequests, setLeaveRequests, meetingRequests
  } = useOutletContext();

  const { gradeBoundaries, navigate } = store;

  // Modals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveTab, setLeaveTab] = useState('apply');

  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [replyText, setReplyText] = useState({});

  const rows = useMemo(() => {
    return loadedStudents.map((s) => {
      const scores = s.scores?.[subject];
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { ...s, ...row, grade };
    });
  }, [loadedStudents, gradeBoundaries, subject]);

  const classes = [...new Set(rows.map((r) => r.class))].sort();
  const avgOverall = rows.length ? (rows.reduce((s, r) => s + r.average, 0) / rows.length).toFixed(1) : 0;
  const atRisk = rows.filter((r) => r.average < 40).length;

  const pendingLeaves = leaveRequests.filter(l => l.status === 'Pending').length;
  const approvedLeaves = leaveRequests.filter(l => l.status === 'Approved').length;

  const quickLinks = [
    { label: 'Apply for Leave', icon: PlaneTakeoff, action: 'open_leave', color: '#059669', desc: `${pendingLeaves} pending request${pendingLeaves !== 1 ? 's' : ''}` },
    { label: 'Parent Messages', icon: MessageSquare, action: 'open_inbox', color: '#EAB308', desc: `${messages.filter(m => m.status === 'Unread').length} unread messages` },
    { label: 'Assignments & Materials', icon: FolderOpen, view: 'teacher_resources', color: '#0078D4', desc: 'Upload PDFs for students' },
    { label: 'Notices Board', icon: Bell, view: 'notices', color: '#7C3AED', desc: 'Post & read announcements' },
    { label: 'School Calendar', icon: Calendar, view: 'school_calendar', color: '#107C10', desc: 'Events & term dates' },
    { label: 'Timetable', icon: ClipboardList, view: 'timetable', color: '#0369A1', desc: 'Your teaching schedule' },
    { label: 'Gradebook', icon: BarChart3, view: 'gradebook', color: '#D13438', desc: 'Full school gradebook' },
  ];

  const submitLeaveRequest = async () => {
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason.trim()) return store.notify('Please fill in all leave fields', 'warning');
    const startDate = new Date(leaveForm.start);
    const endDate = new Date(leaveForm.end);
    if (endDate < startDate) return store.notify('End date must be after start date', 'warning');
    const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    
    setLeaveSaving(true);
    try {
      const newReq = {
        id: `lr_${Date.now()}`,
        staff_name: teacherName, staff_id: user?.id || null, dept: subject,
        type: leaveForm.type, start_date: leaveForm.start, end_date: leaveForm.end,
        days, reason: leaveForm.reason, status: 'Pending', approved_by: null,
        created_at: new Date().toISOString(),
      };
      await upsertRow('leave_requests', newReq);
      setLeaveRequests(prev => [newReq, ...prev]);
      setShowLeaveModal(false);
      setLeaveForm({ type: 'Annual', start: '', end: '', reason: '' });
      store.notify('Leave request submitted successfully!', 'success');
    } catch (e) {
      store.notify(`Failed to submit leave: ${e.message}`, 'error');
    } finally { setLeaveSaving(false); }
  };

  const handleReplyMessage = async (msgId) => {
    if (!replyText[msgId]) return;
    try {
      const msg = messages.find(m => m.id === msgId);
      const updatedMsg = { ...msg, status: 'Replied', reply: replyText[msgId], replied_at: new Date().toISOString() };
      await upsertRow('messages', updatedMsg);
      setMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
      store.notify('Reply sent successfully', 'success');
    } catch (e) { store.notify(`Failed to reply: ${e.message}`, 'error'); }
  };

  const handleMarkRead = async (msgId) => {
    try {
      const msg = messages.find(m => m.id === msgId);
      const updatedMsg = { ...msg, status: 'Read' };
      await upsertRow('messages', updatedMsg);
      setMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
    } catch (e) {
      store.notify(`Failed to mark read: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0078D4 0%, #0369A1 100%)', color: '#fff', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Welcome, {teacherName}</div>
          <div style={{ opacity: 0.85, fontSize: 14, marginTop: 4 }}>{subject} Teacher · {classes.length} class{classes.length !== 1 ? 'es' : ''}: {classes.join(', ')}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{avgOverall}%</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Subject Average</div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="stat-tiles" style={{ marginBottom: 20 }}>
        <KpiCard iconComponent={<BookOpen size={20} />} label="My Subject" value={subject} />
        <KpiCard iconComponent={<BarChart3 size={20} />} label="Total Students" value={rows.length} sub={`across ${classes.length} classes`} />
        <KpiCard iconComponent={<BarChart3 size={20} />} label="Class Average" value={`${avgOverall}%`} accent="#0369A1" />
        <KpiCard iconComponent={<AlertTriangle size={20} />} label="At Risk (<40%)" value={atRisk} accent={atRisk > 0 ? '#D13438' : '#107C10'} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <EduOneWidget store={store} user={user} />
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#475569', letterSpacing: 0.3 }}>QUICK ACTIONS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickLinks.map(q => (
            <button key={q.label} onClick={() => {
              if (q.action === 'open_leave') setShowLeaveModal(true);
              else if (q.action === 'open_inbox') setInboxModalOpen(true);
              else navigate(q.view);
            }} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: q.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><q.icon size={18} color={q.color} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{q.label}</div><div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{q.desc}</div></div>
            </button>
          ))}
        </div>
      </div>

      {/* Parent Meeting Requests */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ margin: 0, marginBottom: 12 }}>Upcoming Parent Meetings</div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Date & Time</th><th>Parent</th><th>Student</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {meetingRequests.length === 0 ? <tr><td colSpan={5} className="muted">No upcoming meetings.</td></tr> : meetingRequests.map(m => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(m.scheduled_date).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{m.parent_name}</td><td>{m.student_name}</td><td>{m.reason}</td>
                  <td><Badge color="green">Scheduled</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Modal */}
      {showLeaveModal && (
        <Modal 
          title="Leave Management" 
          onClose={() => setShowLeaveModal(false)} 
          footer={leaveTab === 'apply' ? <button className="btn btn-primary" onClick={submitLeaveRequest} disabled={leaveSaving}>{leaveSaving ? 'Submitting...' : 'Submit Request'}</button> : null}
        >
          <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <button className={`btn btn-sm ${leaveTab === 'apply' ? 'btn-primary' : ''}`} onClick={() => setLeaveTab('apply')}>Apply for Leave</button>
            <button className={`btn btn-sm ${leaveTab === 'history' ? 'btn-primary' : ''}`} onClick={() => setLeaveTab('history')}>My Requests</button>
          </div>

          {leaveTab === 'apply' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid grid-2">
                <div><label className="field-label">Start Date</label><input type="date" className="input" value={leaveForm.start} onChange={e => setLeaveForm(f => ({ ...f, start: e.target.value }))} /></div>
                <div><label className="field-label">End Date</label><input type="date" className="input" value={leaveForm.end} onChange={e => setLeaveForm(f => ({ ...f, end: e.target.value }))} /></div>
              </div>
              <div><label className="field-label">Reason</label><textarea className="input" placeholder="Briefly explain the reason for your leave..." value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} /></div>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {leaveRequests.length === 0 ? (
                <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>You have not submitted any leave requests yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leaveRequests.map(l => (
                    <div key={l.id} className="card card-pad" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{new Date(l.start_date).toLocaleDateString()} &mdash; {new Date(l.end_date).toLocaleDateString()}</div>
                        <Badge color={l.status === 'Approved' ? 'green' : l.status === 'Rejected' ? 'red' : 'yellow'}>{l.status}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>{l.reason}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Submitted on: {new Date(l.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Inbox Modal */}
      {inboxModalOpen && (
        <Modal title="Parent Messages Inbox" onClose={() => setInboxModalOpen(false)}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {messages.length === 0 ? <div className="muted" style={{textAlign:'center', padding:20}}>No messages.</div> : messages.map(m => (
              <div key={m.id} className="card card-pad" style={{ marginBottom: 16, background: m.status === 'Unread' ? '#eff6ff' : '#f8fafc', border: `1px solid ${m.status === 'Unread' ? '#bfdbfe' : '#e2e8f0'}`, borderLeft: `4px solid ${m.status === 'Unread' ? '#3b82f6' : '#94a3b8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{m.sender_name}</strong>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Parent of: {m.student_name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {m.status === 'Unread' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleMarkRead(m.id)}>Mark Read</button>
                    )}
                    <Badge color={m.status === 'Unread' ? 'blue' : m.status === 'Replied' ? 'green' : 'gray'}>{m.status}</Badge>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{m.subject}</div>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{m.body}</p>

                {m.reply ? (
                  <div style={{ marginTop: 12, padding: 12, background: '#e0f2fe', borderRadius: 6, fontSize: 13, color: '#0369a1' }}>
                    <strong>Your Reply:</strong> {m.reply}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <input type="text" className="input" style={{ flex: 1, padding: '8px 12px' }} placeholder="Type a reply..." value={replyText[m.id] || ''} onChange={e => setReplyText(p => ({ ...p, [m.id]: e.target.value }))} />
                    <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => handleReplyMessage(m.id)}>Reply</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
