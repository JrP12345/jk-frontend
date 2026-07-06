"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Table, Badge, Spinner, Alert, Button
} from "@/components/ui";

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
    if (user?.role === "admin") {
      fetchLogs();
    }
  }, [user]);

  // Deny access for non-admins
  if (user?.role !== "admin") {
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Audit Trail Logs</h2>
          <p className="text-sm text-text-secondary">View security audits, queue status change events, and receptionist operations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} loading={loading}>
          Refresh logs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Activity Trail</CardTitle>
          <CardDescription>Records the last 100 platform modifications for HIPAA security compliance and audit oversight.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12"><Spinner size="lg" /></div>
          ) : (
            <Table
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
