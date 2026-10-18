"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { canViewAuditLogs } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import { Table, Badge, Button, Select, Input, useToast, Alert, DatePicker } from "@/components/ui";
import { RotateCw, Filter, Building2, Stethoscope, Tag, Search, ChevronDown } from "lucide-react";
import styles from "./Audit.module.css";

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
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");

  // Dropdown data
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

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

  const fetchLogs = useCallback(async (activeFilters: FilterState = appliedFilters) => {
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
    } catch {
      if (!request.isCurrent()) return;
      setLoadError("Audit events could not be loaded. Please try again.");
      console.error("Failed to load audit logs");
      toast?.({ title: "Error", description: "Failed to load audit logs", variant: "error" });
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [appliedFilters, toast, user, beginRead]);

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
    setAppliedFilters(filters);
    fetchLogs(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
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
        <dl className={styles.changeFields}>
          {fields.map(([key, value]) => (
            <div key={key} className={styles.changeField}>
              <dt className="font-medium text-text">{key.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")}:</dt>
              <dd className={styles.changeValue}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      );
    } catch {
      return <span className="text-xs text-text-muted">Could not parse details</span>;
    }
  };

  const categoryLabel = (category?: string) => CATEGORIES.find((item) => item.value === category)?.label || category?.replace(/_/g, " ") || "Uncategorized";
  const actionLabel = (action: string) => action.toLowerCase().replace(/_/g, " ");
  const distribution = Object.entries(logs.reduce<Record<string, number>>((counts, log) => {
    const label = categoryLabel(log.category);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  const visibleLogs = logs.filter((log) => JSON.stringify(log).toLowerCase().includes(search.trim().toLowerCase()));
  const actorCount = new Set(logs.map((log) => log.userId?.id || log.userId?.email || "system")).size;
  const summaryValue = (value: number) => loading || loadError ? "\u2014" : value;
  const renderEvent = (row: AuditLogEntry) => (
    <div className={styles.event}>
      <Badge variant={getActionBadgeVariant(row.action)} className={styles.actionBadge}>{actionLabel(row.action)}</Badge>
      <span className={styles.meta}>{categoryLabel(row.category)}</span>
    </div>
  );
  const renderActor = (row: AuditLogEntry) => (
    <div className={styles.actor}>
      <span className={styles.avatar} aria-hidden="true">{(row.userId?.name || "S").charAt(0).toUpperCase()}</span>
      <div>
        <p className={styles.actorName}>{row.userId?.name || "System"}</p>
        <p className={styles.meta}>{row.userId?.email || "Automated event"}</p>
        {row.userId?.role && <p className={styles.role}>{row.userId.role.replace(/_/g, " ")}</p>}
      </div>
    </div>
  );
  const renderChange = (row: AuditLogEntry) => (
    <div className={styles.change}>
      <p className={styles.target}>{row.targetModel || "System"}</p>
      {renderDetails(row)}
    </div>
  );

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>Audit log</h1>
          <p>Track account access, clinical changes, and administrative activity.</p>
        </div>
        <Button variant="outline" size="sm" aria-label="Refresh audit log" title="Refresh audit log" className={styles.iconAction} onClick={() => fetchLogs()} loading={loading} disabled={loading}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </header>

      <dl className={styles.summary} aria-label="Loaded audit event summary" aria-busy={loading}>
        <div><dt>Events loaded</dt><dd>{summaryValue(logs.length)}</dd></div>
        <div><dt>Categories</dt><dd>{summaryValue(distribution.length)}</dd></div>
        <div><dt>Actors</dt><dd>{summaryValue(actorCount)}</dd></div>
      </dl>

      <section className={styles.panel} aria-labelledby="audit-activity-title">
        <div className={styles.sectionHeader}>
          <div><h2 id="audit-activity-title">Activity log</h2><p>Up to 100 events per request{activeFilterCount > 0 ? ` \u00b7 ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied` : ""}</p></div>
          {!loading && !loadError && <span className={styles.resultCount}>{visibleLogs.length} {visibleLogs.length === 1 ? "event" : "events"}</span>}
        </div>
        <div className={styles.toolbar}>
          <Input type="search" aria-label="Search audit events" placeholder="Search audit events" icon={<Search className="h-4 w-4" />} value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} containerClassName={styles.search} />
          <Button variant={showFilters ? "primary" : "outline"} aria-label={activeFilterCount ? `Filters, ${activeFilterCount} applied` : "Filters"} aria-expanded={showFilters} aria-controls="audit-filters" className={styles.filterButton} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" /><span className={styles.filterLabel}>Filters</span>{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
          </Button>
        </div>
        {showFilters && (
          <form id="audit-filters" className={styles.filters} onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
            <div className={styles.filterHeading}><h3>Filter audit logs</h3><Button variant="ghost" size="sm" onClick={clearFilters}>Clear All</Button></div>
            <div className={styles.filterGrid}>
              <Select size="sm" label="Organization" icon={<Building2 className="h-3.5 w-3.5" />} value={filters.organizationId} disabled={orgsLoading} onChange={(event) => updateFilter("organizationId", event.target.value)} options={[
                { value: "", label: "All Organizations" }, ...organizations.map((org) => ({ value: org.id || org._id, label: org.name + (org.city ? ` (${org.city})` : "") })),
              ]} />
              <Select size="sm" label="Location" icon={<Building2 className="h-3.5 w-3.5" />} value={filters.locationId} onChange={(event) => updateFilter("locationId", event.target.value)} options={[
                { value: "", label: "All Locations" }, ...locations.map((location) => ({ value: location.id || location._id, label: location.name || location.locationName || "Unnamed Location" })),
              ]} />
              <Select size="sm" label="Doctor / Staff" icon={<Stethoscope className="h-3.5 w-3.5" />} value={filters.doctorId} onChange={(event) => updateFilter("doctorId", event.target.value)} options={[
                { value: "", label: "All Staff" }, ...doctors.map((doctor) => ({ value: doctor.id || doctor._id || doctor.userId, label: doctor.name || doctor.email || "Unknown" })),
              ]} />
              <Select size="sm" label="Category" icon={<Tag className="h-3.5 w-3.5" />} value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} options={[{ value: "", label: "All Categories" }, ...CATEGORIES]} />
              <DatePicker label="Start Date" id="audit-start-date"  size="sm" value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} />
              <DatePicker label="End Date" id="audit-end-date"  size="sm" value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} />
            </div>
            <div className={styles.filterActions}><Button type="submit" size="sm" disabled={loading}>Apply Filters</Button><p>Choose filters, then apply to update events.</p></div>
          </form>
        )}
        <Table
          className={styles.responsiveTable}
          caption="Security and administrative audit events"
          variant="flat"
          fitContent
          searchable={false}
          showColumnVisibility={false}
          error={loadError}
          onRetry={() => fetchLogs()}
          loading={loading}
          columns={[
            { key: "action", header: "Event", sortable: true, align: "left", width: "23%", render: renderEvent },
            { key: "actor", header: "Performed by", width: "27%", render: renderActor },
            { key: "details", header: "Change details", width: "32%", render: renderChange },
            { key: "createdAt", header: "Recorded", sortable: true, width: "18%", render: (row) => <time className={styles.timestamp} dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time> },
          ]}
          data={visibleLogs}
          emptyMessage={search || activeFilterCount > 0 ? "No audit logs match your search or filters." : "No audit events recorded yet."}
          renderMobileCard={(row: AuditLogEntry) => (
            <article className={styles.eventCard} aria-label={`${actionLabel(row.action)} by ${row.userId?.name || "System"}`}>
              <div className={styles.cardHeading}>{renderEvent(row)}<time className={styles.timestamp} dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time></div>
              {renderActor(row)}
              {renderChange(row)}
            </article>
          )}
        />
      </section>
      {!loading && !loadError && logs.length > 0 && (
        <details className={styles.distribution}>
          <summary><span>Event breakdown <small>By category</small></span><ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
          <p>Based on the {logs.length} loaded events before text search.</p>
          <dl>{distribution.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}<span className={styles.bar} aria-hidden="true"><span style={{ width: `${count / logs.length * 100}%` }} /></span></dd></div>)}</dl>
        </details>
      )}
    </div>
  );
}
