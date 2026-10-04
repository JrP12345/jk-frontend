import type { User } from "@/store/authStore";

/** Identity and effective authority define the lifetime of private client data. */
export function authScopeKey(user: User | null): string {
  return user ? JSON.stringify([
    user.id, user.organization_id || null, user.role, user.impersonatedBy?.id || null,
    [...new Set(user.permissions || [])].sort(),
  ]) : "anonymous";
}
