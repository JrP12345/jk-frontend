import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [
  { id: "reception", label: "Reception", title: "Bookings and walk-ins, together.", description: "See who is booked, checked in, consulting or finished in the appointment workspace.", alt: "Actual reception workspace with fictional booked, checked-in, consulting and completed visits." },
  { id: "queue", label: "Live queue", title: "See who’s here and who’s next.", description: "The queue brings arrivals and the active consultation into view so reception and doctors can coordinate the session.", alt: "Actual Ekavyu doctor queue with fictional waiting patients, tokens and an active consultation." },
  { id: "doctor", label: "Consultation", title: "Patient details alongside the consultation.", description: "Review patient information, record vitals and prepare clinical notes within the doctor’s workspace.", alt: "Actual consultation workspace for fictional patient Anaya Sen, with demonstration vitals and a draft clinical note." },
  { id: "billing", label: "Billing", title: "See the visit through to the invoice.", description: "Review paid, partial and unpaid invoices, recorded collections and outstanding balances.", alt: "Actual clinic billing workspace with fictional invoices and paid, partial and unpaid balances." },
  { id: "whatsapp", label: "Patient updates", title: "Understand the delivery status.", description: "Follow accepted, delivered, read and failed messages in the configured WhatsApp panel.", alt: "Actual WhatsApp settings panel with fictional templates and example accepted, delivered, read and failed states." },
];

export default function ClinicExperience() {
  return <ProductScreenshots screens={screens} audience="clinic" />;
}
