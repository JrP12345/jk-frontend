import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MonitorPage from "@/app/(dashboard)/dashboard/admin/monitor/page";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const session = { id: "session-staff", userId: "staff", userName: "Clinic Staff", userEmail: "staff@example.test", userRole: "doctor", organizationId: "org", organizationName: "Aarogya Clinic", organizationCity: "Surat", ipAddress: "2001:db8:1234:5678:90ab:cdef:1234:5678", userAgent: "", deviceName: "Mobile browser", deviceType: "Mobile", browser: "Safari", os: "iOS", createdAt: "2026-10-17T10:00:00Z", lastActiveAt: "2026-10-17T11:00:00Z", isCurrent: false, isGuest: false };
const current = { ...session, id: "session-root", userId: "root", userName: "Root Admin", userRole: "root", isCurrent: true, deviceType: "Desktop" };
const traffic = { summary: { todayVisits: 24, todayVisitors: 12, yesterdayVisits: 18, yesterdayVisitors: 9, sevenDayVisits: 100, thirtyDayVisits: 300, totalVisits: 600 }, dailyTrends: [{ date: "2026-10-16", visits: 0, uniqueVisitors: 0 }, { date: "2026-10-17", visits: 24, uniqueVisitors: 12 }], locationAttribution: [{ locationId: "location", locationName: "Aarogya Clinic", organizationName: "Aarogya Healthcare", city: "Surat", visits: 24, uniqueVisitors: 12, percentShare: 100 }], topPages: [{ path: "/browse/aarogya-clinic", visits: 24 }], devices: [{ name: "Mobile", count: 12 }], browsers: [{ name: "Safari", count: 12 }] };
const response = (data: unknown) => ({ data: { data } });
const mount = () => render(<ToastProvider><MonitorPage /></ToastProvider>);

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "root", name: "Root Admin", email: "root@example.test", role: "root" }, isAuthenticated: true, isLoading: false });
  vi.spyOn(api, "get").mockImplementation(async path => response(String(path).includes("/sessions") ? [current, session] : traffic));
  vi.spyOn(api, "delete").mockResolvedValue(response({}));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

describe("Platform activity monitor", () => {
  it("denies monitor reads and actions to organization administrators", () => {
    useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org" } });
    mount();
    expect(screen.getByText("Root Super-Admin Access Required")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("shows pending session counts as loading and protects the current device", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(async path => String(path).includes("/sessions") ? new Promise(done => { resolve = done; }) : response(traffic));
    mount();
    expect(screen.getByLabelText("Session summary")).toHaveAttribute("aria-busy", "true");
    await act(async () => resolve(response([current, session])));
    expect(await screen.findByRole("article", { name: "Session for Root Admin" })).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Current device" }).forEach(button => expect(button).toBeDisabled());
    expect(screen.getByLabelText("Session summary")).toHaveAttribute("aria-busy", "false");
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("filters session identities by role and searches device and network details", async () => {
    mount();
    await screen.findByRole("article", { name: "Session for Clinic Staff" });
    fireEvent.click(screen.getByRole("combobox", { name: "Session role" }));
    fireEvent.click(screen.getByRole("option", { name: "Physician / Doctor" }));
    expect(screen.queryByRole("article", { name: "Session for Root Admin" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search active sessions" }), { target: { value: "2001:db8" } });
    expect(screen.getByRole("article", { name: "Session for Clinic Staff" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search active sessions" }), { target: { value: "no matching device" } });
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getAllByText("No active user sessions match the selected filter.").length).toBeGreaterThan(0);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("requires confirmation before terminating the captured session", async () => {
    mount();
    const row = await screen.findByRole("article", { name: "Session for Clinic Staff" });
    fireEvent.click(within(row).getByRole("button", { name: "Terminate session" }));
    let dialog = screen.getByRole("dialog", { name: "Terminate Clinic Staff's Session?" });
    expect(dialog).toHaveTextContent(session.ipAddress);
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(row).getByRole("button", { name: "Terminate session" }));
    dialog = screen.getByRole("dialog", { name: "Terminate Clinic Staff's Session?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Terminate" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledExactlyOnceWith("/auth/admin/sessions/session-staff"));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Session for Clinic Staff" })).not.toBeInTheDocument());
    expect(screen.getByRole("article", { name: "Session for Root Admin" })).toBeInTheDocument();
  });

  it("retains a session when termination fails", async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error("unavailable"));
    mount();
    const row = await screen.findByRole("article", { name: "Session for Clinic Staff" });
    fireEvent.click(within(row).getByRole("button", { name: "Terminate session" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm Terminate" }));
    await screen.findByText("Termination Failed");
    expect(screen.getByRole("article", { name: "Session for Clinic Staff" })).toBeInTheDocument();
  });

  it("recovers a failed session read without displaying a zero-session result", async () => {
    let fail = true;
    vi.mocked(api.get).mockImplementation(async path => {
      if (!String(path).includes("/sessions")) return response(traffic);
      if (fail) throw new Error("offline");
      return response([current, session]);
    });
    mount();
    await screen.findByText("Sessions unavailable");
    expect(within(screen.getByLabelText("Session summary")).getAllByLabelText("Unavailable")).toHaveLength(4);
    expect(screen.queryByText("No active user sessions match the selected filter.")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry sessions" }));
    expect(await screen.findByRole("article", { name: "Session for Clinic Staff" })).toBeInTheDocument();
  });

  it("supports keyboard tabs, traffic periods and accessible daily counts", async () => {
    mount();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Live sessions" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Website traffic" })).toHaveAttribute("aria-selected", "true");
    await screen.findByRole("img", { name: "2026-10-17: 24 visits, 12 unique visitors" });
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/admin/analytics/traffic?days=30"));
    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
    await screen.findByRole("img", { name: "2026-10-16: 0 visits, 0 unique visitors" });
    fireEvent.click(screen.getByText("View daily counts"));
    expect(screen.getByRole("table", { name: "Daily traffic counts" })).toHaveTextContent("2026-10-172412");
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("retries a failed traffic read while keeping the selected period", async () => {
    let fail = true;
    vi.mocked(api.get).mockImplementation(async path => {
      if (String(path).includes("/sessions")) return response([current]);
      if (fail) throw new Error("offline");
      return response(traffic);
    });
    mount();
    fireEvent.click(screen.getByRole("tab", { name: "Website traffic" }));
    await screen.findByText("Traffic unavailable");
    expect(within(screen.getByLabelText("Traffic summary")).getAllByLabelText("Unavailable")).toHaveLength(4);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry traffic" }));
    expect(await screen.findByRole("img", { name: "2026-10-17: 24 visits, 12 unique visitors" })).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith("/admin/analytics/traffic?days=14");
  });
});
