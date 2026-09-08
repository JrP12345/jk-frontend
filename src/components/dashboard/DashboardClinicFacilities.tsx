"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui";
import { Building2, ArrowUpRight, ChevronRight } from "lucide-react";

interface DashboardClinicFacilitiesProps {
  canManageOrg: boolean;
  clinics: any[];
}

export function DashboardClinicFacilities({
  canManageOrg,
  clinics,
}: DashboardClinicFacilitiesProps) {
  const router = useRouter();

  if (!canManageOrg || !clinics || clinics.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-text">Active Clinic Facilities</h2>
          <p className="text-xs text-text-muted">Connected healthcare centers and branch network</p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => router.push("/dashboard/clinics")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 p-0 hover:bg-transparent"
        >
          Manage Clinics
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {clinics.map((cl) => (
          <Card
            key={cl.id}
            onClick={() => router.push("/dashboard/clinics")}
            className="group cursor-pointer hover:shadow-md hover:border-primary-500/40 transition-all duration-200 p-4 rounded-2xl border border-border/80 bg-surface flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-600 dark:text-primary-400 group-hover:bg-primary-500/15 transition-colors">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                    {cl.name}
                  </h3>
                  <p className="text-xs text-text-muted truncate">{cl.city || "Main Facility"}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors shrink-0" />
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
