import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Insurance from "@/app/(dashboard)/dashboard/insurance/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), clinic: "first", user: { id: "root", role: "root" } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/clinicStore", () => ({ useClinicStore: () => ({ activeClinicId: fixture.clinic }) }));
afterEach(() => { cleanup(); fixture.get.mockReset(); fixture.clinic = "first"; });
const empty = (url: string) => ({ data: { data: url.startsWith("/onboarding/staff") ? { doctors: [] } : [] } });
it.each(["/billing/claims", "/invoices"])("recovers a failed %s read without presenting a successful empty list", async (path) => {
  fixture.get.mockImplementation(async (url: string) => { if (url.startsWith(path)) throw new Error("offline"); return empty(url); });
  render(<ToastProvider><Insurance /></ToastProvider>);
  expect(await screen.findByText("Insurance records unavailable")).toBeInTheDocument();
  fixture.get.mockImplementation(async (url: string) => empty(url));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByText("Insurance records unavailable")).not.toBeInTheDocument());
  expect(fixture.get).toHaveBeenCalledWith(`${path}?clinicId=first`, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
it("ignores a failure from the previous clinic", async () => {
  let rejectOld!: (reason: Error) => void;
  fixture.get.mockImplementation((url: string) => url === "/billing/claims?clinicId=first" ? new Promise((_, reject) => { rejectOld = reject; }) : Promise.resolve(empty(url)));
  const view = render(<ToastProvider><Insurance /></ToastProvider>);
  fixture.clinic = "second";
  view.rerender(<ToastProvider><Insurance /></ToastProvider>);
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/billing/claims?clinicId=second", expect.anything()));
  await act(async () => rejectOld(new Error("late failure")));
  expect(screen.queryByText("Insurance records unavailable")).not.toBeInTheDocument();
});
