// Actual application UI, Playwright, and a loopback-only fictional clinic API.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fixture, ids, demoClock, doctors, patients, appointments, invoices } from './landing-demo.mjs';

const requireTool = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const { chromium } = requireTool('playwright-core');
const origin = 'http://localhost:3105', api = 'http://127.0.0.1:5118';
const output = path.resolve('docs/landing-page/connected/product'), assets = path.resolve('public/landing/product');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(assets, { recursive: true });
let role = 'admin', scene = '', logs = '', browser;
const reads = [], unknown = new Set(), blockedWrites = [], simulatedInitializations = [];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, api);
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type, authorization, x-patient-record-access', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST', 'Access-Control-Expose-Headers': 'x-total-count,x-total-pages' };
  if (request.method === 'OPTIONS') { response.writeHead(204, headers); response.end(); return; }
  if (['/api/ws', '/api/notifications/stream'].includes(url.pathname)) { response.writeHead(204, headers); response.end(); return; }
  // The real encounter provider initializes with POST. This response exists only
  // in memory in this capture process; it never writes a database or forwards.
  const allowedInitialization = request.method === 'POST' && ['/api/encounters', '/api/auth/refresh'].includes(url.pathname);
  if (!['GET', 'HEAD'].includes(request.method) && !allowedInitialization) {
    blockedWrites.push(request.method + ' ' + url.pathname); response.writeHead(405, headers); response.end(JSON.stringify({ success: false, message: 'Read-only local capture' })); return;
  }
  if (allowedInitialization) simulatedInitializations.push(request.method + ' ' + url.pathname);
  const value = fixture(url, role, request.method, scene);
  reads.push(request.method + ' ' + url.pathname);
  if (value === undefined) unknown.add(url.pathname);
  const total = value?.pagination?.total ?? (Array.isArray(value?.data) ? value.data.length : 1);
  response.writeHead(value === undefined ? 501 : 200, { ...headers, 'x-total-count': String(total), 'x-total-pages': '1' });
  response.end(JSON.stringify(value ?? { success: false, message: 'Missing local demo contract' }));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5118, '127.0.0.1', resolve); });
