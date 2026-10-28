import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LocationCard from "@/app/browse/LocationCard";
import type { Location } from "@/app/browse/BrowseClient";

const facility: Location = { id: "facility", slug: "grove", name: "Grove Clinic", facilityType: "clinic", city: "Pune", address: "Baner Road", phone: "+91 (000) 000-0000", email: "hello@example.test", description: "", timings: "", image_url: "", doctorCount: 1, doctorsSummary: [{ id: "doctor", slug: "mira", name: "Mira Shah", specialization: "General Medicine", fees: 500 }], onlineBookingAvailable: true };
function show(overrides: Partial<Location> = {}) {
  const onNavigate = vi.fn();
  const view = render(<LocationCard location={{ ...facility, ...overrides }} onNavigate={onNavigate} showDistance={false} approximateDistance={false} />);
  return { ...view, onNavigate };
}

describe("compact facility discovery cards", () => {
  it("retains the actual name and routes to the facility, without doctor or booking details", () => {
    const { onNavigate } = show({ rating: 4.7, reviewsCount: 20 });
    expect(screen.getByRole("heading", { level: 2, name: "Grove Clinic" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Book appointment" });
    expect(link).toHaveAttribute("href", "/browse/grove");
    link.addEventListener("click", event => event.preventDefault()); fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Mira Shah|General Medicine|Consultation|₹500|Check appointments/)).not.toBeInTheDocument();
    expect(screen.queryByText("Clinic", { exact: true })).not.toBeInTheDocument();
  });
  it("keeps the facility name and uses hospital classification in the action instead of an extra text row", () => {
    const view = show({ name: "River Hospital", facilityType: "hospital", onlineBookingAvailable: false });
    expect(screen.queryByText("Hospital", { exact: true })).not.toBeInTheDocument();
    view.rerender(<LocationCard location={{ ...facility, name: "River Care", facilityType: "hospital", onlineBookingAvailable: false }} onNavigate={vi.fn()} showDistance={false} approximateDistance={false} />);
    expect(screen.queryByText("Hospital", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View hospital" })).toBeInTheDocument();
  });
  it("does not guess a clinic classification for an unclassified facility", () => {
    show({ facilityType: null, name: "Grove Care" });
    expect(screen.queryByText("Clinic", { exact: true })).not.toBeInTheDocument();
  });
  it("keeps the address read-only and labels directions accessibly", () => {
    show();
    const directions = screen.getByRole("link", { name: /Get directions to Grove Clinic/ });
    expect(screen.getByText("Baner Road, Pune").closest("a")).toBeNull();
    expect(document.querySelector('a[href*="/maps/search/"]')).toBeNull();
    expect(directions).toHaveTextContent("Directions");
    expect(new URL(directions.getAttribute("href")!).searchParams.get("destination")).toBe("Grove Clinic, Baner Road, Pune");
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    expect(directions).toHaveAttribute("target", "_blank");
  });
  it("uses valid saved coordinates on the equator instead of a guessed place", () => {
    show({ latitude: 0, longitude: 72 });
    const url = new URL(screen.getByRole("link", { name: /Get directions/ }).getAttribute("href")!);
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("0,72");
  });
  it("uses the address for an unmapped zero-pair pin and omits its misleading distance", () => {
    render(<LocationCard location={{ ...facility, latitude: 0, longitude: 0, distanceKm: 8231 }} onNavigate={vi.fn()} showDistance approximateDistance />);
    const url = new URL(screen.getByRole("link", { name: /Get directions/ }).getAttribute("href")!);
    expect(url.searchParams.get("destination")).toBe("Grove Clinic, Baner Road, Pune");
    expect(screen.queryByText(/8231/)).not.toBeInTheDocument();
  });
  it("loads only the contained identity logo and never the saved banner", () => {
    const { container } = show({ logo_url: "/logo.png", image_url: "/cover.png" });
    expect(container.querySelector('img[src="/logo.png"]')).toHaveAttribute("loading", "lazy");
    expect(container.querySelector('img[src="/cover.png"]')).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
  it("does not enlarge a logo into a duplicate photographic cover", () => {
    const { container } = show({ logo_url: "/logo.png", image_url: "/logo.png" });
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('img')?.className).toContain("logo");
  });
  it("does not use the gallery as a background when a saved banner is absent", () => {
    const { container } = show({ images: ["/room.png"] });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText(/\d+ Photos?/)).not.toBeInTheDocument();
  });
  it("does not emit a directions link without any location data", () => {
    show({ city: "", address: ".", latitude: NaN, longitude: 181 });
    expect(screen.getByText("Location not listed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Google Maps/ })).not.toBeInTheDocument();
  });
  it("shows the native phone action and keeps email on the detail page", () => {
    show();
    expect(screen.getByRole("link", { name: /Call Grove Clinic/ })).toHaveAttribute("href", "tel:+910000000000");
    expect(screen.queryByText("hello@example.test")).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
  it("does not invent phone or email when the facility has not listed contacts", () => {
    show({ phone: "", email: "" });
    expect(screen.queryByText("Contact details not listed")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Call/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
  it("does not turn malformed contacts into executable or header-injecting URLs", () => {
    show({ phone: "javascript:alert(1)", email: "hello@example.test?bcc=someone@example.test" });
    expect(document.querySelector('a[href^="tel:"],a[href^="mailto:"]')).toBeNull();
  });
  it("has a dimensioned lazy facility image and graceful failed-image fallback", () => {
    const { container } = show({ logo_url: "/facility-logo.webp" });
    const image = container.querySelector('img')!;
    expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
    expect(image.getAttribute("height")).toBe(image.getAttribute("width"));
    expect(image).toHaveAttribute("loading", "lazy");
    fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole("heading", { name: "Grove Clinic" })).toBeInTheDocument();
  });
  it("does not create dead profile links or expose private ids when a public slug is missing", () => {
    show({ slug: undefined });
    expect(screen.queryByRole("link", { name: "View facility" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grove Clinic" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get directions/ })).toBeInTheDocument();
  });
  it("shows only saved facility specialties and omits an invented subtitle", () => {
    const view = show({ specialties: [" Family Medicine ", "Family Medicine", "General Medicine"] });
    expect(screen.getByText("Family Medicine · General Medicine")).toBeInTheDocument();
    view.rerender(<LocationCard location={facility} onNavigate={vi.fn()} showDistance={false} approximateDistance={false} />);
    expect(screen.queryByText(/Primary Care|Family Medicine/)).not.toBeInTheDocument();
  });
  it("keeps review details off compact facility rows even when feedback exists", () => {
    const view = show({ rating: 4.7, reviewsCount: 12 });
    expect(screen.queryByLabelText(/out of 5/)).not.toBeInTheDocument();
    expect(screen.queryByText("(12)")).not.toBeInTheDocument();
    view.rerender(<LocationCard location={{ ...facility, rating: 5, reviewsCount: 0 }} onNavigate={vi.fn()} showDistance={false} approximateDistance={false} />);
    expect(screen.queryByLabelText(/out of 5/)).not.toBeInTheDocument();
  });
  it("shows explicit hours without treating missing hours as closed", () => {
    const view = show({ timings: "24/7", timezone: "Asia/Kolkata" });
    expect(screen.getByText("Open 24/7")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
    view.rerender(<LocationCard location={facility} onNavigate={vi.fn()} showDistance={false} approximateDistance={false} />);
    expect(screen.getByText("Hours unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Closed today")).not.toBeInTheDocument();
  });
});
