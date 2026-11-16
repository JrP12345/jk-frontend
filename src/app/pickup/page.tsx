import type { Metadata } from "next";
import PickupTicketPage from "./PickupTicketPage";

export const metadata: Metadata = { title: "Pharmacy pickup ticket | Ekavyu", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <PickupTicketPage />; }
