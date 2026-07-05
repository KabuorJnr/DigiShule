import { Outlet, NavLink, useNavigate, useOutletContext } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { Users, UserPlus, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchStudentStats } from '../../lib/api';

const TABS = [
  { id: '', label: 'Student Register', icon: Users },
  { id: 'enroll', label: 'New Enrolment', icon: UserPlus },
  { id: 'transfers', label: 'Transfers & Exits', icon: FileText },
];

export default function RegistrarLayout() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const context = useOutletContext();

  useEffect(() => {
    let active = true;
    fetchStudentStats().then(s => {
      if (active) setStats(s);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div>
      <PageHeader
        title="Registrar Office"
        subtitle="Student registration, enrolment, and records management"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => navigate('enroll')}>
              <UserPlus size={15} /> New Enrolment
            </button>
          </div>
        }
      />

      {/* KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Students', value: stats ? stats.total_active : '-', color: '#0078D4' },
          { label: 'Male', value: stats ? stats.male : '-', color: '#0369A1' },
          { label: 'Female', value: stats ? stats.female : '-', color: '#7C3AED' },
          { label: 'Flagged', value: stats ? stats.flagged : '-', color: '#D13438' },
        ].map(k => (
          <div key={k.label} className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <NavLink 
            key={t.label} 
            to={t.id}
            end={t.id === ''}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <t.icon size={15} /> {t.label}
          </NavLink>
        ))}
      </div>

      {/* Tab Content Area */}
      <Outlet context={context} />
    </div>
  );
}
