import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [{
  id: "pharmacy", label: "Inventory", title: "Medicine, stock and batch details together.",
  description: "Check available quantities, review batches and identify medicines nearing expiry in the inventory workspace.",
  alt: "Actual Ekavyu pharmacy inventory with fictional medicines, stock quantities, batches and expiry dates.",
}];

export default function PharmacyExperience() {
  return <ProductScreenshots screens={screens} audience="pharmacy" />;
}
