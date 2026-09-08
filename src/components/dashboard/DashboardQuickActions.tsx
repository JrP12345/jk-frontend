"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from "@/components/ui";
import {
  Building2,
  Users,
  MapPin,
  ShieldCheck,
  ListOrdered,
  CalendarPlus,
  FileText,
  Receipt,
  ChevronRight,
} from "lucide-react";

interface DashboardQuickActionsProps {
  user: any;
  invoices: any[];
  canViewOpsDashboard: boolean;
}

export function DashboardQuickActions({
  user,
  invoices,
  canViewOpsDashboard,
}: DashboardQuickActionsProps) {
  const router = useRouter();

  return (
    <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-sm sm:text-base font-bold text-text">
          {user?.role === "patient" ? "Unpaid Invoices" : "Quick Operations"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {user?.role === "patient" ? (
          invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted">
              <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center mb-2 border border-border/70 text-emerald-500">
                <Receipt className="w-5 h-5" />
              </div>
              <p className="font-semibold text-text text-xs">All Invoices Settled</p>
              <p className="text-[11px] text-text-muted mt-0.5">Zero outstanding medical balance.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 border border-border/80 bg-surface-alt rounded-xl hover:border-primary-500/30 transition-all gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-text truncate">
                      Invoice #{inv.invoiceNumber || inv.id?.substring(0, 8)}
                    </p>
                    <p className="text-sm font-bold text-text tabular-nums">
                      ₹{inv.totalAmount?.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push("/dashboard/bills")}
                    className="rounded-lg font-semibold text-xs shrink-0"
                  >
                    Pay Online
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {canViewOpsDashboard && (
              <>
                {user?.role === "root" && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/organizations")}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                          Platform Organizations
                        </span>
                        <span className="text-[10px] text-text-muted block truncate">
                          Manage SaaS tenants & accounts
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/staff")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Staff & Clinicians
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        Manage doctors, nurses, and staff
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/clinics")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Clinic Branches
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        Multi-facility branch locations
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/audit")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        System Audit Logs
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        HIPAA compliance & activity trail
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>
              </>
            )}

            {user?.role === "receptionist" && (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/queue")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Outpatient Queue Desk
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        Live tokens & patient check-ins
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/appointments")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <CalendarPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Schedule Appointment
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        Register new visit booking
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>
              </>
            )}

            {user?.role === "doctor" && (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/queue")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Consultation Queue
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        Next patients in waiting line
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/patients")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-alt hover:bg-surface-hover hover:border-primary-500/40 transition-all group/btn text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary group-hover/btn:text-primary-600 group-hover/btn:border-primary-500/30 transition-colors shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors block truncate">
                        Patient Medical Records
                      </span>
                      <span className="text-[10px] text-text-muted block truncate">
                        EMR histories & clinical summaries
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                </button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
