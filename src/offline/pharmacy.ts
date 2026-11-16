import { createPharmacyDraftClient, clearPharmacyDrafts, emptyCounterDraft, type CounterDraft } from "../lib/pharmacyDrafts";
import { createPharmacyCatalogue, draftIntent, estimateDraft } from "../lib/pharmacyCatalogue";
import type { CounterQuote } from "../lib/pharmacyCounter";
import { authScopeKey } from "../lib/authScope";
import { createPharmacyBranchCatalogue } from "../lib/pharmacyBranchCatalogue";
import { startFinalPharmacyCounter } from "./pharmacyFinal";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const text = (tag: string, content: string, className?: string) => { const node = document.createElement(tag); node.textContent = content; if (className) node.className = className; return node; };
const button = (label: string, action: () => void) => { const node = text("button", label) as HTMLButtonElement; node.type = "button"; node.addEventListener("click", action); return node; };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
async function start() {
  // Opening preparation also installs its public assets in development; normal production PWA setup remains available.
  if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  if (await startFinalPharmacyCounter()) return;
  const context = JSON.parse(sessionStorage.getItem("ekavyu-pharmacy-offline-context") || "null") as { scope: string; locationId: string; inventoryMode?: "tracked" | "billing_only"; at: number } | null;
  if (!context || typeof context.scope !== "string" || context.scope === "anonymous" || typeof context.locationId !== "string" || !Number.isSafeInteger(context.at) || context.at > Date.now() + 30_000 || Date.now() - context.at > 12 * 60 * 60 * 1000 || !sessionStorage.getItem("ekavyu-pharmacy-draft-key")) { el("connection").textContent = "Open the online pharmacy counter in this tab first. No signed-in draft is available."; return; }
  const client = createPharmacyDraftClient(context.scope, context.locationId), catalogue = createPharmacyCatalogue(context.scope, context.locationId, context.inventoryMode || "tracked"), branch = createPharmacyBranchCatalogue(context.scope, context.locationId);
  const loaded = await client.load(); await catalogue.load(); await branch.load(); catalogue.attachBranch(branch);
  el("catalogue-status").textContent = branch.status.complete ? `${branch.status.count.toLocaleString()} products from the last complete branch refresh${branch.status.durable ? "" : " · memory only"}. Updated ${new Date(branch.status.checkedAt!).toLocaleString()}. Stock and prices remain unverified.` : "Recent products only. Prepare the branch catalogue at the online counter for wider offline search.";
  const value: CounterDraft = loaded.value || emptyCounterDraft(); let locked = false, sequence = 0;
  let checking = false, verified = false, backoff = 5000, retryTimer: ReturnType<typeof setTimeout> | undefined;
  const lockSession = () => { locked = true; el("workspace").hidden = true; el("cart").replaceChildren(); el("matches").replaceChildren(); el("connection").textContent = "This session changed or expired. Sign in online before opening drafts."; };
  window.addEventListener("auth-logout", lockSession); window.addEventListener("auth-context-change", lockSession);
  window.addEventListener("storage", event => { if (["ekavyu_logout_at", "ekavyu_active_org_id"].includes(event.key || "")) { void clearPharmacyDrafts(); lockSession(); } });
  setTimeout(() => { void clearPharmacyDrafts(); lockSession(); }, Math.max(0, context.at + 12 * 60 * 60 * 1000 - Date.now()));
  el("workspace").hidden = false; el("connection").textContent = "Draft · Cached preparation. Server connection has not been verified.";
  async function save() {
    const version = ++sequence;
    try { const result = await client.save(value); if (version === sequence) { el("saved").textContent = result.durable ? "Draft saved on this device" : "Memory only · device storage unavailable"; if (verified) { clearTimeout(retryTimer); retryTimer = setTimeout(() => { void connection(); }, 1200); } } }
    catch (failure) { locked = true; el("error").textContent = failure instanceof Error ? failure.message : "Draft could not be saved"; for (const control of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>("#workspace input,#workspace button")) control.disabled = true; }
  }
  function totals() {
    const estimate = estimateDraft(catalogue, value.cart.lines, value.cart.discount, context!.locationId);
    el("total").textContent = estimate ? money(estimate.totalPaise) : value.cart.lines.length ? "Price not cached" : money(0);
    for (const row of value.cart.lines) { const node = document.getElementById(`price-${row.lineId}`), line = estimate?.lines.find(l => l.lineId === row.lineId); if (node) node.textContent = line ? `${money(line.grossPaise)} est.` : "Price not cached"; }
  }
  function quantity(row: CounterDraft["cart"]["lines"][number]) { try { return String(BigInt(row.packs || "0") * BigInt(row.product.unitDefinition!.unitsPerPack) + BigInt(row.loose || "0")); } catch { return ""; } }
  function render() {
    el<HTMLInputElement>("discount").value = value.cart.discount;
    el("customer").textContent = value.cart.customerId ? "Recorded customer · saved selection" : "Walk-in customer";
    el("cart").replaceChildren();
    if (!value.cart.lines.length) el("cart").append(text("p", "Your cart is empty. Search cached products to begin.", "muted"));
    for (const row of value.cart.lines) {
      const item = text("article", "", "row"), details = text("div", ""); details.append(text("p", row.product.name, "item-title"), text("p", `1 ${row.product.unitDefinition!.packUnit} = ${row.product.unitDefinition!.unitsPerPack} ${row.product.unitDefinition!.baseUnit}`, "small"));
      const controls = text("div", "", "quantity"), input = document.createElement("input"); input.type = "number"; input.min = "1"; input.step = "1"; input.value = quantity(row); input.id = `quantity-${row.lineId}`; const label = text("label", `Quantity (${row.product.unitDefinition!.baseUnit})`) as HTMLLabelElement; label.htmlFor = input.id; const field = text("div", ""); field.append(label, input);
      const change = (n: string) => { if (locked) return; row.packs = "0"; row.loose = n; input.value = n; totals(); void save(); };
      input.addEventListener("input", () => change(input.value)); input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); el<HTMLInputElement>("search").focus(); } });
      const minus = button("−", () => change(String(Math.max(1, Number(input.value) - 1)))), plus = button("+", () => change(String(Number(input.value) + 1))); minus.setAttribute("aria-label", `Decrease quantity ${row.product.name}`); plus.setAttribute("aria-label", `Increase quantity ${row.product.name}`);
      controls.append(minus, field, plus, button(`+1 ${row.product.unitDefinition!.packUnit}`, () => change(String(Number(input.value) + row.product.unitDefinition!.unitsPerPack)))); details.append(controls);
      const total = text("p", "", "item-total"); total.id = `price-${row.lineId}`;
      item.append(details, total, button("Remove", () => { if (locked) return; value.cart.lines = value.cart.lines.filter(l => l !== row); render(); void save(); })); el("cart").append(item);
    }
    el("held").replaceChildren(); value.held.forEach((cart, index) => { const resume = button(`Resume held cart ${index + 1} (${cart.lines.length} products)`, () => { if (locked || value.cart.lines.length) return; value.cart = value.held.splice(index, 1)[0]; render(); void save(); }); resume.disabled = Boolean(value.cart.lines.length); el("held").append(resume); });
    el<HTMLButtonElement>("hold").disabled = value.held.length >= 3 || !value.cart.lines.length; totals();
  }
  function add(product: ReturnType<typeof catalogue.find>["items"][number]) {
    if (locked || !product.eligible || !product.unitDefinition) return;
    catalogue.recordUse(product.id);
    const existing = value.cart.lines.find(row => row.product.id === product.id);
    if (!existing && value.cart.lines.length >= 100) { el("error").textContent = "A bill supports at most 100 products."; return; }
    if (existing) { existing.loose = String(Number(existing.loose || 0) + 1); } else value.cart.lines.push({ lineId: crypto.randomUUID(), product, packs: "0", loose: "1", discount: "0" });
    el<HTMLInputElement>("search").value = ""; el("matches").replaceChildren(); render(); void save(); el<HTMLInputElement>("search").focus();
  }
  function search(submit = false) {
    const query = el<HTMLInputElement>("search").value.trim(), exact = /^\d+$/.test(query) || catalogue.find(query, true).items.length > 0, found = catalogue.find(query, exact).items;
    el("matches").replaceChildren();
    if (submit && found.length === 1 && found[0].eligible && found[0].unitDefinition) { add(found[0]); return; }
    if (!found.length) { el("matches").append(text("p", "No cached match. Look up new products when online.", "muted")); return; }
    for (const product of found) { const row = text("article", "", "row"), details = text("div", ""); details.append(text("p", product.name, "item-title"), text("p", context?.inventoryMode === "billing_only" ? "Stock not tracked · availability unverified" : `${product.stockQuantity} ${product.unitDefinition?.baseUnit || "units"} in cached physical stock · availability unverified`, "small")); const action = button(product.eligible && product.unitDefinition ? "Add to cart" : "Online review required", () => add(product)); action.disabled = !product.eligible || !product.unitDefinition; row.append(details, action); el("matches").append(row); }
  }
  el("search-form").addEventListener("submit", event => { event.preventDefault(); search(true); }); el("search").addEventListener("input", () => search());
  el("discount").addEventListener("input", () => { if (locked) return; value.cart.discount = el<HTMLInputElement>("discount").value; totals(); void save(); });
  el("hold").addEventListener("click", () => { if (locked || !value.cart.lines.length || value.held.length >= 3) return; value.held.push(value.cart); value.cart = emptyCounterDraft().cart; render(); void save(); });
  el("clear").addEventListener("click", () => { if (locked || !confirm("Clear the current draft? Held carts stay saved.")) return; value.cart = emptyCounterDraft().cart; render(); void save(); });
  async function connection() {
    if (locked || checking || document.visibilityState === "hidden") return;
    checking = true; clearTimeout(retryTimer); const version = sequence;
    el<HTMLButtonElement>("reconnect").disabled = true;
    try { const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(6000) });
      if ([401, 403].includes(response.status)) { await clearPharmacyDrafts(); locked = true; location.replace("/login"); return; }
      if (!response.ok) throw Error("Server unavailable"); const body = await response.json(), user = body?.data?.user;
      if (!user || authScopeKey(user) !== context!.scope) { await clearPharmacyDrafts(); locked = true; location.replace("/dashboard/pharmacy"); return; }
      verified = true; backoff = 5000;
      const input = draftIntent(value.cart.lines, value.cart.discount, context!.locationId, value.cart.customerId || undefined);
      if (value.cart.lines.length && !input) { el("connection").textContent = "Conflict · Enter valid quantities and discounts before validating this draft."; return; }
      if (input) {
        // This is a read-only quote. Offline preparation never issues a bill, reserves stock or records money.
        const result = await fetch("/api/pharmacy/sales/quote", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(6000) });
        if ([401, 403].includes(result.status)) { await clearPharmacyDrafts(); lockSession(); return; }
        if (result.status === 409) { el("connection").textContent = "Conflict · Stock, batch, price, customer or pharmacy setup changed. Review this draft at the online counter."; return; }
        if (!result.ok) throw Error("Server unavailable");
        const data = await result.json(), quote = data?.data as CounterQuote;
        if (version !== sequence || locked) { retryTimer = setTimeout(() => { void connection(); }, 1200); return; }
        if (quote?.locationId !== context!.locationId || !Array.isArray(quote.lines) || !Array.isArray(quote.calculation?.lines)) { el("connection").textContent = "Failed · Draft prices could not be confirmed. Review them online."; return; }
        catalogue.rememberQuote(quote); totals();
      }
      el("connection").textContent = "Connection verified · Synced draft checks. Return to the counter to issue the bill. Nothing has been billed or collected offline.";
    } catch { verified = false; el("connection").textContent = "Pending Sync · Server unavailable. Your draft remains on this device."; retryTimer = setTimeout(() => { void connection(); }, backoff); backoff = Math.min(backoff * 2, 60000); }
    finally { checking = false; el<HTMLButtonElement>("reconnect").disabled = false; }
  }
  el("reconnect").addEventListener("click", () => { void connection(); }); window.addEventListener("online", () => { void connection(); });
  window.addEventListener("focus", () => { if (!verified) void connection(); }); document.addEventListener("visibilitychange", () => { if (!verified) void connection(); });
  render(); el<HTMLInputElement>("search").focus(); void connection();
}
void start().catch(failure => { el("error").textContent = failure instanceof Error ? failure.message : "Draft unavailable. Reconnect and sign in to review it."; });
