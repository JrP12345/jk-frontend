import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Teleconsultation from "@/app/(dashboard)/dashboard/teleconsultation/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: { id: "doctor", role: "doctor" } }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic" }) }));
afterEach(() => { cleanup(); fixture.get.mockReset(); });
it("distinguishes failure from no appointments and retries the selected clinic", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: [] } });
  render(<ToastProvider><Teleconsultation /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/No virtual appointments currently/)).toBeInTheDocument();
  expect(fixture.get).toHaveBeenCalledTimes(2);
  expect(fixture.get).toHaveBeenLastCalledWith("/appointments?locationId=clinic");
  expect(screen.getByRole("button", { name: /All Telehealth Visits/ })).toHaveAttribute("aria-pressed", "true");
});
