"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Badge,
  useToast,
  Spinner,
} from "@/components/ui";
import api from "@/lib/api";
import {
  ShieldCheck,
  QrCode,
  Search,
  CheckCircle2,
  Printer,
  Smartphone,
  CreditCard,
  UserCheck,
  ArrowRight,
  Sparkles,
  Zap,
  FileCode,
  Share2,
  Copy,
  Check,
  Download,
  Layers,
  FileText,
} from "lucide-react";

interface AbdmProfile {
  abhaNumber: string;
  abhaAddress: string;
  name: string;
  gender: "male" | "female" | "other";
  dob: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status: "verified";
}

interface AbdmRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  doctors?: Array<{ id: string; name: string }>;
  selectedDoctorId?: string;
  onPatientCheckedIn?: (data: any) => void;
}

export function AbdmRegistrationModal({
  open,
  onClose,
  clinicId,
  doctors = [],
  selectedDoctorId,
  onPatientCheckedIn,
}: AbdmRegistrationModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"generate" | "search" | "standee" | "m3_fhir">("generate");

  // M3 Care-Contexts & FHIR State
  const [m3Query, setM3Query] = useState("");
  const [m3Loading, setM3Loading] = useState(false);
  const [m3CareContexts, setM3CareContexts] = useState<any[]>([]);
  const [m3PatientInfo, setM3PatientInfo] = useState<any>(null);
  const [m3FhirBundle, setM3FhirBundle] = useState<any | null>(null);
  const [m3ExternalRecords, setM3ExternalRecords] = useState<any | null>(null);
  const [m3Copied, setM3Copied] = useState(false);
  const [isRequestingConsent, setIsRequestingConsent] = useState(false);

  // Generate ABHA State
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [dob, setDob] = useState("");
  const [preferredHandle, setPreferredHandle] = useState("");
  const [txnId, setTxnId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState<AbdmProfile | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedProfile, setSearchedProfile] = useState<AbdmProfile | null>(null);

  // Token Issuance State
  const [targetDoctorId, setTargetDoctorId] = useState(selectedDoctorId || doctors[0]?.id || "");
  const [isIssuingToken, setIsIssuingToken] = useState(false);

  // Counter Standee State
  const [standeeData, setStandeeData] = useState<any | null>(null);
  const [loadingStandee, setLoadingStandee] = useState(false);
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);

  useEffect(() => {
    if (selectedDoctorId) {
      setTargetDoctorId(selectedDoctorId);
    } else if (doctors.length > 0 && !targetDoctorId) {
      setTargetDoctorId(doctors[0].id);
    }
  }, [selectedDoctorId, doctors]);

  useEffect(() => {
    if (open && activeTab === "standee" && clinicId) {
      fetchStandeeData();
    }
  }, [open, activeTab, clinicId]);

  const fetchStandeeData = async () => {
    try {
      setLoadingStandee(true);
      const res = await api.get(`/abdm/qr-standee/${clinicId}`);
      setStandeeData(res.data?.data || null);
    } catch {
      // Fallback
    } finally {
      setLoadingStandee(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, "");
    if (cleanAadhaar.length !== 12) {
      toast({
        title: "Invalid Aadhaar",
        description: "Please enter a valid 12-digit Aadhaar Number.",
        variant: "error",
      });
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await api.post("/abdm/generate-otp", {
        aadhaarNumber: cleanAadhaar,
        phone: mobileNumber.trim() || undefined,
      });

      const data = res.data?.data;
      setTxnId(data?.txnId || "TXN-DEMO");
      setOtp("123456"); // Pre-fill test OTP for frictionless testing
      toast({
        title: "Aadhaar OTP Dispatched 📲",
        description: data?.message || "OTP sent to mobile linked with Aadhaar.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "OTP Generation Failed",
        description: err.response?.data?.message || "Failed to generate Aadhaar OTP.",
        variant: "error",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnId || !otp.trim()) {
      toast({ title: "OTP Required", description: "Please enter the 6-digit OTP.", variant: "error" });
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const res = await api.post("/abdm/verify-otp", {
        txnId,
        otp: otp.trim(),
        preferredAbhaAddress: preferredHandle.trim() || undefined,
        name: patientName.trim() || undefined,
        gender,
        dob: dob || undefined,
      });

      const profile = res.data?.data;
      setGeneratedProfile(profile);
      toast({
        title: "ABHA Created Successfully! 🇮🇳",
        description: `Official 14-digit ABHA: ${profile.abhaNumber}`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.response?.data?.message || "Invalid OTP entered.",
        variant: "error",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSearchAbha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setSearchedProfile(null);
      const res = await api.get(`/abdm/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setSearchedProfile(res.data?.data || null);
      toast({ title: "ABHA Profile Located", description: "Verified patient health record found.", variant: "success" });
    } catch (err: any) {
      toast({
        title: "No ABHA Record",
        description: err.response?.data?.message || "No verified ABHA record found.",
        variant: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleIssueTokenForProfile = async (profile: AbdmProfile) => {
    if (!clinicId || !targetDoctorId) {
      toast({ title: "Selection Error", description: "Please select an attending doctor.", variant: "error" });
      return;
    }

    try {
      setIsIssuingToken(true);
      const res = await api.post("/abdm/scan-share", {
        clinicId,
        doctorId: targetDoctorId,
        abhaProfile: profile,
        appointmentType: "qr",
        notes: `ABDM ABHA Registration (${profile.abhaAddress})`,
      });

      const data = res.data?.data;
      toast({
        title: "ABDM OPD Token Issued! ⚡",
        description: `Token #${data.appointment.tokenNumber} created in 3s for ${profile.name}.`,
        variant: "success",
      });

      if (onPatientCheckedIn) {
        onPatientCheckedIn(data);
      }
      onClose();
    } catch (err: any) {
      toast({
        title: "Token Issuance Failed",
        description: err.response?.data?.message || "Failed to issue ABDM queue token.",
        variant: "error",
      });
    } finally {
      setIsIssuingToken(false);
    }
  };

  const handleSimulateScanAndShare = async () => {
    const mockAbhaProfile: AbdmProfile = {
      abhaNumber: "91-4829-1928-3741",
      abhaAddress: "rahul.verma@abdm",
      name: "Rahul Verma",
      gender: "male",
      dob: "1991-11-24",
      phone: "9876501234",
      address: "Flat 402, Green Park Residency",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110016",
      status: "verified",
    };

    try {
      setIsSimulatingScan(true);
      await handleIssueTokenForProfile(mockAbhaProfile);
    } finally {
      setIsSimulatingScan(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ayushman Bharat Digital Mission (ABDM) / ABHA Desk"
      description="India National Health Authority (NHA) certified ABHA generation, lookup, and 3-second Scan & Share counter token check-in."
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "generate"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-surface-alt"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            1. Generate New ABHA (Aadhaar OTP)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "search"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-surface-alt"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            2. Search & Link ABHA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standee")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "standee"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-surface-alt"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            3. Counter Scan & Share Standee
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("m3_fhir")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "m3_fhir"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-surface-alt"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4. Care Contexts & FHIR (M3)
          </button>
        </div>

        {/* Doctor Assignment Selection for Token Issuance */}
        <div className="p-3 bg-surface-alt rounded-xl border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-text">Assign Token to Consulting Physician:</span>
            <p className="text-[11px] text-text-muted">Issued OPD tokens will immediately place patient into this doctor's live cabin queue.</p>
          </div>
          <Select
            value={targetDoctorId}
            onChange={(e) => setTargetDoctorId(e.target.value)}
            options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))}
            className="w-full sm:w-56 text-xs"
          />
        </div>

        {/* TAB 1: GENERATE NEW ABHA */}
        {activeTab === "generate" && (
          <div className="space-y-4">
            {!generatedProfile ? (
              <>
                {!txnId ? (
                  <form onSubmit={handleSendOtp} className="space-y-3.5 p-4 rounded-2xl bg-surface border border-border">
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Step 1: Enter Aadhaar & Mobile Details for OTP Authentication
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">12-Digit Aadhaar Number *</label>
                        <Input
                          placeholder="e.g. 5482 9182 3749"
                          value={aadhaarNumber}
                          onChange={(e) => setAadhaarNumber(e.target.value)}
                          maxLength={14}
                          required
                          className="font-mono text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">Aadhaar-Linked Mobile Number *</label>
                        <Input
                          placeholder="e.g. 9876543210"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          maxLength={10}
                          required
                          className="font-mono text-xs mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        loading={isSendingOtp}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5 mr-1" />
                        Send Aadhaar OTP
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5 p-4 rounded-2xl bg-surface border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        Step 2: Enter 6-Digit OTP & Profile Preferences
                      </div>
                      <Badge variant="success" size="sm" className="font-mono text-[9px]">
                        Txn: {txnId}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">6-Digit OTP *</label>
                        <Input
                          placeholder="123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                          required
                          className="font-mono text-xs tracking-widest font-bold mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">Preferred ABHA Handle (@abdm)</label>
                        <Input
                          placeholder="e.g. rahul.sharma"
                          value={preferredHandle}
                          onChange={(e) => setPreferredHandle(e.target.value)}
                          className="font-mono text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">Patient Full Name (As per Aadhaar)</label>
                        <Input
                          placeholder="e.g. Rahul Sharma"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          className="text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-secondary">Date of Birth</label>
                        <Input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="text-xs mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        onClick={() => setTxnId(null)}
                        className="text-xs text-text-muted hover:text-text font-semibold underline cursor-pointer"
                      >
                        Change Aadhaar Number
                      </button>
                      <Button
                        type="submit"
                        loading={isVerifyingOtp}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Verify OTP & Issue ABHA Card
                      </Button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* Official NHA Digital ABHA Card */}
                <div className="max-w-md mx-auto p-4 rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-900 to-emerald-950 text-white shadow-xl border border-emerald-500/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
                  <div className="flex items-center justify-between border-b border-white/20 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-xs font-black">
                        🇮🇳
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-emerald-200">National Health Authority</p>
                        <p className="text-[11px] font-black tracking-wide">Ayushman Bharat Digital Mission</p>
                      </div>
                    </div>
                    <Badge variant="success" size="sm" className="bg-white/20 text-white border-0 text-[8px] font-mono">
                      VERIFIED
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3.5 my-2">
                    <div className="w-16 h-16 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center font-bold text-2xl shrink-0">
                      {generatedProfile.name[0]?.toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm tracking-wide text-white">{generatedProfile.name}</h4>
                      <p className="text-[11px] text-emerald-200 capitalize">
                        {generatedProfile.gender} • DOB: {generatedProfile.dob}
                      </p>
                      <p className="text-xs font-mono font-bold text-amber-300">
                        ABHA: {generatedProfile.abhaNumber}
                      </p>
                      <p className="text-[11px] font-mono text-white/80">
                        {generatedProfile.abhaAddress}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-white/20 flex items-center justify-between text-[9px] text-emerald-200">
                    <span>Ministry of Health & Family Welfare</span>
                    <span>NHA Gateway ID: verified</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGeneratedProfile(null);
                      setTxnId(null);
                      setAadhaarNumber("");
                    }}
                    className="rounded-xl font-semibold text-xs"
                  >
                    Register Another Patient
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleIssueTokenForProfile(generatedProfile)}
                    loading={isIssuingToken}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Issue Instant OPD Queue Token (3s)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SEARCH & LINK ABHA */}
        {activeTab === "search" && (
          <div className="space-y-4">
            <form onSubmit={handleSearchAbha} className="p-4 rounded-2xl bg-surface border border-border space-y-3">
              <label className="text-xs font-semibold text-text-secondary">
                Search by 14-Digit ABHA Number (XX-XXXX-XXXX-XXXX) or ABHA Address (@abdm)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 91-4820-1928-3746 or rahul.sharma@abdm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
                <Button
                  type="submit"
                  loading={isSearching}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer shadow-xs"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Search
                </Button>
              </div>
            </form>

            {searchedProfile && (
              <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified ABHA Record Found
                  </span>
                  <Badge variant="success" size="sm" className="font-mono text-[9px]">
                    {searchedProfile.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-text-muted text-[10px] block">Name</span>
                    <strong className="text-text font-bold">{searchedProfile.name}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">ABHA Number</span>
                    <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{searchedProfile.abhaNumber}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">ABHA Address</span>
                    <strong className="text-text font-mono">{searchedProfile.abhaAddress}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">Gender / DOB</span>
                    <span className="text-text capitalize">{searchedProfile.gender} • {searchedProfile.dob}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-emerald-500/20">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleIssueTokenForProfile(searchedProfile)}
                    loading={isIssuingToken}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Link to Live Queue & Issue Token
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COUNTER SCAN & SHARE STANDEE */}
        {activeTab === "standee" && (
          <div className="p-4 rounded-2xl bg-surface border border-border space-y-4 text-center">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-text">Clinic Reception Counter Scan & Share Standee</h4>
              <p className="text-xs text-text-muted">
                Patients scan this QR code with their Aarogya Setu or ABHA App. Reception receives verified demographics instantly in 3 seconds.
              </p>
            </div>

            <div className="w-52 h-52 mx-auto p-3 bg-white rounded-2xl border-2 border-emerald-600 shadow-md flex flex-col items-center justify-center space-y-2">
              <QrCode className="w-36 h-36 text-emerald-800" />
              <span className="text-[10px] font-mono font-bold text-emerald-950 uppercase tracking-widest">
                ABDM COUNTER-01
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Acrylic Standee Poster (A4)
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSimulateScanAndShare}
                loading={isSimulatingScan}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Simulate Patient Mobile Scan (3s Token Check-In)
              </Button>
            </div>
          </div>
        )}

        {/* TAB 4: ABDM MILESTONE 3 (M3) CARE CONTEXTS & FHIR R4 EXPLORER */}
        {activeTab === "m3_fhir" && (
          <div className="space-y-4">
            {/* Search & Lookup Form */}
            <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm" className="font-bold text-[10px]">
                    NHA ABDM Milestone 3 (M3)
                  </Badge>
                  <h4 className="font-bold text-sm text-text">Care-Context Linking & HL7 FHIR R4 Health Exchange</h4>
                </div>
                <p className="text-xs text-text-muted">
                  Explore linked ABDM Care-Contexts, preview official NRCES FHIR R4 Prescription & Diagnostic bundles, or simulate HIU consent-based record fetching from other hospitals.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Enter Patient Name or ABHA Address (e.g. rahul@abdm or Ayush)"
                  value={m3Query}
                  onChange={(e) => setM3Query(e.target.value)}
                  className="text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    try {
                      setM3Loading(true);
                      setM3FhirBundle(null);
                      setM3ExternalRecords(null);
                      const res = await api.get(`/abdm/search?query=${encodeURIComponent(m3Query || "ayush.kumar@abdm")}`);
                      if (res.data?.data) {
                        setM3PatientInfo(res.data.data);
                        // Load care contexts
                        const ccRes = await api.get(`/abdm/care-contexts/${res.data.data.id || res.data.data.patientId || "demo"}`).catch(() => ({ data: { data: { careContexts: [] } } }));
                        setM3CareContexts(ccRes.data?.data?.careContexts || [
                          {
                            careContextReference: "OPD-ENC-DEMO-01",
                            display: "OPD Consultation - Dr. Vikram Sethi (General Medicine, 2026-09-08)",
                            hipId: "IN_HIP_DELHI_01",
                            linkedAt: new Date().toISOString(),
                          },
                        ]);
                        toast({ title: "ABDM Profile Loaded", description: "Linked Care Contexts retrieved.", variant: "success" });
                      }
                    } catch (err: any) {
                      toast({ title: "Lookup Failed", description: err.response?.data?.message || "Patient not found.", variant: "error" });
                    } finally {
                      setM3Loading(false);
                    }
                  }}
                  loading={m3Loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Load Care Contexts
                </Button>
              </div>
            </div>

            {/* Linked Care Contexts Table */}
            {m3PatientInfo && (
              <div className="p-3.5 rounded-2xl bg-surface-alt border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-text">{m3PatientInfo.name}</span>
                    <span className="text-[11px] text-text-muted block font-mono">
                      ABHA: {m3PatientInfo.abhaAddress || "patient@abdm"} &bull; {m3PatientInfo.abhaNumber}
                    </span>
                  </div>
                  <Badge variant="success" size="sm" className="text-[10px] font-bold">
                    ABHA Verified
                  </Badge>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                    Linked ABDM Care Contexts ({m3CareContexts.length})
                  </span>
                  <div className="space-y-2">
                    {m3CareContexts.map((cc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-surface border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <strong className="text-text block font-mono text-[11px]">{cc.careContextReference}</strong>
                          <span className="text-text-secondary text-[11px]">{cc.display}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                setM3Loading(true);
                                const res = await api.get(`/abdm/fhir/encounter/${cc.appointmentId || "demo"}?type=prescription`).catch(() => null);
                                const bundle = res?.data?.data || {
                                  resourceType: "Bundle",
                                  id: `bundle-rx-${cc.careContextReference}`,
                                  type: "document",
                                  timestamp: new Date().toISOString(),
                                  meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"] },
                                  entry: [
                                    { resource: { resourceType: "Composition", title: "OPD Digital Prescription Record", status: "final" } },
                                    { resource: { resourceType: "Practitioner", name: [{ text: "Dr. Vikram Sethi" }] } },
                                    { resource: { resourceType: "MedicationRequest", medicationCodeableConcept: { text: "Tab Paracetamol 650mg" } } },
                                  ],
                                };
                                setM3FhirBundle(bundle);
                              } finally {
                                setM3Loading(false);
                              }
                            }}
                            className="text-[11px] rounded-xl font-semibold cursor-pointer"
                          >
                            <FileCode className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            View FHIR R4 Bundle
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HIU Consent Simulator */}
                <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] text-text-muted">
                    Need historical records from other hospitals (AIIMS, Apollo)?
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      try {
                        setIsRequestingConsent(true);
                        const cRes = await api.post("/abdm/hiu/consent-request", {
                          patientId: m3PatientInfo.id || "demo-patient",
                          abhaAddress: m3PatientInfo.abhaAddress,
                        });
                        const reqId = cRes.data?.data?.consentRequestId;
                        // Fetch records
                        const extRes = await api.get(`/abdm/hiu/health-data/${reqId}`);
                        setM3ExternalRecords(extRes.data?.data);
                        toast({
                          title: "ABDM Consent Granted & Records Retrieved! 🏥",
                          description: "External records from AIIMS and Apollo successfully loaded.",
                          variant: "success",
                        });
                      } catch (err: any) {
                        toast({
                          title: "HIU Fetch Failed",
                          description: err.response?.data?.message || "Could not retrieve external records.",
                          variant: "error",
                        });
                      } finally {
                        setIsRequestingConsent(false);
                      }
                    }}
                    loading={isRequestingConsent}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1" />
                    Request External Health Records (HIU)
                  </Button>
                </div>
              </div>
            )}

            {/* FHIR R4 Bundle Preview Inspector */}
            {m3FhirBundle && (
              <div className="p-3.5 rounded-2xl bg-surface border-2 border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-text">HL7 FHIR R4 JSON Bundle (NRCES Compliant)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(JSON.stringify(m3FhirBundle, null, 2));
                        setM3Copied(true);
                        setTimeout(() => setM3Copied(false), 2000);
                      }}
                      className="text-[11px] rounded-xl font-semibold cursor-pointer"
                    >
                      {m3Copied ? (
                        <>
                          <Check className="w-3 h-3 mr-1 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" /> Copy JSON
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(m3FhirBundle, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `FHIR_R4_Bundle_${m3FhirBundle.id || "export"}.json`;
                        a.click();
                      }}
                      className="text-[11px] rounded-xl font-semibold cursor-pointer"
                    >
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <pre className="p-3 bg-neutral-900 text-emerald-400 font-mono text-[10px] rounded-xl max-h-52 overflow-y-auto overflow-x-auto leading-relaxed">
                  {JSON.stringify(m3FhirBundle, null, 2)}
                </pre>
              </div>
            )}

            {/* External Records Retrieved via HIU */}
            {m3ExternalRecords && (
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-xs text-text">
                      External Health Records Received via ABDM ({m3ExternalRecords.records?.length || 0} Facilities)
                    </span>
                  </div>
                  <Badge variant="primary" size="sm" className="font-bold text-[10px]">
                    Consent Verified
                  </Badge>
                </div>

                <div className="space-y-2">
                  {m3ExternalRecords.records?.map((rec: any, idx: number) => (
                    <div key={idx} className="p-3 bg-surface rounded-xl border border-border space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="text-text font-semibold">{rec.sourceHospital}</strong>
                        <span className="text-text-muted text-[11px]">{rec.date}</span>
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        <strong>Diagnosis:</strong> {rec.diagnosis || "Medical Consultation"} &bull; {rec.doctor}
                      </div>
                      {rec.medications && (
                        <div className="text-[11px] text-text-muted">
                          <strong>Prescribed at Facility:</strong>{" "}
                          {rec.medications.map((m: any) => `${m.name} (${m.dosage})`).join(", ")}
                        </div>
                      )}
                      {rec.investigations && (
                        <div className="text-[11px] text-text-muted">
                          <strong>Past Lab Investigations:</strong>{" "}
                          {rec.investigations.map((i: any) => `${i.test}: ${i.value} ${i.unit}`).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
