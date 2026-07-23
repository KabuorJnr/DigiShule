import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { User, BookOpen, Clock, AlertTriangle, ShieldCheck, FileText, Bell, 
  BarChart3, Trophy, Wallet, Calendar, Mail, Heart, ClipboardList, 
  CheckCircle2, XCircle, Send, Award, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchTable } from '../../lib/api';
import { KpiCard, ProgressBar, Badge } from '../../components/widgets';
import { computeRow, gradeFor, is844Class } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import { printReceipt } from '../../lib/printReceipt';
import Modal from '../../components/Modal';
import ReportCardModal from '../../components/ReportCardModal';

export default function ParentDashboard() {
  const { user: currentUser, store, params } = useOutletContext();
  const { tab: urlTab } = useParams();
  const activeTab = urlTab || params?.tab || 'dashboard';

  const [child, setChild] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkAdm, setLinkAdm] = useState('');
  const [linkPin, setLinkPin] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Data states
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);

  // Modal states
  const [msgModal, setMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ to: 'Class Teacher', subject: '', body: '' });
  const [showReportCardModal, setShowReportCardModal] = useState(false);

  const notify = store?.notify || (() => {});
  const { gradeBoundaries, feeStructure } = store || {};

  // ── Set default selected child ──
  useEffect(() => {
    if (!selectedChildId && currentUser) {
      const linked = currentUser.linked_students || [];
      if (linked.length > 0) setSelectedChildId(linked[0].id);
      else if (currentUser.student_id || currentUser.studentId) setSelectedChildId(currentUser.student_id || currentUser.studentId);
    }
  }, [currentUser, selectedChildId]);

  // ── Fetch child profile ──
  useEffect(() => {
    async function fetchChild() {
      if (!selectedChildId) { setLoading(false); return; }
      if (!child) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('students').select('*').eq('id', selectedChildId).maybeSingle();
        if (!error && data) setChild(data);
      } catch (err) { console.error("Error fetching child:", err); }
      finally { setLoading(false); }
    }
    fetchChild();
  }, [selectedChildId]);

  // ── Fetch all supporting data once child is loaded ──
  useEffect(() => {
    if (!child) return;
    let active = true;
    Promise.all([
      fetchTable('financePayments').catch(() => []),
      fetchTable('studentAttendance').catch(() => []),
      fetchTable('clinicVisits').catch(() => []),
      fetchTable('disciplinaryRecords').catch(() => []),
      fetchTable('notifications').catch(() => []),
      fetchTable('schoolEvents').catch(() => []),
      fetchTable('parentMeetingRequests').catch(() => []),
      fetchTable('messages').catch(() => []),
    ]).then(([pays, att, health, disc, notifs, events, meetings, msgs]) => {
      if (!active) return;
      setPayments((pays || []).filter(p => p.student_id === child.id || p.adm === child.adm));
      setAttendance((att || []).filter(a => a.student_id === child.id || a.adm === child.adm));
      setHealthRecords((health || []).filter(h => h.adm === child.adm || h.student_id === child.id));
      setDisciplinary((disc || []).filter(d => d.adm === child.adm));
      setNotifications(notifs || []);
      setSchoolEvents(events || []);
      setMeetingRequests((meetings || []).filter(m => m.student_id === child.id));
      // Inbox: messages where recipient_role = 'parent' and linked to this child
      setInboxMessages((msgs || []).filter(m =>
        m.recipient_role === 'parent' &&
        (m.student_id === child.id || m.student_id === child.adm || !m.student_id)
      ));
    });
    return () => { active = false; };
  }, [child?.id, child?.adm]);

  // ── Computed values ──
  const subjects = useMemo(() => {
    if (!child) return [];
    const systemType = is844Class(child.class) ? '844' : 'CBC';
    return SUBJECTS.map(sub => {
      const scores = (child.scores || {})[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const percentage = row.average <= 4 && row.average > 0 ? Math.round(row.average * 25) : row.average;
      const grade = gradeFor(percentage, gradeBoundaries, systemType);
      return { subject: sub, ...row, percentage, grade };
    }).filter(Boolean);
  }, [child, gradeBoundaries]);

  const overallAvg = subjects.length 
    ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1) 
    : 0;

  const levels = store?.settings?.classes?.length > 0 
    ? store.settings.classes.map(c => c.name) 
    : (store?.settings?.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
  const myLevel = child ? (levels.find(l => child.class?.startsWith(l)) || child.class || levels[0]) : levels[0];

  const termFees = feeStructure?.reduce((s, f) => s + (Number(f[myLevel]) || 0), 0) || 0;
  const totalPaid = payments.reduce((acc, p) => p.status !== 'Verification Pending' && p.status !== 'Pending' ? acc + Number(p.amount) : acc, 0);
  const outstanding = termFees - totalPaid;
  const feePercent = termFees > 0 ? Math.min(100, (totalPaid / termFees) * 100) : 0;

  const totalAttendance = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'Present' || a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'Absent' || a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'Late' || a.status === 'late').length;
  const attendanceRate = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(0) : '-';

  const unresolvedDisc = disciplinary.filter(d => d.status !== 'Resolved');
  const parentNotices = (notifications || []).filter(n => {
    const aud = n.audience || [];
    return aud.includes('all') || aud.includes('parents') || aud.includes('students') || (child && aud.includes(child.id)) || (child && aud.includes(child.adm));
  });

  const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

  // ── Contact teacher handler ──
  const handleSendMessage = async () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Please fill all fields', 'warning'); return; }
    try {
      const { upsertRow } = await import('../../lib/api');
      const messagePayload = {
        id: `msg_${Date.now()}`,
        sender_id: currentUser.id || 'parent',
        sender_name: currentUser.name || 'Parent',
        recipient_role: msgForm.to,
        student_id: child.id,
        student_name: child.name,
        subject: msgForm.subject,
        body: msgForm.body,
        status: 'Unread',
        created_at: new Date().toISOString()
      };
      await upsertRow('messages', messagePayload);
      notify(`Message sent to ${msgForm.to} successfully!`, 'success', 'Messages');
      setMsgModal(false);
      setMsgForm({ to: 'Class Teacher', subject: '', body: '' });
    } catch (e) {
      notify(`Failed to send message: ${e.message}`, 'error');
    }
  };

  const handleMarkInboxRead = async (msgId) => {
    try {
      const { upsertRow } = await import('../../lib/api');
      const msg = inboxMessages.find(m => m.id === msgId);
      const updatedMsg = { ...msg, status: 'Read' };
      await upsertRow('messages', updatedMsg);
      setInboxMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
    } catch (e) {
      notify(`Failed to mark read: ${e.message}`, 'error');
    }
  };

  const handleRequestMeeting = async () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Please fill all fields', 'warning'); return; }
    try {
      const { upsertRow } = await import('../../lib/api');
      const payload = {
        id: `meet_${Date.now()}`,
        parent_id: currentUser.id || 'parent',
        parent_name: currentUser.name || 'Parent',
        student_id: child.id,
        student_name: child.name,
        teacher_name: msgForm.to, // Using the same form state for simplicity
        reason: `${msgForm.subject} - ${msgForm.body}`,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      await upsertRow('parentMeetingRequests', payload);
      setMeetingRequests([...meetingRequests, payload]);
      notify(`Meeting requested with ${msgForm.to} successfully!`, 'success', 'Meetings');
      setMsgModal(false);
      setMsgForm({ to: 'Class Teacher', subject: '', body: '' });
    } catch (e) {
      notify(`Failed to request meeting: ${e.message}`, 'error');
    }
  };

  // ── Link student handler ──
  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!linkAdm.trim()) return;
    setLinking(true);
    setLinkError('');
    try {
      const { data, error } = await supabase.rpc('lookup_student_for_signup', {
        p_school_id: currentUser.school_id,
        p_adm: linkAdm.trim(),
        p_parent_pin: linkPin.trim()
      });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Student not found. Please verify the Admission Number and Parent PIN.');
      const student = data[0];
      
      const currentLinked = currentUser.linked_students || [];
      const isAlreadyLinked = currentLinked.find(s => s.id === student.id);
      
      const newLinked = isAlreadyLinked ? currentLinked : [...currentLinked, {
        id: student.id,
        name: student.name,
        adm: student.adm,
        class: student.class
      }];

      const { error: updateErr } = await supabase.from('profiles').update({ 
        student_id: student.id, // Primary student
        linked_students: newLinked 
      }).eq('id', currentUser.id);
      if (updateErr) throw updateErr;
      window.location.reload();
    } catch (err) {
      setLinkError(err.message);
      setLinking(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading child data...</div>;
  }

  // ── Linking screen (no child linked yet) ──
  if (!child) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <ShieldCheck size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
        <h2>Welcome to the Parent Portal</h2>
        <p className="muted" style={{ marginBottom: 30 }}>Your account is not currently linked to a specific student profile. Please enter your child's Admission Number and Parent Access PIN below to link your account.</p>
        
        <form onSubmit={handleLinkStudent} style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Admission Number</label>
            <input type="text" value={linkAdm} onChange={(e) => setLinkAdm(e.target.value)} placeholder="e.g. ADM/2023/001"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }} required />
          </div>
          <div style={{ marginBottom: 20, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Parent Access PIN</label>
            <input type="password" value={linkPin} onChange={(e) => setLinkPin(e.target.value)} placeholder="6-digit PIN" maxLength={6}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }} required />
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0 0' }}>This secret PIN is provided by the school.</p>
          </div>
          {linkError && (
            <div style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
              {linkError}
            </div>
          )}
          <button type="submit" disabled={linking || !linkAdm.trim() || linkPin.trim().length < 6}
            style={{ width: '100%', padding: '10px', background: '#047857', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: linking ? 'not-allowed' : 'pointer', opacity: linking ? 0.7 : 1 }}>
            {linking ? 'Linking Account...' : 'Link Child Profile'}
          </button>
        </form>
      </div>
    );
  }

  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  // ── DASHBOARD TAB (default) ──
  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  if (activeTab === 'dashboard' || !activeTab) {
    const linkedStudents = currentUser?.linked_students || [];
    
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Child Switcher / Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
                Overview for {child.name}
              </h1>
              {linkedStudents.length > 1 && (
                <select 
                  className="select" 
                  style={{ padding: '4px 8px', fontSize: 13, minWidth: 150 }}
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                >
                  {linkedStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Grade: {child.class || 'N/A'}  |  Admission: {child.adm || 'Pending'}  |  Gender: {child.gender || 'N/A'}
            </p>
          </div>
          {linkedStudents.length > 0 && (
            <button className="btn" onClick={() => setChild(null)} style={{ fontSize: 13 }}>
              + Link Another Child
            </button>
          )}
        </div>

        {/* Disciplinary Alert */}
        {unresolvedDisc.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={20} style={{ color: '#dc2626', marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>Active Disciplinary Notice</strong>
              <div style={{ fontSize: 14 }}>Your child has {unresolvedDisc.length} unresolved disciplinary record{unresolvedDisc.length !== 1 ? 's' : ''}. Please contact the school administration.</div>
            </div>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="stat-tiles">
          <KpiCard iconComponent={<BarChart3 size={20} />} label="Overall Average" value={`${overallAvg}%`} accent="#047857" />
          <KpiCard iconComponent={<ClipboardList size={20} />} label="Attendance Rate" value={attendanceRate !== '-' ? `${attendanceRate}%` : '-'} accent={Number(attendanceRate) >= 80 ? '#047857' : '#F59E0B'} />
          <KpiCard iconComponent={<Wallet size={20} />} label="Fee Balance" value={fmtKES(outstanding)} accent={outstanding > 0 ? '#D13438' : '#107C10'}>
            <div style={{ marginTop: 6 }}><ProgressBar value={feePercent} color="#107C10" /></div>
          </KpiCard>
          <KpiCard iconComponent={<Heart size={20} />} label="Health Visits" value={healthRecords.length} accent="#047857" />
        </div>

        {/* Quick Actions */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h3 className="section-title">Quick Actions</h3>
          <div className="grid grid-4" style={{ gap: 10 }}>
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setShowReportCardModal(true)}>
              <BarChart3 size={16} /> View Report Card
            </button>
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => store.navigate('student', { tab: 'finance', childId: child?.id })}>
              <DollarSign size={16} /> Pay Fees
            </button>
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setMsgModal(true)}>
              <Mail size={16} /> Contact Teacher
            </button>
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => { setMsgForm({ ...msgForm, isMeeting: true }); setMsgModal(true); }}>
              <Calendar size={16} /> Request Meeting
            </button>
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
          {/* Academic Snapshot */}
          <div className="card card-pad">
            <h3 className="section-title">Academic Snapshot</h3>
            {subjects.length === 0 ? (
              <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No scores available yet.</div>
            ) : (
              <table className="table">
                <thead><tr><th>Subject</th><th style={{ textAlign: 'right' }}>Average</th><th style={{ textAlign: 'center' }}>Grade</th></tr></thead>
                <tbody>
                  {subjects.slice(0, 8).map(s => (
                    <tr key={s.subject}>
                      <td style={{ fontWeight: 500 }}>{s.subject}</td>
                      <td style={{ textAlign: 'right' }}>{s.average.toFixed(1)}%</td>
                      <td style={{ textAlign: 'center' }}><Badge color={s.average >= 60 ? 'green' : s.average >= 40 ? 'amber' : 'red'}>{s.grade}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Fee Summary */}
          <div className="card card-pad">
            <h3 className="section-title">Fee Summary - Term 2</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{fmtKES(totalPaid)}</div>
                <div style={{ fontSize: 12, color: '#166534' }}>Paid</div>
              </div>
              <div style={{ background: outstanding > 0 ? '#fef2f2' : '#f0fdf4', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmtKES(outstanding)}</div>
                <div style={{ fontSize: 12, color: outstanding > 0 ? '#991b1b' : '#166534' }}>Outstanding</div>
              </div>
            </div>
            <ProgressBar value={feePercent} color="#107C10" />
            <div className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>{feePercent.toFixed(0)}% of fees paid</div>
            
            {payments.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: '#475569' }}>Recent Payments</h4>
                {payments.slice(0, 3).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.method || 'Payment'}
                        {(p.status === 'Verification Pending' || p.status === 'Pending') && <span style={{ fontSize: 10, background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: 8 }}>Pending</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>{p.date || (p.created_at || '').slice(0, 10)}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#16a34a' }}>{fmtKES(p.amount)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
          {/* Attendance Summary */}
          <div className="card card-pad">
            <h3 className="section-title">Attendance Summary</h3>
            {totalAttendance === 0 ? (
              <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No attendance records found.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 8, textAlign: 'center' }}>
                  <CheckCircle2 size={20} style={{ color: '#16a34a', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{presentCount}</div>
                  <div style={{ fontSize: 12, color: '#166534' }}>Present</div>
                </div>
                <div style={{ background: '#fef2f2', padding: 14, borderRadius: 8, textAlign: 'center' }}>
                  <XCircle size={20} style={{ color: '#dc2626', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{absentCount}</div>
                  <div style={{ fontSize: 12, color: '#991b1b' }}>Absent</div>
                </div>
                <div style={{ background: '#fefce8', padding: 14, borderRadius: 8, textAlign: 'center' }}>
                  <Clock size={20} style={{ color: '#ca8a04', marginBottom: 4 }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ca8a04' }}>{lateCount}</div>
                  <div style={{ fontSize: 12, color: '#854d0e' }}>Late</div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Notices */}
          <div className="card card-pad">
            <h3 className="section-title">Recent Notices</h3>
            {parentNotices.length === 0 ? (
              <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No recent notices.</div>
            ) : (
              parentNotices.slice(0, 4).map(n => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{(n.created_at || '').slice(0, 10)} - {n.posted_by || 'Admin'} ({n.role || 'School Office'})</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contact Teacher / Meeting Modal */}
        {msgModal && (
          <Modal title={msgForm.isMeeting ? "Request a Meeting" : "Contact Teacher"} onClose={() => { setMsgModal(false); setMsgForm({ to: 'Class Teacher', subject: '', body: '', isMeeting: false }); }} footer={
            <button className="btn btn-primary" onClick={msgForm.isMeeting ? handleRequestMeeting : handleSendMessage}>
              <Send size={16} style={{ marginRight: 6 }} /> {msgForm.isMeeting ? "Request Meeting" : "Send Message"}
            </button>
          }>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">To</label>
              <select className="select" value={msgForm.to} onChange={e => setMsgForm({ ...msgForm, to: e.target.value })}>
                <option>Class Teacher</option>
                <option>School Administration</option>
                <option>Finance Office</option>
                <option>Health Center</option>
                <option>Principal</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">{msgForm.isMeeting ? "Topic/Reason" : "Subject"}</label>
              <input className="input" value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} placeholder="e.g. Child's progress inquiry" />
            </div>
            <div>
              <label className="field-label">{msgForm.isMeeting ? "Details (Optional)" : "Message"}</label>
              <textarea className="input" style={{ height: 120 }} value={msgForm.body} onChange={e => setMsgForm({ ...msgForm, body: e.target.value })} placeholder="Type your message here..." />
            </div>
          </Modal>
        )}

        {showReportCardModal && (
          <ReportCardModal
            student={child}
            students={store?.students || []}
            subjects={SUBJECTS}
            gradeBoundaries={gradeBoundaries}
            examTitle="Term 1 Opening Exam"
            termName="Term 1"
            schoolSettings={store?.settings}
            onClose={() => setShowReportCardModal(false)}
          />
        )}
      </div>
    );
  }

  // â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  
  // ── ATTENDANCE TAB ──
  // â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  
  if (activeTab === 'attendance') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Attendance Records - {child.name}</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{totalAttendance}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Total Days</div>
          </div>
          <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, textAlign: 'center', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{presentCount}</div>
            <div style={{ fontSize: 13, color: '#166534' }}>Present</div>
          </div>
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, textAlign: 'center', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{absentCount}</div>
            <div style={{ fontSize: 13, color: '#991b1b' }}>Absent</div>
          </div>
          <div style={{ background: '#fefce8', padding: 16, borderRadius: 8, textAlign: 'center', border: '1px solid #fef08a' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ca8a04' }}>{lateCount}</div>
            <div style={{ fontSize: 13, color: '#854d0e' }}>Late</div>
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Attendance Log</h3>
          {attendance.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No attendance records available.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Date</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {attendance.slice(0, 30).map((a, i) => (
                  <tr key={a.id || i}>
                    <td>{a.date || (a.created_at || '').slice(0, 10)}</td>
                    <td>
                      <Badge color={a.status === 'Present' || a.status === 'present' ? 'green' : a.status === 'Late' || a.status === 'late' ? 'amber' : 'red'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="muted">{a.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  // ── CONTACT TEACHER TAB ──
  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  if (activeTab === 'contact') {
    return (
      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Contact & Meetings</h2>
        
        <div className="grid grid-2" style={{ gap: 24 }}>
          <div className="card card-pad">
            <h3 className="section-title">Send a Message</h3>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">To</label>
              <select className="select" value={msgForm.to} onChange={e => setMsgForm({ ...msgForm, to: e.target.value })}>
                <option>Class Teacher</option>
                <option>School Administration</option>
                <option>Finance Office</option>
                <option>Health Center</option>
                <option>Principal</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Subject</label>
              <input className="input" value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} placeholder="e.g. Child's academic progress" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Message</label>
              <textarea className="input" style={{ height: 160 }} value={msgForm.body} onChange={e => setMsgForm({ ...msgForm, body: e.target.value })} placeholder="Write your message to the teacher..." />
            </div>
            <button className="btn btn-primary" onClick={handleSendMessage} style={{ width: '100%' }}>
              <Send size={16} style={{ marginRight: 8 }} /> Send Message
            </button>
          </div>

          <div className="card card-pad">
            <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              My Meeting Requests
              <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setMsgForm({ ...msgForm, isMeeting: true }); setMsgModal(true); }}>+ New Request</button>
            </h3>
            {meetingRequests.length === 0 ? (
              <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No meeting requests yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {meetingRequests.map((m, i) => (
                  <div key={m.id || i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 14 }}>{m.teacher_name || 'Teacher'}</strong>
                      <Badge color={m.status === 'Scheduled' ? 'green' : m.status === 'Pending' ? 'amber' : 'red'}>{m.status}</Badge>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{m.reason}</div>
                    {m.status === 'Scheduled' && m.scheduled_date && (
                      <div style={{ fontSize: 12, color: '#0f172a', background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                        <Calendar size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} /> 
                        Scheduled for: {new Date(m.scheduled_date).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meeting Modal triggered from the list */}
        {msgModal && msgForm.isMeeting && (
          <Modal title="Request a Meeting" onClose={() => { setMsgModal(false); setMsgForm({ to: 'Class Teacher', subject: '', body: '', isMeeting: false }); }} footer={
            <button className="btn btn-primary" onClick={handleRequestMeeting}>
              <Send size={16} style={{ marginRight: 6 }} /> Request Meeting
            </button>
          }>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Meet With</label>
              <select className="select" value={msgForm.to} onChange={e => setMsgForm({ ...msgForm, to: e.target.value })}>
                <option>Class Teacher</option>
                <option>School Administration</option>
                <option>Principal</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Topic/Reason</label>
              <input className="input" value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} placeholder="e.g. Discuss grades" />
            </div>
            <div>
              <label className="field-label">Details</label>
              <textarea className="input" style={{ height: 120 }} value={msgForm.body} onChange={e => setMsgForm({ ...msgForm, body: e.target.value })} placeholder="Preferred days/times, specific questions..." />
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  // ── HEALTH RECORDS TAB ──
  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  if (activeTab === 'health') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Health Records - {child.name}</h2>
        
        {child.medicalInfo && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Medical Information / Known Conditions</div>
            <div style={{ color: '#7f1d1d', whiteSpace: 'pre-wrap', fontSize: 14 }}>{child.medicalInfo}</div>
          </div>
        )}

        <div className="card card-pad">
          {healthRecords.length === 0 ? (
            <div className="muted" style={{ padding: 30, textAlign: 'center' }}>
              <Heart size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
              <div>No health/clinic visit records found.</div>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Date</th><th>Complaint</th><th>Diagnosis</th><th>Treatment</th><th>Status</th></tr></thead>
              <tbody>
                {healthRecords.map((h, i) => (
                  <tr key={h.id || i}>
                    <td>{h.date || (h.created_at || '').slice(0, 10)}</td>
                    <td>{h.complaint || h.symptoms || '-'}</td>
                    <td>{h.diagnosis || '-'}</td>
                    <td>{h.treatment || h.action_taken || '-'}</td>
                    <td><Badge color={h.status === 'Resolved' ? 'green' : 'amber'}>{h.status || 'Visited'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inbox messages from clinic/school */}
        <div className="card card-pad" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} /> Messages from School / Clinic
            {inboxMessages.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{inboxMessages.length}</span>}
          </h3>
          {inboxMessages.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
              <Mail size={28} style={{ color: '#cbd5e1', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              <div>No messages from the school or clinic.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inboxMessages.map((m, i) => (
                <div key={m.id || i} style={{ padding: '14px 16px', background: m.status === 'Unread' ? '#eff6ff' : '#f8fafc', border: `1px solid ${m.status === 'Unread' ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 8, borderLeft: `4px solid ${m.sender_role === 'nurse' || m.sender_role === 'clinic' ? '#047857' : '#047857'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.subject || 'Message from School'}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {m.status === 'Unread' && (
                        <>
                          <span style={{ background: '#047857', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>NEW</span>
                          <button onClick={() => handleMarkInboxRead(m.id)} style={{ background: 'none', border: 'none', color: '#047857', fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline' }}>Mark Read</button>
                        </>
                      )}
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: m.status === 'Unread' ? 4 : 0 }}>{(m.created_at || '').slice(0, 10)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    From: <strong>{m.sender_name || m.sender_role || 'School'}</strong>
                    {(m.sender_role === 'nurse' || m.sender_role === 'clinic') && ' 🏥'}
                  </div>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  // ── DISCIPLINARY RECORDS TAB ──
  // â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | â | 
  if (activeTab === 'disciplinary') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Disciplinary Records - {child.name}</h2>
        
        {unresolvedDisc.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={20} style={{ color: '#dc2626', marginTop: 2 }} />
            <div>
              <strong>Action Required:</strong> {unresolvedDisc.length} unresolved case{unresolvedDisc.length !== 1 ? 's' : ''}. Please contact the school administration.
            </div>
          </div>
        )}
        
        <div className="card card-pad">
          {disciplinary.length === 0 ? (
            <div className="muted" style={{ padding: 30, textAlign: 'center' }}>
              <CheckCircle2 size={32} style={{ color: '#047857', marginBottom: 8 }} />
              <div>No disciplinary records. Great behavior!</div>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Status</th></tr></thead>
              <tbody>
                {disciplinary.map((d, i) => (
                  <tr key={d.id || i} style={{ cursor: 'pointer' }} onClick={() => setMsgForm({ ...msgForm, disciplineModal: d })}>
                    <td>{d.date || (d.created_at || '').slice(0, 10)}</td>
                    <td style={{ fontWeight: 600 }}>{d.category || d.incident || d.offense || '-'}</td>
                    <td>{d.description ? (d.description.length > 50 ? d.description.slice(0, 50) + '...' : d.description) : '-'}</td>
                    <td><Badge color={d.status === 'Resolved' ? 'green' : 'red'}>{d.status || 'Open'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {msgForm.disciplineModal && (
          <Modal title="Discipline Case Details" onClose={() => setMsgForm({ ...msgForm, disciplineModal: null })} footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setMsgForm({ ...msgForm, disciplineModal: null })}>Close</button>
            </div>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span className="field-label">Student</span><div style={{ fontWeight: 600 }}>{msgForm.disciplineModal.student || child.name}</div></div>
              <div><span className="field-label">Category</span><div><Badge color="red">{msgForm.disciplineModal.category || msgForm.disciplineModal.incident}</Badge></div></div>
              <div><span className="field-label">Date</span><div>{msgForm.disciplineModal.date || (msgForm.disciplineModal.created_at || '').slice(0, 10)}</div></div>
              <div><span className="field-label">Description</span><div style={{ lineHeight: 1.5 }}>{msgForm.disciplineModal.description || '-'}</div></div>
              <div><span className="field-label">Action Taken</span><div>{msgForm.disciplineModal.action || msgForm.disciplineModal.action_taken || 'Pending review'}</div></div>
              <div><span className="field-label">Status</span><div><Badge color={msgForm.disciplineModal.status === 'Resolved' ? 'green' : 'red'}>{msgForm.disciplineModal.status}</Badge></div></div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ── Fallback for unknown tabs ──
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div className="muted">Select a section from the sidebar menu.</div>
    </div>
  );
}



