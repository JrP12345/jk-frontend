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
  Select,
  useToast,
  Modal,
} from "@/components/ui";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

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

  const [activeTab, setActiveTab] = useState<"profile" | "prescriptions" | "refills" | "timeline">("profile");
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientProfile | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" label="Loading Patient Portal..." />
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
          <Button variant="outline" size="sm" onClick={() => router.push("/browse")}>
            Browse Clinics & Book
          </Button>
          <Button size="sm" onClick={() => setEditProfileModalOpen(true)}>
            Edit Medical Info
          </Button>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="flex border-b border-border space-x-6">
        {[
          { key: "profile", label: "Medical Profile" },
          { key: "refills", label: `Refill Requests (${refillRequests.length})` },
          { key: "timeline", label: "PHR Health Timeline" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === tab.key
                ? "border-primary-500 text-primary-500"
                : "border-transparent text-text-muted hover:text-text"
            }`}
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
                          {evt.eventType.replace("_", " ")}
                        </span>
                        <span className="text-xs text-text-muted">
                          {new Date(evt.eventDate).toLocaleDateString()}
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
    </div>
  );
}
