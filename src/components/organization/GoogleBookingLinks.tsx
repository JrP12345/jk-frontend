"use client";

import { Button } from "@/components/ui";

export default function GoogleBookingLinks({ locationUrl, available, doctors, onCopy }: {
  locationUrl: string;
  available: boolean;
  doctors: Array<{ id: string; name: string; url: string }>;
  onCopy: (value: string, title: string) => Promise<void>;
}) {
  return <section aria-labelledby="google-booking-title" className="rounded-xl border border-border p-4">
    <h3 id="google-booking-title" className="font-semibold">Google Search &amp; Maps</h3>
    <p className="mt-2 text-xs text-text-secondary">Use this location&apos;s booking link on its verified Google Business Profile. For multiple branches, configure each branch&apos;s own link.</p>
    <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs text-text-secondary">
      <li>Claim the profile for your real, staffed location and complete Google&apos;s verification. Check the name, address, phone and public hours.</li>
      <li>Open your Business Profile in Google Search and select Booking, then Add link. In Maps, use Edit profile and the available booking option.</li>
      <li>Paste the location booking link above, save, and set it as preferred if that option is available.</li>
      <li>Open the saved link on a phone while signed out and complete a booking check. Google controls link approval and availability by category and region.</li>
    </ol>
    <p role="status" className="mt-3 text-xs text-text-secondary">{available ? "The page currently allows appointment checks. Confirm schedules and booking completion before adding an appointment link." : "Online appointments are not ready. Use the page as a website link; add an appointment link only when patients can complete a booking."}</p>
    <Button className="mt-3" size="sm" variant="outline" disabled={!available || !locationUrl} onClick={() => onCopy(locationUrl, "Google booking link copied")}>Copy Google booking link</Button>
    {doctors.length > 0 && <details className="mt-4 text-xs"><summary className="cursor-pointer py-2 font-semibold">Doctor links for eligible practitioner profiles</summary>
      <p className="mt-2 text-text-secondary">A practitioner must be public-facing and directly contactable at the verified location during their stated hours. For several practitioners, Google allows separate practitioner profiles using the practitioner&apos;s name. For a sole practitioner in a branded practice, Google recommends a shared profile. Avoid duplicate listings or separate profiles for each specialty.</p>
      <ul className="mt-3 space-y-3">{doctors.map((doctor) => <li key={doctor.id}><label htmlFor={`google-doctor-${doctor.id}`} className="mb-1 block font-semibold">{doctor.name}</label><input id={`google-doctor-${doctor.id}`} readOnly value={doctor.url} className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2" /><Button className="mt-1" size="sm" variant="outline" disabled={!available} onClick={() => onCopy(doctor.url, "Doctor booking link copied")}>Copy {doctor.name}&apos;s link</Button></li>)}</ul>
    </details>}
    <p className="mt-4 text-xs text-text-muted">Use one Ekavyu appointment link per Business Profile; Google permits one action link per domain. Setup is manual. Ekavyu does not automatically connect to Google Business Profile or provide Reserve with Google. Remove appointment links while booking is paused, and update them if you unpublish or archive a location.</p>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-accent"><a href="https://support.google.com/business/answer/6218037?hl=en" target="_blank" rel="noopener noreferrer" className="underline">Google link setup</a><a href="https://support.google.com/business/answer/13769188?hl=en" target="_blank" rel="noopener noreferrer" className="underline">Link eligibility</a><a href="https://support.google.com/business/answer/3038177?hl=en" target="_blank" rel="noopener noreferrer" className="underline">Practitioner guidelines</a><a href="https://support.google.com/business/answer/7107242?hl=en" target="_blank" rel="noopener noreferrer" className="underline">Verification help</a></div>
  </section>;
}
