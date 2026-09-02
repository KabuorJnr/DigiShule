import {
  Home, Wallet, Award, CalendarDays, Stethoscope, MessageSquare, PlayCircle,
  BookOpen, BarChart3, Users, User,
} from 'lucide-react';
import { ParentFees, ParentResults, ParentAttendance, ParentClinic, ParentMessages } from './ParentScreens';
import { StudentTimetable, StudentResults, StudentLearn, StudentFinance, StudentClasses } from './StudentScreens';
import { TeacherClasses, TeacherGradebook, TeacherMessages, TeacherMarks, TeacherAttendance } from './TeacherScreens';
import { AdminAcademics, AdminFinance, AdminStaff, AdminNotices } from './AdminScreens';
import { AdminStudents, AdminTeachers, AdminExams, AdminTimetable, AdminApprovals, AdminAttendance, AdminExpenses } from './AdminMore';
import { ReportCard } from './ReportCard';
import { NurseClinic } from './NurseScreens';

// name -> { title, Component }. 'home' and 'account' are handled by the shell.
export const SCREENS = {
  parent_fees: { title: 'Fees', Component: ParentFees },
  parent_results: { title: 'Results', Component: ParentResults },
  parent_attendance: { title: 'Attendance', Component: ParentAttendance },
  parent_clinic: { title: 'Clinic & Health', Component: ParentClinic },
  parent_messages: { title: 'Messages', Component: ParentMessages },
  report_card: { title: 'Report card', Component: ReportCard },

  student_timetable: { title: 'Timetable', Component: StudentTimetable },
  student_results: { title: 'Results', Component: StudentResults },
  student_learn: { title: 'Learn', Component: StudentLearn },
  student_finance: { title: 'Fees', Component: StudentFinance },
  student_classes: { title: 'My class', Component: StudentClasses },

  teacher_classes: { title: 'My classes', Component: TeacherClasses },
  teacher_gradebook: { title: 'Gradebook', Component: TeacherGradebook },
  teacher_messages: { title: 'Messages', Component: TeacherMessages },
  teacher_marks: { title: 'Enter marks', Component: TeacherMarks },
  teacher_attendance: { title: 'Attendance', Component: TeacherAttendance },

  admin_academics: { title: 'Academics', Component: AdminAcademics },
  admin_finance: { title: 'Finance', Component: AdminFinance },
  admin_staff: { title: 'Staff', Component: AdminStaff },
  admin_notices: { title: 'Notices', Component: AdminNotices },
  admin_students: { title: 'Students', Component: AdminStudents },
  admin_teachers: { title: 'Teachers', Component: AdminTeachers },
  admin_exams: { title: 'Exams', Component: AdminExams },
  admin_timetable: { title: 'Timetable', Component: AdminTimetable },
  admin_approvals: { title: 'Approvals', Component: AdminApprovals },
  admin_attendance: { title: 'Attendance', Component: AdminAttendance },
  admin_expenses: { title: 'Expense approvals', Component: AdminExpenses },
  nurse_clinic: { title: 'Clinic', Component: NurseClinic },
};

// Bottom-nav tabs per role. `key` doubles as the root screen name.
export const TABS = {
  parent: [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'parent_fees', label: 'Fees', icon: Wallet },
    { key: 'parent_results', label: 'Results', icon: Award },
    { key: 'parent_messages', label: 'Messages', icon: MessageSquare },
    { key: 'account', label: 'Account', icon: User },
  ],
  student: [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'student_timetable', label: 'Timetable', icon: CalendarDays },
    { key: 'student_results', label: 'Results', icon: Award },
    { key: 'student_learn', label: 'Learn', icon: PlayCircle },
    { key: 'account', label: 'Account', icon: User },
  ],
  teacher: [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'teacher_classes', label: 'Classes', icon: BookOpen },
    { key: 'teacher_gradebook', label: 'Gradebook', icon: Award },
    { key: 'teacher_messages', label: 'Messages', icon: MessageSquare },
    { key: 'account', label: 'Account', icon: User },
  ],
  admin: [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'admin_academics', label: 'Academics', icon: BarChart3 },
    { key: 'admin_finance', label: 'Finance', icon: Wallet },
    { key: 'admin_staff', label: 'Staff', icon: Users },
    { key: 'account', label: 'Account', icon: User },
  ],
  nurse: [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'nurse_clinic', label: 'Clinic', icon: Stethoscope },
    { key: 'admin_students', label: 'Students', icon: Users },
    { key: 'account', label: 'Account', icon: User },
  ],
};

const NURSE_ROLES = ['nurse', 'clinic'];

export function tabsForRole(role) {
  if (role === 'parent') return TABS.parent;
  if (role === 'student') return TABS.student;
  if (role === 'teacher' || role === 'class teacher') return TABS.teacher;
  if (NURSE_ROLES.includes(role)) return TABS.nurse;
  return TABS.admin;
}

export function homeRoleFor(role) {
  if (role === 'parent') return 'parent';
  if (NURSE_ROLES.includes(role)) return 'nurse';
  if (role === 'student') return 'student';
  if (role === 'teacher' || role === 'class teacher') return 'teacher';
  return 'admin';
}
