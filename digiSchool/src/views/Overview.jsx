import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { KpiCard, Sparkline, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { buildAttendanceTrend, SEED_ALERTS, MONTHLY_REVENUE_TREND, CLASS_DISTRIBUTION, UPCOMING_EVENTS } from '../data/seed';

const QUICK_ACTIONS = [
  { icon: '📝', label: 'New Admission', desc: 'Enroll a new student', view: 'admissions' },
  { icon: '📢', label: 'Post Notice', desc: 'Broadcast to staff/parents', view: 'overview' },
  { icon: '🗓️', label: 'Schedule a Meeting', desc: 'Staff or parent meeting', view: 'overview' },
  { icon: '💰', label: 'Fee Structure', desc: 'Update school fees', view: 'finance' },
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
        <KpiCard icon="🎓" label="Total Students" value="847" sub="+23 from last term">
          <Sparkline data={sparkData} color="#10B981" />
        </KpiCard>
        <KpiCard icon="👨‍🏫" label="Teaching Staff" value="42" sub="38 active, 4 on leave" />
        <KpiCard icon="✅" label="Today's Attendance" value="91.3%" accent="#10B981" sub="Above target (90%)" />
        <KpiCard icon="💵" label="Monthly Revenue" value="KES 1.4M" accent="#0EA5E9" sub="Up 12% from last month" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KpiCard icon="📉" label="Outstanding Fees" value="KES 450K" sub={<Badge color="amber">Follow-up needed</Badge>} />
        <KpiCard icon="⏳" label="Pending Applications" value="12" sub="Admissions portal" />
        <KpiCard icon="🚻" label="Gender Ratio" value="52% M / 48% F" sub="Balanced" />
        <KpiCard icon="🛏️" label="Boarding / Day" value="620 / 227" sub="73% Boarding" />
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
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0EA5E9" strokeWidth={2} dot={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Class Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={CLASS_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {CLASS_DISTRIBUTION.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#0052CC', '#0EA5E9', '#10B981', '#F59E0B'][index % 4]} />
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
          {SEED_ALERTS.slice(0, 4).map((a) => (
            <div key={a.id} className="alert-row">
              <div className="alert-icon">{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.message}</div>
                <div className="muted" style={{ fontSize: 11 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Upcoming Events</h3>
          {UPCOMING_EVENTS.map((e) => (
            <div key={e.id} className="alert-row">
              <div className="alert-icon" style={{ background: '#eef4ff', color: '#0052CC' }}>🗓️</div>
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
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                className="qa-tile"
                onClick={() => {
                  navigate(qa.view);
                  notify(`Opening ${qa.label}`, 'info', 'Navigation');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="qa-icon">{qa.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div className="qa-label">{qa.label}</div>
                    <div className="qa-desc">{qa.desc}</div>
                  </div>
                </div>
              </button>
            ))}
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
            <div className="alert-icon" style={{ width: 48, height: 48, fontSize: 22 }}>{alertModal.icon}</div>
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
