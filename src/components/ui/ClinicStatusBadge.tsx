"use client";

import { useEffect, useState } from "react";
import { getClinicOperationalStatus, OperationalStatusResult } from "@/lib/timing/clinicStatus";

import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import { cn } from "@/components/ui/utils";

export interface ClinicStatusBadgeProps {
  timings?: string | null;
  compact?: boolean;
  showSecondary?: boolean;
  className?: string;
  pill?: boolean;
}

export function ClinicStatusBadge({
  timings,
  compact = false,
  showSecondary = true,
  className = "",
  pill = false,
}: ClinicStatusBadgeProps) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<OperationalStatusResult>(() =>
    getClinicOperationalStatus(timings)
  );

  useEffect(() => {
    setMounted(true);
    // Recalculate with actual client browser local time
    setStatus(getClinicOperationalStatus(timings));

    // Re-check every 60 seconds so status transitions seamlessly (e.g. at 5:00 PM or after midnight)
    const interval = setInterval(() => {
      setStatus(getClinicOperationalStatus(timings));
    }, 60000);

    return () => clearInterval(interval);
  }, [timings]);

  const primaryLabel = status.defaultLabel;

  const getSecondaryLabel = (): string => {
    if (status.status === "open_24_7") {
      return "Emergency & OPD open 24 hours";
    }
    if (status.status === "on_break" && status.nextOpenTime) {
      return `Reopens today at ${status.nextOpenTime}`;
    }
    if (status.closingTime) {
      if (status.status === "closing_soon" && status.minutesUntilClose) {
        return `Closing soon (${status.closingTime})`;
      }
      return `Closes at ${status.closingTime}`;
    }
    if (status.nextOpenTime) {
      if (status.nextOpenDay === "today") {
        return `Opens today at ${status.nextOpenTime}`;
      }
      if (status.nextOpenDay === "tomorrow") {
        return `Opens tomorrow at ${status.nextOpenTime}`;
      }
      if (status.nextOpenDay) {
        return `Opens ${status.nextOpenDay} at ${status.nextOpenTime}`;
      }
    }
    return status.secondaryText;
  };

  const secondaryLabel = getSecondaryLabel();

  // Map operational status to standard UI Badge variant
  const getBadgeVariant = (): BadgeVariant => {
    if (status.status === "open_now" || status.status === "open_24_7") return "success";
    if (status.status === "closing_soon" || status.status === "on_break") return "warning";
    return "neutral";
  };

  // Pill style for Facility Header & Detail sections
  if (pill) {
    return (
      <Badge
        variant={getBadgeVariant()}
        dot
        pulse={status.isOpen}
        className={cn("px-3 py-1 text-xs gap-1.5 font-semibold shadow-2xs", className)}
      >
        <span>{primaryLabel}</span>
        {showSecondary && secondaryLabel && (
          <>
            <span className="text-text-muted/60 text-[10px]">•</span>
            <span className="text-text-muted font-normal text-[11px]">
              {secondaryLabel}
            </span>
          </>
        )}
      </Badge>
    );
  }

  // Compact inline row for Search/Card listings
  const dotColorClass =
    status.status === "open_now" || status.status === "open_24_7"
      ? "bg-success-500"
      : status.status === "closing_soon" || status.status === "on_break"
      ? "bg-warning-500"
      : "bg-text-muted";

  const textColorClass =
    status.status === "open_now" || status.status === "open_24_7"
      ? "text-success-text dark:text-success-text"
      : status.status === "closing_soon" || status.status === "on_break"
      ? "text-warning-text dark:text-warning-text"
      : "text-text-secondary";

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold shrink-0", textColorClass, className)}
      suppressHydrationWarning
      title={secondaryLabel}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {status.isOpen && (
          <span
            className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotColorClass)}
          />
        )}
        <span
          className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dotColorClass)}
        />
      </span>
      <span>{primaryLabel}</span>
      {showSecondary && secondaryLabel && (
        <>
          <span className="text-text-muted font-normal">•</span>
          <span className="text-text-muted font-normal truncate max-w-[170px] sm:max-w-[240px]">
            {secondaryLabel}
          </span>
        </>
      )}
    </span>
  );
}
