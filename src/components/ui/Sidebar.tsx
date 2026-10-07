"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { NavigationPending } from "./RouteProgress";
import { cn } from "./utils";
import Tooltip from "./Tooltip";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  active?: boolean;
  section?: string;
  children?: NavItem[];
}

export interface SidebarProps {
  brand?: ReactNode;
  items: NavItem[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
  loading?: boolean;
}

export default function Sidebar({ brand, items, footer, collapsed = false, className = "", loading = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border h-full transition-[width] duration-[var(--motion-standard)] ease-smooth select-none relative overflow-hidden",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Top Ambient Glow Highlight */}

      {brand && (
        <div
          className={cn(
            "h-16 shrink-0 flex items-center border-b border-border/60 transition-all duration-300",
            collapsed ? "justify-center px-2" : "px-4 justify-between"
          )}
        >
          {brand}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex-1 py-3 px-2.5 space-y-4 animate-pulse">
          <div className="space-y-1.5 px-2">
            {!collapsed && <div className="h-2.5 w-16 bg-border/60 rounded mb-2.5" />}
            <div className={cn("h-9 bg-surface-alt rounded-xl", collapsed && "w-10 mx-auto")} />
            <div className={cn("h-9 bg-surface-alt rounded-xl", collapsed && "w-10 mx-auto")} />
          </div>
          <div className="space-y-1.5 px-2 pt-2">
            {!collapsed && <div className="h-2.5 w-20 bg-border/60 rounded mb-2.5" />}
            <div className={cn("h-9 bg-surface-alt rounded-xl", collapsed && "w-10 mx-auto")} />
            <div className={cn("h-9 bg-surface-alt rounded-xl", collapsed && "w-10 mx-auto")} />
            <div className={cn("h-9 bg-surface-alt rounded-xl", collapsed && "w-10 mx-auto")} />
          </div>
        </div>
      ) : (
        /* Navigation Links */
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 custom-scrollbar">
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => {
            const showSection = item.section && (i === 0 || items[i - 1]?.section !== item.section);
            return (
              <Fragment key={i}>
                {showSection && !collapsed && (
                  <li className="pt-3.5 pb-1 px-3 text-xs font-medium tracking-wide text-text-muted uppercase flex items-center gap-2">
                    <span>{item.section}</span>
                    <span className="flex-1 h-px bg-border/40" />
                  </li>
                )}
                {showSection && collapsed && i > 0 && (
                  <li aria-hidden="true" className="my-1.5 mx-2 border-t border-border/40" />
                )}
                <SidebarItem item={item} collapsed={collapsed} />
              </Fragment>
            );
          })}
        </ul>
        </nav>
      )}

      {/* Footer Area */}
      {footer && (
        <div className={cn("border-t border-border/60 bg-surface-alt/30 transition-all duration-300", collapsed ? "p-2" : "p-3")}>
          {footer}
        </div>
      )}
    </aside>
  );
}

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const content = (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium cursor-pointer transition-colors duration-[var(--motion-fast)] ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring overflow-hidden",
        collapsed ? "justify-center min-h-11 min-w-11 mx-auto p-0" : "px-3 py-3 sm:py-2.5",
        item.active
          ? "bg-selected text-accent font-semibold border border-transparent"
          : "text-text-secondary hover:text-text hover:bg-surface-hover/80 border border-transparent"
      )}
    >
      {/* Active Glowing Leading Indicator Bar */}
      <NavigationPending />
      {item.active && !collapsed && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent  animate-fade-in" />
      )}

      {item.icon && (
        <span
          className={cn(
            "shrink-0",
            item.active ? "text-accent dark:text-accent" : "text-text-muted group-hover:text-text-secondary"
          )}
        >
          {item.icon}
        </span>
      )}

      {!collapsed && (
        <>
          <span className="flex-1 truncate tracking-tight">{item.label}</span>
          {item.badge !== undefined && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/15 text-accent dark:text-accent border border-primary-500/20 leading-none">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={item.label} position="right" className="w-full flex justify-center">
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </li>
  );
}
