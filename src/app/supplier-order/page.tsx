import type { Metadata } from "next";
import SupplierOrderPage from "./SupplierOrderPage";
export const metadata: Metadata = { title: "Supplier purchase order | Ekavyu", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <SupplierOrderPage />; }
