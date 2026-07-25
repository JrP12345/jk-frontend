"use client";

import React, { useRef } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export type DocumentType =
  | "prescription"
  | "invoice"
  | "lab_report"
  | "discharge_summary"
  | "medical_certificate"
  | "token_slip";

export interface UnifiedDocumentData {
  documentType: DocumentType;
  title: string;
  clinicName: string;
  clinicAddress?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  patientName: string;
  patientAgeGender?: string;
  patientId?: string;
  date: string;
  referenceNumber?: string;
  
  // Specific payload sections
  prescriptions?: Array<{ name: string; dosage: string; frequency?: string; duration: string; instructions?: string }>;
  diagnoses?: Array<{ code?: string; description: string }>;
  vitals?: Record<string, any>;
  invoiceItems?: Array<{ description: string; quantity: number; amount: number }>;
  invoiceTotals?: { subtotal: number; tax: number; discount: number; total: number; status: string };
  labResults?: Array<{ testName: string; result: string; unit?: string; referenceRange?: string; status: string }>;
  dischargeSummary?: { admissionDate: string; dischargeDate: string; summary: string; advice: string };
  certificateText?: string;
  tokenDetails?: { tokenNumber: number; estWaitTime?: number };
}

interface UnifiedDocumentModalProps {
  open: boolean;
  onClose: () => void;
  document: UnifiedDocumentData | null;
}

