"use client";

import { useRouter } from "next/navigation";
import { confirmLeavingClinicalDraft } from "@/hooks/useUnsavedClinicalChanges";
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
import { VisitCompletion } from "./VisitCompletion";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { Alert, ConfirmDialog, Tabs, Card, CardContent, Badge, Button, Input, Select, useToast, Table, Skeleton } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import styles from "./EncounterWorkspace.module.css";
import api from "@/lib/api";
import { OrdersService } from "@/services/orders.service";
import { EncounterLabTestPicker } from "./EncounterLabTestPicker";
import { Receipt, Megaphone, Activity, FileText, Clock, Search } from "lucide-react";

interface EncounterWorkspaceProps {
  appointmentId?: string;
  appointmentStatus?: string;
  visitNotes?: string;
  focused?: boolean;
  patient: PatientHeaderData;
  initialNoteId?: string;
  initialNoteData?: any;
  initialTimelineEvents?: any[];
}

export function EncounterWorkspace({
  patient,
  initialNoteId,
  initialNoteData,
  initialTimelineEvents = [],
  appointmentId,
  appointmentStatus,
  visitNotes,
  focused = false,
}: EncounterWorkspaceProps) {
  const {
    encounterId,
    locationId,
    doctorId,
    loading: contextLoading,
    error: ordersError,
    orders,
    refreshOrders,
  } = useEncounterContext();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [visitCompleted, setVisitCompleted] = useState(appointmentStatus === "completed");
  const [activeTab, setActiveTab] = useState(initialNoteId ? "soap" : appointmentStatus === "completed" ? "timeline" : focused ? "visit" : "soap");
  const [hasSavedNote, setHasSavedNote] = useState(Boolean(initialNoteId));
  const [editorData, setEditorData] = useState(initialNoteData);
  const [soapOpened, setSoapOpened] = useState(Boolean(initialNoteId) || !focused);
  const user = useAuthStore(state => state.user);
  const canBill = hasAnyPermission(user, "MANAGE_BILLING");
  const canCallNext = hasAnyPermission(user, "MANAGE_QUEUE");
  const canManageOrders = hasAnyPermission(user, "MANAGE_ORDERS");
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
  const [resultInterpretation, setResultInterpretation] = useState("");
  const [submittingResult, setSubmittingResult] = useState(false);

  const [callingNext, setCallingNext] = useState(false);
  const [arrivalConfirmation, setArrivalConfirmation] = useState<{ id: string; tokenNumber?: number; justCompleted: boolean } | null>(null);

  // Auto Charge Capture State
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargePreview, setChargePreview] = useState<any>(null);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [customConsultFee, setCustomConsultFee] = useState<number | string>("");

  const handleOpenChargePreview = async (overrideFee?: number | React.MouseEvent) => {
    if (!encounterId) {
      toast({ title: "No Encounter", description: "Encounter context is missing", variant: "error" });
      return;
    }
    setIsChargeModalOpen(true);
    setLoadingCharges(true);
    const numericFee = typeof overrideFee === "number" ? overrideFee : undefined;
    try {
      const url = numericFee !== undefined
        ? `/encounters/${encounterId}/charges-preview?customConsultFee=${numericFee}`
        : `/encounters/${encounterId}/charges-preview`;
      const res = await api.get(url);
      setChargePreview(res.data?.data || null);
      if (numericFee === undefined && res.data?.data?.consultationFee !== undefined) {
        setCustomConsultFee(res.data.data.consultationFee);
      }
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
      const feeVal = customConsultFee !== "" ? Number(customConsultFee) : undefined;
      const res = await api.post(`/encounters/${encounterId}/auto-invoice`, {
        customConsultFee: feeVal,
      });
      const inv = res.data?.data;
      toast({ title: "Invoice Generated! 📄", description: `Created Invoice #${inv.invoiceNumber} for ₹${inv.totalAmount}`, variant: "success" });
      setIsChargeModalOpen(false);
    } catch (err: any) {
      toast({ title: "Generation Error", description: err.response?.data?.message || "Failed to generate invoice", variant: "error" });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const router = useRouter();
  const handleCallNextPatient = async (confirmedAppointmentId?: string, justCompleted = false) => {
    if (!justCompleted && !confirmLeavingClinicalDraft()) return;
    try {
      setCallingNext(true);
      const res = await api.post("/queue/call-next", { locationId, doctorId, requireArrivalConfirmation: true, confirmedAppointmentId });
      if (res.data?.data) {
        setArrivalConfirmation(null);
        toast({ title: "Patient Called 🩺", description: res.data.message || `Token #${res.data.data.tokenNumber} in consultation`, variant: "success" });
        const apptId = res.data.data.id || res.data.data._id;
        const pId = typeof res.data.data.patientId === "object" ? (res.data.data.patientId.id || res.data.data.patientId._id) : res.data.data.patientId;
        router.push(`/dashboard/consultations/${apptId}?patientId=${pId}&locationId=${locationId || ""}`);
      } else {
        toast({ title: "Queue Empty", description: res.data?.message || "No waiting patients in queue for today", variant: "default" });
      }
    } catch (err: any) {
      if ((err.response?.data?.error || err.response?.data?.details) === "ARRIVAL_CONFIRMATION_REQUIRED") {
        const candidate = err.response.data.data;
        if (candidate?.id) setArrivalConfirmation({ ...candidate, justCompleted });
        return;
      }
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
        locationId,
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
    if (!selectedOrderForResult || !resultInterpretation) return;
    setSubmittingResult(true);
    try {
      await OrdersService.recordResult(selectedOrderForResult._id || selectedOrderForResult.id, {
        value: resultVal,
        unit: resultUnit,
        referenceRange: resultRefRange,
        interpretation: resultInterpretation,
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

  const renderOrderActions = (row: any) => (
    <div className="flex items-center gap-2">
      {row.result?.value !== undefined && row.result?.value !== null && row.result?.value !== "" ? (
        <ReferenceRange
          value={row.result.value}
          unit={row.result.unit}
          normalRange={row.result.referenceRange}
          isAbnormal={row.result.isAbnormal}
          interpretation={row.result.interpretation}
        />
      ) : !canManageOrders ? <span className="text-xs text-text-muted">Read only</span> : row.status === "ordered" ? (
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
            setResultInterpretation("");
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
            setResultInterpretation("");
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

  );

  return (
    <div className={styles.workspace}>
      {/* Sticky Patient Context Banner */}
      <div className={styles.patientContext}><PatientHeader patient={patient} compactMrn /></div>

      {/* Global Cmd+K Search Modal */}
      <PatientSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} patientId={patient.id} />
      <ConfirmDialog open={Boolean(arrivalConfirmation)} title="Confirm patient arrival"
        description={arrivalConfirmation?.tokenNumber !== undefined ? `Token #${arrivalConfirmation.tokenNumber} has not checked in. Is this patient present and ready?` : "Is this patient present and ready?"}
        confirmLabel="Mark arrival and start" loading={callingNext}
        onClose={() => { if (!callingNext) setArrivalConfirmation(null); }}
        onConfirm={() => { if (arrivalConfirmation && !callingNext) void handleCallNextPatient(arrivalConfirmation.id, arrivalConfirmation.justCompleted); }} />

      {/* Main Workspace Container */}
      <div className={styles.body}>
        {/* Ekavyu 20-Second Doctor Pre-Visit Briefing Card */}
        {visitCompleted && <p className="text-sm text-text-muted" role="status">Visit completed. Review history or continue with billing and the next patient.</p>}
        <div className={styles.toolbar}>
          <Tabs
            variant="pills" className={styles.tabs} scrollActiveIntoView={false}
            activeTab={activeTab}
            onChange={tab => { if (tab === "soap") setSoapOpened(true); setActiveTab(tab); }}
            tabs={[
              ...(focused && appointmentId ? [{ id: "visit", label: "Visit", icon: <FileText className="w-4 h-4" /> }] : []),
              ...(!visitCompleted || hasSavedNote ? [{ id: "soap", label: "Notes", icon: <FileText className="w-4 h-4" /> }] : []),
              { id: "orders", label: "Orders", badge: contextLoading ? "…" : orders.length, icon: <Activity className="w-4 h-4" /> },
              { id: "timeline", label: "History", icon: <Clock className="w-4 h-4" /> },
              { id: "news2", label: "NEWS2", icon: <Activity className="w-4 h-4" /> },
            ]}
          />

          <div className={styles.tools}>
            <Button variant="outline" size="sm" aria-label="Search patient record" onClick={() => setIsSearchOpen(true)}><Search size={16} /></Button>
            {canBill && <Button
              variant="outline"
              size="sm"
              onClick={handleOpenChargePreview}
              className="flex-1 sm:flex-initial min-h-[40px] text-xs font-semibold shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 mr-1.5 text-text-secondary" />
              Charges
            </Button>}
            {canCallNext && <Button
              variant="primary"
              size="sm"
              onClick={() => handleCallNextPatient()}
              loading={callingNext}
              className="flex-1 sm:flex-initial min-h-[40px] font-semibold"
            >
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              Next patient
            </Button>}
          </div>
        </div>

        {/* Tab 1: SOAP Note Editor */}
        {focused && appointmentId && !hasSavedNote && !soapOpened && <div hidden={activeTab !== "visit"}><VisitCompletion appointmentId={appointmentId} encounterId={encounterId || undefined} doctorId={doctorId} initialNotes={visitNotes} completed={visitCompleted}
          onFullEditor={draft => {
            setEditorData({ subjective: { chiefComplaint: draft.symptoms, historyOfPresentIllness: draft.notes, symptoms: draft.symptoms ? [draft.symptoms] : [] },
              assessment: { diagnoses: draft.diagnosis ? [{ code: "CUSTOM", description: draft.diagnosis }] : [] },
              plan: { prescriptionIds: draft.medicines.map(medicine => ({ ...medicine, medicineName: medicine.name })) } });
            setSoapOpened(true); setActiveTab("soap");
          }}
          onCompleted={async next => { setVisitCompleted(true); if (next && canCallNext) await handleCallNextPatient(undefined, true); }} /></div>}
        {activeTab === "visit" && (hasSavedNote || soapOpened) && <Card className="p-4 space-y-3"><p className="text-sm">Continue this visit in the full clinical editor. Saved clinical documentation must be signed to complete.</p><Button variant="outline" onClick={() => setActiveTab("soap")}>Open full clinical editor</Button></Card>}
        {soapOpened && (!visitCompleted || hasSavedNote) && <div hidden={activeTab !== "soap"}>
          <SOAPNoteEditor
            encounterId={encounterId}
            patientId={patient.id}
            locationId={locationId}
            doctorId={doctorId}
            initialNoteId={initialNoteId}
            initialNoteData={editorData}
            onSaved={() => setHasSavedNote(true)}
            onSigned={() => setVisitCompleted(true)}
            appointmentId={appointmentId}
          />
        </div>}

        {/* Tab 2: Diagnostic Orders & Results */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {ordersError && <Alert variant="error" title="Lab orders unavailable" action={<Button variant="outline" onClick={() => void refreshOrders()}>Try again</Button>}>{ordersError}</Alert>}
            <div className={styles.sectionHeader}>
              <div>
                <h3>Lab orders</h3>
              </div>
              {canManageOrders && <Button onClick={() => setIsOrderModalOpen(true)}>+ Order test</Button>}
            </div>

            {contextLoading ? <div role="status" aria-label="Loading lab orders" className={styles.ordersLoading}><Skeleton height="80px" /><Skeleton height="80px" /></div> : orders.length > 0 ? (
              <Card padding="none" className={styles.orderList}>
                <CardContent className="p-0">
                  <Table
                    variant="flat" density="compact" fitContent pagination={false} showColumnVisibility={false} searchable={false}
                    columns={[
                      { header: "Test Name", accessor: (row) => row.testId?.name || "Lab Test" },
                      { header: "Priority", accessor: (row) => <Badge variant={row.priority === "stat" ? "error" : "info"}>{row.priority?.toUpperCase() || "ROUTINE"}</Badge> },
                      { header: "Status", accessor: (row) => <LabStatusBadge status={row.status as LabOrderStatus} /> },
                      {
                        header: "Result / Actions",
                        accessor: renderOrderActions,
                      },
                    ]}
                    renderMobileCard={row => <article className={styles.mobileOrder}><h3>{row.testId?.name || "Lab test"}</h3><div className={styles.orderMeta}><Badge size="sm" variant={row.priority === "stat" ? "error" : "neutral"}>{row.priority?.toUpperCase() || "ROUTINE"}</Badge><LabStatusBadge status={row.status as LabOrderStatus} /></div>{renderOrderActions(row)}</article>}
                    data={orders}
                  />
                </CardContent>
              </Card>
            ) : !ordersError ? (
              <Card><CardContent className="text-center py-8 text-text-muted text-sm">No diagnostic orders placed yet for this encounter.</CardContent></Card>
            ) : null}
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
        {(!focused || activeTab !== "visit") && <details className={styles.briefing}><summary>Pre-visit briefing</summary><DoctorCopilotCard patientName={patient.name} /></details>}
      </div>

      {/* Modal 1: Place Diagnostic Order */}
      <Modal isOpen={isOrderModalOpen} onClose={() => { if (!submittingOrder) setIsOrderModalOpen(false); }} title="Order test" busy={submittingOrder}
        footer={<><Button variant="outline" disabled={submittingOrder} onClick={() => setIsOrderModalOpen(false)}>Cancel</Button><Button type="submit" form="encounter-lab-order" loading={submittingOrder} disabled={!selectedTestId || !canManageOrders}>Place order</Button></>}>
        <form id="encounter-lab-order" onSubmit={handlePlaceOrder} className="space-y-4">
          <EncounterLabTestPicker key={locationId} locationId={locationId} value={selectedTestId} onChange={setSelectedTestId} disabled={submittingOrder} />
          <div>
            <label htmlFor="encounter-test-priority" className="block text-xs font-semibold text-text-secondary mb-1">Priority</label>
            <Select
              id="encounter-test-priority" value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: "routine", label: "Routine" },
                { value: "urgent", label: "Urgent" },
                { value: "stat", label: "STAT (Emergency)" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="encounter-test-reason" className="block text-xs font-semibold text-text-secondary mb-1">Reason</label>
            <Input
              id="encounter-test-reason" value={clinicalReason}
              onChange={(e) => setClinicalReason(e.target.value)}
              placeholder="e.g. Rule out acute infection"
            />
          </div>

        </form>
      </Modal>

      {/* Modal 2: Record Result */}
      <Modal isOpen={!!selectedOrderForResult} onClose={() => { if (!submittingResult) setSelectedOrderForResult(null); }} title="Record result" busy={submittingResult}
        footer={<><Button variant="outline" disabled={submittingResult} onClick={() => setSelectedOrderForResult(null)}>Cancel</Button><Button type="submit" form="encounter-lab-result" loading={submittingResult} disabled={!resultInterpretation || !resultVal.trim()}>Save result</Button></>}>
        <form id="encounter-lab-result" onSubmit={handleRecordResult} className="space-y-4">
          <div>
            <label htmlFor="encounter-result-value" className="block text-xs font-semibold text-text-secondary mb-1">Result Value *</label>
            <Input
              id="encounter-result-value" value={resultVal}
              onChange={(e) => setResultVal(e.target.value)}
              placeholder="e.g. 12.5"
              required
            />
          </div>
          <div>
            <label htmlFor="encounter-result-unit" className="block text-xs font-semibold text-text-secondary mb-1">Unit</label>
            <Input
              id="encounter-result-unit" value={resultUnit}
              onChange={(e) => setResultUnit(e.target.value)}
              placeholder="e.g. g/dL or mg/dL"
            />
          </div>
          <div>
            <label htmlFor="encounter-result-range" className="block text-xs font-semibold text-text-secondary mb-1">Reference Range</label>
            <Input
              id="encounter-result-range" value={resultRefRange}
              onChange={(e) => setResultRefRange(e.target.value)}
              placeholder="e.g. 12.0 - 16.0"
            />
          </div>
          <Select label="Interpretation *" value={resultInterpretation} required onChange={event => setResultInterpretation(event.target.value)}
            options={[{ value: "", label: "Choose interpretation" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }, { value: "indeterminate", label: "Indeterminate" }]} />
        </form>
      </Modal>

      {/* Modal 3: Auto Charge Capture & Invoice Preview */}
      <Modal
        open={isChargeModalOpen}
        onClose={() => { if (!generatingInvoice) setIsChargeModalOpen(false); }}
        title="Encounter charges"
        busy={generatingInvoice}
        footer={<><Button variant="outline" disabled={generatingInvoice} onClick={() => setIsChargeModalOpen(false)}>Close</Button><Button onClick={handleGenerateInvoiceFromEncounter} loading={generatingInvoice} disabled={loadingCharges || !chargePreview?.items?.length}>Generate invoice</Button></>}
        size="lg"
        loading={loadingCharges}
        loadingText="Compiling consultation fees, lab orders & prescriptions..."
      >
        <div className="space-y-4">
          {!chargePreview || !chargePreview.items || chargePreview.items.length === 0 ? (
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

              {chargePreview.isFeeEditable && (
                <div className="p-3.5 bg-warning/10 border border-warning/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-warning-text dark:text-warning-text flex items-center gap-1.5">
                      <span>🩺 Post-Consultation Physician Fee</span>
                      <Badge variant="warning" size="sm" className="text-[10px]">
                        {chargePreview.feeType === "post_consultation" ? "Variable Fee Mode" : "Adjustable"}
                      </Badge>
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Specify the consultation charge for this encounter before generating the invoice.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-text">₹</span>
                    <Input type="number" min={0} value={customConsultFee} onChange={(e) => setCustomConsultFee(e.target.value)} onBlur={(e) => handleOpenChargePreview(Number(e.target.value) || 0)} placeholder="Fee (₹)" fullWidth={false} containerClassName="w-28" size="sm" />
                    <Button
                      size="xs"
                      variant="outline"
                      type="button"
                      onClick={() => handleOpenChargePreview(Number(customConsultFee) || 0)}
                      className="text-xs font-semibold"
                    >
                      Update
                    </Button>
                  </div>
                </div>
              )}

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
                  <span className="text-accent">₹{chargePreview.totalAmount?.toLocaleString("en-IN")}</span>
                </div>
              </div>


            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
