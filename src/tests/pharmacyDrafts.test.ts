import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanCounterDraft, clearPharmacyDrafts, createPharmacyDraftClient, emptyCounterDraft, type CounterDraft } from "@/lib/pharmacyDrafts";

const draft = (): CounterDraft => ({ cart: { lines: [{ lineId: "line", product: { id: "product", name: "Cotton", genericName: "Cotton", stockQuantity: 100, eligible: true, unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } }, packs: "1", loose: "2", discount: "1.50" }], customerId: "customer", discount: "2" }, held: [] });
beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("only retains draft fields and strips prices, personal details and payment inputs", () => {
  const value = draft();
  Object.assign(value.cart, { customer: { name: "Private customer", address: "Private address" }, quote: { total: 100 }, receipt: "private", card: "private" });
  Object.assign(value.cart.lines[0].product, { price: 15, batches: ["private"], costPrice: 8 });
  const saved = cleanCounterDraft(value), text = JSON.stringify(saved);
  expect(saved.cart.lines[0].product).toMatchObject({ stockQuantity: 0, eligible: true });
  expect(saved.cart.customerId).toBe("customer");
  expect(text).not.toMatch(/Private|private|price|quote|receipt|card|batches|costPrice/);
});
it("rejects corrupt, duplicate and oversized cart structures but keeps unfinished quantity edits", () => {
  const value = draft(); value.cart.lines[0].loose = "";
  expect(cleanCounterDraft(value).cart.lines[0].loose).toBe("");
  value.cart.lines.push(value.cart.lines[0]); expect(() => cleanCounterDraft(value)).toThrow(/duplicate/);
  expect(() => cleanCounterDraft({ ...draft(), held: Array(4).fill(draft().cart) })).toThrow(/review/);
  const invalid = draft(); invalid.cart.lines[0].product.unitDefinition!.unitsPerPack = 0;
  expect(() => cleanCounterDraft(invalid)).toThrow(/units/);
});
it("accepts valid long catalogue display names without imposing a new billing restriction", () => {
  const value = draft(); value.cart.lines[0].product.name = "Catalogue product ".repeat(30); value.cart.lines[0].product.genericName = "Ingredient ".repeat(40);
  expect(cleanCounterDraft(value).cart.lines[0].product.name).toBe(value.cart.lines[0].product.name);
});
it("preserves carts and held carts on navigation when IndexedDB is unavailable", async () => {
  const first = createPharmacyDraftClient("owner", "branch"); await first.load();
  const value = draft(); value.held = [draft().cart];
  expect(await first.save(value)).toEqual({ durable: false });
  const second = createPharmacyDraftClient("owner", "branch");
  expect((await second.load()).value).toEqual(cleanCounterDraft(value));
  await second.save(emptyCounterDraft()); expect((await createPharmacyDraftClient("owner", "branch").load()).value?.cart.lines).toEqual([]);
});
it("preserves medicine strength in active and held drafts after reload", async () => {
  const client = createPharmacyDraftClient("owner", "branch"); await client.load();
  const value = draft(); value.cart.lines[0].product.strength = "25 g";
  value.held = [draft().cart]; value.held[0].lines[0].product.strength = "50 g";
  await client.save(value);
  const restored = (await createPharmacyDraftClient("owner", "branch").load()).value!;
  expect(restored.cart.lines[0].product.strength).toBe("25 g");
  expect(restored.held[0].lines[0].product.strength).toBe("50 g");
});
it("preserves draft bill labels across reload and rejects malformed labels", () => {
  const value = draft(); value.cart.billNumber = 4; value.held = [{ ...draft().cart, billNumber: 1 }];
  expect(cleanCounterDraft(value)).toMatchObject({ cart: { billNumber: 4 }, held: [{ billNumber: 1 }] });
  value.cart.billNumber = 1.5;
  expect(() => cleanCounterDraft(value)).toThrow(/bill label/);
});
it("isolates organization, identity and location drafts", async () => {
  const first = createPharmacyDraftClient("owner", "branch"); await first.load(); await first.save(draft());
  expect((await createPharmacyDraftClient("other owner", "branch").load()).value).toBeNull();
  expect((await createPharmacyDraftClient("owner", "other branch").load()).value).toBeNull();
});
it("rejects stale writers instead of overwriting a newer cart", async () => {
  const a = createPharmacyDraftClient("owner", "branch"), b = createPharmacyDraftClient("owner", "branch");
  await a.load(); await b.load(); await a.save(draft());
  await expect(b.save(emptyCounterDraft())).rejects.toThrow(/another tab/);
  expect((await createPharmacyDraftClient("owner", "branch").load()).value?.cart.lines).toHaveLength(1);
});
it("expires abandoned drafts after twelve hours", async () => {
  vi.useFakeTimers(); const first = createPharmacyDraftClient("owner", "branch"); await first.load(); await first.save(draft());
  vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
  expect((await createPharmacyDraftClient("owner", "branch").load()).value).toBeNull();
});
it("keeps the draft when a page reload verifies the same server identity, but clears changed authority", async () => {
  const first = createPharmacyDraftClient("owner", "branch"); await first.load(); await first.save(draft());
  window.dispatchEvent(new CustomEvent("auth-context-change", { detail: { previousScope: "anonymous", scope: "owner" } }));
  expect((await createPharmacyDraftClient("owner", "branch").load()).value?.cart.lines).toHaveLength(1);
  window.dispatchEvent(new CustomEvent("auth-context-change", { detail: { previousScope: "owner", scope: "different permissions" } }));
  await expect(first.save(draft())).rejects.toThrow(/workspace changed/);
  expect((await createPharmacyDraftClient("different permissions", "branch").load()).value).toBeNull();
});
it.each(["auth-context-change", "auth-logout"])("clears drafts and rejects queued writes on %s", async event => {
  const first = createPharmacyDraftClient("owner", "branch"); await first.load(); await first.save(draft());
  const stale = first.save(draft()); window.dispatchEvent(new Event(event));
  await expect(stale).rejects.toThrow(/workspace changed/);
  expect((await createPharmacyDraftClient("owner", "branch").load()).value).toBeNull();
});
