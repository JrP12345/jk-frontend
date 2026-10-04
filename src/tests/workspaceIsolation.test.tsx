import { act, render } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore, type User } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { useModuleStore, type ModuleInfo } from "@/store/moduleStore";
import { hasAnyPermission } from "@/lib/permissions";
import { hasRoutePermission } from "@/lib/routePermissions";
import { Providers } from "@/components/providers";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/NotificationRealtime", () => ({ NotificationRealtime: () => null }));
vi.mock("@/components/ui", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  RouteProgress: () => null, PWAInstallBanner: () => null,
}));

const user = (organization_id = "org-a", permissions = ["VIEW_APPOINTMENTS"]): User => ({ id: "staff", name: "Staff", email: "staff@test", role: "admin", organization_id, permissions });
const response = (data: unknown) => ({ data: { data } });
const moduleInfo: ModuleInfo = { moduleKey: "laboratory", enabled: false, priority: "P2", label: "Lab", route: null, description: null, section: null, alwaysOn: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isLoading: false, isAuthenticated: false, isLoggingOut: false });
  useClinicStore.getState().reset();
  useModuleStore.getState().reset();
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("Effective grants and workspace isolation", () => {
  it("uses explicit admin grants, preserves platform root authority and family self-service", () => {
    expect(hasAnyPermission(user("org-a", []), "MANAGE_BILLING")).toBe(false);
    expect(hasRoutePermission("/dashboard/billing", "admin", [])).toBe(false);
    expect(hasRoutePermission("/dashboard/billing", "admin", ["VIEW_BILLING"])).toBe(true);
    expect(hasAnyPermission({ role: "root", permissions: [] }, "MANAGE_BILLING")).toBe(true);
    expect(hasRoutePermission("/dashboard/appointments", "family_member", [])).toBe(true);
    expect(hasRoutePermission("/dashboard/staff", "family_member", ["MANAGE_STAFF"])).toBe(false);
  });

  it("coalesces clinic requests and makes every caller wait for the same data", async () => {
    const read = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get).mockReturnValueOnce(read.promise);
    const first = useClinicStore.getState().fetchClinics();
    const second = useClinicStore.getState().fetchClinics(true);
    expect(first).toBe(second);
    expect(api.get).toHaveBeenCalledOnce();
    read.resolve(response([{ _id: "clinic-a", name: "A" }, { name: "Invalid" }]));
    expect(await second).toEqual([expect.objectContaining({ id: "clinic-a" })]);
    expect(await first).toHaveLength(1);
  });

  it("discards clinic and module responses from the previous organization, even if abort is ignored", async () => {
    useAuthStore.getState().login(user());
    const clinics = deferred<ReturnType<typeof response>>(), modules = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get).mockReturnValueOnce(clinics.promise).mockReturnValueOnce(modules.promise);
    const oldClinics = useClinicStore.getState().fetchClinics();
    const oldModules = useModuleStore.getState().fetchModules();
    const signal = vi.mocked(api.get).mock.calls[0][1]?.signal;
    useAuthStore.getState().login(user("org-b"));
    expect(signal?.aborted).toBe(true);
    vi.mocked(api.get).mockResolvedValueOnce(response([{ id: "clinic-b", name: "B" }]));
    await useClinicStore.getState().fetchClinics();
    clinics.resolve(response([{ id: "clinic-a", name: "A" }])); modules.resolve(response([moduleInfo]));
    expect(await oldClinics).toEqual([]);
    await oldModules;
    expect(useClinicStore.getState().clinics[0].id).toBe("clinic-b");
    expect(useModuleStore.getState().modules).toEqual([]);
  });

  it("coalesces module reads and retries failed initial reads", async () => {
    const read = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get).mockReturnValueOnce(read.promise);
    const first = useModuleStore.getState().fetchModules(), second = useModuleStore.getState().fetchModules();
    expect(first).toBe(second);
    read.reject(new Error("offline")); await first;
    expect(useModuleStore.getState().isLoaded).toBe(false);
    vi.mocked(api.get).mockResolvedValueOnce(response([moduleInfo]));
    await useModuleStore.getState().fetchModules();
    expect(useModuleStore.getState().isLoaded).toBe(true);
    vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
    await useClinicStore.getState().fetchClinics();
    expect(useClinicStore.getState().isLoaded).toBe(false);
    vi.mocked(api.get).mockResolvedValueOnce(response([{ id: "retry", name: "Retry" }]));
    expect(await useClinicStore.getState().fetchClinics()).toHaveLength(1);
  });

  it.each(["single", "bulk"])("does not apply a late %s module mutation to the new workspace", async (mode) => {
    useAuthStore.getState().login(user());
    useModuleStore.setState({ modules: [moduleInfo], isLoaded: true });
    const write = deferred<ReturnType<typeof response>>();
    vi.mocked(api.put).mockReturnValueOnce(write.promise);
    const action = mode === "single" ? useModuleStore.getState().toggleModule("laboratory", true) : useModuleStore.getState().bulkToggleModules([{ moduleKey: "laboratory", enabled: true }]);
    useAuthStore.getState().login(user("org-b"));
    useModuleStore.setState({ modules: [moduleInfo], isLoaded: true });
    write.resolve(response({})); await action;
    expect(useModuleStore.getState().modules[0].enabled).toBe(false);
  });

  it("does not let an old auth read overwrite a new session", async () => {
    const read = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get).mockReturnValueOnce(read.promise);
    const check = useAuthStore.getState().checkAuth();
    useAuthStore.getState().login(user("org-b"));
    read.resolve(response({ user: user("org-a") })); await check;
    expect(useAuthStore.getState().user?.organization_id).toBe("org-b");
  });

  it("does not let delayed logout cleanup erase a new login or its private storage", async () => {
    useAuthStore.getState().login(user());
    const write = deferred<ReturnType<typeof response>>();
    vi.mocked(api.post).mockReturnValueOnce(write.promise);
    const logout = useAuthStore.getState().logout();
    useAuthStore.getState().login(user("org-b")); sessionStorage.setItem("new-session", "keep");
    write.resolve(response({})); await logout;
    expect(useAuthStore.getState().user?.organization_id).toBe("org-b");
    expect(sessionStorage.getItem("new-session")).toBe("keep");
  });

  it("suspends the old workspace during a switch and commits only the verified server scope", async () => {
    useAuthStore.getState().login(user());
    useClinicStore.setState({ clinics: [{ id: "clinic-a", name: "A", city: "" }], isLoaded: true });
    const write = deferred<ReturnType<typeof response>>();
    vi.mocked(api.post).mockReturnValueOnce(write.promise);
    vi.mocked(api.get).mockResolvedValueOnce(response({ user: user("org-b") }));
    const change = useAuthStore.getState().switchOrg("org-b");
    expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: true });
    expect(useClinicStore.getState().clinics).toEqual([]);
    await expect(useAuthStore.getState().impersonate({ userId: "other" })).rejects.toThrow("already in progress");
    write.resolve(response({})); await change;
    expect(useAuthStore.getState()).toMatchObject({ user: { organization_id: "org-b" }, isLoading: false });
    expect(localStorage.getItem("ananta_active_org_id")).toBe("org-b");
  });

  it("clears the old identity when a workspace switch cannot be verified", async () => {
    useAuthStore.getState().login(user());
    vi.mocked(api.post).mockResolvedValueOnce(response({}));
    vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
    await expect(useAuthStore.getState().switchOrg("org-b")).rejects.toThrow("offline");
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false });
  });

  it("refreshes authority on entering and leaving impersonation, including the server resync fallback", async () => {
    useAuthStore.getState().login({ ...user(), role: "root", organization_id: undefined });
    const target = { ...user("org-b"), impersonatedBy: { id: "root", email: "root@test", name: "Root", originalRole: "root" } };
    vi.mocked(api.post).mockResolvedValueOnce(response({ user: target }));
    await useAuthStore.getState().impersonate({ userId: "staff", organizationId: "org-b" });
    expect(useAuthStore.getState().user?.impersonatedBy?.id).toBe("root");
    useModuleStore.setState({ modules: [moduleInfo], isLoaded: true });
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 400 } });
    vi.mocked(api.get).mockResolvedValueOnce(response({ user: { ...user(), role: "root", organization_id: undefined } }));
    await useAuthStore.getState().stopImpersonation();
    expect(useAuthStore.getState().user).toMatchObject({ role: "root", impersonatedBy: null });
    expect(useModuleStore.getState().modules).toEqual([]);
    expect(localStorage.getItem("ananta_active_org_id")).toBeNull();
  });

  it("clears the real query cache on scope/grant changes while keeping harmless profile refreshes", async () => {
    useAuthStore.getState().login(user());
    vi.mocked(api.get).mockResolvedValue(response({ user: user() }));
    let client!: QueryClient;
    function Probe() { client = useQueryClient(); return null; }
    render(<Providers><Probe /></Providers>);
    await act(async () => { await Promise.resolve(); });
    client.setQueryData(["private"], "org-a-data");
    act(() => useAuthStore.getState().login({ ...user(), name: "Renamed" }));
    expect(client.getQueryData(["private"])).toBe("org-a-data");
    act(() => useAuthStore.getState().login(user("org-a", [])));
    expect(client.getQueryData(["private"])).toBeUndefined();
    client.setQueryData(["private"], "revoked-scope-data");
    act(() => useAuthStore.getState().login(user("org-b")));
    expect(client.getQueryData(["private"])).toBeUndefined();
  });
});
