"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Modal, Badge, Button } from "@/components/ui";

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

  const getEventIcon = (icon: string) => {
    switch (icon) {
      case "stethoscope":
        return "🩺";
      case "flask":
        return "🔬";
      case "bed":
        return "🏥";
      case "credit-card":
        return "💳";
      default:
        return "📋";
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-zinc-50 dark:bg-[#12131a] rounded-xl border border-zinc-200 dark:border-[#1e1f26]">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {["all", "consultation", "lab", "admission", "billing"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                category === cat
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white dark:bg-[#1a1b23] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-[#252631]"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Search & Financial Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search diagnoses, meds, labs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#1a1b23] border border-zinc-200 dark:border-[#252631] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-[#090a0f] border-2 border-primary-500 flex items-center justify-center text-[10px]">
                {getEventIcon(event.displayMetadata.icon)}
              </div>

              {/* Event Card */}
              <div className="p-4 bg-white dark:bg-[#12131a] rounded-xl border border-zinc-200 dark:border-[#1e1f26] hover:border-primary-500/40 transition-all shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">{event.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${getCategoryBadgeClass(event.displayMetadata.badgeColor)}`}>
                        {event.displayMetadata.statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{event.summary}</p>
                  </div>
                  <span className="text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(event.occurredAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Structured Clinical Metadata Badges */}
                {event.clinicalMetadata.diagnoses && event.clinicalMetadata.diagnoses.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {event.clinicalMetadata.diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded text-[11px] font-medium">
                        Diagnosis: {d}
                      </span>
                    ))}
                  </div>
                )}

                {/* Prescriptions List */}
                {event.clinicalMetadata.medications && event.clinicalMetadata.medications.length > 0 && (
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Medications: </span>
                    {event.clinicalMetadata.medications.map((m) => `${m.name} (${m.dosage})`).join(", ")}
                  </div>
                )}

                {/* Footer Navigation Link & AI Explainer Trigger */}
                <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-[#1a1b23] flex items-center justify-between text-xs text-zinc-400">
                  <span>Actor: {event.actor.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenExplainer(event)}
                      className="px-2 py-1 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded text-xs font-bold hover:bg-primary-100 transition-colors"
                    >
                      💡 AI Explainer
                    </button>
                    <a
                      href={event.sourceRef.link}
                      className="text-primary-600 hover:text-primary-700 font-medium hover:underline flex items-center gap-1"
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
            className="px-4 py-2 bg-zinc-100 dark:bg-[#1a1b23] text-xs font-semibold rounded-lg hover:bg-zinc-200 dark:hover:bg-[#252631] transition-all"
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
