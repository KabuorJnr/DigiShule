import { useMemo, useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { PlaneTakeoff, MessageSquare, FolderOpen, Bell, Calendar, ClipboardList, BarChart3 } from 'lucide-react';
import { fetchTable } from '../../lib/api';

export default function TeacherLayout() {
  const { store, user } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  const teacherName = user?.name || 'Teacher';

  const teacherProfile = useMemo(() => {
    if (!store.teachers) return {};
    return store.teachers.find(t => 
      t.id === user?.id || 
      t.id === user?.teacher_id || 
      t.emp_id === user?.teacher_id ||
      t.emp_id === user?.id ||
      (t.name || '').toLowerCase() === teacherName.toLowerCase()
    ) || {};
  }, [store.teachers, user?.id, user?.teacher_id, teacherName]);
  
  const subject = teacherProfile.subject || user?.dept || 'Mathematics';
  const assignedClass = teacherProfile.assignedClass || null;

  const [loadedStudents, setLoadedStudents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]);

  const subjectAssignments = useMemo(() => {
    if (!store.subjectAssignments) return [];
    return store.subjectAssignments.filter(a => a.teacher_id === teacherProfile.id || a.teacher_id === user?.id);
  }, [store.subjectAssignments, teacherProfile.id, user?.id]);

  const subjectClasses = useMemo(() => {
    return subjectAssignments.map(a => a.stream_name ? `${a.class_name} ${a.stream_name}` : a.class_name);
  }, [subjectAssignments]);

  useEffect(() => {
    let active = true;
    if (active) {
      if (assignedClass || subjectClasses.length > 0) {
        setLoadedStudents(store.students.filter(s => 
          s.class === assignedClass || subjectClasses.includes(s.class)
        ));
      } else {
        setLoadedStudents([]);
      }
    }
    return () => { active = false; };
  }, [assignedClass, subjectClasses, store.students]);

  useEffect(() => {
    let active = true;
    fetchTable('messages').then(res => {
      if (!active) return;
      const allMsgs = res || [];
      const myMsgs = allMsgs.filter(m => {
        if (!m.recipient_role) return false;
        const role = String(m.recipient_role).toLowerCase().trim();
        if (role === 'class teacher' && assignedClass) return true;
        if (subject && role.includes(subject.toLowerCase().trim())) return true;
        if (teacherName && role === teacherName.toLowerCase().trim()) return true;
        return false;
      });
      setMessages(myMsgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch(() => {});
    return () => { active = false; };
  }, [assignedClass, subject, teacherName]);

  useEffect(() => {
    let active = true;
    fetchTable('leave_requests').then(rows => {
      if (!active) return;
      const myLeaves = (rows || []).filter(l => l.staff_name === teacherName || l.staff_id === user?.id);
      setLeaveRequests(myLeaves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch(() => {});
    return () => { active = false; };
  }, [teacherName, user?.id]);

  useEffect(() => {
    let active = true;
    fetchTable('parentMeetingRequests').then(rows => {
      if (!active) return;
      const myMeetings = (rows || []).filter(m => m.teacher_name === teacherName && m.status === 'Scheduled');
      setMeetingRequests(myMeetings.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)));
    }).catch(() => {});
    return () => { active = false; };
  }, [teacherName]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', path: '/portal/teacher' },
    { id: 'classes', label: 'My Classes', path: '/portal/teacher/classes' },
    { id: 'attendance', label: 'Attendance', path: '/portal/teacher/attendance' },
    { id: 'gradebook', label: 'Gradebook', path: '/portal/teacher/gradebook' }
  ];

  const currentTab = location.pathname.split('/').pop() === 'teacher' ? 'dashboard' : location.pathname.split('/').pop();

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
        store, user, teacherName, subject, teacherProfile, assignedClass,
        loadedStudents, setLoadedStudents,
        messages, setMessages,
        leaveRequests, setLeaveRequests,
        meetingRequests, setMeetingRequests,
        subjectAssignments, subjectClasses
      }} />
    </div>
  );
}
