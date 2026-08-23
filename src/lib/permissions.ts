import type { User } from "@/store/authStore";

export function isPrivilegedRole(role: string | undefined): boolean {
  return role === "root" || role === "admin";
}

export function isRootUser(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "root";
}

export function isPrivilegedUser(user: Pick<User, "role"> | null | undefined): boolean {
  return isPrivilegedRole(user?.role);
}

/** True when the user has at least one of the listed permissions (root/admin bypass). */
export function hasAnyPermission(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  ...permissions: string[]
): boolean {
  if (!user) return false;
  if (isPrivilegedUser(user)) return true;
  const userPerms = user.permissions || [];
  return permissions.some((p) => userPerms.includes(p));
}

export function canViewAuditLogs(user: Pick<User, "role" | "permissions"> | null | undefined): boolean {
  return hasAnyPermission(user, "VIEW_AUDIT_LOGS", "MANAGE_ORGANIZATION");
}

export function canViewAnalytics(user: Pick<User, "role" | "permissions"> | null | undefined): boolean {
  return hasAnyPermission(user, "VIEW_ANALYTICS", "MANAGE_ORGANIZATION");
}
