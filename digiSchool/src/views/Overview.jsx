import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
} from 'recharts';
import { KpiCard, Sparkline, ProgressBar, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { buildAttendanceTrend, FEE_BY_CLASS, SEED_ALERTS } from '../data/seed';

const QUICK_ACTIONS = [
  { icon: '📅', label: 'Generate Timetable', desc: 'Build class timetables', view: 'timetable' },
  { icon: '📝', label: 'Create Exam Schedule', desc: 'Plan upcoming exams', view: 'exams' },
  { icon: '📊', label: 'Review Gradebook', desc: 'Inspect student scores', view: 'gradebook' },
  { icon: '👥', label: 'View Staff Attendance', desc: 'Track teacher presence', view: 'overview' },
  { icon: '⚠️', label: 'Disciplinary Records', desc: 'Manage open cases', view: 'overview' },
  { icon: '🏛️', label: 'Facility Management', desc: 'Rooms & resources', view: 'settings' },
];

const feeColor = (v) => (v >= 80 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444');

export default function Overview({ store }) {
  const { navigate, notify } = store;
  const fullTrend = useMemo(() => buildAttendanceTrend(), []);
  const [range, setRange] = useState('month');
  const [alertModal, setAlertModal] = useState(null);

  const trend = useMemo(() => {
    if (range === 'week') return fullTrend.slice(-7);
    if (range === 'term') return fullTrend;
    return fullTrend.slice(-30);
  }, [range, fullTrend]);

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
        <KpiCard icon="👨‍🏫" label="Total Teachers" value="42" sub="38 active, 4 on leave" />
        <KpiCard icon="✅" label="Today's Attendance" value="91.3%" accent="#10B981" sub="Above target (90%)" />
        <KpiCard icon="💰" label="Fee Collection (Month)" value="73%" accent="#F59E0B">
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={73} color="#F59E0B" />
          </div>
        </KpiCard>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <KpiCard icon="⚠️" label="Pending Disciplinary Cases" value="5" sub={<Badge color="red">Needs attention</Badge>} />
        <KpiCard icon="📝" label="Upcoming Exams" value="3" sub="Nearest: End-Term in 12 days" />
        <KpiCard icon="📚" label="Overdue Library Books" value="17" sub="Across all classes" />
        <KpiCard icon="🪑" label="Unfilled Staff Positions" value="2" sub={<Badge color="amber">Recruiting</Badge>} />
      </div>

      {/* Charts */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Student Attendance Trend</h3>
            <div className="seg">
              <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>This Week</button>
              <button className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>This Month</button>
              <button className={range === 'term' ? 'active' : ''} onClick={() => setRange('term')}>This Term</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" name="Present" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Fee Collection by Class</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={FEE_BY_CLASS} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="class" tick={{ fontSize: 12 }} width={60} />
              <Tooltip formatter={(v) => `${v}% collected`} />
              <Bar dataKey="collected" radius={[0, 6, 6, 0]} barSize={26}>
                {FEE_BY_CLASS.map((d) => (
                  <Cell key={d.class} fill={feeColor(d.collected)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts + Quick actions */}
      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 className="section-title">System Alerts</h3>
          {SEED_ALERTS.map((a) => (
            <div key={a.id} className="alert-row">
              <div className="alert-icon">{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.message}</div>
                <div className="muted" style={{ fontSize: 11 }}>{a.time}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setAlertModal(a)}>View Details</button>
            </div>
          ))}
        </div>

        <div>
          <h3 className="section-title">Quick Actions</h3>
          <div className="grid grid-3">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                className="qa-tile"
                onClick={() => {
                  navigate(qa.view);
                  notify(`Opening ${qa.label}`, 'info', 'Navigation');
                }}
              >
                <span className="qa-icon">{qa.icon}</span>
                <span className="qa-label">{qa.label}</span>
                <span className="qa-desc">{qa.desc}</span>
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
                This alert was generated by the DigiShule monitoring system. Review the relevant module
                for full context and take any required action.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
