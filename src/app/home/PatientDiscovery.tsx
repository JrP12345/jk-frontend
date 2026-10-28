import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [
  { id: "discovery", label: "Find a provider", moment: "01 / Find care", title: "Find a clinic that fits your visit.", description: "Search the real directory by city and specialty. Our illustrative practice has three doctors across two locations; Anaya chooses Dr. Mira Shah at Aster Grove Clinic.", alt: "Actual Ekavyu directory with two illustrative Aster Grove clinic locations and multiple specialties." },
  { id: "booking", label: "View booking options", moment: "02 / Plan the visit", title: "A doctor, a location and a time to visit.", description: "Anaya reviews Dr. Mira’s practice details and chooses 10:30. The real booking panel shows the fee and available times before patient details. Confirmation follows the provider’s booking and payment requirements.", alt: "Actual Dr. Mira Shah demonstration profile with Aster Grove Clinic, consultation fee and available appointment times." },
];

export default function PatientDiscovery() {
  return <ProductScreenshots screens={screens} audience="patient" />;
}
