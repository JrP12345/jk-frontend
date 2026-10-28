"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, Search } from "lucide-react";
import styles from "./home.module.css";

const stages = [
  { id: "discovery", label: "Discover", title: "Explore a doctor and their clinic.", status: "Explore care", detail: "Review the specialty, practice location and booking options before choosing a visit." },
  { id: "booking", label: "Book", title: "Choose an available appointment.", status: "Appointment booked", detail: "Enter your details and review the status shown. Some bookings require payment before confirmation." },
  { id: "reception", label: "Arrive", title: "Reception records the arrival.", status: "Checked in", detail: "The patient’s visit appears in the queue so the clinic team can see who is waiting." },
  { id: "doctor", label: "Consult", title: "The doctor opens the consultation.", status: "In consultation", detail: "The visit workspace brings together the patient information and clinical tools available to that doctor." },
] as const;

export default function LivingAppointment() {
  const [selected, setSelected] = useState(1);
  const stage = stages[selected];
  return <figure className={styles.livingAppointment} data-stage={stage.id} aria-label="The living appointment demonstration">
    <div className={styles.stageTopline}><span><i aria-hidden="true" /> ONE VISIT, FROM DISCOVERY TO THE CLINIC</span><span>CONCEPT ILLUSTRATION · REAL SCREENS BELOW</span></div>
    <div className={styles.appointmentArchitecture}>
      <div className={styles.schedulePlane} aria-hidden="true"><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span></div>
      <div className={styles.discoveryLayer}>
        <div className={styles.layerTopline}><span>01 / DISCOVERY</span><Search size={14} aria-hidden="true" /></div>
        <p className={styles.layerTitle}>Find a doctor or clinic.</p>
        <div className={styles.demoSearch}><Search size={14} aria-hidden="true" /><span>General medicine</span><span>EXAMPLE</span></div>
        <div className={styles.miniDoctor}><span className={styles.avatar}>MS</span><div><strong>Dr. Mira Shah</strong><span>General medicine</span></div><Check size={15} aria-hidden="true" /></div>
        <p className={styles.layerLocation}><MapPin size={12} aria-hidden="true" />Aster Grove Clinic · Pune</p>
        <div className={styles.miniSlots}><span>10:00</span><span>10:30</span><span>11:15</span></div>
      </div>

      <div className={styles.appointmentObject}>
        <div className={styles.appointmentBacking} aria-hidden="true" />
        <div className={styles.appointmentPass}>
          <div className={styles.passTopline}><span>EKAVYU</span><CalendarDays size={20} aria-hidden="true" /></div>
          <p className={styles.passEyebrow}>YOUR APPOINTMENT DETAILS</p>
          <div className={styles.passDate}><strong>24</strong><div><span>OCTOBER</span><span>Illustrative clinic day</span></div></div>
          <div className={styles.passTime}><Clock3 size={15} aria-hidden="true" />10:30 AM<span>General medicine</span></div>
          <div className={styles.passPerforation} aria-hidden="true" />
          <div className={styles.passPerson}><span className={styles.passAvatar}>AS</span><div><strong>Anaya S.</strong><span>With Dr. Mira Shah</span></div><span className={styles.passToken}>#13</span></div>
          <div className={styles.passStatus}><span aria-hidden="true" />{stage.status}<ArrowRight size={15} aria-hidden="true" /></div>
        </div>
      </div>

      <div className={styles.clinicLayer}>
        <div className={styles.layerTopline}><span>02 / CLINIC WORKSPACE</span><span className={styles.connectedPill}>Connected</span></div>
        <p className={styles.layerTitle}>Appointments and arrivals.</p>
        <div className={styles.miniQueueHeader}><span>Doctor’s queue</span><span>Today</span></div>
        <div className={styles.miniQueueRow}><span>12</span><div><strong>Patient A</strong><small>{stage.id === "doctor" ? "Visit completed" : "In consultation"}</small></div><span className={styles.queueDot} /></div>
        <div className={`${styles.miniQueueRow} ${styles.highlightedVisit}`}><span>13</span><div><strong>Anaya S.</strong><small>{stage.id === "doctor" ? "In consultation" : stage.id === "reception" ? "Checked in" : "Appointment booked"}</small></div><ArrowRight size={14} aria-hidden="true" /></div>
        <div className={styles.miniQueueRow}><span>14</span><div><strong>Patient C</strong><small>Not arrived</small></div><span className={styles.queueDot} /></div>
        <div className={styles.clinicLayerFoot}><Check size={12} aria-hidden="true" />From booking to the consultation.</div>
      </div>
      <div className={styles.appointmentAnnotation}><span aria-hidden="true" />A booking becomes<br />a connected clinic visit.</div>
    </div>
    <div className={styles.appointmentStory}>
      <div className={styles.stageControls} role="group" aria-label="Explore an example appointment">
        {stages.map((item, index) => <button type="button" key={item.id} aria-pressed={selected === index} aria-controls="appointment-stage-story" onClick={() => setSelected(index)}><span>0{index + 1}</span>{item.label}</button>)}
      </div>
      <div id="appointment-stage-story" className={styles.stageDescription} aria-live="polite" aria-atomic="true"><h2>{stage.title}</h2><p>{stage.detail}</p></div>
    </div>
    <figcaption>Concept illustration with example people and visits. View actual Ekavyu screens below. Booking and confirmation depend on the provider’s availability and payment requirements.</figcaption>
    <noscript>Showing a sample appointment. Follow Find a Doctor to explore actual providers.</noscript>
  </figure>;
}
