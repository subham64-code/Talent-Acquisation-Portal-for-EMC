/**
 * Single source of truth mapping HR portal sections to the permission that
 * unlocks them. Used by the sidebar (show/hide) and route guards (block access).
 * SUPER_ADMIN and IT_ADMIN bypass every entry.
 */
export const SECTION_PERMISSIONS: Record<string, string> = {
  dashboard: "dashboard.view",
  openings: "openings.view",
  submissions: "applications.view",
  ai: "ai.view",
  interviews: "interviews.view",
  offers: "offers.view",
  onboarding: "documents.view",
  employees: "employees.view",
  databank: "databank.view",
  reports: "reports.view",
  notifications: "notifications.view",
  users: "users.manage",
  departments: "departments.manage",
  settings: "settings.manage",
};

export const CONTROLLER_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];

export function isController(user: { roles?: string[] } | null | undefined): boolean {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.some((r) => CONTROLLER_ROLES.includes(r));
}

/** Returns true when the user can open the given section. */
export function canAccess(user: { roles?: string[]; permissions?: string[] } | null | undefined, permission: string | undefined): boolean {
  if (!user) return false;
  if (isController(user)) return true;
  if (!permission) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}
