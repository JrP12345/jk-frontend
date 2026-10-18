"use client";

import styles from "./FollowUpRecallRegister.module.css";

import { useState, useEffect, type ReactNode } from "react";
import api from "@/lib/api";
import { Card, CardContent, Button, Badge, Input, useToast, cn, SkeletonCardGrid } from "@/components/ui";
import { CalendarClock, Send, UserCheck, RotateCw, Phone, CheckCircle2 } from "lucide-react";

interface FollowUpItem {
  id: string;
  appointmentTime: string;
  status: string;
  statusCategory: "due_today" | "upcoming" | "overdue" | "attended";
  tokenNumber?: number;
  patient: {
    id: string;
    name: string;
    phone: string;
    gender?: string;
    age?: number;
  };
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  location: {
    id: string;
    name: string;
  };
  diagnosis: string;
  symptoms: string;
  notes: string;
  lastRecallSentAt: string | null;
  recallCount: number;
}

interface FollowUpMetrics {
  dueTodayCount: number;
  upcomingCount: number;
  overdueCount: number;
  totalCount: number;
}

interface FollowUpRecallRegisterProps {
  locationId?: string;
  doctorId?: string;
  onCheckInSuccess?: () => void;
  toolbarActions?: ReactNode;
}

export function FollowUpRecallRegister({
  locationId,
  doctorId,
  onCheckInSuccess,
  toolbarActions,
}: FollowUpRecallRegisterProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [metrics, setMetrics] = useState<FollowUpMetrics>({
    dueTodayCount: 0,
    upcomingCount: 0,
    overdueCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"all" | "today" | "upcoming" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [sendingRecallId, setSendingRecallId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (locationId) params.append("locationId", locationId);
      if (doctorId) params.append("doctorId", doctorId);
      if (timeframe !== "all") params.append("timeframe", timeframe);
      if (search.trim()) params.append("search", search.trim());

      const res = await api.get(`/appointments/follow-ups?${params.toString()}`);
      if (res.data?.data) {
        setItems(res.data.data.items || []);
        if (res.data.data.metrics) {
          setMetrics(res.data.data.metrics);
        }
      }
    } catch (err: any) {
      toast({
        title: "Failed to Load Recalls",
        description: err.response?.data?.message || "Could not retrieve follow-up register.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, [locationId, doctorId, timeframe]);

  const handleSendRecall = async (item: FollowUpItem) => {
    try {
      setSendingRecallId(item.id);
      const res = await api.post(`/appointments/${item.id}/send-followup-reminder`, {
        phone: item.patient.phone || undefined,
        channel: "whatsapp",
      });

      toast({
        title: "WhatsApp reminder sent",
        description: `A follow-up reminder was sent to ${item.patient.name}.`,
        variant: "success",
      });

      // Update item in local state
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                lastRecallSentAt: res.data?.data?.lastRecallSentAt || new Date().toISOString(),
                recallCount: res.data?.data?.recallCount || (i.recallCount + 1),
              }
            : i
        )
      );
    } catch (err: any) {
      toast({
        title: "Reminder could not be sent",
        description: err.response?.data?.message || "Could not send WhatsApp reminder.",
        variant: "error",
      });
    } finally {
      setSendingRecallId(null);
    }
  };

  const handleCheckInPatient = async (item: FollowUpItem) => {
    try {
      setCheckingInId(item.id);
      await api.post(`/appointments/${item.id}/check-in`);
      toast({
        title: "Patient checked in",
        description: `${item.patient.name} was added to today's queue with token #${item.tokenNumber}.`,
        variant: "success",
      });
      await fetchFollowUps();
      if (onCheckInSuccess) onCheckInSuccess();
    } catch (err: any) {
      toast({
        title: "Patient could not be checked in",
        description: err.response?.data?.message || "Could not check in patient.",
        variant: "error",
      });
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className={styles.register}>
      <div className={cn(styles.filterBar, toolbarActions && styles.withActions)}>
      <div className={styles.timeframes} role="group" aria-label="Follow-up filters">
        {([
          { id: "all", label: "All", name: "All follow-ups", count: metrics.totalCount },
          { id: "today", label: "Today", name: "Due today", count: metrics.dueTodayCount },
          { id: "upcoming", label: "7 days", name: "Next 7 days", count: metrics.upcomingCount },
          { id: "overdue", label: "Overdue", name: "Overdue", count: metrics.overdueCount },
        ] as const).map(filter => <button key={filter.id} type="button" aria-label={filter.name} aria-pressed={timeframe === filter.id} title={filter.name} onClick={() => setTimeframe(filter.id)}>
          <span>{filter.label}</span><strong>{loading && items.length === 0 ? "—" : filter.count}</strong>
        </button>)}
      </div>
      {toolbarActions}
      </div>
      <form className={styles.search} role="search" aria-label="Search follow-ups" onSubmit={event => { event.preventDefault(); void fetchFollowUps(); }}>
        <Input type="search" enterKeyHint="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search follow-up patients" placeholder="Name, phone or diagnosis" />
        <Button type="submit" size="sm" variant="outline" loading={loading} icon={<RotateCw className="h-4 w-4" />} aria-label="Refresh recall register" />
      </form>

      {/* Patient Recall Cards / Table */}
      {loading && items.length === 0 ? (
        <SkeletonCardGrid count={1} columns={1} />
      ) : items.length === 0 ? (
        <Card padding="none" className={styles.emptyState}>
          <CardContent className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-accent">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-text">No Follow-Up Records Found</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {search.trim() ? "Try another name, phone number or diagnosis." : "Follow-up recommendations from completed visits appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const isDueToday = item.statusCategory === "due_today";
            const isOverdue = item.statusCategory === "overdue";
            const isAttended = item.statusCategory === "attended";
            const apptDate = new Date(item.appointmentTime);

            return (
              <Card
                key={item.id}
                padding="none"
                className={cn(
                  "rounded-2xl border transition-all hover:shadow-sm",
                  isOverdue
                    ? "border-danger/30 bg-danger/[0.02]"
                    : isDueToday
                    ? "border-warning/40 bg-warning/[0.02]"
                    : "border-border/80 bg-surface"
                )}
              >
                <CardContent className={styles.patient}>
                  {/* Patient Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-text">
                        {item.patient.name}
                      </span>
                      {item.patient.gender && (
                        <span className="text-xs text-text-muted">
                          ({item.patient.gender[0].toUpperCase()}
                          {item.patient.age ? `/${item.patient.age}y` : ""})
                        </span>
                      )}
                      <span className="font-mono text-xs font-semibold text-text-secondary">
                        #{item.tokenNumber}
                      </span>
                      <Badge
                        variant={
                          isAttended
                            ? "success"
                            : isOverdue
                            ? "danger"
                            : isDueToday
                            ? "warning"
                            : "primary"
                        }
                        size="sm"
                        className="capitalize text-[10px] font-bold"
                      >
                        {isOverdue
                          ? "Overdue (Missed)"
                          : isDueToday
                          ? "Due Today"
                          : isAttended
                          ? "Attended / Completed"
                          : "Scheduled Review"}
                      </Badge>
                      {item.recallCount > 0 && (
                        <Badge variant="neutral" size="sm" className="text-[9px] font-mono">
                          {item.recallCount} Recall{item.recallCount > 1 ? "s" : ""} Sent
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      <div className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-success-text" />
                        <span>{item.patient.phone || "No phone provided"}</span>
                      </div>
                      <div>
                        Review with: <strong>Dr. {item.doctor.name.replace(/^Dr\.\s*/i, "")}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarClock className="w-3 h-3 text-text-muted" />
                        <span>
                          {apptDate.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Clinical Context */}
                    <div className="text-xs text-text-secondary pt-0.5">
                      {item.diagnosis && (
                        <span>
                          <strong className="text-text">Diagnosis:</strong> {item.diagnosis}{" "}
                        </span>
                      )}
                      {item.notes && (
                        <span className="text-text-muted">
                          &bull; <em>{item.notes}</em>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Send Recall & Check In */}
                  <div className={styles.actions}>
                    {!isAttended && item.status !== "checked-in" && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleCheckInPatient(item)}
                        loading={checkingInId === item.id}
                        className="font-bold text-xs rounded-xl border-primary-500/40 text-accent dark:text-accent hover:bg-primary-500/10 cursor-pointer shadow-2xs"
                        title="Check patient into live queue if arrived"
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1" />
                        Arrived & Check-In
                      </Button>
                    )}

                    {!isAttended && (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => handleSendRecall(item)}
                        loading={sendingRecallId === item.id}
                        disabled={!item.patient.phone}
                        className="bg-success hover:bg-success text-background font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1"
                        title="Send personalized WhatsApp recall message with direct live wait tracker"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send WhatsApp reminder
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
