"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  useToast,
  Spinner,
  StatCard,
  cn,
} from "@/components/ui";
import {
  CalendarClock,
  Clock,
  Send,
  UserCheck,
  AlertTriangle,
  Search,
  RotateCw,
  Phone,
  CheckCircle2,
  Calendar,
  Sparkles,
  Users,
} from "lucide-react";

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
  clinic: {
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
  clinicId?: string;
  doctorId?: string;
  onCheckInSuccess?: () => void;
}

export function FollowUpRecallRegister({
  clinicId,
  doctorId,
  onCheckInSuccess,
}: FollowUpRecallRegisterProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [metrics, setMetrics] = useState<FollowUpMetrics>({
    dueTodayCount: 0,
    upcomingCount: 0,
    overdueCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<"all" | "today" | "upcoming" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [sendingRecallId, setSendingRecallId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (clinicId) params.append("clinicId", clinicId);
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
  }, [clinicId, doctorId, timeframe]);

  const handleSendRecall = async (item: FollowUpItem) => {
    try {
      setSendingRecallId(item.id);
      const res = await api.post(`/appointments/${item.id}/send-followup-reminder`, {
        phone: item.patient.phone || undefined,
        channel: "whatsapp",
      });

      toast({
        title: "WhatsApp Recall Dispatched! 🚀",
        description: res.data?.message || `Follow-up review ping sent to ${item.patient.name}.`,
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
        title: "Recall Failed",
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
        title: "Patient Checked In! ✓",
        description: `${item.patient.name} (Token #${item.tokenNumber}) added to today's active consultation queue.`,
        variant: "success",
      });
      await fetchFollowUps();
      if (onCheckInSuccess) onCheckInSuccess();
    } catch (err: any) {
      toast({
        title: "Check-In Error",
        description: err.response?.data?.message || "Could not check in patient.",
        variant: "error",
      });
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setTimeframe("all")}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            timeframe === "all"
              ? "bg-primary-500/15 border-primary-500/40 shadow-xs"
              : "bg-surface border-border/80 hover:bg-surface-hover"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-text-muted mb-1">
            <span>Total Follow-Ups</span>
            <Users className="w-4 h-4 text-primary-500" />
          </div>
          <div className="text-2xl font-black text-text">{metrics.totalCount}</div>
          <p className="text-[10px] text-text-muted">Total recorded review plans</p>
        </div>

        <div
          onClick={() => setTimeframe("today")}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            timeframe === "today"
              ? "bg-amber-500/20 border-amber-500/50 shadow-xs"
              : "bg-surface border-border/80 hover:bg-surface-hover"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
            <span>Due Today</span>
            <CalendarClock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-200">{metrics.dueTodayCount}</div>
          <p className="text-[10px] text-text-muted">Scheduled for consultation today</p>
        </div>

        <div
          onClick={() => setTimeframe("upcoming")}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            timeframe === "upcoming"
              ? "bg-emerald-500/20 border-emerald-500/50 shadow-xs"
              : "bg-surface border-border/80 hover:bg-surface-hover"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">
            <span>Upcoming (7 Days)</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{metrics.upcomingCount}</div>
          <p className="text-[10px] text-text-muted">Next 7 days scheduled reviews</p>
        </div>

        <div
          onClick={() => setTimeframe("overdue")}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            timeframe === "overdue"
              ? "bg-rose-500/20 border-rose-500/50 shadow-xs"
              : "bg-surface border-border/80 hover:bg-surface-hover"
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300 mb-1">
            <span>Overdue (Missed)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-200">{metrics.overdueCount}</div>
          <p className="text-[10px] text-text-muted">Past scheduled date - needs recall</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "all", label: "All Records" },
              { id: "today", label: `Due Today (${metrics.dueTodayCount})` },
              { id: "upcoming", label: `Upcoming (${metrics.upcomingCount})` },
              { id: "overdue", label: `Overdue (${metrics.overdueCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeframe(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                timeframe === t.id
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-surface border border-border/80 text-text-secondary hover:bg-surface-hover"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchFollowUps()}
              placeholder="Search patient, phone, diagnosis..."
              className="pl-8 text-xs h-8"
            />
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={fetchFollowUps}
            loading={loading}
            className="rounded-xl h-8 font-semibold cursor-pointer"
            title="Refresh Recall Register"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Patient Recall Cards / Table */}
      {loading ? (
        <div className="py-16 text-center text-text-muted">
          <Spinner className="w-7 h-7 mx-auto mb-2 text-primary-600" />
          <p className="text-xs font-semibold">Loading patient follow-up register...</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="py-14 text-center rounded-2xl border border-border/80 bg-surface">
          <CardContent className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-primary-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-text">No Follow-Up Records Found</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              No patients match the selected filter criteria. When doctors conclude consultations with follow-up recommendations, they will appear here.
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
                className={cn(
                  "rounded-2xl border transition-all hover:shadow-sm",
                  isOverdue
                    ? "border-rose-500/30 bg-rose-500/[0.02]"
                    : isDueToday
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : "border-border/80 bg-surface"
                )}
              >
                <CardContent className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                        <Phone className="w-3 h-3 text-emerald-600" />
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
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {!isAttended && item.status !== "checked-in" && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleCheckInPatient(item)}
                        loading={checkingInId === item.id}
                        className="font-bold text-xs rounded-xl border-primary-500/40 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 cursor-pointer shadow-2xs"
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                        title="Send personalized WhatsApp recall message with direct live wait tracker"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send WhatsApp Recall
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
