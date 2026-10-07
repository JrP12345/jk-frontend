"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import PatientHistoryAccess from "./PatientHistoryAccess";
import { Alert, Card, CardHeader, CardTitle, CardContent, Button, Badge, Tabs, LoadingState, Skeleton, SkeletonCardGrid } from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "../clinical/UnifiedDocumentModal";

interface PatientMedicalRecordsProps {
  patientId: string;
  accessToken?: string | null;
}

export function PatientMedicalRecords({ patientId, accessToken }: PatientMedicalRecordsProps) {
  const [localAccessToken, setRecordAccessToken] = useState<string | null>(null);
  const recordAccessToken = accessToken === undefined ? localAccessToken : accessToken;
  const [notes, setNotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [readErrors, setReadErrors] = useState({ notes: false, invoices: false });
  const [readAttempt, setReadAttempt] = useState(0);

  // Prescription PDF Modal State
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const controller = new AbortController();
    setNotes([]); setInvoices([]); setRxModalOpen(false); setUnifiedDoc(null);
    const loadRecords = async () => {
      try {
        setLoading(true);
        setReadErrors({ notes: false, invoices: false });
        const [notesRead, invoiceRead] = await Promise.allSettled([
          api.get(`/patients/${patientId}/clinical-notes/history${recordAccessToken ? "?scope=all" : ""}`, { signal: controller.signal, headers: recordAccessToken ? { "X-Patient-Record-Access": recordAccessToken } : {} }),
          api.get("/invoices", { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;
        setReadErrors({ notes: notesRead.status === "rejected", invoices: invoiceRead.status === "rejected" });
        if (notesRead.status === "fulfilled") {
          setNotes(notesRead.value.data?.data?.notes || notesRead.value.data?.data || []);
        }
        if (invoiceRead.status === "fulfilled") {
          const allInvoices = invoiceRead.value.data?.data || [];
          setInvoices(allInvoices.filter((i: any) => (i.patientId?.id || i.patientId?._id || i.patientId) === patientId));
        }
      } catch {
        if (!controller.signal.aborted) setReadErrors({ notes: true, invoices: true });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadRecords();
    return () => controller.abort();
  }, [patientId, recordAccessToken, readAttempt]);

  const handleDownloadPrescription = (note: any) => {
    setUnifiedDoc({
      documentType: "prescription",
      title: "PRESCRIPTION RX",
      locationName: note.locationId?.name || "Ekavyu Healthcare System",
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
      <div className="space-y-6">
        {accessToken === undefined && <PatientHistoryAccess patientId={patientId} token={recordAccessToken} onChange={setRecordAccessToken} />}
        <LoadingState label="Loading medical records">
          <div className="border-b border-border pb-3 space-y-2">
            <Skeleton className="h-6 w-64 rounded" />
            <Skeleton className="h-4 w-96 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <SkeletonCardGrid count={3} columns={1} />
        </LoadingState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accessToken === undefined && <PatientHistoryAccess patientId={patientId} token={recordAccessToken} onChange={setRecordAccessToken} />}
      {(readErrors.notes || readErrors.invoices) && <Alert variant="error" title="Unable to load medical records" action={<Button variant="outline" size="sm" onClick={() => setReadAttempt(attempt => attempt + 1)}>Try again</Button>}>
        {readErrors.notes && readErrors.invoices ? "Consultation notes and receipts" : readErrors.notes ? "Consultation notes" : "Billing receipts"} could not be loaded. Check your connection and try again.
      </Alert>}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-xl font-bold text-text">Health Records & Documents</h2>
          <p className="text-xs text-text-secondary">View signed consultation notes, Rx prescriptions, and payment receipts.</p>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "prescriptions",
            label: `Signed Consultations & Rx${readErrors.notes ? "" : ` (${notes.length})`}`,
            content: (
              <div className="space-y-4">
                {readErrors.notes ? null : notes.length === 0 ? (
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
                                <span className="font-semibold text-accent">
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
            label: `Invoices & Receipts${readErrors.invoices ? "" : ` (${invoices.length})`}`,
            content: (
              <div className="space-y-4">
                {readErrors.invoices ? null : invoices.length === 0 ? (
                  <Card className="py-12 text-center text-text-muted">
                    <CardContent>No billing receipts found.</CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((inv) => (
                      <div key={inv.id || inv._id} className="p-4 bg-surface rounded-xl border border-border flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-accent">#{inv.invoiceNumber}</span>
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
