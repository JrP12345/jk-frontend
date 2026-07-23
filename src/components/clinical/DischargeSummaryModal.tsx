"use client";

import { useState } from "react";
import { Button, Input, DatePicker, Textarea, Badge, useToast, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { DischargeService } from "@/services/discharge.service";

interface DischargeSummaryModalProps {
  encounterId: string;
  patientName: string;
  mrn?: string;
  onDischargeSuccess: (summary: any) => void;
}

export function DischargeSummaryModal({
  encounterId,
  patientName,
  mrn,
  onDischargeSuccess,
}: DischargeSummaryModalProps) {
  const [summaryNarrative, setSummaryNarrative] = useState("");
  const [dischargeInstructions, setDischargeInstructions] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [dischargeResult, setDischargeResult] = useState<any | null>(null);
  const { toast } = useToast();

  const handleFinalizeDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryNarrative.trim()) {
      toast({ title: "Validation Error", description: "Discharge narrative summary is required.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Compile draft discharge document
      const draftDoc = await DischargeService.compileSummary(encounterId);
      const docId = draftDoc.id || draftDoc._id;

      // Step 2: Finalize discharge summary with clinician input
      const summaryData = await DischargeService.finalizeSummary(docId, {
        summaryNarrative,
        dischargeInstructions,
        followupDate,
      });

      setDischargeResult(summaryData);
      toast({
        title: "Discharge Finalized",
        description: `Encounter closed. Cryptographic Hash: ${summaryData.documentHash?.substring(0, 10)}...`,
        variant: "success",
      });
      onDischargeSuccess(summaryData);
    } catch (err: any) {
      toast({
        title: "Discharge Error",
        description: err.response?.data?.message || err.message || "Failed to finalize discharge",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-lg border-border">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Inpatient Discharge Summary & Reconciliation</CardTitle>
          {mrn && <Badge variant="neutral">MRN: {mrn}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {dischargeResult ? (
          <div className="space-y-4 animate-fade-up">
            <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/30 text-success-800 dark:text-success-200 text-xs space-y-2">
              <div className="font-bold text-sm flex items-center gap-2">
                <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                Encounter Successfully Closed & Immutable Lock Applied
              </div>
              <div><b>Patient:</b> {patientName}</div>
              <div><b>Finalized Date:</b> {new Date(dischargeResult.finalizedAt || Date.now()).toLocaleString()}</div>
              <div><b>SHA-256 Digest Hash:</b> <code className="bg-surface px-2 py-0.5 rounded font-mono text-[11px]">{dischargeResult.documentHash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}</code></div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => window.location.href = "/dashboard/appointments"}
                >
                  ← Return to Appointments & Queue
                </Button>
              </div>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border space-y-2 text-xs">
              <div className="font-bold text-text">Discharge Narrative Summary</div>
              <p className="text-text-secondary whitespace-pre-wrap">{dischargeResult.summaryNarrative || summaryNarrative}</p>
            </div>

            {dischargeResult.countersignedAt ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Countersigned by Attending Physician at {new Date(dischargeResult.countersignedAt).toLocaleString()}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await DischargeService.countersignSummary(dischargeResult.id || dischargeResult._id);
                    setDischargeResult(res);
                    toast({ title: "Countersigned", description: "Discharge summary countersigned successfully.", variant: "success" });
                  } catch (err: any) {
                    toast({ title: "Countersign Failed", description: err.response?.data?.message || "Failed to countersign", variant: "error" });
                  }
                }}
              >
                ✍ Countersign Discharge Summary
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleFinalizeDischarge} className="space-y-4">
            <Textarea
              label="Clinical Discharge Summary Narrative"
              placeholder="Summarize course of treatment, hospital stay findings, and clinical resolution..."
              value={summaryNarrative}
              onChange={(e) => setSummaryNarrative(e.target.value)}
              rows={4}
              required
            />

            <Textarea
              label="Discharge Medication & Follow-up Instructions"
              placeholder="e.g. Continue Amoxicillin 500mg PO Q8H for 5 days. Follow up in Outpatient Clinic in 2 weeks."
              value={dischargeInstructions}
              onChange={(e) => setDischargeInstructions(e.target.value)}
              rows={3}
            />

            <DatePicker
              label="Scheduled Follow-up Date"
              value={followupDate}
              minDate={new Date()}
              onChange={(val) => setFollowupDate(typeof val === "string" ? val : val.target.value)}
            />

            <Button type="submit" loading={loading} fullWidth variant="primary" size="lg">
              Finalize Discharge & Lock Encounter
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
