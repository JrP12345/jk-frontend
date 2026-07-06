import { Metadata } from "next";
import { Suspense } from "react";
import BrowseDetailClient from "./BrowseDetailClient";

export const metadata: Metadata = {
  title: "Hospital Details | JK Healthcare",
  description: "View hospital details, timings, and book appointments with specialized doctors.",
};

export default async function BrowseDetailPage({ params }: { params: { id: string } }) {
  // Pass the id from params to the client component
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-background text-text-secondary">Loading details...</div>}>
      <BrowseDetailClient id={id} />
    </Suspense>
  );
}
