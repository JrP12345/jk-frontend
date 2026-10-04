"use client";

import PrintDialogActions from "@/components/ui/PrintDialogActions";

import { getPrintBrandStyles, printHtml, PrintPreparationError } from "@/lib/printBrand";
import { formatCurrency } from "@/lib/currency";

import React, { useRef, useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { PrescriptionSealingBadge } from "./PrescriptionSealingBadge";

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
  currency?: string;
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
  
  // Medico-Legal NMC Cryptographic Sealing
  isSealed?: boolean;
  prescriptionHash?: string;
  digitalSignature?: string;
  sealedAt?: string;
  
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

const escapePrintText = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

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

  const handlePrint = async () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) throw new PrintPreparationError("not-ready");

    await printHtml(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapePrintText(document.title)} — ${escapePrintText(document.patientName)}</title>
          <style>${getPrintBrandStyles()}
            @page {
              size: A4;
              margin: ${isPreprinted ? "65mm 15mm 20mm 15mm" : "15mm 15mm 15mm 15mm"};
            }
            @media print {
              body {
                margin: 0 !important;
                padding: 0 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: var(--print-text);
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
              color: var(--print-text);
              background: #fff;
            }
            .header-banner {
              border-bottom: 2px solid var(--print-accent);
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .hospital-name {
              font-size: 20px;
              font-weight: 800;
              color: var(--print-accent-strong);
              margin: 0;
            }
            .doc-title {
              font-size: 14px;
              font-weight: 700;
              text-transform: uppercase;
              color: var(--print-accent);
              letter-spacing: 0.05em;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              background: var(--print-background);
              padding: 12px;
              border-radius: 8px;
              border: 1px solid var(--print-border);
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
              border: 1px solid var(--print-border);
              padding: 6px 10px;
              text-align: left;
            }
            .table-doc th {
              background: var(--print-surface-muted);
              font-weight: 700;
              color: var(--print-secondary);
            }
            .vitals-strip {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              padding: 6px 10px;
              background: var(--print-background);
              border: 1px solid var(--print-border);
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
              color: var(--print-secondary);
              border-top: 1px solid var(--print-border);
              padding-top: 12px;
            }
            .rx-symbol {
              font-size: 22px;
              font-weight: 900;
              font-family: Georgia, serif;
              color: var(--print-accent-strong);
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
  };

  return (
    <Modal open={open} onClose={onClose} title={`Preview ${document.title}`} size="lg"
      footer={<PrintDialogActions documentName={document.documentType.replace(/_/g, " ")} onPrint={handlePrint} onClose={onClose} />}>
      <div className="space-y-4">
        {/* Letterhead Print Mode Toolbar (for Prescriptions) */}
        {isPrescription && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface-alt rounded-xl border border-border/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text">Letterhead Mode:</span>
              <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5 bg-surface">
                <button
                  type="button"
                  onClick={() => setLetterheadMode("plain_a4")}
                  aria-pressed={letterheadMode === "plain_a4"}
                  className={`min-h-11 px-3 py-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    letterheadMode === "plain_a4"
                      ? "bg-primary-600 text-brand-mist shadow-2xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Plain A4
                </button>
                <button
                  type="button"
                  onClick={() => setLetterheadMode("preprinted_stationery")}
                  aria-pressed={letterheadMode === "preprinted_stationery"}
                  className={`min-h-11 px-3 py-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    letterheadMode === "preprinted_stationery"
                      ? "bg-warning text-background shadow-2xs"
                      : "text-text-muted hover:text-text"
                  }`}
                  title="Leaves top 65mm blank to feed directly into physical doctor/clinic letterhead pads"
                >
                  Preprinted clinic pad
                </button>
              </div>
            </div>

            {isPreprinted && (
              <span className="text-[11px] font-semibold text-warning-text dark:text-warning-text bg-warning/10 px-2 py-0.5 rounded-md border border-warning/20">
                Top 65mm header suppressed for physical stationery
              </span>
            )}
          </div>
        )}

        {/* Printable Document Container */}
        <div
          ref={printRef}
          className={`bg-white text-text text-xs shadow-sm rounded-xl border border-border space-y-4 transition-all ${
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
                <span className="text-[10px] uppercase tracking-widest font-black text-accent">
                  Ekavyu Healthcare Clinic System
                </span>
              </div>
              <h2 className="text-xl font-black text-text leading-tight">{document.clinicName}</h2>
              {document.clinicAddress && <p className="text-text-muted text-[11px]">{document.clinicAddress}</p>}
              {(document.clinicPhone || document.clinicEmail) && (
                <p className="text-text-muted text-[10px]">
                  {document.clinicPhone && `Tel: ${document.clinicPhone}`}
                  {document.clinicPhone && document.clinicEmail && " • "}
                  {document.clinicEmail && `Email: ${document.clinicEmail}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-accent-subtle text-accent font-bold rounded text-xs uppercase tracking-wide inline-block mb-1 border border-primary-200">
                {document.title}
              </span>
              <p className="text-text-muted text-[11px]">
                Date: <b>{document.date}</b>
              </p>
              {document.referenceNumber && (
                <p className="text-text-muted text-[11px] font-mono">Ref: {document.referenceNumber}</p>
              )}
            </div>
          </div>

          {/* Patient & Doctor Meta Banner */}
          <div className="grid grid-cols-2 gap-4 bg-surface p-3 rounded-lg border border-border text-xs">
            <div>
              <span className="text-text-muted block font-bold text-[10px] uppercase tracking-wider">Patient Details</span>
              <span className="font-bold text-text text-sm block">{document.patientName}</span>
              <div className="text-text-secondary text-[11px] space-y-0.5">
                {document.patientAgeGender && <div>Age/Gender: <b>{document.patientAgeGender}</b></div>}
                {document.patientPhone && <div>Phone: <b>{document.patientPhone}</b></div>}
                {document.patientId && <div className="text-text-muted font-mono text-[10px]">UHID: {document.patientId}</div>}
              </div>
            </div>

            <div className="text-right">
              <span className="text-text-muted block font-bold text-[10px] uppercase tracking-wider">Attending Physician</span>
              <span className="font-bold text-text text-sm block">
                Dr. {document.doctorName?.replace(/^Dr\.\s*/i, "") || "Physician"}
              </span>
              <div className="text-text-secondary text-[11px] space-y-0.5">
                {document.doctorQualification && <div>{document.doctorQualification}</div>}
                {document.doctorSpecialization && <div>Specialty: <b>{document.doctorSpecialization}</b></div>}
                {document.doctorRegistrationNumber && (
                  <div className="font-semibold text-accent font-mono text-[10.5px]">
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
              {/* NMC Cryptographic Seal & Verification Status */}
              <PrescriptionSealingBadge
                isSealed={document.isSealed}
                prescriptionHash={document.prescriptionHash}
                digitalSignature={document.digitalSignature}
                doctorRegistrationNumber={document.doctorRegistrationNumber}
                sealedAt={document.sealedAt}
              />

              {/* Pre-Consultation Vitals Summary */}
              {document.vitals && Object.keys(document.vitals).length > 0 && (
                <div className="vitals-strip">
                  <strong className="text-text-secondary font-bold uppercase text-[9.5px] mr-1">Vitals:</strong>
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
                  <strong className="text-text-secondary font-bold">Chief Complaints:</strong>{" "}
                  <span className="text-text">{document.symptoms}</span>
                </div>
              )}

              {/* Clinical Diagnoses */}
              {document.diagnoses && document.diagnoses.length > 0 && (
                <div>
                  <strong className="text-text-secondary block mb-1 font-bold text-[11.5px]">Diagnosis:</strong>
                  <div className="flex flex-wrap gap-1">
                    {document.diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-accent-subtle text-accent rounded font-bold text-[11px] border border-accent">
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
                    <strong className="text-text text-sm">Prescribed Medications</strong>
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
                          <td style={{ fontWeight: "bold", color: "var(--print-accent)" }}>{rx.name}</td>
                          <td>{rx.dosage}</td>
                          <td>{rx.duration}</td>
                          <td style={{ color: "var(--print-secondary)" }}>{rx.instructions || "As directed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* General Dietary & Lifestyle Advice */}
              {document.advice && (
                <div className="pt-1 text-[11.5px]">
                  <strong className="text-text block mb-0.5 font-bold">Dietary & Lifestyle Advice:</strong>
                  <p className="text-text-secondary bg-warning-subtle/70 p-2 rounded border border-warning/60 leading-relaxed">
                    {document.advice}
                  </p>
                </div>
              )}

              {/* Follow-Up Plan */}
              {(document.followUpTimeline || document.followUpNotes) && (
                <div className="p-2.5 rounded-lg bg-success-subtle/70 border border-success/80 text-[11px] flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-success-text font-bold">Recommended Follow-Up: </strong>
                    <span className="text-success-text font-semibold">
                      Review in {document.followUpTimeline || "1-2 weeks"}
                    </span>
                    {document.followUpNotes && (
                      <p className="text-success-text mt-0.5 text-[10.5px]">Note: {document.followUpNotes}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-success text-background font-bold rounded text-[10px] uppercase shrink-0">
                    SOS / Review
                  </span>
                </div>
              )}

              {/* Emergency Advisory */}
              <div className="text-[10px] text-text-muted italic pt-1">
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
                      <td style={{ textAlign: "right" }}>{formatCurrency(item.amount, document.currency)}</td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{formatCurrency(item.amount * item.quantity, document.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {document.invoiceTotals && (
                <div className="flex justify-end pt-2">
                  <div className="w-56 space-y-1 text-xs text-right">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Subtotal:</span>
                      <span className="font-semibold">{formatCurrency(document.invoiceTotals.subtotal, document.currency)}</span>
                    </div>
                    {document.invoiceTotals.discount > 0 && (
                      <div className="flex justify-between text-success-text">
                        <span>Discount:</span>
                        <span>- {formatCurrency(document.invoiceTotals.discount, document.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Tax:</span>
                      <span>{formatCurrency(document.invoiceTotals.tax, document.currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-text border-t border-border pt-1">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(document.invoiceTotals.total, document.currency)}</span>
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
                      <td style={{ fontWeight: "bold", color: "var(--print-accent)" }}>
                        {res.result} {res.unit || ""}
                      </td>
                      <td style={{ color: "var(--print-muted)" }}>{res.referenceRange || "Normal"}</td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{res.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Token Slip */}
          {document.documentType === "token_slip" && document.tokenDetails && (
            <div className="text-center py-6 space-y-2 border-2 border-dashed border-border rounded-xl bg-surface">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest block">Queue Token Number</span>
              <span className="text-5xl font-black text-accent block">#{document.tokenDetails.tokenNumber}</span>
              {document.tokenDetails.estWaitTime !== undefined && (
                <span className="text-xs text-warning-text font-bold block">
                  Estimated Wait: {document.tokenDetails.estWaitTime} mins
                </span>
              )}
            </div>
          )}

          {/* 5. Tertiary Hospital Clinical Referral Letter */}
          {document.documentType === "referral_letter" && document.referralDetails && (
            <div className="space-y-4">
              {/* Referral Destination & Urgency Banner */}
              <div className="p-3.5 rounded-xl bg-accent-subtle   border border-accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-accent block">
                      Referral Destination / Tertiary Facility
                    </span>
                    <span className="text-base font-extrabold text-accent">
                      {document.referralDetails.referredToDoctorOrHospital}
                    </span>
                    {document.referralDetails.department && (
                      <span className="text-xs text-accent font-medium block">
                        Department: <b>{document.referralDetails.department}</b>
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      document.referralDetails.urgencyLevel === "Emergency / Immediate"
                        ? "bg-danger text-background animate-pulse"
                        : document.referralDetails.urgencyLevel === "Urgent"
                        ? "bg-warning text-background"
                        : "bg-accent-subtle text-accent"
                    }`}>
                      {document.referralDetails.urgencyLevel || "Routine Referral"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indication / Diagnosis */}
              <div className="border border-border rounded-lg p-3 bg-white space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-text-muted block">Provisional / Working Diagnosis</span>
                  <p className="text-sm font-bold text-text mt-0.5">{document.referralDetails.provisionalDiagnosis}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-text-muted block">Reason for Specialized Referral</span>
                  <p className="text-xs text-text font-medium mt-0.5">{document.referralDetails.reasonForReferral}</p>
                </div>
              </div>

              {/* Clinical Summary & History */}
              <div className="border border-border rounded-lg p-3 bg-white space-y-2">
                <span className="text-[10px] font-bold uppercase text-text-muted block">Clinical Summary & Presenting History</span>
                <p className="text-xs text-text whitespace-pre-wrap leading-relaxed">
                  {document.referralDetails.clinicalSummary}
                </p>
              </div>

              {/* Investigations & Treatment Given */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {document.referralDetails.investigationsDone && (
                  <div className="border border-border rounded-lg p-3 bg-surface/70">
                    <span className="text-[10px] font-bold uppercase text-text-secondary block">Investigations Done So Far</span>
                    <p className="text-xs text-text mt-1 whitespace-pre-wrap">
                      {document.referralDetails.investigationsDone}
                    </p>
                  </div>
                )}
                {document.referralDetails.treatmentGivenSoFar && (
                  <div className="border border-border rounded-lg p-3 bg-surface/70">
                    <span className="text-[10px] font-bold uppercase text-text-secondary block">Emergency Care / Treatment Given</span>
                    <p className="text-xs text-text mt-1 whitespace-pre-wrap">
                      {document.referralDetails.treatmentGivenSoFar}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-text-muted bg-surface p-2.5 rounded-lg border border-dashed border-border">
                <strong className="text-text-secondary">Referring Physician Note: </strong>
                Kindly evaluate the patient and initiate tertiary interventional / inpatient management as deemed appropriate. Please communicate any findings back to our OPD for continuity of care.
              </div>
            </div>
          )}

          {/* 6. Medical Sick Leave Certificate */}
          {document.documentType === "medical_certificate" && (
            <div className="space-y-4 py-2">
              <div className="text-center py-2 border-b border-border">
                <span className="text-xs font-black uppercase tracking-widest text-accent">Official Medico-Legal Document</span>
                <h3 className="text-lg font-black text-text mt-0.5">CERTIFICATE OF MEDICAL ILLNESS & RECOMMENDED LEAVE</h3>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface/50 space-y-3.5 text-xs text-text leading-relaxed">
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
                          <span className="text-[10px] font-bold text-text-muted uppercase block">Leave Period</span>
                          <span className="font-bold text-text">
                            {document.leaveCertificateDetails.recommendedRestDays} Day(s) (From {document.leaveCertificateDetails.restStartDate} to {document.leaveCertificateDetails.restEndDate})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase block">Fit to Resume Duties On</span>
                          <span className="font-black text-success-text">{document.leaveCertificateDetails.fitToResumeDate}</span>
                        </div>
                      </div>

                      {document.leaveCertificateDetails.purpose && (
                        <div className="pt-1 border-t border-border text-[11px] text-text-secondary">
                          <span className="font-semibold text-text-secondary">Submitted for: </span>
                          {document.leaveCertificateDetails.purpose}
                        </div>
                      )}

                      {document.leaveCertificateDetails.remarks && (
                        <div className="text-[11px] text-text-secondary">
                          <span className="font-semibold text-text-secondary">Doctor's Clinical Remarks: </span>
                          {document.leaveCertificateDetails.remarks}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{document.certificateText || "The patient was examined and advised medical rest for recuperation."}</p>
                )}

                <p className="text-[10.5px] text-text-muted italic">
                  * This certificate is issued upon physical examination of the patient for official / workplace submission. Validated under Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations.
                </p>
              </div>
            </div>
          )}

          {/* 7. Medical Fitness Certificate */}
          {document.documentType === "fitness_certificate" && (
            <div className="space-y-4 py-2">
              <div className="text-center py-2 border-b border-border">
                <span className="text-xs font-black uppercase tracking-widest text-success-text">Physical & Health Assessment</span>
                <h3 className="text-lg font-black text-text mt-0.5">CERTIFICATE OF MEDICAL FITNESS</h3>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface/50 space-y-3.5 text-xs text-text leading-relaxed">
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
                <div className="flex items-center justify-between p-3.5 bg-success-subtle rounded-xl border border-success">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-success-text block tracking-wider">Clinical Assessment Finding</span>
                    <span className="text-base font-black text-success-text">
                      {document.fitnessCertificateDetails?.isFit !== false ? "DECLARED MEDICALLY FIT" : "MEDICALLY UNFIT / CONDITIONAL"}
                    </span>
                  </div>
                  <span className="text-2xl">✅</span>
                </div>

                {/* Clinical Exam Findings Grid */}
                {document.fitnessCertificateDetails && (
                  <div className="bg-white rounded-lg border border-border p-3 space-y-2.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Examination Findings</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      {document.fitnessCertificateDetails.bloodPressure && (
                        <div>
                          <span className="text-text-muted block text-[10px]">Blood Pressure:</span>
                          <span className="font-bold text-text">{document.fitnessCertificateDetails.bloodPressure} mmHg</span>
                        </div>
                      )}
                      {document.fitnessCertificateDetails.pulseRate && (
                        <div>
                          <span className="text-text-muted block text-[10px]">Pulse Rate:</span>
                          <span className="font-bold text-text">{document.fitnessCertificateDetails.pulseRate} bpm</span>
                        </div>
                      )}
                      {document.fitnessCertificateDetails.vision && (
                        <div>
                          <span className="text-text-muted block text-[10px]">Visual Acuity:</span>
                          <span className="font-bold text-text">
                            L: {document.fitnessCertificateDetails.vision.leftEye || "6/6"} | R: {document.fitnessCertificateDetails.vision.rightEye || "6/6"}
                          </span>
                        </div>
                      )}
                    </div>

                    {document.fitnessCertificateDetails.identificationMarks && document.fitnessCertificateDetails.identificationMarks.length > 0 && (
                      <div className="pt-2 border-t border-border text-[11px]">
                        <span className="text-text-muted font-bold block text-[10px] uppercase">Identification Marks:</span>
                        <ul className="list-disc list-inside text-text-secondary font-medium">
                          {document.fitnessCertificateDetails.identificationMarks.map((mark, mIdx) => (
                            <li key={mIdx}>{mark}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {document.fitnessCertificateDetails.systemicExamination && (
                      <div className="pt-2 border-t border-border text-[11px]">
                        <span className="text-text-muted font-bold block text-[10px] uppercase">Systemic Examination:</span>
                        <p className="text-text-secondary">{document.fitnessCertificateDetails.systemicExamination}</p>
                      </div>
                    )}
                  </div>
                )}

                <p className="font-medium text-text bg-white p-2.5 rounded-lg border border-border text-xs">
                  {document.fitnessCertificateDetails?.fitnessDeclaration ||
                    "I consider the candidate to be in sound physical and mental health, free from any communicable disease or constitutional defect, and physically fit to discharge all duties."}
                </p>
              </div>
            </div>
          )}

          {/* Reusable Footer Signature & Verification Seal */}
          <div className="footer-sign">
            <div className={isPreprinted ? "suppress-on-stationery" : ""}>
              <p className="font-semibold text-text-secondary">Generated via Ekavyu Healthcare Platform</p>
              <p className="font-mono text-[10px] text-text-muted">Electronic Clinical Audit Token: Validated</p>
            </div>
            <div className="text-right">
              {document.doctorSignatureUrl ? (
                <img
                  src={document.doctorSignatureUrl}
                  alt="Doctor Signature"
                  className="h-10 max-w-[140px] ml-auto object-contain mb-1"
                />
              ) : (
                <div className="h-10 w-36 border-b border-border mb-1 ml-auto"></div>
              )}
              <span className="font-bold text-text block text-xs">
                Dr. {document.doctorName?.replace(/^Dr\.\s*/i, "") || "Attending Physician"}
              </span>
              {document.doctorQualification && (
                <span className="text-[10px] text-text-muted block">{document.doctorQualification}</span>
              )}
              {document.doctorRegistrationNumber && (
                <span className="text-[10px] font-mono text-text-secondary block font-semibold">
                  Reg No: {document.doctorRegistrationNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}

      </div>
    </Modal>
  );
}
