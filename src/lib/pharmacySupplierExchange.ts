import type { OrderResponseLine, PurchaseOrder } from "./pharmacyPurchaseOrders";

export const SUPPLIER_RESPONSE_MAX_BYTES = 256 * 1024;
export const supplierResponseColumns = ["format", "order_id", "order_reference", "order_revision", "supplier_id", "branch_id", "line_id", "product_id", "product_name", "generic_name", "strength", "manufacturer", "unit_version", "base_unit", "pack_unit", "units_per_pack", "ordered_base_units", "accepted_base_units", "quoted_price_inr_per_base_unit", "supplier_note"] as const;
type Column = typeof supplierResponseColumns[number];
const format = "ekavyu-supplier-response-v1";
const safeCell = (value: string | number) => { const raw = String(value); return /^\s*[=+@-]/u.test(raw) ? `'${raw}` : raw; };
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
function identity(order: PurchaseOrder, line: PurchaseOrder["lines"][number]): Record<Column, string> {
  return { format, order_id: order.id, order_reference: safeCell(order.reference), order_revision: String(order.revision), supplier_id: order.supplierId, branch_id: order.locationId,
    line_id: line.lineId, product_id: line.medicineId, product_name: safeCell(line.medicineSnapshot.name), generic_name: safeCell(line.medicineSnapshot.genericName || ""), strength: safeCell(line.medicineSnapshot.strength || ""), manufacturer: safeCell(line.medicineSnapshot.manufacturer || ""), unit_version: String(line.unitSnapshot.version), base_unit: safeCell(line.unitSnapshot.baseUnit),
    pack_unit: safeCell(line.unitSnapshot.packUnit), units_per_pack: String(line.unitSnapshot.unitsPerPack), ordered_base_units: String(line.quantity),
    accepted_base_units: "", quoted_price_inr_per_base_unit: "", supplier_note: "" };
}
export function canImportSupplierResponse(order: PurchaseOrder) {
  return !order.invoiceCount && ["submitted", "accepted", "partially_accepted", "rejected"].includes(order.state);
}
/** The supplier fills only the final three columns. Blank quantities have no implied acceptance. */
export function supplierResponseTemplate(order: PurchaseOrder) {
  return "\uFEFF" + [supplierResponseColumns.map(quote).join(","), ...order.lines.map(line => {
    const cells = identity(order, line); return supplierResponseColumns.map(key => quote(cells[key])).join(",");
  })].join("\r\n");
}
function csvRows(input: string): string[][] {
  if (new TextEncoder().encode(input).byteLength > SUPPLIER_RESPONSE_MAX_BYTES) throw Error("Choose a supplier response CSV smaller than 256 KB.");
  const source = input.replace(/^\uFEFF/, "");
  if (!source || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD\p{Cf}]/u.test(source)) throw Error("Use a UTF-8 CSV with plain text cells.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ""; closed = false; if (row.length > supplierResponseColumns.length) throw Error("Unexpected extra supplier response columns."); };
  const finishRow = () => { finishCell(); rows.push(row); row = []; if (rows.length > 101) throw Error("A supplier response supports at most 100 product rows."); };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') { if (source[index + 1] === '"') { cell += '"'; index++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw Error("Malformed CSV quoting. Keep the supplier template's columns.");
      quoted = true;
    } else if (char === ",") finishCell();
    else if (char === "\r" || char === "\n") { if (char === "\r" && source[index + 1] === "\n") index++; finishRow(); }
    else { if (closed) throw Error("Malformed CSV text after a closing quote."); cell += char; }
    if (cell.length > 2000) throw Error("A supplier response cell exceeds 2,000 characters.");
  }
  if (quoted) throw Error("Unclosed quoted cell in the supplier response CSV.");
  if (cell || closed || row.length) finishRow();
  return rows;
}
export function parseSupplierResponse(order: PurchaseOrder, input: string): OrderResponseLine[] {
  if (!canImportSupplierResponse(order)) throw Error("Record supplier quantities on an open sent order before dispatch or invoice linking.");
  const [headers, ...rows] = csvRows(input);
  if (!headers || headers.length !== supplierResponseColumns.length || new Set(headers).size !== headers.length || supplierResponseColumns.some(key => !headers.includes(key))) throw Error("Use the exact Ekavyu supplier response template headers.");
  if (rows.length !== order.lines.length) throw Error("The response must include every ordered product exactly once, including zero for unavailable goods.");
  const editable = new Set<Column>(["accepted_base_units", "quoted_price_inr_per_base_unit", "supplier_note"]), results = new Map<string, OrderResponseLine>();
  for (const [index, row] of rows.entries()) {
    if (row.length !== headers.length) throw Error(`Response row ${index + 2} has missing columns.`);
    const cells = Object.fromEntries(headers.map((key, position) => [key, row[position]])) as Record<Column, string>;
    const line = order.lines.find(line => line.lineId === cells.line_id);
    if (!line || results.has(cells.line_id)) throw Error(`Response row ${index + 2} has an unknown or repeated order line.`);
    const expected = identity(order, line);
    if (supplierResponseColumns.some(key => !editable.has(key) && cells[key] !== expected[key])) throw Error(`Response row ${index + 2} differs from this order, revision, supplier or product units. Download a fresh template and review it.`);
    const quantity = cells.accepted_base_units.trim(), price = cells.quoted_price_inr_per_base_unit.trim(), note = cells.supplier_note.trim();
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity)) || Number(quantity) > line.quantity) throw Error(`Response row ${index + 2}: enter accepted base units from 0 to ${line.quantity}; blank does not mean accepted.`);
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) throw Error(`Response row ${index + 2}: use a nonnegative INR price with at most two decimals, or leave unknown prices blank.`);
    let quotedUnitPricePaise: number | undefined;
    if (price) {
      const [whole, fraction = ""] = price.split("."), amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
      if (amount > BigInt(100_000_000_000)) throw Error(`Response row ${index + 2}: supplier price exceeds the supported bound.`);
      quotedUnitPricePaise = Number(amount);
    }
    if (note.length > 300 || /[\p{Cc}\p{Cf}]/u.test(note)) throw Error(`Response row ${index + 2}: use a plain supplier note of at most 300 characters.`);
    results.set(line.lineId, { lineId: line.lineId, acceptedQuantity: Number(quantity), ...(quotedUnitPricePaise === undefined ? {} : { quotedUnitPricePaise }), note });
  }
  return order.lines.map(line => results.get(line.lineId)!);
}
