"use client";

import { type ReactNode } from "react";
import Link from "next/link";
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
}

export default function Sidebar({ brand, items, footer, collapsed = false, className = "" }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col bg-surface border-r border-border h-full transform-gpu transition-all duration-200 ease-smooth select-none",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {brand && (
        <div
          className={cn(
            "h-16 shrink-0 flex items-center border-b border-border",
            collapsed ? "justify-center px-2" : "px-4"
          )}
        >
          {brand}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item, i) => {
            const showSection = item.section && (i === 0 || items[i - 1]?.section !== item.section);
            return (
              <div key={i}>
                {showSection && !collapsed && (
                  <li className="pt-3 pb-1 px-3 text-[10px] font-bold tracking-wider text-text-muted uppercase">
                    {item.section}
                  </li>
                )}
                {showSection && collapsed && i > 0 && (
                  <div className="my-1 border-t border-border/50" />
                )}
                <SidebarItem item={item} collapsed={collapsed} />
              </div>
            );
          })}
        </ul>
      </nav>
      {footer && <div className={cn("border-t border-border", collapsed ? "p-2" : "px-3 py-3")}>{footer}</div>}
    </aside>
  );
}

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const content = (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl text-sm font-medium cursor-pointer transform-gpu transition-all duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 active:scale-98",
        collapsed ? "justify-center p-2.5" : "px-3 py-2",
        item.active
          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold"
          : "text-text-secondary hover:text-text hover:bg-surface-hover"
      )}
    >
      {item.icon && (
        <span
          className={cn(
            "shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] transition-colors",
            item.active ? "text-primary-600 dark:text-primary-400" : "text-text-muted"
          )}
        >
          {item.icon}
        </span>
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 leading-none">
              {item.badge}
            </span>
          )}
        </>
      )}
      {item.active && (
        <span className="absolute left-0 w-1 h-5 rounded-r bg-primary-600 dark:bg-primary-500 animate-fade-in" />
      )}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={item.label} position="right" className="w-full">
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </li>
  );
}


