"use client";

import React, { useState } from "react";
import { Card, Badge } from "@/components/ui";

export interface BriefingDelta {
  metric: string;
  previous: string;
  current: string;
  trajectory: "improving" | "stable" | "worsening" | "increased";
}

export interface BriefingCitation {
  docId: string;
  title: string;
  date: string;
  page: number;
  confidence: number;
}

export interface DoctorCopilotBriefingData {
  visitIntent: string;
  keyDeltas: BriefingDelta[];
  medicationCompliance: {
    score: number; // 0.0 to 1.0
    notes: string;
  };
  suggestedDiscussionPoints: string[];
  evidenceCitations: BriefingCitation[];
}

interface DoctorCopilotCardProps {
  patientName: string;
  briefing?: DoctorCopilotBriefingData;
  isLoading?: boolean;
}

export function DoctorCopilotCard({ patientName, briefing, isLoading = false }: DoctorCopilotCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <Card className="p-4 my-2 animate-pulse bg-surface border-border/80 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-primary-500/30" />
          <div className="h-4 bg-primary-500/30 rounded w-48" />
        </div>
        <div className="h-3 bg-surface-alt rounded w-3/4 mb-2" />
        <div className="h-3 bg-surface-alt rounded w-1/2" />
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card className="p-4 my-2 text-xs text-text-secondary border-border/80 shadow-xs">
        <div className="font-bold text-sm text-text">20-Second Pre-Visit Briefing</div>
        <p className="mt-1 text-text-muted">No generated briefing is available for {patientName}. Clinical decisions must use the verified patient record.</p>
      </Card>
    );
  }

  const data = briefing;

  const getTrajectoryBadge = (trajectory: BriefingDelta["trajectory"]) => {
    switch (trajectory) {
      case "worsening":
      case "increased":
        return "bg-error-500/10 text-error-700 dark:text-error-400 border-error-500/20";
      case "improving":
        return "bg-success-500/10 text-success-700 dark:text-success-400 border-success-500/20";
      default:
        return "bg-surface-hover text-text-secondary border-border";
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary-950/20 via-surface to-primary-950/10 border border-primary-500/30 rounded-xl p-4 my-3 shadow-sm transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-xs border border-primary-500/30 shrink-0 shadow-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm text-text flex items-center gap-2">
              20-Second Pre-Visit Briefing
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary-500/10 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-500/20">
                Anant Copilot
              </span>
            </h3>
            <p className="text-xs text-text-secondary">{data.visitIntent}</p>
          </div>
        </div>

        <button type="button" className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
          <span>{isExpanded ? "Collapse" : "Expand Briefing"}</span>
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-3 text-xs">
          {/* Key Deltas */}
          <div>
            <span className="font-semibold text-text-secondary block mb-1.5">Key Deltas Since Last Visit:</span>
            <div className="flex flex-wrap gap-2">
              {data.keyDeltas.map((delta, i) => (
                <div key={i} className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${getTrajectoryBadge(delta.trajectory)}`}>
                  <span className="font-bold">{delta.metric}:</span>
                  <span>{delta.previous}</span>
                  <span>➔</span>
                  <span className="font-bold">{delta.current}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Adherence Alert */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-amber-800 dark:text-amber-300">
            <span className="font-bold">Medication Compliance ({Math.round(data.medicationCompliance.score * 100)}%): </span>
            {data.medicationCompliance.notes}
          </div>

          {/* Suggested Discussion Points */}
          <div>
            <span className="font-semibold text-text-secondary block mb-1">Suggested Discussion Points:</span>
            <ul className="list-disc list-inside space-y-1 text-text">
              {data.suggestedDiscussionPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>

          {/* Provenance Evidence Citation Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-[11px]">
            <span className="text-text-secondary font-semibold">Evidence Citations:</span>
            {data.evidenceCitations.map((cite, index) => (
              <span key={index} className="inline-flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded border border-border text-text-secondary">
                📄 {cite.title} ({cite.date}, Page {cite.page}) — <b className="text-success-600">{Math.round(cite.confidence * 100)}% Match</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
