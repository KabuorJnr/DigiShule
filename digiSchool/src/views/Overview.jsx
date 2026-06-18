import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { KpiCard, Sparkline, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { Icon } from '../components/icons';
import { GraduationCap, Users, CheckCircle2, DollarSign, TrendingDown, Clock, UserCheck, Building, FileText, Megaphone, CalendarDays, CreditCard, AlertCircle } from 'lucide-react';
import { buildAttendanceTrend, SEED_ALERTS, MONTHLY_REVENUE_TREND, CLASS_DISTRIBUTION, UPCOMING_EVENTS } from '../data/seed';

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
  { icon: Megaphone, label: 'Post Notice', desc: 'Broadcast to staff/parents', view: 'overview' },
  { icon: CalendarDays, label: 'Schedule a Meeting', desc: 'Staff or parent meeting', view: 'overview' },
  { icon: CreditCard, label: 'Fee Structure', desc: 'Update school fees', view: 'finance' },
];

export default function Overview({ store }) {
  const { navigate, notify } = store;
  const fullTrend = useMemo(() => buildAttendanceTrend(), []);
  const [alertModal, setAlertModal] = useState(null);

  const sparkData = fullTrend.slice(-12).map((d) => d.present);

  return (
    <div>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Overview</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Welcome back, {store.settings.principal}. Here's what's happening today.
      </p>

      {/* KPI Row 1 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard iconComponent={<GraduationCap size={20} />} label="Total Students" value="847" sub="+23 from last term">
          <Sparkline data={sparkData} color="#10B981" />
        </KpiCard>
        <KpiCard iconComponent={<Users size={20} />} label="Teaching Staff" value="42" sub="38 active, 4 on leave" />
        <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Today's Attendance" value="91.3%" accent="#10B981" sub="Above target (90%)" />
        <KpiCard iconComponent={<DollarSign size={20} />} label="Monthly Revenue" value="KES 1.4M" accent="#0EA5E9" sub="Up 12% from last month" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<TrendingDown size={20} />} label="Outstanding Fees" value="KES 450K" sub={<Badge color="amber">Follow-up needed</Badge>} />
        <KpiCard iconComponent={<Clock size={20} />} label="Pending Applications" value="12" sub="Admissions portal" />
        <KpiCard iconComponent={<UserCheck size={20} />} label="Gender Ratio" value="52% M / 48% F" sub="Balanced" />
        <KpiCard iconComponent={<Building size={20} />} label="Boarding / Day" value="620 / 227" sub="73% Boarding" />
      </div>

      {/* Charts */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Monthly Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={MONTHLY_REVENUE_TREND} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => `KES ${v.toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0078D4" strokeWidth={2} dot={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Class Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={CLASS_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {CLASS_DISTRIBUTION.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#0078D4', '#0EA5E9', '#107C10', '#FFB900'][index % 4]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts + Quick actions */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <h3 className="section-title">Recent Activity & Alerts</h3>
          {SEED_ALERTS.slice(0, 4).map((a) => {
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
          })}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Upcoming Events</h3>
          {UPCOMING_EVENTS.map((e) => (
            <div key={e.id} className="alert-row">
              <div className="alert-icon" style={{ background: '#e8f0fe', color: '#0078D4' }}><CalendarDays size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>{e.date} • {e.desc}</div>
              </div>
            </div>
          ))}
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
                    navigate(qa.view);
                    notify(`Opening ${qa.label}`, 'info', 'Navigation');
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
    </div>
  );
}
