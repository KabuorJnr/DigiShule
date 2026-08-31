import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { KpiCard, Sparkline, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { computeRow } from '../utils/grading';
import { GraduationCap, Users, CheckCircle2, DollarSign, TrendingDown, Clock, UserCheck, Building, FileText, Megaphone, CalendarDays, CreditCard, AlertCircle, Award } from 'lucide-react';


const ALERT_ICON_MAP = {
  'users': Users,
  'document': FileText,
  'academic': GraduationCap,
  'alert': AlertCircle,
  'facility': Building,
  'finance': DollarSign,
};

const QUICK_ACTIONS = [
  { icon: FileText, label: 'New Admission', desc: 'Enroll a new student', view: 'admissions' },
  { icon: Megaphone, label: 'Send Mass Broadcast', desc: 'SMS/Email to staff & parents', view: 'overview', action: 'broadcast' },
  { icon: CalendarDays, label: 'Schedule a Meeting', desc: 'Staff or parent meeting', view: 'school_calendar' },
  { icon: CreditCard, label: 'Fee Structure', desc: 'Update school fees', view: 'finance' },
];

export default function Overview({ store }) {
  const { navigate, notify } = store;
  const fullTrend = [];
  const [alertModal, setAlertModal] = useState(null);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ audience: 'All Parents', message: '', type: 'SMS & Email' });

  // Real data state for metrics
  const [dbStaff, setDbStaff] = useState([]);
  const [dbPayments, setDbPayments] = useState([]);
  const [dbInvoices, setDbInvoices] = useState([]);
  const [dbAdmissions, setDbAdmissions] = useState([]);
  const [dbAttendance, setDbAttendance] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);

  useEffect(() => {
    import('../lib/api').then(({ fetchTable }) => {
      Promise.all([
        fetchTable('staff').catch(() => []),
        fetchTable('financePayments').catch(() => []),
        fetchTable('invoices').catch(() => []),
        fetchTable('admissions').catch(() => []),
        fetchTable('studentAttendance').catch(() => []),
        fetchTable('schoolEvents').catch(() => [])
      ]).then(([staffData, pays, invs, adm, att, events]) => {
        setDbStaff(staffData || []);
        setDbPayments(pays || []);
        setDbInvoices(invs || []);
        setDbAdmissions(adm || []);
        setDbAttendance(att || []);
        setDbEvents(events || []);
      });
    });
  }, []);

  const handleBroadcast = () => {
    if (!broadcastForm.message.trim()) return notify('Please enter a message to broadcast', 'warning');
    notify(`Broadcast queued for ${broadcastForm.audience} via ${broadcastForm.type}.`, 'success');
    setBroadcastModalOpen(false);
    setBroadcastForm({ audience: 'All Parents', message: '', type: 'SMS & Email' });
  };

  const sparkData = fullTrend.slice(-12).map((d) => d.present);
  const activeStudents = (store.students || []).filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending');
  const totalStudents = activeStudents.length;

  // Class distribution — derived from the actual enrolled students.
  const classDistData = useMemo(() => {
    const counts = {};
    activeStudents.forEach(s => {
      const c = s.class || 'Unassigned';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeStudents]);

  // Real Staff Metrics
  const activeStaffList = dbStaff.filter(t => t.status !== 'Inactive');
  const totalTeachers = activeStaffList.length > 0 ? activeStaffList.length : (store.teachers?.length || 0);
  const activeTeachers = activeStaffList.length > 0 ? activeStaffList.filter(t => t.status !== 'On Leave').length : (store.teachers?.filter(t => t.status === 'active' || t.status === 'Active' || t.status === 'Present').length || 0);
  const onLeave = totalTeachers - activeTeachers;

  // Real Attendance — today's student attendance rate from the DB.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysAtt = dbAttendance.filter(a => (a.date || '').slice(0, 10) === todayStr);
  const presentToday = todaysAtt.filter(a => String(a.status).toLowerCase() === 'present').length;
  const attRate = todaysAtt.length > 0 ? ((presentToday / todaysAtt.length) * 100).toFixed(1) : null;

  // Real Revenue Metrics
  const totalRevenue = dbPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const revStr = totalRevenue > 1000000 ? `${(totalRevenue / 1000000).toFixed(1)}M` : (totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue.toString());

  // Monthly revenue trend — bucket real payments by calendar month.
  const displayTrend = useMemo(() => {
    if (dbPayments.length === 0) return [];
    const buckets = {};
    dbPayments.forEach(p => {
      const d = p.date || p.created_at || p.paid_at;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt)) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, revenue]) => {
        const [y, m] = key.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
        return { month: label, revenue };
      });
  }, [dbPayments]);

  // Real Outstanding Fees
  const totalInvoiced = dbInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const outstandingFees = Math.max(0, totalInvoiced - totalRevenue);
  const outStr = outstandingFees > 1000000 ? `${(outstandingFees / 1000000).toFixed(1)}M` : (outstandingFees > 1000 ? `${(outstandingFees / 1000).toFixed(0)}K` : outstandingFees.toString());

  // Real Admissions
  const pendingApps = dbAdmissions.filter(a => a.status === 'Pending').length;

  const maleCount = activeStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = activeStudents.filter(s => s.gender === 'Female').length;
  const malePct = totalStudents ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePct = totalStudents ? Math.round((femaleCount / totalStudents) * 100) : 0;

  const boardingCount = activeStudents.filter(s => {
    const t = String(s.boarding || s.residence || s.type || '').toLowerCase();
    return s.boarding === true || t.includes('board');
  }).length;
  const dayCount = totalStudents - boardingCount;

  // ── Academic Performance — a key school indicator computed from real scores ──
  const academic = useMemo(() => {
    const studentAverages = [];
    activeStudents.forEach(st => {
      const scores = st.scores || {};
      const subjPercents = [];
      Object.keys(scores).forEach(sub => {
        const row = computeRow(scores[sub]);
        if (row.average > 0) {
          const pct = row.average <= 4 ? Math.round(row.average * 25) : row.average;
          subjPercents.push(pct);
        }
      });
      if (subjPercents.length) {
        studentAverages.push(subjPercents.reduce((a, b) => a + b, 0) / subjPercents.length);
      }
    });
    const assessed = studentAverages.length;
    const mean = assessed ? studentAverages.reduce((a, b) => a + b, 0) / assessed : 0;
    const bands = [
      { key: 'Exceeding', color: '#047857', count: 0 },
      { key: 'Meeting', color: '#0EA5E9', count: 0 },
      { key: 'Approaching', color: '#F59E0B', count: 0 },
      { key: 'Below', color: '#EF4444', count: 0 },
    ];
    studentAverages.forEach(avg => {
      if (avg >= 75) bands[0].count++;
      else if (avg >= 50) bands[1].count++;
      else if (avg >= 30) bands[2].count++;
      else bands[3].count++;
    });
    return { assessed, mean, bands };
  }, [activeStudents]);

  const displayClassDist = totalStudents > 0 ? classDistData : [];
  const displayAlerts = [];
  // Upcoming events — real school calendar events dated from today onward.
  const displayEvents = useMemo(() => {
    return (dbEvents || [])
      .filter(e => e.date && e.date >= todayStr)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
      .map(e => ({ id: e.id, title: e.title, date: e.date, desc: e.desc || e.type || '' }));
  }, [dbEvents]);

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Overview</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Welcome back, {store.settings.principal}. Here's what's happening today.
      </p>

      {/* KPI Row 1 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard iconComponent={<GraduationCap size={20} />} label="Total Students" value={totalStudents.toString()} sub="Enrolled">
          <Sparkline data={sparkData} color="#047857" />
        </KpiCard>
        <KpiCard iconComponent={<Users size={20} />} label="Teaching Staff" value={totalTeachers.toString()} sub={`${activeTeachers} active, ${onLeave} on leave`} />
        <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Today's Attendance" value={attRate !== null ? `${attRate}%` : '—'} accent="#047857" sub={attRate !== null ? `${presentToday}/${todaysAtt.length} present` : 'No records today'} />
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('finance', { tab: 'payments' })} title="Click to open Payments & Collections">
          <KpiCard iconComponent={<DollarSign size={20} />} label="Total Revenue" value={`KES ${revStr}`} accent="#0EA5E9" sub="Click to view payments →" />
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('finance', { tab: 'defaulters' })} title="Click to open Defaulters List">
          <KpiCard iconComponent={<TrendingDown size={20} />} label="Outstanding Fees" value={`KES ${outStr}`} sub={outstandingFees > 0 ? <Badge color="amber">View Defaulters →</Badge> : 'All clear'} />
        </div>
        <KpiCard iconComponent={<Clock size={20} />} label="Pending Applications" value={pendingApps.toString()} sub="Admissions portal" />
        <KpiCard iconComponent={<UserCheck size={20} />} label="Gender Ratio" value={`${malePct}% M • ${femalePct}% F`} sub={totalStudents > 0 ? "Actual Ratio" : "N/A"} />
        <KpiCard iconComponent={<Building size={20} />} label="Boarding / Day" value={`${boardingCount} / ${dayCount}`} sub={totalStudents > 0 ? "Enrolled Type" : "N/A"} />
      </div>

      {/* Charts */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Monthly Revenue Trend</h3>
          </div>
          {displayTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={displayTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => `KES ${v.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0078D4" strokeWidth={2} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: '#64748b', fontSize: 14 }}>
              No revenue data available
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Class Distribution</h3>
          {displayClassDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={displayClassDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {displayClassDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0078D4', '#0EA5E9', '#107C10', '#FFB900'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: '#64748b', fontSize: 14 }}>
              No students enrolled
            </div>
          )}
        </div>
      </div>

      {/* ── Academic Performance — key school indicator ── */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="#7C3AED" /> Academic Performance
          </h3>
          <button className="btn btn-sm" onClick={() => navigate('gradebook')}>Open Gradebook →</button>
        </div>

        {academic.assessed > 0 ? (
          <div className="grid grid-2" style={{ gap: 24, alignItems: 'center' }}>
            {/* School mean */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: '#7C3AED', lineHeight: 1 }}>{academic.mean.toFixed(1)}%</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>School Mean Score</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{academic.assessed}</div>
                <div className="muted" style={{ fontSize: 12 }}>Students assessed</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  {academic.mean >= 75 ? 'Exceeding Expectations' : academic.mean >= 50 ? 'Meeting Expectations' : academic.mean >= 30 ? 'Approaching Expectations' : 'Below Expectations'}
                </div>
              </div>
            </div>

            {/* Grade band distribution */}
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Performance Distribution</div>
              {academic.bands.map(b => {
                const pct = academic.assessed ? Math.round((b.count / academic.assessed) * 100) : 0;
                return (
                  <div key={b.key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span>{b.key}</span>
                      <span className="muted">{b.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-light, #eef2f7)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: b.color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No graded assessments recorded yet. Performance appears once teachers enter scores.
          </div>
        )}
      </div>

      {/* Alerts + Quick actions */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <h3 className="section-title">Recent Activity & Alerts</h3>
          {displayAlerts.length > 0 ? displayAlerts.map((a) => {
            const AlertIcon = ALERT_ICON_MAP[a.icon] || AlertCircle;
            return (
              <div key={a.id} className="alert-row">
                <div className="alert-icon"><AlertIcon size={16} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.message}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{a.time}</div>
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              No recent activity to display.
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Upcoming Events</h3>
          {displayEvents.length > 0 ? displayEvents.map((e) => (
            <div key={e.id} className="alert-row">
              <div className="alert-icon" style={{ background: '#e8f0fe', color: '#0078D4' }}><CalendarDays size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>{e.date}  |  {e.desc}</div>
              </div>
            </div>
          )) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              No upcoming events scheduled.
            </div>
          )}
        </div>

        <div>
          <h3 className="section-title">Quick Actions</h3>
          <div className="list-flex">
            {QUICK_ACTIONS.map((qa) => {
              const QaIcon = qa.icon;
              return (
                <button
                  key={qa.label}
                  className="qa-tile"
                  onClick={() => {
                    if (qa.action === 'broadcast') {
                      setBroadcastModalOpen(true);
                    } else {
                      navigate(qa.view);
                      notify(`Opening ${qa.label}`, 'info', 'Navigation');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="qa-icon" style={{ display: 'flex', alignItems: 'center', color: '#0078D4' }}><QaIcon size={20} /></span>
                    <div style={{ textAlign: 'left' }}>
                      <div className="qa-label">{qa.label}</div>
                      <div className="qa-desc">{qa.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>



      {alertModal && (
        <Modal
          title="Alert Details"
          onClose={() => setAlertModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setAlertModal(null)}>Dismiss</button>}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div className="alert-icon" style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={22} /></div>
            <div>
              <h4 style={{ marginBottom: 6 }}>{alertModal.message}</h4>
              <p className="muted" style={{ margin: 0 }}>Logged {alertModal.time}.</p>
              <p style={{ marginTop: 10 }}>
                This alert was generated by the EduOne monitoring system. Review the relevant module
                for full context and take any required action.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {broadcastModalOpen && (
        <Modal
          title="Send Mass Broadcast"
          onClose={() => setBroadcastModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setBroadcastModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBroadcast}>Send Broadcast</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Target Audience</label>
                <select className="select" value={broadcastForm.audience} onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}>
                  <option>All Parents</option>
                  <option>All Staff</option>
                  <option>Grade 7 Parents</option>
                  <option>Grade 8 Parents</option>
                  <option>Grade 9 Parents</option>
                  <option>All Students</option>
                </select>
              </div>
              <div>
                <label className="field-label">Delivery Method</label>
                <select className="select" value={broadcastForm.type} onChange={e => setBroadcastForm(f => ({ ...f, type: e.target.value }))}>
                  <option>SMS & Email</option>
                  <option>SMS Only</option>
                  <option>Email Only</option>
                  <option>App Notification</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Message Content</label>
              <textarea 
                className="input" 
                rows={5} 
                placeholder="Type your message here... Note: SMS messages will be split if over 160 characters."
                value={broadcastForm.message}
                onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Estimated reach: ~{broadcastForm.audience === 'All Staff' ? totalTeachers : broadcastForm.audience === 'All Students' ? totalStudents : totalStudents} recipients. Broadcasts are dispatched within 2-5 minutes of queuing.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



