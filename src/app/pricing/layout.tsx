import { profileMetadata } from "@/lib/publicSeo";

export const metadata = profileMetadata("Ekavyu pricing | Plans for healthcare teams", "Explore Ekavyu plans for healthcare locations, doctors and care teams.", "/pricing");

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
