import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { proxy } from "@/proxy";
import { getSiteUrl } from "@/lib/siteUrl";
import { locationStructuredData, profileMetadata, publicImageUrl, publicOpeningHours, serializeStructuredData } from "@/lib/publicSeo";
import { getPublicProfile } from "@/lib/publicProfile";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import PublicProfileShare from "@/components/PublicProfileShare";
import GoogleBookingLinks from "@/components/organization/GoogleBookingLinks";
import { ToastProvider } from "@/components/ui";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("uses only a configured frontend origin for canonicals and safe preview URLs", () => {
  vi.stubEnv("APP_URL", "https://care.example");
  const metadata = profileMetadata("Care", "Practice details", "/doctor/asha?location=surat");
  expect(metadata.alternates?.canonical).toBe("https://care.example/doctor/asha?location=surat");
  expect(metadata.openGraph).toMatchObject({ url: "https://care.example/doctor/asha?location=surat", title: "Care" });
  for (const value of ["javascript:alert(1)", "https://user:pass@care.example", "https://care.example/path", "https://care.example?secret=yes"]) {
    vi.stubEnv("APP_URL", value);
    expect(getSiteUrl()).toBeUndefined();
  }
  expect(profileMetadata("Care", "Details", "/browse/care").robots).toMatchObject({ index: false });
  expect(publicImageUrl("private/object/key")).toBeUndefined();
  expect(publicImageUrl("javascript:alert(1)")).toBeUndefined();
});

it("emits truthful facility data without invented hours, ratings or private fields and escapes scripts", () => {
  vi.stubEnv("APP_URL", "https://care.example");
  const data = locationStructuredData({ id: "internal", slug: "care", name: "Care </script><script>alert(1)</script>", facilityType: "hospital", city: "Surat", address: "Branch Road", latitude: 0, longitude: 0, phone: "+919876500000", organization: { id: "org", name: "Organization", address: "Head Office" }, doctors: [], timings: "", description: "", image_url: "", email: "" } satisfies LocationDetail);
  expect(data).toMatchObject({ "@type": "Hospital", url: "https://care.example/browse/care", address: { streetAddress: "Branch Road" }, geo: { latitude: 0, longitude: 0 } });
  expect(data).not.toHaveProperty("aggregateRating");
  expect(data).not.toHaveProperty("openingHoursSpecification");
  expect(serializeStructuredData(data)).not.toContain("</script>");
  expect(serializeStructuredData(data)).not.toContain("Head Office");
});

it("collects every sitemap page and preserves doctor location context", async () => {
  vi.stubEnv("APP_URL", "https://care.example");
  const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { paths: ["/browse/branch-a", "/doctor/asha?location=branch-a"], nextCursor: "a".repeat(24) } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: { paths: ["/browse/branch-b", "/doctor/asha?location=branch-b"], nextCursor: null } }) });
  vi.stubGlobal("fetch", request);
  const entries = await sitemap();
  expect(entries.map((entry) => entry.url)).toContain("https://care.example/doctor/asha?location=branch-b");
  expect(entries).toHaveLength(7);
  expect(request).toHaveBeenCalledTimes(2);
});

it("marks up split and overnight opening hours only when valid times were explicitly saved", () => {
  expect(publicOpeningHours(JSON.stringify({ monday: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }], tuesday: { start: "22:00", end: "02:00" }, wednesday: { start: "25:70", end: "17:00" } }))).toEqual([
    { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "09:00", closes: "12:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "14:00", closes: "17:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Tuesday", opens: "22:00", closes: "02:00" },
  ]);
  expect(publicOpeningHours("Hours vary")).toEqual([]);
  expect(publicOpeningHours()).toEqual([]);
});

it("fails visibly instead of serving a partial sitemap or indexing a transient missing profile", async () => {
  vi.stubEnv("APP_URL", "https://care.example");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(sitemap()).rejects.toThrow("temporarily unavailable");
  await expect(getPublicProfile("locations/care")).rejects.toThrow("temporarily unavailable");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  expect(await getPublicProfile("locations/care")).toBeNull();
});

it("allows public profiles to be indexed and prevents operational pages from being indexed", () => {
  for (const path of ["/browse/care", "/doctor/asha?location=care", "/pricing"]) expect(proxy(new NextRequest(`https://care.example${path}`)).headers.get("X-Robots-Tag")).toBeNull();
  for (const path of ["/track/private-id", "/join/care", "/check-in", "/queue-tv", "/login", "/onboarding", "/verify-email"]) expect(proxy(new NextRequest(`https://care.example${path}`)).headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
});

it("copies a clean profile URL without patient, follow-up or tracking parameters", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<ToastProvider><PublicProfileShare title="Care" path="/browse/care" /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Share Care" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/browse/care`));
});

it("keeps Google appointment copying disabled when online booking is unavailable", () => {
  render(<GoogleBookingLinks locationUrl="https://care.example/browse/care" available={false} doctors={[{ id: "asha", name: "Asha", url: "https://care.example/doctor/asha?location=care" }]} onCopy={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Copy Google booking link" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Copy Asha's link" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Asha" })).toHaveValue("https://care.example/doctor/asha?location=care");
  expect(screen.getByText(/Setup is manual/)).toBeInTheDocument();
});
