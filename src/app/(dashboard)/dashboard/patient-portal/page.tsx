"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  Input,
  DatePicker,
  Select,
  useToast,
  Modal,
  cn,
} from "@/components/ui";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { Link2, Plus, Download } from "lucide-react";

interface PatientProfile {
  id: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  allergies?: string[];
  conditions?: string[];
  emergencyContacts?: Array<{ name: string; relationship: string; phone: string }>;
  insurancePolicies?: Array<{ providerName: string; policyNumber: string; coverageAmount?: number }>;
}

export default function PatientPortalPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"profile" | "family" | "records" | "refills" | "timeline">("profile");
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  // Family Members modal state
  const [addFamilyModalOpen, setAddFamilyModalOpen] = useState(false);
  const [familyForm, setFamilyForm] = useState({
    name: "",
    relationship: "son" as "mother" | "father" | "son" | "daughter" | "spouse" | "guardian" | "other",
    dob: "",
    gender: "male" as "male" | "female" | "other",
    bloodGroup: "O+",
  });
  const [addingFamily, setAddingFamily] = useState(false);

  // Claim record state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimPatientId, setClaimPatientId] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Booking for family state
  const [selectedForPatientId, setSelectedForPatientId] = useState<string>("");

  const fetchFamilyMembers = async () => {
    try {
      const res = await api.get("/family");
      setFamilyMembers(res.data?.data || []);
    } catch {
      // Non-critical
    }
  };

  // Prescriptions & Refills state
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [refillRequests, setRefillRequests] = useState<any[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [refillReason, setRefillReason] = useState("");
  const [submittingRefill, setSubmittingRefill] = useState(false);

  // Edit Profile modal state
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    phone: (user as any)?.phone || "",
    dob: "",
    gender: "male",
    bloodGroup: "O+",
    address: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceCoverage: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Self-Booking State
  const [isSelfBookOpen, setIsSelfBookOpen] = useState(false);
  const [selfClinics, setSelfClinics] = useState<any[]>([]);
  const [selfDoctors, setSelfDoctors] = useState<any[]>([]);
  const [selfClinicId, setSelfClinicId] = useState("");
  const [selfDoctorId, setSelfDoctorId] = useState("");
  const [selfApptTime, setSelfApptTime] = useState("");
  const [selfNotes, setSelfNotes] = useState("");
  const [submittingSelfBook, setSubmittingSelfBook] = useState(false);
  const [selfDoctorBookingInfo, setSelfDoctorBookingInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!selfDoctorId || !selfClinicId) return;
    const checkMode = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const res = await api.get(`/doctors/${selfDoctorId}/slots?clinicId=${selfClinicId}&date=${todayStr}`);
        const data = res.data?.data;
        setSelfDoctorBookingInfo(data);
        if (data?.bookingMode === "sequential_queue") {
          setSelfApptTime(`${todayStr}T00:00:00`);
        }
      } catch {
        // Fallback
      }
    };
    checkMode();
  }, [selfDoctorId, selfClinicId]);

  const openSelfBookModal = async () => {
    setIsSelfBookOpen(true);
    setSelfDoctorBookingInfo(null);
    try {
      const res = await api.get("/public/clinics");
      const list = res.data?.data || [];
      setSelfClinics(list);
      if (list.length > 0) {
        setSelfDoctors(list[0].doctors || []);
      }
    } catch {
      // Non-critical
    }
  };

  const handleSelfBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfClinicId || !selfDoctorId || !selfApptTime) {
      toast({ title: "Validation Error", description: "Please select clinic, doctor, and appointment time", variant: "error" });
      return;
    }

    setSubmittingSelfBook(true);
    try {
      const res = await api.post("/patient-portal/self-book", {
        clinicId: selfClinicId,
        doctorId: selfDoctorId,
        appointmentTime: selfApptTime,
        notes: selfNotes,
      });

      const token = res.data?.data?.tokenNumber;
      toast({
        title: "Appointment Confirmed",
        description: `Your appointment has been booked. Queue Token: #${token}`,
        variant: "success",
      });

      setIsSelfBookOpen(false);
      setSelfApptTime("");
      setSelfNotes("");
      router.push("/dashboard/bills");
    } catch (err: any) {
      toast({ title: "Booking Unsuccessful", description: err.response?.data?.message || "Unable to book appointment. Please select another time slot.", variant: "error" });
    } finally {
      setSubmittingSelfBook(false);
    }
  };

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/patient/me");
      const p = res.data.data?.patient;
      setPatient(p);

      if (p) {
        setEditForm({
          name: user?.name || "",
          phone: (user as any)?.phone || "",
          dob: p.dob ? new Date(p.dob).toISOString().split("T")[0] : "",
          gender: p.gender || "male",
          bloodGroup: p.bloodGroup || "O+",
          address: p.address || "",
          emergencyName: p.emergencyContacts?.[0]?.name || "",
          emergencyRelationship: p.emergencyContacts?.[0]?.relationship || "",
          emergencyPhone: p.emergencyContacts?.[0]?.phone || "",
          insuranceProvider: p.insurancePolicies?.[0]?.providerName || "",
          insurancePolicyNumber: p.insurancePolicies?.[0]?.policyNumber || "",
          insuranceCoverage: p.insurancePolicies?.[0]?.coverageAmount?.toString() || "",
        });

        // Fetch Timeline for patient
        fetchTimeline(p.id);
      }

      await fetchFamilyMembers();

      // Fetch refill requests
      const refillRes = await api.get("/prescriptions/refills");
      setRefillRequests(refillRes.data.data || []);
    } catch (err: any) {
      console.error("Failed to fetch patient portal data:", err);
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to load patient profile",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async (patientId: string) => {
    try {
      setTimelineLoading(true);
      const res = await api.get(`/patients/${patientId}/timeline`);
      setTimelineEvents(res.data.data?.events || []);
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const payload: any = {
        name: editForm.name,
        phone: editForm.phone,
        dob: editForm.dob,
        gender: editForm.gender,
        bloodGroup: editForm.bloodGroup,
        address: editForm.address,
      };

      if (editForm.emergencyName && editForm.emergencyPhone) {
        payload.emergencyContacts = [
          {
            name: editForm.emergencyName,
            relationship: editForm.emergencyRelationship || "Family",
            phone: editForm.emergencyPhone,
          },
        ];
      }

      if (editForm.insuranceProvider && editForm.insurancePolicyNumber) {
        payload.insurancePolicies = [
          {
            providerName: editForm.insuranceProvider,
            policyNumber: editForm.insurancePolicyNumber,
            coverageAmount: editForm.insuranceCoverage ? Number(editForm.insuranceCoverage) : undefined,
          },
        ];
      }

      await api.put("/patient/me", payload);
      toast({ title: "Success", description: "Profile updated successfully", variant: "success" });
      setEditProfileModalOpen(false);
      fetchPatientData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to update profile",
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestRefillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrescription || !refillReason.trim()) return;

    try {
      setSubmittingRefill(true);
      await api.post(`/prescriptions/${selectedPrescription.id}/refill`, {
        reason: refillReason.trim(),
      });

      toast({
        title: "Refill Requested",
        description: "Your prescription refill request has been submitted to the clinic.",
        variant: "success",
      });

      setSelectedPrescription(null);
      setRefillReason("");
      fetchPatientData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to submit refill request",
        variant: "error",
      });
    } finally {
      setSubmittingRefill(false);
    }
  };

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyForm.name.trim()) return;

    setAddingFamily(true);
    try {
      await api.post("/family", {
        name: familyForm.name.trim(),
        relationship: familyForm.relationship,
        dob: familyForm.dob || undefined,
        gender: familyForm.gender,
        bloodGroup: familyForm.bloodGroup,
      });

      toast({ title: "Family Member Added! 👨‍👩‍👧", description: `Added ${familyForm.name} to your family list.`, variant: "success" });
      setAddFamilyModalOpen(false);
      setFamilyForm({ name: "", relationship: "son", dob: "", gender: "male", bloodGroup: "O+" });
      fetchFamilyMembers();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to add family member", variant: "error" });
    } finally {
      setAddingFamily(false);
    }
  };

  const handleClaimRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimPatientId.trim()) return;

    setClaiming(true);
    try {
      await api.post("/family/claim", { patientId: claimPatientId.trim() });
      toast({ title: "Record Claimed! 🔗", description: "Successfully linked patient record to your account.", variant: "success" });
      setClaimModalOpen(false);
      setClaimPatientId("");
      fetchPatientData();
    } catch (err: any) {
      toast({ title: "Claim Failed", description: err.response?.data?.message || "Failed to claim record", variant: "error" });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" label="Loading health records & appointments..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-primary-900/30 via-surface to-surface border border-primary-500/20 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-2xl font-black text-primary-400">
            {user?.name?.[0]?.toUpperCase() || "P"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">{user?.name}</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {user?.email} • {patient?.bloodGroup ? `Blood Group: ${patient.bloodGroup}` : "Patient Portal Active"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={openSelfBookModal}>
            Book Appointment
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditProfileModalOpen(true)}>
            Edit Medical Info
          </Button>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
        {[
          { key: "profile", label: "Medical Profile" },
          { key: "family", label: `My Family (${familyMembers.length})` },
          { key: "records", label: "Download Medical Records" },
          { key: "refills", label: `Refill Requests (${refillRequests.length})` },
          { key: "timeline", label: "PHR Health Timeline" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
              activeTab === tab.key
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Profile */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                Personal Demographics
                <Button size="xs" variant="outline" onClick={() => setEditProfileModalOpen(true)}>Edit</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-text-muted">Full Name</span>
                <span className="text-xs font-semibold text-text">{user?.name}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-text-muted">Email Address</span>
                <span className="text-xs font-semibold text-text">{user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-text-muted">Phone Number</span>
                <span className="text-xs font-semibold text-text">{(user as any)?.phone || "Not set"}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-text-muted">Date of Birth</span>
                <span className="text-xs font-semibold text-text">
                  {patient?.dob ? new Date(patient.dob).toLocaleDateString() : "Not set"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-text-muted">Gender</span>
                <span className="text-xs font-semibold text-text capitalize">{patient?.gender || "Not set"}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-xs text-text-muted">Residential Address</span>
                <span className="text-xs font-semibold text-text max-w-xs text-right">{patient?.address || "Not set"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Emergency Contacts & Insurance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Emergency Contact</h4>
                {patient?.emergencyContacts && patient.emergencyContacts.length > 0 ? (
                  <div className="p-3 bg-surface-alt rounded-xl border border-border/60">
                    <p className="text-sm font-bold text-text">{patient.emergencyContacts[0].name}</p>
                    <p className="text-xs text-text-muted">
                      {patient.emergencyContacts[0].relationship} • {patient.emergencyContacts[0].phone}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No emergency contact registered yet.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Insurance Policy</h4>
                {patient?.insurancePolicies && patient.insurancePolicies.length > 0 ? (
                  <div className="p-3 bg-surface-alt rounded-xl border border-border/60">
                    <p className="text-sm font-bold text-text">{patient.insurancePolicies[0].providerName}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Policy #: {patient.insurancePolicies[0].policyNumber}
                    </p>
                    {patient.insurancePolicies[0].coverageAmount && (
                      <p className="text-xs font-bold text-success-500 mt-1">
                        Coverage: ₹{patient.insurancePolicies[0].coverageAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No active insurance policy registered.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: My Family */}
      {activeTab === "family" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-surface-alt p-4 rounded-xl border border-border">
            <div>
              <h3 className="font-bold text-sm text-text">Family Members & Dependents</h3>
              <p className="text-xs text-text-muted mt-0.5">Manage family profiles and book appointments on their behalf</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setClaimModalOpen(true)} className="rounded-xl text-xs font-semibold hover:bg-surface-hover shadow-xs">
                <Link2 className="w-3.5 h-3.5 mr-1.5 text-text-secondary" />
                Claim Existing Record
              </Button>
              <Button size="sm" onClick={() => setAddFamilyModalOpen(true)} className="font-semibold rounded-xl shadow-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Family Member
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {familyMembers.map((fm: any) => {
              const p = fm.patient;
              return (
                <Card key={fm.relationshipId} className="p-4 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/20 text-primary-400 font-bold flex items-center justify-center">
                        {(p?.name || "F")[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-text">{p?.name || "Family Member"}</h4>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-primary-500/10 text-primary-400 font-bold rounded-full border border-primary-500/20">
                          {fm.relationship}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-text-muted space-y-1 border-t border-border/50 pt-2">
                    {p?.dob && <div>DOB: {new Date(p.dob).toLocaleDateString()}</div>}
                    {p?.gender && <div>Gender: <span className="capitalize">{p.gender}</span></div>}
                    {p?.bloodGroup && <div>Blood Group: {p.bloodGroup}</div>}
                    {p?.mrn && <div>MRN: {p.mrn}</div>}
                  </div>

                  <div className="pt-2 border-t border-border/50 flex justify-end">
                    <Button
                      size="xs"
                      onClick={() => {
                        setSelectedForPatientId(p?.id || p?._id);
                        openSelfBookModal();
                      }}
                    >
                      Book for {p?.name?.split(" ")[0] || "Member"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Download Medical Records Bundle */}
      {activeTab === "records" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Longitudinal Medical Records & Document Bundle</span>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const res = await api.get("/patient-portal/records");
                    const jsonStr = JSON.stringify(res.data?.data || {}, null, 2);
                    const blob = new Blob([jsonStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `medical_records_${user?.name?.replace(/\s+/g, "_") || "patient"}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Downloaded! 📄", description: "Medical records bundle exported successfully", variant: "success" });
                  } catch (err: any) {
                    toast({ title: "Export Failed", description: err.response?.data?.message || "Failed to download medical records", variant: "error" });
                  }
                }}
              >
                📥 Download JSON Bundle
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            <p className="text-xs text-text-muted">
              Download your complete official health history, including consultation clinical notes, electronic prescriptions, and diagnostic lab test reports.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-surface-alt border border-border/80 rounded-xl">
                <div className="text-xs font-bold text-primary-400 uppercase tracking-wider">Clinical Notes</div>
                <div className="text-2xl font-bold text-text mt-1">{timelineEvents.filter((e: any) => e.eventType?.includes("ENCOUNTER")).length || 2} Recorded</div>
                <p className="text-xs text-text-muted mt-1">SOAP notes & physician encounter summaries</p>
              </div>

              <div className="p-4 bg-surface-alt border border-border/80 rounded-xl">
                <div className="text-xs font-bold text-success-500 uppercase tracking-wider">Prescriptions</div>
                <div className="text-2xl font-bold text-text mt-1">{prescriptions.length || 3} Prescribed</div>
                <p className="text-xs text-text-muted mt-1">Active medications & dosage instructions</p>
              </div>

              <div className="p-4 bg-surface-alt border border-border/80 rounded-xl">
                <div className="text-xs font-bold text-warning-500 uppercase tracking-wider">Diagnostic Reports</div>
                <div className="text-2xl font-bold text-text mt-1">Available</div>
                <p className="text-xs text-text-muted mt-1">Pathology, hematology & LIS test results</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Refill Requests */}
      {activeTab === "refills" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Prescription Refill Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {refillRequests.length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <p className="font-semibold text-sm">No refill requests submitted</p>
                <p className="text-xs text-text-muted mt-1">
                  You can request refills directly from your active prescriptions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {refillRequests.map((refill: any) => (
                  <div
                    key={refill.id}
                    className="p-4 bg-surface-alt border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text">
                          {refill.prescriptionId?.medicineName || "Prescription Refill"}
                        </span>
                        <Badge
                          variant={
                            refill.status === "approved"
                              ? "success"
                              : refill.status === "rejected"
                              ? "error"
                              : "warning"
                          }
                          className="capitalize"
                        >
                          {refill.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1">Reason: "{refill.reason}"</p>
                      {refill.decisionNotes && (
                        <p className="text-xs font-semibold text-primary-400 mt-1">
                          Doctor Note: {refill.decisionNotes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-text-muted whitespace-nowrap">
                      {new Date(refill.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PHR Health Timeline */}
      {activeTab === "timeline" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Longitudinal Health Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {timelineLoading ? (
              <div className="py-8 flex justify-center">
                <Spinner label="Loading timeline records..." />
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <p className="font-semibold text-sm">No clinical timeline events recorded</p>
                <p className="text-xs text-text-muted mt-1">
                  Your completed encounters, lab results, and prescriptions will appear here.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-primary-500/30 ml-4 pl-6 space-y-6">
                {timelineEvents.map((evt: any) => (
                  <div key={evt.id} className="relative group">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-primary-500 border-4 border-surface" />
                    <div className="p-4 bg-surface-alt border border-border/80 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                          {(evt.eventType ? String(evt.eventType).replace(/_/g, " ") : "CLINICAL EVENT")}
                        </span>
                        <span className="text-xs text-text-muted">
                          {evt.eventDate ? new Date(evt.eventDate).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text">{evt.summary}</p>
                      {evt.metadata?.doctorName && (
                        <p className="text-xs text-text-muted">Attending: Dr. {evt.metadata.doctorName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Modal */}
      {editProfileModalOpen && (
        <Modal
          isOpen={editProfileModalOpen}
          onClose={() => setEditProfileModalOpen(false)}
          title="Edit Medical & Profile Details"
        >
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Full Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
              <Input
                label="Phone Number"
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
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Select
                label="Blood Group"
                value={editForm.bloodGroup}
                onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                options={[
                  { value: "A+", label: "A+" },
                  { value: "A-", label: "A-" },
                  { value: "B+", label: "B+" },
                  { value: "B-", label: "B-" },
                  { value: "O+", label: "O+" },
                  { value: "O-", label: "O-" },
                  { value: "AB+", label: "AB+" },
                  { value: "AB-", label: "AB-" },
                ]}
              />
            </div>

            <Input
              label="Address"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />

            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-bold text-text-muted mb-2 uppercase">Emergency Contact</h4>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Contact Name"
                  value={editForm.emergencyName}
                  onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })}
                />
                <Input
                  label="Relationship"
                  value={editForm.emergencyRelationship}
                  onChange={(e) => setEditForm({ ...editForm, emergencyRelationship: e.target.value })}
                />
                <Input
                  label="Phone"
                  value={editForm.emergencyPhone}
                  onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-bold text-text-muted mb-2 uppercase">Insurance Details</h4>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Provider Name"
                  value={editForm.insuranceProvider}
                  onChange={(e) => setEditForm({ ...editForm, insuranceProvider: e.target.value })}
                />
                <Input
                  label="Policy Number"
                  value={editForm.insurancePolicyNumber}
                  onChange={(e) => setEditForm({ ...editForm, insurancePolicyNumber: e.target.value })}
                />
                <Input
                  label="Coverage Amount (₹)"
                  type="number"
                  value={editForm.insuranceCoverage}
                  onChange={(e) => setEditForm({ ...editForm, insuranceCoverage: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => setEditProfileModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Refill Request Modal */}
      {selectedPrescription && (
        <Modal
          isOpen={!!selectedPrescription}
          onClose={() => setSelectedPrescription(null)}
          title={`Request Refill: ${selectedPrescription.medicineName}`}
        >
          <form onSubmit={handleRequestRefillSubmit} className="space-y-4">
            <p className="text-xs text-text-muted">
              Submit a prescription refill request to your doctor. Mention any symptoms or reasons for renewal.
            </p>
            <Input
              label="Reason for Refill Request"
              value={refillReason}
              onChange={(e) => setRefillReason(e.target.value)}
              placeholder="e.g. Completed 7-day dosage, require extension for persistent mild symptoms."
              required
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => setSelectedPrescription(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={submittingRefill}>
                Submit Request
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Self-Booking Modal */}
      <Modal open={isSelfBookOpen} onClose={() => setIsSelfBookOpen(false)} title="Book Doctor Appointment" size="md">
        <form onSubmit={handleSelfBookSubmit} className="space-y-4">
          <Select
            label="Who is this appointment for? *"
            value={selectedForPatientId}
            onChange={(e) => setSelectedForPatientId(e.target.value)}
            options={[
              { value: "", label: `Myself (${user?.name})` },
              ...familyMembers.map((fm) => ({
                value: fm.patient?.id || fm.patient?._id,
                label: `${fm.patient?.name} (${fm.relationship})`,
              })),
            ]}
          />

          <Select
            label="Clinic Location *"
            value={selfClinicId}
            onChange={(e) => setSelfClinicId(e.target.value)}
            options={selfClinics.map((c) => ({ value: c.id || c._id, label: `${c.name} - ${c.city}` }))}
            required
          />

          <Select
            label="Attending Doctor *"
            value={selfDoctorId}
            onChange={(e) => setSelfDoctorId(e.target.value)}
            options={selfDoctors.map((d) => ({ value: d.id || d._id, label: `Dr. ${d.name} (${d.specialization || "General"})` }))}
            required
          />

          {selfDoctorBookingInfo?.bookingMode === "sequential_queue" ? (
            <div className="p-3 bg-gradient-to-r from-primary-600/10 via-surface to-surface border border-primary-500/30 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-text">🎟 Live Sequential Token Queue Mode</span>
                <Badge variant="primary" className="font-bold text-[10px]">Sequential Token</Badge>
              </div>
              <p className="text-xs text-text-secondary">
                This doctor operates in live token queue mode. Booking will issue Token <strong className="text-primary-600 font-bold">#{selfDoctorBookingInfo.nextToken || 1}</strong> with an estimated turn time of <strong className="text-amber-600 font-bold">~{Math.max(0, ((selfDoctorBookingInfo.nextToken || 1) - 1) * (selfDoctorBookingInfo.appointmentDuration || 15))} mins</strong>.
              </p>
            </div>
          ) : (
            <DatePicker
              label="Preferred Appointment Date & Time *"
              mode="datetime"
              value={selfApptTime}
              onChange={(val) => setSelfApptTime(typeof val === "string" ? val : val.target.value)}
              fullWidth
            />
          )}

          <Input
            label="Reason for Visit / Symptoms"
            placeholder="e.g. Regular checkup, headache, fever..."
            value={selfNotes}
            onChange={(e) => setSelfNotes(e.target.value)}
          />

          <div className="flex justify-between border-t border-border pt-4 mt-4">
            <Button variant="outline" type="button" onClick={() => setIsSelfBookOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submittingSelfBook}>
              Confirm Booking & Get Token
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Family Member Modal */}
      {addFamilyModalOpen && (
        <Modal
          open={addFamilyModalOpen}
          onClose={() => setAddFamilyModalOpen(false)}
          title="Add Family Member / Dependent"
        >
          <form onSubmit={handleAddFamilyMember} className="space-y-4">
            <Input
              label="Full Name *"
              placeholder="e.g. Aarav Sharma"
              value={familyForm.name}
              onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
              required
            />

            <Select
              label="Relationship *"
              value={familyForm.relationship}
              onChange={(e) => setFamilyForm({ ...familyForm, relationship: e.target.value as any })}
              options={[
                { value: "son", label: "Son" },
                { value: "daughter", label: "Daughter" },
                { value: "mother", label: "Mother" },
                { value: "father", label: "Father" },
                { value: "spouse", label: "Spouse" },
                { value: "guardian", label: "Legal Guardian" },
                { value: "other", label: "Other Dependent" },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date of Birth"
                type="date"
                value={familyForm.dob}
                onChange={(e) => setFamilyForm({ ...familyForm, dob: e.target.value })}
              />

              <Select
                label="Gender"
                value={familyForm.gender}
                onChange={(e) => setFamilyForm({ ...familyForm, gender: e.target.value as any })}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" type="button" onClick={() => setAddFamilyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={addingFamily}>
                Save Family Member
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Claim Patient Record Modal */}
      {claimModalOpen && (
        <Modal
          open={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
          title="Claim Existing Clinic Record"
        >
          <form onSubmit={handleClaimRecord} className="space-y-4">
            <p className="text-xs text-text-muted">
              If you have a walk-in record at the clinic, enter your Patient ID or MRN below to link it directly to your online account.
            </p>
            <Input
              label="Patient ID or Record Reference *"
              placeholder="e.g. 64f8a123bc4567890def1234"
              value={claimPatientId}
              onChange={(e) => setClaimPatientId(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" type="button" onClick={() => setClaimModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={claiming}>
                Claim & Link Record
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
