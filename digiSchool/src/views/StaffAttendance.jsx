import { useState, useMemo } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import { STAFF } from '../data/modules';

const STATUS_COLOR = { Present: 'green', Absent: 'red', 'On Leave': 'amber' };

export default function StaffAttendance({ store }) {
  const { notify } = store;
  const [staff, setStaff] = useState(STAFF);
  const [filter, setFilter] = useState('All');

  const totals = useMemo(() => ({
    total: staff.length,
    present: staff.filter((s) => s.status === 'Present').length,
    absent: staff.filter((s) => s.status === 'Absent').length,
    leave: staff.filter((s) => s.status === 'On Leave').length,
  }), [staff]);

  const toggleStatus = (id) => {
    setStaff((ss) => ss.map((s) => {
      if (s.id !== id) return s;
      const cycle = ['Present', 'Absent', 'On Leave'];
      const next = cycle[(cycle.indexOf(s.status) + 1) % cycle.length];
      return { ...s, status: next };
    }));
    notify('Staff status updated.', 'info', 'Attendance');
  };

  const shown = filter === 'All' ? staff : staff.filter((s) => s.status === filter);

  return (
    <div>
      <PageHeader title="Staff Attendance" subtitle={`Today — ${new Date().toDateString()}`} />

      <div className="stat-tiles">
        <KpiCard icon="👥" label="Total Staff" value={totals.total} />
        <KpiCard icon="✅" label="Present" value={totals.present} accent="#10B981" />
        <KpiCard icon="❌" label="Absent" value={totals.absent} accent="#EF4444" />
        <KpiCard icon="📋" label="On Leave" value={totals.leave} accent="#F59E0B" />
      </div>

      <div className="card card-pad">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          {['All', 'Present', 'Absent', 'On Leave'].map((f) => (
            <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Department</th><th>Check-In</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.role}</td>
                  <td className="muted">{s.dept}</td>
                  <td>{s.checkIn}</td>
                  <td><Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge></td>
                  <td><button className="btn btn-sm" onClick={() => toggleStatus(s.id)}>Change</button></td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No staff matching this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
