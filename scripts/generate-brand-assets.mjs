// Publish the supplied monochrome kit unchanged. Never retrace or recolor it.
import path from 'node:path';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const publicDir = path.join(import.meta.dirname, '../public');
const brandDir = path.join(publicDir, 'brand');
const sourceDir = path.join(import.meta.dirname, '../assets/brand');
await mkdir(brandDir, { recursive: true });
for (const name of ['symbol', 'wordmark', 'stacked', 'stacked-without-descriptor']) {
  for (const color of ['black', 'white']) {
    const file = `ekavyu-${name}-${color}.svg`;
    const source = path.join(sourceDir, 'vector', file);
    const svg = await readFile(source, 'utf8');
    if (/<(?:image|script|foreignObject|text)\b/i.test(svg)) throw new Error(`Expected outlined vector artwork: ${file}`);
    await copyFile(source, path.join(brandDir, file));
  }
}
const icons = {
  'favicon.ico': 'favicon.ico',
  'favicon-black-on-white-16x16.png': 'favicon-16.png',
  'favicon-black-on-white-32x32.png': 'favicon-32.png',
  'favicon-white-on-black-16x16.png': 'favicon-dark-16.png',
  'favicon-white-on-black-32x32.png': 'favicon-dark-32.png',
  'apple-touch-icon.png': 'app-icon-180.png',
  'android-chrome-192x192.png': 'app-icon-192.png',
  'android-chrome-512x512.png': 'app-icon-512.png',
  'pwa-maskable-icon-512.png': 'app-icon-maskable-512.png',
};
for (const [source, destination] of Object.entries(icons)) {
  await copyFile(path.join(sourceDir, 'icons', source), path.join(publicDir, destination));
}
console.log('Published 8 original monochrome vectors and 9 supplied browser/install icons.');
