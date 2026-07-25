"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { SOAPService } from "@/services/soap.service";
import { Modal, Button, Badge, Spinner, Textarea, Select } from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "./UnifiedDocumentModal";
import { PreviousVisitsSidebar } from "./PreviousVisitsSidebar";

interface SOAPNoteEditorProps {
  patientId: string;
  clinicId: string;
  encounterId?: string;
  appointmentId?: string;
  doctorId?: string;
  initialNoteId?: string;
  onSaved?: () => void;
}

export function SOAPNoteEditor({ patientId, clinicId, encounterId: initialEncounterId, appointmentId, doctorId, initialNoteId, onSaved }: SOAPNoteEditorProps) {
  const [encounterId, setEncounterId] = useState<string | null>(initialEncounterId || null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(initialNoteId || null);
  const [isSigned, setIsSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [activePatientId, setActivePatientId] = useState<string>(patientId && patientId !== "dummy-patient-id" ? patientId : "");
  const [activeClinicId, setActiveClinicId] = useState<string>(clinicId && clinicId !== "dummy-clinic-id" ? clinicId : "");

  // Local Storage Autosave Draft Recovery State
  const [recoveredDraft, setRecoveredDraft] = useState<any | null>(null);
  const draftStorageKey = `soap_draft_${appointmentId || patientId}`;

  // History Drawer State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Amend Modal State
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [submittingAmend, setSubmittingAmend] = useState(false);

  // SOAP Form State
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  
  // Vitals State
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spO2, setSpO2] = useState("");
  const [temperatureF, setTemperatureF] = useState("");
  const [physicalExamination, setPhysicalExamination] = useState("");

  // Assessment & Diagnoses State
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [severity, setSeverity] = useState("moderate");

  // Plan State
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medDuration, setMedDuration] = useState("");
  const [prescriptions, setPrescriptions] = useState<Array<{ name: string; dosage: string; duration: string }>>([]);

  // Medicine Autocomplete State
  const [medicineResults, setMedicineResults] = useState<any[]>([]);
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [searchingMeds, setSearchingMeds] = useState(false);
  const [selectedMedStock, setSelectedMedStock] = useState<number | null>(null);

  // Clinical Templates Pre-built List
  const CLINICAL_TEMPLATES = [
    {
      id: "uri",
      name: "Upper Respiratory Infection (URI)",
      chiefComplaint: "Fever, sore throat, cough and nasal congestion for 3 days",
      historyOfPresentIllness: "Patient reports sudden onset of low-grade fever accompanied by scratchy throat and dry cough.",
      symptomsText: "Fever, Sore throat, Cough, Nasal Congestion",
      physicalExamination: "Pharynx erythematous, no exudates. Chest bilaterally clear to auscultation. No lymphadenopathy.",
      primaryDiagnosis: "Acute upper respiratory infection, unspecified",
      icdCode: "J06.9",
      severity: "mild",
      treatmentPlan: "Rest, warm fluid intake, saline nasal rinse. Follow-up if symptoms persist beyond 7 days.",
      prescriptions: [
        { name: "Paracetamol 500mg", dosage: "1 tablet", duration: "5 days" },
        { name: "Cetirizine 10mg", dosage: "1 tablet", duration: "5 days" },
      ],
    },
    {
      id: "htn",
      name: "Hypertension Routine Follow-up",
      chiefComplaint: "Routine hypertension follow-up check",
      historyOfPresentIllness: "Patient taking prescribed anti-hypertensive regimen regularly. Reports no chest pain or shortness of breath.",
      symptomsText: "Asymptomatic",
      physicalExamination: "BP 130/84 mmHg, Pulse 72 bpm. S1 S2 heard, no murmurs. Pedals clear.",
      primaryDiagnosis: "Essential (primary) hypertension",
      icdCode: "I10",
      severity: "moderate",
      treatmentPlan: "Continue current anti-hypertensive medication. Low-sodium diet, regular aerobic exercise.",
      prescriptions: [
        { name: "Amlodipine 5mg", dosage: "1 tablet", duration: "30 days" },
      ],
    },
    {
      id: "dm2",
      name: "Type 2 Diabetes Routine Check",
      chiefComplaint: "Routine Type 2 Diabetes follow-up & blood sugar review",
      historyOfPresentIllness: "Patient reports adherence to diabetic diet and medication. No signs of hypoglycemia or peripheral neuropathy.",
      symptomsText: "No active complaints",
      physicalExamination: "Abdomen soft, non-tender. Monofilament test normal bilaterally. Foot inspection clear.",
      primaryDiagnosis: "Type 2 diabetes mellitus without complications",
      icdCode: "E11.9",
      severity: "moderate",
      treatmentPlan: "Monitor fasting & post-prandial blood sugar weekly. Continue Metformin regimen.",
      prescriptions: [
        { name: "Metformin 500mg", dosage: "1 tablet", duration: "30 days" },
      ],
    },
    {
      id: "gastritis",
      name: "Acute Gastritis / Dyspepsia",
      chiefComplaint: "Epigastric burning pain and nausea after meals for 2 days",
      historyOfPresentIllness: "Patient reports burning discomfort in upper abdomen, exacerbated by spicy food.",
      symptomsText: "Epigastric pain, Nausea, Heartburn",
      physicalExamination: "Abdomen soft, mild epigastric tenderness on deep palpation. Bowel sounds active.",
      primaryDiagnosis: "Acute gastritis, unspecified",
      icdCode: "K29.00",
      severity: "moderate",
      treatmentPlan: "Avoid spicy and fried foods. Take PPI 30 mins before breakfast.",
      prescriptions: [
        { name: "Pantoprazole 40mg", dosage: "1 tablet", duration: "14 days" },
        { name: "Antacid Oral Suspension", dosage: "10ml", duration: "7 days" },
      ],
    },
  ];

  const handleApplyTemplate = (templateId: string) => {
    const tpl = CLINICAL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setChiefComplaint(tpl.chiefComplaint);
    setHistoryOfPresentIllness(tpl.historyOfPresentIllness);
    setSymptomsText(tpl.symptomsText);
    setPhysicalExamination(tpl.physicalExamination);
    setPrimaryDiagnosis(tpl.primaryDiagnosis);
    setIcdCode(tpl.icdCode);
    setSeverity(tpl.severity);
    setTreatmentPlan(tpl.treatmentPlan);
    setPrescriptions(tpl.prescriptions);
  };

  const handleCopyForwardVisit = (note: any) => {
    if (note.subjective?.chiefComplaint) setChiefComplaint(note.subjective.chiefComplaint);
    if (note.subjective?.historyOfPresentIllness) setHistoryOfPresentIllness(note.subjective.historyOfPresentIllness);
    if (note.subjective?.symptoms) setSymptomsText(note.subjective.symptoms.join(", "));
    if (note.objective?.physicalExamination) setPhysicalExamination(note.objective.physicalExamination);
    if (note.assessment?.diagnoses?.[0]) {
      setPrimaryDiagnosis(note.assessment.diagnoses[0].description || "");
      setIcdCode(note.assessment.diagnoses[0].code || "");
    }
    if (note.plan?.treatmentPlan) setTreatmentPlan(note.plan.treatmentPlan);
    if (note.plan?.prescriptions && note.plan.prescriptions.length > 0) {
      setPrescriptions(note.plan.prescriptions.map((p: any) => ({
        name: p.name || p.medicineName,
        dosage: p.dosage || "1 tablet",
        duration: p.duration || "5 days",
      })));
    }
  };

  // Medicine Autocomplete Search Effect
  useEffect(() => {
    if (!medName.trim() || medName.length < 2) {
      setMedicineResults([]);
      setShowMedDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingMeds(true);
        const res = await api.get(`/medicines?search=${encodeURIComponent(medName.trim())}`);
        const list = res.data?.data || [];
        setMedicineResults(list);
        setShowMedDropdown(list.length > 0);
      } catch {
        setMedicineResults([]);
        setShowMedDropdown(false);
      } finally {
        setSearchingMeds(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [medName]);

  // Print Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);

  const handleOpenPrintModal = () => {
    setUnifiedDoc({
      documentType: "prescription",
      title: "PRESCRIPTION RX",
      clinicName: "ANANTA Healthcare System",
      doctorName: "Attending Physician",
      doctorSpecialization: "Outpatient General Medicine",
      patientName: "Patient Profile",
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      diagnoses: primaryDiagnosis ? [{ code: icdCode, description: primaryDiagnosis }] : [],
      vitals: {
        bp: bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
        pulse: pulseRate || undefined,
        temp: temperatureF || undefined,
        spO2: spO2 || undefined,
      },
      prescriptions: prescriptions.length > 0
        ? prescriptions.map(p => ({ ...p, frequency: (p as any).frequency || "1-0-1" }))
        : (medName ? [{ name: medName, dosage: medDosage, frequency: "1-0-1", duration: medDuration }] : []),
    });
    setPrintModalOpen(true);
  };

  // Check LocalStorage for Unsaved Draft on Mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.chiefComplaint) {
          setRecoveredDraft(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [draftStorageKey]);

  // Periodic LocalStorage Autosave (every 5 seconds if draft is active & unsigned)
  useEffect(() => {
    if (isSigned || !chiefComplaint.trim()) return;

    const timer = setInterval(() => {
      try {
        const draftObj = {
          chiefComplaint,
          historyOfPresentIllness,
          symptomsText,
          bpSystolic,
          bpDiastolic,
          pulseRate,
          spO2,
          temperatureF,
          physicalExamination,
          primaryDiagnosis,
          icdCode,
          severity,
          treatmentPlan,
          prescriptions,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(draftObj));
      } catch {
        // Ignore storage write errors
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [
    isSigned, chiefComplaint, historyOfPresentIllness, symptomsText,
    bpSystolic, bpDiastolic, pulseRate, spO2, temperatureF,
    physicalExamination, primaryDiagnosis, icdCode, severity,
    treatmentPlan, prescriptions, draftStorageKey
  ]);

  const handleApplyRecoveredDraft = () => {
    if (!recoveredDraft) return;
    setChiefComplaint(recoveredDraft.chiefComplaint || "");
    setHistoryOfPresentIllness(recoveredDraft.historyOfPresentIllness || "");
    setSymptomsText(recoveredDraft.symptomsText || "");
    setBpSystolic(recoveredDraft.bpSystolic || "");
    setBpDiastolic(recoveredDraft.bpDiastolic || "");
    setPulseRate(recoveredDraft.pulseRate || "");
    setSpO2(recoveredDraft.spO2 || "");
    setTemperatureF(recoveredDraft.temperatureF || "");
    setPhysicalExamination(recoveredDraft.physicalExamination || "");
    setPrimaryDiagnosis(recoveredDraft.primaryDiagnosis || "");
    setIcdCode(recoveredDraft.icdCode || "");
    setSeverity(recoveredDraft.severity || "moderate");
    setTreatmentPlan(recoveredDraft.treatmentPlan || "");
    setPrescriptions(recoveredDraft.prescriptions || []);
    setRecoveredDraft(null);
    setMessage({ type: "success", text: "Recovered unsaved draft from local storage" });
  };

  const handleDiscardRecoveredDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {}
    setRecoveredDraft(null);
  };

  useEffect(() => {
    if (appointmentId && (!activePatientId || !activeClinicId)) {
      api.get("/appointments").then((res) => {
        const list = res.data?.data || [];
        const appt = list.find((a: any) => a.id === appointmentId || a._id === appointmentId);
        if (appt) {
          const pId = appt.patientId?.id || appt.patientId?._id || appt.patientId;
          const cId = appt.clinicId?.id || appt.clinicId?._id || appt.clinicId;
          if (pId) setActivePatientId(typeof pId === "object" ? (pId.id || pId._id) : pId);
          if (cId) setActiveClinicId(typeof cId === "object" ? (cId.id || cId._id) : cId);
        }
      }).catch(() => {});
    }
  }, [appointmentId, activePatientId, activeClinicId]);

  const handleAddMedication = () => {
    if (!medName || !medDosage) return;
    setPrescriptions((prev) => [...prev, { name: medName, dosage: medDosage, duration: medDuration || "5 days" }]);
    setMedName("");
    setMedDosage("");
    setMedDuration("");
  };

  const handleStartEncounter = async (): Promise<string | null> => {
    if (encounterId) return encounterId;
    try {
      const res = await api.post("/encounters", {
        clinicId: activeClinicId || clinicId,
        patientId: activePatientId || patientId,
        appointmentId,
        encounterType: "opd",
      });
      const newEncounterId = res.data?.data?.id || res.data?.data?._id || res.data?.id || res.data?._id;
      if (!newEncounterId) throw new Error("Failed to start encounter");
      setEncounterId(newEncounterId);
      return newEncounterId;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to start encounter";
      setMessage({ type: "error", text: errMsg });
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (!chiefComplaint.trim()) {
      setMessage({ type: "error", text: "Chief complaint is required" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const activeEncounterId = await handleStartEncounter();
      if (!activeEncounterId) return;

      const symptoms = symptomsText.split(",").map((s) => s.trim()).filter(Boolean);
      const diagnoses = primaryDiagnosis.trim()
        ? [{ code: icdCode || "CUSTOM", codingSystem: icdCode ? "ICD-10" : "CUSTOM", description: primaryDiagnosis.trim(), status: "active" }]
        : [];

      const payload = {
        clinicId: activeClinicId || clinicId,
        encounterId: activeEncounterId,
        patientId: activePatientId || patientId,
        chiefComplaint,
        historyOfPresentIllness,
        symptoms,
        physicalExamination,
        diagnoses,
        severity,
        treatmentPlan,
        vitals: {
          bpSystolic: bpSystolic ? Number(bpSystolic) : undefined,
          bpDiastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
          pulseRate: pulseRate ? Number(pulseRate) : undefined,
          spO2: spO2 ? Number(spO2) : undefined,
          temperatureF: temperatureF ? Number(temperatureF) : undefined,
        },
        prescriptions,
      };

      const savedNote = await SOAPService.saveDraft(payload);
      if (savedNote?.id || savedNote?._id) {
        setCurrentNoteId(savedNote.id || savedNote._id);
      }

      // Clear local storage draft after successful server save
      try { localStorage.removeItem(draftStorageKey); } catch {}

      setMessage({ type: "success", text: "Draft SOAP note saved successfully" });
      if (onSaved) onSaved();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to save draft SOAP note";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSignNote = async () => {
    if (!currentNoteId) {
      setMessage({ type: "error", text: "Please save draft note before signing" });
      return;
    }
    setSigning(true);
    setMessage(null);
    try {
      await SOAPService.signNote(currentNoteId);
      setIsSigned(true);
      setMessage({ type: "success", text: "Clinical note signed successfully. Immutable lock applied." });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to sign note";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setSigning(false);
    }
  };

  const handleFetchHistory = async () => {
    const pId = activePatientId || patientId;
    if (!pId) return;
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await SOAPService.getNoteHistory(pId);
      setHistoryList(res?.notes || res || []);
    } catch {
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNoteId || !amendmentReason.trim()) return;
    setSubmittingAmend(true);
    try {
      const symptoms = symptomsText.split(",").map((s) => s.trim()).filter(Boolean);
      const diagnoses = primaryDiagnosis.trim()
        ? [{ code: icdCode || "CUSTOM", codingSystem: icdCode ? "ICD-10" : "CUSTOM", description: primaryDiagnosis.trim(), status: "active" }]
        : [];

      const amended = await SOAPService.amendNote(currentNoteId, {
        amendmentReason,
        subjective: { chiefComplaint, historyOfPresentIllness, symptoms },
        objective: { physicalExamination },
        assessment: { diagnoses, severity },
        plan: { treatmentPlan, prescriptions },
      });

      if (amended?.id || amended?._id) {
        setCurrentNoteId(amended.id || amended._id);
      }
      setIsSigned(false);
      setAmendOpen(false);
      setAmendmentReason("");
      setMessage({ type: "success", text: "Clinical note amended successfully. New draft version created." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to amend note" });
    } finally {
      setSubmittingAmend(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#12131a] rounded-xl border border-zinc-200 dark:border-[#1e1f26] p-6 space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#1e1f26] pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Clinical SOAP Consultation Note</h2>
          <p className="text-xs text-zinc-500">Standardized medical documentation workspace</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Load Clinical Template Dropdown */}
          {!isSigned && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyTemplate(e.target.value);
                  e.target.value = "";
                }
              }}
              className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-amber-100"
            >
              <option value="">⚡ Load Template...</option>
              {CLINICAL_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleOpenPrintModal}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-all border border-blue-200 dark:border-blue-800"
          >
            🖨️ Print Rx PDF
          </button>
          <button
            type="button"
            onClick={handleFetchHistory}
            className="px-3 py-1.5 bg-zinc-100 dark:bg-[#1a1b23] hover:bg-zinc-200 dark:hover:bg-[#252631] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all border border-zinc-200 dark:border-[#252631]"
          >
            📜 Version History
          </button>

          {!isSigned ? (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={loading || signing}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Draft SOAP Note"}
              </button>

              {currentNoteId && (
                <button
                  type="button"
                  onClick={handleSignNote}
                  disabled={signing || loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                >
                  {signing ? "Signing..." : "Sign & Lock Note"}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5">
                ✓ Signed & Locked Note
              </span>

              <button
                type="button"
                onClick={() => setAmendOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
              >
                Amend Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recovered Unsaved Local Draft Banner */}
      {recoveredDraft && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
          <div>
            <b>Unsaved Local Draft Detected:</b> Saved locally at {new Date(recoveredDraft.savedAt).toLocaleTimeString()}.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleApplyRecoveredDraft} className="px-3 py-1 bg-amber-600 text-white rounded font-bold text-[11px]">
              Restore Draft
            </button>
            <button type="button" onClick={handleDiscardRecoveredDraft} className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-medium text-[11px]">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Consultation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active SOAP Note Editor */}
        <div className="lg:col-span-2 space-y-4">

      {message && (
        <div className={`p-3 rounded-lg text-sm border ${message.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      {/* 4 SOAP Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* S: Subjective */}
        <div className="p-4 bg-zinc-50 dark:bg-[#1a1b23] rounded-xl border border-zinc-200 dark:border-[#252631] space-y-3">
          <h3 className="font-semibold text-sm text-primary-600 dark:text-primary-400">S — Subjective (Patient Complaints)</h3>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Chief Complaint *</label>
            <input
              type="text"
              placeholder="e.g. High fever, productive cough for 3 days"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Symptoms (comma-separated)</label>
            <input
              type="text"
              placeholder="Fever, Cough, Myalgia"
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">History of Present Illness (HPI)</label>
            <textarea
              rows={2}
              placeholder="Detailed clinical history..."
              value={historyOfPresentIllness}
              onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>
        </div>

        {/* O: Objective */}
        <div className="p-4 bg-zinc-50 dark:bg-[#1a1b23] rounded-xl border border-zinc-200 dark:border-[#252631] space-y-3">
          <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400">O — Objective (Vitals & Physical Exam)</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">BP Systolic</label>
              <input type="number" placeholder="120" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} disabled={isSigned} className="w-full mt-1 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded disabled:opacity-60" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">BP Diastolic</label>
              <input type="number" placeholder="80" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} disabled={isSigned} className="w-full mt-1 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded disabled:opacity-60" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Heart Rate (bpm)</label>
              <input type="number" placeholder="72" value={pulseRate} onChange={(e) => setPulseRate(e.target.value)} disabled={isSigned} className="w-full mt-1 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded disabled:opacity-60" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">SpO₂ (%)</label>
              <input type="number" placeholder="98" value={spO2} onChange={(e) => setSpO2(e.target.value)} disabled={isSigned} className="w-full mt-1 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded disabled:opacity-60" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Temp (°F)</label>
              <input type="number" step="0.1" placeholder="98.6" value={temperatureF} onChange={(e) => setTemperatureF(e.target.value)} disabled={isSigned} className="w-full mt-1 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded disabled:opacity-60" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Physical Examination Notes</label>
            <textarea
              rows={2}
              placeholder="Systemic examination findings..."
              value={physicalExamination}
              onChange={(e) => setPhysicalExamination(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>
        </div>

        {/* A: Assessment */}
        <div className="p-4 bg-zinc-50 dark:bg-[#1a1b23] rounded-xl border border-zinc-200 dark:border-[#252631] space-y-3">
          <h3 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">A — Assessment (Diagnosis & Coding)</h3>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Primary Diagnosis</label>
            <input
              type="text"
              placeholder="e.g. Acute Bronchitis"
              value={primaryDiagnosis}
              onChange={(e) => setPrimaryDiagnosis(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">ICD-10 Code</label>
              <input
                type="text"
                placeholder="J20.9"
                value={icdCode}
                onChange={(e) => setIcdCode(e.target.value)}
                disabled={isSigned}
                className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
              />
            </div>
            <div className="w-1/2">
              <Select
                label="Severity"
                size="sm"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                disabled={isSigned}
                options={[
                  { value: "mild", label: "Mild" },
                  { value: "moderate", label: "Moderate" },
                  { value: "acute", label: "Acute" },
                  { value: "severe", label: "Severe" }
                ]}
              />
            </div>
          </div>
        </div>

        {/* P: Plan */}
        <div className="p-4 bg-zinc-50 dark:bg-[#1a1b23] rounded-xl border border-zinc-200 dark:border-[#252631] space-y-3">
          <h3 className="font-semibold text-sm text-amber-600 dark:text-amber-400">P — Plan (Treatment & Rx Builder)</h3>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Treatment Plan</label>
            <textarea
              rows={2}
              placeholder="Clinical recommendations..."
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              disabled={isSigned}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-[#12131a] border border-zinc-200 dark:border-[#252631] rounded-lg disabled:opacity-60"
            />
          </div>

          {/* Rx Medication Add Bar with Catalog Autocomplete */}
          <div className="space-y-2 border-t border-zinc-200 dark:border-[#252631] pt-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Add Rx Medication (Search Catalog)</span>
              {selectedMedStock !== null && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedMedStock < 10 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  Inventory Stock: {selectedMedStock} units
                </span>
              )}
            </div>

            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search Drug Name or Generic..."
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  onFocus={() => { if (medicineResults.length > 0) setShowMedDropdown(true); }}
                  disabled={isSigned}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-[#12131a] border rounded disabled:opacity-60"
                />

                {/* Autocomplete Dropdown Overlay */}
                {showMedDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1a1b23] border border-border shadow-lg rounded-lg z-50 max-h-48 overflow-y-auto divide-y divide-border text-xs">
                    {searchingMeds ? (
                      <div className="p-2 text-center text-text-muted">Searching catalog...</div>
                    ) : (
                      medicineResults.map((m) => (
                        <div
                          key={m.id || m._id}
                          onClick={() => {
                            setMedName(`${m.name} (${m.genericName})`);
                            setSelectedMedStock(m.stockQuantity);
                            setShowMedDropdown(false);
                          }}
                          className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-text block">{m.name}</span>
                            <span className="text-[11px] text-text-secondary">{m.genericName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-primary-600">₹{m.price}</span>
                            <span className="text-[10px] text-text-muted block">Stock: {m.stockQuantity}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <input type="text" placeholder="Dosage (e.g. 1 tab)" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} disabled={isSigned} className="w-28 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border rounded disabled:opacity-60" />
              <input type="text" placeholder="Duration" value={medDuration} onChange={(e) => setMedDuration(e.target.value)} disabled={isSigned} className="w-24 px-2 py-1 text-xs bg-white dark:bg-[#12131a] border rounded disabled:opacity-60" />
              <button type="button" onClick={handleAddMedication} disabled={isSigned} className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 disabled:opacity-50">Add Rx</button>
            </div>

            {prescriptions.length > 0 && (
              <div className="space-y-1 pt-1">
                {prescriptions.map((p, i) => (
                  <div key={i} className="text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#12131a] px-3 py-1.5 rounded border border-zinc-200 dark:border-[#252631] flex justify-between items-center">
                    <span><b>{i + 1}.</b> {p.name} — {p.dosage} ({p.duration})</span>
                    {!isSigned && (
                      <button
                        type="button"
                        onClick={() => setPrescriptions((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Right Column: Patient Previous Visits Sidebar */}
        <div className="lg:col-span-1">
          <PreviousVisitsSidebar
            patientId={activePatientId || patientId}
            onCopyForward={handleCopyForwardVisit}
          />
        </div>
      </div>

      {/* Version History Modal */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Clinical Note Version History">
        {loadingHistory ? (
          <div className="py-8 text-center"><Spinner size="lg" label="Loading version tree..." /></div>
        ) : historyList.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historyList.map((item) => (
              <div key={item.id || item._id} className="p-3 rounded-lg border border-border bg-surface text-xs space-y-1">
                <div className="flex justify-between items-center font-bold">
                  <span>Version {item.version || 1} {item.isFinal ? "(Signed)" : "(Draft)"}</span>
                  <Badge variant={item.isFinal ? "success" : "warning"}>{new Date(item.createdAt).toLocaleDateString()}</Badge>
                </div>
                <div><b>Chief Complaint:</b> {item.subjective?.chiefComplaint}</div>
                <div><b>Primary Diagnosis:</b> {item.assessment?.diagnoses?.[0]?.description || "N/A"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-text-muted">No historical note versions found for this patient.</div>
        )}
      </Modal>

      {/* Amend Note Modal */}
      <Modal isOpen={amendOpen} onClose={() => setAmendOpen(false)} title="Amend Signed Clinical Note">
        <form onSubmit={handleAmendSubmit} className="space-y-4">
          <Textarea
            label="Reason for Amendment *"
            placeholder="e.g. Corrected patient reported duration of symptoms from 3 days to 5 days."
            value={amendmentReason}
            onChange={(e) => setAmendmentReason(e.target.value)}
            rows={3}
            required
          />
          <Button type="submit" loading={submittingAmend} fullWidth variant="warning">
            Create Amended Version
          </Button>
        </form>
      </Modal>

      {/* Official Prescription PDF Modal */}
      <UnifiedDocumentModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        document={unifiedDoc}
      />
    </div>
  );
}
