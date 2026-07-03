import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS } from '../data/seed';
const LIBRARY_BOOKS = [];
import { fetchClassRank, fetchStudentByQuery } from '../lib/api';
import { listFiles, openFilePDF, downloadFilePDF } from '../lib/fileStore';
import { supabase } from '../lib/supabaseClient';
import Modal from '../components/Modal';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  BarChart3, Trophy, FileText, Wallet, CreditCard, Mail, ClipboardList,
  Calendar, CheckCircle2, Clock, XCircle, DollarSign, AlertTriangle,
  BookOpen, Download, Eye, Send, Loader, Award, Image as ImageIcon
} from 'lucide-react';
import GalleryViewer from '../components/GalleryViewer';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'class', label: 'My Class' },
  { id: 'subjects', label: 'My Subjects' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'health', label: 'Health & Clinic' },
  { id: 'results', label: 'Results' },
  { id: 'resources', label: 'Resources' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'finance', label: 'Finance' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'notices', label: 'Notices' },
  { id: 'gallery', label: 'Media Gallery' },
  { id: 'settings', label: 'Profile & Settings' },
];

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];


const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

export default function StudentPortal({ store, user, params }) {
  const { students, gradeBoundaries, examSchedules, feeStructure, navigate, notify, notifications } = store;
  const [me, setMe] = useState(null);

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      const targetId = params?.childId || user?.student_id || user?.studentId || user?.link || user?.id;
      const targetAdm = user?.username;
      
      let res = null;
      if (targetId) res = await fetchStudentByQuery('id', targetId);
      if (!res && targetAdm) res = await fetchStudentByQuery('adm', targetAdm);
      if (!res && targetId) res = await fetchStudentByQuery('adm', targetId);
      
      if (active && res) setMe(res);
    };
    loadMe();
    return () => { active = false; };
  }, [user, params]);
  const [tab, setTab] = useState('dashboard');
  const [rank, setRank] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ reference: '', method: 'M-Pesa' });
  const [payments, setPayments] = useState([]);
  const [msgModal, setMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', body: '' });
  const [subFilter, setSubFilter] = useState('All');
  const [resTab, setResTab] = useState('library');
  // Supabase cloud files
  const [cloudMaterials, setCloudMaterials] = useState([]);
  const [cloudAssignments, setCloudAssignments] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPw.length < 6) return notify('Password must be at least 6 characters long', 'warning');
    if (pwForm.newPw !== pwForm.confirmPw) return notify('Passwords do not match', 'warning');
    
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwBusy(false);
    
    if (error) {
      notify(`Failed to update password: ${error.message}`, 'error');
    } else {
      notify('Password successfully updated!', 'success');
      setPwForm({ newPw: '', confirmPw: '' });
    }
  };

  const [libraryBooks, setLibraryBooks] = useState([]);
  const [libraryLoans, setLibraryLoans] = useState([]);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);

  useEffect(() => {
    let active = true;
    import('../lib/api').then(({ fetchTable }) => {
      Promise.all([
        fetchTable('libraryBooks'), fetchTable('libraryLoans'), fetchTable('schoolEvents'),
        fetchTable('studentAttendance'), fetchTable('assignmentSubmissions'), fetchTable('clinicVisits'),
        fetchTable('disciplinaryRecords'), fetchTable('financePayments')
      ]).then(([bks, lns, evs, att, subs, health, disc]) => {
        if (!active) return;
        setLibraryBooks(bks || []);
        setLibraryLoans(lns || []);
        setSchoolEvents(evs || []);
        setAttendanceRecords((att || []).filter(a => a.student_id === me?.id || a.adm === me?.adm));
        setSubmissions((subs || []).filter(s => s.student_id === me?.id || s.adm === me?.adm));
        setHealthRecords((health || []).filter(h => h.adm === me?.adm));
        setDisciplinary((disc || []).filter(d => d.adm === me?.adm));
        setPayments((pays || []).filter(p => p.student_id === me?.id || p.adm === me?.adm));
      });
    });
    return () => { active = false; };
  }, [me?.id, me?.adm]);
  useEffect(() => {
    let active = true;
    fetchClassRank().then(r => { if (active) setRank(r); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Load cloud files when resources tab is active
  useEffect(() => {
    if (tab !== 'resources') return;
    let active = true;
    setCloudLoading(true);
    Promise.all([
      listFiles('materials').catch(() => []),
      listFiles('assignments').catch(() => []),
    ]).then(([mats, assigns]) => {
      if (!active) return;
      setCloudMaterials(mats);
      setCloudAssignments(assigns);
    }).finally(() => { if (active) setCloudLoading(false); });
    return () => { active = false; };
  }, [tab]);

  const handleCloudOpen = async (f) => {
    setActionId(f.id + '_o');
    try { await openFilePDF(f.storage_path); }
    catch (e) { notify(`Cannot open: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  const handleCloudDownload = async (f) => {
    setActionId(f.id + '_d');
    try { await downloadFilePDF(f.storage_path, f.name); }
    catch (e) { notify(`Cannot download: ${e.message}`, 'error'); }
    finally { setActionId(null); }
  };

  const subjects = useMemo(() => {
    if (!me) return [];
    return SUBJECTS.map(sub => {
      const scores = (me.scores || {})[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [me, gradeBoundaries]);

  const overallAvg = subjects.length ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1) : 0;

  const trendData = useMemo(() => [
    { term: 'Term 1', avg: 0 },
    { term: 'Term 2', avg: Number(overallAvg) || 0 }
  ], [overallAvg]);

  const upcomingExams = (examSchedules || []).filter(e => e.sessions?.some(s => s.status === 'Upcoming'));

  const attLog = useMemo(() => {
    return attendanceRecords.map(a => {
      const d = new Date(a.date);
      const day = d.toLocaleDateString('en-US', { weekday: 'long' });
      return { ...a, day };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendanceRecords]);

  const attTotals = useMemo(() => ({
    total: attLog.length,
    present: attLog.filter(a => a.status === 'Present').length,
    absent: attLog.filter(a => a.status === 'Absent').length,
    late: attLog.filter(a => a.status === 'Late').length,
  }), [attLog]);
  const attPct = attTotals.total ? ((attTotals.present + attTotals.late) / attTotals.total * 100).toFixed(1) : 0;

  const termFees = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0;
  const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const outstanding = termFees - totalPaid;
  const dueDate = '2026-07-05'; // Hardcoded or dynamic from settings

  const feeAccount = {
    totalBilled: termFees,
    totalPaid,
    outstanding,
    payments,
    structure: feeStructure || [],
    dueDate
  };

  const classmates = useMemo(() => {
    if (!me) return [];
    return students.filter(s => s.class === me.class).sort((a, b) => a.name.localeCompare(b.name));
  }, [me, students]);

  const handlePay = async () => {
    const ref = payForm.reference?.trim();
    if (!ref) { notify('Enter a valid reference code', 'warning'); return; }
    
    try {
      const { upsertRow } = await import('../lib/api');
      // For real implementation, you would typically verify the M-Pesa transaction here
      // For this step, we allow any amount user inputs for testing (or fixed to what they billed)
      // Since there's no amount input in StudentPortal's modal right now, let's just create a payment entry
      const amt = feeStructure?.reduce((s, f) => s + (f.f1 || 0), 0) || 0; // Paying full term fees
      
      const newPayment = { 
        id: `pay_${Date.now()}`, 
        date: new Date().toISOString().slice(0, 10), 
        method: payForm.method, 
        ref: ref.toUpperCase(), 
        amount: amt, 
        status: 'Verification Pending',
        student_id: me.id,
        adm: me.adm,
        created_at: new Date().toISOString()
      };
      
      await upsertRow('financePayments', newPayment);
      setPayments(prev => [newPayment, ...prev]);
      setPayModal(false);
      setPayForm({ reference: '', method: 'M-Pesa' });
      notify(`Reference ${ref.toUpperCase()} submitted for verification`, 'success', 'Payment');
    } catch (e) {
      notify(`Payment error: ${e.message}`, 'error', 'Payment');
    }
  };

  const handleMsg = () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Fill all fields', 'warning'); return; }
    setMsgModal(false);
    setMsgForm({ subject: '', body: '' });
    notify('Message sent to school administration', 'success', 'Messages');
  };

  if (!me) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: 40 }}>
        <div style={{ width: 80, height: 80, background: '#f8d7da', color: '#dc3545', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ margin: '0 0 10px' }}>No Student Profile Found</h2>
        <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
          Your account is not linked to any student record, or there are no students registered in the database yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Student Portal" subtitle={`${me.name} · ${me.adm} · Grade ${me.class}`} />

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} style={{ whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      
      {user?.role === 'parent' && (
        <div style={{ background: '#e0e7ff', color: '#3730a3', padding: '12px 16px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#4f46e5', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <strong>Parental Administrative Access Active.</strong> You are viewing {me.name}'s portal with elevated permissions.
          </div>
        </div>
      )}

      {/* Disciplinary Notice */}
      {disciplinary.filter(c => c.status !== 'Resolved').length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>Active Disciplinary Notice</strong>
            <div style={{ fontSize: 14 }}>You have unresolved disciplinary records that require your attention. Please check with the administration.</div>
          </div>
        </div>
      )}

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<BarChart3 size={20} />} label="Overall Average" value={`${overallAvg}%`} accent="#0078D4" />
            <KpiCard iconComponent={<Trophy size={20} />} label="Class Position" value={rank ? `${rank.position} / ${rank.classSize}` : '—'} />
            <KpiCard iconComponent={<Award size={20} />} label="Behavior Score" value="0 pts" accent="#9CA3AF" sub="N/A" />
            <KpiCard iconComponent={<Wallet size={20} />} label="Fee Balance" value={fmtKES(feeAccount.outstanding)} accent={feeAccount.outstanding > 0 ? '#D13438' : '#107C10'}>
              <div style={{ marginTop: 6 }}><ProgressBar value={(feeAccount.totalPaid / feeAccount.totalBilled) * 100} color="#107C10" /></div>
            </KpiCard>
          </div>

          {/* Quick Actions */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Quick Actions</h3>
            <div className="grid grid-4" style={{ gap: 10 }}>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setTab('results')}><BarChart3 size={16} /> View Assessment</button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setTab('assignments')}><ClipboardList size={16} /> View Assignments</button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setTab('timetable')}><Calendar size={16} /> Weekly Timetable</button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setMsgModal(true)}><Mail size={16} /> Message School</button>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
            {/* Performance Trend */}
            <div className="card card-pad">
              <h3 className="section-title">Performance Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="term" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Average %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Notices */}
            <div className="card card-pad">
              <h3 className="section-title">Recent Notices</h3>
              {(notifications || []).filter(n => (n.audience || []).includes('all') || (n.audience || []).includes('students')).slice(0, 3).map(n => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{(n.created_at || '').slice(0, 10)} — {n.posted_by}</div>
                </div>
              ))}
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('notices')}>View All Notices →</button>
            </div>
          </div>
        </>
      )}

      {/* ===== MY CLASS ===== */}
      {tab === 'class' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Class Information</h3>
            <div className="grid grid-4" style={{ gap: 12 }}>
              <div><span className="muted" style={{ fontSize: 12 }}>Grade</span><div style={{ fontWeight: 600, fontSize: 18 }}>Grade {me.class}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Stream</span><div style={{ fontWeight: 600, fontSize: 18 }}>{me.class.slice(1)}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Class Teacher</span><div style={{ fontWeight: 600 }}>{store.teachers?.find(t => t.assignedClass === me.class)?.name || 'Not Assigned'}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Total Students</span><div style={{ fontWeight: 600, fontSize: 18 }}>{classmates.length}</div></div>
            </div>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Classmates ({classmates.length})</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>Adm No.</th><th>Gender</th></tr></thead>
                <tbody>
                  {classmates.map((s, i) => (
                    <tr key={s.id} style={s.id === me.id ? { background: '#e8f0fe' } : {}}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: s.id === me.id ? 700 : 400 }}>{s.name} {s.id === me.id && <Badge color="blue">You</Badge>}</td>
                      <td className="muted">{s.adm}</td>
                      <td>{s.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== TIMETABLE ===== */}
      {tab === 'timetable' && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Weekly Class Timetable</h3>
            <Badge color="blue">Grade {me.class}</Badge>
          </div>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Time</th>
                  {WEEK_DAYS.map(day => <th key={day} style={{ textAlign: 'center' }}>{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((time, idx) => (
                  <tr key={time}>
                    <td className="muted" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{time}</td>
                    {WEEK_DAYS.map((day, dayIdx) => {
                      const cell = store.timetables?.[me.class]?.grid?.[idx]?.[dayIdx];
                      const subject = cell?.type === 'lesson' ? cell.subject : cell?.label || (idx === 3 ? 'Break' : idx === 6 ? 'Lunch' : '-');
                      const isBreak = cell?.type === 'break' || subject === 'Break' || subject === 'Lunch';
                      return (
                        <td key={day} style={{ textAlign: 'center', padding: isBreak ? 8 : 12 }}>
                          {isBreak ? (
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '4px', fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                              {subject}
                            </div>
                          ) : (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 500 }}>
                              {subject}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MY SUBJECTS ===== */}
      {tab === 'subjects' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Subject Performance</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="average" name="Average %" fill="#0078D4" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Subjects & Teachers</h3>
            <table className="table">
              <thead><tr><th>Subject</th><th>Teacher</th><th>CAT 1</th><th>CAT 2</th><th>Midterm</th><th>End-Term</th><th>Avg %</th><th>Grade</th></tr></thead>
              <tbody>
                {subjects.map(r => {
                  const teacher = store.teachers?.find(t => t.subject === r.subject);
                  return (
                    <tr key={r.subject}>
                      <td style={{ fontWeight: 600 }}>{r.subject}</td>
                      <td className="muted">{teacher?.name || '—'}</td>
                      <td>{r.cat1}</td><td>{r.cat2}</td><td>{r.midterm}</td><td>{r.endterm}</td>
                      <td style={{ fontWeight: 700 }}>{r.average}</td>
                      <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== ASSIGNMENTS ===== */}
      {tab === 'assignments' && (
        <>
          <div className="toolbar">
            <select className="select" style={{ width: 180 }} value={subFilter} onChange={e => setSubFilter(e.target.value)}>
              <option value="All">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cloudAssignments.filter(a => subFilter === 'All' || a.subject === subFilter).map(a => {
              const sub = submissions.find(s => s.assignment_id === a.id);
              const isDue = new Date(a.due_date) < new Date();
              return (
                <div key={a.id} className="card card-pad">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14 }}>{a.title}</h4>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Badge color="blue">{a.subject}</Badge>
                        <span className="muted" style={{ fontSize: 12 }}>by {a.uploaded_by}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDue ? '#D13438' : '#107C10' }}>Due: {a.due_date}</div>
                      {sub ? (
                        <Badge color={sub.status === 'Graded' ? 'green' : 'amber'}>{sub.status}</Badge>
                      ) : (
                        <Badge color={isDue ? 'red' : 'gray'}>{isDue ? 'Missing' : 'Pending'}</Badge>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '10px 0', fontSize: 13, color: '#444', lineHeight: 1.5 }}>{a.description || a.name}</p>
                  
                  {sub ? (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>Submitted:</strong> {new Date(sub.submitted_at).toLocaleString()}</span>
                        {sub.grade && <span><strong>Grade:</strong> <Badge color="blue">{sub.grade}</Badge></span>}
                      </div>
                      {sub.feedback && <div style={{ marginTop: 8, color: '#475569' }}><strong>Feedback:</strong> {sub.feedback}</div>}
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => notify('Submission upload modal would open here. (Feature coming soon)', 'info')}>
                      <Send size={14} style={{ marginRight: 6 }} /> Mark as Done / Upload
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== ATTENDANCE ===== */}
      {tab === 'attendance' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<Calendar size={20} />} label="Total Days" value={attTotals.total} />
            <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Present" value={attTotals.present} accent="#107C10" />
            <KpiCard iconComponent={<Clock size={20} />} label="Late" value={attTotals.late} accent="#FFB900" />
            <KpiCard iconComponent={<XCircle size={20} />} label="Absent" value={attTotals.absent} accent="#D13438" />
          </div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Attendance Rate</h3>
              <span style={{ fontSize: 24, fontWeight: 700, color: attPct >= 90 ? '#107C10' : attPct >= 75 ? '#FFB900' : '#D13438' }}>{attPct}%</span>
            </div>
            <ProgressBar value={Number(attPct)} color={attPct >= 90 ? '#107C10' : attPct >= 75 ? '#FFB900' : '#D13438'} />
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Daily Attendance Log</h3>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Date</th><th>Day</th><th>Status</th></tr></thead>
                <tbody>
                  {attLog.slice().reverse().map(a => (
                    <tr key={a.id}>
                      <td className="muted">{a.date}</td>
                      <td>{a.day}</td>
                      <td><Badge color={a.status === 'Present' ? 'green' : a.status === 'Late' ? 'amber' : 'red'}>{a.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== HEALTH & CLINIC ===== */}
      {tab === 'health' && (
        <div className="card card-pad">
          <h3 className="section-title">Health & Clinic Records</h3>
          {healthRecords.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, background: '#e0e7ff', color: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 8px' }}>No Medical Records Found</h4>
              <p className="muted" style={{ maxWidth: 300, margin: '0 auto' }}>You have no clinic visits or health incidents recorded on file.</p>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Date</th><th>Complaint</th><th>Treatment</th><th>Notes</th></tr></thead>
                <tbody>
                  {healthRecords.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.date}</td>
                      <td>{v.complaint}</td>
                      <td>{v.treatment}</td>
                      <td className="muted">{v.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== RESULTS ===== */}
      {tab === 'results' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Term 2 Results</h3>
              {rank && <span className="muted">Class Position: <strong>{rank.position} / {rank.classSize}</strong></span>}
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Subject</th><th>CAT 1 /30</th><th>CAT 2 /30</th><th>Midterm /100</th><th>End-Term /100</th><th>Total</th><th>Avg %</th><th>Grade</th></tr></thead>
                <tbody>
                  {subjects.map(r => (
                    <tr key={r.subject}>
                      <td style={{ fontWeight: 600 }}>{r.subject}</td>
                      <td>{r.cat1}</td><td>{r.cat2}</td><td>{r.midterm}</td><td>{r.endterm}</td>
                      <td style={{ fontWeight: 700 }}>{r.total}</td>
                      <td style={{ fontWeight: 700 }}>{r.average}</td>
                      <td><Badge color={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : r.grade === 'D' ? 'amber' : 'blue'}>{r.grade}</Badge></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                    <td colSpan={6}>Overall Average</td>
                    <td>{overallAvg}%</td>
                    <td><Badge color={Number(overallAvg) >= 70 ? 'green' : Number(overallAvg) >= 50 ? 'amber' : 'red'}>{gradeFor(Number(overallAvg), gradeBoundaries)}</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Subject Performance Analysis</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="average" fill="#0078D4" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ===== RESOURCES ===== */}
      {tab === 'resources' && (
        <>
          <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
            {['library', 'materials', 'downloads'].map(t => (
              <button key={t} className={`tab${resTab === t ? ' active' : ''}`} onClick={() => setResTab(t)}>
                {t === 'library' ? 'Library' : t === 'materials' ? 'Study Materials' : 'Revision Downloads'}
              </button>
            ))}
          </div>

          {resTab === 'library' && (
            <>
              {libraryLoans.filter(l => l.student_id === me.id).length > 0 && (
                <div className="card card-pad" style={{ marginBottom: 16 }}>
                  <h3 className="section-title">My Borrowed Items</h3>
                  <div className="scroll-x">
                    <table className="table">
                      <thead><tr><th>Item</th><th>Borrowed On</th><th>Due Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {libraryLoans.filter(l => l.student_id === me.id).map(l => (
                          <tr key={l.id} style={l.status === 'Overdue' ? { background: '#fef2f2' } : {}}>
                            <td style={{ fontWeight: 600 }}>{l.book}</td>
                            <td>{l.borrowed}</td>
                            <td>{l.due}</td>
                            <td><Badge color={l.status === 'Overdue' ? 'red' : 'blue'}>{l.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="card card-pad">
                <h3 className="section-title">Library Catalog</h3>
                <div className="scroll-x">
                  <table className="table">
                    <thead><tr><th>Title</th><th>Author / Brand</th><th>Category</th><th>Available</th><th>Status</th></tr></thead>
                    <tbody>
                      {libraryBooks.length > 0 ? libraryBooks.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600 }}>{b.title}</td>
                          <td className="muted">{b.author}</td>
                          <td><Badge color="gray">{b.category}</Badge></td>
                          <td>{b.available} / {b.copies}</td>
                          <td><Badge color={b.available > 0 ? 'green' : 'red'}>{b.available > 0 ? 'Available' : 'Out'}</Badge></td>
                        </tr>
                      )) : LIBRARY_BOOKS.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600 }}>{b.title}</td>
                          <td className="muted">{b.author}</td>
                          <td><Badge color={b.category === 'Set Book' ? 'blue' : b.category === 'Reference' ? 'amber' : 'gray'}>{b.category}</Badge></td>
                          <td>{b.available} / {b.copies}</td>
                          <td><Badge color={b.available > 0 ? 'green' : 'red'}>{b.available > 0 ? 'Available' : 'Out'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {resTab === 'materials' && (
            <div className="card card-pad">
              <h3 className="section-title">
                Study Materials ({cloudMaterials.length})
                {cloudLoading && <Loader size={14} style={{ marginLeft: 8, opacity: 0.5 }} />}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Teacher cloud uploads */}
                {cloudMaterials.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.description || m.name}</span>
                        <Badge color="green">New</Badge>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{m.subject} · {m.uploaded_by} · {m.uploaded_at?.slice(0,10)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="muted" style={{ fontSize: 11 }}>PDF · Cloud</span>
                      <button className="btn btn-sm btn-primary" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudOpen(m)}>
                        {actionId === m.id + '_o' ? <Loader size={13} /> : <Eye size={14} />} View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resTab === 'downloads' && (
            <div className="card card-pad">
              <h3 className="section-title">
                Assignments & Revision Downloads
                {cloudLoading && <Loader size={14} style={{ marginLeft: 8, opacity: 0.5 }} />}
              </h3>
              {/* Teacher-uploaded assignments from Supabase */}
              {cloudAssignments.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0078D4', marginBottom: 8, letterSpacing: 0.5 }}>TEACHER UPLOADS — CLOUD</div>
                  {cloudAssignments.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{d.description || d.name}</span>
                          <Badge color="green">New</Badge>
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>{d.subject} · Due: {d.due_date || '—'} · by {d.uploaded_by}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudOpen(d)}>
                          {actionId === d.id + '_o' ? <Loader size={13} /> : <Eye size={13} />} View
                        </button>
                        <button className="btn btn-sm" disabled={!!actionId} style={{ gap: 4 }} onClick={() => handleCloudDownload(d)}>
                          {actionId === d.id + '_d' ? <Loader size={13} /> : <Download size={13} />} Download
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b', margin: '16px 0 8px', letterSpacing: 0.5 }}>PAST PAPERS & REVISION</div>
                </>
              )}
              <div className="scroll-x">
                <table className="table">
                  <thead><tr><th>Title</th><th>Subject</th><th>Year</th><th>Type</th><th>Size</th><th></th></tr></thead>
                  <tbody>
                    {/* Empty placeholder since no DB table exists yet for revision downloads */}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== FINANCE ===== */}
      {tab === 'finance' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<DollarSign size={20} />} label="Total Billed" value={fmtKES(feeAccount.totalBilled)} />
            <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Total Paid" value={fmtKES(feeAccount.totalPaid)} accent="#107C10" />
            <KpiCard iconComponent={<AlertTriangle size={20} />} label="Outstanding" value={fmtKES(feeAccount.outstanding)} accent="#D13438" />
            <KpiCard iconComponent={<Calendar size={20} />} label="Due Date" value={feeAccount.dueDate} accent="#FFB900" />
          </div>

          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Payment Progress</h3>
              <span style={{ fontWeight: 700, color: '#107C10' }}>{((feeAccount.totalPaid / feeAccount.totalBilled) * 100).toFixed(0)}% Paid</span>
            </div>
            <ProgressBar value={(feeAccount.totalPaid / feeAccount.totalBilled) * 100} color="#107C10" />
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPayModal(true)}>Make Payment</button>
          </div>

          <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <div className="card card-pad">
              <h3 className="section-title">Fee Structure — Term 2</h3>
              <table className="table">
                <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {feeAccount.structure.map((s, i) => (
                    <tr key={i}><td>{s.item}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(s.amount)}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                    <td>Total</td><td style={{ textAlign: 'right' }}>{fmtKES(feeAccount.totalBilled)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card card-pad">
              <h3 className="section-title">Payment History</h3>
              <table className="table">
                <thead><tr><th>Date</th><th>Method</th><th>Ref</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {feeAccount.payments.map(p => (
                    <tr key={p.id}>
                      <td className="muted">{p.date}</td>
                      <td><Badge color={p.method === 'M-Pesa' ? 'green' : 'blue'}>{p.method}</Badge></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.ref}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKES(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== CALENDAR ===== */}
      {tab === 'calendar' && (
        <div className="card card-pad" style={{ height: '75vh', display: 'flex', flexDirection: 'column' }}>
          <h3 className="section-title">School Calendar & Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {store?.settings?.googleCalendarUrl ? (
              <iframe 
                src={store.settings.googleCalendarUrl} 
                style={{ border: 0, width: '100%', flex: 1, minHeight: '500px', borderRadius: 8 }} 
                frameBorder="0" 
                scrolling="no"
                title="School Calendar"
              ></iframe>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                The school has not integrated a public calendar yet.
              </div>
            )}
            
            {upcomingExams.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 12 }}>Upcoming Exams</h4>
                {upcomingExams.map(ex => (
                  <div key={ex.id} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 8, background: '#fff3cd', color: '#92400e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                      <div style={{ fontSize: 14 }}>EXAM</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{ex.type} — Starts {ex.startDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== NOTICES ===== */}
      {tab === 'notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(notifications || []).filter(n => (n.audience || []).includes('all') || (n.audience || []).includes('students')).map(n => (
            <div key={n.id} className="card card-pad">
              <h4 style={{ margin: 0, fontSize: 14 }}>{n.title}</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                <span className="muted" style={{ fontSize: 12 }}>{(n.created_at || '').slice(0, 10)}</span>
                <Badge color="blue">{n.role}</Badge>
                <span className="muted" style={{ fontSize: 12 }}>by {n.posted_by}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6 }}>{n.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ===== SETTINGS ===== */}
      {tab === 'gallery' && (
        <GalleryViewer />
      )}

      {tab === 'settings' && (
        <div className="card card-pad" style={{ maxWidth: 500, margin: '0 auto' }}>
          <h3 className="section-title">Change Password</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Enter a new password below. It must be at least 6 characters long.
          </p>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">New Password</label>
              <input 
                type="password" 
                className="input" 
                placeholder="••••••" 
                value={pwForm.newPw} 
                onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} 
                required 
              />
            </div>
            <div>
              <label className="field-label">Confirm Password</label>
              <input 
                type="password" 
                className="input" 
                placeholder="••••••" 
                value={pwForm.confirmPw} 
                onChange={e => setPwForm(p => ({ ...p, confirmPw: e.target.value }))} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }} disabled={pwBusy}>
              {pwBusy ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* ===== PAYMENT MODAL ===== */}
      {payModal && (
        <Modal title="Make a Payment" onClose={() => setPayModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setPayModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePay}>Submit Reference</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, fontSize: 13 }}>
              <strong>Outstanding Balance:</strong> {fmtKES(feeAccount.outstanding)}
            </div>
            <div>
              <label className="field-label">Reference Code *</label>
              <input type="text" className="input" placeholder="e.g. QGF123456" value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Payment Method</label>
              <select className="select" value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
                <option>M-Pesa</option>
                <option>Bank Transfer</option>
              </select>
            </div>
            {payForm.method === 'M-Pesa' && (
              <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, padding: 12, fontSize: 13 }}>
                <strong>M-Pesa Instructions:</strong><br />
                1. Go to M-Pesa → Lipa na M-Pesa → Pay Bill<br />
                2. Business No: <strong>123456</strong><br />
                3. Account No: <strong>{me.adm}</strong><br />
                4. Amount: Enter the amount you wish to pay<br />
                5. Enter the M-Pesa transaction code above
              </div>
            )}
            {payForm.method === 'Bank Transfer' && (
              <div style={{ background: '#e8f0fe', border: '1px solid #93c5fd', borderRadius: 6, padding: 12, fontSize: 13 }}>
                <strong>Bank Transfer Details:</strong><br />
                Bank: <strong>Equity Bank</strong><br />
                Account Name: <strong>EduOne Academy</strong><br />
                Account No: <strong>0123456789012</strong><br />
                Reference: <strong>{me.adm}</strong>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ===== MESSAGE MODAL ===== */}
      {msgModal && (
        <Modal title="Send Message to School" onClose={() => setMsgModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setMsgModal(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ gap: 6 }} onClick={handleMsg}><Send size={14} /> Send Message</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Subject *</label>
              <input className="input" placeholder="Message subject..." value={msgForm.subject} onChange={e => setMsgForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Message *</label>
              <textarea className="input" rows={4} placeholder="Write your message..." value={msgForm.body} onChange={e => setMsgForm(p => ({ ...p, body: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
