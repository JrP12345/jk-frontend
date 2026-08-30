"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { canViewAuditLogs } from "@/lib/permissions";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Table, Badge, Button, useToast, Spinner, Alert, SkeletonTable,
  ChartContainer, BarChart, cn
} from "@/components/ui";
import { RotateCw } from "lucide-react";

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
  details?: any;
  createdAt: string;
}

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/audit-logs");
      setLogs(res.data.data || []);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewAuditLogs(user)) {
      fetchLogs();
    }
  }, [user]);

  if (!canViewAuditLogs(user)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Alert variant="error" title="Access Denied">
          You do not have the required administrative permissions to view the security audit trail.
        </Alert>
      </div>
    );
  }

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
            Manual queue reorder (VIP Shift) applied. Doctor ID: <span className="font-mono text-text">{details.doctorId}</span>. Date: <span className="text-text">{details.date}</span>.
          </span>
        );
      }

      if (action === "APPOINTMENT_CREATE") {
        return (
          <span className="text-xs text-text-secondary">
            Booked Token <strong className="text-primary-700">#{details.tokenNumber}</strong>. Status: <span className="capitalize">{details.status}</span>. Time: <span className="font-mono text-text">{new Date(details.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>.
          </span>
        );
      }

      return (
        <pre className="text-[10px] max-w-xs font-mono text-text-secondary overflow-x-auto bg-surface-alt p-1 rounded">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
    } catch (e) {
      return <span className="text-xs text-text-muted">Could not parse details</span>;
    }
  };

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Audit Trail & Compliance Logs
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Security & Compliance
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Track clinical mutations, security access events, VIP overrides, and administrative modifications.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", loading && "animate-spin")} />
              Refresh Logs
            </Button>
          </div>
        </div>
      </div>

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
              { key: "count", name: "Events Logged", color: "var(--s-chart-1, #3b82f6)" },
            ]}
            height={180}
            valueFormatter={(v) => `${v} events`}
          />
        </ChartContainer>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Review system modifications, clinical status updates, and administrative events.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            loading={loading}
            searchable
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
                      {row.action.replace("_", " ")}
                    </Badge>
                  )
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
              emptyMessage="No security logs generated yet."
            />
        </CardContent>
      </Card>
    </div>
  );
}
