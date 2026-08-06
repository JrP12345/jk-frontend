"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { PatientService } from "@/services/patient.service";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  Column,
  Spinner,
  Tabs,
  Modal,
  Input,
  Textarea,
  Select,
  useToast,
} from "@/components/ui";
import { PatientHeader } from "@/components/clinical/PatientHeader";
import { PatientOverviewCards } from "@/components/clinical/PatientOverviewCards";
import { PatientTimeline } from "@/components/ehr/PatientTimeline";
import { PatientMedicalRecords } from "@/components/ehr/PatientMedicalRecords";

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const patientId = params.id as string;

  const [patientData, setPatientData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      setLoading(true);
      const res = await PatientService.getPatientDetails(patientId);
      const patient = res.patient || res;
      const appts = res.appointments || [];

      setPatientData(patient);
      setAppointments(appts);

      // Populate edit form defaults
      const userName = patient.userId?.name || "";
      const userPhone = patient.userId?.phone || "";
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

      // Load lab orders & invoices asynchronously
      Promise.all([
        api.get(`/lab-orders?patientId=${encodeURIComponent(patientId)}`).catch(() => ({ data: { data: [] } })),
        api.get(`/invoices?patientId=${encodeURIComponent(patientId)}`).catch(() => ({ data: { data: [] } })),
      ]).then(([labRes, invRes]) => {
        const labs = labRes.data?.data || [];
        const invs = invRes.data?.data || [];
        setLabOrders(labs.filter((l: any) => (l.patientId?.id || l.patientId?._id || l.patientId) === patientId));
        setInvoices(invs.filter((i: any) => (i.patientId?.id || i.patientId?._id || i.patientId) === patientId));
      });

    } catch (err: any) {
      toast({
        title: "Failed to Load Patient Profile",
        description: err.response?.data?.message || err.message || "Patient record not found",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadPatientDetails();
    }
  }, [patientId]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      const payload = {
        name: editForm.name,
        phone: editForm.phone,
        dob: editForm.dob || undefined,
        gender: editForm.gender,
        bloodGroup: editForm.bloodGroup || undefined,
        address: editForm.address,
        allergies: editForm.allergies ? editForm.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
        conditions: editForm.conditions ? editForm.conditions.split(",").map((s) => s.trim()).filter(Boolean) : [],
        medicalNotes: editForm.medicalNotes,
        abdmHealthId: editForm.abdmHealthId || undefined,
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
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update patient profile",
        variant: "error",
      });
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" label="Loading Master Electronic Health Record..." />
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-text">Patient Profile Not Found</h2>
        <p className="text-sm text-text-muted">The requested patient record could not be retrieved.</p>
        <Link href="/dashboard/patients">
          <Button variant="outline" size="sm">
            ← Back to Patient Directory
          </Button>
        </Link>
      </div>
    );
  }

  const patientName = patientData.userId?.name || "Patient Record";
  const patientEmail = patientData.userId?.email || "";
  const patientPhone = patientData.userId?.phone || "";
  const mrnCode = patientData.mrn || `MRN-${patientId.substring(0, 6).toUpperCase()}`;

  const headerData = {
    id: patientId,
    mrn: mrnCode,
    name: patientName,
    gender: patientData.gender,
    dob: patientData.dob ? new Date(patientData.dob).toLocaleDateString() : undefined,
    allergies: patientData.allergies,
    conditions: patientData.conditions,
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
    activeAdmissions: 0,
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
      header: "Clinic & Date",
      render: (a) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-text">{a.clinicId?.name || "Main Clinic"}</p>
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
          className="font-semibold rounded-lg"
        >
          Encounter Workspace →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-12">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href="/dashboard/patients" className="text-xs text-text-muted hover:text-primary-600 flex items-center gap-1 font-semibold transition-colors">
          ← Back to Patients Directory
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setEditModalOpen(true)}
            className="rounded-xl font-semibold cursor-pointer"
          >
            ✏️ Edit Demographics
          </Button>
          <Button
            size="xs"
            variant="primary"
            onClick={() => router.push(`/dashboard/appointments?patientId=${patientId}`)}
            className="rounded-xl font-bold cursor-pointer"
          >
            + Book Appointment
          </Button>
        </div>
      </div>

      {/* Sticky Patient Banner */}
      <PatientHeader patient={headerData} />

      {/* Main Tabbed Interface */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: "overview",
            label: "Overview & Demographics",
            content: (
              <PatientOverviewCards
                patient={overviewData}
                onEditProfile={() => setEditModalOpen(true)}
              />
            ),
          },
          {
            id: "appointments",
            label: `Consultation History (${appointments.length})`,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Appointment & Outpatient History</CardTitle>
                  <CardDescription className="text-xs">
                    Comprehensive log of all scheduled, active, and completed consultations for this patient.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {appointments.length === 0 ? (
                    <div className="py-12 text-center text-text-muted text-sm">
                      No appointment records found for this patient.
                    </div>
                  ) : (
                    <Table
                      columns={appointmentColumns}
                      data={appointments}
                      searchable={false}
                      pagination={true}
                      defaultRowsPerPage={10}
                    />
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "clinical",
            label: "EHR Medical Timeline",
            content: (
              <Card className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <PatientTimeline patientId={patientId} />
              </Card>
            ),
          },
          {
            id: "laboratory",
            label: `Lab Diagnostic Orders (${labOrders.length})`,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">Laboratory Orders & Diagnostic Reports</CardTitle>
                    <CardDescription className="text-xs text-text-muted mt-0.5">
                      Diagnostic tests, pathology samples, and verified laboratory result entries.
                    </CardDescription>
                  </div>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push(`/dashboard/laboratory?patientId=${patientId}`)}
                    className="rounded-xl font-bold shrink-0"
                  >
                    + Order Lab Test
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {labOrders.length === 0 ? (
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
                          <div key={order.id || order._id} className="p-4 bg-surface-alt rounded-xl border border-border/80 flex items-center justify-between text-xs hover:border-primary-500/40 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
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
                              <div className="text-[11px] text-text-muted flex gap-3">
                                <span><b>Dept:</b> {order.testId?.department || "General Lab"}</span>
                                <span><b>Sample:</b> {order.testId?.sampleType || "Blood"}</span>
                                <span><b>Ordered:</b> {new Date(order.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {order.resultValue ? (
                                <div>
                                  <span className="font-mono font-black text-sm text-primary-600 block">{order.resultValue}</span>
                                  <span className="text-[10px] text-text-muted">Ref Range: {order.testId?.normalRange || "Standard"}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold italic">
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
            label: `Billing & Invoices (${invoices.length})`,
            content: (
              <Card className="rounded-2xl border border-border bg-surface shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">Billing Receipts & Financial Statements</CardTitle>
                    <CardDescription className="text-xs text-text-muted mt-0.5">
                      Outpatient invoices, service charges, discounts, and payment transaction logs.
                    </CardDescription>
                  </div>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => router.push(`/dashboard/billing?patientId=${patientId}`)}
                    className="rounded-xl font-bold shrink-0"
                  >
                    + Create Invoice
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {invoices.length === 0 ? (
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
                          <div key={inv.id || inv._id} className="p-4 bg-surface-alt rounded-xl border border-border/80 flex items-center justify-between text-xs hover:border-primary-500/40 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-primary-600">#{inv.invoiceNumber || "INV"}</span>
                                <Badge variant={invStatusVariant} size="sm" className="capitalize font-bold">
                                  {inv.status || "unpaid"}
                                </Badge>
                                <Badge variant="neutral" size="sm" className="capitalize text-[10px]">
                                  Payment: {inv.paymentMethod || "Cash"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-text-muted">
                                Invoice Date: {new Date(inv.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-text block">₹{(inv.totalAmount || 0).toLocaleString()}</span>
                              {inv.discount ? (
                                <span className="text-[10px] text-emerald-600 block">Discount: ₹{inv.discount}</span>
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
            label: "Signed Health Documents",
            content: <PatientMedicalRecords patientId={patientId} />,
          },
        ]}
      />

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="✏️ Edit Patient Demographics & Profile"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              value={editForm.dob}
              onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={editLoading}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
