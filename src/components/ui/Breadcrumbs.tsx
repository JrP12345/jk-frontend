"use client";

import { type ReactNode, memo } from "react";
import Link from "next/link";
import { cn } from "./utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

const Breadcrumbs = memo(function Breadcrumbs({ items, separator, className = "" }: BreadcrumbsProps) {
  const sep = separator || (
    <svg className="h-3.5 w-3.5 text-text-muted shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
    </svg>
  );

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 text-xs sm:text-sm flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5 select-none">
              {i > 0 && sep}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-150 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {item.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 shrink-0 text-text-muted">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn("flex items-center gap-1 min-w-0 max-w-full", isLast ? "text-text font-semibold" : "text-text-secondary")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 shrink-0 text-text-muted">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

export default Breadcrumbs;



