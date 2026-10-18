"use client";

import { Badge, Button } from "@/components/ui";
import { Activity, Phone, ShieldAlert, User } from "lucide-react";
import styles from "./PatientOverviewCards.module.css";

export interface PatientDemographics {
  id: string; name: string; email: string; phone?: string; dob?: string; gender?: string;
  bloodGroup?: string; address?: string; abdmHealthId?: string;
  allergies?: string[]; conditions?: string[]; medicalNotes?: string; clinicalProfileRestricted?: boolean;
  emergencyContacts?: Array<{ name: string; relationship: string; phone: string }>;
  insurancePolicies?: Array<{ providerName: string; policyNumber: string; coverageAmount?: number; validUntil?: string }>;
  totalAppointments?: number; activeAdmissions?: number;
}
interface RecordedVisit {
  id?: string; appointmentTime?: string;
  vitals?: { bpSystolic?: number; bpDiastolic?: number; pulse?: number; spO2?: number };
}
interface Props { patient: PatientDemographics; onEditProfile?: () => void; visits?: RecordedVisit[] }
const dateLabel = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
function ageLabel(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Age not recorded";
  const dob = new Date(value), now = new Date();
  if (dob > now) return "Age not recorded";
  const age = now.getFullYear() - dob.getFullYear() - (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate()) ? 1 : 0);
  return age + " years";
}
export function PatientOverviewCards({ patient, onEditProfile, visits = [] }: Props) {
  const restricted = patient.clinicalProfileRestricted;
  const recordedVitals = restricted ? [] : visits.filter(visit => visit.vitals && [visit.vitals.bpSystolic, visit.vitals.bpDiastolic, visit.vitals.pulse, visit.vitals.spO2].some(value => typeof value === "number" && Number.isFinite(value))).sort((a, b) => Date.parse(b.appointmentTime || "") - Date.parse(a.appointmentTime || "")).slice(0, 5);
  return <div className={styles.overview}>
    <section className={styles.panel}>
      <header><h2><User size={17} />Patient details</h2>{onEditProfile && <Button size="sm" variant="ghost" onClick={onEditProfile}>Edit profile</Button>}</header>
      <dl className={styles.demographics}>
        <div><dt>Full name</dt><dd>{patient.name}</dd></div>
        <div><dt>Gender and age</dt><dd className={styles.capitalize}>{patient.gender || "Not recorded"} · {ageLabel(patient.dob)}</dd></div>
        <div><dt>Date of birth</dt><dd>{dateLabel(patient.dob)}</dd></div>
        <div><dt>Blood group</dt><dd>{restricted ? "Patient approval needed" : patient.bloodGroup || "Not recorded"}</dd></div>
        <div><dt>Phone</dt><dd>{patient.phone ? <a href={"tel:" + patient.phone}>{patient.phone}</a> : "Not recorded"}</dd></div>
        <div><dt>Email</dt><dd>{patient.email ? <a href={"mailto:" + patient.email}>{patient.email}</a> : "Not recorded"}</dd></div>
        <div className={styles.full}><dt>Address</dt><dd>{patient.address || "Not recorded"}</dd></div>
        {patient.abdmHealthId && <div className={styles.full}><dt>ABHA</dt><dd>{patient.abdmHealthId}</dd></div>}
      </dl>
    </section>
    <section className={styles.panel}>
      <header><h2><ShieldAlert size={17} />Clinical summary</h2></header>
      {restricted ? <p className={styles.notice}>Patient approval is needed to view clinical information from another organization.</p> : <div className={styles.clinical}>
        <div><h3>Allergies</h3><div className={styles.tags}>{patient.allergies?.length ? patient.allergies.map((allergy, index) => <Badge key={index} variant="danger" size="sm">{allergy}</Badge>) : <p>Allergies not recorded</p>}</div></div>
        <div><h3>Conditions</h3><div className={styles.tags}>{patient.conditions?.length ? patient.conditions.map((condition, index) => <Badge key={index} variant="primary" size="sm">{condition}</Badge>) : <p>No conditions recorded.</p>}</div></div>
        <div><h3>Notes and precautions</h3><p>{patient.medicalNotes || "No physician notes recorded."}</p></div>
      </div>}
    </section>
    <section className={styles.panel}>
      <header><h2><Activity size={17} />Recorded vitals</h2></header>
      {recordedVitals.length ? <div className={styles.vitals}>{recordedVitals.map((visit, index) => {
        const vital = visit.vitals!;
        const reading = (value?: number) => typeof value === "number" && Number.isFinite(value) ? value : "—";
        return <div key={visit.id || index}><strong>{dateLabel(visit.appointmentTime)}</strong><dl>
          {(vital.bpSystolic !== undefined || vital.bpDiastolic !== undefined) && <div><dt>BP</dt><dd>{reading(vital.bpSystolic)}/{reading(vital.bpDiastolic)} mmHg</dd></div>}
          {vital.pulse !== undefined && <div><dt>Pulse</dt><dd>{reading(vital.pulse)} bpm</dd></div>}
          {vital.spO2 !== undefined && <div><dt>SpO₂</dt><dd>{reading(vital.spO2)}%</dd></div>}
        </dl></div>;
      })}</div> : <p className={styles.notice}>{restricted ? "Patient approval needed." : "No recorded vitals in the available visits."}</p>}
    </section>
    <section className={styles.panel}>
      <header><h2><Phone size={17} />Emergency contacts</h2></header>
      {patient.emergencyContacts?.length ? <div className={styles.items}>{patient.emergencyContacts.map((contact, index) => <div key={index}><strong>{contact.name}</strong><span>{contact.relationship}</span><a href={"tel:" + contact.phone}>{contact.phone}</a></div>)}</div> : <p className={styles.notice}>No emergency contacts recorded.</p>}
    </section>
    <section className={styles.panel}>
      <header><h2>Insurance details</h2></header>
      {restricted ? <p className={styles.notice}>Patient approval needed.</p> : patient.insurancePolicies?.length ? <div className={styles.items}>{patient.insurancePolicies.map((policy, index) => <div key={index}><strong>{policy.providerName}</strong><span>Policy: {policy.policyNumber}</span>{policy.validUntil && <span>Valid until {dateLabel(policy.validUntil)}</span>}{policy.coverageAmount !== undefined && <span>Recorded coverage: {policy.coverageAmount.toLocaleString()}</span>}</div>)}</div> : <p className={styles.notice}>No insurance details recorded.</p>}
    </section>
  </div>;
}
