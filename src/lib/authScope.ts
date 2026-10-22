import type { User } from "@/store/authStore";

/** Identity and effective authority define the lifetime of private client data. */
export function authScopeKey(user: User | null): string {
  return user ? JSON.stringify([
    user.id, user.organization_id || null, user.role, user.impersonatedBy?.id || null,
    [...new Set(user.permissions || [])].sort(),
    Boolean(user.mfaEnrollmentRequired),
    user.workspaceProfile || "clinic",
  ]) : "anonymous";
}

/** Opaque command references survive authority changes; reads still reauthorize on the server. */
export function referenceOwnerKey(user: User | null): string {
  return user ? JSON.stringify([user.id, user.organization_id || null, user.impersonatedBy?.id || null]) : "anonymous";
}
