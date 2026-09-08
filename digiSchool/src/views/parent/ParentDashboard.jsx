import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { User, BookOpen, Clock, AlertTriangle, ShieldCheck, FileText, Bell, 
  BarChart3, Trophy, Wallet, Calendar, Mail, Heart, ClipboardList, 
  CheckCircle2, XCircle, Send, Award, DollarSign, Hospital } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchTable } from '../../lib/api';
import { KpiCard, ProgressBar, Badge } from '../../components/widgets';
import { computeRow, gradeFor, is844Class } from '../../utils/grading';
import { SUBJECTS } from '../../data/seed';
import { printReceipt } from '../../lib/printReceipt';
import Modal from '../../components/Modal';
import ReportCardModal from '../../components/ReportCardModal';
import ResultsSummary from '../../components/ResultsSummary';

export default function ParentDashboard(props) {
  const context = useOutletContext() || {};
  const currentUser = props?.user || context?.user;
  const store = props?.store || context?.store;
  const params = props?.params || context?.params;
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
  const [inboxReply, setInboxReply] = useState({}); // {[msgId]: draft reply text}
  const [classmates, setClassmates] = useState([]);

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

  // ── Fetch classmates (same class) for positions & class averages ──
  // Only needed once we have the child's class; used by the results summary.
  useEffect(() => {
    let active = true;
    async function fetchClassmates() {
      if (!child?.class) { setClassmates([]); return; }
      try {
        const { data, error } = await supabase
          .from('students').select('id, adm, name, class, gender, scores, kcpe').eq('class', child.class);
        if (active && !error && Array.isArray(data)) setClassmates(data);
      } catch (err) { console.error('Error fetching classmates:', err); }
    }
    fetchClassmates();
    return () => { active = false; };
  }, [child?.class]);

  // ── Fetch all supporting data once child is loaded or student_id is known ──
  useEffect(() => {
    if (!child && !selectedChildId && !currentUser?.student_id && !currentUser?.studentId) return;
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
      const activeChildId = child?.id || selectedChildId || currentUser?.student_id || currentUser?.studentId;
      const activeChildAdm = child?.adm;

      setPayments((pays || []).filter(p => (activeChildId && p.student_id === activeChildId) || (activeChildAdm && p.adm === activeChildAdm)));
      setAttendance((att || []).filter(a => (activeChildId && a.student_id === activeChildId) || (activeChildAdm && a.adm === activeChildAdm)));
      setHealthRecords((health || []).filter(h => (activeChildAdm && h.adm === activeChildAdm) || (activeChildId && h.student_id === activeChildId)));
      setDisciplinary((disc || []).filter(d => (activeChildAdm && d.adm === activeChildAdm)));
      setNotifications(notifs || []);
      setSchoolEvents(events || []);
      setMeetingRequests((meetings || []).filter(m => (activeChildId && m.student_id === activeChildId)));

      // Normalised set of student IDs / ADMs linked to this guardian
      const myStudentKeys = new Set();
      if (activeChildId) myStudentKeys.add(String(activeChildId).trim().toLowerCase());
      if (activeChildAdm) myStudentKeys.add(String(activeChildAdm).trim().toLowerCase());
      if (currentUser?.student_id) myStudentKeys.add(String(currentUser.student_id).trim().toLowerCase());
      if (currentUser?.studentId) myStudentKeys.add(String(currentUser.studentId).trim().toLowerCase());
      (currentUser?.linked_students || []).forEach(s => {
        if (s?.id) myStudentKeys.add(String(s.id).trim().toLowerCase());
        if (s?.adm) myStudentKeys.add(String(s.adm).trim().toLowerCase());
      });

      // Inbox: messages addressed to parent and linked to this child or guardian
      const matchedMsgs = (msgs || []).filter(m => {
        const role = String(m.recipient_role || '').toLowerCase().trim();
        const isParentRole = role === 'parent' || role === 'parents' || role === 'guardian' || !m.recipient_role;
        if (!isParentRole) return false;

        // Addressed to this guardian directly by account ID or username
        if (m.recipient_id && currentUser) {
          const rec = String(m.recipient_id).trim().toLowerCase();
          if (rec === String(currentUser.id || '').trim().toLowerCase() ||
              rec === String(currentUser.profile_id || '').trim().toLowerCase() ||
              rec === String(currentUser.username || '').trim().toLowerCase()) {
            return true;
          }
        }

        // Keyed to any of the parent's linked children
        const msgSid = m.student_id ? String(m.student_id).trim().toLowerCase() : '';
        if (msgSid && myStudentKeys.has(msgSid)) return true;

        return false;
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setInboxMessages(matchedMsgs);
    });
    return () => { active = false; };
  }, [child?.id, child?.adm, selectedChildId, currentUser?.id, currentUser?.student_id, currentUser?.studentId]);

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
  const unreadInbox = useMemo(() => inboxMessages.filter(m => m.status === 'Unread'), [inboxMessages]);

  // ── Contact teacher handler ──
  const handleSendMessage = async () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Please fill all fields', 'warning'); return; }
    try {
      const { upsertRow } = await import('../../lib/api');
      const messagePayload = {
        id: `msg_${Date.now()}`,
        sender_id: currentUser.id || 'parent',
        sender_name: currentUser.name || 'Parent',
        sender_role: 'parent',
        recipient_role: msgForm.to,
        student_id: child.id,
        student_name: child.name,
        subject: msgForm.subject,
        body: msgForm.body,
        status: 'Unread',
        created_at: new Date().toISOString()
      };
      await upsertRow('messages', messagePayload);

      // Office recipients (Principal, Finance, Admin, Health Center) have no
      // message inbox — deliver those to the relevant staff via the bell
      // notifications feed so they actually arrive. Teacher messages are picked
      // up directly by the teacher inbox and need no notification mirror.
      const OFFICE_AUDIENCE = {
        'School Administration': ['admins'],
        'Finance Office': ['finance'],
        'Health Center': ['nurse'],
        'Principal': ['principal'],
      };
      const audience = OFFICE_AUDIENCE[msgForm.to];
      if (audience) {
        try {
          await upsertRow('notifications', {
            id: `pmsg_${Date.now()}`,
            title: `Parent message: ${msgForm.subject}`,
            message: `From ${currentUser.name || 'a parent'} (re ${child.name}): ${msgForm.body}`.slice(0, 240),
            body: `From ${currentUser.name || 'a parent'} regarding ${child.name}:\n\n${msgForm.body}`,
            posted_by: currentUser.name || 'Parent',
            role: 'parent',
            audience,
            read: false,
            created_at: new Date().toISOString(),
          });
        } catch { /* message already saved; notification mirror is best-effort */ }
      }

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
      if (!msg) return;
      const updatedMsg = { ...msg, status: 'Read' };
      const validPayload = {
        id: msg.id,
        sender_id: msg.sender_id || null,
        sender_name: msg.sender_name || null,
        sender_role: msg.sender_role || null,
        recipient_role: msg.recipient_role || null,
        recipient_id: msg.recipient_id || null,
        student_id: msg.student_id || null,
        student_name: msg.student_name || null,
        subject: msg.subject || null,
        body: msg.body || null,
        status: 'Read',
        created_at: msg.created_at || new Date().toISOString(),
      };
      if (msg.reply) validPayload.reply = msg.reply;
      if (msg.replied_at) validPayload.replied_at = msg.replied_at;
      if (msg.school_id) validPayload.school_id = msg.school_id;

      await upsertRow('messages', validPayload);
      setInboxMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
    } catch (e) {
      notify(`Failed to mark read: ${e.message}`, 'error');
    }
  };

  // Reply to a teacher's message. The reply is routed back to the teacher who
  // sent it (by their sender_id) and stays linked to this child, so it lands
  // in that teacher's Parent Messages inbox.
  const handleInboxReply = async (msgId) => {
    const text = (inboxReply[msgId] || '').trim();
    if (!text) return;
    try {
      const { upsertRow } = await import('../../lib/api');
      const orig = inboxMessages.find(m => m.id === msgId);
      const reply = {
        id: `msg_${Date.now()}`,
        sender_id: currentUser?.id || 'parent',
        sender_name: currentUser?.name || 'Parent',
        sender_role: 'parent',
        recipient_role: 'teacher',
        recipient_id: orig?.sender_id || null,
        student_id: child.id,
        student_name: child.name,
        subject: orig?.subject ? `Re: ${orig.subject}` : 'Reply from parent',
        body: text,
        status: 'Unread',
        created_at: new Date().toISOString(),
      };
      await upsertRow('messages', reply);
      if (orig && orig.status === 'Unread') {
        await upsertRow('messages', { ...orig, status: 'Read' });
        setInboxMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'Read' } : m));
      }
      setInboxReply(prev => ({ ...prev, [msgId]: '' }));
      notify('Reply sent to teacher', 'success', 'Messages');
    } catch (e) {
      notify(`Failed to send reply: ${e.message}`, 'error');
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

        {/* Unread Teacher Messages Alert Banner */}
        {unreadInbox.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
            border: '1px solid #7dd3fc',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(2,132,199,0.08)',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: '#0284c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0
              }}>
                <Mail size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>New Message from Teacher: {unreadInbox[0].sender_name || 'Staff'}</span>
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                    {unreadInbox.length} UNREAD
                  </span>
                </div>
                <div style={{ color: '#334155', fontSize: 13, marginTop: 3 }}>
                  <strong>Subject:</strong> {unreadInbox[0].subject || 'No Subject'} — <em>"{unreadInbox[0].body?.slice(0, 90)}{unreadInbox[0].body?.length > 90 ? '…' : ''}"</em>
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 18px', gap: 6, fontWeight: 600 }}
              onClick={() => store?.navigate ? store.navigate('parent', { tab: 'contact' }) : null}
            >
              <Mail size={15} /> View & Reply
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="stat-tiles stagger">
          <KpiCard iconComponent={<BarChart3 size={20} />} label="Overall Average" value={`${overallAvg}%`} accent="#047857" />
          <KpiCard iconComponent={<ClipboardList size={20} />} label="Attendance Rate" value={attendanceRate !== '-' ? `${attendanceRate}%` : '-'} accent={Number(attendanceRate) >= 80 ? '#047857' : '#F59E0B'} />
          <KpiCard iconComponent={<Wallet size={20} />} label="Fee Balance" value={fmtKES(outstanding)} accent={outstanding > 0 ? '#D13438' : '#107C10'}>
            <div style={{ marginTop: 6 }}><ProgressBar value={feePercent} color="#107C10" /></div>
          </KpiCard>
          <KpiCard iconComponent={<Heart size={20} />} label="Health Visits" value={healthRecords.length} accent="#047857" />
        </div>

        {/* Zeraki-style results summary — only once the DoS has published results */}
        {store?.settings?.results_published && subjects.length > 0 && (
          <ResultsSummary
            child={child}
            classmates={classmates}
            gradeBoundaries={gradeBoundaries}
            settings={store?.settings || {}}
            examTitle={store?.settings?.current_exam || 'End Term Exam'}
            termName={store?.settings?.current_term || 'Term 2'}
          />
        )}

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
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8, position: 'relative' }} onClick={() => store.navigate('parent', { tab: 'contact' })}>
              <Mail size={16} /> Messages & Contact
              {unreadInbox.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
                  {unreadInbox.length} New
                </span>
              )}
            </button>
            <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => { setMsgForm({ ...msgForm, isMeeting: true }); setMsgModal(true); }}>
              <Calendar size={16} /> Request Meeting
            </button>
          </div>
        </div>

        {/* Recent Messages from Teachers Card */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color="#0284c7" /> Recent Messages from Teachers
              {unreadInbox.length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                  {unreadInbox.length} unread
                </span>
              )}
            </h3>
            <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => store.navigate('parent', { tab: 'contact' })}>
              Open Messages Inbox →
            </button>
          </div>
          {inboxMessages.length === 0 ? (
            <div className="muted" style={{ padding: '16px', textAlign: 'center', fontSize: 13 }}>
              No messages from teachers yet. You can write to any teacher or staff member using the "Messages & Contact" tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inboxMessages.slice(0, 3).map((m, idx) => (
                <div key={m.id || idx} style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${m.status === 'Unread' ? '#93c5fd' : 'var(--border)'}`,
                  background: m.status === 'Unread' ? '#f0f9ff' : '#fafafa',
                  borderLeft: `4px solid ${m.status === 'Unread' ? '#0284c7' : '#94a3b8'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {m.subject || 'Message'}
                      {m.status === 'Unread' && <span style={{ marginLeft: 8, background: '#0284c7', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>NEW</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {m.status === 'Unread' && (
                        <button onClick={() => handleMarkInboxRead(m.id)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                          Mark Read
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: '#64748b' }}>{(m.created_at || '').slice(0, 10)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    From: <strong>{m.sender_name || 'Teacher'}</strong> ({m.sender_role || 'teacher'}) {m.student_name ? `· regarding ${m.student_name}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {m.body}
                  </div>
                  {m.reply && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                      <strong>Your Reply:</strong> {m.reply}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                      placeholder={`Reply directly to ${m.sender_name || 'the teacher'}…`}
                      value={inboxReply[m.id] || ''}
                      onChange={e => setInboxReply(prev => ({ ...prev, [m.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleInboxReply(m.id); }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12, gap: 4 }}
                      disabled={!(inboxReply[m.id] || '').trim()}
                      onClick={() => handleInboxReply(m.id)}
                    >
                      <Send size={12} /> Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

  // â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  
  // ── CONTACT TEACHER TAB ──
  if (activeTab === 'contact') {
    return (
      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Messages & Communications</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Direct messages from teachers and school administration regarding {child?.name || 'your child'}.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setMsgForm({ to: 'Class Teacher', subject: '', body: '', isMeeting: false }); setMsgModal(true); }}>
            <Send size={15} style={{ marginRight: 6 }} /> Compose Message
          </button>
        </div>

        {/* Full Inbox Card */}
        <div className="card card-pad" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={18} color="#0284c7" /> Received Messages from Teachers & Staff
              {inboxMessages.length > 0 && (
                <span style={{ background: '#0284c7', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {inboxMessages.length} total
                </span>
              )}
              {unreadInbox.length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {unreadInbox.length} unread
                </span>
              )}
            </h3>
          </div>

          {inboxMessages.length === 0 ? (
            <div className="muted" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <Mail size={36} style={{ color: '#cbd5e1', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>No messages received from teachers yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                When your child's teachers or school administration send you a message, it will appear right here.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {inboxMessages.map((m, i) => (
                <div
                  key={m.id || i}
                  style={{
                    padding: '16px 18px',
                    background: m.status === 'Unread' ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${m.status === 'Unread' ? '#93c5fd' : '#e2e8f0'}`,
                    borderRadius: 10,
                    borderLeft: `5px solid ${m.status === 'Unread' ? '#0284c7' : '#94a3b8'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{m.subject || 'Message from Teacher'}</span>
                      {m.status === 'Unread' ? (
                        <span style={{ marginLeft: 8, background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>NEW</span>
                      ) : m.status === 'Replied' ? (
                        <span style={{ marginLeft: 8, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>REPLIED</span>
                      ) : (
                        <span style={{ marginLeft: 8, background: '#e2e8f0', color: '#475569', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>READ</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {m.status === 'Unread' && (
                        <button onClick={() => handleMarkInboxRead(m.id)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                          Mark as Read
                        </button>
                      )}
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>From: <strong style={{ color: '#0f172a' }}>{m.sender_name || 'Staff'}</strong></span>
                    <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{m.sender_role || 'teacher'}</span>
                    {m.student_name && <span style={{ color: '#0284c7' }}>· Re: <strong>{m.student_name}</strong></span>}
                  </div>

                  <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    {m.body}
                  </div>

                  {/* Previous reply thread */}
                  {m.reply && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 2 }}>
                        Your Reply {m.replied_at ? `(${new Date(m.replied_at).toLocaleString()})` : ''}:
                      </div>
                      <div style={{ fontSize: 13, color: '#14532d' }}>{m.reply}</div>
                    </div>
                  )}

                  {/* Quick reply input */}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 13 }}
                      placeholder={`Reply directly to ${m.sender_name || 'the teacher'}…`}
                      value={inboxReply[m.id] || ''}
                      onChange={e => setInboxReply(prev => ({ ...prev, [m.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleInboxReply(m.id); }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', gap: 6, fontSize: 13 }}
                      disabled={!(inboxReply[m.id] || '').trim()}
                      onClick={() => handleInboxReply(m.id)}
                    >
                      <Send size={14} /> Send Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compose Form & Meeting Requests */}
        <div className="grid grid-2" style={{ gap: 24 }}>
          <div className="card card-pad">
            <h3 className="section-title">Send a New Message</h3>
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

  // â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  
  // ── HEALTH RECORDS TAB ──
  // â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  â |  
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

        {/* Clinic & Health Notices */}
        <div className="card card-pad" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hospital size={16} color="#047857" /> Clinic & Health Notices
            </h3>
            <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => store.navigate('parent', { tab: 'contact' })}>
              View Teacher Messages ({inboxMessages.length}) →
            </button>
          </div>
          {inboxMessages.filter(m => m.sender_role === 'nurse' || m.sender_role === 'clinic' || (m.subject || '').toLowerCase().includes('clinic') || (m.subject || '').toLowerCase().includes('health')).length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
              <Heart size={28} style={{ color: '#cbd5e1', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              <div>No clinic or health notes from the school medical staff.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inboxMessages.filter(m => m.sender_role === 'nurse' || m.sender_role === 'clinic' || (m.subject || '').toLowerCase().includes('clinic') || (m.subject || '').toLowerCase().includes('health')).map((m, i) => (
                <div key={m.id || i} style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, borderLeft: '4px solid #047857' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.subject || 'Health Notice'}</div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{(m.created_at || '').slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    From: <strong>{m.sender_name || 'Clinic'}</strong>
                    <Hospital size={13} color="#047857" />
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



