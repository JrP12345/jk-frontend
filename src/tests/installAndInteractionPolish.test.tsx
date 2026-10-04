import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import BrowseClient from "@/app/browse/BrowseClient";
import BrowseDetailClient, { type ClinicDetail } from "@/app/browse/[id]/BrowseDetailClient";
import { FloatingAICopilot } from "@/components/ai/FloatingAICopilot";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { forceResetScrollLock, lockScroll, unlockScroll } from "@/lib/scrollLock";
import api from "@/lib/api";
import { printElement, printWhenReady } from "@/lib/printBrand";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

const mocks = vi.hoisted(() => ({ push: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/MarketplaceNavbar", () => ({ default: () => null }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/geo/locationDetector", () => ({ detectUserLocation: async () => null, findMatchingClinicCity: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "patient", role: "patient", name: "Patient", email: "patient@test.com", permissions: [] }, isAuthenticated: true, isLoading: false });
  useClinicStore.setState({ activeClinicId: null });
});
afterEach(() => { forceResetScrollLock(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Production install assets", () => {
  it("provides opaque icons at their declared sizes and keeps maskable artwork in its safe circle", async () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    for (const icon of [...manifest.icons, { src: "/app-icon-180.png", sizes: "180x180" }]) {
      const size = Number(icon.sizes.split("x")[0]);
      const { data, info } = await sharp(`public${icon.src.split("?")[0]}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([size, size]);
      let minimumAlpha = 255;
      for (let offset = 3; offset < data.length; offset += 4) minimumAlpha = Math.min(minimumAlpha, data[offset]);
      expect(minimumAlpha).toBe(255);
      expect(Array.from(data.subarray(0, 4))).toEqual([247, 247, 242, 255]);
      if (icon.purpose === "maskable") {
        let radius = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4;
          if (Math.abs(data[offset] - 247) + Math.abs(data[offset + 1] - 247) + Math.abs(data[offset + 2] - 242) > 30) radius = Math.max(radius, Math.hypot(x - size / 2, y - size / 2));
        }
        expect(radius).toBeLessThanOrEqual(size * 0.4);
      }
    }
  });
});

describe("Shared action and overlay behavior", () => {
  it("locks an async action immediately, keeps its intrinsic content space, and restores its original icon", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<><Button aria-label="Save changes" onClick={action} icon={<svg role="img" aria-label="Save icon" />}>Save changes</Button><Button>Unrelated action</Button></>);
    const button = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(button); fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.firstElementChild).toHaveClass("grid");
    expect(button.querySelector('[aria-hidden="true"].invisible')).toBeInTheDocument();
    expect(button.style.width).toBe("");
    expect(screen.queryByRole("img", { name: "Save icon" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Unrelated action" })).toBeEnabled();
    await act(async () => finish());
    expect(button).toBeEnabled();
    expect(button.style.width).toBe("");
    expect(screen.getByRole("img", { name: "Save icon" })).toBeInTheDocument();
  });

  it("restores scroll position and existing styles after the last nested overlay closes", () => {
    vi.stubGlobal("scrollY", 480);
    vi.stubGlobal("scrollX", 0);
    const scroll = vi.fn(); vi.stubGlobal("scrollTo", scroll);
    document.body.style.position = "relative";
    lockScroll(); lockScroll();
    expect(document.body.style.top).toBe("-480px");
    unlockScroll();
    expect(document.body.style.position).toBe("fixed");
    expect(scroll).not.toHaveBeenCalled();
    unlockScroll();
    expect(document.body.style.position).toBe("relative");
    expect(scroll).toHaveBeenCalledWith(0, 480);
    document.body.style.position = "";
  });

  it("fits a dialog to the keyboard viewport, blocks background interaction, and keeps its action visible", async () => {
    const visible = Object.assign(new EventTarget(), { offsetTop: 12, offsetLeft: 0, width: 390, height: 320 });
    vi.stubGlobal("visualViewport", visible);
    const { container, rerender } = render(<><button>Page behind</button><Modal open title="Focused task" onClose={vi.fn()} footer={<Button>Save task</Button>}>Details</Modal></>);
    const dialog = await screen.findByRole("dialog", { name: "Focused task" });
    expect(dialog.parentElement).toHaveStyle({ top: "12px", height: "320px", width: "390px" });
    expect(container.inert).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Save task" })).toBeVisible();
    rerender(<button>Page behind</button>);
    expect(container.inert).not.toBe(true);
  });
});

describe("Browse and booking continuity", () => {
  const clinic: ClinicDetail = { id: "clinic", name: "Test Clinic", city: "Surat", address: "Test street", phone: "", email: "", description: "Care", image_url: "", timings: "09:00-17:00", doctors: [{ id: "doctor", name: "Test Doctor", specialization: "General Physician", qualification: "MBBS", experience_years: 5, fees: 0, feeType: "free", timings: "09:00-17:00", working_days: "Monday-Saturday", description: "", image_url: "", bookingMode: "sequential_queue" }] };

  it("shows honest fee and experience states without unsupported trust claims", () => {
    const doctor = { ...clinic.doctors[0], fees: 0, feeType: "fixed" as const, qualification: "", experience_years: 0, rating: 5, reviewsCount: 0 };
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={{ ...clinic, doctors: [doctor] }} /></ToastProvider></ThemeProvider>);
    expect(screen.getAllByText("Ask clinic for fee").length).toBeGreaterThan(0);
    expect(screen.getByText("Not listed")).toBeInTheDocument();
    expect(screen.queryByText(/verified facility|accredited healthcare|cashless support/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 5 from/i)).not.toBeInTheDocument();
  });

  it("opens directions to recorded coordinates when both are valid", () => {
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={{ ...clinic, latitude: 21.17, longitude: 72.83 }} /></ToastProvider></ThemeProvider>);
    const link = screen.getByRole("link", { name: "Get Directions" });
    expect(new URL(link.getAttribute("href")!).searchParams.get("destination")).toBe("21.17,72.83");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("uses the recorded address and city when coordinates are unavailable", () => {
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={{ ...clinic, latitude: 91, longitude: 72.83 }} /></ToastProvider></ThemeProvider>);
    const link = screen.getByRole("link", { name: "Get Directions" });
    expect(new URL(link.getAttribute("href")!).searchParams.get("destination")).toBe("Test street, Surat");
  });

  it("does not offer directions when only the city is recorded", () => {
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={{ ...clinic, address: "." }} /></ToastProvider></ThemeProvider>);
    expect(screen.queryByRole("link", { name: "Get Directions" })).not.toBeInTheDocument();
  });

  it("renders partial records and replaces failed images without pretending that missing fees are free", () => {
    render(<BrowseClient initialLoaded initialClinics={[{ id: "partial", name: "Partial Clinic", rating: "4.8", reviewsCount: "2", logo_url: "/broken.png", doctorCount: 1, doctorsSummary: [{ id: "doc", name: "Doctor" }], facilities: [null, "Parking"], specialties: [null] }] as never} />);
    expect(screen.getByRole("link", { name: "Partial Clinic" })).toBeInTheDocument();
    expect(screen.getByText("Fee not listed")).toBeInTheDocument();
    expect(screen.getByText("Location not listed")).toBeInTheDocument();
    expect(screen.queryByText("Hours not listed")).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole("img", { name: "Partial Clinic" }));
    expect(screen.queryByRole("img", { name: "Partial Clinic" })).not.toBeInTheDocument();
  });

  it("uses the same loading shell during server loading without starting duplicate requests", () => {
    const request = vi.spyOn(api, "get");
    render(<BrowseClient loadingOnly />);
    expect(screen.getByText("Finding clinics...")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort clinics by" })).toBeDisabled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["confirmed", "Appointment confirmed"],
    ["pending", "Booking pending confirmation"],
    ["pending_payment", "Booking awaiting payment"],
  ])("checks availability, submits once, and shows %s within the same dialog", async (status, label) => {
    let available!: (value: unknown) => void;
    vi.spyOn(api, "get").mockImplementation(() => new Promise(resolve => { available = resolve; }));
    let confirmed!: (value: unknown) => void;
    const post = vi.spyOn(api, "post").mockImplementation(() => new Promise(resolve => { confirmed = resolve; }));
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={clinic} /></ToastProvider></ThemeProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Check appointments" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Select Date & Time" });
    expect(document.body.style.position).toBe("fixed");
    expect(within(dialog).getByRole("button", { name: "Continue to Details" })).toBeDisabled();
    await act(async () => available({ data: { data: { isWorkingDay: true, bookingMode: "sequential_queue", slots: [], dayStartTime: "09:00", nextToken: 1 } } }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Details" }));
    const confirm = within(dialog).getByRole("button", { name: "Confirm Appointment" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(post).toHaveBeenCalledOnce();
    expect(within(dialog).getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await act(async () => confirmed({ data: { data: { id: "appointment", status, tokenNumber: 5, paymentStatus: "paid" } } }));
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByText("#5")).toBeInTheDocument();
    expect(within(dialog).getByText("Clinic Queue Token")).toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent(label);
    expect(within(dialog).getByText("Test Clinic")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeEnabled();
    expect(within(dialog).getByRole("link", { name: "Open Live Tracker" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledOnce();
  });

  it("leaves Continue disabled after availability fails and offers a local retry", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("Offline"));
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={clinic} /></ToastProvider></ThemeProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Check appointments" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Select Date & Time" });
    expect(await within(dialog).findByText("Availability could not be checked. Please try again.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue to Details" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("respects an empty server slot list instead of generating bookable local slots", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "time_slot", slots: [] } } });
    const timedClinic = { ...clinic, doctors: clinic.doctors.map(doctor => ({ ...doctor, bookingMode: "time_slot" })) };
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={timedClinic} /></ToastProvider></ThemeProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Check appointments" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Select Date & Time" });
    await within(dialog).findByText("Availability updated");
    expect(within(dialog).getByRole("button", { name: "Continue to Details" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: /\d+:\d+ (AM|PM)/ })).not.toBeInTheDocument();
  });

  it("prevents continuing when the server reports that all queue tokens are booked", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { isWorkingDay: true, bookingMode: "sequential_queue", slots: [], nextToken: 21, maxDailyTokens: 20, tokensToday: 20 } } });
    render(<ThemeProvider><ToastProvider><BrowseDetailClient id="clinic" initialClinic={clinic} /></ToastProvider></ThemeProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: "Check appointments" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Select Date & Time" });
    expect(await within(dialog).findByText("All tokens are booked")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue to Details" })).toBeDisabled();
  });
});

describe("AI context and recovery", () => {
  const root = { id: "root", role: "root" as const, name: "Root", email: "root@test.com", permissions: [] };
  it("asks a root user to choose an organization without making repeated forbidden requests", async () => {
    useAuthStore.setState({ user: root });
    const get = vi.spyOn(api, "get"); const post = vi.spyOn(api, "post");
    render(<FloatingAICopilot />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle AI Copilot" }));
    expect(await screen.findByRole("button", { name: "Choose organization" })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });

  it("passes root clinic context through session creation and message send, without dropping the first question", async () => {
    useAuthStore.setState({ user: root }); useClinicStore.setState({ activeClinicId: "chosen-clinic" });
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [] } });
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: { data: { id: "new-chat", messages: [] } } }).mockResolvedValueOnce({ data: { data: { allMessages: [{ id: "answer", sender: "ai", text: "Ready to help", timestamp: "12:00" }] } } });
    render(<FloatingAICopilot />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle AI Copilot" }));
    const input = await screen.findByRole("textbox", { name: "Message to AI Copilot" });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "Show today's appointments" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/ai/chat/sessions/new-chat/messages?clinicId=chosen-clinic", expect.objectContaining({ query: "Show today's appointments" }), expect.anything()));
    expect(await screen.findByText("Ready to help")).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("does not display clinical AI controls to an account without clinical permission", () => {
    render(<FloatingAICopilot />);
    expect(screen.queryByRole("button", { name: "Toggle AI Copilot" })).not.toBeInTheDocument();
  });
});

describe("Shared printing", () => {
  it("waits for images and fonts before opening the print dialog", async () => {
    const doc = document.implementation.createHTMLDocument("Appointment");
    const image = doc.createElement("img");
    doc.body.appendChild(image);
    let imageReady!: () => void;
    let fontsReady!: () => void;
    image.decode = vi.fn(() => new Promise<void>(resolve => { imageReady = resolve; }));
    Object.defineProperty(doc, "fonts", { value: { ready: new Promise<void>(resolve => { fontsReady = resolve; }) } });
    const target = { document: doc, focus: vi.fn(), print: vi.fn() };
    const pending = printWhenReady(target as unknown as Window);
    expect(target.print).not.toHaveBeenCalled();
    imageReady();
    await Promise.resolve();
    expect(target.print).not.toHaveBeenCalled();
    fontsReady();
    await pending;
    expect(target.focus).toHaveBeenCalledOnce();
    expect(target.print).toHaveBeenCalledOnce();
  });

  it("prints only the selected document and removes its frame after printing", async () => {
    const { container } = render(<><nav>Dashboard navigation</nav><div data-testid="slip">Appointment token #7</div></>);
    const pending = printElement(container.querySelector('[data-testid="slip"]')!, { title: "Token", paper: "80mm" });
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-print-frame]")!;
    vi.spyOn(frame.contentWindow!, "focus").mockImplementation(() => {});
    const print = vi.spyOn(frame.contentWindow!, "print").mockImplementation(() => {});
    await pending;
    expect(print).toHaveBeenCalledOnce();
    expect(frame.contentDocument!.body.textContent).toBe("Appointment token #7");
    expect(frame.contentDocument!.body.textContent).not.toContain("Dashboard navigation");
    expect(frame.contentDocument!.head.textContent).toContain("80mm auto");
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(frame.isConnected).toBe(false);
  });
});
