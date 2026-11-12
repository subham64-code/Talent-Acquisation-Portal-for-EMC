import { Navigate, Routes, Route } from "react-router-dom";
import HRLayout from "./Layout";
import Dashboard from "./Dashboard";
import Openings from "./Openings";
import Submissions from "./Submissions";
import AIScreening from "./AIScreening";
import Interviews from "./Interviews";
import Offers from "./Offers";
import Employees from "./Employees";
import Databank from "./Databank";
import Reports from "./Reports";
import Notifications from "./Notifications";
import Users from "./Users";
import Settings from "./Settings";
import Departments from "./Departments";
import DepartmentDetail from "./DepartmentDetail";
import Onboarding from "./Onboarding";
import AccessControl from "./AccessControl";
import RequirePermission from "../../components/RequirePermission";
import { SECTION_PERMISSIONS } from "../../lib/sectionPermissions";

export default function HRRoutes() {
  return (
    <Routes>
      <Route element={<HRLayout />}>
        <Route index element={<Navigate to="/hr/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="openings" element={<RequirePermission permission={SECTION_PERMISSIONS.openings}><Openings /></RequirePermission>} />
        <Route path="submissions" element={<RequirePermission permission={SECTION_PERMISSIONS.submissions}><Submissions /></RequirePermission>} />
        <Route path="ai-screening" element={<RequirePermission permission={SECTION_PERMISSIONS.ai}><AIScreening /></RequirePermission>} />
        <Route path="interviews" element={<RequirePermission permission={SECTION_PERMISSIONS.interviews}><Interviews /></RequirePermission>} />
        <Route path="offers" element={<RequirePermission permission={SECTION_PERMISSIONS.offers}><Offers /></RequirePermission>} />
        <Route path="onboarding" element={<RequirePermission permission={SECTION_PERMISSIONS.onboarding}><Onboarding /></RequirePermission>} />
        <Route path="employees" element={<RequirePermission permission={SECTION_PERMISSIONS.employees}><Employees /></RequirePermission>} />
        <Route path="databank" element={<RequirePermission permission={SECTION_PERMISSIONS.databank}><Databank /></RequirePermission>} />
        <Route path="reports" element={<RequirePermission permission={SECTION_PERMISSIONS.reports}><Reports /></RequirePermission>} />
        <Route path="notifications" element={<RequirePermission permission={SECTION_PERMISSIONS.notifications}><Notifications /></RequirePermission>} />
        <Route path="users" element={<RequirePermission permission={SECTION_PERMISSIONS.users}><Users /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission permission={SECTION_PERMISSIONS.settings}><Settings /></RequirePermission>} />
        <Route path="departments" element={<RequirePermission permission={SECTION_PERMISSIONS.departments}><Departments /></RequirePermission>} />
        <Route path="departments/:id" element={<RequirePermission permission={SECTION_PERMISSIONS.departments}><DepartmentDetail /></RequirePermission>} />
        <Route path="access-control" element={<RequirePermission controllerOnly><AccessControl /></RequirePermission>} />
      </Route>
    </Routes>
  );
}
