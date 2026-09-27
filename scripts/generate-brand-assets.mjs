// Run from the frontend repository: npm run brand:assets
// Preserve the supplied artwork; only resize and place it on icon canvases.
import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import sharp from 'sharp';
const publicDir = path.join(import.meta.dirname, '../public');
const source = path.join(publicDir, 'image.png');

async function appIcon(markSource, name, size, background, scale = 0.92) {
  const markSize = Math.floor(size * scale);
  const mark = await sharp(markSource).resize(markSize, markSize, { fit: 'contain', background: '#00000000' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png().toFile(path.join(publicDir, name));
}

async function main() {
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error('The source logo must retain transparency.');
  // The supplied image has transparent margins and a few nearly invisible
  // pixels outside the mark. Fit the visible artwork, rather than that canvas.
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 16) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('The source logo has no visible artwork.');
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 2);
  const width = right - left + 1, height = bottom - top + 1;
  const markSource = await sharp(source).extract({ left, top, width, height }).png().toBuffer();
  let radius = 0;
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 16) continue;
      radius = Math.max(radius, Math.hypot(x - (left + right) / 2, y - (top + bottom) / 2) / Math.max(width, height));
    }
  }
  // Website components retain the original canvas and their established visual size.
  // Only OS/browser icons use the tightly fitted artwork below.
  await sharp(source).resize(512, 512, { fit: 'contain', background: '#00000000' }).png()
    .toFile(path.join(publicDir, 'ekavyu-leaf.png'));
  // Old cached clients may still request these neutral public asset URLs.
  for (const name of ['logo-d.png', 'logo-w.png']) {
    await copyFile(path.join(publicDir, 'ekavyu-leaf.png'), path.join(publicDir, name));
  }
  for (const size of [16, 32]) {
    await sharp(markSource).resize(size, size, { fit: 'contain', background: '#00000000' }).png()
      .toFile(path.join(publicDir, `favicon-${size}.png`));
  }
  for (const size of [192, 512]) {
    await appIcon(markSource, `app-icon-${size}.png`, size, '#00000000');
  }
  await appIcon(markSource, 'app-icon-180.png', 180, '#0E2A28', 0.84);
  await appIcon(markSource, 'app-icon-light-192.png', 192, '#F7F7F2');
  // Fit the actual leaf silhouette inside the maskable safe circle, with margin.
  await appIcon(markSource, 'app-icon-maskable-512.png', 512, '#0E2A28', Math.min(0.92, 0.39 / radius));
  console.log('Generated Ekavyu UI, favicon, Apple and PWA assets from public/image.png.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
