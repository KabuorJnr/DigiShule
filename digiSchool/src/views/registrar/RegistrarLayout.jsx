import { Outlet, NavLink, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { Users, UserPlus, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';


const TABS = [
  { id: '', label: 'Student Register', icon: Users },
  { id: 'enroll', label: 'New Enrolment', icon: UserPlus },
  { id: 'transfers', label: 'Transfers & Exits', icon: FileText },
];

export default function RegistrarLayout() {

  const navigate = useNavigate();
  const location = useLocation();
  const context = useOutletContext();
  const params = context?.params;

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'registrar_dashboard' ? '/portal/registrar' : `/portal/registrar/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  const activeStudents = context?.store?.students ? context.store.students.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated' && s.status !== 'Archived' && s.status !== 'Withdrawn' && s.status !== 'Pending') : [];
  const total_active = activeStudents.length;
  const male = activeStudents.filter(s => s.gender === 'Male').length;
  const female = activeStudents.filter(s => s.gender === 'Female').length;
  const flagged = activeStudents.filter(s => s.flagged).length;

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
          { label: 'Total Students', value: total_active, color: '#0078D4' },
          { label: 'Male', value: male, color: '#0369A1' },
          { label: 'Female', value: female, color: '#7C3AED' },
          { label: 'Flagged', value: flagged, color: '#D13438' },
        ].map(k => (
          <div key={k.label} className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Content Area */}
      <Outlet context={context} />
    </div>
  );
}



