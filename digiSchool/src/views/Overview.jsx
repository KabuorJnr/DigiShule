import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { KpiCard, Sparkline, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { GraduationCap, Users, CheckCircle2, DollarSign, TrendingDown, Clock, UserCheck, Building, FileText, Megaphone, CalendarDays, CreditCard, AlertCircle } from 'lucide-react';


const ALERT_ICON_MAP = {
  '👨‍🏫': Users,
  '📝': FileText,
  '📚': GraduationCap,
  '⚠️': AlertCircle,
  '🔧': Building,
  '💰': DollarSign,
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

  useEffect(() => {
    import('../lib/api').then(({ fetchTable }) => {
      Promise.all([
        fetchTable('staff').catch(() => []),
        fetchTable('financePayments').catch(() => []),
        fetchTable('invoices').catch(() => []),
        fetchTable('admissions').catch(() => [])
      ]).then(([staffData, pays, invs, adm]) => {
        setDbStaff(staffData || []);
        setDbPayments(pays || []);
        setDbInvoices(invs || []);
        setDbAdmissions(adm || []);
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
  const classDistData = useMemo(() => {
    if (!store.students) return [];
    const dist = {};
    store.students.forEach(s => {
      dist[s.class] = (dist[s.class] || 0) + 1;
    });
    return Object.keys(dist).map(k => ({ name: `Grade ${k}`, value: dist[k] }));
  }, [store.students]);

  const totalStudents = store.students?.length || 0;
  
  // Real Staff Metrics
  const totalTeachers = dbStaff.length > 0 ? dbStaff.length : (store.teachers?.length || 0);
  const activeTeachers = dbStaff.length > 0 ? dbStaff.filter(t => t.status !== 'On Leave').length : (store.teachers?.filter(t => t.status === 'active' || t.status === 'Active' || t.status === 'Present').length || 0);
  const onLeave = totalTeachers - activeTeachers;

  // Real Attendance (Placeholder until Attendance Module is fully linked)
  const attRate = totalStudents > 0 ? '0.0' : '0.0';

  // Real Revenue Metrics
  const totalRevenue = dbPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const revStr = totalRevenue > 1000000 ? `${(totalRevenue / 1000000).toFixed(1)}M` : (totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue.toString());

  // Real Outstanding Fees
  const totalInvoiced = dbInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const outstandingFees = Math.max(0, totalInvoiced - totalRevenue);
  const outStr = outstandingFees > 1000000 ? `${(outstandingFees / 1000000).toFixed(1)}M` : (outstandingFees > 1000 ? `${(outstandingFees / 1000).toFixed(0)}K` : outstandingFees.toString());

  // Real Admissions
  const pendingApps = dbAdmissions.filter(a => a.status === 'Pending').length;

  const maleCount = store.students?.filter(s => s.gender === 'M' || s.gender === 'Male').length || 0;
  const femaleCount = store.students?.filter(s => s.gender === 'F' || s.gender === 'Female').length || 0;
  const malePct = totalStudents ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePct = totalStudents ? Math.round((femaleCount / totalStudents) * 100) : 0;

  const boardingCount = store.students?.filter(s => s.type === 'Boarding').length || 0;
  const dayCount = store.students?.filter(s => s.type === 'Day').length || 0;

  const displayTrend = [];
  const displayClassDist = totalStudents > 0 ? classDistData : [];
  const displayAlerts = [];
  const displayEvents = [];

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Overview</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Welcome back, {store.settings.principal}. Here's what's happening today.
      </p>

      {/* KPI Row 1 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard iconComponent={<GraduationCap size={20} />} label="Total Students" value={totalStudents.toString()} sub="Enrolled">
          <Sparkline data={sparkData} color="#10B981" />
        </KpiCard>
        <KpiCard iconComponent={<Users size={20} />} label="Teaching Staff" value={totalTeachers.toString()} sub={`${activeTeachers} active, ${onLeave} on leave`} />
        <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Today's Attendance" value={`${attRate}%`} accent="#10B981" sub="Pending Logs" />
        <KpiCard iconComponent={<DollarSign size={20} />} label="Total Revenue" value={`KES ${revStr}`} accent="#0EA5E9" sub="Recorded Payments" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<TrendingDown size={20} />} label="Outstanding Fees" value={`KES ${outStr}`} sub={outstandingFees > 0 ? <Badge color="amber">Unpaid Invoices</Badge> : 'All clear'} />
        <KpiCard iconComponent={<Clock size={20} />} label="Pending Applications" value={pendingApps.toString()} sub="Admissions portal" />
        <KpiCard iconComponent={<UserCheck size={20} />} label="Gender Ratio" value={`${malePct}% M / ${femalePct}% F`} sub={totalStudents > 0 ? "Actual Ratio" : "N/A"} />
        <KpiCard iconComponent={<Building size={20} />} label="Boarding / Day" value={`${boardingCount} / ${dayCount}`} sub={totalStudents > 0 ? "Enrolled Type" : "N/A"} />
      </div>

      {/* Charts */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Monthly Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            {displayTrend.length > 0 ? (
              <LineChart data={displayTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => `KES ${v.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0078D4" strokeWidth={2} dot={true} />
              </LineChart>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No revenue data available
              </div>
            )}
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Class Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            {displayClassDist.length > 0 ? (
              <PieChart>
                <Pie data={displayClassDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {displayClassDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0078D4', '#0EA5E9', '#107C10', '#FFB900'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No students enrolled
              </div>
            )}
          </ResponsiveContainer>
        </div>
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
                <div className="muted" style={{ fontSize: 11 }}>{e.date} • {e.desc}</div>
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
              Estimated reach: ~450 recipients. Broadcasts are dispatched within 2-5 minutes of queuing.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
