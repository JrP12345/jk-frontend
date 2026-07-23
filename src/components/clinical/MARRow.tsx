"use client";

import { useState } from "react";
import { MedicationChip, MARStatus } from "./MedicationChip";
import { Button, Badge, Modal, Textarea, useToast } from "@/components/ui";
import { MARService } from "@/services/mar.service";
import { SOAPService } from "@/services/soap.service";

export interface MARItemData {
  id: string;
  medicationName: string;
  dosage: string;
  route: string;
  frequency: string;
  scheduledTime: string;
  status: MARStatus;
  notes?: string;
  administeredAt?: string;
  administeredBy?: string;
}

interface MARRowProps {
  encounterId: string;
  patientId: string;
  clinicId: string;
  item: MARItemData;
  onRefresh: () => void;
}

export function MARRow({ patientId, clinicId, item, onRefresh }: MARRowProps) {
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<MARStatus>("administered");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluatingCds, setEvaluatingCds] = useState(false);
  const [cdsWarnings, setCdsWarnings] = useState<string[]>([]);
  const { toast } = useToast();

  const handleEvaluateCds = async () => {
    setEvaluatingCds(true);
    try {
      const data = await SOAPService.evaluatePrescriptionSafety({
        patientId,
        clinicId,
        medicationName: item.medicationName,
      });
      const warnings = data.warnings || [];
      setCdsWarnings(warnings);
      if (warnings.length > 0) {
        toast({
          title: "CDS Safety Alert",
          description: `Detected ${warnings.length} drug interaction warning(s)`,
          variant: "warning",
        });
      } else {
        toast({
          title: "CDS Safety Check Clean",
          description: "No drug interactions detected",
          variant: "success",
        });
      }
    } catch {
      setCdsWarnings([]);
    } finally {
      setEvaluatingCds(false);
    }
  };

  const handleRecordAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const marId = item.id || (item as any)._id;
      if (targetStatus === "administered") {
        await MARService.administer(marId, notes);
      } else if (targetStatus === "refused") {
        await MARService.refuse(marId, notes || "Patient refused medication");
      } else if (targetStatus === "held") {
        await MARService.hold(marId, notes || "Held by clinician order");
      }
      toast({
        title: `Dose ${targetStatus.toUpperCase()}`,
        description: `Successfully updated ${item.medicationName} dose status.`,
        variant: targetStatus === "administered" ? "success" : "warning",
      });
      setIsActionModalOpen(false);
      setNotes("");
      onRefresh();
    } catch (err: any) {
      toast({
        title: "MAR Action Failed",
        description: err.response?.data?.message || "Failed to record MAR action",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Medication Details */}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-text">{item.medicationName}</h4>
            <Badge variant="primary">{item.dosage}</Badge>
            <Badge variant="neutral">{item.route}</Badge>
            <Badge variant="info">{item.frequency}</Badge>
            <MedicationChip status={item.status} administeredAt={item.administeredAt} notes={item.notes} />
          </div>
          <div className="text-xs text-text-secondary mt-1">
            <span><b>Scheduled Time:</b> {new Date(item.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {item.notes && <span className="ml-3 italic">&quot;{item.notes}&quot;</span>}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleEvaluateCds} loading={evaluatingCds}>
            CDS Safety Check
          </Button>

          {item.status === "scheduled" && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setTargetStatus("administered");
                  setIsActionModalOpen(true);
                }}
              >
                Administer
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTargetStatus("refused");
                  setIsActionModalOpen(true);
                }}
              >
                Refuse
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTargetStatus("held");
                  setIsActionModalOpen(true);
                }}
              >
                Hold
              </Button>
            </>
          )}
        </div>
      </div>

      {/* CDS Drug Interaction Warning Alert Box */}
      {cdsWarnings.length > 0 && (
        <div className="p-3 rounded-lg bg-warning-500/10 border border-warning-500/30 text-warning-700 dark:text-warning-300 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <svg className="h-4 w-4 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Clinical Decision Support Warning
          </div>
          {cdsWarnings.map((w, idx) => (
            <div key={idx} className="pl-5 font-medium">&bull; {w}</div>
          ))}
        </div>
      )}

      {/* Record Action Modal */}
      {isActionModalOpen && (
        <Modal
          isOpen={isActionModalOpen}
          onClose={() => setIsActionModalOpen(false)}
          title={`Record Medication Action (${targetStatus.toUpperCase()})`}
        >
          <form onSubmit={handleRecordAction} className="space-y-4">
            <div className="text-xs text-text-secondary">
              Recording <b>{targetStatus.toUpperCase()}</b> for <b>{item.medicationName} ({item.dosage})</b>.
            </div>

            <Textarea
              label="Clinical Notes / Justification"
              placeholder="e.g. Verified 5 Rights of Medication Safety. Patient tolerated dose well."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <Button type="submit" loading={loading} fullWidth variant={targetStatus === "administered" ? "primary" : "secondary"}>
              Confirm Action
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
