import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicPharmacyCatalogue } from "@/components/pharmacy/PublicPharmacyCatalogue";
import PickupTicketPage from "@/app/pickup/PickupTicketPage";
import { PharmacyStorefrontSettings } from "@/components/pharmacy/PharmacyStorefrontSettings";
import { PharmacyPickups } from "@/components/pharmacy/PharmacyPickups";
import { parsePickupTicket, pickupTokenFromScan, publicMedicines, readPickupTicket, requestPickup, type PickupTicket } from "@/lib/publicPharmacy";
import { changePickup, readPickupQueue, readStorefront, saveStorefront, scanPickupTicket } from "@/lib/pharmacyPickup";
import { facilityHasDoctorSection } from "@/lib/facility";
import { locationDescription } from "@/lib/publicSeo";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { LocationStatusBadge } from "@/components/ui/LocationStatusBadge";

const fixture = vi.hoisted(() => ({ push: vi.fn(), qr: vi.fn().mockResolvedValue("data:image/png;base64,ABC") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: fixture.qr } }));
vi.mock("@/components/MarketplaceNavbar", () => ({ default: () => <nav>Navigation</nav> }));
vi.mock("@/components/pharmacy/PharmacyCollections", () => ({ PharmacyCollections: () => <p>Existing bill collection</p> }));
vi.mock("@/lib/publicPharmacy", async original => ({ ...await original<typeof import("@/lib/publicPharmacy")>(), publicMedicines: vi.fn(), requestPickup: vi.fn(), readPickupTicket: vi.fn() }));
vi.mock("@/lib/pharmacyPickup", async original => ({ ...await original<typeof import("@/lib/pharmacyPickup")>(), changePickup: vi.fn(), readPickupQueue: vi.fn(), readStorefront: vi.fn(), saveStorefront: vi.fn(), scanPickupTicket: vi.fn() }));
const product = { id: "product", name: "Ordinary medicine", genericName: "Generic", strength: "", baseUnit: "tablet", unitVersion: 1, available: true };
const ticket: PickupTicket = { id: "request", locationId: "branch", reference: "PK-123456789A", status: "requested", revision: 0, createdAt: "2026-11-14T00:00:00Z", expiresAt: "2099-11-16T00:00:00Z", items: [{ medicineId: product.id, name: product.name, strength: "", baseUnit: "tablet", quantity: 2 }] };
const secret = "a".repeat(64);
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  vi.clearAllMocks(); window.history.replaceState(null, "", "/");
  vi.mocked(publicMedicines).mockResolvedValue({ items: [product], nextCursor: null, pickupEnabled: true });
  vi.mocked(readPickupTicket).mockResolvedValue(ticket);
  vi.mocked(readStorefront).mockResolvedValue({ locationId: "branch", catalogueEnabled: false, pickupEnabled: false, revision: 0 });
  vi.mocked(readPickupQueue).mockResolvedValue({ items: [{ ...ticket, customerName: "Customer", phone: "9999999999" }], nextCursor: null });
  vi.mocked(scanPickupTicket).mockResolvedValue({ ...ticket, customerName: "Customer", phone: "9999999999" });
});

it("accepts local QR fragments and staff references without following scanned links", () => {
  expect(pickupTokenFromScan(`https://example.test/pickup#${secret}`)).toBe(secret);
  expect(pickupTokenFromScan(ticket.reference)).toBe(ticket.reference);
  expect(() => pickupTokenFromScan(`javascript:alert(1)#${secret}`)).toThrow();
  expect(() => pickupTokenFromScan(`https://example.test/pickup?token=${secret}`)).toThrow();
  expect(() => parsePickupTicket({ ...ticket, locationId: "foreign" }, "branch")).toThrow();
  expect(() => parsePickupTicket({ ...ticket, items: [{ ...ticket.items[0], quantity: -1 }] })).toThrow();
});

it("does not infer a doctor requirement or appointment description for pharmacies and diagnostics", () => {
  expect(facilityHasDoctorSection({ facilityType: "pharmacy", doctors: [] })).toBe(false);
  expect(facilityHasDoctorSection({ facilityType: "diagnostic_center", doctorCount: 0 })).toBe(false);
  expect(facilityHasDoctorSection({ facilityType: "pharmacy", doctors: [{}] })).toBe(true);
  expect(facilityHasDoctorSection({ facilityType: "clinic", doctors: [] })).toBe(true);
  expect(locationDescription({ name: "Pharmacy", facilityType: "pharmacy", doctors: [] } as unknown as LocationDetail)).not.toContain("appointment");
});

