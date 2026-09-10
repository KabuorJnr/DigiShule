import { useMemo, useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { PlaneTakeoff, MessageSquare, FolderOpen, Bell, Calendar, ClipboardList, BarChart3 } from 'lucide-react';
import { fetchTable } from '../../lib/api';
import { reportError } from '../../lib/errorReporter';
import { getTeacherAssignments, getTeacherAssignedSubjects } from '../../utils/teacherPermissions';

export default function TeacherLayout() {
  const { store, user, params } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'teacher_dashboard' ? '/portal/teacher' : `/portal/teacher/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  const teacherName = user?.name || 'Teacher';

  const teacherProfile = useMemo(() => {
    if (!store.teachers) return {};
    return (store.teachers || []).find(t => 
      t.id === user?.id || 
      t.id === user?.teacher_id || 
      (t.email && user?.email && t.email.toLowerCase() === user.email.toLowerCase()) ||
      t.emp_id === user?.teacher_id ||
      t.emp_id === user?.id ||
      (t.name && teacherName && t.name.toLowerCase() === teacherName.toLowerCase()) ||
      (t.full_name && teacherName && t.full_name.toLowerCase() === teacherName.toLowerCase())
    ) || {};
  }, [store.teachers, user?.id, user?.teacher_id, user?.email, teacherName]);
  
  const subject = teacherProfile.subject || teacherProfile.dept || user?.subject || user?.dept || 'Mathematics';
  const assignedClass = teacherProfile.assignedClass || teacherProfile.assigned_class || teacherProfile.class || user?.assigned_class || user?.assignedClass || user?.class || null;

  const [loadedStudents, setLoadedStudents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]);

  const [subjectsList, setSubjectsList] = useState([]);
  const [subjectAssignments, setSubjectAssignments] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchTable('subjectAssignments'),
      fetchTable('subjects')
    ]).then(([assignRes, subjRes]) => {
      if (!active) return;
      const allAssignments = assignRes.status === 'fulfilled' ? (assignRes.value || []) : [];
      const allSubjects = subjRes.status === 'fulfilled' ? (subjRes.value || []) : [];
      setSubjectsList(allSubjects);

      const teacherId = teacherProfile?.id || user?.teacher_id || user?.id;
      const teacherEmpId = teacherProfile?.emp_id || user?.emp_id;
      const teacherName = (teacherProfile?.name || teacherProfile?.full_name || user?.name || '').trim().toLowerCase();

      const myAssignments = allAssignments.filter(a => {
        if (a.status && a.status !== 'assigned') return false;
        if (teacherId && (a.teacher_id === teacherId || String(a.teacher_id) === String(teacherId))) return true;
        if (user?.id && (a.teacher_id === user.id || String(a.teacher_id) === String(user.id))) return true;
        if (user?.teacher_id && (a.teacher_id === user.teacher_id || String(a.teacher_id) === String(user.teacher_id))) return true;
        if (teacherEmpId && (a.teacher_id === teacherEmpId || String(a.teacher_id) === String(teacherEmpId))) return true;
        if (teacherName && a.teacher_name && a.teacher_name.toLowerCase().trim() === teacherName) return true;
        return false;
      });
      setSubjectAssignments(myAssignments);
    }).catch((e) => reportError(e, 'teacher.layout.fetch'));
    return () => { active = false; };
  }, [teacherProfile, user]);

  const teacherSubjectAssignments = useMemo(() => {
    return getTeacherAssignments({
      user,
      teacherProfile,
      subjectAssignments,
      subjects: subjectsList
    });
  }, [user, teacherProfile, subjectAssignments, subjectsList]);

  const assignedSubjects = useMemo(() => {
    const list = getTeacherAssignedSubjects({
      user,
      teacherProfile,
      subjectAssignments,
      subjects: subjectsList
    });
    if (list.length > 0) return list;
    if (subject) return [subject];
    return ['Mathematics'];
  }, [user, teacherProfile, subjectAssignments, subjectsList, subject]);

  const subjectClasses = useMemo(() => {
    const clsSet = new Set();
    subjectAssignments.forEach(a => {
      clsSet.add(a.stream_name ? `${a.class_name} ${a.stream_name}` : a.class_name);
    });
    teacherSubjectAssignments.forEach(a => {
      if (a.className) clsSet.add(a.className);
    });
    return Array.from(clsSet);
  }, [subjectAssignments, teacherSubjectAssignments]);

  useEffect(() => {
    let active = true;
    if (active) {
      const activeStudents = (store.students || []).filter(s => s.status !== 'Inactive' && s.status !== 'Graduated');
      
      const teacherClassSet = new Set();
      if (assignedClass) teacherClassSet.add(assignedClass.toLowerCase().trim());
      (subjectClasses || []).forEach(c => { if (c) teacherClassSet.add(c.toLowerCase().trim()); });
      if (teacherProfile.classes) {
        const clsList = Array.isArray(teacherProfile.classes) ? teacherProfile.classes : String(teacherProfile.classes).split(',');
        clsList.forEach(c => { if (c && c.trim()) teacherClassSet.add(c.toLowerCase().trim()); });
      }

      if (teacherClassSet.size > 0) {
        const matched = activeStudents.filter(s => {
          if (!s.class) return false;
          const sc = s.class.toLowerCase().trim();
          for (const tc of teacherClassSet) {
            if (sc === tc || sc.startsWith(tc) || tc.startsWith(sc)) return true;
          }
          return false;
        });
        setLoadedStudents(matched);
      } else {
        setLoadedStudents([]);
      }
    }
    return () => { active = false; };
  }, [assignedClass, subjectClasses, teacherProfile, store.students]);

  useEffect(() => {
    let active = true;
    fetchTable('messages').then(res => {
      if (!active) return;
      const allMsgs = res || [];
      const myMsgs = allMsgs.filter(m => {
        // Preferred: id-based routing. Only the intended teacher matches.
        if (m.recipient_id && user?.id) return String(m.recipient_id) === String(user.id);
        // Fallback for legacy messages that only carried a role string.
        // Kept intentionally narrow: only the class teacher of the message's
        // student, or a name exact-match, so we don't broadcast to all subject
        // teachers anymore.
        if (!m.recipient_role) return false;
        const role = String(m.recipient_role).toLowerCase().trim();
        if (role === 'class teacher' && assignedClass && m.student_id) {
          const stu = (store.students || []).find(s => s.id === m.student_id || s.adm === m.student_id);
          if (stu && stu.class === assignedClass) return true;
        }
        if (teacherName && role === teacherName.toLowerCase().trim()) return true;
        return false;
      });
      setMessages(myMsgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch((e) => reportError(e, 'teacher.layout.fetch'));
    return () => { active = false; };
  }, [assignedClass, subject, teacherName]);

  useEffect(() => {
    let active = true;
    fetchTable('leave_requests').then(rows => {
      if (!active) return;
      const myLeaves = (rows || []).filter(l => l.staff_name === teacherName || l.staff_id === user?.id);
      setLeaveRequests(myLeaves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch((e) => reportError(e, 'teacher.layout.fetch'));
    return () => { active = false; };
  }, [teacherName, user?.id]);

  useEffect(() => {
    let active = true;
    fetchTable('parentMeetingRequests').then(rows => {
      if (!active) return;
      const myMeetings = (rows || []).filter(m => m.teacher_name === teacherName && m.status === 'Scheduled');
      setMeetingRequests(myMeetings.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)));
    }).catch((e) => reportError(e, 'teacher.layout.fetch'));
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
      <Outlet context={{
        store, user, teacherName, subject, teacherProfile, assignedClass,
        loadedStudents, setLoadedStudents,
        messages, setMessages,
        leaveRequests, setLeaveRequests,
        meetingRequests, setMeetingRequests,
        subjectAssignments, subjectClasses,
        subjectsList, assignedSubjects, teacherSubjectAssignments
      }} />
    </div>
  );
}



