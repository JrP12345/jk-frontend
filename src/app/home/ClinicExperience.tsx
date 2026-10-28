import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [
  { id: "reception", label: "Reception", moment: "03 / Anaya arrives", title: "One appointment list for bookings and walk-ins.", description: "Reception finds Anaya’s 10:30 visit alongside the rest of the clinic day. Arrival and appointment statuses help staff distinguish who is booked, checked in, consulting or finished.", alt: "Real appointment workspace with eight fictional visits, three doctors and confirmed, checked-in, completed and cancelled statuses." },
  { id: "queue", label: "Live queue", moment: "04 / Her turn approaches", title: "Keep the waiting room and doctor in step.", description: "Anaya’s token 13 sits in Dr. Mira’s queue. Staff can see arrivals and the active consultation, manage the session and use the supported patient-update controls.", alt: "Real doctor queue showing the fictional Anaya Sen token 13 and other waiting and consulting patients." },
  { id: "doctor", label: "Doctor", moment: "05 / The consultation", title: "The visit opens into the doctor’s workspace.", description: "Dr. Mira opens Anaya’s encounter with patient context, vitals, assessment and a draft note in view. Clinical tools and access depend on the clinic’s enabled modules and permissions.", alt: "Actual consultation workspace for fictional Anaya Sen, with a demonstration SOAP draft and vitals." },
  { id: "billing", label: "Visit billing", moment: "06 / The invoice", title: "See what is paid, pending or partially settled.", description: "Anaya’s illustrative consultation invoice appears alongside the day’s other bills. Staff review amounts, payment states and outstanding balances in the actual billing workspace.", alt: "Actual clinic billing list with multiple fictional consultation invoices and paid, partial and unpaid balances." },
  { id: "overview", label: "Practice owner", moment: "The whole clinic day", title: "A practical overview for the people running the clinic.", description: "Review appointment activity and collections, then reach the staff, schedules, locations and tools available to your role. Displayed totals are synthetic examples.", alt: "Actual practice dashboard for an illustrative two-location clinic with appointment activity and financial totals." },
];

export default function ClinicExperience() {
  return <ProductScreenshots screens={screens} audience="clinic" />;
}
