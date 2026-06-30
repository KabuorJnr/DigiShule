import { useMemo, useState, useEffect } from 'react';
import { KpiCard, Badge } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { BookOpen, BarChart3, AlertTriangle, FolderOpen, Bell, Calendar, ClipboardList, Printer, Users, Award, MessageSquare, PlaneTakeoff, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { fetchTable, upsertRow } from '../lib/api';

export default function TeacherPortal({ store, user }) {
  const { gradeBoundaries, navigate } = store;
  const teacherName = user?.name || 'Teacher';
  const subject = user?.dept || 'Mathematics';

  const teacherProfile = useMemo(() => store.teachers.find(t => t.name === teacherName) || {}, [store.teachers, teacherName]);
  const assignedClass = teacherProfile.assignedClass || null;

  const [loadedStudents, setLoadedStudents] = useState([]);
  
  useEffect(() => {
    let active = true;
    import('../lib/api').then(({ fetchStudents }) => {
      // Fetch up to 200 students for quick overview, typically from their assigned class
      fetchStudents(0, 200, { class: assignedClass || null }).then(res => {
        if (active) setLoadedStudents(res.data);
      }).catch(() => {});
    });
    return () => { active = false; };
  }, [assignedClass]);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [behaviorModalOpen, setBehaviorModalOpen] = useState(false);
  const [behaviorForm, setBehaviorForm] = useState({ student: '', type: 'Merit', points: 5, notes: '' });

  const [messages, setMessages] = useState([]);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [editing, setEditing] = useState(null);

  // ── Leave Application State ──
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Annual', start: '', end: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveTab, setLeaveTab] = useState('apply'); // 'apply' | 'history'

  useEffect(() => {
    let active = true;
    import('../lib/api').then(({ fetchTable }) => {
      fetchTable('messages').then(res => {
        if (!active) return;
        const allMsgs = res || [];
        const myMsgs = allMsgs.filter(m => {
          if (m.recipient_role === 'Class Teacher' && assignedClass) return true;
          if (m.recipient_role.includes(subject)) return true;
          if (m.recipient_role === teacherName) return true;
          return false;
        });
        setMessages(myMsgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      });
    });
    return () => { active = false; };
  }, [assignedClass, subject]);

  // ── Load Leave Requests ──
  useEffect(() => {
    let active = true;
    fetchTable('leave_requests').then(rows => {
      if (!active) return;
      const myLeaves = (rows || []).filter(l => l.staff_name === teacherName || l.staff_id === user?.id);
      setLeaveRequests(myLeaves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch(() => {});
    return () => { active = false; };
  }, [teacherName, user?.id]);

  const handleLogBehavior = () => {
    if (!behaviorForm.student) return store.notify('Please select a student', 'warning');
    store.notify(`Logged ${behaviorForm.type} (${behaviorForm.points} pts) for ${behaviorForm.student}.`, 'success');
    setBehaviorModalOpen(false);
    setBehaviorForm({ student: '', type: 'Merit', points: 5, notes: '' });
  };

  // ── Submit Leave Request ──
  const submitLeaveRequest = async () => {
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason.trim()) {
      store.notify('Please fill in all leave fields', 'warning', 'Leave');
      return;
    }
    const startDate = new Date(leaveForm.start);
    const endDate = new Date(leaveForm.end);
    if (endDate < startDate) {
      store.notify('End date must be after start date', 'warning', 'Leave');
      return;
    }
    const days = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    
    setLeaveSaving(true);
    try {
      const newReq = {
        id: `lr_${Date.now()}`,
        staff_name: teacherName,
        staff_id: user?.id || null,
        dept: subject,
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
      store.notify('Leave request submitted successfully! Your HOD/Principal will review it.', 'success', 'Leave');
    } catch (e) {
      store.notify(`Failed to submit leave: ${e.message}`, 'error', 'Leave');
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleReplyMessage = async (msgId) => {
    if (!replyText[msgId]) return;
    try {
      const { upsertRow } = await import('../lib/api');
      const msg = messages.find(m => m.id === msgId);
      const updatedMsg = { ...msg, status: 'Replied', reply: replyText[msgId], replied_at: new Date().toISOString() };
      await upsertRow('messages', updatedMsg);
      setMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
      store.notify('Reply sent successfully', 'success');
    } catch (e) {
      store.notify(`Failed to reply: ${e.message}`, 'error');
    }
  };

  const handleExportAttendanceSummary = async () => {
    store.notify('Downloading Class Attendance Summary PDF...', 'info');
    const { exportTablePDF } = await import('../utils/exporters');
    const head = ['Student Name', 'Present', 'Absent', 'Late', 'Attendance %'];
    const body = loadedStudents.filter(s => s.class === assignedClass).map(s => [
      s.name, '45', '2', '1', '95%'
    ]);
    exportTablePDF({
      school: store.settings,
      title: `Attendance Summary - ${assignedClass}`,
      subtitle: 'Term 2',
      head, body, filename: `attendance_summary_${assignedClass}.pdf`
    });
  };

  const handleExportAttendanceReport = async () => {
    store.notify('Downloading Students Attendance Report CSV...', 'info');
    const { downloadCSV } = await import('../utils/exporters');
    const rows = [
      ['Student Name', 'Date', 'Status', 'Remarks'],
      ['John Doe', '2026-06-20', 'Present', ''],
      ['Jane Smith', '2026-06-20', 'Absent', 'Sick leave']
    ];
    downloadCSV(`attendance_report_${assignedClass}.csv`, rows);
  };

  function saveScore(id, field, value) {
    const v = Math.max(0, Math.min(4, Number(value) || 0));
    const target = loadedStudents.find((s) => s.id === id);
    if (target) {
      const currentScores = target.scores || {};
      const subjectScores = currentScores[subject] || {};
      const updated = { ...target, scores: { ...currentScores, [subject]: { ...subjectScores, [field]: v } } };
      store.updateStudent(updated);
      setLoadedStudents(prev => prev.map(s => s.id === id ? updated : s));
    }
    setEditing(null);
  }

  const ScoreCell = ({ r, field }) => {
    const isEditing = editing && editing.id === r.id && editing.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            style={{ width: '48px', height: '28px', padding: '0 4px', border: '1px solid #2563eb', borderRadius: '4px', outline: 'none' }}
            type="number"
            autoFocus
            defaultValue={r[field]}
            onKeyDown={(e) => { if (e.key === 'Enter') saveScore(r.id, field, e.target.value); if (e.key === 'Escape') setEditing(null); }}
            onBlur={(e) => saveScore(r.id, field, e.target.value)}
          />
        </td>
      );
    }
    return <td style={{ cursor: 'pointer', minWidth: '40px', fontWeight: 600, color: '#0369A1' }} onClick={() => setEditing({ id: r.id, field })} title="Click to edit (1-4)">{r[field] || '-'}</td>;
  };

  const rows = useMemo(() => {
    return loadedStudents
      .filter((s) => s.scores?.[subject])
      .map((s) => {
        const scores = s.scores[subject];
        const row = computeRow(scores);
        const grade = gradeFor(row.average, gradeBoundaries);
        return { ...s, ...row, grade };
      });
  }, [loadedStudents, gradeBoundaries, subject]);

  const classes = [...new Set(rows.map((r) => r.class))].sort();
  const avgOverall = rows.length
    ? (rows.reduce((s, r) => s + r.average, 0) / rows.length).toFixed(1)
    : 0;
  const atRisk = rows.filter((r) => r.average < 40).length;
  const topPerformer = rows.reduce((best, r) => (!best || r.average > best.average ? r : best), null);

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

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0078D4 0%, #0369A1 100%)',
        color: '#fff', borderRadius: 12, padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Welcome, {teacherName}</div>
          <div style={{ opacity: 0.85, fontSize: 14, marginTop: 4 }}>
            {subject} Teacher · {classes.length} class{classes.length !== 1 ? 'es' : ''}: {classes.join(', ')}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{avgOverall}%</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Subject Average</div>
        </div>
      </div>

      {/* Class Teacher Banner */}
      {assignedClass && (
        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f766e', fontWeight: 700, fontSize: 16 }}>
              <Users size={18} /> Class Teacher: {assignedClass}
            </div>
            <div style={{ color: '#0f766e', opacity: 0.8, fontSize: 13, marginTop: 4 }}>
              You are assigned to manage {assignedClass}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ background: '#0f766e', borderColor: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setBehaviorModalOpen(true)}>
              <Award size={16} /> Log Behavior
            </button>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExportAttendanceSummary}>
              <Printer size={16} /> Attendance Summary (PDF)
            </button>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExportAttendanceReport}>
              <Printer size={16} /> Attendance Report (CSV)
            </button>
          </div>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="stat-tiles" style={{ marginBottom: 20 }}>
        <KpiCard iconComponent={<BookOpen size={20} />} label="My Subject" value={subject} />
        <KpiCard iconComponent={<BarChart3 size={20} />} label="Total Students" value={rows.length} sub={`across ${classes.length} classes`} />
        <KpiCard iconComponent={<BarChart3 size={20} />} label="Class Average" value={`${avgOverall}%`} accent="#0369A1" />
        <KpiCard iconComponent={<AlertTriangle size={20} />} label="At Risk (<40%)" value={atRisk} accent={atRisk > 0 ? '#D13438' : '#107C10'} />
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#475569', letterSpacing: 0.3 }}>QUICK ACTIONS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickLinks.map(q => (
            <button
              key={q.label}
              onClick={() => {
                if (q.action === 'open_leave') setShowLeaveModal(true);
                else if (q.action === 'open_inbox') setInboxModalOpen(true);
                else navigate(q.view);
              }}
              style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
                padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = q.color; e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.1)`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, background: q.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <q.icon size={18} color={q.color} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{q.label}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{q.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Gradebook Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>{subject} — Student Results</div>
          {topPerformer && (
            <div style={{ fontSize: 12, color: '#107C10', background: '#f0fdf4', borderRadius: 6, padding: '4px 10px', border: '1px solid #bbf7d0' }}>
              Top: {topPerformer.name} ({topPerformer.average}%)
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <BarChart3 size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
            <div className="muted">No student scores found for {subject}</div>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Student</th><th>Adm No.</th><th>Class</th>
                  <th>Ass. 1</th><th>Ass. 2</th><th>Ass. 3</th><th>Ass. 4</th>
                  <th>Avg Rubric</th><th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => b.average - a.average)
                  .map((r, i) => (
                    <tr key={r.id}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="muted">{r.adm}</td>
                      <td><Badge color="gray">{r.class}</Badge></td>
                      <ScoreCell r={r} field="a1" />
                      <ScoreCell r={r} field="a2" />
                      <ScoreCell r={r} field="a3" />
                      <ScoreCell r={r} field="a4" />
                      <td style={{ fontWeight: 700 }}>{r.average || '-'}</td>
                      <td>
                        <Badge color={r.grade === 'EE' || r.grade === 'ME' ? 'green' : r.grade === 'AE' ? 'amber' : 'red'}>
                          {r.grade}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Class List Modal */}
      {printModalOpen && assignedClass && (
        <>
          <div className="modal-overlay" onMouseDown={() => setPrintModalOpen(false)} />
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>{assignedClass} — Class List</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} style={{ marginRight: 6 }}/> Print / Save PDF</button>
                <button className="btn btn-icon btn-sm" onClick={() => setPrintModalOpen(false)}>✕</button>
              </div>
            </div>
            <div className="print-area" style={{ padding: 24, background: '#fff' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: '0 0 8px 0' }}>{store.settings.name || 'DigiShule'}</h2>
                <h3 style={{ margin: '0 0 4px 0', color: '#475569' }}>Official Class List — {assignedClass}</h3>
                <div className="muted" style={{ fontSize: 13 }}>Class Teacher: {teacherName}</div>
              </div>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>#</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Adm No.</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Student Name</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.class === assignedClass).map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{idx + 1}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{s.adm}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ borderBottom: '1px solid #e2e8f0', padding: 8 }}>{s.gender || '-'}</td>
                    </tr>
                  ))}
                  {students.filter(s => s.class === assignedClass).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="muted">No students assigned to {assignedClass}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                <div>Generated on {new Date().toLocaleDateString()}</div>
                <div>Signature: ______________________</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Log Behavior Modal */}
      {behaviorModalOpen && (
        <Modal title="Log Student Behavior" onClose={() => setBehaviorModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setBehaviorModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleLogBehavior}>Save Record</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={behaviorForm.student} onChange={e => setBehaviorForm(f => ({ ...f, student: e.target.value }))}>
                <option value="">-- Select Student --</option>
                {students.filter(s => !assignedClass || s.class === assignedClass).map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.adm})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Type</label>
                <select className="select" value={behaviorForm.type} onChange={e => setBehaviorForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="Merit">Merit (Positive)</option>
                  <option value="Demerit">Demerit (Negative)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Points</label>
                <input type="number" className="input" value={behaviorForm.points} onChange={e => setBehaviorForm(f => ({ ...f, points: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Notes/Reason</label>
              <textarea className="input" rows={3} placeholder="e.g. Helping a classmate, disruptive in class..." value={behaviorForm.notes} onChange={e => setBehaviorForm(f => ({ ...f, notes: e.target.value }))}></textarea>
            </div>
          </div>
        </Modal>
      )}

      {/* Inbox Modal */}
      {inboxModalOpen && (
        <>
          <div className="modal-overlay" onMouseDown={() => setInboxModalOpen(false)} />
          <div className="modal" style={{ maxWidth: 650, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3>Parent Messages Inbox</h3>
              <button className="btn btn-icon btn-sm" onClick={() => setInboxModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto', background: '#f8fafc' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <MessageSquare size={40} style={{ margin: '0 auto 10px' }} />
                  <div>No messages found.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {messages.map(m => (
                    <div key={m.id} className="card card-pad" style={{ background: m.status === 'Unread' ? '#fff' : '#f1f5f9', borderLeft: m.status === 'Unread' ? '4px solid #3b82f6' : '4px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: 15 }}>{m.sender_name}</strong>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Parent of: {m.student_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Badge color={m.status === 'Unread' ? 'blue' : 'green'}>{m.status}</Badge>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{new Date(m.created_at).toLocaleDateString()}</div>
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
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== LEAVE APPLICATION MODAL ===== */}
      {showLeaveModal && (
        <>
          <div className="modal-overlay" onMouseDown={() => setShowLeaveModal(false)} />
          <div className="modal" style={{ maxWidth: 700, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlaneTakeoff size={20} /> Leave Application
              </h3>
              <button className="btn btn-icon btn-sm" onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                onClick={() => setLeaveTab('apply')}
                style={{
                  flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: leaveTab === 'apply' ? '#fff' : 'transparent',
                  borderBottom: leaveTab === 'apply' ? '3px solid #059669' : '3px solid transparent',
                  color: leaveTab === 'apply' ? '#059669' : '#64748b'
                }}
              >
                <PlaneTakeoff size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Apply for Leave
              </button>
              <button
                onClick={() => setLeaveTab('history')}
                style={{
                  flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: leaveTab === 'history' ? '#fff' : 'transparent',
                  borderBottom: leaveTab === 'history' ? '3px solid #0078D4' : '3px solid transparent',
                  color: leaveTab === 'history' ? '#0078D4' : '#64748b'
                }}
              >
                <Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> My Leave History ({leaveRequests.length})
              </button>
            </div>

            <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
              {leaveTab === 'apply' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Leave Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: '#fef3c7', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#B45309' }}>{pendingLeaves}</div>
                      <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>Pending</div>
                    </div>
                    <div style={{ background: '#d1fae5', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{approvedLeaves}</div>
                      <div style={{ fontSize: 11, color: '#065F46', fontWeight: 600 }}>Approved</div>
                    </div>
                    <div style={{ background: '#e0e7ff', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#4338CA' }}>{leaveRequests.length}</div>
                      <div style={{ fontSize: 11, color: '#3730A3', fontWeight: 600 }}>Total Requests</div>
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Leave Type</label>
                    <select className="select" value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="Annual">Annual Leave</option>
                      <option value="Sick">Sick Leave</option>
                      <option value="Maternity">Maternity Leave</option>
                      <option value="Paternity">Paternity Leave</option>
                      <option value="Compassionate">Compassionate Leave</option>
                      <option value="Study">Study Leave</option>
                      <option value="Emergency">Emergency Leave</option>
                    </select>
                  </div>

                  <div className="grid grid-2">
                    <div>
                      <label className="field-label">Start Date</label>
                      <input type="date" className="input" value={leaveForm.start} onChange={e => setLeaveForm(f => ({ ...f, start: e.target.value }))} />
                    </div>
                    <div>
                      <label className="field-label">End Date</label>
                      <input type="date" className="input" value={leaveForm.end} onChange={e => setLeaveForm(f => ({ ...f, end: e.target.value }))} />
                    </div>
                  </div>

                  {leaveForm.start && leaveForm.end && new Date(leaveForm.end) >= new Date(leaveForm.start) && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534', fontWeight: 600 }}>
                      Duration: {Math.max(1, Math.ceil((new Date(leaveForm.end) - new Date(leaveForm.start)) / (1000 * 60 * 60 * 24)) + 1)} day(s)
                    </div>
                  )}

                  <div>
                    <label className="field-label">Reason / Justification</label>
                    <textarea
                      className="input" rows={4}
                      placeholder="Please describe the reason for your leave request..."
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                    <button className="btn btn-primary" disabled={leaveSaving} onClick={submitLeaveRequest}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#059669', borderColor: '#059669' }}>
                      <PlaneTakeoff size={16} /> {leaveSaving ? 'Submitting...' : 'Submit Leave Request'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Leave History Tab */
                <div>
                  {leaveRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      <PlaneTakeoff size={40} style={{ margin: '0 auto 10px' }} />
                      <div>No leave requests yet.</div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>Click "Apply for Leave" to submit your first request.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {leaveRequests.map(lr => (
                        <div key={lr.id} style={{
                          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px',
                          borderLeft: `4px solid ${lr.status === 'Approved' ? '#10b981' : lr.status === 'Rejected' ? '#ef4444' : '#f59e0b'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {lr.status === 'Approved' ? <CheckCircle2 size={16} color="#10b981" /> :
                               lr.status === 'Rejected' ? <XCircle size={16} color="#ef4444" /> :
                               <Clock size={16} color="#f59e0b" />}
                              <span style={{ fontWeight: 700, fontSize: 14 }}>{lr.type} Leave</span>
                            </div>
                            <Badge color={lr.status === 'Approved' ? 'green' : lr.status === 'Rejected' ? 'red' : 'amber'}>{lr.status}</Badge>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12, color: '#475569', marginBottom: 6 }}>
                            <div><strong>From:</strong> {lr.start_date}</div>
                            <div><strong>To:</strong> {lr.end_date}</div>
                            <div><strong>Days:</strong> {lr.days}</div>
                          </div>
                          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{lr.reason}</div>
                          {lr.approved_by && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Reviewed by: {lr.approved_by}</div>
                          )}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Submitted: {new Date(lr.created_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
