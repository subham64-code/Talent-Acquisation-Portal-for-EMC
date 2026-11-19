import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CONTROLLER_ROLES } from "../lib/sectionPermissions";

export default function RequirePermission({ permission, controllerOnly, children }: { permission?: string | string[]; controllerOnly?: boolean; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isController = roles.some((r) => CONTROLLER_ROLES.includes(r));
  const required = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const allowed = controllerOnly
    ? isController
    : isController ||
      required.length === 0 ||
      required.some((item) => userPermissions.includes(item));

  if (allowed) return <>{children}</>;

  return (
    <div className="min-h-screen surface-app flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FF9412]/10 flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF9412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h1 className="text-xl font-extrabold ink-body">You don&apos;t have access</h1>
        <p className="text-sm ink-soft mt-2">
          Your account is not authorized to open <span className="font-mono text-xs">{location.pathname}</span>.
          Contact the HR Super Admin or IT Admin to request access to this section.
        </p>
        <Link to="/hr/dashboard" className="btn-primary mt-6 inline-flex">Back to Dashboard</Link>
      </div>
    </div>
  );
}