it("does not advertise emergency or OPD services from a pharmacy's opening hours", () => {
  const { rerender } = render(<LocationStatusBadge timings="24/7" context="services" />);
  expect(screen.getByText("Open 24 hours")).toBeInTheDocument();
  expect(screen.queryByText(/Emergency/)).not.toBeInTheDocument();
  rerender(<LocationStatusBadge timings="" context="services" />);
  expect(screen.getByText("Contact this location for opening hours")).toBeInTheDocument();
});

it("keeps an unpublished pharmacy private and supports a list without pickup selection", async () => {
  const { rerender } = render(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published={false} allowPickup={false} />);
  expect(screen.getByText(/Contact this pharmacy/)).toBeInTheDocument(); expect(publicMedicines).not.toHaveBeenCalled();
  vi.mocked(publicMedicines).mockResolvedValue({ items: [product], nextCursor: null, pickupEnabled: false });
  rerender(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published allowPickup={false} />);
  expect(await screen.findByRole("heading", { name: product.name })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Add Ordinary/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "2. Your details" })).not.toBeInTheDocument();
});
it("shows contact-for-availability for a billing-only catalogue without offering stock-based pickup", async () => {
  vi.mocked(publicMedicines).mockResolvedValue({ items: [{ ...product, available: false, availabilityKnown: false }], nextCursor: null, pickupEnabled: false });
  render(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published allowPickup={false} />);
  expect(await screen.findByText(/Contact pharmacy for availability/)).toBeInTheDocument();
  expect(screen.queryByText(/Currently unavailable/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Add Ordinary/ })).not.toBeInTheDocument();
});

it("shows both pickup steps before selection and enables requesting only with a medicine and contact details", async () => {
  render(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published allowPickup sidebar={<aside>Location information</aside>} />);
  expect(screen.getByRole("heading", { name: "1. Choose medicines" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "2. Your details" })).toBeInTheDocument();
  expect(screen.getByText("Location information")).toBeInTheDocument();
  const request = screen.getByRole("button", { name: "Request pickup" });
  expect(request).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Customer" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9999999999" } });
  expect(request).toBeDisabled();
  fireEvent.click(await screen.findByRole("button", { name: `Add ${product.name}` }));
  expect(request).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: `Remove ${product.name} from pickup` }));
  expect(request).toBeDisabled();
  expect(screen.getByLabelText("Your name")).toHaveValue("Customer");
});

it("uses pharmacy-local hours for closed notices and split shifts without inventing unspecified hours", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  const schedule = JSON.stringify({ monday: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "18:00" }] });
  const props = { locationId: "branch", slug: "pharmacy", published: true, allowPickup: true, timezone: "Asia/Kolkata" };
  const { rerender } = render(<PublicPharmacyCatalogue {...props} timings={schedule} />);
  await screen.findByRole("button", { name: `Add ${product.name}` });
  expect(screen.getByText(/Closed now.*Monday 9:00 AM/)).toBeInTheDocument();
  vi.setSystemTime(new Date("2026-11-16T08:00:00Z"));
  rerender(<PublicPharmacyCatalogue key="split" {...props} timings={schedule} />);
  await screen.findByRole("button", { name: `Add ${product.name}` });
  expect(screen.getByText(/Closed now.*today 3:00 PM/)).toBeInTheDocument();
  rerender(<PublicPharmacyCatalogue key="split" {...props} timings="24/7" />);
  expect(screen.queryByText(/Closed now/)).not.toBeInTheDocument();
  rerender(<PublicPharmacyCatalogue key="split" {...props} timings="" />);
  expect(screen.queryByText(/Closed now/)).not.toBeInTheDocument();
  await screen.findByRole("button", { name: `Add ${product.name}` });
});

it("keeps selected quantities visible when searching for a different medicine", async () => {
  render(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published allowPickup />);
  fireEvent.click(await screen.findByRole("button", { name: `Add ${product.name}` }));
  fireEvent.change(screen.getByRole("spinbutton", { name: `Pickup quantity ${product.name}`, exact: true }), { target: { value: "3" } });
  vi.mocked(publicMedicines).mockResolvedValue({ items: [], nextCursor: null, pickupEnabled: true });
  fireEvent.change(screen.getByLabelText("Search medicines"), { target: { value: "different" } });
  expect(await screen.findByText("No medicines match this search.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Also in your request" })).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: `Pickup quantity ${product.name}`, exact: true })).toHaveValue(3);
});

