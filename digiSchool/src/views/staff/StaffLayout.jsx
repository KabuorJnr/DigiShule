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
    Promise.all([
      fetchTable('staff'),
      fetchTable('staffAttendanceLogs'),
      supabase.from('profiles').select('id, teacher_id')
    ])
      .then(([staffRows, logsRows, profRes]) => {
        const profs = profRes?.data || [];
        const profMap = {};
        profs.forEach(p => {
          if (p.teacher_id) profMap[p.teacher_id] = p.id;
        });

        const todayStr = new Date().toISOString().slice(0, 10);
        const logsToday = (logsRows || []).filter(l => l.date === todayStr);

        const formatted = staffRows.map((s) => {
          const uId = profMap[s.id] || s.id;
          const myLogs = logsToday.filter(l => l.staff_id === uId || l.staff_id === s.id).sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));
          
          let checkInStr = s.check_in || '';
          if (myLogs.length > 0 && myLogs[0].check_in_time) {
            checkInStr = new Date(myLogs[0].check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (checkInStr === '07:00 AM') {
            checkInStr = ''; // clear dummy data if no log exists
          }
          
          let derivedStatus = s.status;
          if (s.status !== 'Inactive' && s.status !== 'On Leave') {
            derivedStatus = myLogs.length > 0 ? 'Present' : 'Absent';
          }

          return { ...s, checkIn: checkInStr, status: derivedStatus };
        }).sort((a, b) => a.name.localeCompare(b.name));

        setStaff(formatted);
      })
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
      <Outlet context={{
        store, user, canApprove,
        staff, setStaff,
        leaveRequests, setLeaveRequests,
        jobApps, setJobApps
      }} />
    </div>
  );
}
