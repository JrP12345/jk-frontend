import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const leaf = (await readFile(new URL("../public/ekavyu-leaf.png", import.meta.url))).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F4F7F1"/>
  <image x="66" y="46" width="60" height="60" xlink:href="data:image/png;base64,${leaf}"/>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#0E2A28">
    <text x="138" y="89" font-size="35" font-weight="600">Ekavyu</text>
    <text x="76" y="213" font-size="16" letter-spacing="3">SOFTWARE FOR DOCTORS, CLINICS &amp; CARE TEAMS</text>
    <text x="70" y="316" font-size="76" letter-spacing="-3">Practice management.</text>
    <text x="70" y="413" font-size="76" letter-spacing="-3" fill="#0F6F66">For your care team.</text>
    <path d="M76 490H1124" stroke="#B9CEC0"/>
    <g font-size="22"><text x="76" y="545">Appointments</text><text x="350" y="545">Reception</text><text x="615" y="545">Consultations</text><text x="898" y="545">Patient access</text></g>
  </g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL("../public/ekavyu-home-social.png", import.meta.url)));
console.log("Generated public/ekavyu-home-social.png (1200 × 630)");
