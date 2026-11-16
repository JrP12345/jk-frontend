import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const vector = await readFile(new URL("../public/brand/ekavyu-symbol-black.svg", import.meta.url));
const mark = (await sharp(vector).resize(180, 180).png().toBuffer()).toString("base64");
const wordmark = (await sharp(await readFile(new URL("../public/brand/ekavyu-wordmark-black.svg", import.meta.url))).resize(400).png().toBuffer()).toString("base64");
const lockup = (await sharp(await readFile(new URL("../public/brand/ekavyu-stacked-black.svg", import.meta.url))).resize(512, 512, { fit: "contain", background: "#00000000" }).png().toBuffer()).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="glow"><stop stop-color="#D4AF7A" stop-opacity=".3"/><stop offset="1" stop-color="#F6F2E8" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="#F6F2E8"/>
  <ellipse cx="1030" cy="120" rx="580" ry="390" fill="url(#glow)"/>
  <image x="66" y="46" width="60" height="60" xlink:href="data:image/png;base64,${mark}"/>
  <image x="810" y="140" width="310" height="310" xlink:href="data:image/png;base64,${lockup}"/>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#0B2F2A">
    <image x="142" y="59" width="220" height="37" xlink:href="data:image/png;base64,${wordmark}"/>
    <text x="76" y="213" font-size="19">Care that keeps moving.</text>
    <text x="70" y="316" font-size="80" letter-spacing="-3">Care,</text>
    <text x="70" y="413" font-size="80" letter-spacing="-3" fill="#1F5C52">connected.</text>
    <path d="M76 490H1124" stroke="#B9CEC0"/>
    <g font-size="22"><text x="76" y="545">Patients</text><text x="430" y="545">Clinics &amp; hospitals</text><text x="900" y="545">Pharmacies</text></g>
  </g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL("../public/ekavyu-home-social.png", import.meta.url)));
console.log("Generated public/ekavyu-home-social.png (1200 × 630)");
