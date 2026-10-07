"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { canViewAuditLogs } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Table, Badge, Button, Select, Input, useToast, Alert, ChartContainer, BarChart } from "@/components/ui";
import { RotateCw, Filter, X, Building2, Stethoscope, Tag, Calendar } from "lucide-react";

interface AuditLogEntry {
  id: string;
  userId: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  action: "APPOINTMENT_CREATE" | "STATUS_CHANGE" | "VIP_OVERRIDE" | "PATIENT_UPDATE" | string;
  targetId: string;
  targetModel: string;
  category?: string;
  details?: any;
  createdAt: string;
}

interface FilterState {
  organizationId: string;
  locationId: string;
  doctorId: string;
  category: string;
  action: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: FilterState = {
  organizationId: "",
  locationId: "",
  doctorId: "",
  category: "",
  action: "",
  startDate: "",
  endDate: "",
};

const CATEGORIES = [
  { value: "AUTH", label: "Authentication" },
  { value: "CLINICAL_READ", label: "Clinical Read" },
  { value: "CLINICAL_WRITE", label: "Clinical Write" },
  { value: "BILLING", label: "Billing" },
  { value: "ADMIN", label: "Administration" },
  { value: "COMPLIANCE_DPDP", label: "DPDP Compliance" },
];

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const beginRead = useLatestRead();
  const { toast } = useToast();

  // Filter state
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Dropdown data
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Load organization list for root
  useEffect(() => {
    if (!canViewAuditLogs(user)) return;
    setOrgsLoading(true);
    api
      .get("/organizations")
      .then((res) => {
        const orgList = res.data.data?.organizations || res.data.data || [];
        setOrganizations(orgList);
      })
      .catch(() => {})
      .finally(() => setOrgsLoading(false));
  }, [user]);

