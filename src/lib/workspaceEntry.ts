import type { User } from "@/store/authStore";
import { isCounterSalesUser } from "@/lib/pharmacyCapabilities";

/**
 * The first screen should be useful work, not an empty dashboard.  Permission
 * checks remain on the destination routes and API; this only selects the
 * starting point after a verified sign-in or workspace change.
 */
export function workspaceEntryPath(user: Pick<User, "role" | "permissions"> | null | undefined): string {
  return isCounterSalesUser(user) ? "/dashboard/pharmacy" : "/dashboard";
}

/** A focused counter account keeps operational navigation to the sales screen. */
export function isFocusedCounterWorkspace(user: Pick<User, "role" | "permissions"> | null | undefined): boolean {
  return isCounterSalesUser(user);
}
