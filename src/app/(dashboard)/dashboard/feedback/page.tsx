"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, SkeletonTable
} from "@/components/ui";
import { Plus, Target, Star, MessageSquare, Sparkles } from "lucide-react";

interface AspectRatings {
  waitTime?: number;
  doctorAttitude?: number;
  cleanliness?: number;
}

interface PatientFeedbackItem {
  id: string;
  appointmentId: {
    id: string;
    reason?: string;
    appointmentTime?: string;
  };
  patientId: {
    id: string;
    userId?: { name?: string; email?: string };
  };
  doctorId: {
    id: string;
    name?: string;
    specialization?: string;
  };
  clinicId: string;
  rating: number; // 1-5
  npsScore: number; // 0-10
  comments?: string;
  aspectRatings?: AspectRatings;
  createdAt: string;
}

interface FeedbackStats {
  totalResponses: number;
  averageCsatRating: number; // e.g. 4.85
  netPromoterScore: number; // e.g. 88 (-100 to +100)
  npsCategory: string; // "Excellent" | "Good" | "Needs Improvement"
  averageAspectRatings: {
    waitTime: number | null;
    doctorAttitude: number | null;
    cleanliness: number | null;
  };
}

interface AppointmentOption {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  reason: string;
}

export default function PatientExperienceFeedbackPage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<PatientFeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    totalResponses: 0,
    averageCsatRating: 0,
    netPromoterScore: 0,
    npsCategory: "No responses",
    averageAspectRatings: { waitTime: null, doctorAttitude: null, cleanliness: null },
  });

  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [filterRating, setFilterRating] = useState<string>("all");

  // Modal State
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Survey Form Data
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [csatRating, setCsatRating] = useState<number>(5);
  const [npsScore, setNpsScore] = useState<number>(10);
  const [waitTimeRating, setWaitTimeRating] = useState<number>(5);
  const [doctorAttitudeRating, setDoctorAttitudeRating] = useState<number>(5);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [comments, setComments] = useState("");

  useEffect(() => {
    fetchFeedbackData();
    fetchCompletedAppointments();
  }, [activeClinicId]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);
      const statsRes = await api.get(`/feedback/stats${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      if (statsRes.data?.success && statsRes.data?.data) {
        setStats(statsRes.data.data);
      }

      const listRes = await api.get(`/feedback${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      if (listRes.data?.success && Array.isArray(listRes.data?.data)) {
        setFeedbacks(listRes.data.data);
      } else {
        setFeedbacks([]);
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedAppointments = async () => {
    try {
      const res = await api.get(`/appointments${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const opts: AppointmentOption[] = res.data.data
          .filter((a: any) => a.status === "completed")
          .slice(0, 10)
          .map((a: any) => ({
          id: a.id || a._id,
          patientName: a.patientId?.userId?.name || a.patientId?.name || "Patient",
          doctorName: a.doctorId?.name || "Doctor",
          date: a.appointmentTime ? new Date(a.appointmentTime).toLocaleDateString() : "Recent",
          reason: a.reason || "General Consult",
          }));
        setAppointments(opts);
        if (opts.length > 0) setSelectedAppointmentId(opts[0].id);
      }
    } catch (err) {
      console.error("Error loading appointments for survey modal:", err);
    }
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointmentId) {
      toast({ title: "Validation Error", description: "Please select an appointment", variant: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        appointmentId: selectedAppointmentId,
        rating: csatRating,
        npsScore,
        comments,
        aspectRatings: {
          waitTime: waitTimeRating,
          doctorAttitude: doctorAttitudeRating,
          cleanliness: cleanlinessRating,
        },
      };

      const res = await api.post("/feedback", payload);
      if (res.data?.success) {
        toast({ title: "Feedback Recorded", description: "Thank you for rating your hospital visit experience!", variant: "success" });
        setIsSurveyModalOpen(false);
        setComments("");
        fetchFeedbackData();
      } else {
        toast({ title: "Submission Failed", description: res.data?.message || "Could not save feedback", variant: "error" });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Server error while recording feedback",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filterRating === "all") return true;
    if (filterRating === "promoter") return f.npsScore >= 9;
    if (filterRating === "passive") return f.npsScore >= 7 && f.npsScore <= 8;
    if (filterRating === "detractor") return f.npsScore <= 6;
    return true;
  });

  const formatAspectRating = (value: number | null) => value === null ? "—" : `${value} / 5.0`;
  const aspectPercent = (value: number | null) => value === null ? "0%" : `${Math.round((value / 5) * 100)}%`;

  const renderStars = (count: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={`text-lg ${i < count ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}>
        ★
      </span>
    ));
  };

  const getNpsBadge = (score: number) => {
    if (score >= 9) {
      return <Badge variant="success">🟢 Promoter ({score}/10)</Badge>;
    }
    if (score >= 7) {
      return <Badge variant="warning">🟡 Passive ({score}/10)</Badge>;
    }
    return <Badge variant="danger">🔴 Detractor ({score}/10)</Badge>;
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
                Patient Experience & CSAT Feedback
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Accreditation Governance
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Real-time patient satisfaction tracking, 5-Star CSAT indices, Net Promoter Score (NPS) governance, and aspect-level care quality ratings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSurveyModalOpen(true)}
              className="font-semibold rounded-xl shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Submit Patient Survey
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net Promoter Score (NPS)"
          value={`${stats.netPromoterScore > 0 ? `+${stats.netPromoterScore}` : stats.netPromoterScore}`}
          description={`${stats.npsCategory} Sentiment`}
          icon={<Target className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Average CSAT Rating"
          value={`${stats.averageCsatRating} / 5.0`}
          description="Verified Patient Encounters"
          icon={<Star className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Total Survey Responses"
          value={stats.totalResponses.toString()}
          description="Completed Clinical Feedbacks"
          icon={<MessageSquare className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Hygiene & Care Rating"
          value={formatAspectRating(stats.averageAspectRatings.cleanliness)}
          description="Cleanliness Index"
          icon={<Sparkles className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* Aspect Ratings & Sentiment Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 shadow-xs border border-border/80 rounded-2xl bg-surface">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-text">
              <span>⏱</span> OPD Wait Time Satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Average Rating</span>
              <span className="font-bold text-text">{formatAspectRating(stats.averageAspectRatings.waitTime)}</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.waitTime) }} />
            </div>
            <p className="text-xs text-text-muted">Target: Avg consult wait time under 15 minutes.</p>
          </CardContent>
        </Card>

        <Card className="p-5 shadow-xs border border-border/80 rounded-2xl bg-surface">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-text">
              <span>👨‍⚕️</span> Doctor Communication & Attitude
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Average Rating</span>
              <span className="font-bold text-text">{formatAspectRating(stats.averageAspectRatings.doctorAttitude)}</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 rounded-full overflow-hidden">
              <div className="bg-teal-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.doctorAttitude) }} />
            </div>
            <p className="text-xs text-text-muted">High patient trust in clinical explanation & empathy.</p>
          </CardContent>
        </Card>

        <Card className="p-5 shadow-xs border border-border/80 rounded-2xl bg-surface">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-text">
              <span>✨</span> Facility & Ward Cleanliness
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Average Rating</span>
              <span className="font-bold text-text">{formatAspectRating(stats.averageAspectRatings.cleanliness)}</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.cleanliness) }} />
            </div>
            <p className="text-xs text-text-muted">Sanitization & room hygiene standards compliant.</p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Survey Reviews Feed & Filter Table */}
      <Card className="shadow-xs border border-border/80 rounded-2xl bg-surface">
        <CardHeader className="p-5 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-text">
              Patient Feedback & Review Feed
            </CardTitle>
            <p className="text-xs text-text-muted">
              Verified clinical visit reviews and qualitative feedback comments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">Filter Sentiment:</span>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-xl border border-border/80 bg-surface text-text font-semibold cursor-pointer"
            >
              <option value="all">All Feedback (100%)</option>
              <option value="promoter">🟢 Promoters (9-10 NPS)</option>
              <option value="passive">🟡 Passives (7-8 NPS)</option>
              <option value="detractor">🔴 Detractors (0-6 NPS)</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={4} cols={5} />
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <div className="text-4xl">📝</div>
              <p className="text-sm font-medium">No patient feedback matching current sentiment filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredFeedbacks.map((fb) => (
                <div key={fb.id} className="p-5 hover:bg-surface-hover/50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                        {fb.patientId?.userId?.name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="font-semibold text-text text-sm flex items-center gap-2">
                          {fb.patientId?.userId?.name || "Anonymous Patient"}
                          <span className="text-xs text-text-muted font-normal">
                            · Attending: {fb.doctorId?.name || "Attending Physician"} ({fb.doctorId?.specialization || "Opd"})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex">{renderStars(fb.rating)}</div>
                          <span className="text-xs font-semibold text-text-secondary">({fb.rating}/5 CSAT)</span>
                        </div>
                      </div>
                    </div>
                    <div>{getNpsBadge(fb.npsScore)}</div>
                  </div>

                  {fb.comments && (
                    <p className="text-sm text-text-secondary bg-surface-alt/70 p-3 rounded-xl border border-border/60 italic">
                      "{fb.comments}"
                    </p>
                  )}

                  {fb.aspectRatings && (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted pt-1">
                      {fb.aspectRatings.waitTime && (
                        <span>⏱ Wait Time: <strong className="text-text">{fb.aspectRatings.waitTime}/5</strong></span>
                      )}
                      {fb.aspectRatings.doctorAttitude && (
                        <span>👨‍⚕️ Doctor Care: <strong className="text-text">{fb.aspectRatings.doctorAttitude}/5</strong></span>
                      )}
                      {fb.aspectRatings.cleanliness && (
                        <span>✨ Hygiene: <strong className="text-text">{fb.aspectRatings.cleanliness}/5</strong></span>
                      )}
                      <span className="ml-auto text-text-muted">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Patient Survey Modal */}
      <Modal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        title="Submit Patient Experience Survey"
      >
        <form onSubmit={handleSubmitSurvey} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Select Completed Clinical Visit *
            </label>
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-border/80 bg-surface text-text font-medium"
              required
            >
              {appointments.length === 0 ? (
                <option value="">No recent appointments found</option>
              ) : (
                appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.patientName} — {a.doctorName} ({a.reason} on {a.date})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Overall CSAT Rating (1 - 5 Stars) *
              </label>
              <select
                value={csatRating.toString()}
                onChange={(e) => setCsatRating(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-border/80 bg-surface text-text font-medium"
              >
                <option value="5">⭐️⭐️⭐️⭐️⭐️ (5 - Excellent)</option>
                <option value="4">⭐️⭐️⭐️⭐️ (4 - Very Good)</option>
                <option value="3">⭐️⭐️⭐️ (3 - Average)</option>
                <option value="2">⭐️⭐️ (2 - Below Expectations)</option>
                <option value="1">⭐️ (1 - Poor)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Net Promoter Score (NPS 0 - 10) *
              </label>
              <Input
                type="number"
                min={0}
                max={10}
                value={npsScore}
                onChange={(e) => setNpsScore(Number(e.target.value))}
                className="text-xs"
                required
              />
            </div>
          </div>

          {/* Aspect Ratings */}
          <div className="border-t border-border/60 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-text uppercase tracking-wider">
              Care Quality Aspect Breakdown (1 - 5)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">⏱ Wait Time</label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={waitTimeRating}
                  onChange={(e) => setWaitTimeRating(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">👨‍⚕️ Doctor Attitude</label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={doctorAttitudeRating}
                  onChange={(e) => setDoctorAttitudeRating(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">✨ Cleanliness</label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={cleanlinessRating}
                  onChange={(e) => setCleanlinessRating(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Patient Comments & Qualitative Feedback
            </label>
            <Textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share detailed experience regarding consultation, nursing care, or billing..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSurveyModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} variant="primary" className="text-xs rounded-xl font-semibold">
              {submitting ? "Submitting..." : "Save Patient Feedback"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