  // Load locations when org changes
  useEffect(() => {
    if (!canViewAuditLogs(user)) return;
    const controller = new AbortController();
    setLocations([]);
    const orgParam = filters.organizationId
      ? `?organizationId=${filters.organizationId}`
      : "";
    api
      .get(`/onboarding/locations${orgParam}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const locationList = res.data.data || [];
        setLocations(locationList);
      })
      .catch(() => { if (!controller.signal.aborted) setLocations([]); });
    return () => controller.abort();
  }, [user, filters.organizationId]);

  // Load doctors/staff when org changes
  useEffect(() => {
    if (!canViewAuditLogs(user)) return;
    const controller = new AbortController();
    setDoctors([]);
    const orgParam = filters.organizationId
      ? `?organizationId=${filters.organizationId}`
      : "";
    api
      .get(`/onboarding/staff${orgParam}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const data = res.data.data;
        const staffList = Array.isArray(data) ? data : data?.allStaff || (data?.doctors || []).map((doctor: any) => ({ ...doctor, role: "doctor" }));
        // Filter to doctors only for the dropdown
        const doctorList = staffList.filter(
          (s: any) => s.role === "doctor" || s.role === "admin"
        );
        setDoctors(doctorList);
      })
      .catch(() => { if (!controller.signal.aborted) setDoctors([]); });
    return () => controller.abort();
  }, [user, filters.organizationId]);

  const fetchLogs = useCallback(async (activeFilters: FilterState = filters) => {
    if (!canViewAuditLogs(user)) return;
    const request = beginRead();
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      if (activeFilters.organizationId) params.set("organizationId", activeFilters.organizationId);
      if (activeFilters.locationId) params.set("locationId", activeFilters.locationId);
      if (activeFilters.doctorId) params.set("doctorId", activeFilters.doctorId);
      if (activeFilters.category) params.set("category", activeFilters.category);
      if (activeFilters.action) params.set("action", activeFilters.action);
      if (activeFilters.startDate) params.set("startDate", activeFilters.startDate);
      if (activeFilters.endDate) params.set("endDate", activeFilters.endDate);
      params.set("limit", "100");

      const qs = params.toString();
      const res = await api.get(`/audit-logs${qs ? `?${qs}` : ""}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      setLogs(res.data.data || []);
    } catch (err) {
      if (!request.isCurrent()) return;
      setLoadError("Audit events could not be loaded. Please try again.");
      console.error("Failed to load audit logs", err);
      toast?.({ title: "Error", description: "Failed to load audit logs", variant: "error" });
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [filters, toast, user, beginRead]);

  useEffect(() => {
    if (canViewAuditLogs(user)) {
      fetchLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!canViewAuditLogs(user)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Alert variant="error" title="Access Denied">
          Only Platform Superadmin (Root) has permission to view the security audit trail.
        </Alert>
      </div>
    );
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    const updated = { ...filters, [key]: value };
    // Reset dependent filters
    if (key === "organizationId") {
      updated.locationId = "";
      updated.doctorId = "";
    }
    setFilters(updated);
  };

  const applyFilters = () => {
    fetchLogs(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    fetchLogs(EMPTY_FILTERS);
  };

  const getActionBadgeVariant = (action: string): "default" | "primary" | "success" | "warning" | "danger" | "outline" => {
    switch (action) {
      case "APPOINTMENT_CREATE": return "success";
      case "STATUS_CHANGE": return "primary";
      case "VIP_OVERRIDE": return "danger";
      case "PATIENT_UPDATE": return "warning";
      default: return "default";
    }
  };

  const getCategoryBadgeVariant = (category: string): "default" | "primary" | "success" | "warning" | "danger" | "outline" => {
    switch (category) {
      case "AUTH": return "warning";
      case "CLINICAL_READ": return "primary";
      case "CLINICAL_WRITE": return "success";
      case "BILLING": return "outline";
      case "ADMIN": return "danger";
      case "COMPLIANCE_DPDP": return "warning";
      default: return "default";
    }
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };

  const renderDetails = (row: AuditLogEntry) => {
    const { action, details } = row;
    if (!details) return <span className="text-text-muted">—</span>;

    try {
      if (action === "STATUS_CHANGE") {
        return (
          <span className="text-xs font-mono text-text-secondary">
            Status: <Badge variant="default" className="capitalize text-[10px] px-1">{details.oldStatus || "none"}</Badge>
            <span className="mx-1.5 text-text-muted">➔</span>
            <Badge variant="primary" className="capitalize text-[10px] px-1">{details.newStatus}</Badge>
          </span>
        );
      }

      if (action === "VIP_OVERRIDE") {
        return (
          <span className="text-xs text-text-secondary">
            Queue order adjusted for a priority visit. Doctor: <span className="font-mono text-text">{details.doctorId}</span>. Date: <span className="text-text">{details.date}</span>.
          </span>
        );
      }

      if (action === "APPOINTMENT_CREATE") {
        return (
          <span className="text-xs text-text-secondary">
            Booked Token <strong className="text-accent">#{details.tokenNumber}</strong>. Status: <span className="capitalize">{details.status}</span>. Time: <span className="font-mono text-text">{new Date(details.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>.
          </span>
        );
      }

      const fields = typeof details === "object" && !Array.isArray(details)
        ? Object.entries(details as Record<string, unknown>)
          .filter(([key, value]) => value != null && ["string", "number", "boolean"].includes(typeof value) && !/password|secret|token|stack|header|payload|response|raw|metadata/i.test(key) && !/^[\[{]/.test(String(value)))
          .slice(0, 4)
        : [];
      if (!fields.length) return <span className="text-xs text-text-muted">Activity details recorded</span>;
      return (
        <dl className="grid gap-1 text-xs text-text-secondary max-w-xs">
          {fields.map(([key, value]) => (
            <div key={key} className="flex gap-1.5 min-w-0">
              <dt className="font-medium text-text shrink-0">{key.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}:</dt>
              <dd className="truncate" title={String(value)}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      );
    } catch (e) {
      return <span className="text-xs text-text-muted">Could not parse details</span>;
    }
  };

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Audit log
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Security & Compliance
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Review changes to clinical records, account access, queue priority, and settings.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant={showFilters ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className="rounded-xl text-xs font-semibold transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="danger" size="sm" className="ml-1.5 text-[9px] px-1.5 py-0 min-w-[18px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
             loading={loading}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh Logs
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. FILTER BAR (COLLAPSIBLE)
         ────────────────────────────────────────────────────────────────────────── */}
      {showFilters && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Filter Audit Logs</CardTitle>
                <CardDescription className="text-xs">Narrow down events by organization, location, doctor, or category.</CardDescription>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-text-muted hover:text-danger-text">
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Organization */}
              <Select
                size="sm"
                label="Organization"
                icon={<Building2 className="h-3.5 w-3.5" />}
                placeholder="All Organizations"
                value={filters.organizationId}
                onChange={(e) => updateFilter("organizationId", e.target.value)}
                options={[
                  { value: "", label: "All Organizations" },
                  ...organizations.map((org) => ({
                    value: org.id || org._id,
                    label: org.name + (org.city ? ` (${org.city})` : ""),
                  })),
                ]}
              />

              {/* Location */}
              <Select
                size="sm"
                label="Location"
                icon={<Building2 className="h-3.5 w-3.5" />}
                placeholder="All Locations"
                value={filters.locationId}
                onChange={(e) => updateFilter("locationId", e.target.value)}
                options={[
                  { value: "", label: "All Locations" },
                  ...locations.map((c: any) => ({
                    value: c.id || c._id,
                    label: c.name || c.locationName || "Unnamed Location",
                  })),
                ]}
              />

              {/* Doctor */}
              <Select
                size="sm"
                label="Doctor / Staff"
                icon={<Stethoscope className="h-3.5 w-3.5" />}
                placeholder="All Staff"
                value={filters.doctorId}
                onChange={(e) => updateFilter("doctorId", e.target.value)}
                options={[
                  { value: "", label: "All Staff" },
                  ...doctors.map((d: any) => ({
                    value: d.id || d._id || d.userId,
                    label: d.name || d.email || "Unknown",
                  })),
                ]}
              />

              {/* Category */}
              <Select
                size="sm"
                label="Category"
                icon={<Tag className="h-3.5 w-3.5" />}
                placeholder="All Categories"
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                options={[
                  { value: "", label: "All Categories" },
                  ...CATEGORIES,
                ]}
              />

              {/* Date Range */}
              <div className="flex flex-col gap-1">
                <label htmlFor="audit-start-date" className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Start Date
                </label>
                <Input
                  type="date"
                  size="sm"
                  value={filters.startDate}
                  id="audit-start-date"
                  onChange={(e) => updateFilter("startDate", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="audit-end-date" className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  End Date
                </label>
                <Input
                  type="date"
                  size="sm"
                  value={filters.endDate}
                  id="audit-end-date"
                  onChange={(e) => updateFilter("endDate", e.target.value)}
                />
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
              <Button
                variant="primary"
                size="sm"
                onClick={applyFilters}
                disabled={loading}
                className="rounded-xl text-xs font-semibold px-6"
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Apply Filters
              </Button>
              {activeFilterCount > 0 && (
                <span className="text-[11px] text-text-muted">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PURPOSEFUL AUDIT EVENT DISTRIBUTION */}
      {logs.length > 0 && (
        <ChartContainer
          title="Security Event Distribution"
          description="Administrative and clinical operations breakdown"
          loading={loading}
          height={180}
        >
          <BarChart
            data={(() => {
              const counts: Record<string, number> = {};
              logs.forEach((l) => {
                const act = (l.action || "OTHER").replace(/_/g, " ");
                counts[act] = (counts[act] || 0) + 1;
              });
              return Object.entries(counts).map(([name, count]) => ({
                label: name.length > 14 ? name.substring(0, 12) + "..." : name,
                count,
              }));
            })()}
            series={[
              { key: "count", name: "Events Logged", color: "var(--chart-1)" },
            ]}
            height={180}
            valueFormatter={(v) => `${v} events`}
          />
        </ChartContainer>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Review system modifications, clinical status updates, and administrative events.
            {activeFilterCount > 0 && (
              <span className="ml-2 text-accent dark:text-accent font-medium">
                ({activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            error={loadError}
            onRetry={() => fetchLogs()}
            loading={loading}
            searchable
            mobileCardView={true}
            searchPlaceholder="Search audit events by action, actor, or details..."
              columns={[
                {
                  key: "createdAt",
                  header: "Timestamp",
                  sortable: true,
                  width: "160px",
                  render: (row) => <span className="text-xs font-medium text-text-secondary">{formatDateTime(row.createdAt)}</span>
                },
                {
                  key: "action",
                  header: "Action Event",
                  sortable: true,
                  width: "150px",
                  render: (row) => (
                    <Badge variant={getActionBadgeVariant(row.action)} className="text-[10px] tracking-wide font-bold">
                      {row.action.replace(/_/g, " ")}
                    </Badge>
                  )
                },
                {
                  key: "category",
                  header: "Category",
                  sortable: true,
                  width: "120px",
                  render: (row) => row.category ? (
                    <Badge variant={getCategoryBadgeVariant(row.category)} className="text-[10px] tracking-wide font-semibold">
                      {row.category.replace(/_/g, " ")}
                    </Badge>
                  ) : <span className="text-text-muted text-xs">—</span>
                },
                {
                  key: "actor",
                  header: "Performed By",
                  render: (row) => (
                    <div className="flex flex-col">
                      <span className="font-semibold text-text text-sm">{row.userId?.name || "System"}</span>
                      <span className="text-[10px] font-mono text-text-muted capitalize">
                        {row.userId?.role || "agent"} • {row.userId?.email || "none"}
                      </span>
                    </div>
                  )
                },
                {
                  key: "targetModel",
                  header: "Target Entity",
                  width: "120px",
                  render: (row) => (
                    <span className="text-xs font-mono text-text-secondary">
                      {row.targetModel}
                    </span>
                  )
                },
                {
                  key: "details",
                  header: "Change Metadata",
                  render: (row) => renderDetails(row)
                }
              ]}
              data={logs}
              emptyMessage={activeFilterCount > 0 ? "No audit logs match the selected filters." : "No security logs generated yet."}
              renderMobileCard={(row: AuditLogEntry) => (
                <div
                  key={row.id}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={getActionBadgeVariant(row.action)} className="text-[10px] tracking-wide font-bold">
                        {row.action.replace(/_/g, " ")}
                      </Badge>
                      {row.category && (
                        <Badge variant={getCategoryBadgeVariant(row.category)} className="text-[9px] tracking-wide font-semibold">
                          {row.category.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-text-muted shrink-0">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surface-alt border border-border flex items-center justify-center font-bold text-xs text-text shrink-0">
                      {(row.userId?.name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-text text-xs truncate">{row.userId?.name || "System Automated"}</p>
                      <p className="text-[10px] font-mono text-text-muted truncate">
                        {row.userId?.role || "System"} • {row.userId?.email || "internal"}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-text-muted pb-1 border-b border-border/40">
                      <span>Target Entity:</span>
                      <span className="font-mono text-text font-semibold">{row.targetModel}</span>
                    </div>
                    <div className="pt-0.5">
                      {renderDetails(row)}
                    </div>
                  </div>
                </div>
              )}
            />
        </CardContent>
      </Card>
    </div>
  );
}
