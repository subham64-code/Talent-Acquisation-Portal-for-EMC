import { lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import ITLayout from "./ITLayout";

// Keep the IT section out of the initial bundle; App-level Suspense shows the
// loading fallback while a chunk is being fetched.
const ITDashboard = lazy(() => import("./ITDashboard"));
const ITUserControl = lazy(() => import("./ITUserControl"));
const ITAuditLog = lazy(() => import("./ITAuditLog"));
const ITSystemStatus = lazy(() => import("./ITSystemStatus"));

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
