"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, SkeletonTable
} from "@/components/ui";

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-emerald-100">
            ★ PEC & Quality Accreditation Governance
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Experience & NPS Feedback Analytics</h1>
          <p className="text-emerald-100 text-sm max-w-2xl">
            Real-time patient satisfaction tracking, 5-Star CSAT indices, Net Promoter Score (NPS) governance, and aspect-level care quality ratings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsSurveyModalOpen(true)}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold shadow-md border-0 text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            + Submit Patient Survey
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Net Promoter Score (NPS)"
          value={`${stats.netPromoterScore > 0 ? `+${stats.netPromoterScore}` : stats.netPromoterScore}`}
          change={{ value: `${stats.npsCategory} Sentiment`, positive: stats.netPromoterScore >= 50 }}
          icon={
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              🎯
            </div>
          }
        />
        <StatCard
          title="Average CSAT Rating"
          value={`${stats.averageCsatRating} / 5.0`}
          change={{ value: "Verified Visits", positive: true }}
          icon={
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
              ⭐️
            </div>
          }
        />
        <StatCard
          title="Total Survey Responses"
          value={stats.totalResponses.toString()}
          change={{ value: "Completed Forms", positive: true }}
          icon={
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
              📝
            </div>
          }
        />
        <StatCard
          title="Hygiene & Care Rating"
          value={formatAspectRating(stats.averageAspectRatings.cleanliness)}
          change={{ value: stats.averageAspectRatings.cleanliness === null ? "No responses" : "Recorded surveys", positive: stats.averageAspectRatings.cleanliness !== null }}
          icon={
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              ✨
            </div>
          }
        />
      </div>

      {/* Aspect Ratings & Sentiment Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span>⏱</span> OPD Wait Time Satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Average Rating</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{formatAspectRating(stats.averageAspectRatings.waitTime)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.waitTime) }} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Target: Avg consult wait time under 15 minutes.</p>
          </CardContent>
        </Card>

        <Card className="p-5 shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span>👨‍⚕️</span> Doctor Communication & Attitude
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Average Rating</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{formatAspectRating(stats.averageAspectRatings.doctorAttitude)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-teal-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.doctorAttitude) }} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">High patient trust in clinical explanation & empathy.</p>
          </CardContent>
        </Card>

        <Card className="p-5 shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span>✨</span> Facility & Ward Cleanliness
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Average Rating</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{formatAspectRating(stats.averageAspectRatings.cleanliness)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: aspectPercent(stats.averageAspectRatings.cleanliness) }} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sanitization & room hygiene standards compliant.</p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Survey Reviews Feed & Filter Table */}
      <Card className="shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
        <CardHeader className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Patient Feedback & Review Feed
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Verified clinical visit reviews and qualitative feedback comments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Filter Sentiment:</span>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredFeedbacks.map((fb) => (
                <div key={fb.id} className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm">
                        {fb.patientId?.userId?.name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                          {fb.patientId?.userId?.name || "Anonymous Patient"}
                          <span className="text-xs text-gray-400 font-normal">
                            · Attending: {fb.doctorId?.name || "Attending Physician"} ({fb.doctorId?.specialization || "Opd"})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex">{renderStars(fb.rating)}</div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">({fb.rating}/5 CSAT)</span>
                        </div>
                      </div>
                    </div>
                    <div>{getNpsBadge(fb.npsScore)}</div>
                  </div>

                  {fb.comments && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 italic">
                      "{fb.comments}"
                    </p>
                  )}

                  {fb.aspectRatings && (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
                      {fb.aspectRatings.waitTime && (
                        <span>⏱ Wait Time: <strong className="text-gray-700 dark:text-gray-300">{fb.aspectRatings.waitTime}/5</strong></span>
                      )}
                      {fb.aspectRatings.doctorAttitude && (
                        <span>👨‍⚕️ Doctor Care: <strong className="text-gray-700 dark:text-gray-300">{fb.aspectRatings.doctorAttitude}/5</strong></span>
                      )}
                      {fb.aspectRatings.cleanliness && (
                        <span>✨ Hygiene: <strong className="text-gray-700 dark:text-gray-300">{fb.aspectRatings.cleanliness}/5</strong></span>
                      )}
                      <span className="ml-auto text-gray-400">
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Select Completed Clinical Visit *
            </label>
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Overall CSAT Rating (1 - 5 Stars) *
              </label>
              <select
                value={csatRating.toString()}
                onChange={(e) => setCsatRating(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="5">⭐️⭐️⭐️⭐️⭐️ (5 - Excellent)</option>
                <option value="4">⭐️⭐️⭐️⭐️ (4 - Very Good)</option>
                <option value="3">⭐️⭐️⭐️ (3 - Average)</option>
                <option value="2">⭐️⭐️ (2 - Below Expectations)</option>
                <option value="1">⭐️ (1 - Poor)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
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
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Care Quality Aspect Breakdown (1 - 5)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">⏱ Wait Time</label>
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
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">👨‍⚕️ Doctor Attitude</label>
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
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">✨ Cleanliness</label>
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
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
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <Spinner size="sm" /> : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
