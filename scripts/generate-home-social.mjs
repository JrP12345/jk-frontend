import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const vector = await readFile(new URL("../public/brand/ekavyu-mark.svg", import.meta.url));
const mark = (await sharp(vector).resize(180, 180).png().toBuffer()).toString("base64");
const lockup = (await sharp(vector).resize(512, 512).png().toBuffer()).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="glow"><stop stop-color="#D4AF7A" stop-opacity=".3"/><stop offset="1" stop-color="#F6F2E8" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="#F6F2E8"/>
  <ellipse cx="1030" cy="120" rx="580" ry="390" fill="url(#glow)"/>
  <image x="66" y="46" width="60" height="60" xlink:href="data:image/png;base64,${mark}"/>
  <image x="810" y="140" width="310" height="310" xlink:href="data:image/png;base64,${lockup}"/>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#0B2F2A">
    <text x="142" y="87" font-size="30" font-weight="600" letter-spacing="5">EKAVYU</text>
    <text x="76" y="213" font-size="16" letter-spacing="3">PATIENTS. DOCTORS. CLINICS. CONNECTED.</text>
    <text x="70" y="316" font-size="66" letter-spacing="-3">Find your doctor.</text>
    <text x="70" y="413" font-size="66" letter-spacing="-3" fill="#1F5C52">Connect your clinic.</text>
    <path d="M76 490H1124" stroke="#B9CEC0"/>
    <g font-size="22"><text x="76" y="545">Find a doctor</text><text x="430" y="545">Plan your visit</text><text x="800" y="545">Connect your clinic</text></g>
  </g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL("../public/ekavyu-home-social.png", import.meta.url)));
console.log("Generated public/ekavyu-home-social.png (1200 × 630)");
