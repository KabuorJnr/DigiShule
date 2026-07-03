import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './views/LandingPage';
import Login from './views/Login';
import PublicApplication from './views/PublicApplication';
import SignupWizard from './views/SignupWizard';
import ParentSignupWizard from './views/ParentSignupWizard';
import PortalLayout from './views/layouts/PortalLayout';
import LegacyViewLoader from './views/layouts/LegacyViewLoader';

import RegistrarLayout from './views/registrar/RegistrarLayout';
import StudentList from './views/registrar/StudentList';
import EnrollStudent from './views/registrar/EnrollStudent';
import Transfers from './views/registrar/Transfers';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/apply" element={<PublicApplication />} />
      <Route path="/signup" element={<SignupWizard />} />
      <Route path="/parent-signup" element={<ParentSignupWizard />} />

      {/* Portal Routes with Layout, Sidebar, and Auth Guard */}
      <Route path="/portal" element={<PortalLayout />}>
        {/* Redirect base portal to overview */}
        <Route index element={<Navigate to="/portal/overview" replace />} />
        
        {/* Refactored Layouts */}
        <Route path="registrar" element={<RegistrarLayout />}>
          <Route index element={<StudentList />} />
          <Route path="enroll" element={<EnrollStudent />} />
          <Route path="transfers" element={<Transfers />} />
        </Route>

        {/* Fallback for all legacy components */}
        <Route path=":viewId" element={<LegacyViewLoader />} />
      </Route>
    </Routes>
  );
}
