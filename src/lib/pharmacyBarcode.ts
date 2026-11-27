import { printHtml } from "@/lib/printBrand";

/**
 * ISO/IEC 15417 Code 128 symbol widths (modules 0..105 have 6 alternating bar/space
 * widths summing to 11; stop symbol 106 has 7 widths summing to 13).
 */
const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export const BARCODE_ALIAS_REGEX = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;
export const MAX_BARCODE_ALIASES = 20;
export const MAX_STICKER_PRINT_COPIES = 500;

export type StickerPresetId = "thermal-50x25" | "thermal-38x25-2up" | "a4-24" | "a4-40";

export interface StickerPreset {
  id: StickerPresetId;
  label: string;
  description: string;
  columns: number;
  pageCss: string;
  labelWidthMm: number;
  labelHeightMm: number;
  compact: boolean;
}

export const STICKER_PRESETS: readonly StickerPreset[] = [
  {
    id: "thermal-50x25",
    label: "Thermal 50 × 25 mm (1-up)",
    description: "Standard single-column pharmacy barcode roll",
    columns: 1,
    pageCss: "@page { size: 50mm 25mm; margin: 1mm; }",
    labelWidthMm: 48,
    labelHeightMm: 23,
    compact: true,
  },
  {
    id: "thermal-38x25-2up",
    label: "Thermal 38 × 25 mm (2-up roll)",
    description: "Dual-column 78 mm label roll",
    columns: 2,
    pageCss: "@page { size: 78mm 25mm; margin: 1mm; }",
    labelWidthMm: 37,
    labelHeightMm: 23,
    compact: true,
  },
  {
    id: "a4-24",
    label: "A4 Sheet · 24 labels (3 × 8)",
    description: "63.5 × 33.9 mm labels with batch, expiry & MRP",
    columns: 3,
    pageCss: "@page { size: A4; margin: 12mm 7mm; }",
    labelWidthMm: 63.5,
    labelHeightMm: 33.9,
    compact: false,
  },
  {
    id: "a4-40",
    label: "A4 Sheet · 40 labels (4 × 10)",
    description: "48.5 × 25.4 mm strip & small-box labels",
    columns: 4,
    pageCss: "@page { size: A4; margin: 20mm 8mm; }",
    labelWidthMm: 48.5,
    labelHeightMm: 25.4,
    compact: true,
  },
];

export interface StickerPrintItem {
  code: string;
  name: string;
  strength?: string;
  subtitle?: string;
  pricePaise?: number;
  mrpPaise?: number;
  batchNumber?: string;
  expiry?: string;
  rackLocation?: string;
  copies: number;
}

export interface StickerPrintOptions {
  preset: StickerPresetId;
  storeName?: string;
  showStoreName?: boolean;
  showPrice?: boolean;
  showMrp?: boolean;
  showBatch?: boolean;
  showRack?: boolean;
}

export function normalizeBarcodeInput(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, "").trim().slice(0, 64);
}

export function isValidBarcodeAlias(value: string): boolean {
  return BARCODE_ALIAS_REGEX.test(value.trim());
}

/** Strict explicit-scan check used on search submit / HID scan / camera capture. */
export function looksLikeExactBarcode(raw: string): boolean {
  const value = normalizeBarcodeInput(raw);
  return BARCODE_ALIAS_REGEX.test(value) && (/^\d{4,}$/.test(value) || /^(?=.*\d)[A-Za-z0-9._/-]{5,}$/.test(value));
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Encodes ASCII 32..126 into ISO Code 128B run-length bar/space module widths. */
export function encodeCode128B(value: string): { widths: number[]; totalModules: number } | null {
  const clean = normalizeBarcodeInput(value);
  if (!clean) return null;

  const symbols: number[] = [START_CODE_B];
  let checksum = START_CODE_B;
  for (let index = 0; index < clean.length; index++) {
    const codePoint = clean.charCodeAt(index);
    if (codePoint < 32 || codePoint > 126) return null;
    const symbol = codePoint - 32;
    symbols.push(symbol);
    checksum += symbol * (index + 1);
  }
  symbols.push(checksum % 103);
  symbols.push(STOP_CODE);

  const widths: number[] = [];
  let totalModules = 0;
  for (const symbol of symbols) {
    const pattern = CODE128_PATTERNS[symbol];
    if (!pattern) return null;
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      widths.push(width);
      totalModules += width;
    }
  }
  return { widths, totalModules };
}

