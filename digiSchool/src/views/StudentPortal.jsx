import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import { computeRow, gradeFor } from '../utils/grading';
import { SUBJECTS, NOTICES, ASSIGNMENTS_LIST, STUDENT_ATTENDANCE_LOG, STUDY_MATERIALS, REVISION_DOWNLOADS, STUDENT_FEE_ACCOUNT, UPCOMING_EVENTS } from '../data/seed';
import { LIBRARY_BOOKS } from '../data/modules';
import { fetchClassRank } from '../lib/api';
import Modal from '../components/Modal';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  BarChart3, Trophy, FileText, Wallet, CreditCard, Mail, ClipboardList,
  Calendar, CheckCircle2, Clock, XCircle, DollarSign, AlertTriangle,
  BookOpen, Download, Eye, Send
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'class', label: 'My Class' },
  { id: 'subjects', label: 'My Subjects' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'results', label: 'Results' },
  { id: 'resources', label: 'Resources' },
  { id: 'finance', label: 'Finance' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'notices', label: 'Notices' },
];

const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');

export default function StudentPortal({ store, user }) {
  const { students, gradeBoundaries, examSchedules, feeStructure, navigate, notify } = store;
  const me = students[0];
  const [tab, setTab] = useState('dashboard');
  const [rank, setRank] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'M-Pesa' });
  const [feeAccount, setFeeAccount] = useState(STUDENT_FEE_ACCOUNT);
  const [msgModal, setMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', body: '' });
  const [subFilter, setSubFilter] = useState('All');
  const [resTab, setResTab] = useState('library');

  useEffect(() => {
    let active = true;
    fetchClassRank().then(r => { if (active) setRank(r); }).catch(() => {});
    return () => { active = false; };
  }, []);

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
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { notify('Enter a valid amount', 'warning'); return; }
    const newPayment = { id: `fp${Date.now()}`, date: new Date().toISOString().slice(0, 10), method: payForm.method, ref: `QG${Math.random().toString(36).slice(2, 8).toUpperCase()}`, amount: amt, status: 'Confirmed' };
    setFeeAccount(prev => ({ ...prev, totalPaid: prev.totalPaid + amt, outstanding: prev.outstanding - amt, payments: [newPayment, ...prev.payments] }));
    setPayModal(false);
    setPayForm({ amount: '', method: 'M-Pesa' });
    notify(`Payment of ${fmtKES(amt)} recorded successfully`, 'success', 'Payment');
  };

  const handleMsg = () => {
    if (!msgForm.subject.trim() || !msgForm.body.trim()) { notify('Fill all fields', 'warning'); return; }
    setMsgModal(false);
    setMsgForm({ subject: '', body: '' });
    notify('Message sent to school administration', 'success', 'Messages');
  };

  if (!me) return null;

  return (
    <div>
      <PageHeader title="Student Portal" subtitle={`${me.name} · ${me.adm} · Form ${me.class}`} />

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
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setMsgModal(true)}><Mail size={16} /> Message School</button>
              <button className="btn" style={{ height: 44, justifyContent: 'flex-start', gap: 8 }} onClick={() => setTab('finance')}><CreditCard size={16} /> Make Payment</button>
            </div>
          </div>

          {/* Recent Notices */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Recent Notices</h3>
            {NOTICES.filter(n => n.audience.includes('all') || n.audience.includes('students')).slice(0, 3).map(n => (
              <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.date} — {n.postedBy}</div>
              </div>
            ))}
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('notices')}>View All Notices →</button>
          </div>
        </>
      )}

      {/* ===== MY CLASS ===== */}
      {tab === 'class' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="section-title">Class Information</h3>
            <div className="grid grid-4" style={{ gap: 12 }}>
              <div><span className="muted" style={{ fontSize: 12 }}>Form</span><div style={{ fontWeight: 600, fontSize: 18 }}>Form {me.class}</div></div>
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
              <h3 className="section-title">Study Materials</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              <h3 className="section-title">Revision Papers & Downloads</h3>
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
            <button className="btn btn-primary" onClick={handlePay}>Confirm Payment</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, fontSize: 13 }}>
              <strong>Outstanding Balance:</strong> {fmtKES(feeAccount.outstanding)}
            </div>
            <div>
              <label className="field-label">Amount (KES) *</label>
              <input type="number" className="input" placeholder="Enter amount" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
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
                4. Amount: Enter the amount above<br />
                5. Confirm and enter your M-Pesa PIN
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
