import type { ReactNode } from "react";
import AuthRouteLayout from "@/components/auth/AuthRouteLayout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthRouteLayout>{children}</AuthRouteLayout>;
}
