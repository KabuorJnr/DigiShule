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
import CreateExam from '../CreateExam';
import AcademicsDashboard from '../AcademicsDashboard';
import AdminDashboard from '../AdminDashboard';
import Notices from '../Notices';
import SchoolCalendar from '../SchoolCalendar';
import DeveloperPortal from '../DeveloperPortal';
import SelectProfile from '../SelectProfile';

const VIEW_MAP = {
  developer_portal: DeveloperPortal,
  overview: Overview,
  timetable: Timetable,
  exams: ExamSchedules,
  create_exam: CreateExam,
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
};

export default function LegacyViewLoader() {
  const { store, user, params: outletParams } = useOutletContext();
  const { viewId } = useParams();

  const ViewComponent = VIEW_MAP[viewId];

  if (!ViewComponent) {
    return <Navigate to="/portal/overview" replace />;
  }

  return <ViewComponent store={store} user={user} params={outletParams || {}} />;
}
