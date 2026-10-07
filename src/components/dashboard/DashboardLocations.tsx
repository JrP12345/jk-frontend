"use client";

import { useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui";
import { Building2, ArrowUpRight, ChevronRight } from "lucide-react";

interface DashboardLocationsProps {
  canManageOrg: boolean;
  locations: any[];
}

export function DashboardLocations({
  canManageOrg,
  locations,
}: DashboardLocationsProps) {
  const router = useRouter();

  if (!canManageOrg || !locations || locations.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-text">Active locations</h2>
          <p className="text-xs text-text-muted">Connected healthcare centers and branch network</p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => router.push("/dashboard/locations")}
          className="text-xs font-semibold text-accent hover:text-accent dark:text-accent p-0 hover:bg-transparent"
        >
          Manage Locations
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {locations.map((cl, idx) => (
          <Card
            key={cl.id ? `${cl.id}-${idx}` : `location-${idx}`}
            onClick={() => router.push("/dashboard/locations")}
            className="group cursor-pointer hover:shadow-md hover:border-primary-500/40 transition-all duration-200 p-4 rounded-2xl border border-border/80 bg-surface flex flex-col justify-between active:scale-[0.99] touch-manipulation relative overflow-hidden "
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-accent dark:text-accent group-hover:bg-primary-500/15 group-hover:scale-105 transition-all duration-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-text group-hover:text-accent transition-colors truncate">
                    {cl.name}
                  </h3>
                  <p className="text-xs text-text-muted truncate">{cl.city || "Main Facility"}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" />
            </div>

            <div className="flex items-center justify-between text-xs text-text-secondary pt-2.5 border-t border-border/60">
              <span className="truncate text-text-muted">{cl.address || "Main Branch Location"}</span>
              <Badge variant="success" size="sm" dot className="font-semibold shrink-0">
                Active
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
