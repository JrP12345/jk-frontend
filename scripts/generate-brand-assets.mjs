// Run from the frontend repository: npm run brand:assets
// Preserve the supplied artwork; only resize and place it on icon canvases.
import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import sharp from 'sharp';
const publicDir = path.join(import.meta.dirname, '../public');
const source = path.join(publicDir, 'image.png');

async function appIcon(name, size, background, scale = 0.70) {
  const markSize = Math.floor(size * scale);
  const mark = await sharp(source).resize(markSize, markSize, { fit: 'contain' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png().toFile(path.join(publicDir, name));
}

async function main() {
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error('The source logo must retain transparency.');
  await sharp(source).resize(512, 512, { fit: 'contain' }).png()
    .toFile(path.join(publicDir, 'ekavyu-leaf.png'));
  // Old cached clients may still request these neutral public asset URLs.
  for (const name of ['logo-d.png', 'logo-w.png']) {
    await copyFile(path.join(publicDir, 'ekavyu-leaf.png'), path.join(publicDir, name));
  }
  for (const size of [16, 32]) {
    await sharp(source).resize(size, size, { fit: 'contain' }).png()
      .toFile(path.join(publicDir, `favicon-${size}.png`));
  }
  for (const size of [180, 192, 512]) {
    await appIcon(`app-icon-${size}.png`, size, '#0E2A28');
  }
  await appIcon('app-icon-light-192.png', 192, '#F7F7F2');
  // A 56% square is entirely inside the 80%-diameter maskable safe circle.
  await appIcon('app-icon-maskable-512.png', 512, '#0E2A28', 0.56);
  console.log('Generated Ekavyu UI, favicon, Apple and PWA assets from public/image.png.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
