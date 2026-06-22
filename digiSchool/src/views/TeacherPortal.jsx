import { useMemo, useState, useEffect } from 'react';
import { KpiCard, Badge } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { BookOpen, BarChart3, AlertTriangle, FolderOpen, Bell, Calendar, ClipboardList, Printer, Users, Award, MessageSquare } from 'lucide-react';
import Modal from '../components/Modal';

export default function TeacherPortal({ store, user }) {
  const { students, gradeBoundaries, navigate } = store;
  const teacherName = user?.name || 'Teacher';
  const subject = user?.dept || 'Mathematics';

  const teacherProfile = useMemo(() => store.teachers.find(t => t.name === teacherName) || {}, [store.teachers, teacherName]);
  const assignedClass = teacherProfile.assignedClass || null;
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [behaviorModalOpen, setBehaviorModalOpen] = useState(false);
  const [behaviorForm, setBehaviorForm] = useState({ student: '', type: 'Merit', points: 5, notes: '' });

  const [messages, setMessages] = useState([]);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [replyText, setReplyText] = useState({});

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

  const handleLogBehavior = () => {
    if (!behaviorForm.student) return store.notify('Please select a student', 'warning');
    store.notify(`Logged ${behaviorForm.type} (${behaviorForm.points} pts) for ${behaviorForm.student}.`, 'success');
    setBehaviorModalOpen(false);
    setBehaviorForm({ student: '', type: 'Merit', points: 5, notes: '' });
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

  const rows = useMemo(() => {
    return students
      .filter((s) => s.scores?.[subject])
      .map((s) => {
        const scores = s.scores[subject];
        const row = computeRow(scores);
        const grade = gradeFor(row.average, gradeBoundaries);
        return { ...s, ...row, grade };
      });
  }, [students, gradeBoundaries, subject]);

  const classes = [...new Set(rows.map((r) => r.class))].sort();
  const avgOverall = rows.length
    ? (rows.reduce((s, r) => s + r.average, 0) / rows.length).toFixed(1)
    : 0;
  const atRisk = rows.filter((r) => r.average < 40).length;
  const topPerformer = rows.reduce((best, r) => (!best || r.average > best.average ? r : best), null);

  const quickLinks = [
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
              <Award size={16} /> Log Behavior (PBIS)
            </button>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setPrintModalOpen(true)}>
              <Printer size={16} /> Generate Class List
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
                if (q.action === 'open_inbox') setInboxModalOpen(true);
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
                  <th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th>
                  <th>Total</th><th>Avg %</th><th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => b.average - a.average)
                  .map((r, i) => (
                    <tr key={r.id} style={r.average < 40 ? { background: '#fff5f5' } : undefined}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        {r.average < 40 && <AlertTriangle size={12} color="#D13438" style={{ marginRight: 4 }} />}
                        {r.name}
                      </td>
                      <td className="muted">{r.adm}</td>
                      <td><Badge color="gray">{r.class}</Badge></td>
                      <td>{r.cat1}</td><td>{r.cat2}</td>
                      <td>{r.midterm}</td><td>{r.endterm}</td>
                      <td style={{ fontWeight: 700 }}>{r.total}</td>
                      <td style={{ fontWeight: 700, color: r.average >= 70 ? '#107C10' : r.average >= 50 ? '#0078D4' : '#D13438' }}>
                        {r.average}%
                      </td>
                      <td>
                        <Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>
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
    </div>
  );
}
