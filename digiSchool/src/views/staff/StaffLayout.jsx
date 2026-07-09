import { useState, useMemo, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { fetchTable, upsertRow } from '../../lib/api';
import { secondaryAuthClient, supabase } from '../../lib/supabaseClient';
import { generateSecurePassword, provisionAccount, generateSequentialUsername } from '../../utils/auth';

export default function StaffLayout() {
  const { store, user } = useOutletContext();
  const { notify } = store;
  const navigate = useNavigate();
  const location = useLocation();

  const [staff, setStaff] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [jobApps, setJobApps] = useState([]);

  const canApprove = user && (user.role === 'principal' || user.role === 'deputy_admin' || user.role === 'deputy_academic');

  useEffect(() => {
    fetchTable('staff')
      .then((rows) => setStaff(rows.map((s) => ({ ...s, checkIn: s.check_in })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => notify(`Failed to load staff: ${e.message}`, 'error'));
      
    fetchTable('job_applications')
      .then((rows) => setJobApps(rows || []))
      .catch(() => setJobApps([]));

    fetchTable('leave_requests')
      .then((rows) => {
        if (rows && rows.length > 0) setLeaveRequests(rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      })
      .catch(() => {});
  }, [notify]);

  const tabs = [
    { id: 'attendance', label: 'Staff Roster', path: '/portal/staff' },
    { id: 'leave', label: 'Leave Requests', path: '/portal/staff/leave' },
    { id: 'classes', label: 'Class Teachers', path: '/portal/staff/classes' },
    ...(canApprove ? [{ id: 'recruitment', label: 'Recruitment & HR', path: '/portal/staff/recruitment' }] : [])
  ];

  const currentTab = location.pathname.split('/').pop() === 'staff' ? 'attendance' : location.pathname.split('/').pop();

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab${currentTab === t.id ? ' active' : ''}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Outlet context={{
        store, user, canApprove,
        staff, setStaff,
        leaveRequests, setLeaveRequests,
        jobApps, setJobApps
      }} />
    </div>
  );
}
