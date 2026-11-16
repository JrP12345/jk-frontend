"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import AuthPageShell from "./AuthPageShell";

/** Keep the account-entry frame mounted while its sign-in/registration form changes. */
export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return segment === "login" || segment === "register" ? <AuthPageShell wide>{children}</AuthPageShell> : children;
}
