import { Navigate, Routes, Route } from "react-router-dom";
import HRLayout from "./Layout";
import Dashboard from "./Dashboard";
import HrWorkspaceDashboard from "./HrWorkspaceDashboard";
import Help from "./Help";
import Approvals from "./Approvals";
import Openings from "./Openings";
import EmployeeProfile from "./EmployeeProfile";
import Submissions from "./Submissions";
import AIScreening from "./AIScreening";
import CandidateProfile from "./CandidateProfile";
import Shortlisting from "./Shortlisting";
import FinalSelection from "./FinalSelection";
import Interviews from "./Interviews";
import Offers from "./Offers";
import Employees from "./Employees";
import Reports from "./Reports";
import Notifications from "./Notifications";
import Users from "./Users";
import Settings from "./Settings";
import Onboarding from "./Onboarding";
import AccessControl from "./AccessControl";
import RequirePermission from "../../components/RequirePermission";
import { SECTION_PERMISSIONS } from "../../lib/sectionPermissions";

export default function HRRoutes() {
  return (
    <Routes>
      <Route element={<HRLayout />}>
        <Route index element={<Navigate to="/hr/dashboard" replace />} />
        <Route path="dashboard" element={<HrWorkspaceDashboard />} />
        <Route path="talent-dashboard" element={<Dashboard />} />
        <Route path="help" element={<Help />} />
        <Route path="team" element={<RequirePermission permission={SECTION_PERMISSIONS.users}><Users /></RequirePermission>} />
        <Route path="permissions" element={<RequirePermission permission={SECTION_PERMISSIONS.users}><AccessControl /></RequirePermission>} />
        <Route path="approvals" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><Approvals /></RequirePermission>} />
        <Route path="employee-invitations" element={<Navigate to="/hr/employees?tab=invitations" replace />} />
        <Route path="openings" element={<RequirePermission permission={SECTION_PERMISSIONS.openings}><Openings /></RequirePermission>} />
        <Route path="manage-openings" element={<RequirePermission permission={SECTION_PERMISSIONS.openings}><Openings /></RequirePermission>} />
        <Route path="submissions" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><Submissions /></RequirePermission>} />
        <Route path="submissions/:id" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><CandidateProfile /></RequirePermission>} />
        <Route path="shortlisting" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><Shortlisting /></RequirePermission>} />
        <Route path="final-selection" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><FinalSelection /></RequirePermission>} />
        <Route path="ai-screening" element={<RequirePermission permission={[SECTION_PERMISSIONS.ai, SECTION_PERMISSIONS.submissions]}><AIScreening /></RequirePermission>} />
        <Route path="interviews" element={<RequirePermission permission={SECTION_PERMISSIONS.interviews}><Interviews /></RequirePermission>} />
        <Route path="offers" element={<RequirePermission permission={SECTION_PERMISSIONS.offers}><Offers /></RequirePermission>} />
        <Route path="onboarding" element={<RequirePermission permission={SECTION_PERMISSIONS.onboarding}><Onboarding /></RequirePermission>} />
        <Route path="employees" element={<RequirePermission permission={SECTION_PERMISSIONS.employees}><Employees /></RequirePermission>} />
        <Route path="employees/:id" element={<RequirePermission permission={SECTION_PERMISSIONS.employees}><EmployeeProfile /></RequirePermission>} />
        <Route path="reports" element={<RequirePermission permission={SECTION_PERMISSIONS.reports}><Reports /></RequirePermission>} />
        <Route path="notifications" element={<RequirePermission permission={SECTION_PERMISSIONS.notifications}><Notifications /></RequirePermission>} />
        <Route path="users" element={<RequirePermission permission={SECTION_PERMISSIONS.users}><Users /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission permission={SECTION_PERMISSIONS.settings}><Settings /></RequirePermission>} />
        <Route path="access-control" element={<RequirePermission controllerOnly><AccessControl /></RequirePermission>} />

        <Route path="*" element={<Navigate to="/hr/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
