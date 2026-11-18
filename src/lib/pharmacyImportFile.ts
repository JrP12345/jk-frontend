const MAX_BYTES = 512000, MAX_XML_BYTES = 2_000_000;
const problem = (message: string): never => { throw new Error(message); };
const decode = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const xml = (bytes: Uint8Array) => {
  const source = decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) problem("Excel XML declarations are unsupported. Export values-only CSV.");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.getElementsByTagName("parsererror").length) problem("Excel XML is invalid. Export values-only CSV.");
  return document;
};
const elements = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS("*", name));
/** Small, bounded values-only XLSX reader. No formulas, macros, external links,
 * date/percentage/custom number coercion or implicit choice among worksheets.
 * The result uses the existing server mapping/review/import transaction pipeline.
 */
export async function readPharmacyImportFile(file: File): Promise<string> {
  if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > MAX_BYTES) problem("Choose .csv or values-only .xlsx, at most 512,000 bytes and 200 source rows. Export older .xls files as UTF-8 CSV.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name)) {
    try { return decode(bytes); } catch { return problem("Save the source as UTF-8 CSV before importing."); }
  }
  const { unzipSync } = await import("fflate");
  let entries: Record<string, Uint8Array>, total = 0, count = 0;
  try {
    entries = unzipSync(bytes, { filter: entry => {
      if (++count > 128 || /(^|\/)\.\.(\/|$)|\\|vbaProject|externalLinks/i.test(entry.name)) problem("Unsupported Excel archive");
      total += entry.originalSize;
      if (!Number.isSafeInteger(total) || total > MAX_XML_BYTES || entry.originalSize > MAX_XML_BYTES) problem("Excel contents exceed the safe import size");
      return /^(xl\/workbook.xml|xl\/_rels\/workbook.xml.rels|xl\/sharedStrings.xml|xl\/styles.xml|xl\/worksheets\/sheet\d+.xml|xl\/worksheets\/_rels\/sheet\d+.xml.rels)$/.test(entry.name);
    } });
  } catch { return problem("Excel archive is invalid, too large or contains unsupported content. Export values-only CSV."); }
  const workbook = entries["xl/workbook.xml"], relationships = entries["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) problem("This is not a supported Excel workbook");
  const sheets = elements(xml(workbook), "sheet"), relations = elements(xml(relationships), "Relationship");
  if (sheets.length !== 1 || sheets[0].getAttribute("state") && sheets[0].getAttribute("state") !== "visible") problem("Import one visible worksheet at a time. Export the intended sheet as CSV.");
  const relationId = sheets[0].getAttribute("r:id"), target = relations.find(row => row.getAttribute("Id") === relationId)?.getAttribute("Target");
  if (relations.some(row => row.getAttribute("TargetMode") === "External") || !target || !/^(\/xl\/)?worksheets\/sheet\d+.xml$/.test(target)) problem("Excel external or unsupported worksheet references are not allowed");
  if (!target) return problem("Excel worksheet is missing");
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  for (const [name, value] of Object.entries(entries)) if (name.endsWith(".rels") && elements(xml(value), "Relationship").some(row => row.getAttribute("TargetMode") === "External")) problem("Remove external links before importing Excel");
  if (!entries[path]) problem("Excel worksheet is missing");
  const shared = entries["xl/sharedStrings.xml"] ? elements(xml(entries["xl/sharedStrings.xml"]), "si").map(row => elements(row, "t").map(text => text.textContent || "").join("")) : [];
  if (shared.length > 8040 || shared.some(value => value.length > 2000)) problem("Excel text exceeds import limits");
  const styleDoc = entries["xl/styles.xml"] ? xml(entries["xl/styles.xml"]) : null;
  const cellFormats = styleDoc ? elements(styleDoc, "cellXfs").flatMap(row => elements(row, "xf")).map(row => Number(row.getAttribute("numFmtId") || 0)) : [0];
  const sheet = xml(entries[path]);
  if (elements(sheet, "f").length || elements(sheet, "mergeCell").length) problem("Formula or merged cells need review. Export a values-only unmerged CSV.");
  const rows = elements(sheet, "row");
  if (rows.length < 2 || rows.length > 201) problem("Excel needs a header and 1 to 200 data rows");
  const matrix: string[][] = [];
  let width = 0, previousRow = 0;
  for (const row of rows) {
    if (row.getAttribute("hidden") === "1") problem("Unhide source rows before importing");
    const rowNumber = Number(row.getAttribute("r"));
    if (!Number.isSafeInteger(rowNumber) || rowNumber <= previousRow || rowNumber > 201) problem("Excel source rows must fit within rows 1 to 201");
    previousRow = rowNumber;
    const values: string[] = [], seen = new Set<number>();
    for (const cell of elements(row, "c")) {
      const ref = /^([A-Z]{1,2})([1-9]\d*)$/.exec(cell.getAttribute("r") || "");
      if (!ref || Number(ref[2]) !== rowNumber) problem("Invalid Excel cell reference");
      const column = [...ref![1]].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
      if (column >= 40 || seen.has(column)) problem("Excel supports at most 40 distinct source columns");
      seen.add(column);
      const type = cell.getAttribute("t"), raw = elements(cell, "v")[0]?.textContent || "";
      let value: string;
      if (type === "s") {
        if (!/^\d+$/.test(raw) || !Object.hasOwn(shared, Number(raw))) problem("Invalid Excel shared text reference");
        value = shared[Number(raw)];
      } else if (type === "inlineStr") value = elements(cell, "t").map(text => text.textContent || "").join("");
      else if (type && type !== "n" && type !== "str") return problem("Excel dates, errors and booleans require explicit reviewed text values");
      else {
        const style = Number(cell.getAttribute("s") || 0);
        if (!Number.isInteger(style) || ![0, 1, 2].includes(cellFormats[style])) problem("Store dates, barcodes and formatted identifiers as Text; export other custom formats as reviewed CSV");
        if (raw && type !== "str" && !/^-?\d+(\.\d+)?$/.test(raw)) problem("Excel scientific numeric notation needs explicit text review");
        value = raw;
      }
      if (value.length > 2000) problem("An Excel cell exceeds 2,000 characters");
      values[column] = value; width = Math.max(width, column + 1);
    }
    matrix.push(values);
  }
  const csv = matrix.map(row => Array.from({ length: width }, (_, column) => `"${(row[column] || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  if (new TextEncoder().encode(csv).length > MAX_BYTES) problem("Converted Excel exceeds CSV import limits; split it into smaller reviewed files");
  return csv;
}
