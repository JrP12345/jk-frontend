import { beforeEach, expect, it } from "vitest";
import { authScopeKey } from "@/lib/authScope";
import { clearPharmacyDrafts, createPharmacyDraftClient, emptyCounterDraft } from "@/lib/pharmacyDrafts";
import { useAuthStore, type User } from "@/store/authStore";

const user: User = { id: "owner", organization_id: "org", role: "cashier", name: "Cashier", email: "cashier@example.test", permissions: ["PHARMACY_SELL"], workspaceProfile: "pharmacy" };
beforeEach(async () => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoggingOut: false, authError: null }); sessionStorage.clear(); await clearPharmacyDrafts(); });
it("restores only after the same server identity is verified and revokes drafts when permissions change", async () => {
  const scope = authScopeKey(user), client = createPharmacyDraftClient(scope, "branch"), value = emptyCounterDraft(); value.cart.discount = "2";
  await client.load(); await client.save(value);
  useAuthStore.getState().login(user);
  expect((await createPharmacyDraftClient(scope, "branch").load()).value?.cart.discount).toBe("2");
  useAuthStore.getState().login({ ...user, permissions: ["PHARMACY_VIEW_STOCK"] });
  await expect(client.save(value)).rejects.toThrow(/workspace changed/);
  expect((await createPharmacyDraftClient(authScopeKey(useAuthStore.getState().user), "branch").load()).value).toBeNull();
});
it("removes drafts and the encryption key immediately when authentication is suspended", async () => {
  useAuthStore.getState().login(user);
  const client = createPharmacyDraftClient(authScopeKey(user), "branch"); await client.load(); await client.save(emptyCounterDraft());
  useAuthStore.setState({ user: null, isAuthenticated: false });
  await expect(client.load()).rejects.toThrow(/workspace changed/);
  expect(sessionStorage.getItem("ekavyu-pharmacy-draft-key")).toBeNull();
});
it("retains encrypted preparation across a verification outage without restoring online authority", async () => {
  useAuthStore.getState().login(user); const client = createPharmacyDraftClient(authScopeKey(user), "branch"); await client.load(); const value = emptyCounterDraft(); value.cart.discount = "5"; await client.save(value);
  useAuthStore.setState({ user: null, isAuthenticated: false, authError: "Server unavailable" });
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect((await client.load()).value?.cart.discount).toBe("5");
  useAuthStore.getState().login(user);
  expect((await createPharmacyDraftClient(authScopeKey(user), "branch").load()).value?.cart.discount).toBe("5");
  window.dispatchEvent(new Event("auth-logout"));
  expect(sessionStorage.getItem("ekavyu-pharmacy-draft-key")).toBeNull();
});
