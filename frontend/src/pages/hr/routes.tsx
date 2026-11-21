import { lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import HRLayout from "./Layout";
import RequirePermission from "../../components/RequirePermission";
import { SECTION_PERMISSIONS } from "../../lib/sectionPermissions";

// Each screen is its own chunk so a device only downloads the page it opens.
// Sidebar links prefetch the chunk on hover/focus, making navigation instant.
const Dashboard = lazy(() => import("./Dashboard"));
const HrWorkspaceDashboard = lazy(() => import("./HrWorkspaceDashboard"));
const Help = lazy(() => import("./Help"));
const Approvals = lazy(() => import("./Approvals"));
const Openings = lazy(() => import("./Openings"));
const EmployeeProfile = lazy(() => import("./EmployeeProfile"));
const Submissions = lazy(() => import("./Submissions"));
const AIScreening = lazy(() => import("./AIScreening"));
const CandidateProfile = lazy(() => import("./CandidateProfile"));
const Shortlisting = lazy(() => import("./Shortlisting"));
const FinalSelection = lazy(() => import("./FinalSelection"));
const Interviews = lazy(() => import("./Interviews"));
const Offers = lazy(() => import("./Offers"));
const Employees = lazy(() => import("./Employees"));
const Reports = lazy(() => import("./Reports"));
const Notifications = lazy(() => import("./Notifications"));
const Users = lazy(() => import("./Users"));
const Settings = lazy(() => import("./Settings"));
const Onboarding = lazy(() => import("./Onboarding"));
const AccessControl = lazy(() => import("./AccessControl"));

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
