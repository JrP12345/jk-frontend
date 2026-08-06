/**
 * ANANTA Healthcare Platform — Shared TypeScript Type Definitions
 */

export interface UserReference {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

export interface PatientProfile {
  id: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  allergies?: string[];
  conditions?: string[];
  userId: PatientUser;
  emergencyContacts?: Array<{ name: string; relationship: string; phone: string }>;
  insurancePolicies?: Array<{ providerName: string; policyNumber: string; coverageAmount?: number }>;
}

export interface DoctorUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialization?: string;
}

export interface ClinicReference {
  id: string;
  name: string;
  city?: string;
  address?: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: PatientProfile | { id: string; userId: PatientUser };
  clinicId: ClinicReference;
  doctorId: DoctorUser;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded";
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clinicId: ClinicReference;
  doctorId: DoctorUser;
  patientId: PatientProfile;
  appointmentTime: string;
  appointmentType: string;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled" | "no-show";
  tokenNumber: number;
  queuePosition?: number;
  estimatedWaitTime?: number;
  notes?: string;
  symptoms?: string;
  diagnosis?: string;
}

export interface LabTestType {
  id: string;
  clinicId: string;
  name: string;
  code: string;
  department: string;
  sampleType: string;
  price: number;
  normalRange: string;
}

export interface LabOrderType {
  id: string;
  clinicId: string;
  patientId: PatientProfile;
  doctorId: DoctorUser;
  testId: LabTestType;
  orderDate: string;
  status: "ordered" | "sample-collected" | "processing" | "result-uploaded" | "cancelled";
  resultValue?: string;
  resultNotes?: string;
  attachmentUrl?: string;
  completedDate?: string | null;
}

export interface MedicineType {
  id: string;
  clinicId: string;
  name: string;
  genericName: string;
  stockQuantity: number;
  price: number;
  costPrice: number;
  expiryDate: string;
  batchNumber: string;
  reorderLevel?: number;
  hsnCode?: string;
  gstRate?: number;
}

export interface EmergencyTriageItem {
  id: string;
  patientId: {
    id: string;
    userId?: PatientUser;
  };
  clinicId?: ClinicReference;
  esiLevel: 1 | 2 | 3 | 4 | 5;
  chiefComplaint: string;
  triageCategory: "trauma" | "cardiac" | "respiratory" | "stroke" | "pediatric" | "general";
  vitals?: {
    heartRate?: number;
    bpSys?: number;
    bpDia?: number;
    respRate?: number;
    spo2?: number;
    temperature?: number;
    gcsScore?: number;
  };
  assignedBay?: string;
  attendingDoctorId?: DoctorUser;
  notes?: string;
  status: "triaged" | "under_treatment" | "admitted" | "discharged" | "transferred";
  createdAt?: string;
}

export interface BedType {
  id: string;
  clinicId: string;
  wardName: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  pricePerDay: number;
  occupiedBy?: {
    id: string;
    userId: { name: string; phone: string };
  } | null;
}
