"use client";

import { type ReactNode, useState, memo } from "react";
import { cn } from "./utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: "online" | "offline" | "away" | "busy";
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const statusSizes: Record<AvatarSize, string> = {
  xs: "h-1.5 w-1.5 ring-1",
  sm: "h-2 w-2 ring-[1.5px]",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-3 w-3 ring-2",
  xl: "h-3.5 w-3.5 ring-2",
};

const statusColors = {
  online: "bg-success-500",
  offline: "bg-text-muted",
  away: "bg-warning-500",
  busy: "bg-danger-500",
};

const avatarColors = [
  "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20",
  "bg-success-500/10 text-success-600 dark:text-success-400 border border-success-500/20",
  "bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20",
  "bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-500/20",
  "bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-500/25",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Avatar = memo(function Avatar({ src, alt, name = "", size = "md", status, className = "" }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={cn("relative inline-flex shrink-0 select-none", className)}>
      {src && !imageError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt || name}
          onError={() => setImageError(true)}
          className={cn("rounded-full object-cover animate-fade-in ring-1 ring-border/50", sizeStyles[size])}
        />
      ) : (
        <div
          className={cn(
            "rounded-full inline-flex items-center justify-center font-semibold uppercase tracking-wider",
            sizeStyles[size],
            getColor(name)
          )}
          aria-label={name || "Avatar"}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-surface transition-transform duration-200 hover:scale-110",
            statusSizes[size],
            statusColors[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
});

export default Avatar;

export interface AvatarGroupProps {
  children: ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export const AvatarGroup = memo(function AvatarGroup({ children, max = 5, size = "md", className = "" }: AvatarGroupProps) {
  const items = Array.isArray(children) ? children : [children];
  const shown = items.slice(0, max);
  const overflow = items.length - max;

  return (
    <div className={cn("flex -space-x-2 items-center", className)}>
      {shown.map((child, i) => (
        <div key={i} className="ring-2 ring-surface rounded-full transition-transform duration-150 hover:z-10 hover:scale-105">
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "rounded-full bg-surface-alt border-2 border-surface inline-flex items-center justify-center font-bold text-text-secondary select-none",
            sizeStyles[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
});


