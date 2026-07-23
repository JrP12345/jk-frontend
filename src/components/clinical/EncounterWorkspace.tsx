"use client";

import { useState } from "react";
import { useEncounterContext } from "@/providers/EncounterProvider";
import { PatientHeader, PatientHeaderData } from "./PatientHeader";
import { PatientSearchModal } from "./PatientSearchModal";
import { LabStatusBadge, LabOrderStatus } from "./LabStatusBadge";
import { ReferenceRange } from "./ReferenceRange";
import { MARRow } from "./MARRow";
import { DischargeSummaryModal } from "./DischargeSummaryModal";
import { SOAPNoteEditor } from "./SOAPNoteEditor";
import { NEWS2Calculator } from "./NEWS2Calculator";
import { PatientTimeline } from "../ehr/PatientTimeline";
import { Tabs, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, DatePicker, Select, Modal, useToast, Table, Spinner } from "@/components/ui";
import { NEWS2Service } from "@/services/news2.service";
import { OrdersService } from "@/services/orders.service";
import { MARService } from "@/services/mar.service";
import { FHIRService } from "@/services/fhir.service";

interface EncounterWorkspaceProps {
  patient: PatientHeaderData;
  initialNoteId?: string;
  initialTimelineEvents?: any[];
}

export function EncounterWorkspace({
  patient,
  initialNoteId,
  initialTimelineEvents = [],
}: EncounterWorkspaceProps) {
  const {
    encounterId,
    patientId,
    clinicId,
    doctorId,
    loading: contextLoading,
    orders,
    marItems,
    scores,
    refreshOrders,
    refreshMAR,
    refreshScores,
  } = useEncounterContext();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("soap");
  const { toast } = useToast();

  // NEWS2 State
  const [spo2, setSpo2] = useState("98");
  const [hr, setHr] = useState("72");
  const [rr, setRr] = useState("16");
  const [temp, setTemp] = useState("36.8");
  const [sbp, setSbp] = useState("120");
  const [news2Score, setNews2Score] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Diagnostic Orders State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [priority, setPriority] = useState("routine");
  const [clinicalReason, setClinicalReason] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Result Modal State
  const [selectedOrderForResult, setSelectedOrderForResult] = useState<any | null>(null);
  const [resultVal, setResultVal] = useState("");
  const [resultUnit, setResultUnit] = useState("");
  const [resultRefRange, setResultRefRange] = useState("");
  const [resultInterpretation, setResultInterpretation] = useState("normal");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);

  // MAR Modal State
  const [isMarModalOpen, setIsMarModalOpen] = useState(false);
  const [marPrescriptionId, setMarPrescriptionId] = useState("");
  const [marRoute, setMarRoute] = useState("oral");
  const [marScheduledTime, setMarScheduledTime] = useState(new Date().toISOString().slice(0, 16));
  const [submittingMar, setSubmittingMar] = useState(false);

  // Export FHIR State
  const [exportingFhir, setExportingFhir] = useState(false);

  const handleScheduleMar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marPrescriptionId) {
      toast({ title: "Validation Error", description: "Please enter or select a Prescription ID", variant: "error" });
      return;
    }
    setSubmittingMar(true);
    try {
      await MARService.scheduleDose(encounterId, {
        prescriptionId: marPrescriptionId,
        route: marRoute,
        scheduledTime: marScheduledTime,
      });
      toast({ title: "MAR Dose Scheduled", description: "Scheduled dose added to MAR record", variant: "success" });
      setIsMarModalOpen(false);
      setMarPrescriptionId("");
      refreshMAR();
    } catch (err: any) {
      toast({ title: "Schedule Failed", description: err.response?.data?.message || "Failed to schedule MAR dose", variant: "error" });
    } finally {
      setSubmittingMar(false);
    }
  };

  const handleEvaluateNews2 = async () => {
    setEvaluating(true);
    try {
      const data = await NEWS2Service.evaluateScore(encounterId, "NEWS2");
      const scoreObj = data.score || data;
      setNews2Score(scoreObj);
      toast({
        title: "NEWS2 Evaluation Complete",
        description: `Score: ${scoreObj.totalScore || 0} (${scoreObj.riskCategory || "Low"} Risk)`,
        variant: scoreObj.riskCategory === "High" ? "error" : "success",
      });
      refreshScores();
    } catch (err: any) {
      toast({
        title: "Evaluation Error",
        description: err.response?.data?.message || err.message || "Failed to evaluate NEWS2 score",
        variant: "error",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestId) {
      toast({ title: "Validation Error", description: "Please select a diagnostic test", variant: "error" });
      return;
    }
    setSubmittingOrder(true);
    try {
      await OrdersService.placeOrder(encounterId, {
        patientId,
        testId: selectedTestId,
        priority,
        clinicalReason,
      });
      toast({ title: "Order Placed", description: "Diagnostic order placed successfully.", variant: "success" });
      setIsOrderModalOpen(false);
      setSelectedTestId("");
      setClinicalReason("");
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Order Failed", description: err.response?.data?.message || "Failed to place order", variant: "error" });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCollectSample = async (orderId: string) => {
    try {
      await OrdersService.collectSample(orderId);
      toast({ title: "Sample Collected", description: "Order status updated to sample-collected", variant: "success" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.response?.data?.message || "Failed to update order", variant: "error" });
    }
  };
  const handleMarkProcessing = async (orderId: string) => {
    try {
      await OrdersService.markProcessing(orderId);
      toast({ title: "Sample Processing", description: "Order status updated to processing", variant: "success" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.response?.data?.message || "Failed to mark order processing", variant: "error" });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt("Reason for order cancellation:", "Duplicate order");
    if (!reason) return;
    try {
      await OrdersService.cancelOrder(orderId, reason);
      toast({ title: "Order Cancelled", description: "Diagnostic order cancelled successfully", variant: "warning" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Cancellation Failed", description: err.response?.data?.message || "Failed to cancel order", variant: "error" });
    }
  };

  const handleRecordResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForResult) return;
    setSubmittingResult(true);
    try {
      await OrdersService.recordResult(selectedOrderForResult._id || selectedOrderForResult.id, {
        value: resultVal,
        unit: resultUnit,
        referenceRange: resultRefRange,
        interpretation: resultInterpretation,
        isAbnormal,
      });
      toast({ title: "Result Recorded", description: "Diagnostic lab result updated successfully", variant: "success" });
      setSelectedOrderForResult(null);
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Result Error", description: err.response?.data?.message || "Failed to record result", variant: "error" });
    } finally {
      setSubmittingResult(false);
    }
  };

  const handleExportFHIR = async () => {
    setExportingFhir(true);
    try {
      const bundle = await FHIRService.exportEncounterBundle(encounterId);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `fhir-encounter-${encounterId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast({
        title: "FHIR Export Complete",
        description: "Encounter FHIR R4 Bundle downloaded successfully.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.response?.data?.message || "Failed to export FHIR bundle",
        variant: "error",
      });
    } finally {
      setExportingFhir(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="py-20 text-center">
        <Spinner size="lg" label="Initializing clinical encounter workspace..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col">
      {/* Sticky Patient Context Banner */}
      <PatientHeader patient={patient} onOpenSearch={() => setIsSearchOpen(true)} />

      {/* Global Cmd+K Search Modal */}
      <PatientSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} patientId={patient.id} />

      {/* Main Workspace Navigation Tabs */}
      <div className="p-4 max-w-7xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: "soap", label: "SOAP Note Editor" },
              { id: "mar", label: "Medication Administration (MAR)" },
              { id: "orders", label: "Diagnostic Orders & Results" },
              { id: "discharge", label: "Discharge & Reconciliation" },
              { id: "timeline", label: "EHR Timeline" },
              { id: "news2", label: "NEWS2 Vitals Calculator" },
            ]}
          />

          <Button variant="outline" size="sm" onClick={handleExportFHIR} loading={exportingFhir}>
            ⚡ Export FHIR R4 Bundle
          </Button>
        </div>

        {/* Tab 1: SOAP Note Editor */}
        {activeTab === "soap" && (
          <div className="bg-surface rounded-xl border border-border shadow-sm p-2">
            <SOAPNoteEditor
              encounterId={encounterId}
              patientId={patient.id}
              clinicId={clinicId}
              doctorId={doctorId}
              initialNoteId={initialNoteId}
            />
          </div>
        )}

        {/* Tab 2: MAR Workflow */}
        {activeTab === "mar" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-border">
              <div>
                <h3 className="font-bold text-base text-text">Medication Administration Record (MAR)</h3>
                <p className="text-xs text-text-secondary">Verify 5 Rights of Medication Safety, check CDS warnings, and record administration</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setIsMarModalOpen(true)}>+ Schedule MAR Dose</Button>
                <Button size="sm" variant="secondary" onClick={refreshMAR}>Refresh MAR</Button>
              </div>
            </div>

            {marItems.length > 0 ? (
              <div className="space-y-3">
                {marItems.map((item) => (
                  <MARRow
                    key={item.id || item._id}
                    encounterId={encounterId}
                    patientId={patient.id}
                    clinicId={clinicId}
                    item={item}
                    onRefresh={refreshMAR}
                  />
                ))}
              </div>
            ) : (
              <Card><CardContent className="text-center py-8 text-text-muted text-sm">No scheduled medication doses for this encounter.</CardContent></Card>
            )}
          </div>
        )}

        {/* Tab 3: Diagnostic Orders & Results */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-border">
              <div>
                <h3 className="font-bold text-base text-text">Diagnostic Lab Orders</h3>
                <p className="text-xs text-text-secondary">Place and track diagnostic orders for this encounter</p>
              </div>
              <Button onClick={() => setIsOrderModalOpen(true)}>+ Place Diagnostic Order</Button>
            </div>

            {orders.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table
                    columns={[
                      { header: "Test Name", accessor: (row) => row.testId?.name || "Lab Test" },
                      { header: "Priority", accessor: (row) => <Badge variant={row.priority === "stat" ? "error" : "info"}>{row.priority?.toUpperCase() || "ROUTINE"}</Badge> },
                      { header: "Status", accessor: (row) => <LabStatusBadge status={row.status as LabOrderStatus} /> },
                      {
                        header: "Result / Actions",
                        accessor: (row) => (
                          <div className="flex items-center gap-2">
                            {row.result?.value ? (
                              <ReferenceRange
                                value={row.result.value}
                                unit={row.result.unit}
                                normalRange={row.result.referenceRange}
                                isAbnormal={row.result.isAbnormal}
                                interpretation={row.result.interpretation}
                              />
                            ) : row.status === "ordered" ? (
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleCollectSample(row._id || row.id)}>
                                  Collect Sample
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleCancelOrder(row._id || row.id)}>
                                  Cancel Order
                                </Button>
                              </div>
                            ) : row.status === "sample-collected" ? (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleMarkProcessing(row._id || row.id)}>
                                  Mark Processing
                                </Button>
                                <Button size="sm" onClick={() => {
                                  setSelectedOrderForResult(row);
                                  setResultVal("");
                                  setResultUnit("");
                                  setResultRefRange(row.testId?.normalRange || "");
                                }}>
                                  Record Result
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleCancelOrder(row._id || row.id)}>
                                  Cancel Order
                                </Button>
                              </div>
                            ) : row.status === "processing" ? (
                              <div className="flex gap-2 items-center">
                                <Button size="sm" onClick={() => {
                                  setSelectedOrderForResult(row);
                                  setResultVal("");
                                  setResultUnit("");
                                  setResultRefRange(row.testId?.normalRange || "");
                                }}>
                                  Record Result
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-muted italic">Completed</span>
                            )}
                          </div>
                        ),
                      },
                    ]}
                    data={orders}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="text-center py-8 text-text-muted text-sm">No diagnostic orders placed yet for this encounter.</CardContent></Card>
            )}
          </div>
        )}

        {/* Tab 4: Discharge Summary */}
        {activeTab === "discharge" && (
          <DischargeSummaryModal
            encounterId={encounterId}
            patientName={patient.name}
            mrn={patient.mrn}
            onDischargeSuccess={() => {}}
          />
        )}

        {/* Tab 5: EHR Timeline */}
        {activeTab === "timeline" && (
          <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
            <PatientTimeline events={initialTimelineEvents} patientId={patient.id} />
          </div>
        )}

        {/* Tab 6: NEWS2 Monitoring Engine */}
        {activeTab === "news2" && (
          <NEWS2Calculator encounterId={encounterId} patientId={patient.id} />
        )}
      </div>

      {/* Modal 1: Place Diagnostic Order */}
      <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Place Diagnostic Lab Order">
        <form onSubmit={handlePlaceOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Diagnostic Test ID or Code *</label>
            <Input
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              placeholder="e.g. CBC or Lipid Panel"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Priority</label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: "routine", label: "Routine" },
                { value: "urgent", label: "Urgent" },
                { value: "stat", label: "STAT (Emergency)" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Clinical Reason / Indication</label>
            <Input
              value={clinicalReason}
              onChange={(e) => setClinicalReason(e.target.value)}
              placeholder="e.g. Rule out acute infection"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOrderModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submittingOrder}>Place Order</Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Record Result */}
      <Modal isOpen={!!selectedOrderForResult} onClose={() => setSelectedOrderForResult(null)} title="Record Lab Test Result">
        <form onSubmit={handleRecordResult} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Result Value *</label>
            <Input
              value={resultVal}
              onChange={(e) => setResultVal(e.target.value)}
              placeholder="e.g. 12.5"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Unit</label>
            <Input
              value={resultUnit}
              onChange={(e) => setResultUnit(e.target.value)}
              placeholder="e.g. g/dL or mg/dL"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Reference Range</label>
            <Input
              value={resultRefRange}
              onChange={(e) => setResultRefRange(e.target.value)}
              placeholder="e.g. 12.0 - 16.0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSelectedOrderForResult(null)}>Cancel</Button>
            <Button type="submit" loading={submittingResult}>Save Result</Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Schedule MAR Dose */}
      <Modal isOpen={isMarModalOpen} onClose={() => setIsMarModalOpen(false)} title="Schedule MAR Dose">
        <form onSubmit={handleScheduleMar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Prescription ID or Medicine Name *</label>
            <Input
              value={marPrescriptionId}
              onChange={(e) => setMarPrescriptionId(e.target.value)}
              placeholder="e.g. 6a60a9702868a33a6fbbcb9e or Prescription ID"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Route of Administration</label>
            <Select
              value={marRoute}
              onChange={(e) => setMarRoute(e.target.value)}
              options={[
                { value: "oral", label: "Oral (PO)" },
                { value: "iv", label: "Intravenous (IV)" },
                { value: "im", label: "Intramuscular (IM)" },
                { value: "topical", label: "Topical" },
                { value: "inhaled", label: "Inhaled" },
                { value: "sublingual", label: "Sublingual" },
                { value: "rectal", label: "Rectal" },
              ]}
            />
          </div>
            <DatePicker
              label="Scheduled Date & Time"
              mode="datetime"
              value={marScheduledTime}
              onChange={(val) => setMarScheduledTime(typeof val === "string" ? val : val.target.value)}
            />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsMarModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submittingMar}>Schedule Dose</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
