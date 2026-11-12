import { Navigate, Routes, Route } from "react-router-dom";
import ITLayout from "./ITLayout";
import ITDashboard from "./ITDashboard";
import ITUserControl from "./ITUserControl";
import ITAuditLog from "./ITAuditLog";
import ITSystemStatus from "./ITSystemStatus";

export default function ITRoutes() {
  return (
    <Routes>
      <Route element={<ITLayout />}>
        <Route index element={<Navigate to="/it/dashboard" replace />} />
        <Route path="dashboard" element={<ITDashboard />} />
        <Route path="users" element={<ITUserControl />} />
        <Route path="audit-log" element={<ITAuditLog />} />
        <Route path="system" element={<ITSystemStatus />} />
        <Route path="*" element={<Navigate to="/it/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
