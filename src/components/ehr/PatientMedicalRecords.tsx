"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Spinner, Tabs } from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "../clinical/UnifiedDocumentModal";

interface PatientMedicalRecordsProps {
  patientId: string;
}

export function PatientMedicalRecords({ patientId }: PatientMedicalRecordsProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Prescription PDF Modal State
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const loadRecords = async () => {
      try {
        setLoading(true);
        const [notesRes, invRes] = await Promise.all([
          api.get(`/patients/${patientId}/clinical-notes/history`).catch(() => ({ data: { data: [] } })),
          api.get("/billing/invoices").catch(() => ({ data: { data: [] } })),
        ]);

        setNotes(notesRes.data?.data?.notes || notesRes.data?.data || []);
        const allInvoices = invRes.data?.data || [];
        setInvoices(allInvoices.filter((i: any) => (i.patientId?.id || i.patientId?._id || i.patientId) === patientId));
      } catch (err) {
        console.error("Failed to load patient medical records:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [patientId]);

  const handleDownloadPrescription = (note: any) => {
    setUnifiedDoc({
      documentType: "prescription",
      title: "PRESCRIPTION RX",
      clinicName: note.clinicId?.name || "ANANTA Healthcare System",
      doctorName: note.doctorId?.name || "Attending Physician",
      doctorSpecialization: note.doctorId?.specialization || "General Medicine",
      patientName: "My Medical Record",
      date: new Date(note.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      diagnoses: note.assessment?.diagnoses || [],
      vitals: note.objective?.vitals,
      prescriptions: (note.plan?.prescriptions || []).map((p: any) => ({
        name: p.name || p.medicineName,
        dosage: p.dosage || "1 tablet",
        frequency: p.frequency || "1-0-1",
        duration: p.duration || "5 days",
        instructions: p.instructions,
      })),
    });
    setRxModalOpen(true);
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Spinner size="lg" label="Loading medical records..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-xl font-bold text-text">My Health Records & Documents</h2>
          <p className="text-xs text-text-secondary">View signed consultation notes, Rx prescriptions, and payment receipts.</p>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "prescriptions",
            label: `Signed Consultations & Rx (${notes.length})`,
            content: (
              <div className="space-y-4">
                {notes.length === 0 ? (
                  <Card className="py-12 text-center text-text-muted">
                    <CardContent>No consultation notes found for your profile.</CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notes.map((note) => {
                      const formattedDate = new Date(note.createdAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <Card key={note.id || note._id} className="border border-border hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base font-bold text-text">
                                  {note.subjective?.chiefComplaint || "OPD Consultation"}
                                </CardTitle>
                                <p className="text-xs text-text-secondary">{formattedDate}</p>
                              </div>
                              <Badge variant={note.status === "signed" ? "success" : "warning"}>
                                {note.status === "signed" ? "Official Signed" : "Draft"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-xs">
                            {note.assessment?.diagnoses?.[0] && (
                              <div>
                                <span className="text-text-muted font-medium block">Diagnosis:</span>
                                <span className="font-semibold text-primary-600">
                                  {note.assessment.diagnoses[0].description} ({note.assessment.diagnoses[0].code || "ICD-10"})
                                </span>
                              </div>
                            )}

                            {note.plan?.prescriptions && note.plan.prescriptions.length > 0 && (
                              <div>
                                <span className="text-text-muted font-medium block">Prescribed Medicines ({note.plan.prescriptions.length}):</span>
                                <ul className="list-disc list-inside text-text-secondary mt-1 space-y-0.5">
                                  {note.plan.prescriptions.slice(0, 3).map((rx: any, idx: number) => (
                                    <li key={idx} className="truncate">
                                      {rx.name || rx.medicineName} ({rx.dosage})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="pt-2 border-t border-border flex justify-end gap-2">
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => handleDownloadPrescription(note)}
                              >
                                🖨️ Download Prescription PDF
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "billing",
            label: `Invoices & Receipts (${invoices.length})`,
            content: (
              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <Card className="py-12 text-center text-text-muted">
                    <CardContent>No billing receipts found.</CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((inv) => (
                      <div key={inv.id || inv._id} className="p-4 bg-surface rounded-xl border border-border flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary-600">#{inv.invoiceNumber}</span>
                            <Badge variant={inv.status === "paid" ? "success" : "warning"}>{inv.status}</Badge>
                          </div>
                          <p className="text-text-secondary mt-1">Date: {new Date(inv.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-text block">₹{inv.totalAmount}</span>
                          <span className="text-[11px] text-text-muted">Paid via {inv.paymentMethod || "cash"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Official Prescription Download Modal */}
      <UnifiedDocumentModal
        open={rxModalOpen}
        onClose={() => setRxModalOpen(false)}
        document={unifiedDoc}
      />
    </div>
  );
}