/** Renders crisp printer-ready Code 128 vector SVG with optional human-readable text. */
export function renderCode128Svg(
  value: string,
  options: { barHeight?: number; quietZone?: number; showText?: boolean; className?: string } = {},
): string {
  const encoded = encodeCode128B(value);
  if (!encoded) return "";

  const clean = normalizeBarcodeInput(value);
  const barHeight = options.barHeight ?? 28;
  const quietZone = options.quietZone ?? 8;
  const showText = options.showText ?? true;
  const totalWidth = encoded.totalModules + quietZone * 2;
  const textAreaHeight = showText ? 11 : 2;
  const totalHeight = barHeight + textAreaHeight + 2;

  let cursorX = quietZone;
  let pathData = "";
  for (let i = 0; i < encoded.widths.length; i++) {
    const width = encoded.widths[i];
    if (i % 2 === 0) {
      pathData += `M${cursorX} 2h${width}v${barHeight}h-${width}z`;
    }
    cursorX += width;
  }

  const classAttr = options.className ? ` class="${escapeXml(options.className)}"` : "";
  const labelText = showText
    ? `<text x="${totalWidth / 2}" y="${barHeight + 10}" text-anchor="middle" fill="#000000" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="7.5" font-weight="600" letter-spacing="0.4">${escapeXml(clean)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg"${classAttr} viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Barcode ${escapeXml(clean)}"><rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/><path d="${pathData}" fill="#000000" shape-rendering="crispEdges"/>${labelText}</svg>`;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const formatPaise = (paise?: number) => (typeof paise === "number" && Number.isFinite(paise) ? inr.format(paise / 100) : "");

export function buildBarcodeStickersHtml(items: StickerPrintItem[], options: StickerPrintOptions): string {
  const preset = STICKER_PRESETS.find(item => item.id === options.preset) || STICKER_PRESETS[0];
  const expanded: StickerPrintItem[] = [];
  for (const item of items) {
    if (!encodeCode128B(item.code)) continue;
    const count = Math.max(0, Math.min(Math.floor(item.copies || 0), MAX_STICKER_PRINT_COPIES));
    for (let i = 0; i < count; i++) {
      if (expanded.length >= MAX_STICKER_PRINT_COPIES) break;
      expanded.push(item);
    }
    if (expanded.length >= MAX_STICKER_PRINT_COPIES) break;
  }

  if (!expanded.length) return "";

  const showStore = Boolean(options.showStoreName && options.storeName?.trim());
  const showPrice = options.showPrice !== false;
  const showMrp = options.showMrp !== false;
  const showBatch = options.showBatch !== false;
  const showRack = Boolean(options.showRack);
  const thermal = preset.id.startsWith("thermal");

  const labelsMarkup = expanded
    .map(item => {
      const title = escapeXml([item.name, item.strength].filter(Boolean).join(" "));
      const storeHtml = showStore ? `<div class="sticker-store">${escapeXml(options.storeName!.trim())}</div>` : "";
      const metaParts: string[] = [];
      if (showPrice && item.pricePaise !== undefined) metaParts.push(`<span>Sale ${escapeXml(formatPaise(item.pricePaise))}</span>`);
      if (showMrp && item.mrpPaise !== undefined) metaParts.push(`<span>MRP ${escapeXml(formatPaise(item.mrpPaise))}</span>`);
      if (showRack && item.rackLocation) metaParts.push(`<span>Rack ${escapeXml(item.rackLocation)}</span>`);
      const batchParts: string[] = [];
      if (showBatch && item.batchNumber) batchParts.push(`<span>B:${escapeXml(item.batchNumber)}</span>`);
      if (showBatch && item.expiry) batchParts.push(`<span>E:${escapeXml(item.expiry)}</span>`);
      const barcodeSvg = renderCode128Svg(item.code, {
        barHeight: preset.compact ? 22 : 28,
        quietZone: 7,
        showText: true,
      });

      return `<article class="sticker">
        ${storeHtml}
        <div class="sticker-title">${title}</div>
        ${(metaParts.length || batchParts.length) ? `<div class="sticker-meta">${metaParts.join("")}${batchParts.join("")}</div>` : ""}
        <div class="sticker-code">${barcodeSvg}</div>
      </article>`;
    })
    .join("");

  const gridStyle = thermal && preset.columns === 1
    ? `.sheet{display:block}.sticker{break-after:page;page-break-after:always}.sticker:last-child{break-after:auto;page-break-after:auto}`
    : `.sheet{display:grid;grid-template-columns:repeat(${preset.columns},${preset.labelWidthMm}mm);gap:${thermal ? "2mm" : "0 2.5mm"};justify-content:center;align-content:start}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Barcode Stickers</title>
  <style>
    ${preset.pageCss}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#fff;color:#000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",ui-sans-serif,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    ${gridStyle}
    .sticker{width:${preset.labelWidthMm}mm;height:${preset.labelHeightMm}mm;padding:${preset.compact ? "1.2mm 1.5mm" : "2mm 2.4mm"};display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;border:0.2mm dashed #d4d4d8;break-inside:avoid}
    .sticker-store{font-size:${preset.compact ? "6pt" : "6.8pt"};font-weight:700;letter-spacing:0.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#222}
    .sticker-title{font-size:${preset.compact ? "7pt" : "8pt"};font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sticker-meta{display:flex;flex-wrap:wrap;gap:0 4px;font-size:${preset.compact ? "6pt" : "6.8pt"};line-height:1.15;font-weight:600;color:#111;white-space:nowrap;overflow:hidden}
    .sticker-code{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding-top:0.4mm}
    .sticker-code svg{max-width:100%;max-height:100%;display:block}
    @media print{.sticker{border-color:transparent}}
  </style>
</head>
<body>
  <main class="sheet">${labelsMarkup}</main>
</body>
</html>`;
}

export async function printBarcodeStickers(items: StickerPrintItem[], options: StickerPrintOptions): Promise<void> {
  const html = buildBarcodeStickersHtml(items, options);
  await printHtml(html);
}
