"use client";

import { useState } from "react";
import { useEncounterContext } from "@/providers/EncounterProvider";
import { PatientHeader, PatientHeaderData } from "./PatientHeader";
import { PatientSearchModal } from "./PatientSearchModal";
import { LabStatusBadge, LabOrderStatus } from "./LabStatusBadge";
import { ReferenceRange } from "./ReferenceRange";
import { SOAPNoteEditor } from "./SOAPNoteEditor";
import { NEWS2Calculator } from "./NEWS2Calculator";
import { PatientTimeline } from "../ehr/PatientTimeline";
import { DoctorCopilotCard } from "./DoctorCopilotCard";
import { Tabs, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Select, Modal, useToast, Table, Spinner } from "@/components/ui";
import api from "@/lib/api";
import { OrdersService } from "@/services/orders.service";
import { Receipt, Megaphone, Plus, Activity, FileText, Clock, Layers } from "lucide-react";

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
    clinicId,
    doctorId,
    loading: contextLoading,
    orders,
    refreshOrders,
  } = useEncounterContext();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("soap");
  const { toast } = useToast();

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

  const [callingNext, setCallingNext] = useState(false);

  // Auto Charge Capture State
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargePreview, setChargePreview] = useState<any>(null);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const handleOpenChargePreview = async () => {
    if (!encounterId) {
      toast({ title: "No Encounter", description: "Encounter context is missing", variant: "error" });
      return;
    }
    setIsChargeModalOpen(true);
    setLoadingCharges(true);
    try {
      const res = await api.get(`/encounters/${encounterId}/charges-preview`);
      setChargePreview(res.data?.data || null);
    } catch (err: any) {
      toast({ title: "Preview Error", description: err.response?.data?.message || "Failed to load encounter charges", variant: "error" });
    } finally {
      setLoadingCharges(false);
    }
  };

  const handleGenerateInvoiceFromEncounter = async () => {
    if (!encounterId) return;
    setGeneratingInvoice(true);
    try {
      const res = await api.post(`/encounters/${encounterId}/auto-invoice`);
      const inv = res.data?.data;
      toast({ title: "Invoice Generated! 📄", description: `Created Invoice #${inv.invoiceNumber} for ₹${inv.totalAmount}`, variant: "success" });
      setIsChargeModalOpen(false);
    } catch (err: any) {
      toast({ title: "Generation Error", description: err.response?.data?.message || "Failed to generate invoice", variant: "error" });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleCallNextPatient = async () => {
    try {
      setCallingNext(true);
      const res = await api.post("/queue/call-next", { clinicId, doctorId });
      if (res.data?.data) {
        toast({ title: "Patient Called 🩺", description: res.data.message || `Token #${res.data.data.tokenNumber} in consultation`, variant: "success" });
        const apptId = res.data.data.id || res.data.data._id;
        const pId = typeof res.data.data.patientId === "object" ? (res.data.data.patientId.id || res.data.data.patientId._id) : res.data.data.patientId;
        window.location.href = `/dashboard/consultations/${apptId}?patientId=${pId}&clinicId=${clinicId || ""}`;
      } else {
        toast({ title: "Queue Empty", description: res.data?.message || "No waiting patients in queue for today", variant: "default" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to call next patient", variant: "error" });
    } finally {
      setCallingNext(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestId) return;
    setSubmittingOrder(true);
    try {
      await OrdersService.placeOrder({
        encounterId,
        patientId: patient.id,
        clinicId,
        doctorId,
        testId: selectedTestId,
        priority,
        clinicalReason,
      });
      toast({ title: "Order Placed", description: "Diagnostic lab order submitted successfully", variant: "success" });
      setIsOrderModalOpen(false);
      setSelectedTestId("");
      setClinicalReason("");
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Order Error", description: err.response?.data?.message || "Failed to place order", variant: "error" });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCollectSample = async (orderId: string) => {
    try {
      await OrdersService.collectSample(orderId);
      toast({ title: "Sample Collected", description: "Specimen draw recorded for lab tracking", variant: "success" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.response?.data?.message || "Failed to collect sample", variant: "error" });
    }
  };

  const handleMarkProcessing = async (orderId: string) => {
    try {
      await OrdersService.markProcessing(orderId);
      toast({ title: "Status Updated", description: "Order is now processing in lab", variant: "success" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.response?.data?.message || "Failed to update order", variant: "error" });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await OrdersService.cancelOrder(orderId);
      toast({ title: "Order Cancelled", description: "Diagnostic order cancelled", variant: "default" });
      refreshOrders();
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.response?.data?.message || "Failed to cancel order", variant: "error" });
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

      {/* Main Workspace Container */}
      <div className="p-4 max-w-7xl mx-auto w-full space-y-4">
        {/* ANANTA 20-Second Doctor Pre-Visit Briefing Card */}
        <DoctorCopilotCard patientName={patient.name} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs
            variant="pills"
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: "soap", label: "SOAP Note Editor", icon: <FileText className="w-4 h-4" /> },
              { id: "orders", label: `Diagnostic Orders (${orders.length})`, icon: <Activity className="w-4 h-4" /> },
              { id: "timeline", label: "EHR Timeline", icon: <Clock className="w-4 h-4" /> },
              { id: "news2", label: "NEWS2 Vitals Calculator", icon: <Activity className="w-4 h-4" /> },
            ]}
          />

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenChargePreview}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 mr-1.5 text-text-secondary" />
              Auto Charge Capture
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCallNextPatient}
              loading={callingNext}
              className="font-semibold rounded-xl shadow-xs"
            >
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              Call Next Patient
            </Button>
          </div>
        </div>

        {/* Tab 1: SOAP Note Editor */}
        {activeTab === "soap" && (
          <SOAPNoteEditor
            encounterId={encounterId}
            patientId={patient.id}
            clinicId={clinicId}
            doctorId={doctorId}
            initialNoteId={initialNoteId}
          />
        )}

        {/* Tab 2: Diagnostic Orders & Results */}
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

        {/* Tab 3: EHR Timeline */}
        {activeTab === "timeline" && (
          <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
            <PatientTimeline events={initialTimelineEvents} patientId={patient.id} />
          </div>
        )}

        {/* Tab 4: NEWS2 Monitoring Engine */}
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

      {/* Modal 3: Auto Charge Capture & Invoice Preview */}
      <Modal open={isChargeModalOpen} onClose={() => setIsChargeModalOpen(false)} title="Auto-Captured Encounter Charges & Invoice Preview" size="lg">
        <div className="space-y-4">
          {loadingCharges ? (
            <div className="py-12 text-center">
              <Spinner size="lg" label="Compiling consultation fees, lab orders & prescriptions..." />
            </div>
          ) : !chargePreview || !chargePreview.items || chargePreview.items.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              No billable items or orders found for this encounter session.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-surface-alt rounded-lg border border-border flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-text">Patient: {patient.name}</p>
                  <p className="text-text-secondary">Encounter ID: {encounterId}</p>
                </div>
                <Badge variant="primary">Auto-Compiled</Badge>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <Table
                  columns={[
                    {
                      key: "description",
                      header: "Item / Service",
                      render: (row: any) => (
                        <div>
                          <p className="font-semibold text-text text-xs">{row.description}</p>
                          <span className="text-[10px] text-text-muted uppercase tracking-wider">{row.category?.replace("_", " ")}</span>
                        </div>
                      ),
                    },
                    {
                      key: "hsnSacCode",
                      header: "SAC / HSN",
                      render: (row: any) => <span className="font-mono text-xs">{row.hsnSacCode}</span>,
                    },
                    {
                      key: "amount",
                      header: "Rate (₹)",
                      render: (row: any) => <span>₹{row.amount}</span>,
                    },
                    {
                      key: "quantity",
                      header: "Qty",
                      render: (row: any) => <span>{row.quantity}</span>,
                    },
                    {
                      key: "gstRate",
                      header: "GST %",
                      render: (row: any) => <span>{row.gstRate}%</span>,
                    },
                    {
                      key: "total",
                      header: "Line Total",
                      render: (row: any) => <span className="font-bold text-text">₹{(row.amount * row.quantity).toLocaleString("en-IN")}</span>,
                    },
                  ]}
                  data={chargePreview.items}
                />
              </div>

              <div className="p-4 bg-surface rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{chargePreview.subtotal?.toLocaleString("en-IN")}</span>
                </div>
                {chargePreview.cgstTotal > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>CGST:</span>
                    <span>₹{chargePreview.cgstTotal}</span>
                  </div>
                )}
                {chargePreview.sgstTotal > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>SGST:</span>
                    <span>₹{chargePreview.sgstTotal}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-text pt-2 border-t border-border">
                  <span>Total Amount Due:</span>
                  <span className="text-primary-600">₹{chargePreview.totalAmount?.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="flex justify-between border-t border-border pt-4 mt-4">
                <Button variant="outline" type="button" onClick={() => setIsChargeModalOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={handleGenerateInvoiceFromEncounter} loading={generatingInvoice}>
                  📄 Generate Official Invoice
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
