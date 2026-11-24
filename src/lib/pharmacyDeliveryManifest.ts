import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { purchaseDeliveryPayload, purchaseReceivingPlan, type PurchaseDeliveryLine } from "./pharmacyReceiving";
const columns = ["format", "purchase_id", "purchase_revision", "branch_id", "supplier_id", "purchase_line_id", "product_id", "product_name", "unit_version", "base_unit", "pack_unit", "units_per_pack", "outer_pack_unit", "packs_per_outer", "billed_base_units", "free_base_units", "batch_number", "expiry_precision", "expiry"] as const;
const editable = new Set<string>(["billed_base_units", "free_base_units", "batch_number", "expiry_precision", "expiry"]);
const safe = (value: unknown) => { const text = String(value ?? ""); return /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text; };
const quote = (value: unknown) => `"${safe(value).replaceAll('"', '""')}"`;
function identity(purchase: PurchaseDraft, line: PurchaseDraft["lines"][number]) {
  return { format: "ekavyu-purchase-delivery-v1", purchase_id: purchase.id, purchase_revision: String(purchase.revision), branch_id: purchase.locationId, supplier_id: purchase.supplierId, purchase_line_id: line.lineId, product_id: line.medicineId, product_name: safe(line.medicineSnapshot.name), unit_version: String(line.unitSnapshot.version), base_unit: line.unitSnapshot.baseUnit, pack_unit: line.unitSnapshot.packUnit, units_per_pack: String(line.unitSnapshot.unitsPerPack), outer_pack_unit: line.unitSnapshot.outerPackUnit || "", packs_per_outer: line.unitSnapshot.packsPerOuter ? String(line.unitSnapshot.packsPerOuter) : "" };
}
export function deliveryManifestTemplate(purchase: PurchaseDraft) {
  if (purchase.status !== "posted") throw Error("Post the saved supplier invoice before preparing a delivery manifest.");
  const rows = purchaseReceivingPlan(purchase).filter(row => row.billed + row.free > 0).map(row => ({ ...identity(purchase, row.source), billed_base_units: String(row.billed), free_base_units: String(row.free), batch_number: "", expiry_precision: "month", expiry: "" }));
  return "\uFEFF" + [columns.map(quote).join(","), ...rows.map(row => columns.map(key => quote(row[key])).join(","))].join("\r\n");
}
function csv(input: string) {
  if (new TextEncoder().encode(input).byteLength > 256 * 1024) throw Error("Use a delivery CSV up to 256 KB and 100 lots.");
  const source = input.replace(/^\uFEFF/, ""); if (!source || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD\p{Cf}]/u.test(source)) throw Error("Use a UTF-8 delivery file with plain text values.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ""; closed = false; if (row.length > columns.length) throw Error("Unexpected delivery columns."); };
  const finishRow = () => { finishCell(); rows.push(row); row = []; if (rows.length > 101) throw Error("Split deliveries with more than 100 lots into separately reviewed receipts."); };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) { if (char === '"') { if (source[index + 1] === '"') { cell += '"'; index++; } else { quoted = false; closed = true; } } else cell += char; }
    else if (char === '"') { if (cell || closed) throw Error("Malformed delivery CSV quoting."); quoted = true; }
    else if (char === ",") finishCell();
    else if (char === "\r" || char === "\n") { if (char === "\r" && source[index + 1] === "\n") index++; finishRow(); }
    else { if (closed) throw Error("Malformed text after a quoted delivery cell."); cell += char; }
    if (cell.length > 2000) throw Error("A delivery cell exceeds 2,000 characters.");
  }
  if (quoted) throw Error("Unclosed delivery CSV quote."); if (cell || closed || row.length) finishRow(); return rows;
}
export function parseDeliveryManifest(purchase: PurchaseDraft, input: string): PurchaseDeliveryLine[] {
  const rows = csv(input), headers = rows.shift();
  if (!headers || headers.length !== columns.length || new Set(headers).size !== headers.length || columns.some(key => !headers.includes(key)) || !rows.length) throw Error("Use the current delivery template with its complete headers and at least one received lot.");
  const lines = rows.map((row, index) => {
    if (row.length !== headers.length) throw Error(`Delivery row ${index + 2} has missing columns.`);
    const values = Object.fromEntries(headers.map((key, position) => [key, row[position]]));
    const source = purchase.lines.find(line => line.lineId === values.purchase_line_id); if (!source) throw Error(`Delivery row ${index + 2} has an unknown purchase line.`);
    const expected = identity(purchase, source);
    if (columns.some(key => !editable.has(key) && values[key] !== expected[key as keyof typeof expected])) throw Error(`Delivery row ${index + 2} differs from the saved invoice, revision, branch, supplier or product units. Download a fresh template.`);
    return { lineId: crypto.randomUUID(), purchaseLineId: source.lineId, billed: values.billed_base_units, free: values.free_base_units, batch: values.batch_number, precision: values.expiry_precision, expiry: values.expiry };
  });
  purchaseDeliveryPayload(purchase, "LOCAL-FILE-REVIEW", lines); // Same source/allowance checks as manual receiving; no posting.
  return lines;
}
