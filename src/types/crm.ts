export interface Inquiry {
  id: string; locationId: string; patientId?: string; callerName: string; phone: string; email: string;
  source: string; sourceEvidence: string; reasonForContact: string; requestedService: string;
  status: "open" | "in_progress" | "closed" | "converted"; ownerId: string | null; ownerName?: string;
  nextAction: { kind: "contact" | "review" | "book"; dueAt: string }; closeReason?: string; duplicateInquiryId?: string;
  appointmentId?: string; revision: number; createdAt: string; updatedAt: string;
}
export interface InquiryActivity { id: string; kind: string; outcome?: string; actorName: string; createdAt: string; note?: string }
export interface CrmLocation { id: string; name: string; effectiveTimezone?: string; timezone?: string }