async function selectAndFill() {
  render(<PublicPharmacyCatalogue locationId="branch" slug="pharmacy" published allowPickup />);
  fireEvent.click(await screen.findByRole("button", { name: `Add ${product.name}` }));
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Customer" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9999999999" } });
}
it("selects quantities and navigates to a private QR ticket after a confirmed pickup", async () => {
  vi.mocked(requestPickup).mockResolvedValue(ticket); await selectAndFill();
  fireEvent.change(screen.getByLabelText(`Pickup quantity ${product.name}`), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Request pickup" }));
  await waitFor(() => expect(fixture.push).toHaveBeenCalledWith(expect.stringMatching(/^\/pickup#[a-f0-9]{64}$/)));
  expect(requestPickup).toHaveBeenCalledWith("pharmacy", "branch", expect.objectContaining({ items: [{ medicineId: "product", quantity: 2, unitVersion: 1 }] }), expect.any(String));
});
it("keeps uncertain submissions frozen and retries the same operation key and contents", async () => {
  vi.mocked(requestPickup).mockRejectedValueOnce(Error("Network interrupted")).mockResolvedValue(ticket); await selectAndFill();
  fireEvent.click(screen.getByRole("button", { name: "Request pickup" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry the same request" }));
  await waitFor(() => expect(requestPickup).toHaveBeenCalledTimes(2));
  expect(vi.mocked(requestPickup).mock.calls[0]).toEqual(vi.mocked(requestPickup).mock.calls[1]);
});
it("allows correction after local validation rather than freezing an unsent request", async () => {
  await selectAndFill(); fireEvent.change(screen.getByLabelText(`Pickup quantity ${product.name}`), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Request pickup" }));
  expect(await screen.findByText(/Enter your name, phone and whole quantities/)).toBeInTheDocument();
  expect(requestPickup).not.toHaveBeenCalled(); expect(screen.getByLabelText("Your name")).toBeEnabled();
});
it("shows a QR and clear status, but removes usable QR after handover", async () => {
  window.history.replaceState(null, "", `/pickup#${secret}`);
  render(<PickupTicketPage />);
  expect(await screen.findByText("Waiting for pharmacy confirmation")).toBeInTheDocument();
  expect(await screen.findByRole("img", { name: `Pickup QR for ${ticket.reference}` })).toBeInTheDocument();
  expect(fixture.qr).toHaveBeenCalledWith(expect.stringContaining(`/pickup#${secret}`), expect.any(Object));
  vi.mocked(readPickupTicket).mockResolvedValue({ ...ticket, status: "collected", revision: 2 });
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
  expect(await screen.findByText("Collected", { exact: true })).toBeInTheDocument(); expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("separates catalogue publication from pickup permission and saves the current revision", async () => {
  vi.mocked(saveStorefront).mockResolvedValue({ locationId: "branch", catalogueEnabled: true, pickupEnabled: false, revision: 1 });
  render(<PharmacyStorefrontSettings locationId="branch" organizationId="organization" />);
  const catalogue = await screen.findByRole("checkbox", { name: /^Publish medicine list/ });
  expect(screen.getByRole("checkbox", { name: /^Allow pickup requests/ })).toBeDisabled(); fireEvent.click(catalogue);
  expect(screen.getByRole("checkbox", { name: /^Allow pickup requests/ })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save public pharmacy settings" }));
  expect(readStorefront).toHaveBeenCalledWith("branch", expect.any(AbortSignal), "organization");
  await waitFor(() => expect(saveStorefront).toHaveBeenCalledWith("branch", { catalogueEnabled: true, pickupEnabled: false, expectedRevision: 0 }, "organization"));
});
it("scans a parcel, links a saved bill and uses the authoritative revision for preparation", async () => {
  vi.mocked(changePickup).mockResolvedValue({ ...ticket, status: "ready", revision: 1, customerName: "Customer", phone: "9999999999" });
  render(<PharmacyPickups locationId="branch" canPrepare canCollect canOpenTill />);
  fireEvent.click(await screen.findByRole("button", { name: "Open parcel" }));
  fireEvent.change(await screen.findByLabelText("Saved counter bill number"), { target: { value: "I-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Mark parcel ready" }));
  await waitFor(() => expect(changePickup).toHaveBeenCalledWith("request", { locationId: "branch", action: "ready", expectedRevision: 0, invoiceNumber: "I-123" }, expect.any(String)));
  expect(await screen.findByRole("button", { name: "Confirm parcel handed over" })).toBeInTheDocument();
});
it("allows read-only queue users to scan but hides preparation and handover actions", async () => {
  render(<PharmacyPickups locationId="branch" canPrepare={false} canCollect={false} canOpenTill={false} />);
  fireEvent.click(await screen.findByRole("button", { name: "Open parcel" }));
  await screen.findByText("Customer · 9999999999"); expect(screen.queryByRole("button", { name: "Mark parcel ready" })).not.toBeInTheDocument();
});
