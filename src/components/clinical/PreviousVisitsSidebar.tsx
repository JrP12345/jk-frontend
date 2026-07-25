"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button, Spinner, Badge } from "@/components/ui";

interface PreviousVisitsSidebarProps {
  patientId: string;
  onCopyForward: (visitNote: any) => void;
}

export function PreviousVisitsSidebar({ patientId, onCopyForward }: PreviousVisitsSidebarProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || patientId === "dummy-patient-id") return;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/patients/${patientId}/clinical-notes/history`);
        const list = res.data?.data?.notes || res.data?.data || [];
        setHistory(list);
      } catch (err) {
        console.error("Failed to load previous visits:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patientId]);

  if (!patientId || patientId === "dummy-patient-id") return null;

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-bold text-sm text-text flex items-center gap-1.5">
          📜 Previous Patient Visits
          <Badge variant="primary" size="sm">{history.length}</Badge>
        </h3>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Spinner size="sm" label="Loading previous visits..." />
        </div>
      ) : history.length === 0 ? (
        <div className="text-xs text-text-muted text-center py-4">
          No prior visit notes found for this patient.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {history.map((note) => {
            const isExpanded = expandedId === (note.id || note._id);
            const formattedDate = new Date(note.createdAt || note.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={note.id || note._id}
                className="p-3 bg-surface-hover/60 rounded-lg border border-border text-xs space-y-2 hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text">{formattedDate}</span>
                  <Badge variant={note.status === "signed" ? "success" : "warning"} size="sm">
                    {note.status === "signed" ? "Signed" : "Draft"}
                  </Badge>
                </div>

                <div>
                  <span className="text-text-muted block font-medium">Chief Complaint:</span>
                  <p className="font-medium text-text line-clamp-2">
                    {note.subjective?.chiefComplaint || "Routine Consultation"}
                  </p>
                </div>

                {note.assessment?.diagnoses?.[0] && (
                  <div>
                    <span className="text-text-muted block font-medium">Diagnosis:</span>
                    <span className="font-semibold text-primary-600">
                      {note.assessment.diagnoses[0].description}
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : (note.id || note._id))}
                    className="text-[11px] text-primary-600 font-semibold hover:underline"
                  >
                    {isExpanded ? "Hide Details ▲" : "View Details ▼"}
                  </button>

                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onCopyForward(note)}
                    title="Copy chief complaint, diagnoses & Rx into current note"
                  >
                    📋 Copy Forward
                  </Button>
                </div>

                {isExpanded && (
                  <div className="pt-2 space-y-1.5 border-t border-border text-[11px] text-text-secondary bg-surface p-2 rounded">
                    {note.subjective?.historyOfPresentIllness && (
                      <div><b>HPI:</b> {note.subjective.historyOfPresentIllness}</div>
                    )}
                    {note.objective?.physicalExamination && (
                      <div><b>Exam:</b> {note.objective.physicalExamination}</div>
                    )}
                    {note.plan?.prescriptions && note.plan.prescriptions.length > 0 && (
                      <div>
                        <b>Prescribed Rx:</b>
                        <ul className="list-disc list-inside">
                          {note.plan.prescriptions.map((rx: any, idx: number) => (
                            <li key={idx}>{rx.name || rx.medicineName} — {rx.dosage} ({rx.duration})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
