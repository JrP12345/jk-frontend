"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { PatientService } from "@/services/patient.service";
import { Alert, Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Table, Column, Spinner, Skeleton, Tabs, Input, Textarea, Select, useToast, DatePicker } from "@/components/ui";
import dynamic from "next/dynamic";
import Modal from "@/components/queue/QueueDialog";
import { ArrowLeft, CalendarPlus, Pencil, RotateCw } from "lucide-react";
import styles from "./PatientProfile.module.css";
import PatientHistoryAccess from "@/components/ehr/PatientHistoryAccess";
import { PatientHeader } from "@/components/clinical/PatientHeader";
import { PatientOverviewCards } from "@/components/clinical/PatientOverviewCards";
import { PatientIdentityControls } from "@/components/patients/PatientIdentityControls";
import { PatientPrivacyControls } from "@/components/patients/PatientPrivacyControls";
import { PatientRelationshipPanel } from "@/components/patients/PatientRelationshipPanel";

const PatientTimeline = dynamic(
  () => import("@/components/ehr/PatientTimeline").then((mod) => mod.PatientTimeline),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-text-muted space-y-2">
        <Spinner size="md" className="mx-auto" />
        <p className="text-xs">Loading EHR medical timeline...</p>
      </div>
    ),
  }
);

const PatientMedicalRecords = dynamic(
  () => import("@/components/ehr/PatientMedicalRecords").then((mod) => mod.PatientMedicalRecords),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-text-muted space-y-2">
        <Spinner size="md" className="mx-auto" />
        <p className="text-xs">Loading health documents & records...</p>
      </div>
    ),
  }
);

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const patientId = params.id as string;

  const canManagePatients = hasAnyPermission(user, "MANAGE_PATIENTS");
  const canEditClinical = hasAnyPermission(user, "MANAGE_EHR", "MANAGE_CLINICAL_NOTES");
  const canReadClinical = hasAnyPermission(user, "VIEW_EHR");
  const canReadBilling = hasAnyPermission(user, "VIEW_BILLING", "MANAGE_BILLING");
  const canReadAccess = canReadClinical || hasAnyPermission(user, "MANAGE_PATIENTS", "REVIEW_PATIENT_IDENTITY", "RECORD_COMMUNICATION_CONSENT", "ADMINISTRATIVE_GOVERNANCE", "EXPORT_CRM", "VIEW_CRM") || ["patient", "family_member"].includes(user?.role || "");

  const [patientData, setPatientData] = useState<any>(null);
  const profileScope = JSON.stringify([patientId, user?.id, user?.organization_id]);
  const [loadedProfileScope, setLoadedProfileScope] = useState("");
  const profileReady = loadedProfileScope === profileScope;
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [labError, setLabError] = useState(false);
  const [billingError, setBillingError] = useState(false);
  const [recordAccessToken, setRecordAccessToken] = useState<string | null>(null);
  const profileRequest = useRef(0);
  const changeRecordAccess = useCallback((token: string | null) => {
    setRecordAccessToken(token);
    if (!token && user?.organization_id && !["patient", "family_member"].includes(user.role)) {
      setPatientData((current: any) => {
        if (!current || !current.organizationId || String(current.organizationId) === user.organization_id) return current;
        const scoped = { ...current, clinicalProfileRestricted: true };
        for (const field of ["allergies", "conditions", "medicalNotes", "insurancePolicies", "careContexts"]) delete scoped[field];
        return scoped;
      });
      setEditModalOpen(false);
      setEditForm((current) => ({ ...current, allergies: "", conditions: "", medicalNotes: "" }));
      setAppointments((current) => current.filter((appointment) => String(appointment.organizationId) === user.organization_id));
    }
  }, [user?.id, user?.organization_id, user?.role]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Edit Profile Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    dob: "",
    gender: "male",
    bloodGroup: "",
    address: "",
    allergies: "",
    conditions: "",
    medicalNotes: "",
    abdmHealthId: "",
  });

  const loadPatientDetails = async () => {
    const requestId = ++profileRequest.current;
    try {
      setLoading(true);
      setLoadError(null);
      const response = await api.get(`/patients/${patientId}${recordAccessToken ? "?scope=all" : ""}`, { headers: recordAccessToken ? { "X-Patient-Record-Access": recordAccessToken } : {} });
      if (requestId !== profileRequest.current) return;
      const res = response.data.data;
      const patient = res.patient || res;
      const appts = res.appointments || [];

      setPatientData(patient);
      setLoadedProfileScope(profileScope);
      setAppointments(appts);

      // Populate edit form defaults
      const userName = patient.name || patient.userId?.name || "";
      const userPhone = patient.phone || patient.userId?.phone || "";
      setEditForm({
        name: userName,
        phone: userPhone,
        dob: patient.dob ? new Date(patient.dob).toISOString().split("T")[0] : "",
        gender: patient.gender || "male",
        bloodGroup: patient.bloodGroup || "",
        address: patient.address || "",
        allergies: (patient.allergies || []).join(", "),
        conditions: (patient.conditions || []).join(", "),
        medicalNotes: patient.medicalNotes || "",
        abdmHealthId: patient.abdmHealthId || "",
      });

      // Auxiliary failures stay distinct from an empty clinical or billing history.
      setSecondaryLoading(true); setLabError(false); setBillingError(false);
      Promise.allSettled([
        canReadClinical ? api.get("/lab-orders?patientId=" + encodeURIComponent(patientId)) : Promise.resolve({ data: { data: [] } }),
        canReadBilling ? api.get("/invoices?patientId=" + encodeURIComponent(patientId)) : Promise.resolve({ data: { data: [] } }),
      ]).then(([labRes, invRes]) => {
        if (requestId !== profileRequest.current) return;
        if (labRes.status === "fulfilled") { const labs = labRes.value.data?.data; if (Array.isArray(labs)) setLabOrders(labs.filter((lab: any) => String(lab.patientId?.id || lab.patientId?._id || lab.patientId) === String(patientId))); else setLabError(true); } else setLabError(true);
        if (invRes.status === "fulfilled") { const bills = invRes.value.data?.data; if (Array.isArray(bills)) setInvoices(bills.filter((invoice: any) => String(invoice.patientId?.id || invoice.patientId?._id || invoice.patientId) === String(patientId))); else setBillingError(true); } else setBillingError(true);
        setSecondaryLoading(false);
      });

    } catch (err: any) {
      if (requestId !== profileRequest.current) return;
      setLoadError("The patient record could not be loaded. Check your connection or access and try again.");
      toast({
        title: "Failed to Load Patient Profile",
        description: err.response?.data?.message || err.message || "Patient record not found",
        variant: "error",
      });
    } finally {
      if (requestId === profileRequest.current) setLoading(false);
    }
  };

  useEffect(() => { setPatientData(null); setAppointments([]); setLabOrders([]); setInvoices([]); setRecordAccessToken(null); setActiveTab("overview"); setEditModalOpen(false); }, [patientId, user?.id, user?.organization_id]);

  useEffect(() => {
    if (patientId) {
      loadPatientDetails();
    }
    return () => { profileRequest.current += 1; };
  }, [patientId, recordAccessToken, user?.id, user?.organization_id, canReadClinical, canReadBilling]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading || !canManagePatients) return;
    try {
      setEditLoading(true);
      const payload = {
        name: editForm.name,
        dob: editForm.dob || undefined,
        gender: editForm.gender,
        address: editForm.address,
        ...(canEditClinical ? {
        bloodGroup: editForm.bloodGroup || undefined,
        allergies: editForm.allergies ? editForm.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
        conditions: editForm.conditions ? editForm.conditions.split(",").map((s) => s.trim()).filter(Boolean) : [],
        medicalNotes: editForm.medicalNotes,
        abdmHealthId: editForm.abdmHealthId || undefined,
        } : {}),
      };

      await PatientService.updatePatientProfile(patientId, payload);
      toast({
        title: "Profile Updated",
        description: "Patient profile and demographics saved successfully.",
        variant: "success",
      });
      setEditModalOpen(false);
      loadPatientDetails();
    } catch (err: any) {
      toast({
        title: "Unable to Save Profile",
        description: err.response?.data?.message || "Could not update patient demographics. Please try again.",
        variant: "error",
      });
    } finally {
      setEditLoading(false);
    }
  };

  if ((loading || !profileReady) && (!patientData || !profileReady) && !loadError) {
    return <div className={styles.workspace} role="status" aria-label="Loading patient medical records" aria-busy="true"><Skeleton width="110px" height="2.75rem" /><div className={styles.loadingBanner}><Skeleton width="44px" height="44px" rounded="full" /><div><Skeleton width="150px" height="1.25rem" /><Skeleton width="220px" height=".875rem" /></div></div><div className={styles.loadingTabs}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height="44px" />)}</div><div className={styles.loadingPanel}><Spinner size="sm" /><span>Loading patient record...</span></div></div>;
  }

  if (!patientData || !profileReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <Card className="max-w-md w-full p-6 text-center space-y-4 rounded-2xl border border-border bg-surface">
          <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto text-text-muted">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">{loadError ? "Unable to load patient record" : "Patient Record Not Found"}</h1>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {loadError || "The requested patient profile could not be located or has been archived."}
            </p>
          </div>
          <div className="pt-2">
            {loadError && <Button variant="outline" onClick={loadPatientDetails} className="mb-3 w-full">Try again</Button>}
            <Link href="/dashboard/patients">
              <Button variant="outline" size="sm" className="font-semibold">
                Back to Patient Directory
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const patientName = patientData.name || patientData.userId?.name || "Patient Record";
  const patientEmail = patientData.email || patientData.userId?.email || "";
  const patientPhone = patientData.phone || patientData.userId?.phone || "";
  const mrnCode = patientData.mrn || undefined;

  const headerData = {
    id: patientId,
    mrn: mrnCode,
    name: patientName,
    gender: patientData.gender,
    dob: patientData.dob ? new Date(patientData.dob).toLocaleDateString() : undefined,
    clinicalProfileRestricted: patientData.clinicalProfileRestricted || !canReadClinical,
    allergies: canReadClinical && !patientData.clinicalProfileRestricted ? patientData.allergies : [],
    conditions: canReadClinical && !patientData.clinicalProfileRestricted ? patientData.conditions : [],
  };

  const overviewData = {
    id: patientId,
    name: patientName,
    email: patientEmail,
    phone: patientPhone,
    dob: patientData.dob,
    gender: patientData.gender,
    bloodGroup: patientData.bloodGroup,
    address: patientData.address,
    abdmHealthId: patientData.abdmHealthId,
    allergies: patientData.allergies,
    conditions: patientData.conditions,
    medicalNotes: patientData.medicalNotes,
    emergencyContacts: patientData.emergencyContacts,
    insurancePolicies: patientData.insurancePolicies,
    totalAppointments: appointments.length,
    clinicalProfileRestricted: patientData.clinicalProfileRestricted || !canReadClinical,
  };

  const appointmentColumns: Column<any>[] = [
    {
      header: "Doctor & Specialization",
      render: (a) => (
        <div className="space-y-0.5">
          <p className="font-bold text-xs text-text">{a.doctorId?.name || "Attending Doctor"}</p>
          <p className="text-[11px] text-text-muted">{a.doctorId?.specialization || "General Medicine"}</p>
        </div>
      ),
    },
    {
      header: "Location & Date",
      render: (a) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-text">{a.locationId?.name || "Main Location"}</p>
          <p className="text-text-muted">{new Date(a.appointmentTime).toLocaleString()}</p>
        </div>
      ),
    },
    {
      header: "Token #",
      render: (a) => (
        <Badge variant="neutral" size="sm" className="font-mono font-bold">
          #{a.tokenNumber}
        </Badge>
      ),
    },
    {
      header: "Type",
      render: (a) => (
        <span className="capitalize text-xs font-medium text-text-secondary">{a.appointmentType || "walk-in"}</span>
      ),
    },
    {
      header: "Status",
      render: (a) => {
        let variant: "success" | "warning" | "error" | "neutral" | "primary" = "neutral";
        if (a.status === "completed") variant = "success";
        else if (a.status === "confirmed" || a.status === "in-consultation") variant = "primary";
        else if (a.status === "cancelled" || a.status === "no-show") variant = "error";
        else if (a.status === "pending") variant = "warning";
        return (
          <Badge variant={variant} size="sm" className="capitalize">
            {a.status}
          </Badge>
        );
      },
    },
    {
      header: "Actions",
      align: "right",
      render: (a) => (
        <Button
          size="xs"
          variant="outline"
          onClick={() => router.push(`/dashboard/consultations/${a.id || a._id}`)}
          className="font-semibold rounded-lg min-h-[36px]"
        >
          Encounter Workspace →
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.workspace}>
      <h1 className="sr-only">Patient profile: {patientName}</h1>
      {loadError && <Alert variant="warning" title="Patient information may be out of date" action={<Button variant="outline" size="sm" onClick={loadPatientDetails}>Try again</Button>}>{loadError}</Alert>}
      <header className={styles.topbar}>
        <Link href="/dashboard/patients" className={styles.backLink}><ArrowLeft size={16} />Patients</Link>
        <div className={styles.topActions}><Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Refresh patient profile" disabled={loading} onClick={loadPatientDetails}><RotateCw size={16} className={loading ? "animate-spin" : ""} /></Button>
          {canManagePatients && <Button size="sm" variant="outline" aria-label="Edit profile" onClick={() => setEditModalOpen(true)}><Pencil size={15} /><span className={styles.editLabel}>Edit profile</span></Button>}
          {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && <Button size="sm" onClick={() => router.push("/dashboard/appointments?patientId=" + patientId)}><CalendarPlus size={15} /><span className={styles.bookLabel}>Book visit</span></Button>}
        </div>
      </header>
      <div className={styles.patientBanner}><PatientHeader patient={headerData} compactMrn /></div>

      {/* Main Tabbed Interface */}
      <Tabs
        className={styles.profileTabs}
        scrollActiveIntoView={false}
        variant="pills"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <PatientOverviewCards
                patient={overviewData}
                visits={canReadClinical && !patientData.clinicalProfileRestricted ? appointments : []}
                onEditProfile={canManagePatients ? () => setEditModalOpen(true) : undefined}
              />
            ),
          },
          {
            id: "appointments",
            label: "Visits", badge: appointments.length,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className={styles.sectionHeader}>
                  <CardTitle className="text-base font-bold">Visit history</CardTitle>
                  <CardDescription className="text-xs">
                    Appointments and consultations in this record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table
                    columns={appointmentColumns}
                    data={appointments}
                    loading={loading}
                    searchable={false}
                    showColumnVisibility={false}
                    fitContent
                    density="compact"
                    pagination={true}
                    mobileCardView={true}
                    defaultRowsPerPage={10}
                    emptyMessage="No appointment records found for this patient."
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "clinical",
            label: "Timeline",
            content: (
              <Card className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <PatientTimeline patientId={patientId} accessToken={recordAccessToken} />
              </Card>
            ),
          },
          {
            id: "laboratory",
            label: "Labs", badge: secondaryLoading ? "…" : labError ? "!" : labOrders.length,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className={styles.sectionHeader}>
                  <div>
                    <CardTitle className="text-base font-bold">Laboratory orders</CardTitle>
                    <CardDescription className="text-xs text-text-muted mt-0.5">
                      Tests, samples and recorded results.
                    </CardDescription>
                  </div>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push(`/dashboard/laboratory?patientId=${patientId}`)}
                    className="w-full sm:w-auto min-h-[40px] rounded-xl font-bold shrink-0"
                  >
                    Order test
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {secondaryLoading ? <div className={styles.emptyState} role="status"><Spinner size="sm" /><p>Loading laboratory orders...</p></div> : labError ? <Alert variant="error" title="Laboratory orders unavailable" action={<Button variant="outline" onClick={loadPatientDetails}>Try again</Button>}>The orders could not be loaded. This is not an empty laboratory history.</Alert> : labOrders.length === 0 ? (
                    <div className="text-center py-12 text-xs text-text-muted space-y-2">
                      <p>No laboratory diagnostic orders recorded for this patient.</p>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/laboratory?patientId=${patientId}`)}
                      >
                        Order First Lab Test
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {labOrders.map((order) => {
                        let statusVariant: "success" | "warning" | "error" | "neutral" | "primary" = "neutral";
                        if (order.status === "completed") statusVariant = "success";
                        else if (order.status === "processing" || order.status === "sample_collected") statusVariant = "primary";
                        else if (order.status === "ordered") statusVariant = "warning";
                        else if (order.status === "cancelled") statusVariant = "error";

                        return (
                          <div key={order.id || order._id} className={styles.historyRow}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-bold text-text text-sm">{order.testId?.name || "Lab Diagnostic Test"}</span>
                                <Badge variant={statusVariant} size="sm" className="capitalize font-semibold">
                                  {order.status?.replace("_", " ") || "ordered"}
                                </Badge>
                                {order.testId?.code && (
                                  <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                                    {order.testId.code}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-1">
                                <span><b>Dept:</b> {order.testId?.department || "General Lab"}</span>
                                <span><b>Sample:</b> {order.testId?.sampleType || "Not recorded"}</span>
                                <span><b>Ordered:</b> {new Date(order.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {order.resultValue !== undefined && order.resultValue !== null && order.resultValue !== "" ? (
                                <div>
                                  <span className="font-mono font-black text-sm text-accent block">{order.resultValue}</span>
                                  <span className="text-[10px] text-text-muted">Ref Range: {order.testId?.normalRange || "Not recorded"}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-warning-text dark:text-warning-text font-semibold italic">
                                  {order.status === "sample_collected" ? "Sample in Lab" : "Pending Results"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "billing",
            label: "Billing", badge: secondaryLoading ? "…" : billingError ? "!" : invoices.length,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className={styles.sectionHeader}>
                  <div>
                    <CardTitle className="text-base font-bold">Billing history</CardTitle>
                    <CardDescription className="text-xs text-text-muted mt-0.5">
                      Recorded invoices and payment status.
                    </CardDescription>
                  </div>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push(`/dashboard/billing?patientId=${patientId}`)}
                    className="w-full sm:w-auto min-h-[40px] rounded-xl font-bold shrink-0"
                  >
                    Create invoice
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {secondaryLoading ? <div className={styles.emptyState} role="status"><Spinner size="sm" /><p>Loading invoices...</p></div> : billingError ? <Alert variant="error" title="Invoices unavailable" action={<Button variant="outline" onClick={loadPatientDetails}>Try again</Button>}>The invoices could not be loaded. This is not an empty billing history.</Alert> : invoices.length === 0 ? (
                    <div className="text-center py-12 text-xs text-text-muted space-y-2">
                      <p>No billing invoices found for this patient.</p>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/billing?patientId=${patientId}`)}
                      >
                        Generate Invoice
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map((inv) => {
                        let invStatusVariant: "success" | "warning" | "error" | "neutral" | "primary" = "neutral";
                        if (inv.status === "paid") invStatusVariant = "success";
                        else if (inv.status === "partially_paid") invStatusVariant = "warning";
                        else if (inv.status === "unpaid") invStatusVariant = "error";

                        return (
                          <div key={inv.id || inv._id} className={styles.historyRow}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-sm text-accent">#{inv.invoiceNumber || "INV"}</span>
                                <Badge variant={invStatusVariant} size="sm" className="capitalize font-bold">
                                  {inv.status || "unpaid"}
                                </Badge>
                                <Badge variant="neutral" size="sm" className="capitalize text-[10px]">
                                  Payment: {inv.paymentMethod || "Not recorded"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-text-muted">
                                Invoice Date: {new Date(inv.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-text block">₹{(inv.totalAmount || 0).toLocaleString()}</span>
                              {inv.discount ? (
                                <span className="text-[10px] text-success-text block">Discount: ₹{inv.discount}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "documents",
            label: "Docs",
            content: <PatientMedicalRecords patientId={patientId} accessToken={recordAccessToken} compact includeReceipts={canReadBilling} />,
          },
          { id: "access", label: "Access", content: <div className={styles.accessPanels}><PatientIdentityControls patientId={patientId} /><PatientPrivacyControls patientId={patientId} /><PatientRelationshipPanel patientId={patientId} /></div> },
        ].filter(tab => !["clinical", "laboratory", "documents"].includes(tab.id) || canReadClinical).filter(tab => tab.id !== "billing" || canReadBilling).filter(tab => tab.id !== "access" || canReadAccess)}
      />

      <div hidden={activeTab !== "access"} className={styles.accessFooter}>{canReadClinical && <PatientHistoryAccess patientId={patientId} token={recordAccessToken} onChange={changeRecordAccess} />}</div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit patient profile"
        size="lg"
        busy={editLoading}
        footer={<><Button variant="outline" disabled={editLoading} onClick={() => setEditModalOpen(false)}>Cancel</Button><Button type="submit" form="patient-profile-edit" loading={editLoading}>Save profile</Button></>}
      >
        <form id="patient-profile-edit" onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              value={editForm.phone}
              readOnly type="tel" inputMode="tel" hint="Use contact correction in the Access tab to update this."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DatePicker
              label="Date of Birth"

              value={editForm.dob}
              onChange={(value) => setEditForm({ ...editForm, dob: value })}
            />
            <Select
              label="Gender"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Other", value: "other" },
              ]}
            />
            <Select
              label="Blood Group"
              disabled={!canEditClinical}
              value={editForm.bloodGroup}
              onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
              options={[
                { label: "Select Blood Group", value: "" },
                { label: "A+", value: "A+" },
                { label: "A-", value: "A-" },
                { label: "B+", value: "B+" },
                { label: "B-", value: "B-" },
                { label: "O+", value: "O+" },
                { label: "O-", value: "O-" },
                { label: "AB+", value: "AB+" },
                { label: "AB-", value: "AB-" },
              ]}
            />
          </div>

          <Input
            label="Residential Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />

          <fieldset disabled={!canEditClinical} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Allergies (comma-separated)"
              placeholder="e.g. Penicillin, Sulfa, Peanuts"
              value={editForm.allergies}
              onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
            />
            <Input
              label="Chronic Conditions (comma-separated)"
              placeholder="e.g. Type 2 Diabetes, Hypertension"
              value={editForm.conditions}
              onChange={(e) => setEditForm({ ...editForm, conditions: e.target.value })}
            />
          </div>

          <Textarea
            label="Physician Notes & Special Precautions"
            placeholder="Any medical warnings or patient notes..."
            value={editForm.medicalNotes}
            onChange={(e) => setEditForm({ ...editForm, medicalNotes: e.target.value })}
            rows={3}
          />

          <Input
            label="ABDM Health ID (ABHA)"
            placeholder="e.g. 91-1234-5678-9012"
            value={editForm.abdmHealthId}
            onChange={(e) => setEditForm({ ...editForm, abdmHealthId: e.target.value })}
          />
          </fieldset>


        </form>
      </Modal>
    </div>
  );
}
