import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { readPharmacyImportFile } from "@/lib/pharmacyImportFile";

function source(sheet = '<row r="1"><c r="A1" t="inlineStr"><is><t>barcode</t></is></c><c r="B1" t="inlineStr"><is><t>price</t></is></c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>12.50</v></c></row>', more: Record<string, string> = {}) {
  const files = { "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml" /></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheet}</sheetData></worksheet>`,
    "xl/sharedStrings.xml": '<sst><si><t>000123</t></si></sst>', ...more };
  const bytes = zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])));
  const file = new File([bytes], "products.xlsx");
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  return file;
}
describe("values-only Excel to existing reviewed CSV", () => {
  it("preserves text barcodes, literal prices and sparse columns", async () => {
    expect(await readPharmacyImportFile(source())).toBe('"barcode","price"\r\n"000123","12.50"');
  });
  it("rejects formulas, merged cells and external relationships", async () => {
    await expect(readPharmacyImportFile(source('<row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row><row r="2"/>'))).rejects.toThrow(/Formula/);
    await expect(readPharmacyImportFile(source(undefined, { "xl/worksheets/_rels/sheet1.xml.rels": '<Relationships><Relationship TargetMode="External" Target="https://example.test" /></Relationships>' }))).rejects.toThrow(/external links/);
    await expect(readPharmacyImportFile(source(undefined, { "xl/workbook.xml": '<!DOCTYPE x [<!ENTITY evil "test">]><workbook/>' }))).rejects.toThrow(/declarations/);
  });
  it("rejects ambiguous worksheets, formatted numeric identifiers and oversized decompression", async () => {
    await expect(readPharmacyImportFile(source(undefined, { "xl/workbook.xml": '<workbook><sheets><sheet/><sheet/></sheets></workbook>' }))).rejects.toThrow(/one visible worksheet/);
    await expect(readPharmacyImportFile(source('<row r="1"><c r="A1" t="inlineStr"><is><t>barcode</t></is></c></row><row r="2"><c r="A2" s="1"><v>123</v></c></row>', { "xl/styles.xml": '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>' }))).rejects.toThrow(/as Text/);
    await expect(readPharmacyImportFile(source(undefined, { "xl/irrelevant.xml": "x".repeat(2_000_001) }))).rejects.toThrow(/too large/);
  });
  it("rejects unsupported older binary workbooks and unsafe row/column/cell bounds", async () => {
    await expect(readPharmacyImportFile(new File(["old"], "products.xls"))).rejects.toThrow(/older .xls/);
    await expect(readPharmacyImportFile(source('<row r="1"/><row r="202"><c r="A202"><v>1</v></c></row>'))).rejects.toThrow(/rows 1 to 201/);
    await expect(readPharmacyImportFile(source('<row r="1"/><row r="2"><c r="AO2"><v>1</v></c></row>'))).rejects.toThrow(/40/);
    await expect(readPharmacyImportFile(source(undefined, { "xl/sharedStrings.xml": `<sst><si><t>${"x".repeat(2001)}</t></si></sst>` }))).rejects.toThrow(/text exceeds/);
  });
});
