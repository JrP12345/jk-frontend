"use client";

import { memo } from "react";
import { cn } from "./utils";
import LoadingImage from "./LoadingImage";

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
  online: "bg-success",
  offline: "bg-text-muted",
  away: "bg-warning",
  busy: "bg-danger",
};

const avatarColors = [
  "bg-primary-500/10 text-accent dark:text-accent border border-primary-500/20",
  "bg-success/10 text-success-text dark:text-success-text border border-success/20",
  "bg-warning/10 text-warning-text dark:text-warning-text border border-warning/20",
  "bg-danger/10 text-danger-text dark:text-danger-text border border-danger/20",
  "bg-primary-500/15 text-accent dark:text-accent border border-primary-500/25",
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
  const initials = (
    <span
      className={cn(
        "rounded-full inline-flex items-center justify-center font-semibold uppercase tracking-wider",
        sizeStyles[size],
        getColor(name)
      )}
      aria-label={name || "Avatar"}
    >
      {getInitials(name)}
    </span>
  );

  return (
    <div className={cn("relative inline-flex shrink-0 select-none", className)}>
      {src ? <LoadingImage src={src} alt={alt || name} fallback={initials} className={cn("rounded-full object-cover ring-1 ring-border/50", sizeStyles[size])} /> : initials}
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
