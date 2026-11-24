import { expect, it } from "vitest";
import { orderFixture } from "./fixtures/pharmacyPurchaseOrder";
import { parseSupplierResponse, supplierResponseColumns, supplierResponseTemplate, SUPPLIER_RESPONSE_MAX_BYTES } from "@/lib/pharmacySupplierExchange";

const order = () => orderFixture({ revision: 2, state: "submitted", status: "submitted" });
const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
function response(changes: Record<string, string> = {}, source = order()) {
  const template = supplierResponseTemplate(source).slice(1).split("\r\n"), values = template[1].match(/"(?:[^"]|"")*"/g)!.map(value => value.slice(1, -1).replaceAll('""', '"'));
  for (const [name, value] of Object.entries({ accepted_base_units: "7", quoted_price_inr_per_base_unit: "1.05", supplier_note: "Seven available", ...changes })) values[supplierResponseColumns.indexOf(name as typeof supplierResponseColumns[number])] = value;
  return { header: template[0], row: values.map(cell).join(","), csv: `${template[0]}\r\n${values.map(cell).join(",")}\r\n` };
}
it("exports exact order identity and composition without pre-acceptance or private customer/cost fields", () => {
  const csv = supplierResponseTemplate(order());
  expect(csv).toContain('"order_revision"'); expect(csv).toContain('"strength"'); expect(csv).toContain('"units_per_pack"');
  expect(csv).toContain('"21","","",""'); expect(csv).not.toMatch(/purchaseCost|patient|email|token|gstin/);
  expect(() => parseSupplierResponse(order(), csv)).toThrow(/blank does not mean accepted/);
});
it("parses explicit base units and exact paise; zero and unknown price remain distinct", () => {
  expect(parseSupplierResponse(order(), response().csv)).toEqual([{ lineId: "order-line-0001", acceptedQuantity: 7, quotedUnitPricePaise: 105, note: "Seven available" }]);
  expect(parseSupplierResponse(order(), response({ accepted_base_units: "0", quoted_price_inr_per_base_unit: "" }).csv)[0]).not.toHaveProperty("quotedUnitPricePaise");
  expect(parseSupplierResponse(order(), response({ quoted_price_inr_per_base_unit: "0.00" }).csv)[0].quotedUnitPricePaise).toBe(0);
});
it.each(["order_id", "order_reference", "order_revision", "branch_id", "supplier_id", "product_id", "unit_version", "base_unit", "units_per_pack", "ordered_base_units", "strength"])("rejects changed %s instead of guessing a match", key => {
  expect(() => parseSupplierResponse(order(), response({ [key]: "different" }).csv)).toThrow(/differs from this order/);
});
it.each(["", "22", "-1", "1.5", "1e1", "9007199254740992", "=7"])("rejects invalid or missing accepted quantity %s", accepted_base_units => {
  expect(() => parseSupplierResponse(order(), response({ accepted_base_units }).csv)).toThrow(/accepted base units/);
});
it.each(["1.001", "1e2", "-1", "NaN", "1,00", "=100", "1000000000.01"])("rejects invalid price %s", quoted_price_inr_per_base_unit => {
  expect(() => parseSupplierResponse(order(), response({ quoted_price_inr_per_base_unit }).csv)).toThrow(/price/);
});
it("supports comma/quote text and reordered columns without fuzzy product matching", () => {
  const data = response({ supplier_note: 'Seven, from "current" supply' }), headers = data.header.split(","), row = data.row.match(/"(?:[^"]|"")*"/g)!;
  expect(parseSupplierResponse(order(), `${headers.reverse().join(",")}\n${row.reverse().join(",")}`)[0].note).toBe('Seven, from "current" supply');
});
it("rejects malformed, duplicate, missing, oversized and active-content rows", () => {
  const data = response();
  for (const csv of [data.csv + data.row, data.header, data.csv.replace('"format"', '"order_id"'), data.csv + '"unclosed', data.csv.replace('"Seven available"', '"value"suffix'), data.csv.replace("Seven available", "bad\u0000cell"), data.csv.replace("Seven available", "bad\ncell"), data.csv.replace("Seven available", "a".repeat(301)), data.csv.replace("Seven available", "bad\uFFFDencoding"), "a".repeat(SUPPLIER_RESPONSE_MAX_BYTES + 1)]) {
    expect(() => parseSupplierResponse(order(), csv)).toThrow();
  }
});
it("requires every line exactly once and restores original order after file row sorting", () => {
  const source = order(); source.lines.push({ ...source.lines[0], lineId: "order-line-0002", medicineId: "f".repeat(24) });
  const first = response({}, source), second = response({ line_id: "order-line-0002", product_id: "f".repeat(24) }, source);
  expect(parseSupplierResponse(source, `${first.header}\n${second.row}\n${first.row}`).map(row => row.lineId)).toEqual(source.lines.map(row => row.lineId));
  expect(() => parseSupplierResponse(source, `${first.header}\n${first.row}\n${first.row}`)).toThrow(/repeated/);
});
it("escapes formula-bearing labels and accepts only the exported immutable representation", () => {
  const source = order(); source.lines[0].medicineSnapshot.name = ' =HYPERLINK("unsafe")';
  expect(supplierResponseTemplate(source)).toContain("' =HYPERLINK");
  expect(parseSupplierResponse(source, response({}, source).csv)[0].acceptedQuantity).toBe(7);
});
it.each(["draft", "dispatched", "closed", "cancelled"])("rejects %s orders and invoiced orders", state => {
  expect(() => parseSupplierResponse({ ...order(), state }, response().csv)).toThrow(/open sent order/);
  expect(() => parseSupplierResponse({ ...order(), invoiceCount: 1 }, response().csv)).toThrow(/open sent order/);
});
