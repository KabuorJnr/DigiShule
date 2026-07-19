import { useOutletContext, useParams, Navigate } from 'react-router-dom';
import Overview from '../Overview';
import Timetable from '../Timetable';
import ExamSchedules from '../ExamSchedules';
import Gradebook from '../Gradebook';
import Settings from '../Settings';
import Library from '../Library';
import Admissions from '../Admissions';
import Clinic from '../Clinic';
import Facilities from '../Facilities';
import TeacherResources from '../TeacherResources';
import ClassTeachers from '../ClassTeachers';
import ParentPortal from '../ParentPortal';
import AcademicsDashboard from '../AcademicsDashboard';
import AdminDashboard from '../AdminDashboard';
import Notices from '../Notices';
import SchoolCalendar from '../SchoolCalendar';
import DeveloperPortal from '../DeveloperPortal';
import SelectProfile from '../SelectProfile';
import SchemeOfWork from '../SchemeOfWork';
import LessonPlans from '../LessonPlans';
import StaffAttendance from '../StaffAttendance';
import TeacherManagement from '../TeacherManagement';
import MyProfile from '../MyProfile';
import DosDashboard from '../DosDashboard';

const VIEW_MAP = {
  developer_portal: DeveloperPortal,
  overview: Overview,
  timetable: Timetable,
  exams: ExamSchedules,
  academics_dashboard: AcademicsDashboard,
  admin_dashboard: AdminDashboard,
  gradebook: Gradebook,
  settings: Settings,
  library: Library,
  admissions: Admissions,
  clinic: Clinic,
  facilities: Facilities,
  parent: ParentPortal,
  class_teachers: ClassTeachers,
  notices: Notices,
  school_calendar: SchoolCalendar,
  teacher_resources: TeacherResources,
  select_profile: SelectProfile,
  scheme_of_work: SchemeOfWork,
  lesson_plans: LessonPlans,
  staff_attendance: StaffAttendance,
  teacher_management: TeacherManagement,
  my_profile: MyProfile,
  dos_dashboard: DosDashboard,
};

export default function LegacyViewLoader() {
  const { store, user, params: outletParams } = useOutletContext();
  const { viewId } = useParams();

  const ViewComponent = VIEW_MAP[viewId];

  if (!ViewComponent) {
    return <Navigate to="/portal/overview" replace />;
  }

  const isReadOnlyView = (viewId === 'scheme_of_work' || viewId === 'lesson_plans') && user?.role !== 'teacher';

  return <ViewComponent store={store} user={user} params={outletParams || {}} readOnly={isReadOnlyView} />;
}
