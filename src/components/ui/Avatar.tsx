"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
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

const statusColors = { online: "bg-success-500", offline: "bg-text-muted", away: "bg-warning-500", busy: "bg-danger-500" };

const avatarColors = [
  "bg-primary-100 text-primary-700",
  "bg-success-50 text-success-600",
  "bg-warning-50 text-warning-600",
  "bg-danger-50 text-danger-600",
  "bg-primary-50 text-primary-600",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Avatar({ src, alt, name = "", size = "md", status, className = "" }: AvatarProps) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img src={src} alt={alt || name} className={cn("rounded-full object-cover", sizeStyles[size])} />
      ) : (
        <div className={cn("rounded-full inline-flex items-center justify-center font-semibold", sizeStyles[size], getColor(name))} aria-label={name}>
          {getInitials(name || "?")}
        </div>
      )}
      {status && (
        <span className={cn("absolute bottom-0 right-0 rounded-full ring-surface", statusSizes[size], statusColors[status])} />
      )}
    </div>
  );
}

export function AvatarGroup({ children, max = 5, size = "md" }: { children: ReactNode; max?: number; size?: AvatarSize }) {
  const items = Array.isArray(children) ? children : [children];
  const shown = items.slice(0, max);
  const overflow = items.length - max;

  return (
    <div className="flex -space-x-2">
      {shown.map((child, i) => <div key={i} className="ring-2 ring-surface rounded-full">{child}</div>)}
      {overflow > 0 && (
        <div className={cn("rounded-full bg-surface-alt border-2 border-surface inline-flex items-center justify-center font-medium text-text-secondary", sizeStyles[size])}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
