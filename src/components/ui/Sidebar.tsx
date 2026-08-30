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
        "flex flex-col bg-surface/95 dark:bg-surface/85 backdrop-blur-2xl border-r border-border/70 h-full transform-gpu transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none shadow-sm relative overflow-hidden",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Top Ambient Glow Highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary-500/30 to-transparent pointer-events-none" />

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

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 custom-scrollbar">
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => {
            const showSection = item.section && (i === 0 || items[i - 1]?.section !== item.section);
            return (
              <div key={i} className="flex flex-col">
                {showSection && !collapsed && (
                  <li className="pt-3.5 pb-1 px-3 text-[10px] font-extrabold tracking-widest text-text-muted/70 uppercase flex items-center gap-2">
                    <span>{item.section}</span>
                    <span className="flex-1 h-px bg-border/40" />
                  </li>
                )}
                {showSection && collapsed && i > 0 && (
                  <div className="my-1.5 mx-2 border-t border-border/40" />
                )}
                <SidebarItem item={item} collapsed={collapsed} />
              </div>
            );
          })}
        </ul>
      </nav>

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
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium cursor-pointer transform-gpu transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 active:scale-[0.98] overflow-hidden",
        collapsed ? "justify-center h-10 w-10 mx-auto p-0" : "px-3 py-2.5",
        item.active
          ? "bg-primary-500/10 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-semibold border border-primary-500/20 shadow-xs"
          : "text-text-secondary hover:text-text hover:bg-surface-hover/80 hover:translate-x-0.5 border border-transparent"
      )}
    >
      {/* Active Glowing Leading Indicator Bar */}
      {item.active && !collapsed && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-primary-400 to-primary-600 shadow-[0_0_8px_rgba(37,99,235,0.5)] animate-fade-in" />
      )}

      {item.icon && (
        <span
          className={cn(
            "shrink-0 transition-transform duration-200 group-hover:scale-105",
            item.active ? "text-primary-600 dark:text-primary-400" : "text-text-muted group-hover:text-text-secondary"
          )}
        >
          {item.icon}
        </span>
      )}

      {!collapsed && (
        <>
          <span className="flex-1 truncate tracking-tight">{item.label}</span>
          {item.badge !== undefined && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/20 leading-none">
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


