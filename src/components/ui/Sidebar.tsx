"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "./utils";
import Tooltip from "./Tooltip";

interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  active?: boolean;
  children?: NavItem[];
}

interface SidebarProps {
  brand?: ReactNode;
  items: NavItem[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
}

export default function Sidebar({ brand, items, footer, collapsed = false, className = "" }: SidebarProps) {
  return (
    <aside className={cn("flex flex-col bg-surface border-r border-border h-full transition-all duration-300 ease-spring", collapsed ? "w-16" : "w-60", className)}>
      {brand && <div className={cn("flex items-center border-b border-border", collapsed ? "justify-center p-3" : "px-4 py-4")}>{brand}</div>}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item, i) => <SidebarItem key={i} item={item} collapsed={collapsed} />)}
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
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ease-spring active:scale-95",
        collapsed ? "justify-center p-2.5" : "px-3 py-2",
        item.active 
          ? "bg-primary-50 text-primary-700 dark:bg-primary-950/25 dark:text-primary-400" 
          : "text-text-secondary hover:text-text hover:bg-surface-hover",
      )}
    >
      {item.icon && <span className={cn("shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]", item.active ? "text-primary-600 dark:text-primary-400" : "text-text-muted")}>{item.icon}</span>}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 leading-none">
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

