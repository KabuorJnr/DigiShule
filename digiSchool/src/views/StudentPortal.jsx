import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS, NOTICES, ASSIGNMENTS_LIST, STUDENT_ATTENDANCE_LOG, STUDY_MATERIALS, REVISION_DOWNLOADS, STUDENT_FEE_ACCOUNT, UPCOMING_EVENTS } from '../data/seed';
import { LIBRARY_BOOKS } from '../data/modules';
import { fetchClassRank } from '../lib/api';
import { listFiles, openFilePDF, downloadFilePDF } from '../lib/fileStore';
import Modal from '../components/Modal';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  BarChart3, Trophy, FileText, Wallet, CreditCard, Mail, ClipboardList,
  Calendar, CheckCircle2, Clock, XCircle, DollarSign, AlertTriangle,
  BookOpen, Download, Eye, Send, Loader
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'class', label: 'My Class' },
  { id: 'subjects', label: 'My Subjects' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'results', label: 'Results' },
  { id: 'resources', label: 'Resources' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'finance', label: 'Finance' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'notices', label: 'Notices' },
];

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];
const MOCK_TIMETABLE = {
  'Monday': ['Mathematics', 'English', 'Science', 'Break', 'History', 'Geography', 'Lunch', 'P.E.'],
  'Tuesday': ['Science', 'Mathematics', 'Art', 'Break', 'English', 'Computer', 'Lunch', 'History'],
  'Wednesday': ['Geography', 'Science', 'Mathematics', 'Break', 'Music', 'English', 'Lunch', 'Clubs'],
  'Thursday': ['English', 'History', 'Mathematics', 'Break', 'Science', 'Geography', 'Lunch', 'Art'],
  'Friday': ['Mathematics', 'Science', 'English', 'Break', 'P.E.', 'Computer', 'Lunch', 'Assembly'],
};

const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

