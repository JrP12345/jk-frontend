"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Modal, Button, Badge, Spinner, cn } from "@/components/ui";
import {
  FlaskConical,
  TrendingDown,
  TrendingUp,
  FileText,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Calendar,
  User,
  Minus,
  Volume2,
} from "lucide-react";
import { useToast } from "@/components/ui";

export interface InvestigationResultItem {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  isPanic?: boolean;
  resultNotes?: string;
  attachmentUrl?: string;
  resultedAt?: string;
}

export interface InCabinInvestigationViewerModalProps {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  tokenNumber?: number;
  appointmentId?: string;
  initialInvestigationResults?: InvestigationResultItem[];
  initialResults?: InvestigationResultItem[];
  onInsertIntoNote?: (textSummary: string) => void;
  onRecalled?: () => void;
}

export function InCabinInvestigationViewerModal({
  open,
  onClose,
  patientId,
  patientName = "Patient",
  tokenNumber,
  appointmentId,
  initialInvestigationResults = [],
  initialResults = [],
  onInsertIntoNote,
  onRecalled,
}: InCabinInvestigationViewerModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [selectedTestName, setSelectedTestName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const activeInitial = initialResults.length > 0 ? initialResults : initialInvestigationResults;

  useEffect(() => {
    if (!open || !patientId) return;

    const fetchComparison = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/lab/patient/${patientId}/comparison`);
        if (res.data?.data) {
          setComparisonData(res.data.data);
          const testKeys = Object.keys(res.data.data.tests || {});
          if (testKeys.length > 0) {
            setSelectedTestName(testKeys[0]);
          }
        }
      } catch (err) {
        console.warn("Could not fetch historical lab comparisons, falling back to current results:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [open, patientId]);

  // Fallback map if API returns empty
  const testsFromInitial: Record<string, any> = {};
  for (const item of activeInitial) {
    if (!testsFromInitial[item.testName]) {
      testsFromInitial[item.testName] = {
        testName: item.testName,
        latest: {
          value: item.value,
          unit: item.unit || "",
          referenceRange: item.referenceRange || "",
          isAbnormal: item.isAbnormal || false,
          notes: item.resultNotes || "",
          attachmentUrl: item.attachmentUrl || "",
          date: item.resultedAt || new Date().toISOString(),
        },
        previous: null,
        delta: null,
        trend: "stable",
        history: [
          {
            value: item.value,
            unit: item.unit || "",
            referenceRange: item.referenceRange || "",
            isAbnormal: item.isAbnormal || false,
            notes: item.resultNotes || "",
            attachmentUrl: item.attachmentUrl || "",
            date: item.resultedAt || new Date().toISOString(),
          },
        ],
      };
    }
  }

  const activeTests = comparisonData?.tests && Object.keys(comparisonData.tests).length > 0
    ? comparisonData.tests
    : testsFromInitial;

  const testNames = Object.keys(activeTests);
  const activeTest = selectedTestName && activeTests[selectedTestName]
    ? activeTests[selectedTestName]
    : testNames.length > 0
    ? activeTests[testNames[0]]
    : null;

  const latestReading = activeTest?.latest;
  const prevReading = activeTest?.previous;
  const historyList = activeTest?.history || [];

  const handleCopySummary = () => {
    if (!activeTest) return;
    const l = activeTest.latest;
    let summary = `[LAB REPORT] ${activeTest.testName}: ${l.value} ${l.unit || ""}`.trim();
    if (l.referenceRange) summary += ` (Ref: ${l.referenceRange})`;
    if (l.isAbnormal) summary += ` [ABNORMAL]`;
    if (activeTest.delta !== null && activeTest.previous) {
      summary += ` | Prior: ${activeTest.previous.value} ${activeTest.previous.unit || ""} (Delta: ${activeTest.delta > 0 ? "+" : ""}${activeTest.delta})`;
    }
    if (l.notes) summary += ` | Note: ${l.notes}`;

    navigator.clipboard?.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    if (onInsertIntoNote) {
      onInsertIntoNote(summary);
    }
  };

  const handleRecallToCabin = async () => {
    if (!appointmentId) return;
    try {
      setRecalling(true);
      const res = await api.post(`/queue/${appointmentId}/resume-review`);
      toast({
        title: "Patient Recalled to Cabin 🔔",
        description: res.data?.message || `Token #${tokenNumber} called back for report review. TV lounge chime announced.`,
        variant: "success",
      });
      onRecalled?.();
      onClose();
    } catch (err: any) {
      toast({
        title: "Recall Failed",
        description: err.response?.data?.message || "Could not recall patient to cabin.",
        variant: "error",
      });
    } finally {
      setRecalling(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="In-Cabin Diagnostic Report & Trend Viewer"
      description={`Structured parameter values, attached lab PDF scans, and longitudinal patient comparisons for ${patientName} ${tokenNumber ? `(Token #${tokenNumber})` : ""}`}
      size="xl"
    >
      <div className="space-y-4 pt-1 font-sans text-xs">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Spinner size="lg" />
            <p className="font-medium text-xs">Loading laboratory investigations & chronological comparison...</p>
          </div>
        ) : testNames.length === 0 ? (
          <div className="py-12 text-center text-text-muted space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-purple-500">
              <FlaskConical className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-text">No Diagnostic Results Found</p>
            <p className="text-xs">No completed laboratory reports were found for this patient.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Sidebar: Investigation Tests List */}
            <div className="md:col-span-4 space-y-2 border-r border-border/60 pr-3 max-h-[62vh] overflow-y-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Ordered Tests ({testNames.length})
              </span>
              <div className="space-y-1.5">
                {testNames.map((name) => {
                  const item = activeTests[name];
                  const isSelected = selectedTestName === name || (!selectedTestName && testNames[0] === name);
                  const isAbnormal = item.latest?.isAbnormal;

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedTestName(name)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1",
                        isSelected
                          ? "bg-purple-500/15 border-purple-500/50 shadow-xs"
                          : "bg-surface-alt hover:bg-surface border-border/80 text-text-secondary"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs truncate text-text">{name}</span>
                        {isAbnormal ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 shrink-0">
                            Abnormal
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0">
                            Normal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-text">
                          {item.latest?.value} {item.latest?.unit || ""}
                        </span>
                        {item.delta !== null && (
                          <span
                            className={cn(
                              "text-[10px] font-semibold inline-flex items-center gap-0.5",
                              item.trend === "improved"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : item.trend === "worsened"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-text-muted"
                            )}
                          >
                            {item.delta < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : item.delta > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <Minus className="w-3 h-3" />
                            )}
                            {item.delta > 0 ? `+${item.delta}` : item.delta}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Main Area: Selected Test Details, Report Attachment & 1-Click Comparison */}
            <div className="md:col-span-8 space-y-4 max-h-[62vh] overflow-y-auto pl-1 pr-1">
              {activeTest && latestReading && (
                <>
                  {/* Critical Panic Alert Banner (if applicable) */}
                  {(latestReading.notes?.includes("CRITICAL PANIC") ||
                    latestReading.notes?.toLowerCase().includes("panic") ||
                    latestReading.value?.toLowerCase().includes("critical") ||
                    (latestReading.isAbnormal && (activeTest.testName.toLowerCase().includes("troponin") || Number(latestReading.value) > 400))) && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-pulse shadow-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        🚨 <strong>CRITICAL PANIC VALUE ALERT:</strong> Immediate Clinical Review & Cabin Recall Advised ({latestReading.notes || latestReading.value})
                      </span>
                    </div>
                  )}

                  {/* Test Header & Latest Value Card */}
                  <div className="p-3.5 rounded-2xl bg-surface-alt border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-text">{activeTest.testName}</h4>
                        {latestReading.isAbnormal ? (
                          <Badge variant="danger" size="sm" className="font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Abnormal Flag
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm" className="font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Within Normal Limits
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Reference Range: <strong className="text-text">{latestReading.referenceRange || "Standard Reference"}</strong>
                        {latestReading.date && (
                          <span> &bull; Resulted: {new Date(latestReading.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        )}
                      </p>
                    </div>

                    <div className="text-right sm:border-l sm:border-border/60 sm:pl-4 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Latest Reading</span>
                      <span className="text-lg font-bold font-mono text-text leading-tight">
                        {latestReading.value} <span className="text-xs font-normal text-text-secondary">{latestReading.unit || ""}</span>
                      </span>
                    </div>
                  </div>

                  {/* Technician Notes (if any) */}
                  {latestReading.notes && (
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60 text-text-secondary text-[11px] flex items-start gap-2">
                      <FileText className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-text">Technician Remarks:</strong> {latestReading.notes}
                      </div>
                    </div>
                  )}

                  {/* Official Attached PDF / Scan Report Preview */}
                  {latestReading.attachmentUrl && (
                    <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          Diagnostic Lab Report Document Attached
                        </span>
                        <a
                          href={latestReading.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-xl bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-700 transition-colors inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open Full Report
                        </a>
                      </div>

                      {latestReading.attachmentUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                        <div className="mt-2 rounded-xl overflow-hidden border border-border bg-surface max-h-48 flex items-center justify-center">
                          <img
                            src={latestReading.attachmentUrl}
                            alt="Lab Report Scan"
                            className="max-h-48 object-contain w-full"
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-purple-800 dark:text-purple-300">
                          Official PDF document uploaded by lab. Click above to view or download full diagnostic sheet.
                        </p>
                      )}
                    </div>
                  )}

                  {/* 1-Click Longitudinal Comparison & Trend Table */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <h5 className="font-bold text-xs text-text">Historical Parameter Comparison</h5>
                        <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                          {historyList.length} reading{historyList.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      {activeTest.delta !== null && prevReading && (
                        <div className="text-[11px] font-bold text-text-secondary">
                          Delta vs Prior:{" "}
                          <span
                            className={cn(
                              "font-mono px-1.5 py-0.5 rounded",
                              activeTest.trend === "improved"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : activeTest.trend === "worsened"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                : "bg-surface-alt text-text"
                            )}
                          >
                            {activeTest.delta > 0 ? `+${activeTest.delta}` : activeTest.delta} {latestReading.unit || ""}
                            {activeTest.percentChange !== null && ` (${activeTest.percentChange > 0 ? "+" : ""}${activeTest.percentChange}%)`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border border-border/80 rounded-xl overflow-hidden bg-surface">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-alt border-b border-border/80 text-text-muted font-bold text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Result Value</th>
                            <th className="py-2 px-3">Reference Range</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Report</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {historyList.map((item: any, idx: number) => {
                            const isLatest = idx === 0;
                            return (
                              <tr
                                key={idx}
                                className={cn(
                                  "hover:bg-surface-hover/50 transition-colors",
                                  isLatest && "bg-purple-500/5 font-medium"
                                )}
                              >
                                <td className="py-2 px-3 text-text font-mono text-[11px]">
                                  {item.date ? new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent"}
                                  {isLatest && <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold uppercase">Latest</span>}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-text">
                                  {item.value} {item.unit || ""}
                                </td>
                                <td className="py-2 px-3 text-text-muted text-[11px]">
                                  {item.referenceRange || "Standard"}
                                </td>
                                <td className="py-2 px-3">
                                  {item.isAbnormal ? (
                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                      Abnormal
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      Normal
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {item.attachmentUrl ? (
                                    <a
                                      href={item.attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary-600 hover:text-primary-700 text-[11px] font-medium inline-flex items-center gap-1"
                                    >
                                      <FileText className="w-3 h-3" /> View
                                    </a>
                                  ) : (
                                    <span className="text-text-muted/40 text-[11px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            disabled={!activeTest}
            className="font-bold text-xs rounded-xl border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Copied / Inserted into Note!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                1-Click Insert into Visit Note
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {appointmentId && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleRecallToCabin}
                loading={recalling}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                Recall Patient to Cabin (Chime)
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-semibold text-xs rounded-xl"
            >
              Close Viewer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
