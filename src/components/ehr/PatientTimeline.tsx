"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Modal, Badge, Button, cn } from "@/components/ui";
import { Stethoscope, FlaskConical, Building2, CreditCard, FileText, Sparkles, Search, Clock } from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: string;
  occurredAt: string;
  patientId: string;
  organizationId: string;
  title: string;
  summary: string;
  actor: { id: string; name: string; role?: string };
  sourceRef: { source: string; resourceType: string; resourceId: string; link: string };
  clinicalMetadata: {
    diagnoses?: string[];
    symptoms?: string[];
    medications?: Array<{ name: string; dosage: string; duration: string }>;
    labValues?: Array<{ testName: string; value: string; notes?: string; attachmentUrl?: string }>;
    admission?: { bedName?: string; ward?: string; durationDays?: number; reason?: string };
    billing?: { totalAmount: number; paymentStatus: string; paidAt?: string };
  };
  displayMetadata: {
    icon: string;
    badgeColor: string;
    statusLabel: string;
    uiCategory: string;
  };
  clinicalConcepts: {
    diagnoses: string[];
    medications: string[];
    procedures: string[];
    allergies: string[];
    vitals: Record<string, any>;
    labCodes: string[];
  };
}

interface PatientTimelineProps {
  patientId: string;
  events?: TimelineEvent[] | any[];
}