export default function StudentPortal({ store, user }) {
  const { students, gradeBoundaries, examSchedules, feeStructure, navigate, notify } = store;
  const me = students[0];
  const [tab, setTab] = useState('dashboard');
  const [rank, setRank] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ reference: '', method: 'M-Pesa' });
  const [feeAccount, setFeeAccount] = useState(STUDENT_FEE_ACCOUNT);
  const [msgModal, setMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', body: '' });
  const [subFilter, setSubFilter] = useState('All');
  const [resTab, setResTab] = useState('library');
  // Supabase cloud files
  const [cloudMaterials, setCloudMaterials] = useState([]);
  const [cloudAssignments, setCloudAssignments] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [actionId, setActionId] = useState(null);

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
      const scores = me.scores[sub];
      if (!scores) return null;
      const row = computeRow(scores);
      const grade = gradeFor(row.average, gradeBoundaries);
      return { subject: sub, ...row, grade };
    }).filter(Boolean);
  }, [me, gradeBoundaries]);

  const overallAvg = subjects.length ? (subjects.reduce((s, r) => s + r.average, 0) / subjects.length).toFixed(1) : 0;

  const trendData = useMemo(() => [
    { term: 'Last Year T3', avg: 72 },
    { term: 'Term 1', avg: 76 },
    { term: 'Term 2', avg: Number(overallAvg) || 78 }
  ], [overallAvg]);

  const upcomingExams = (examSchedules || []).filter(e => e.sessions?.some(s => s.status === 'Upcoming'));

  const attLog = STUDENT_ATTENDANCE_LOG;
  const attTotals = useMemo(() => ({
    total: attLog.length,
    present: attLog.filter(a => a.status === 'Present').length,
    absent: attLog.filter(a => a.status === 'Absent').length,
    late: attLog.filter(a => a.status === 'Late').length,
  }), [attLog]);
  const attPct = attTotals.total ? ((attTotals.present + attTotals.late) / attTotals.total * 100).toFixed(1) : 0;

  const classmates = useMemo(() => {
    if (!me) return [];
    return students.filter(s => s.class === me.class).sort((a, b) => a.name.localeCompare(b.name));
  }, [me, students]);

  const handlePay = () => {
    const ref = payForm.reference?.trim();
    if (!ref) { notify('Enter a valid reference code', 'warning'); return; }
    // Mock an amount since the user only inputs the reference code for verification
    const amt = 2500;
    const newPayment = { id: `fp${Date.now()}`, date: new Date().toISOString().slice(0, 10), method: payForm.method, ref: ref.toUpperCase(), amount: amt, status: 'Verification Pending' };
    setFeeAccount(prev => ({ ...prev, totalPaid: prev.totalPaid + amt, outstanding: prev.outstanding - amt, payments: [newPayment, ...prev.payments] }));
    setPayModal(false);
    setPayForm({ reference: '', method: 'M-Pesa' });
    notify(`Reference ${ref.toUpperCase()} submitted for verification`, 'success', 'Payment');
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

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <>
          <div className="stat-tiles">
            <KpiCard iconComponent={<BarChart3 size={20} />} label="Overall Average" value={`${overallAvg}%`} accent="#0078D4" />
            <KpiCard iconComponent={<Trophy size={20} />} label="Class Position" value={rank ? `${rank.position} / ${rank.classSize}` : '—'} />
            <KpiCard iconComponent={<FileText size={20} />} label="Upcoming Exams" value={upcomingExams.length} accent="#FFB900" />
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
              {NOTICES.filter(n => n.audience.includes('all') || n.audience.includes('students')).slice(0, 3).map(n => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.date} — {n.postedBy}</div>
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
              <div><span className="muted" style={{ fontSize: 12 }}>Class Teacher</span><div style={{ fontWeight: 600 }}>Mr. Omondi</div></div>
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
                    {WEEK_DAYS.map(day => {
                      const subject = MOCK_TIMETABLE[day][idx];
                      const isBreak = subject === 'Break' || subject === 'Lunch';
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
            {ASSIGNMENTS_LIST.filter(a => subFilter === 'All' || a.subject === subFilter).map(a => (
              <div key={a.id} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14 }}>{a.title}</h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <Badge color="blue">{a.subject}</Badge>
                      <span className="muted" style={{ fontSize: 12 }}>by {a.teacher}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: new Date(a.dueDate) < new Date() ? '#D13438' : '#107C10' }}>Due: {a.dueDate}</div>
                    <Badge color={a.status === 'Active' ? 'green' : 'gray'}>{a.status}</Badge>
                  </div>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#444', lineHeight: 1.5 }}>{a.description}</p>
              </div>
            ))}
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
            <div className="card card-pad">
              <h3 className="section-title">Library Catalog</h3>
              <div className="scroll-x">
                <table className="table">
                  <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th><th>Status</th></tr></thead>
                  <tbody>
                    {LIBRARY_BOOKS.map(b => (
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
          )}

          {resTab === 'materials' && (
            <div className="card card-pad">
              <h3 className="section-title">
                Study Materials ({STUDY_MATERIALS.length + cloudMaterials.length})
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
                {/* Seed study materials */}
                {STUDY_MATERIALS.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{m.subject} · {m.uploadedBy} · {m.date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="muted" style={{ fontSize: 11 }}>{m.size}</span>
                      <button className="btn btn-sm btn-primary" style={{ gap: 4 }} onClick={() => notify(`Opening ${m.title}`, 'info')}><Eye size={14} /> View</button>
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
                    {REVISION_DOWNLOADS.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.title}</td>
                        <td>{d.subject}</td>
                        <td>{d.year}</td>
                        <td><Badge color={d.type === 'Past Paper' ? 'blue' : 'green'}>{d.type}</Badge></td>
                        <td className="muted">{d.size}</td>
                        <td><button className="btn btn-sm" style={{ gap: 4 }} onClick={() => notify(`Downloading ${d.title}...`, 'info')}><Download size={14} /> Download</button></td>
                      </tr>
                    ))}
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
        <div className="card card-pad">
          <h3 className="section-title">School Calendar & Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {UPCOMING_EVENTS.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#e8f0fe', color: '#0078D4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  <div style={{ fontSize: 16 }}>{e.date.split(' ')[1]}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase' }}>{e.date.split(' ')[0]}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.desc}</div>
                </div>
              </div>
            ))}
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
        </div>
      )}

      {/* ===== NOTICES ===== */}
      {tab === 'notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {NOTICES.filter(n => n.audience.includes('all') || n.audience.includes('students')).map(n => (
            <div key={n.id} className="card card-pad">
              <h4 style={{ margin: 0, fontSize: 14 }}>{n.title}</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                <span className="muted" style={{ fontSize: 12 }}>{n.date}</span>
                <Badge color="blue">{n.role}</Badge>
                <span className="muted" style={{ fontSize: 12 }}>by {n.postedBy}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6 }}>{n.body}</p>
            </div>
          ))}
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