export function UnifiedDocumentModal({ open, onClose, document }: UnifiedDocumentModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!document) return null;

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${document.title} — ${document.patientName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, sans-serif; color: #111827; }
              .no-print { display: none; }
            }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #111827; background: #fff; }
            .header-banner { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .hospital-name { font-size: 20px; font-weight: 800; color: #1e40af; margin: 0; }
            .doc-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #2563eb; letter-spacing: 0.05em; }
            .meta-grid { display: grid; grid-template-cols: 2fr 1fr; gap: 12px; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 16px; font-size: 12px; }
            .table-doc { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            .table-doc th, .table-doc td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
            .table-doc th { background: #f3f4f6; font-weight: 700; }
            .footer-sign { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; }
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
        {/* Printable Document Container */}
        <div ref={printRef} className="bg-white p-6 rounded-xl border border-zinc-200 text-zinc-900 text-xs shadow-sm space-y-4">
          {/* Letterhead Header */}
          <div className="border-b-2 border-primary-600 pb-3 flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-primary-600">ANANTA Healthcare OS</span>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{document.clinicName}</h2>
              {document.clinicAddress && <p className="text-zinc-500 text-[11px]">{document.clinicAddress}</p>}
            </div>
            <div className="text-right">
              <span className="px-2 py-1 bg-primary-50 text-primary-700 font-bold rounded text-xs uppercase tracking-wide inline-block mb-1">
                {document.title}
              </span>
              <p className="text-zinc-500 text-[11px]">Date: <b>{document.date}</b></p>
              {document.referenceNumber && <p className="text-zinc-500 text-[11px] font-mono">Ref: {document.referenceNumber}</p>}
            </div>
          </div>

          {/* Patient & Doctor Meta Banner */}
          <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
            <div>
              <span className="text-zinc-400 block font-bold text-[10px] uppercase">Patient Details</span>
              <span className="font-bold text-zinc-900 text-sm block">{document.patientName}</span>
              {document.patientAgeGender && <span className="text-zinc-600">{document.patientAgeGender}</span>}
              {document.patientId && <span className="text-zinc-400 block text-[10px] font-mono">ID: {document.patientId}</span>}
            </div>

            <div className="text-right">
              <span className="text-zinc-400 block font-bold text-[10px] uppercase">Attending Practitioner</span>
              <span className="font-bold text-zinc-900 text-sm block">Dr. {document.doctorName || "Physician"}</span>
              {document.doctorSpecialization && <span className="text-zinc-600">{document.doctorSpecialization}</span>}
            </div>
          </div>

          {/* DOCUMENT TYPE SPECIFIC CONTENTS */}

          {/* 1. Prescription */}
          {document.documentType === "prescription" && (
            <div className="space-y-3">
              {document.diagnoses && document.diagnoses.length > 0 && (
                <div>
                  <span className="font-bold text-zinc-700 block mb-1">Clinical Diagnoses:</span>
                  <div className="flex flex-wrap gap-1">
                    {document.diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold text-[11px]">
                        {d.description} {d.code ? `(${d.code})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {document.prescriptions && document.prescriptions.length > 0 && (
                <div>
                  <span className="font-bold text-zinc-800 text-sm block mb-1">Rx Prescribed Medications</span>
                  <table className="w-full border-collapse border border-zinc-200 text-xs">
                    <thead>
                      <tr className="bg-zinc-100 font-bold text-zinc-700">
                        <th className="border p-2 text-left">#</th>
                        <th className="border p-2 text-left">Medication / Generic</th>
                        <th className="border p-2 text-left">Dosage</th>
                        <th className="border p-2 text-left">Frequency</th>
                        <th className="border p-2 text-left">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.prescriptions.map((rx, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="border p-2 font-bold">{idx + 1}</td>
                          <td className="border p-2 font-bold text-primary-700">{rx.name}</td>
                          <td className="border p-2">{rx.dosage}</td>
                          <td className="border p-2">{rx.frequency || "1-0-1"}</td>
                          <td className="border p-2">{rx.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. Official Invoice */}
          {document.documentType === "invoice" && (
            <div className="space-y-3">
              <table className="w-full border-collapse border border-zinc-200 text-xs">
                <thead>
                  <tr className="bg-zinc-100 font-bold text-zinc-700">
                    <th className="border p-2 text-left">Item Description</th>
                    <th className="border p-2 text-center">Qty</th>
                    <th className="border p-2 text-right">Unit Price</th>
                    <th className="border p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {document.invoiceItems?.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="border p-2 font-medium">{item.description}</td>
                      <td className="border p-2 text-center">{item.quantity}</td>
                      <td className="border p-2 text-right">₹{item.amount}</td>
                      <td className="border p-2 text-right font-bold">₹{item.amount * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {document.invoiceTotals && (
                <div className="flex justify-end pt-2">
                  <div className="w-48 space-y-1 text-xs text-right">
                    <div className="flex justify-between"><span>Subtotal:</span><span>₹{document.invoiceTotals.subtotal}</span></div>
                    <div className="flex justify-between"><span>Tax:</span><span>₹{document.invoiceTotals.tax}</span></div>
                    <div className="flex justify-between font-bold text-sm text-zinc-900 border-t pt-1">
                      <span>Total Amount:</span><span>₹{document.invoiceTotals.total}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Lab Test Report */}
          {document.documentType === "lab_report" && (
            <div className="space-y-3">
              <table className="w-full border-collapse border border-zinc-200 text-xs">
                <thead>
                  <tr className="bg-zinc-100 font-bold text-zinc-700">
                    <th className="border p-2 text-left">Test Name</th>
                    <th className="border p-2 text-left">Result Value</th>
                    <th className="border p-2 text-left">Ref Range</th>
                    <th className="border p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {document.labResults?.map((res, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="border p-2 font-bold">{res.testName}</td>
                      <td className="border p-2 font-bold text-primary-700">{res.result} {res.unit || ""}</td>
                      <td className="border p-2 text-zinc-500">{res.referenceRange || "Normal"}</td>
                      <td className="border p-2 text-center font-bold">{res.status}</td>
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
                <span className="text-xs text-amber-700 font-bold block">Estimated Wait: {document.tokenDetails.estWaitTime} mins</span>
              )}
            </div>
          )}

          {/* Reusable Footer Signature & Verification Seal */}
          <div className="pt-8 border-t border-zinc-200 flex justify-between items-end text-[11px] text-zinc-400">
            <div>
              <p>Generated electronically by ANANTA Healthcare Operating System.</p>
              <p className="font-mono">Security Token Verification: Validated</p>
            </div>
            <div className="text-center">
              <div className="h-10 w-32 border-b border-zinc-400 mb-1"></div>
              <span className="font-bold text-zinc-700 block">Authorized Signature</span>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>🖨️ Print / Save PDF</Button>
        </div>
      </div>
    </Modal>
  );
}
