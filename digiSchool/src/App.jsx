import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './views/LandingPage';
import PublicSchoolLanding from './views/PublicSchoolLanding';
import Login from './views/Login';
import PublicApplication from './views/PublicApplication';
import SignupWizard from './views/SignupWizard';
import ParentSignupWizard from './views/ParentSignupWizard';
import StaffSignupWizard from './views/StaffSignupWizard';
import ResetPassword from './views/ResetPassword';
import PortalLayout, { PortalIndex } from './views/layouts/PortalLayout';
import LegacyViewLoader from './views/layouts/LegacyViewLoader';
import EduOneDashboard from './views/EduOneDashboard';

import RegistrarLayout from './views/registrar/RegistrarLayout';
import StudentList from './views/registrar/StudentList';
import EnrollStudent from './views/registrar/EnrollStudent';
import Transfers from './views/registrar/Transfers';

import FinanceLayout from './views/finance/FinanceLayout';
import FinanceDashboardTab from './views/finance/FinanceDashboardTab';
import BillingTab from './views/finance/BillingTab';
import PaymentsTab from './views/finance/PaymentsTab';
import StatementsTab from './views/finance/StatementsTab';
import FeeStructureTab from './views/finance/FeeStructureTab';
import ExpensesTab from './views/finance/ExpensesTab';
import ReportsTab from './views/finance/ReportsTab';
import DefaultersTab from './views/finance/DefaultersTab';
import PaymentPlansTab from './views/finance/PaymentPlansTab';
import BudgetTab from './views/finance/BudgetTab';
import ScholarshipsTab from './views/finance/ScholarshipsTab';
import AuditTab from './views/finance/AuditTab';
import ProcurementTab from './views/finance/ProcurementTab';
import PayrollTab from './views/finance/PayrollTab';
import AssetTab from './views/finance/AssetTab';
import TaxTab from './views/finance/TaxTab';
import AIFinanceTab from './views/finance/AIFinanceTab';
import FinanceUsersTab from './views/finance/FinanceUsersTab';
import JournalTab from './views/finance/JournalTab';

import ProcurementLayout from './views/procurement/ProcurementLayout';
import ProcDashboard from './views/procurement/ProcDashboard';
import TendersManager from './views/procurement/TendersManager';
import PurchaseOrders from './views/procurement/PurchaseOrders';

import StudentLayout from './views/student/StudentLayout';
import StudentDashboard from './views/student/StudentDashboard';
import AcademicsTab from './views/student/AcademicsTab';
import RecordsTab from './views/student/RecordsTab';
import ResourcesTab from './views/student/ResourcesTab';
import StudentFinanceTab from './views/student/StudentFinanceTab';
import SettingsTab from './views/student/SettingsTab';

import TeacherLayout from './views/teacher/TeacherLayout';
import TeacherDashboard from './views/teacher/TeacherDashboard';
import MyClasses from './views/teacher/MyClasses';
import TeacherAttendance from './views/teacher/TeacherAttendance';
import GradebookTab from './views/teacher/GradebookTab';

import StaffLayout from './views/staff/StaffLayout';
import LogAttendance from './views/staff/LogAttendance';
import LeaveRequests from './views/staff/LeaveRequests';
import Recruitment from './views/staff/Recruitment';
import ClassTeachers from './views/ClassTeachers';

import ParentLayout from './views/parent/ParentLayout';
import ParentDashboard from './views/parent/ParentDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/school/:school_id" element={<PublicSchoolLanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/apply" element={<PublicApplication />} />
      <Route path="/signup" element={<SignupWizard />} />
      <Route path="/parent-signup" element={<ParentSignupWizard />} />
      <Route path="/staff-signup" element={<StaffSignupWizard />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/eduone" element={<EduOneDashboard />} />


      {/* Portal Routes with Layout, Sidebar, and Auth Guard */}
      <Route path="/portal" element={<PortalLayout />}>
        {/* Redirect base portal to overview based on role */}
        <Route index element={<PortalIndex />} />
        
        {/* Refactored Layouts */}
        <Route path="registrar" element={<RegistrarLayout />}>
          <Route index element={<StudentList />} />
          <Route path="enroll" element={<EnrollStudent />} />
          <Route path="transfers" element={<Transfers />} />
        </Route>

        <Route path="finance" element={<FinanceLayout />}>
          <Route index element={<FinanceDashboardTab />} />
          <Route path="billing" element={<BillingTab />} />
          <Route path="payments" element={<PaymentsTab />} />
          <Route path="defaulters" element={<DefaultersTab />} />
          <Route path="statements" element={<StatementsTab />} />
          <Route path="fee_structure" element={<FeeStructureTab />} />
          <Route path="expenses" element={<ExpensesTab />} />
          <Route path="payment_plans" element={<PaymentPlansTab />} />
          <Route path="budget" element={<BudgetTab />} />
          <Route path="scholarships" element={<ScholarshipsTab />} />
          <Route path="reports" element={<ReportsTab />} />
          <Route path="audit" element={<AuditTab />} />
          <Route path="procurement" element={<ProcurementTab />} />
          <Route path="payroll" element={<PayrollTab />} />
          <Route path="assets" element={<AssetTab />} />
          <Route path="tax" element={<TaxTab />} />
          <Route path="ai" element={<AIFinanceTab />} />
          <Route path="permissions" element={<FinanceUsersTab />} />
          <Route path="journal" element={<JournalTab />} />
        </Route>

        <Route path="procurement" element={<ProcurementLayout />}>
          <Route path="procurement_dashboard" element={<ProcDashboard />} />
          <Route path="tenders_manager" element={<TendersManager />} />
          <Route path="purchase_orders" element={<PurchaseOrders />} />
        </Route>

        <Route path="student" element={<StudentLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="academics" element={<AcademicsTab />} />
          <Route path="records" element={<RecordsTab />} />
          <Route path="resources" element={<ResourcesTab />} />
          <Route path="finance" element={<StudentFinanceTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>

        <Route path="teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="classes" element={<MyClasses />} />
          <Route path="attendance" element={<TeacherAttendance />} />
          <Route path="gradebook" element={<GradebookTab />} />
        </Route>

        <Route path="staff" element={<StaffLayout />}>
          <Route index element={<LogAttendance />} />
          <Route path="leave" element={<LeaveRequests />} />
          <Route path="classes" element={<ClassTeachers />} />
          <Route path="recruitment" element={<Recruitment />} />
        </Route>

        <Route path="parent" element={<ParentLayout />}>
          <Route index element={<ParentDashboard />} />
        </Route>

        {/* Fallback for all legacy components */}
        <Route path=":viewId" element={<LegacyViewLoader />} />
      </Route>
    </Routes>
  );
}
