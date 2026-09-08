"use client";

import React, { useRef, useState, useEffect } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export type DocumentType =
  | "prescription"
  | "invoice"
  | "lab_report"
  | "discharge_summary"
  | "medical_certificate"
  | "fitness_certificate"
  | "referral_letter"
  | "token_slip";

export interface UnifiedDocumentData {
  documentType: DocumentType;
  title: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorRegistrationNumber?: string; // e.g. "MCI-48291/2014" or "DMC-19283"
  doctorQualification?: string; // e.g. "MBBS, MD (General Medicine)"
  doctorSignatureUrl?: string; // Digital signature image URL or data URL
  patientName: string;
  patientAgeGender?: string;
  patientId?: string;
  patientPhone?: string;
  date: string;
  referenceNumber?: string;
  
  // Specific payload sections
  prescriptions?: Array<{ name: string; dosage: string; frequency?: string; duration: string; instructions?: string }>;
  diagnoses?: Array<{ code?: string; description: string }>;
  symptoms?: string;
  advice?: string;
  followUpTimeline?: string;
  followUpNotes?: string;
  vitals?: Record<string, any>;
  invoiceItems?: Array<{ description: string; quantity: number; amount: number }>;
  invoiceTotals?: { subtotal: number; tax: number; discount: number; total: number; status: string };
  labResults?: Array<{ testName: string; result: string; unit?: string; referenceRange?: string; status: string }>;
  dischargeSummary?: { admissionDate: string; dischargeDate: string; summary: string; advice: string };
  certificateText?: string;
  
  // Medico-legal & Referral payloads
  referralDetails?: {
    referredToDoctorOrHospital: string;
    department?: string;
    provisionalDiagnosis: string;
    clinicalSummary: string;
    investigationsDone?: string;
    treatmentGivenSoFar?: string;
    reasonForReferral: string;
    urgencyLevel?: "Routine" | "Urgent" | "Emergency / Immediate";
  };
  leaveCertificateDetails?: {
    diagnosis: string;
    recommendedRestDays: number;
    restStartDate: string;
    restEndDate: string;
    fitToResumeDate: string;
    purpose?: string;
    remarks?: string;
  };
  fitnessCertificateDetails?: {
    purpose: string;
    identificationMarks?: string[];
    bloodPressure?: string;
    pulseRate?: string;
    vision?: { leftEye?: string; rightEye?: string; colorBlindness?: string };
    systemicExamination?: string;
    isFit: boolean;
    fitnessDeclaration: string;
  };

  tokenDetails?: { tokenNumber: number; estWaitTime?: number };
  letterheadMode?: "plain_a4" | "preprinted_stationery";
}

interface UnifiedDocumentModalProps {
  open: boolean;
  onClose: () => void;
  document: UnifiedDocumentData | null;
}

