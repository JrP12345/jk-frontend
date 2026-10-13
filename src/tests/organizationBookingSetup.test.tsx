import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationBookingSetup } from "@/components/organization/OrganizationBookingSetup";
import { publicBookingChecklist } from "@/lib/publicBookingSetup";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const admin = { id: "admin", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["VIEW_LOCATIONS", "MANAGE_STAFF", "MANAGE_BILLING"] };
const location = { id: "branch", slug: "care-branch", name: "Care branch", isActive: true, isPublished: true };
const detail: LocationDetail = { ...location, city: "Surat", address: "Care street", phone: "1234567890", email: "", description: "", image_url: "", timings: JSON.stringify({ Monday: [{ start: "09:00", end: "17:00" }] }), organization: { id: "org", name: "Care" }, onlineBookingAvailable: true, doctors: [{ id: "owner", slug: "owner-doctor", name: "Owner", specialization: "General", qualification: "MBBS", experience_years: 2, fees: 650, feeType: "fixed", timings: "", working_days: "", description: "", image_url: "" }] };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => {
  useAuthStore.setState({ user: admin });
  vi.spyOn(api, "get").mockImplementation(async path => response(String(path).startsWith("/public/") ? detail : [location]));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const mount = (onNavigate = vi.fn()) => render(<OrganizationBookingSetup organizationId="org" onNavigate={onNavigate} />);

describe("Organization public booking readiness", () => {
  it("reviews the sole location and previews canonical location and doctor links", async () => {
    mount();
    await screen.findByText("Public page available");
    expect(screen.getByRole("combobox", { name: "Review location" })).toHaveTextContent("Care branch");
    expect(screen.getByRole("link", { name: "Preview public location page" })).toHaveAttribute("href", "/browse/care-branch");
    expect(screen.getByRole("link", { name: "Preview Owner's doctor page" })).toHaveAttribute("href", "/doctor/owner-doctor?location=care-branch");
    expect(within(screen.getByRole("list", { name: "Public booking checklist" })).getAllByText("Complete")).toHaveLength(6);
  });

  it("shows the missing doctor assignment and routes setup to the existing members section", async () => {
    vi.mocked(api.get).mockImplementation(async path => response(String(path).startsWith("/public/") ? { ...detail, doctors: [], bookingStatus: "no_doctors" } : [location]));
    const navigate = vi.fn(); mount(navigate);
    await screen.findByText("Location assignment required");
    fireEvent.click(screen.getByRole("button", { name: "Open clinical team setup" }));
    expect(navigate).toHaveBeenCalledWith("members");
    expect(screen.queryByText("Public page available")).not.toBeInTheDocument();
  });

  it("separates publication from a subscription that pauses online booking", async () => {
    vi.mocked(api.get).mockImplementation(async path => response(String(path).startsWith("/public/") ? { ...detail, onlineBookingAvailable: false, bookingStatus: "contact_location" } : [location]));
    const navigate = vi.fn(); mount(navigate);
    await screen.findByText("Online booking is paused");
    expect(screen.getByRole("link", { name: "Preview public location page" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review subscription" }));
    expect(navigate).toHaveBeenCalledWith("subscription");
  });

  it("does not query or preview an unpublished page", async () => {
    vi.mocked(api.get).mockResolvedValue(response([{ ...location, isPublished: false }])); mount();
    await screen.findByText("Location page is unpublished");
    expect(vi.mocked(api.get).mock.calls.some(([path]) => String(path).startsWith("/public/"))).toBe(false);
    expect(screen.queryByRole("link", { name: "Preview public location page" })).not.toBeInTheDocument();
  });

  it("requires selection for multiple branches and offers location creation for an empty list", async () => {
    vi.mocked(api.get).mockResolvedValue(response([location, { ...location, id: "second", slug: "second", name: "Second" }]));
    const view = mount();
    expect(await screen.findByRole("combobox", { name: "Review location" })).toHaveTextContent("Choose a location");
    expect(vi.mocked(api.get).mock.calls).toHaveLength(1);
    view.unmount(); vi.mocked(api.get).mockResolvedValue(response([]));
    const navigate = vi.fn(); mount(navigate); await screen.findByText("Create a location first");
    fireEvent.click(screen.getByRole("button", { name: "Open location setup" })); expect(navigate).toHaveBeenCalledWith("locations");
  });

  it("does not mark an unavailable or foreign public response complete, and recovers by retrying", async () => {
    vi.mocked(api.get).mockImplementation(async path => response(String(path).startsWith("/public/") ? { ...detail, organization: { id: "foreign" } } : [location])); mount();
    await screen.findByText("Public status unavailable");
    expect(screen.queryByRole("list", { name: "Public booking checklist" })).not.toBeInTheDocument();
    vi.mocked(api.get).mockResolvedValue(response(detail));
    fireEvent.click(screen.getByRole("button", { name: "Retry public check" })); await screen.findByText("Public page available");
  });

  it("discards a late public response after the selected organization changes", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(async path => String(path).startsWith("/public/") ? new Promise(resolve => { finish = resolve; }) : response([location]));
    const view = mount(); await waitFor(() => expect(finish).toBeTypeOf("function"));
    vi.mocked(api.get).mockResolvedValue(response([{ ...location, id: "other", slug: "other", isPublished: false }]));
    view.rerender(<OrganizationBookingSetup organizationId="other-org" onNavigate={vi.fn()} />);
    await screen.findByText("Location page is unpublished");
    await act(async () => { finish(response(detail)); });
    expect(screen.queryByRole("link", { name: "Preview public location page" })).not.toBeInTheDocument();
  });

  it("does not fetch setup data without the existing location permission", () => {
    useAuthStore.setState({ user: { ...admin, permissions: [] } }); mount();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByText("Public booking setup")).not.toBeInTheDocument();
  });

  it("counts free and post-consultation fees as clear without treating absent doctors as ready", () => {
    expect(publicBookingChecklist({ ...detail, doctors: detail.doctors.map(doctor => ({ ...doctor, fees: 0, feeType: "free" })) }).find(item => item.label === "Consultation fees are clear")?.complete).toBe(true);
    expect(publicBookingChecklist({ ...detail, doctors: detail.doctors.map(doctor => ({ ...doctor, fees: 0, feeType: "post_consultation" })) }).find(item => item.label === "Consultation fees are clear")?.complete).toBe(true);
    expect(publicBookingChecklist({ ...detail, doctors: [] }).find(item => item.label === "Consultation fees are clear")?.complete).toBe(false);
  });
});