const production = !!process.env.PRODUCT_CAPTURE_DIST;
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '--hostname', 'localhost', '--port', '3105'], {
  cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, EKAVYU_NEXT_DIST_DIR: process.env.PRODUCT_CAPTURE_DIST || '.next/landing-connected-dev', NEXT_PUBLIC_API_URL: production ? 'https://api.example.invalid/api' : api + '/api', NEXT_PUBLIC_BACKEND_URL: production ? 'https://api.example.invalid' : api, BACKEND_INTERNAL_URL: api, NEXT_TELEMETRY_DISABLED: '1' },
});
next.stdout.on('data', chunk => { logs += chunk; }); next.stderr.on('data', chunk => { logs += chunk; });
const previous = await fs.readFile(path.join(output, 'capture-provenance.json'), 'utf8').then(JSON.parse).catch(() => ({ captures: [] }));
const captures = previous.captures || [];
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(origin + '/manifest.json')).ok) break; } catch { /* startup */ }
    if (next.exitCode !== null) throw new Error('Preview exited: ' + logs.slice(-1500));
    if (attempt === 119) throw new Error('Preview startup timeout');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-proxy-server'] });
  for (const screen of [
    { name: 'discovery', route: '/browse', expected: 'Aster Grove Clinic' },
    { name: 'booking', route: '/doctor/mira-shah?location=aster-grove', expected: 'Mira Shah' },
    { name: 'reception', route: '/dashboard/appointments', role: 'admin', expected: 'Anaya Sen' },
    { name: 'queue', route: '/dashboard/queue', role: 'doctor', expected: 'Anaya Sen' },
    { name: 'doctor', route: '/dashboard/consultations/' + ids.visit, role: 'doctor', expected: 'Anaya Sen' },
    { name: 'billing', route: '/dashboard/billing', role: 'admin', expected: 'DEMO-1021' },
    { name: 'overview', route: '/dashboard', role: 'admin', expected: 'Aditi Rao' },
    { name: 'whatsapp', route: '/dashboard/organizations?organizationId=' + ids.org + '&section=configuration', role: 'admin', expected: 'Connection and delivery' },
    { name: 'notifications', route: '/dashboard/notifications', role: 'admin', expected: 'Anaya Sen checked in' },
  ].filter(screen => !process.env.PRODUCT_CAPTURE_SCREENS || process.env.PRODUCT_CAPTURE_SCREENS.split(',').includes(screen.name))) for (const mobile of [false, true]) {
    role = screen.role || 'patient'; scene = screen.name; reads.length = 0; unknown.clear();
    const writesStart = blockedWrites.length, initializationsStart = simulatedInitializations.length;
    const context = await browser.newContext({ viewport: mobile ? { width: 420, height: 1000 } : { width: screen.role ? 1360 : 1040, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', colorScheme: 'light', locale: 'en-US', timezoneId: 'Asia/Kolkata' });
    const page = await context.newPage(), errors = [], consoleErrors = [];
    // Public pages are server-rendered: keep the server/browser clock aligned.
    // Private workspaces mount after authentication and can show the fixed demo day.
    if (screen.role) await page.clock.setFixedTime(new Date(demoClock));
    await context.addInitScript(locationId => { localStorage.setItem('ekavyu-mode', 'light'); localStorage.setItem('ekavyu_active_location_id', locationId); }, ids.location);
    if (screen.role) await context.addCookies(['access_token', 'refresh_token', 'ekavyu_session'].map(name => ({ name, value: 'isolated-demo-session', domain: 'localhost', path: '/' })));
    await page.routeWebSocket('**/*', socket => socket.close());
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname === 'api.example.invalid') {
        const local = await fetch(api + url.pathname + url.search, { method: request.method() });
        return route.fulfill({ status: local.status, headers: Object.fromEntries(local.headers), body: await local.text() });
      }
      if ([origin, api].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (['ipwho.is', 'ipapi.co'].includes(url.hostname)) return route.fulfill({ json: { success: false }, headers: { 'Access-Control-Allow-Origin': '*' } });
      return route.abort();
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
    const response = await page.goto(origin + screen.route, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(text => document.querySelector('main')?.innerText.includes(text), screen.expected, { timeout: 60000 });
    if (screen.name === 'booking') {
      const dates = page.locator('#booking button').filter({ hasText: /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d/is });
      await dates.first().click();
      const time = page.locator('#booking button').filter({ hasText: /10:30/ });
      await time.first().click({ timeout: 20000 });
    }
    if (screen.name === 'whatsapp') await page.getByText('Recent message delivery', { exact: true }).click();
    await page.waitForTimeout(1000);
    const visibleText = await page.locator('main').innerText();
    if (response.status() !== 200 || errors.length || /Something went wrong|Unable to verify|could not be loaded/.test(visibleText)) throw new Error('Invalid source: ' + JSON.stringify({ screen, errors, unknown: [...unknown], text: visibleText.slice(0, 500) }));
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' }); });
    let box = await page.locator('main').boundingBox();
    if (screen.name === 'booking' && mobile) {
      await page.locator('#booking').scrollIntoViewIfNeeded();
      await page.evaluate(() => { const node = document.querySelector('#booking'); window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 70, behavior: 'instant' }); });
      box = { x: 0, y: 70, width: 420, height: 800 };
    }
    if (screen.name === 'whatsapp') {
      const target = mobile ? page.getByText('Recent message delivery', { exact: true }).locator('xpath=../..') : page.getByRole('heading', { name: 'Connection and delivery', exact: true }).locator('xpath=../..');
      await target.scrollIntoViewIfNeeded();
      await target.evaluate(node => { const main = node.closest('main'); main.scrollTop += node.getBoundingClientRect().top - main.getBoundingClientRect().top - 20; });
      box = await target.boundingBox();
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const publicClip = !screen.role && !(screen.name === 'booking' && mobile);
    const clip = publicClip ? { x: 0, y: 0, width: mobile ? 420 : 1040, height: 860 } : { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)), width: Math.min(Math.floor(box.width), mobile ? 420 : 1360), height: Math.min(800, Math.floor(box.height), 1000 - Math.max(0, Math.floor(box.y))) };
    const name = screen.name + (mobile ? '-mobile' : '-desktop');
    const png = await page.screenshot({ clip, animations: 'disabled' });
    const stats = await sharp(png).stats();
    if (stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) < 8) throw new Error('Blank screenshot: ' + name);
    await fs.writeFile(path.join(output, name + '.png'), png);
    const asset = await sharp(png).resize({ width: mobile ? 630 : 1200, withoutEnlargement: !mobile }).webp({ quality: 85, effort: 6 }).toBuffer();
    await fs.writeFile(path.join(assets, name + '.webp'), asset);
    const existing = captures.findIndex(capture => capture.name === name); if (existing >= 0) captures.splice(existing, 1);
    captures.push({ name, route: screen.route, role: screen.role || 'anonymous', viewport: page.viewportSize(), clip, asset: '/landing/product/' + name + '.webp', bytes: asset.length, sha256: createHash('sha256').update(png).digest('hex'), errors, consoleErrors, unknown: [...unknown], blockedWrites: blockedWrites.slice(writesStart), simulatedInitializations: simulatedInitializations.slice(initializationsStart), requests: [...new Set(reads)], visibleText: visibleText.slice(0, 2500) });
    console.log(JSON.stringify({ captured: name, bytes: asset.length, unknown: [...unknown] }));
    await context.close();
  }
} catch (error) { throw new Error(error.message + '\nPreview log: ' + logs.slice(-1800)); }
finally {
  await fs.writeFile(path.join(output, 'capture-provenance.json'), JSON.stringify({ capturedAt: new Date().toISOString(), tool: 'Playwright ' + requireTool('playwright-core/package.json').version, dataset: { source: 'landing-demo.mjs; entirely fictional, loopback only', clock: demoClock, doctors: doctors.length, patients: patients.length, appointments: appointments.length, invoices: invoices.length, locations: 2, storage: 'In-memory API responses; no database changes' }, captures, blockedWrites, simulatedInitializations }, null, 2));
  await browser?.close(); next.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
