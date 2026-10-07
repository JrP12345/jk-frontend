import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

beforeEach(() => {
  document.cookie = "ekavyu_session=; path=/; max-age=0";
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, isLoggingOut: false });
});
afterEach(() => { vi.restoreAllMocks(); document.cookie = "ekavyu_session=; path=/; max-age=0"; });
it("opens anonymous public entry immediately without waiting for session or refresh calls", async () => {
  const get = vi.spyOn(api, "get");
  const post = vi.spyOn(api, "post");
  await useAuthStore.getState().checkAuth({ allowAnonymous: true });
  expect(useAuthStore.getState()).toMatchObject({ isLoading: false, isAuthenticated: false });
  expect(get).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});
it("verifies signed-in public entry and always verifies private entry", async () => {
  const user = { id: "patient", role: "patient", name: "Asha", email: "asha@example.test" };
  const get = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { user } } });
  document.cookie = "ekavyu_session=1; path=/";
  await useAuthStore.getState().checkAuth({ allowAnonymous: true });
  expect(get).toHaveBeenCalledWith("/auth/me");
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  document.cookie = "ekavyu_session=; path=/; max-age=0";
  useAuthStore.setState({ user: null, isAuthenticated: false });
  await useAuthStore.getState().checkAuth();
  expect(get).toHaveBeenCalledTimes(2);
});
