import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [
  { id: "discovery", label: "Find care", title: "A place to start your search.", description: "Explore the directory by city and specialty, then open a clinic to see its doctors and appointment options.", alt: "Actual Ekavyu directory with fictional Aster Grove clinic locations and specialty filters." },
  { id: "booking", label: "Plan a visit", title: "Know your options before you book.", description: "Review the doctor, practice location, fee and available appointment times. Confirmation follows the provider’s booking and payment requirements.", alt: "Actual Ekavyu doctor profile and booking panel with fictional Dr. Mira Shah, practice details, fee and available dates." },
];

export default function PatientDiscovery() {
  return <ProductScreenshots screens={screens} audience="patient" />;
}
