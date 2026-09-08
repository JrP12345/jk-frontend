"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select, useToast } from "@/components/ui";
import { UnifiedDocumentData, UnifiedDocumentModal } from "./UnifiedDocumentModal";
import { FileText, Building2, HeartPulse, CheckCircle2, ShieldAlert } from "lucide-react";

interface PatientContext {
  _id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  age?: number;
}

interface ClinicalDocumentGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  defaultDoctorName?: string;
  defaultDoctorSpecialization?: string;
  defaultDoctorRegistrationNumber?: string;
  defaultDoctorQualification?: string;
  defaultDoctorSignatureUrl?: string;
  patient?: PatientContext;
  onDocumentGenerated?: (doc: UnifiedDocumentData) => void;
}

type DocCategory = "referral" | "leave" | "fitness";

export function ClinicalDocumentGeneratorModal({
  open,
  onClose,
  clinicName = "City Health Clinic",
  clinicAddress = "42 Health Ave, Connaught Place, New Delhi",
  clinicPhone = "+91 98765 43210",
  clinicEmail = "care@cityhealth.in",
  defaultDoctorName = "Dr. Sameer Verma",
  defaultDoctorSpecialization = "Consultant Physician",
  defaultDoctorRegistrationNumber = "DMC-48291/2015",
  defaultDoctorQualification = "MBBS, MD (General Medicine)",
  defaultDoctorSignatureUrl,
  patient,
  onDocumentGenerated,
}: ClinicalDocumentGeneratorModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<DocCategory>("referral");

  // Doctor & Patient Header States
  const [docName, setDocName] = useState(defaultDoctorName);
  const [docSpecialty, setDocSpecialty] = useState(defaultDoctorSpecialization);
  const [docRegNo, setDocRegNo] = useState(defaultDoctorRegistrationNumber);
  const [docQual, setDocQual] = useState(defaultDoctorQualification);

  const [patientName, setPatientName] = useState("");
  const [patientAgeGender, setPatientAgeGender] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  // Referral State
  const [refHospital, setRefHospital] = useState("AIIMS Hospital / Department of Cardiology");
  const [refDept, setRefDept] = useState("Cardiology / Critical Care");
  const [refUrgency, setRefUrgency] = useState<"Routine" | "Urgent" | "Emergency / Immediate">("Urgent");
  const [refDiagnosis, setRefDiagnosis] = useState("Acute Coronary Syndrome / Unstable Angina");
  const [refSummary, setRefSummary] = useState(
    "Patient presented with severe retrosternal chest pain radiating to the left arm for the past 2 hours. Accompanied by diaphoresis and shortness of breath."
  );
  const [refInvestigations, setRefInvestigations] = useState(
    "ECG: ST depression in V4-V6 with T-wave inversion. Troponin T: Positive (bedside strip). Random Blood Sugar: 168 mg/dL."
  );
  const [refTreatmentGiven, setRefTreatmentGiven] = useState(
    "Tab. Aspirin 300mg stat chewed, Tab. Clopidogrel 300mg stat, Sublingual Nitroglycerin 0.4mg administered with partial relief, IV access secured with NS 100ml/hr."
  );
  const [refReason, setReason] = useState(
    "For emergency coronary angiography, primary PCI, and continuous cardiac telemetry monitoring."
  );

  // Sick Leave State
  const [leaveDiagnosis, setLeaveDiagnosis] = useState("Acute Viral Gastroenteritis with Dehydration");
  const [leaveDays, setLeaveDays] = useState(3);
  const todayStr = new Date().toISOString().split("T")[0];
  const [leaveStart, setLeaveStart] = useState(todayStr);
  const [leaveEnd, setLeaveEnd] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  );
  const [leaveResume, setLeaveResume] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]
  );
  const [leavePurpose, setLeavePurpose] = useState("Official Leave of Absence from Office / Employer");
  const [leaveRemarks, setLeaveRemarks] = useState(
    "Advised complete bed rest, adequate hydration with oral rehydration solution (ORS), and bland diet."
  );

  // Fitness Certificate State
  const [fitnessPurpose, setFitnessPurpose] = useState("Pre-Employment Physical Assessment");
  const [fitnessBp, setFitnessBp] = useState("120/80");
  const [fitnessPulse, setFitnessPulse] = useState("74");
  const [fitnessVisionL, setFitnessVisionL] = useState("6/6");
  const [fitnessVisionR, setFitnessVisionR] = useState("6/6");
  const [fitnessMark1, setFitnessMark1] = useState("Small black mole on right clavicle");
  const [fitnessMark2, setFitnessMark2] = useState("Linear scar 2cm on left forearm");
  const [fitnessSystemic, setFitnessSystemic] = useState(
    "CVS: S1, S2 audible, no murmurs. RS: Bilateral normal vesicular sounds. Abdomen: Soft, non-tender. CNS: Grossly intact."
  );
  const [isFit, setIsFit] = useState(true);
  const [fitnessDeclaration, setFitnessDeclaration] = useState(
    "I consider the candidate to be in sound physical and mental health, free from any communicable disease or constitutional infirmity, and physically fit for normal duties."
  );

  // Preview Modal state
  const [previewDoc, setPreviewDoc] = useState<UnifiedDocumentData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Sync patient info from props
  useEffect(() => {
    if (patient) {
      const pName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient";
      setPatientName(pName);
      setPatientPhone(patient.phone || "");
      const ageStr = patient.age ? `${patient.age} Y` : "";
      const genderStr = patient.gender ? patient.gender.toUpperCase() : "";
      setPatientAgeGender([ageStr, genderStr].filter(Boolean).join(" / "));
    }
  }, [patient]);

  // Recalculate leave end and resume dates when leaveStart or leaveDays change
  const handleDaysChange = (days: number) => {
    setLeaveDays(days);
    try {
      const s = new Date(leaveStart);
      const e = new Date(s.getTime() + (days - 1) * 86400000);
      const r = new Date(s.getTime() + days * 86400000);
      setLeaveEnd(e.toISOString().split("T")[0]);
      setLeaveResume(r.toISOString().split("T")[0]);
    } catch {
      // ignore date calculation errors
    }
  };

  const handleGenerate = () => {
    if (!patientName.trim()) {
      toast({
        title: "Patient Name Required",
        description: "Please specify patient name before generating certificate.",
        variant: "error",
      });
      return;
    }

    let generated: UnifiedDocumentData;

    const baseData = {
      clinicName,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      doctorName: docName,
      doctorSpecialization: docSpecialty,
      doctorRegistrationNumber: docRegNo,
      doctorQualification: docQual,
      doctorSignatureUrl: defaultDoctorSignatureUrl,
      patientName,
      patientAgeGender,
      patientPhone,
      patientId: patient?._id,
      date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      referenceNumber: `MED-${Date.now().toString().slice(-6)}`,
    };

    if (category === "referral") {
      generated = {
        ...baseData,
        documentType: "referral_letter",
        title: "Hospital Referral / Transfer Letter",
        referralDetails: {
          referredToDoctorOrHospital: refHospital,
          department: refDept,
          urgencyLevel: refUrgency,
          provisionalDiagnosis: refDiagnosis,
          clinicalSummary: refSummary,
          investigationsDone: refInvestigations,
          treatmentGivenSoFar: refTreatmentGiven,
          reasonForReferral: refReason,
        },
      };
    } else if (category === "leave") {
      generated = {
        ...baseData,
        documentType: "medical_certificate",
        title: "Medical Sick Leave Certificate",
        leaveCertificateDetails: {
          diagnosis: leaveDiagnosis,
          recommendedRestDays: leaveDays,
          restStartDate: leaveStart,
          restEndDate: leaveEnd,
          fitToResumeDate: leaveResume,
          purpose: leavePurpose,
          remarks: leaveRemarks,
        },
      };
    } else {
      generated = {
        ...baseData,
        documentType: "fitness_certificate",
        title: "Certificate of Medical Fitness",
        fitnessCertificateDetails: {
          purpose: fitnessPurpose,
          bloodPressure: fitnessBp,
          pulseRate: fitnessPulse,
          vision: {
            leftEye: fitnessVisionL,
            rightEye: fitnessVisionR,
          },
          identificationMarks: [fitnessMark1, fitnessMark2].filter(Boolean),
          systemicExamination: fitnessSystemic,
          isFit,
          fitnessDeclaration,
        },
      };
    }

    setPreviewDoc(generated);
    setShowPreview(true);
    if (onDocumentGenerated) {
      onDocumentGenerated(generated);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Official Medico-Legal & Clinical Document Generator"
        size="lg"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Category Tabs */}
          <div className="grid grid-cols-3 gap-2 bg-surface-alt p-1 rounded-xl border border-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setCategory("referral")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                category === "referral"
                  ? "bg-primary-600 text-white shadow"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Building2 className="w-4 h-4" />
              Tertiary Referral Letter
            </button>
            <button
              type="button"
              onClick={() => setCategory("leave")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                category === "leave"
                  ? "bg-primary-600 text-white shadow"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <FileText className="w-4 h-4" />
              Medical Sick Leave
            </button>
            <button
              type="button"
              onClick={() => setCategory("fitness")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                category === "fitness"
                  ? "bg-primary-600 text-white shadow"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              Fitness Certificate
            </button>
          </div>

          {/* Quick Doctor & Patient Strip */}
          <div className="p-3 bg-surface-alt/70 border border-border/80 rounded-xl space-y-2 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                label="Patient Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient Full Name"
              />
              <Input
                label="Age / Gender"
                value={patientAgeGender}
                onChange={(e) => setPatientAgeGender(e.target.value)}
                placeholder="e.g. 38 Y / Male"
              />
              <Input
                label="Phone Number"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
              <div>
                <span className="text-text-muted">Physician: </span>
                <span className="font-semibold text-text">{docName}</span> ({docQual})
              </div>
              <div className="text-right">
                <span className="text-text-muted">NMC / State Reg No: </span>
                <span className="font-mono font-bold text-primary-600">{docRegNo}</span>
              </div>
            </div>
          </div>

          {/* Category-Specific Form Fields */}

          {/* 1. Tertiary Referral Letter Form */}
          {category === "referral" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <Input
                    label="Referred To (Doctor / Hospital / Center)"
                    value={refHospital}
                    onChange={(e) => setRefHospital(e.target.value)}
                    placeholder="e.g. AIIMS / Apollo / Fortis Hospital"
                  />
                </div>
                <Select
                  label="Urgency Level"
                  value={refUrgency}
                  onChange={(e) =>
                    setRefUrgency(e.target.value as "Routine" | "Urgent" | "Emergency / Immediate")
                  }
                  options={[
                    { value: "Routine", label: "Routine Referral" },
                    { value: "Urgent", label: "Urgent (Within 24h)" },
                    { value: "Emergency / Immediate", label: "Emergency / Immediate" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  label="Target Specialty / Department"
                  value={refDept}
                  onChange={(e) => setRefDept(e.target.value)}
                  placeholder="e.g. Cardiology / Neurology / Orthopaedics"
                />
                <Input
                  label="Provisional / Working Diagnosis"
                  value={refDiagnosis}
                  onChange={(e) => setRefDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Coronary Syndrome"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Clinical History & Presenting Complaints
                </label>
                <textarea
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-text focus:ring-1 focus:ring-primary-500 min-h-[70px]"
                  value={refSummary}
                  onChange={(e) => setRefSummary(e.target.value)}
                  placeholder="Describe patient symptoms, duration, examination findings..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Investigations / Labs Done
                  </label>
                  <textarea
                    className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text min-h-[60px]"
                    value={refInvestigations}
                    onChange={(e) => setRefInvestigations(e.target.value)}
                    placeholder="ECG findings, bedside troponin, blood counts..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Emergency Care & Medication Given
                  </label>
                  <textarea
                    className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text min-h-[60px]"
                    value={refTreatmentGiven}
                    onChange={(e) => setRefTreatmentGiven(e.target.value)}
                    placeholder="Stat drugs administered, IV fluids, oxygen support..."
                  />
                </div>
              </div>

              <Input
                label="Reason & Indication for Referral"
                value={refReason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. For urgent PCI, MRI Brain, or specialized ICU admission"
              />
            </div>
          )}

          {/* 2. Medical Sick Leave Form */}
          {category === "leave" && (
            <div className="space-y-3">
              <Input
                label="Clinical Diagnosis Warranting Medical Leave"
                value={leaveDiagnosis}
                onChange={(e) => setLeaveDiagnosis(e.target.value)}
                placeholder="e.g. Acute Bronchitis / Viral Gastroenteritis"
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Days of Rest</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text"
                    value={leaveDays}
                    onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Input
                  label="Leave Start Date"
                  type="date"
                  value={leaveStart}
                  onChange={(e) => {
                    setLeaveStart(e.target.value);
                    handleDaysChange(leaveDays);
                  }}
                />
                <Input
                  label="Leave End Date"
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                />
                <Input
                  label="Fit to Resume On"
                  type="date"
                  value={leaveResume}
                  onChange={(e) => setLeaveResume(e.target.value)}
                />
              </div>

              <Input
                label="Purpose of Submission"
                value={leavePurpose}
                onChange={(e) => setLeavePurpose(e.target.value)}
                placeholder="e.g. Submission to Employer / University / School"
              />

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Medical Advice & Remarks
                </label>
                <textarea
                  className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text min-h-[60px]"
                  value={leaveRemarks}
                  onChange={(e) => setLeaveRemarks(e.target.value)}
                  placeholder="Bed rest advised, avoid strenuous work, dietary instructions..."
                />
              </div>
            </div>
          )}

          {/* 3. Medical Fitness Certificate Form */}
          {category === "fitness" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  label="Certificate Purpose"
                  value={fitnessPurpose}
                  onChange={(e) => setFitnessPurpose(e.target.value)}
                  placeholder="e.g. Employment, Academic Admission, Sports, Travel"
                />
                <Select
                  label="Assessment Finding"
                  value={isFit ? "fit" : "unfit"}
                  onChange={(e) => setIsFit(e.target.value === "fit")}
                  options={[
                    { value: "fit", label: "✅ Declared Medically Fit" },
                    { value: "unfit", label: "❌ Medically Unfit / Conditional" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input
                  label="Blood Pressure"
                  value={fitnessBp}
                  onChange={(e) => setFitnessBp(e.target.value)}
                  placeholder="120/80 mmHg"
                />
                <Input
                  label="Pulse Rate"
                  value={fitnessPulse}
                  onChange={(e) => setFitnessPulse(e.target.value)}
                  placeholder="72 bpm"
                />
                <Input
                  label="Vision (Left Eye)"
                  value={fitnessVisionL}
                  onChange={(e) => setFitnessVisionL(e.target.value)}
                  placeholder="6/6"
                />
                <Input
                  label="Vision (Right Eye)"
                  value={fitnessVisionR}
                  onChange={(e) => setFitnessVisionR(e.target.value)}
                  placeholder="6/6"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  label="Identification Mark 1"
                  value={fitnessMark1}
                  onChange={(e) => setFitnessMark1(e.target.value)}
                  placeholder="e.g. Mole on right cheek"
                />
                <Input
                  label="Identification Mark 2"
                  value={fitnessMark2}
                  onChange={(e) => setFitnessMark2(e.target.value)}
                  placeholder="e.g. Scar on left elbow"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Systemic Clinical Examination
                </label>
                <input
                  type="text"
                  className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text"
                  value={fitnessSystemic}
                  onChange={(e) => setFitnessSystemic(e.target.value)}
                  placeholder="CVS, RS, Abdomen, CNS findings..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Physician's Fitness Declaration
                </label>
                <textarea
                  className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-text min-h-[50px]"
                  value={fitnessDeclaration}
                  onChange={(e) => setFitnessDeclaration(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleGenerate}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Generate & Print Certificate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Embedded Document Preview / Print Modal */}
      {showPreview && previewDoc && (
        <UnifiedDocumentModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          document={previewDoc}
        />
      )}
    </>
  );
}
export default ClinicalDocumentGeneratorModal;
