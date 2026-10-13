import { beforeEach, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
vi.mock("@/lib/api", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, isLoggingOut: false }); });
it("rejects a successful switch followed by a mismatched workspace rather than accepting a stale refresh", async () => {
  useAuthStore.getState().login({ id: "staff", name: "Staff", email: "staff@test", role: "doctor", organization_id: "a" });
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.get).mockResolvedValue({ data: { data: { user: { id: "staff", role: "doctor", organization_id: "a" } } } });
  await expect(useAuthStore.getState().switchOrg("b")).rejects.toThrow("workspace changed");
  expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false });
});
