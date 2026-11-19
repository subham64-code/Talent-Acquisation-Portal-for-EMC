const SUPER_CONTROLLER_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];

export interface RolePermissionEdge {
  permission: { key: string };
}
export interface UserRoleEdge {
  role: { key: string; permissions: RolePermissionEdge[] };
}

/**
 * Resolves the effective permission keys for an HR user: their roles'
 * permissions, with per-user GRANT/REVOKE overrides applied.
 * SUPER_ADMIN and IT_ADMIN always keep full access.
 */
export function effectivePermissions(
  roles: string[],
  userRoles: UserRoleEdge[],
  overrides: Array<{ effect: string; permission: { key: string } }>,
): string[] {
  const base = new Set(userRoles.flatMap((edge) => edge.role.permissions.map((p) => p.permission.key)));
  if (roles.some((r) => SUPER_CONTROLLER_ROLES.includes(r))) return Array.from(base);
  for (const o of overrides) {
    if (o.effect === "GRANT") base.add(o.permission.key);
    else if (o.effect === "REVOKE") base.delete(o.permission.key);
  }
  return Array.from(base);
}
