import { createPharmacyOfflineLedger, type OfflineCounterDraft, type OfflineCartIntent, type OfflineLedgerSale, type StoredOfflineReceipt } from "../lib/pharmacyOfflineLedger";
import { browserDevice } from "../lib/pharmacyOfflineIdentity";
import { listOfflineSessions, type OfflineSessionControl } from "../lib/pharmacyOfflineSession";
import { printOfflinePharmacyReceipt } from "../lib/pharmacyOfflinePrint";
import type { OfflinePreparedData } from "../lib/pharmacyOfflinePreparation";

const text = (tag: string, value: string, className?: string) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
const button = (label: string, action: () => void) => { const node = text("button", label) as HTMLButtonElement; node.type = "button"; node.addEventListener("click", action); return node; };
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
const blank = (held: OfflineCounterDraft["held"] = []): OfflineCounterDraft => ({ version: 1, cart: [], invoiceDiscount: "0", tender: "", held });
const paise = (value: string) => { if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Enter valid rupee amounts with at most two decimals."); const [whole, fraction = ""] = value.split("."), result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); if (result > BigInt(100000000000)) throw new Error("Amount exceeds the supported bound."); return Number(result); };

/** A public, credential-free restart shell. It unlocks only an already activated
 * protected ledger. Enrollment/activation and authenticated synchronization stay
 * in the signed-in app; no authenticated HTML or API response is cached here.
 */
export async function startFinalPharmacyCounter(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const sessions = (await listOfflineSessions()).filter(row => ["active", "stopped"].includes(row.phase));
  if (!sessions.length) return false;
  const main = document.querySelector("main")!; main.replaceChildren();
  main.classList.add("final-counter");
  document.title = "Ekavyu · Prepared pharmacy counter";
  main.append(text("h1", "Prepared cash counter"), text("p", "Unlock the original PC's prepared medicines. Bills save on this device; sign in online to synchronize them.", "muted"));
  const chooser = document.createElement("select"); chooser.setAttribute("aria-label", "Prepared branch");
  for (const row of sessions) { const option = document.createElement("option"); option.value = row.authorityId; option.textContent = `Prepared branch · ${row.locationId.slice(-6)}`; chooser.append(option); }
  const phrase = document.createElement("input"); phrase.type = "password"; phrase.maxLength = 128; phrase.autocomplete = "off"; phrase.setAttribute("aria-label", "Offline passphrase"); phrase.placeholder = "Offline passphrase";
  const error = text("p", ""); error.setAttribute("role", "alert"); const status = text("p", "", "muted"); status.setAttribute("role", "status");
  const unlockCard = text("section", "", "card"), work = text("section", ""); work.hidden = true;
  unlockCard.append(chooser, phrase, button("Unlock counter", () => { void unlock(); })); main.append(unlockCard, status, error, work);
  let ledger: Awaited<ReturnType<typeof createPharmacyOfflineLedger>> | null = null, activeControl: OfflineSessionControl | null = null, privateKey: CryptoKey | null = null;
  let prepared: OfflinePreparedData | null = null, draft = blank(), quote: OfflineLedgerSale | null = null, frozen: OfflineLedgerSale | null = null;
  let busy = false, stopped = false, persistent = false, revision = 0, draftWrite = Promise.resolve(), idle: ReturnType<typeof setTimeout>, quoteTimer: ReturnType<typeof setTimeout>;
  const search = document.createElement("input"), discount = document.createElement("input"), tender = document.createElement("input"), results = text("div", ""), cart = text("div", ""), held = text("div", ""), totals = text("div", "", "total"), recent = text("div", "");
  search.setAttribute("aria-label", "Search prepared medicines"); search.placeholder = "Scan barcode or search medicine"; search.maxLength = 100;
  discount.setAttribute("aria-label", "Invoice discount (INR)"); discount.inputMode = "decimal"; tender.setAttribute("aria-label", "Cash received (INR)"); tender.inputMode = "decimal";
  const save = button("Save", () => { void checkout(false); }), print = button("Save & print", () => { void checkout(true); });
  const payTab = button("Pay", () => { layout.dataset.mobilePanel = "pay"; });
  const emptyCart = text("p", "Scan or choose a medicine to start the next bill.", "muted");
  function fail(failure: unknown) { error.textContent = failure instanceof Error ? failure.message : "Recover the original local bill before continuing."; }
  function lock() { revision++; ledger?.close(); ledger = null; privateKey = null; prepared = null; quote = null; frozen = null; draft = blank(); work.hidden = true; work.querySelectorAll("input").forEach(node => { node.value = ""; }); cart.replaceChildren(); results.replaceChildren(); recent.replaceChildren(); held.replaceChildren(); totals.replaceChildren(); payTab.textContent = "Pay"; document.getElementById("pharmacy-final-paper")?.remove(); phrase.value = ""; unlockCard.hidden = false; status.textContent = "Counter locked. Original bills remain on this PC."; clearTimeout(idle); }
  function touch() { clearTimeout(idle); if (ledger) idle = setTimeout(lock, 15 * 60_000); }
  window.addEventListener("keydown", touch); window.addEventListener("pointerdown", touch); window.addEventListener("pagehide", lock);
  const persist = (value = draft) => { const store = ledger; if (!store) return Promise.reject(new Error("Unlock this counter first.")); const captured = structuredClone(value); draftWrite = draftWrite.catch(() => {}).then(() => store.saveDraft(captured)); return draftWrite; };
  function intent(commandId = crypto.randomUUID()): OfflineCartIntent {
    if (!activeControl || !draft.cart.length) throw new Error("Add products before saving.");
    return { commandId, actorId: activeControl.actorId, invoiceDiscountPaise: paise(draft.invoiceDiscount), roundOffPaise: 0, cashTenderedPaise: paise(draft.tender || String(quote?.invoice.totalAmount || 0)),
      lines: draft.cart.map(row => { const quantity = Number(row.quantity); if (!/^\d+$/.test(row.quantity) || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Use whole positive quantities."); return { lineId: row.lineId, medicineId: row.medicineId, quantity, discountPaise: paise(row.discount) }; }) };
  }
  function payment() {
    storageHelp.hidden = storageButton.hidden = persistent;
    search.disabled = discount.disabled = tender.disabled = busy || stopped || Boolean(frozen);
    const amount = quote?.invoice.totalAmount; if (!draft.tender) tender.value = amount === undefined ? "" : String(amount);
    payTab.textContent = amount === undefined ? "Pay" : `Pay ${money(amount)}`;
    let received = -1; try { received = paise(tender.value || "0"); } catch {}
    totals.replaceChildren(text("strong", `Total ${amount === undefined ? "—" : money(amount)}`), text("span", `Change ${amount === undefined ? "—" : money(Math.max(0, received / 100 - amount))}`));
    save.disabled = print.disabled = busy || stopped || !persistent || Boolean(frozen) || amount === undefined || received < Math.round(amount * 100);
  }
  function changed() {
    if (frozen) { quote = frozen; payment(); return; }
    revision++; quote = null; payment(); clearTimeout(quoteTimer); const version = revision, store = ledger;
    if (!store) return;
    void persist().catch(fail);
    if (!store || !draft.cart.length || stopped || frozen) return;
    quoteTimer = setTimeout(() => { try { void store.prepareSale(intent()).then(value => { if (version === revision && ledger === store) { quote = value; error.textContent = ""; renderCart(); payment(); } }).catch(fail); } catch (failure) { fail(failure); } }, 100);
  }
  function renderCart() {
    cart.replaceChildren();
    emptyCart.hidden = draft.cart.length > 0;
    for (const [index, row] of draft.cart.entries()) {
      const product = prepared?.products.find(product => product.id === row.medicineId), block = text("article", "", "row"), body = text("div", ""); body.append(text("strong", product?.name || "Original product"));
      const quantity = document.createElement("input"); quantity.value = row.quantity; quantity.inputMode = "numeric"; quantity.type = "number"; quantity.min = "1"; quantity.setAttribute("aria-label", `Quantity ${product?.name || index + 1}`); quantity.disabled = busy || stopped || Boolean(frozen);
      quantity.addEventListener("input", () => { row.quantity = quantity.value; changed(); });
      const controls = text("div", "", "quantity"); controls.append(button("−", () => { if (busy || stopped || frozen) return; row.quantity = String(Math.max(1, Number(row.quantity || 0) - 1)); renderCart(); changed(); }), quantity,
        button("+", () => { if (busy || stopped || frozen) return; row.quantity = String(Number(row.quantity || 0) + 1); renderCart(); changed(); }));
      if (product) controls.append(button(`+1 ${product.unitDefinition.packUnit} (${product.unitDefinition.unitsPerPack})`, () => { if (busy || stopped || frozen) return; row.quantity = String(Number(row.quantity || 0) + product.unitDefinition.unitsPerPack); renderCart(); changed(); }));
      body.append(controls); const amount = quote?.invoice.items[index]; block.append(body, text("strong", amount ? money(amount.grossAmountPaise / 100) : "—"), button("Remove", () => { if (busy || stopped || frozen) return; draft.cart = draft.cart.filter(line => line !== row); renderCart(); changed(); })); cart.append(block);
    }
    held.replaceChildren(); (draft.held || []).forEach((value, index) => held.append(button(`Held ${index + 1} · ${value.cart.length} products`, () => { if (busy || stopped || frozen) return; const previous = { cart: draft.cart, invoiceDiscount: draft.invoiceDiscount, tender: draft.tender }, choices = [...draft.held!]; if (previous.cart.length) choices[index] = previous; else choices.splice(index, 1); draft = { version: 1, ...value, held: choices }; discount.value = draft.invoiceDiscount; tender.value = draft.tender; renderCart(); changed(); })));
  }
  function add(productId: string) {
    if (busy || stopped || frozen || !prepared) return;
    if (draft.cart.length >= 100 && !draft.cart.some(row => row.medicineId === productId)) { fail(new Error("A bill supports up to 100 products.")); return; }
    const existing = draft.cart.find(row => row.medicineId === productId); if (existing) existing.quantity = String(Number(existing.quantity || 0) + 1); else draft.cart.push({ lineId: crypto.randomUUID(), medicineId: productId, quantity: "1", discount: "0" });
    search.value = ""; renderCart(); changed(); search.focus();
  }
  function lookup() {
    results.replaceChildren(); const query = search.value.normalize("NFKC").toLowerCase().trim(), exact = /^\d{8,}$/.test(query);
    for (const product of (prepared?.products || []).filter(product => exact ? product.barcodes.includes(query) : query.split(/\s+/).every(term => `${product.name} ${product.genericName}`.toLowerCase().includes(term))).slice(0, 25)) results.append(button(`+ ${product.name}`, () => add(product.id)));
  }
  async function history() { if (!ledger) return; const store = ledger, rows = await store.recent(5); if (ledger !== store) return; recent.replaceChildren(); for (const row of rows) recent.append(button(`${row.receipt.invoice.invoiceNumber} · ${money(row.receipt.invoice.totalAmount)}`, () => { try { printOfflinePharmacyReceipt(row); } catch (failure) { fail(failure); } })); }
  async function checkout(printBill: boolean) {
    if (!ledger || !privateKey || !persistent || busy || stopped || save.disabled && !frozen) return;
    busy = true; payment(); const store = ledger, signingKey = privateKey;
    try {
      await persist(); const active = await store.activeSale(); let original: StoredOfflineReceipt;
      if (active) original = active.saved ?? await store.commit(active.sale, signingKey);
      else { const value = await store.prepareSale(intent()); await store.stageSale(value); original = await store.commit(value, signingKey); }
      if (ledger !== store) return;
      const cleared = blank(draft.held); await persist(cleared); await store.finishSale(original.receipt.commandId); draft = cleared; quote = null; frozen = null; discount.value = "0"; tender.value = ""; renderCart(); await history();
      layout.dataset.mobilePanel = "products";
      status.textContent = `${original.receipt.invoice.invoiceNumber} saved on this PC. Sign in online to synchronize.`;
      if (printBill) printOfflinePharmacyReceipt(original);
    } catch (failure) { fail(failure); const active = await store.activeSale().catch(() => null); if (active) { frozen = active.sale; recovery.hidden = false; } }
    finally { busy = false; if (ledger === store) { renderCart(); payment(); } }
  }
  const recovery = text("div", ""); recovery.hidden = true;
  recovery.append(button("Recover original Save", () => { void checkout(false); }), button("Cancel unissued intent", () => { if (!ledger || !frozen) return; void ledger.finishSale(frozen.commandId, true).then(() => { frozen = null; recovery.hidden = true; changed(); }).catch(fail); }));
  async function unlock() {
    if (busy) return; busy = true; error.textContent = ""; const operation = revision;
    try {
      activeControl = sessions.find(row => row.authorityId === chooser.value)!;
      const device = await browserDevice(activeControl); if (!device || device.deviceId !== activeControl.deviceId) throw new Error("The original enrolled PC key is missing. Keep the backup and sign in for recovery.");
      ledger = await createPharmacyOfflineLedger(activeControl, activeControl.authorityId); await ledger.unlock(phrase.value); privateKey = device.privateKey; prepared = await ledger.preparation();
      persistent = await navigator.storage?.persisted?.() ?? false;
      if (!persistent) error.textContent = "Durable browser storage is unavailable. Enable durable storage before issuing bills; existing bills remain available for recovery and backup.";
      if (operation !== revision) return;
      if (!prepared || prepared.authorityId !== activeControl.authorityId || prepared.actorId !== activeControl.actorId) throw new Error("Original prepared operator evidence differs.");
      const state = await ledger.checkoutState(), active = await ledger.activeSale(); stopped = Boolean(state.stopped || state.reviewRequired) || !state.policyCurrent; draft = await ledger.readDraft() || blank();
      if (active?.saved) { const cleared = blank(draft.held); await persist(cleared); await ledger.finishSale(active.sale.commandId); draft = cleared; }
      else if (active) { frozen = active.sale; quote = active.sale; recovery.hidden = false; draft = { ...draft, cart: active.sale.lines.map(line => ({ lineId: line.lineId, medicineId: line.medicineId, quantity: String(line.allocations.reduce((sum, row) => sum + row.quantity, 0)), discount: String(line.discountPaise / 100) })), invoiceDiscount: String(active.sale.invoice.calculation!.totals.invoiceDiscountPaise / 100), tender: String(active.sale.payment.cashTenderedPaise / 100) }; }
      phrase.value = ""; discount.value = draft.invoiceDiscount; tender.value = draft.tender; unlockCard.hidden = true; work.hidden = false; status.textContent = stopped ? "This ledger is stopped. Sign in online to finish synchronization and reconciliation." : `${prepared.issuer.legalName} · Prepared cash counter · Sign in online to synchronize.`; lookup(); renderCart(); await history(); touch();
    } catch (failure) { lock(); fail(failure); }
    finally { phrase.value = ""; busy = false; if (ledger) { renderCart(); changed(); } }
  }
  const products = text("section", "", "card"), bill = text("section", "", "card"), paymentCard = text("aside", "", "card"), layout = text("div", "", "final-layout");
  products.dataset.panel = "products"; bill.dataset.panel = "cart"; paymentCard.dataset.panel = "pay"; layout.dataset.mobilePanel = "products";
  const mobileTabs = text("nav", "", "final-mobile-panels"); mobileTabs.setAttribute("aria-label", "Counter panels"); mobileTabs.append(button("Products", () => { layout.dataset.mobilePanel = "products"; search.focus(); }), button("Cart", () => { layout.dataset.mobilePanel = "cart"; }), payTab);
  products.append(text("h2", "Prepared medicines"), search, results); bill.append(text("h2", "Current bill"), emptyCart, cart, held, text("h3", "Recent bills"), recent); paymentCard.append(text("h2", "Walk-in · Cash"), text("label", "Invoice discount (INR)"), discount, text("label", "Cash received (INR)"), tender, totals, save, print, recovery,
    button("Hold bill", () => { if (busy || stopped || frozen || !draft.cart.length || (draft.held?.length || 0) >= 3) return; draft = blank([...(draft.held || []), { cart: draft.cart, invoiceDiscount: draft.invoiceDiscount, tender: draft.tender }]); discount.value = "0"; tender.value = ""; renderCart(); changed(); }), button("Lock counter", lock));
  paymentCard.append(button("Download encrypted backup", () => { const store = ledger; if (!store || busy) return; void store.exportRecoveryBackup().then(value => { if (ledger !== store) return; const url = URL.createObjectURL(new Blob([value], { type: "application/json" })), link = document.createElement("a"); link.href = url; link.download = `ekavyu-offline-${activeControl!.authorityId}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }).catch(fail); }));
  const storageHelp = text("p", "Durable browser storage is unavailable. Enable durable storage before issuing bills. Existing bills remain available for recovery and backup.");
  const storageButton = button("Enable durable storage", () => { void (async () => { try { persistent = await navigator.storage?.persist?.() ?? false; if (!persistent) throw new Error("This browser declined durable storage. Use the enrolled regular browser profile, retain a backup, and sign in online to resolve preparation."); storageHelp.hidden = storageButton.hidden = true; error.textContent = ""; payment(); } catch (failure) { fail(failure); } })(); });
  paymentCard.append(storageHelp, storageButton);
  layout.append(products, bill, paymentCard); work.append(layout, mobileTabs);
  search.addEventListener("input", lookup); search.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); const query = search.value.trim(), matches = prepared?.products.filter(product => product.barcodes.includes(query)) || []; if (matches.length === 1) add(matches[0].id); else if (matches.length > 1) fail(new Error("This barcode matches several products. Select the intended medicine.")); } });
  discount.addEventListener("input", () => { draft.invoiceDiscount = discount.value; changed(); }); tender.addEventListener("input", () => { draft.tender = tender.value; payment(); void persist().catch(fail); });
  phrase.addEventListener("keydown", event => { if (event.key === "Enter") void unlock(); });
  window.addEventListener("keydown", event => { if (!ledger || event.repeat) return; if (event.key === "F1") { event.preventDefault(); search.focus(); } if (event.key === "F10") { event.preventDefault(); void checkout(false); } });
  return true;
}
