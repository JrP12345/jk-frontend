"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <div
      className={cn(
        "w-full animate-page-enter transform-gpu",
        className
      )}
    >
      {children}
    </div>
  );
}

export default PageTransition;
