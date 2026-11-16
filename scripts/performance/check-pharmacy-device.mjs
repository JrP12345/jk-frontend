// Synthetic local server + actual component/WebCrypto/IndexedDB. No business API/DB calls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd(), output = path.resolve('.next/pharmacy-device-acceptance'), dist = path.resolve(process.env.PHARMACY_NUMBERING_DIST || '.next/pharmacy-numbering-build');
await fs.mkdir(output, { recursive: true });
const { build } = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '../backend', 'tool.cjs'))('esbuild');
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'))('playwright-core');
await build({ stdin: { contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {PharmacyOfflineDeviceSettings} from './src/components/pharmacy/PharmacyOfflineDeviceSettings';
import * as device from './src/lib/pharmacyOfflineDevice';import api from './src/lib/api';import {useAuthStore} from './src/store/authStore';
window.deviceLibrary=device;
async function call(url,input){const action=url.split('/offline-device')[1]?.split('?')[0]||'';const response=await fetch('/mock'+action,{method:input?'POST':'GET',headers:{'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});if(!response.ok)throw new Error(await response.text());return {data:{data:await response.json()}};}
api.get=url=>call(url);api.post=(url,input)=>call(url,input);
useAuthStore.setState({user:{id:'owner',name:'Synthetic owner',email:'owner@example.test',role:'admin',organization_id:'org',permissions:['MANAGE_ORGANIZATION']}});
function App(){const [busy,setBusy]=useState(false);return <main style={{maxWidth:640,margin:'24px auto',padding:20}}><h1>Designated pharmacy PC</h1><PharmacyOfflineDeviceSettings organizationId="org" locationId="branch" disabled={busy} onBusyChange={setBusy}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  outfile: path.join(output, 'browser.js'), alias: { '@': path.join(root, 'src') }, loader: { '.module.css': 'local-css' },
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://example.invalid/api' }) }, logLevel: 'silent' });
const assets = new Map();
for await (const file of fs.glob('static/**/*', { cwd: dist })) if ((await fs.stat(path.join(dist, file))).isFile()) assets.set('/_next/' + file.replaceAll('\\', '/'), path.join(dist, file));
const styles = [...assets.keys()].filter(file => file.endsWith('.css')); assert.ok(styles.length, 'Build the isolated app first');
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const signingKey = { id: crypto.createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'), jwk: pair.publicKey.export({ format: 'jwk' }) };
const date = new Date(Date.now() + 330 * 60000), year = date.getUTCFullYear(), start = date.getUTCMonth() >= 3 ? year : year - 1, financialYear = `${start}-${String(start + 1).slice(-2)}`;
const initial = { organizationId: 'org', locationId: 'branch', checkoutEnabled: false, financialYear, numberingRevision: 1, signingKey, device: null };
let state = initial, challenge, enrollmentCount = 0;
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map(url => `<link rel="stylesheet" href="${url}">`).join('')}<link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script src="/browser.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/mock')) {
      let input; if (req.method === 'POST') { const chunks = []; for await (const chunk of req) chunks.push(chunk); input = JSON.parse(Buffer.concat(chunks).toString()); }
      if (req.url === '/mock/challenge') {
        assert.equal(state.device, null); const key = input.publicKey;
        const keyFingerprint = crypto.createHash('sha256').update(JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y })).digest('hex');
        const challengeId = crypto.randomUUID(), expiresAt = new Date(Date.now() + 300000).toISOString();
        challenge = { ...initial, actorId: 'owner', deviceId: input.deviceId, challengeId, expiresAt, publicKey: key, keyFingerprint };
        challenge.context = JSON.stringify({ version: 1, purpose: 'ekavyu.pharmacy.device-enrollment.v1', organizationId: 'org', locationId: 'branch', actorId: 'owner', deviceId: input.deviceId, keyFingerprint, challengeId, nonce: crypto.randomBytes(32).toString('base64url'), expiresAt });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(challenge)); return;
      }
      if (req.url === '/mock/enroll') {
        const intent = { expectedRevision: input.expectedRevision, expectedNumberingRevision: input.expectedNumberingRevision, expectedFinancialYear: input.expectedFinancialYear, count: input.count, deviceName: input.deviceName, reviewReference: input.reviewReference, confirmed: input.confirmed };
        assert.equal(input.challengeId, challenge.challengeId);
        assert.ok(crypto.verify('sha256', Buffer.from(`ekavyu.pharmacy.device-enrollment.v1\n${challenge.context}\n${JSON.stringify(intent)}`), { key: crypto.createPublicKey({ key: challenge.publicKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(input.proof, 'base64url')));
        const payload = JSON.stringify({ version: 1, purpose: 'ekavyu.pharmacy.number-reservation.v1', checkoutEnabled: false, organizationId: 'org', locationId: 'branch', actorId: 'owner', deviceId: challenge.deviceId, keyFingerprint: challenge.keyFingerprint, enrollmentId: challenge.challengeId,
          lease: { id: challenge.challengeId, prefix: 'PJP/', financialYear, next: 137, last: 137 + input.count - 1, validFrom: new Date().toISOString(), validUntil: new Date(Math.min(Date.now() + 3600000, Date.UTC(start + 1, 2, 31, 18, 30) - 1)).toISOString(), format: { prefixTemplate: 'PJP/', digits: 4, resetPolicy: 'continuous', configurationRevision: 1 } } });
        state = { ...initial, device: { deviceId: challenge.deviceId, deviceName: input.deviceName, keyFingerprint: challenge.keyFingerprint, enrollmentId: challenge.challengeId, revision: 1, status: 'enrolled', payload, signature: crypto.sign('RSA-SHA256', Buffer.from(`ekavyu.pharmacy.number-reservation.v1\n${payload}`), pair.privateKey).toString('base64url'), signingKeyId: signingKey.id } }; enrollmentCount++;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(state)); return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(html); return; }
    const file = req.url === '/browser.js' || req.url === '/browser.css' ? path.join(output, req.url.slice(1)) : assets.get(req.url);
    if (!file) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' }).end(await fs.readFile(file));
  } catch (failure) { res.writeHead(500).end(failure.message); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`, profile = await fs.mkdtemp(path.join(output, 'chrome-profile-')), results = [], errors = [];
const launch = async () => {
  const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, viewport: { width: 900, height: 1100 }, args: ['--disable-background-networking', '--no-proxy-server'] });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  context.on('page', page => page.on('pageerror', error => errors.push(error.message))); return context;
};
let browser;
const check = async (name, work) => { await work(); results.push({ name, passed: true }); console.log(JSON.stringify(results.at(-1))); };
try {
  browser = await launch(); let page = await browser.newPage(); await page.goto(origin);
  await check('desktop enrollment proves browser key to Node and verifies signed reservation', async () => {
    await page.getByLabel('Billing PC name *').fill('Main PC'); await page.getByLabel('Invoice numbers to reserve *').fill('3'); await page.getByLabel('Enrollment review reference *').fill('Synthetic review');
    await page.getByText("I confirm this is the branch's designated billing PC", { exact: true }).click();
    await page.getByRole('button', { name: 'Enroll this PC & reserve numbers', exact: true }).click(); await page.getByText(/This browser is enrolled/).waitFor();
    assert.equal(enrollmentCount, 1); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'device-900.png'), fullPage: true });
  });
  const deviceId = await page.evaluate(async () => (await window.deviceLibrary.browserDevice({ organizationId: 'org', locationId: 'branch' })).deviceId);
  await check('non-extractable key and confirmed reservation survive reload', async () => {
    await page.reload(); await page.getByText(/This browser is enrolled/).waitFor();
    const value = await page.evaluate(async () => {
      const scope = { organizationId: 'org', locationId: 'branch' }, device = await window.deviceLibrary.browserDevice(scope); let exportFailed = false;
      try { await crypto.subtle.exportKey('jwk', device.privateKey); } catch { exportFailed = true; }
      return { exportFailed, pending: await window.deviceLibrary.readPendingEnrollment(scope), id: device.deviceId };
    }); assert.equal(value.id, deviceId); assert.equal(value.exportFailed, true); assert.equal(value.pending, null); assert.equal(enrollmentCount, 1);
  });
  await check('mobile existing enrollment has no horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 1100 }); await page.getByText(/This browser is enrolled/).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, 'device-390.png'), fullPage: true });
  });
  await check('actual browser-process restart retains the same private device identity', async () => {
    await browser.close(); browser = await launch(); page = await browser.newPage(); await page.goto(origin); await page.getByText(/This browser is enrolled/).waitFor();
    assert.equal(await page.evaluate(async () => (await window.deviceLibrary.browserDevice({ organizationId: 'org', locationId: 'branch' })).deviceId), deviceId); assert.equal(enrollmentCount, 1);
  });
  await check('competing tabs create only one identity and return isolated objects', async () => {
    const other = await browser.newPage(); await other.goto(origin); await other.getByText(/This browser is enrolled/).waitFor();
    const create = page => page.evaluate(async () => (await window.deviceLibrary.browserDevice({ organizationId: 'org', locationId: 'race' }, true)).deviceId);
    const [a, b] = await Promise.all([create(page), create(other)]); assert.equal(a, b);
    const isolated = await page.evaluate(async () => { const scope = { organizationId: 'org', locationId: 'race' }; const found = await window.deviceLibrary.browserDevice(scope); found.deviceId = 'changed'; return (await window.deviceLibrary.browserDevice(scope)).deviceId; }); assert.equal(isolated, a); await other.close();
  });
  await check('durable pending enrollment rejects overwrite and cancellation clears only matching reference', async () => {
    const value = await page.evaluate(async () => {
      const lib = window.deviceLibrary, scope = { organizationId: 'org', locationId: 'pending' }, pending = { actorId: 'owner', request: { challengeId: 'original' } };
      await lib.savePendingEnrollment(scope, pending); let rejected = false; try { await lib.savePendingEnrollment(scope, { ...pending, actorId: 'other' }); } catch { rejected = true; }
      await lib.clearCancelledEnrollment(scope, 'different'); const retained = await lib.readPendingEnrollment(scope); await lib.clearCancelledEnrollment(scope, 'original');
      return { rejected, retained: retained.request.challengeId, cleared: await lib.readPendingEnrollment(scope) };
    }); assert.deepEqual(value, { rejected: true, retained: 'original', cleared: null });
  });
  await check('quota/write failure creates no RAM-only identity and no uncaught error', async () => {
    const value = await page.evaluate(async () => {
      const add = IDBObjectStore.prototype.add, scope = { organizationId: 'org', locationId: 'quota' }; let rejected = false;
      IDBObjectStore.prototype.add = function (...args) { if (this.name === 'devices') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return add.apply(this, args); };
      try { await window.deviceLibrary.browserDevice(scope, true); } catch { rejected = true; } finally { IDBObjectStore.prototype.add = add; }
      return { rejected, stored: await window.deviceLibrary.browserDevice(scope) };
    }); assert.deepEqual(value, { rejected: true, stored: null });
  });
  await check('independent browser profile cannot silently replace an enrolled PC', async () => {
    const other = await browser.browser().newContext({ viewport: { width: 390, height: 1000 } }); await other.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const second = await other.newPage(); await second.goto(origin); await second.getByText(/Another browser is enrolled/).waitFor();
    assert.equal(await second.getByLabel('Billing PC name *').count(), 0); assert.equal(enrollmentCount, 1); await other.close();
  });
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ syntheticOnly: true, results }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