export function PatientTimeline({ patientId, events: initialEvents }: PatientTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [includeFinancial, setIncludeFinancial] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [selectedExplainerEvent, setSelectedExplainerEvent] = useState<TimelineEvent | null>(null);
  const [aiExplanationText, setAiExplanationText] = useState<string | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);

  const handleOpenExplainer = async (event: TimelineEvent) => {
    setSelectedExplainerEvent(event);
    setAiExplanationLoading(true);
    setAiExplanationText(null);
    try {
      const res = await api.post("/ai/health-assistant/query", {
        patientId: event.patientId,
        query: `Explain this medical record in plain, easy-to-understand language for a patient: Title: ${event.title}. Summary: ${event.summary}. Diagnoses: ${JSON.stringify(event.clinicalMetadata.diagnoses || [])}`,
        patientRecordSummary: `Clinical Event: ${event.title} on ${new Date(event.occurredAt).toLocaleDateString()}. Summary: ${event.summary}`
      });

      const data = res.data?.data || res.data;
      setAiExplanationText(data.answer || data.text || "AI analysis completed.");
    } catch {
      setAiExplanationText(`This record documents ${event.displayMetadata.statusLabel.toLowerCase()} recorded by ${event.actor.name}. All findings are preserved in your Universal Health Vault.`);
    } finally {
      setAiExplanationLoading(false);
    }
  };

  const fetchTimeline = async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (category !== "all") queryParams.set("category", category);
      if (includeFinancial) queryParams.set("includeFinancial", "true");
      if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());
      if (cursor) queryParams.set("cursor", cursor);

      const res = await api.get(`/patients/${patientId}/timeline?${queryParams.toString()}`);
      const newEvents: TimelineEvent[] = res.data?.data?.events || [];

      if (append) {
        setEvents((prev) => [...prev, ...newEvents]);
      } else {
        setEvents(newEvents);
      }

      setNextCursor(res.data?.data?.nextCursor || null);
      setHasMore(res.data?.data?.hasMore || false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [patientId, category, includeFinancial]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTimeline();
  };

  const getCategoryBadgeClass = (color: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "blue":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "indigo":
        return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
      case "amber":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  const getEventIconComponent = (icon: string) => {
    switch (icon) {
      case "stethoscope":
        return <Stethoscope className="w-4 h-4 text-primary-500" />;
      case "flask":
        return <FlaskConical className="w-4 h-4 text-blue-500" />;
      case "bed":
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case "credit-card":
        return <CreditCard className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-text-secondary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-3.5 sm:p-4 bg-surface rounded-2xl border border-border/80 shadow-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
          {[
            { id: "all", label: "All Events" },
            { id: "consultation", label: "Consultations" },
            { id: "lab", label: "Diagnostics" },
            { id: "admission", label: "Admissions" },
            { id: "billing", label: "Financial" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                category === cat.id
                  ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                  : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Financial Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search diagnoses, meds, labs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-surface-alt border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-text"
            />
          </form>

          <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeFinancial}
              onChange={(e) => setIncludeFinancial(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-primary-600 focus:ring-primary-500"
            />
            Include Financials
          </label>
        </div>
      </div>

      {/* Timeline Stream View */}
      {loading && events.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading patient health records timeline...</div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500">No clinical timeline events found matching filters.</div>
      ) : (
        <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-[#1e1f26] space-y-6">
          {events.map((event) => (
            <div key={event.id} className="relative group">
              {/* Timeline Marker Bullet */}
              <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full bg-surface border-2 border-primary-500 flex items-center justify-center shadow-xs">
                {getEventIconComponent(event.displayMetadata.icon)}
              </div>

              {/* Event Card */}
              <div className="p-4 bg-surface rounded-2xl border border-border/80 hover:border-primary-500/40 transition-all shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-text">{event.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${getCategoryBadgeClass(event.displayMetadata.badgeColor)}`}>
                        {event.displayMetadata.statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">{event.summary}</p>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {new Date(event.occurredAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Structured Clinical Metadata Badges */}
                {event.clinicalMetadata.diagnoses && event.clinicalMetadata.diagnoses.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {event.clinicalMetadata.diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded text-[11px] font-medium">
                        Diagnosis: {d}
                      </span>
                    ))}
                  </div>
                )}

                {/* Prescriptions List */}
                {event.clinicalMetadata.medications && event.clinicalMetadata.medications.length > 0 && (
                  <div className="text-xs text-text-secondary">
                    <span className="font-medium text-text">Medications: </span>
                    {event.clinicalMetadata.medications.map((m) => `${m.name} (${m.dosage})`).join(", ")}
                  </div>
                )}

                {/* Footer Navigation Link & AI Explainer Trigger */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-text-muted">
                  <span>Actor: {event.actor.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenExplainer(event)}
                      className="px-2.5 py-1 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Explainer</span>
                    </button>
                    <a
                      href={event.sourceRef.link}
                      className="text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1"
                    >
                      View Details &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={() => fetchTimeline(nextCursor || undefined, true)}
            disabled={loading}
            className="px-4 py-2 bg-surface-alt border border-border/80 text-xs font-semibold text-text rounded-xl hover:bg-surface-hover transition-all cursor-pointer shadow-xs"
          >
            {loading ? "Loading..." : "Load Older Records"}
          </button>
        </div>
      )}
      {/* AI Plain-Language Report Explainer Modal */}
      <Modal
        isOpen={Boolean(selectedExplainerEvent)}
        onClose={() => setSelectedExplainerEvent(null)}
        title={`💡 AI Explanation: ${selectedExplainerEvent?.title || "Clinical Record"}`}
      >
        {selectedExplainerEvent && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="primary">Grounded Real AI Analysis</Badge>
              <span className="text-text-muted">{new Date(selectedExplainerEvent.occurredAt).toLocaleDateString()}</span>
            </div>

            <div className="bg-surface-alt border border-border p-3 rounded-xl space-y-1">
              <div className="font-bold text-text mb-1">Clinical Record Summary:</div>
              <p className="text-text-secondary leading-relaxed">{selectedExplainerEvent.summary}</p>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-text">What This Means (AI Explanation):</div>
              {aiExplanationLoading ? (
                <div className="p-4 text-center text-text-muted animate-pulse bg-primary-50/50 dark:bg-primary-950/20 rounded-xl border border-primary-500/20">
                  ✨ Gemini AI is analyzing medical record context...
                </div>
              ) : (
                <p className="text-text-secondary leading-relaxed bg-primary-50 dark:bg-primary-950/30 p-3 rounded-xl border border-primary-200 dark:border-primary-900/40">
                  {aiExplanationText}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSelectedExplainerEvent(null)}>
                Close Analysis
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
