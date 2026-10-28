// npm run brand:assets — the UI master is a transparent path-only SVG.
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const publicDir = path.join(import.meta.dirname, '../public');
const brandDir = path.join(publicDir, 'brand');
const source = path.join(import.meta.dirname, '../assets/brand/ekavyu-mark.svg');
await mkdir(brandDir, { recursive: true });
const original = await readFile(source, 'utf8');
if (/<(?:image|script|foreignObject|rect)\b/i.test(original)) throw new Error('The logo must contain vector paths without a background or embedded image.');
// Remove unused icon-background gradients and compact sub-pixel coordinates.
// This retains the supplied contours; there is no bitmap tracing or runtime rendering code.
const svg = original.replace(/<linearGradient id="(?:iconBg|creamBg|softPurp)"[\s\S]*?<\/linearGradient>/g, '')
  .replace(/-?\d+\.\d+/g, value => String(Math.round(Number(value) * 10) / 10))
  .replace(/>\s+</g, '><').trim();
await writeFile(path.join(brandDir, 'ekavyu-mark.svg'), svg + '\n');
for (const size of [16, 32]) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, `favicon-${size}.png`));
}
for (const size of [180, 192, 512]) {
  const mark = await sharp(Buffer.from(svg)).resize(Math.round(size * .82), Math.round(size * .82)).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#F6F2E8' } })
    .composite([{ input: mark, gravity: 'centre' }]).removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, `app-icon-${size}.png`));
}
const safeMark = await sharp(Buffer.from(svg)).resize(280, 280).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#F6F2E8' } })
  .composite([{ input: safeMark, gravity: 'centre' }]).removeAlpha()
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(publicDir, 'app-icon-maskable-512.png'));
console.log('Generated transparent SVG, favicons and vector-derived install icons.');
