import { Metadata } from "next";
import BrowseClient from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse Hospitals & Clinics | JK Healthcare",
  description: "Find and book appointments with top doctors across our network of hospitals and clinics.",
};

export default function BrowsePage() {
  return <BrowseClient />;
}
