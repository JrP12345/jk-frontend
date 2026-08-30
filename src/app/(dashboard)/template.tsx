"use client";

import { ReactNode } from "react";
import { PageTransition } from "@/components/ui";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