export function UnifiedDocumentModal({ open, onClose, document }: UnifiedDocumentModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [letterheadMode, setLetterheadMode] = useState<"plain_a4" | "preprinted_stationery">("plain_a4");

  useEffect(() => {
    if (document?.letterheadMode) {
      setLetterheadMode(document.letterheadMode);
    } else {
      setLetterheadMode("plain_a4");
    }
  }, [document]);

  if (!document) return null;

  const isPrescription = document.documentType === "prescription";
  const isPreprinted = letterheadMode === "preprinted_stationery" && isPrescription;

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.title} — ${document.patientName}</title>
          <style>
            @page {
              size: A4;
              margin: ${isPreprinted ? "65mm 15mm 20mm 15mm" : "15mm 15mm 15mm 15mm"};
            }
            @media print {
              body {
                margin: 0 !important;
                padding: 0 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                background: #fff;
                font-size: 11pt;
                line-height: 1.4;
              }
              .no-print { display: none !important; }
              ${isPreprinted ? ".suppress-on-stationery { display: none !important; }" : ""}
              .page-break { page-break-before: always; }
              table { page-break-inside: avoid; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 24px;
              color: #111827;
              background: #fff;
            }
            .header-banner {
              border-bottom: 2px solid #2563eb;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .hospital-name {
              font-size: 20px;
              font-weight: 800;
              color: #1e40af;
              margin: 0;
            }
            .doc-title {
              font-size: 14px;
              font-weight: 700;
              text-transform: uppercase;
              color: #2563eb;
              letter-spacing: 0.05em;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              background: #f9fafb;
              padding: 12px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              margin-bottom: 16px;
              font-size: 12px;
            }
            .table-doc {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 11px;
            }
            .table-doc th, .table-doc td {
              border: 1px solid #e5e7eb;
              padding: 6px 10px;
              text-align: left;
            }
            .table-doc th {
              background: #f3f4f6;
              font-weight: 700;
              color: #374151;
            }
            .vitals-strip {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              padding: 6px 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 10.5px;
              margin-bottom: 12px;
            }
            .vitals-item {
              display: inline-flex;
              align-items: center;
              gap: 4px;
            }
            .footer-sign {
              margin-top: 36px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 11px;
              color: #4b5563;
              border-top: 1px solid #e5e7eb;
              padding-top: 12px;
            }
            .rx-symbol {
              font-size: 22px;
              font-weight: 900;
              font-family: Georgia, serif;
              color: #1e40af;
              line-height: 1;
              display: inline-block;
              margin-right: 6px;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Preview Official ${document.title}`} size="lg">
      <div className="space-y-4">
        {/* Letterhead Print Mode Toolbar (for Prescriptions) */}
        {isPrescription && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface-alt rounded-xl border border-border/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text">Letterhead Mode:</span>
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
                <button
                  type="button"
                  onClick={() => setLetterheadMode("plain_a4")}
                  className={`px-3 py-1 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    letterheadMode === "plain_a4"
                      ? "bg-primary-600 text-white shadow-2xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  📄 Plain A4 (Full Digital Header)
                </button>
                <button
                  type="button"
                  onClick={() => setLetterheadMode("preprinted_stationery")}
                  className={`px-3 py-1 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    letterheadMode === "preprinted_stationery"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-text-muted hover:text-text"
                  }`}
                  title="Leaves top 65mm blank to feed directly into physical doctor/clinic letterhead pads"
                >
                  📋 Pre-Printed Clinic Pad (Offset 65mm)
                </button>
              </div>
            </div>

            {isPreprinted && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Top 65mm header suppressed for physical stationery
              </span>
            )}
          </div>
        )}

        {/* Printable Document Container */}
        <div
          ref={printRef}
          className={`bg-white text-zinc-900 text-xs shadow-sm rounded-xl border border-zinc-200 space-y-4 transition-all ${
            isPreprinted ? "pt-16 p-6" : "p-6"
          }`}
        >
          {/* Letterhead Header (Suppressed in Pre-Printed Stationery Mode) */}
          <div
            className={`border-b-2 border-primary-600 pb-3 flex justify-between items-start ${
              isPreprinted ? "suppress-on-stationery hidden" : ""
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-primary-600">
                  ANANT Healthcare Clinic System
                </span>
              </div>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{document.clinicName}</h2>
              {document.clinicAddress && <p className="text-zinc-500 text-[11px]">{document.clinicAddress}</p>}
              {(document.clinicPhone || document.clinicEmail) && (
                <p className="text-zinc-400 text-[10px]">
                  {document.clinicPhone && `Tel: ${document.clinicPhone}`}
                  {document.clinicPhone && document.clinicEmail && " • "}
                  {document.clinicEmail && `Email: ${document.clinicEmail}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-primary-50 text-primary-700 font-bold rounded text-xs uppercase tracking-wide inline-block mb-1 border border-primary-200">
                {document.title}
              </span>
              <p className="text-zinc-500 text-[11px]">
                Date: <b>{document.date}</b>
              </p>
              {document.referenceNumber && (
                <p className="text-zinc-500 text-[11px] font-mono">Ref: {document.referenceNumber}</p>
              )}
            </div>
          </div>

          {/* Patient & Doctor Meta Banner */}
          <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
            <div>
              <span className="text-zinc-400 block font-bold text-[10px] uppercase tracking-wider">Patient Details</span>
              <span className="font-bold text-zinc-900 text-sm block">{document.patientName}</span>
              <div className="text-zinc-600 text-[11px] space-y-0.5">
                {document.patientAgeGender && <div>Age/Gender: <b>{document.patientAgeGender}</b></div>}
                {document.patientPhone && <div>Phone: <b>{document.patientPhone}</b></div>}
                {document.patientId && <div className="text-zinc-400 font-mono text-[10px]">UHID: {document.patientId}</div>}
              </div>
            </div>

            <div className="text-right">
              <span className="text-zinc-400 block font-bold text-[10px] uppercase tracking-wider">Attending Physician</span>
              <span className="font-bold text-zinc-900 text-sm block">
                Dr. {document.doctorName?.replace(/^Dr\.\s*/i, "") || "Physician"}
              </span>
              <div className="text-zinc-600 text-[11px] space-y-0.5">
                {document.doctorQualification && <div>{document.doctorQualification}</div>}
                {document.doctorSpecialization && <div>Specialty: <b>{document.doctorSpecialization}</b></div>}
                {document.doctorRegistrationNumber && (
                  <div className="font-semibold text-primary-700 font-mono text-[10.5px]">
                    NMC/MCI Reg: {document.doctorRegistrationNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DOCUMENT TYPE SPECIFIC CONTENTS */}

          {/* 1. Prescription (Rx) */}
          {isPrescription && (
            <div className="space-y-3">
              {/* Pre-Consultation Vitals Summary */}
              {document.vitals && Object.keys(document.vitals).length > 0 && (
                <div className="vitals-strip">
                  <strong className="text-zinc-700 font-bold uppercase text-[9.5px] mr-1">Vitals:</strong>
                  {document.vitals.bloodPressure && (
                    <span className="vitals-item">
                      BP: <b>{document.vitals.bloodPressure} mmHg</b>
                    </span>
                  )}
                  {document.vitals.pulse && (
                    <span className="vitals-item">
                      • Pulse: <b>{document.vitals.pulse} bpm</b>
                    </span>
                  )}
                  {document.vitals.spo2 && (
                    <span className="vitals-item">
                      • SpO2: <b>{document.vitals.spo2}%</b>
                    </span>
                  )}
                  {document.vitals.temperature && (
                    <span className="vitals-item">
                      • Temp: <b>{document.vitals.temperature}°F</b>
                    </span>
                  )}
                  {document.vitals.weight && (
                    <span className="vitals-item">
                      • Weight: <b>{document.vitals.weight} kg</b>
                    </span>
                  )}
                  {document.vitals.bmi && (
                    <span className="vitals-item">
                      • BMI: <b>{document.vitals.bmi}</b>
                    </span>
                  )}
                </div>
              )}

              {/* Symptoms / Chief Complaint */}
              {document.symptoms && (
                <div className="text-[11.5px]">
                  <strong className="text-zinc-700 font-bold">Chief Complaints:</strong>{" "}
                  <span className="text-zinc-800">{document.symptoms}</span>
                </div>
              )}

              {/* Clinical Diagnoses */}
              {document.diagnoses && document.diagnoses.length > 0 && (
                <div>
                  <strong className="text-zinc-700 block mb-1 font-bold text-[11.5px]">Diagnosis:</strong>
                  <div className="flex flex-wrap gap-1">
                    {document.diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-bold text-[11px] border border-blue-100">
                        {d.description} {d.code ? `(${d.code})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medication Table */}
              {document.prescriptions && document.prescriptions.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center mb-1">
                    <span className="rx-symbol">℞</span>
                    <strong className="text-zinc-900 text-sm">Prescribed Medications</strong>
                  </div>
                  <table className="table-doc">
                    <thead>
                      <tr>
                        <th style={{ width: "30px" }}>#</th>
                        <th>Medicine Name & Strength</th>
                        <th style={{ width: "130px" }}>Dosage</th>
                        <th style={{ width: "90px" }}>Duration</th>
                        <th>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.prescriptions.map((rx, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>{idx + 1}</td>
                          <td style={{ fontWeight: "bold", color: "#1d4ed8" }}>{rx.name}</td>
                          <td>{rx.dosage}</td>
                          <td>{rx.duration}</td>
                          <td style={{ color: "#4b5563" }}>{rx.instructions || "As directed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* General Dietary & Lifestyle Advice */}
              {document.advice && (
                <div className="pt-1 text-[11.5px]">
                  <strong className="text-zinc-800 block mb-0.5 font-bold">Dietary & Lifestyle Advice:</strong>
                  <p className="text-zinc-700 bg-amber-50/70 p-2 rounded border border-amber-200/60 leading-relaxed">
                    {document.advice}
                  </p>
                </div>
              )}

              {/* Follow-Up Plan */}
              {(document.followUpTimeline || document.followUpNotes) && (
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-emerald-900 font-bold">Recommended Follow-Up: </strong>
                    <span className="text-emerald-800 font-semibold">
                      Review in {document.followUpTimeline || "1-2 weeks"}
                    </span>
                    {document.followUpNotes && (
                      <p className="text-emerald-700 mt-0.5 text-[10.5px]">Note: {document.followUpNotes}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px] uppercase shrink-0">
                    SOS / Review
                  </span>
                </div>
              )}

              {/* Emergency Advisory */}
              <div className="text-[10px] text-zinc-500 italic pt-1">
                * In case of acute chest pain, severe breathlessness, high unyielding fever, or any sudden distress, please visit the nearest hospital emergency room immediately.
              </div>
            </div>
          )}

          {/* 2. Official Invoice */}
          {document.documentType === "invoice" && (
            <div className="space-y-3">
              <table className="table-doc">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ textAlign: "center", width: "60px" }}>Qty</th>
                    <th style={{ textAlign: "right", width: "100px" }}>Unit Price</th>
                    <th style={{ textAlign: "right", width: "100px" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {document.invoiceItems?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{item.description}</td>
                      <td style={{ textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>₹{item.amount}</td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>₹{item.amount * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {document.invoiceTotals && (
                <div className="flex justify-end pt-2">
                  <div className="w-56 space-y-1 text-xs text-right">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Subtotal:</span>
                      <span className="font-semibold">₹{document.invoiceTotals.subtotal}</span>
                    </div>
                    {document.invoiceTotals.discount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount:</span>
                        <span>- ₹{document.invoiceTotals.discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Tax:</span>
                      <span>₹{document.invoiceTotals.tax}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-zinc-900 border-t border-zinc-300 pt-1">
                      <span>Total Amount:</span>
                      <span>₹{document.invoiceTotals.total}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Lab Test Report */}
          {document.documentType === "lab_report" && (
            <div className="space-y-3">
              <table className="table-doc">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Result Value</th>
                    <th>Reference Range</th>
                    <th style={{ textAlign: "center", width: "90px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {document.labResults?.map((res, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "bold" }}>{res.testName}</td>
                      <td style={{ fontWeight: "bold", color: "#1d4ed8" }}>
                        {res.result} {res.unit || ""}
                      </td>
                      <td style={{ color: "#6b7280" }}>{res.referenceRange || "Normal"}</td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{res.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Token Slip */}
          {document.documentType === "token_slip" && document.tokenDetails && (
            <div className="text-center py-6 space-y-2 border-2 border-dashed border-zinc-300 rounded-xl bg-zinc-50">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Queue Token Number</span>
              <span className="text-5xl font-black text-primary-600 block">#{document.tokenDetails.tokenNumber}</span>
              {document.tokenDetails.estWaitTime !== undefined && (
                <span className="text-xs text-amber-700 font-bold block">
                  Estimated Wait: {document.tokenDetails.estWaitTime} mins
                </span>
              )}
            </div>
          )}

          {/* 5. Tertiary Hospital Clinical Referral Letter */}
          {document.documentType === "referral_letter" && document.referralDetails && (
            <div className="space-y-4">
              {/* Referral Destination & Urgency Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                      Referral Destination / Tertiary Facility
                    </span>
                    <span className="text-base font-extrabold text-blue-950">
                      {document.referralDetails.referredToDoctorOrHospital}
                    </span>
                    {document.referralDetails.department && (
                      <span className="text-xs text-blue-800 font-medium block">
                        Department: <b>{document.referralDetails.department}</b>
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      document.referralDetails.urgencyLevel === "Emergency / Immediate"
                        ? "bg-rose-600 text-white animate-pulse"
                        : document.referralDetails.urgencyLevel === "Urgent"
                        ? "bg-amber-500 text-white"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {document.referralDetails.urgencyLevel || "Routine Referral"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indication / Diagnosis */}
              <div className="border border-zinc-200 rounded-lg p-3 bg-white space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">Provisional / Working Diagnosis</span>
                  <p className="text-sm font-bold text-zinc-900 mt-0.5">{document.referralDetails.provisionalDiagnosis}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">Reason for Specialized Referral</span>
                  <p className="text-xs text-zinc-800 font-medium mt-0.5">{document.referralDetails.reasonForReferral}</p>
                </div>
              </div>

              {/* Clinical Summary & History */}
              <div className="border border-zinc-200 rounded-lg p-3 bg-white space-y-2">
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">Clinical Summary & Presenting History</span>
                <p className="text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">
                  {document.referralDetails.clinicalSummary}
                </p>
              </div>

              {/* Investigations & Treatment Given */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {document.referralDetails.investigationsDone && (
                  <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/70">
                    <span className="text-[10px] font-bold uppercase text-zinc-600 block">Investigations Done So Far</span>
                    <p className="text-xs text-zinc-800 mt-1 whitespace-pre-wrap">
                      {document.referralDetails.investigationsDone}
                    </p>
                  </div>
                )}
                {document.referralDetails.treatmentGivenSoFar && (
                  <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/70">
                    <span className="text-[10px] font-bold uppercase text-zinc-600 block">Emergency Care / Treatment Given</span>
                    <p className="text-xs text-zinc-800 mt-1 whitespace-pre-wrap">
                      {document.referralDetails.treatmentGivenSoFar}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-lg border border-dashed border-zinc-300">
                <strong className="text-zinc-700">Referring Physician Note: </strong>
                Kindly evaluate the patient and initiate tertiary interventional / inpatient management as deemed appropriate. Please communicate any findings back to our OPD for continuity of care.
              </div>
            </div>
          )}

          {/* 6. Medical Sick Leave Certificate */}
          {document.documentType === "medical_certificate" && (
            <div className="space-y-4 py-2">
              <div className="text-center py-2 border-b border-zinc-200">
                <span className="text-xs font-black uppercase tracking-widest text-primary-700">Official Medico-Legal Document</span>
                <h3 className="text-lg font-black text-zinc-900 mt-0.5">CERTIFICATE OF MEDICAL ILLNESS & RECOMMENDED LEAVE</h3>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3.5 text-xs text-zinc-800 leading-relaxed">
                <p>
                  This is to officially certify that <b>Mr. / Ms. {document.patientName}</b>
                  {document.patientAgeGender ? `, aged ${document.patientAgeGender}` : ""}
                  {document.patientPhone ? `, contact ${document.patientPhone}` : ""}, has been under my direct medical consultation and clinical evaluation at this healthcare facility.
                </p>

                {document.leaveCertificateDetails ? (
                  <>
                    <p>
                      The patient was diagnosed with <b>{document.leaveCertificateDetails.diagnosis}</b> and was suffering from symptoms of such severity that complete physical rest and absence from official duties / educational activities was medically essential for recuperation and recovery.
                    </p>

                    <div className="p-3 bg-white rounded-lg border border-primary-200 shadow-sm space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Leave Period</span>
                          <span className="font-bold text-zinc-900">
                            {document.leaveCertificateDetails.recommendedRestDays} Day(s) (From {document.leaveCertificateDetails.restStartDate} to {document.leaveCertificateDetails.restEndDate})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Fit to Resume Duties On</span>
                          <span className="font-black text-emerald-700">{document.leaveCertificateDetails.fitToResumeDate}</span>
                        </div>
                      </div>

                      {document.leaveCertificateDetails.purpose && (
                        <div className="pt-1 border-t border-zinc-100 text-[11px] text-zinc-600">
                          <span className="font-semibold text-zinc-700">Submitted for: </span>
                          {document.leaveCertificateDetails.purpose}
                        </div>
                      )}

                      {document.leaveCertificateDetails.remarks && (
                        <div className="text-[11px] text-zinc-600">
                          <span className="font-semibold text-zinc-700">Doctor's Clinical Remarks: </span>
                          {document.leaveCertificateDetails.remarks}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{document.certificateText || "The patient was examined and advised medical rest for recuperation."}</p>
                )}

                <p className="text-[10.5px] text-zinc-500 italic">
                  * This certificate is issued upon physical examination of the patient for official / workplace submission. Validated under Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations.
                </p>
              </div>
            </div>
          )}

          {/* 7. Medical Fitness Certificate */}
          {document.documentType === "fitness_certificate" && (
            <div className="space-y-4 py-2">
              <div className="text-center py-2 border-b border-zinc-200">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-700">Physical & Health Assessment</span>
                <h3 className="text-lg font-black text-zinc-900 mt-0.5">CERTIFICATE OF MEDICAL FITNESS</h3>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3.5 text-xs text-zinc-800 leading-relaxed">
                <p>
                  I, <b>Dr. {document.doctorName?.replace(/^Dr\.\s*/i, "") || "Attending Medical Officer"}</b>,
                  {document.doctorQualification ? ` ${document.doctorQualification},` : ""}
                  {document.doctorRegistrationNumber ? ` registered medical practitioner (Reg No: ${document.doctorRegistrationNumber}),` : ""}
                  do hereby certify that I have carefully and thoroughly examined <b>Mr. / Ms. {document.patientName}</b>
                  {document.patientAgeGender ? `, aged ${document.patientAgeGender}` : ""}
                  {document.patientPhone ? `, Contact ${document.patientPhone}` : ""}
                  {document.fitnessCertificateDetails?.purpose ? ` for the purpose of ${document.fitnessCertificateDetails.purpose}` : ""}.
                </p>

                {/* Fitness Status Badge */}
                <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Clinical Assessment Finding</span>
                    <span className="text-base font-black text-emerald-900">
                      {document.fitnessCertificateDetails?.isFit !== false ? "DECLARED MEDICALLY FIT" : "MEDICALLY UNFIT / CONDITIONAL"}
                    </span>
                  </div>
                  <span className="text-2xl">✅</span>
                </div>

                {/* Clinical Exam Findings Grid */}
                {document.fitnessCertificateDetails && (
                  <div className="bg-white rounded-lg border border-zinc-200 p-3 space-y-2.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Examination Findings</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      {document.fitnessCertificateDetails.bloodPressure && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">Blood Pressure:</span>
                          <span className="font-bold text-zinc-900">{document.fitnessCertificateDetails.bloodPressure} mmHg</span>
                        </div>
                      )}
                      {document.fitnessCertificateDetails.pulseRate && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">Pulse Rate:</span>
                          <span className="font-bold text-zinc-900">{document.fitnessCertificateDetails.pulseRate} bpm</span>
                        </div>
                      )}
                      {document.fitnessCertificateDetails.vision && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">Visual Acuity:</span>
                          <span className="font-bold text-zinc-900">
                            L: {document.fitnessCertificateDetails.vision.leftEye || "6/6"} | R: {document.fitnessCertificateDetails.vision.rightEye || "6/6"}
                          </span>
                        </div>
                      )}
                    </div>

                    {document.fitnessCertificateDetails.identificationMarks && document.fitnessCertificateDetails.identificationMarks.length > 0 && (
                      <div className="pt-2 border-t border-zinc-100 text-[11px]">
                        <span className="text-zinc-500 font-bold block text-[10px] uppercase">Identification Marks:</span>
                        <ul className="list-disc list-inside text-zinc-700 font-medium">
                          {document.fitnessCertificateDetails.identificationMarks.map((mark, mIdx) => (
                            <li key={mIdx}>{mark}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {document.fitnessCertificateDetails.systemicExamination && (
                      <div className="pt-2 border-t border-zinc-100 text-[11px]">
                        <span className="text-zinc-500 font-bold block text-[10px] uppercase">Systemic Examination:</span>
                        <p className="text-zinc-700">{document.fitnessCertificateDetails.systemicExamination}</p>
                      </div>
                    )}
                  </div>
                )}

                <p className="font-medium text-zinc-900 bg-white p-2.5 rounded-lg border border-zinc-200 text-xs">
                  {document.fitnessCertificateDetails?.fitnessDeclaration ||
                    "I consider the candidate to be in sound physical and mental health, free from any communicable disease or constitutional defect, and physically fit to discharge all duties."}
                </p>
              </div>
            </div>
          )}

          {/* Reusable Footer Signature & Verification Seal */}
          <div className="footer-sign">
            <div className={isPreprinted ? "suppress-on-stationery" : ""}>
              <p className="font-semibold text-zinc-600">Generated via ANANT Healthcare Clinic OS</p>
              <p className="font-mono text-[10px] text-zinc-400">Electronic Clinical Audit Token: Validated</p>
            </div>
            <div className="text-right">
              {document.doctorSignatureUrl ? (
                <img
                  src={document.doctorSignatureUrl}
                  alt="Doctor Signature"
                  className="h-10 max-w-[140px] ml-auto object-contain mb-1"
                />
              ) : (
                <div className="h-10 w-36 border-b border-zinc-400 mb-1 ml-auto"></div>
              )}
              <span className="font-bold text-zinc-900 block text-xs">
                Dr. {document.doctorName?.replace(/^Dr\.\s*/i, "") || "Attending Physician"}
              </span>
              {document.doctorQualification && (
                <span className="text-[10px] text-zinc-500 block">{document.doctorQualification}</span>
              )}
              {document.doctorRegistrationNumber && (
                <span className="text-[10px] font-mono text-zinc-600 block font-semibold">
                  Reg No: {document.doctorRegistrationNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>
            🖨️ Print / Save PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
