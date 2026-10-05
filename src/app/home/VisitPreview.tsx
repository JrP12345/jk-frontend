"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Check, FileText, ListOrdered, LockKeyhole, Stethoscope, UserRound } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { appointmentBookingLabel, appointmentPaymentLabel } from "@/lib/appointmentPresentation";
import styles from "./home.module.css";

const stages = [
  { id: "booking", label: "Booking", title: "The booking reaches your team.", role: "PATIENT → RECEPTION", explanation: "A patient chooses a provider and books where availability is enabled. Reception sees the appointment in its visit workflow.", status: appointmentBookingLabel("confirmed") },
  { id: "arrival", label: "Reception", title: "Reception manages arrival and queue.", role: "AT THE FRONT DESK", explanation: "Check in the booked patient or register a walk-in. Keep the visit status and doctor’s queue in view.", status: "Checked in" },
  { id: "doctor", label: "Doctor", title: "The doctor works in the same visit.", role: "RECEPTION → CONSULTATION", explanation: "See the patient’s context, write visit notes and prescribe. A focused view is available for simpler consultations.", status: "In consultation" },
  { id: "records", label: "Records", title: "Recorded care stays with the visit.", role: "CARE TEAM → PATIENT", explanation: "Save visit information and handle supported billing. Patients return to records available and linked to their account.", status: "Visit recorded" },
];

function QueueRow({ arrived }: { arrived: boolean }) {
  return (
    <table className={styles.previewTable}>
      <caption className="sr-only">Illustrative appointment in reception</caption>
      <thead><tr><th scope="col">Token</th><th scope="col">Visit</th><th scope="col">Status</th></tr></thead>
      <tbody><tr><td><span className={styles.rowToken}>14</span></td><td><strong>Sample patient</strong><span>Online appointment</span></td><td><Badge variant={arrived ? "success" : "primary"} size="sm">{arrived ? "Checked in" : "Confirmed"}</Badge></td></tr></tbody>
    </table>
  );
}

export default function VisitPreview() {
  const [active, setActive] = useState("booking");
  const index = Math.max(0, stages.findIndex(stage => stage.id === active));
  const stage = stages[index];
  const panel = (
    <div className={styles.workspaceStage} key={active}>
      <div className={styles.stageIntroduction}>
        <div><p className={styles.eyebrow}>{stage.role}</p><h3>{stage.title}</h3><p>{stage.explanation}</p></div>
        <span className={styles.visitIdentity}><span>THE SAME VISIT</span><strong>14</strong></span>
      </div>
      <div className={styles.workspaceGrid}>
        <Card padding="none" className={styles.workspacePanel}>
          <div className={styles.panelHeader}>
            <span>{index === 0 ? <CalendarDays size={17} aria-hidden="true" /> : index === 1 ? <ListOrdered size={17} aria-hidden="true" /> : index === 2 ? <Stethoscope size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
              {index === 0 ? "Patient booking" : index === 1 ? "Reception workspace" : index === 2 ? "Consultation workspace" : "Recorded visit"}
            </span>
            <Badge variant={index === 0 ? "primary" : "success"} size="sm">{stage.status}</Badge>
          </div>
          <div className={styles.panelBody}>
            {index === 0 && <>
              <div className={styles.bookingReceipt}><span className={styles.largeToken}>14</span><div><h4>Your appointment is confirmed.</h4><p>At your chosen doctor and location.</p></div></div>
              <div className={styles.receiptDetail}><CalendarDays size={17} aria-hidden="true" /><p>Time-slot or queue booking, depending on the provider.</p></div>
              <p className={styles.panelFootnote}>The appointment link lets the patient follow progress and check in on arrival.</p>
            </>}
            {index === 1 && <><QueueRow arrived /><ul className={styles.taskList}><li><Check size={15} aria-hidden="true" /> Patient registration and arrival</li><li><Check size={15} aria-hidden="true" /> Doctor-specific queue and visit status</li></ul></>}
            {index === 2 && <div className={styles.clinicalRows}><div><UserRound size={18} aria-hidden="true" /><span>Patient history</span><span>Visit context</span></div><div><FileText size={18} aria-hidden="true" /><span>Clinical notes</span><Badge variant="outline" size="sm">Draft / signed</Badge></div><div><FileText size={18} aria-hidden="true" /><span>Prescription</span><span>When issued</span></div><p>Review the patient, document the consultation and move the visit forward.</p></div>}
            {index === 3 && <div className={styles.clinicalRows}><div><FileText size={18} aria-hidden="true" /><span>Visit information</span><Check size={15} aria-hidden="true" /></div><div><FileText size={18} aria-hidden="true" /><span>Prescriptions & reports</span><span>When recorded</span></div><div><FileText size={18} aria-hidden="true" /><span>Visit billing</span><span>Where enabled</span></div><p>{appointmentPaymentLabel("pay_at_clinic")}. Recorded payment status follows the actual visit.</p></div>}
          </div>
        </Card>
        <div className={styles.handoffPanel}>
          <p className={styles.eyebrow}>{index === 0 ? "RECEIVED BY RECEPTION" : index === 1 ? "READY FOR THE DOCTOR" : index === 2 ? "WHAT THE DOCTOR CAN DO" : "AVAILABLE TO THE PATIENT"}</p>
          {index === 0 ? <><h4>One appointment, already in the workflow.</h4><QueueRow arrived={false} /><p>Reception manages arrival and queue from here. Walk-ins can enter the same daily workflow.</p></> :
            index === 1 ? <><h4>The next part of the visit has the right context.</h4><div className={styles.contextRow}><Stethoscope size={23} aria-hidden="true" /><div><strong>Visit 14 · Checked in</strong><span>Patient details and the current visit</span></div><ArrowRight size={18} aria-hidden="true" /></div><p>The doctor can see today’s patients and open the consultation.</p></> :
            index === 2 ? <><h4>Consult with the patient’s information in reach.</h4><ul className={styles.taskList}><li><Check size={15} aria-hidden="true" /> Review relevant patient history</li><li><Check size={15} aria-hidden="true" /> Write notes and prescriptions</li><li><Check size={15} aria-hidden="true" /> Continue or complete the visit</li></ul><p>Available clinical actions follow enabled modules and permissions.</p></> :
              <><h4>The visit ends. Available information remains.</h4><div className={styles.contextRow}><LockKeyhole size={23} aria-hidden="true" /><div><strong>Patient account</strong><span>Linked visits and available records</span></div></div><p>Records must be saved by the provider and linked to the patient’s account. Personal information stays outside the public directory.</p></>}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.visitPreview}>
      <div className={styles.workspaceBar}><span><span className={styles.smallMark} aria-hidden="true" /> Ekavyu · Visit workspace</span><Badge variant="outline" size="sm">Illustrative preview</Badge></div>
      <Tabs activeTab={active} onChange={setActive} scrollActiveIntoView={false} className={styles.visitTabs} tabs={stages.map(item => ({ id: item.id, label: item.label, content: item.id === active ? panel : undefined }))} />
      <div className={styles.previewBottom}><p>Sample visit, not a live provider or booking. No appointment is created.</p><span aria-label={`Visit step ${index + 1} of 4`}>{String(index + 1).padStart(2, "0")} / 04 <ArrowRight size={15} aria-hidden="true" /></span></div>
    </div>
  );
}
