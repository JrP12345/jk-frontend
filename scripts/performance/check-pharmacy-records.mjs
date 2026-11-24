// Actual components in Chrome; all patient, supplier and storage responses are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/supplier-tools', 'tool.cjs'))('playwright-core');
const { build } = createRequire(path.resolve('../backend', 'tool.cjs'))('esbuild');
const output = path.resolve('.next/pharmacy-records-acceptance'); await fs.mkdir(output, { recursive: true });
const branch = '1'.repeat(24), product = '2'.repeat(24), supplier = '3'.repeat(24), invoice = '4'.repeat(24), rx = '5'.repeat(24), file = '6'.repeat(24);
await fs.writeFile(path.join(output, 'api.ts'), `export const getApiUrl=()=>location.origin+'/api';export default{async get(path,options){const url=new URL('/api'+path,location.origin);for(const[k,v]of Object.entries(options?.params||{}))url.searchParams.set(k,String(v));url.searchParams.set('variant',window.recordsProbe.mode);const response=await fetch(url,{signal:options?.signal});if(!response.ok)throw Error('Synthetic read failed');return{data:await response.json()}}};`);
await build({ stdin: { contents: `
import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{ToastProvider}from'./src/components/ui';import{useAuthStore}from'./src/store/authStore';
import{PharmacySupplierRates}from'./src/components/pharmacy/PharmacySupplierRates';import{PharmacyRegister}from'./src/components/pharmacy/PharmacyRegister';import{PharmacyPrescriptionAttachments}from'./src/components/pharmacy/PharmacyPrescriptionAttachments';
import{PharmacyFileHistory}from'./src/components/pharmacy/PharmacyFileHistory';
import{PharmacyStaffGuide}from'./src/components/pharmacy/PharmacyStaffGuide';import{pharmacyActions}from'./src/lib/pharmacyCapabilities';
const guideCapabilities=mode=>({locationId:'${branch}',enabled:true,moduleEnabled:true,mode:'configured',revision:1,inventoryMode:mode==='guide_billing_only'?'billing_only':'tracked',actions:{...Object.fromEntries(pharmacyActions.map(action=>[action,mode==='guide_owner'])),sell:true,collect:true,viewTill:true,...(mode==='guide_owner'?{viewPurchases:true,processReturn:true,viewReports:true}:{})}});
useAuthStore.setState({user:{id:'synthetic-owner',name:'Owner',email:'owner@example.test',role:'admin',organization_id:'synthetic-org',permissions:['MANAGE_ORGANIZATION']}});
const root=createRoot(document.getElementById('root'));window.recordsProbe={mode:'',mount(mode){this.mode=mode;this.selected=null;flushSync(()=>root.render(<ToastProvider key={mode}>{mode.startsWith('guide')?<PharmacyStaffGuide capabilities={guideCapabilities(mode)} onNavigate={id=>window.recordsProbe.selected=id}/>:mode.startsWith('rates')?<PharmacySupplierRates locationId='${branch}' onInvoice={id=>window.recordsProbe.selected=id}/>:mode.startsWith('register')?<PharmacyRegister locationId='${branch}' canExport={mode!=='register_read_only'}/>:mode.startsWith('history')?<PharmacyFileHistory locationId='${branch}' canManage={mode!=='history_read_only'}/>:<PharmacyPrescriptionAttachments locationId='${branch}' prescriptionId='${rx}' canUpload/>}</ToastProvider>))}};
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}', 'process.browser': 'true' }, outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent', plugins: [{ name: 'synthetic-api', setup(plugin) { plugin.onResolve({ filter: /^(?:@\/lib\/api|\.\/api)$/ }, args => args.path === '@/lib/api' || /[/\\]src[/\\]lib[/\\]/.test(args.importer) ? { path: path.join(output, 'api.ts') } : undefined); } }] });
let cssRoot;
for (const candidate of ['.next/supplier-verification/static/chunks', '.next/pharmacy-ux-audit/static/chunks', '.next/vercel-origin-verification/static/chunks', '.next/static/chunks']) {
  try { if ((await fs.readdir(candidate)).some(name => name.endsWith('.css'))) { cssRoot = candidate; break; } } catch { /* next existing build */ }
}
assert(cssRoot, 'Existing built shared CSS is required');
await fs.writeFile(path.join(output, 'global.css'), (await Promise.all((await fs.readdir(cssRoot)).filter(name => name.endsWith('.css')).map(name => fs.readFile(path.join(cssRoot, name), 'utf8')))).join('\n'));
const errors = [], external = [], requests = [], results = [];
const record = { _id: file, organizationId: supplier, locationId: branch, medicineName: 'Synthetic H1 medicine', scheduleType: 'schedule_h1', batchNumber: 'BATCH-001', quantityDispensed: 3, dispensedAt: '2026-11-23T10:00:00Z', patientName: 'Synthetic recipient', patientAddress: 'Synthetic recipient address', doctorName: 'Synthetic prescriber', doctorRegNumber: 'SYNTHETIC-RMP', dispensedByName: 'Synthetic pharmacist', pharmacistRegNumber: 'SYNTHETIC-PHARM', requiresReview: true, missingEvidence: ['doctorAddress'] };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); requests.push({ method: req.method, path: url.pathname });
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const mode = url.searchParams.get('variant'); let body;
    const custody = { revision: 2, state: mode === 'history_purged' ? 'purged' : mode === 'history_pending' ? 'purging' : 'retained', retainUntil: '2026-01-01T00:00:00.000Z', legalHold: mode === 'history_hold', pendingUploads: 0, purgedAt: mode === 'history_purged' ? '2026-11-23T11:00:00.000Z' : null };
    if (url.pathname === '/api/pharmacy/purchase-products') body = { data: { items: [{ id: product, name: 'Synthetic tablets', unitDefinition: { version: 1, baseUnit: 'tablet', packUnit: 'strip', unitsPerPack: 10 } }], nextCursor: null } };
    else if (url.pathname === '/api/pharmacy/supplier-rates') body = { data: { locationId: branch, medicineId: product, productName: 'Synthetic tablets', currency: 'INR', timezone: 'Asia/Kolkata', asOf: '2026-11-23T10:00:00Z', startDate: '2025-11-23', endDate: '2026-11-23', basis: 'net_excluding_gst', sourcePurchases: 1, note: 'Historical invoice rates, not current quotes.', items: [{ supplierId: supplier, supplierName: 'Synthetic supplier', purchaseId: invoice, invoiceNumber: 'SYNTHETIC-BILL', invoiceDate: '2026-10-21', costTreatment: 'exclude_tax', baseUnit: 'tablet', unitVersion: 1, billedUnits: 3, freeUnits: 2, netPaise: 80, grossPaise: 94, receivedUnits: 0, state: mode === 'rates_units' ? 'needs_review' : 'comparable', note: 'Free quantities are included; delivery is separate.' }] } };
    else if (url.pathname === '/api/pharmacy/schedule-h1-register') body = { data: [record], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
    else if (url.pathname === '/api/pharmacy/schedule-h1-register/export') body = { data: { locationId: branch, scheduleType: 'schedule_h1', generatedAt: '2026-11-23T11:00:00Z', filters: { startDate: null, endDate: null, search: '' }, totalRecords: 1, records: [record] } };
    else if (url.pathname === '/api/pharmacy/prescription-files') body = { data: { locationId: branch, uploadsAvailable: true, items: [{ id: file, name: 'synthetic-original.pdf', contentType: 'application/pdf', size: 2048, sha256: 'a'.repeat(64), state: 'attached', attachedAt: '2026-11-23T10:00:00Z', sourceKind: 'clinic', prescriptionId: rx, createdAt: '2026-11-23T10:00:00Z', custody }], nextCursor: null } };
    else if (url.pathname === `/api/pharmacy/prescription-files/${file}/custody`) body = { data: { ...custody, locationId: branch, fileId: file, policyReference: 'Synthetic approved retention policy', reviewReference: 'Synthetic record review', holdReason: mode === 'history_hold' ? 'Synthetic actual legal hold' : '', removal: mode === 'history_pending' ? { key: 'synthetic-original-removal', input: { locationId: branch, expectedRevision: 1, confirmedIrreversibleRemoval: true, reviewReference: 'Synthetic removal approval' } } : null } };
    else if (url.pathname.endsWith('/files')) body = { data: { sourceKind: 'outside', locationId: branch, prescriptionId: rx, uploadsAvailable: mode !== 'files_unavailable', items: [{ id: file, name: 'synthetic-original.pdf', contentType: 'application/pdf', size: 2048, sha256: 'a'.repeat(64), state: mode === 'files_pending' ? 'pending' : 'attached', attachedAt: mode === 'files_pending' ? null : '2026-11-23T10:00:00Z', custody: { revision: 2, state: 'retained', retainUntil: null, legalHold: false, pendingUploads: 0, purgedAt: null } }] } };
    else { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body)); return;
  }
  const staticFile = { '/fixture.js': ['fixture.js', 'text/javascript'], '/fixture.css': ['fixture.css', 'text/css'], '/global.css': ['global.css', 'text/css'] }[url.pathname];
  if (staticFile) { res.writeHead(200, { 'Content-Type': staticFile[1] }).end(await fs.readFile(path.join(output, staticFile[0]))); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:var(--surface);color:var(--text-primary);font-family:Arial,sans-serif}*{box-sizing:border-box}#root{max-width:1100px;margin:auto}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`; let browser, page;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext({ acceptDownloads: true }); await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); external.push(url.origin); return route.abort(); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin); await page.waitForFunction(() => Boolean(window.recordsProbe));
    for (const mode of (process.env.PHARMACY_RECORD_MODES?.split(',') || ['rates', 'rates_units', 'register', 'register_read_only', 'files', 'files_pending', 'files_unavailable', 'history_read_only', 'history_hold', 'history_pending', 'history_purged', 'guide_owner', 'guide_cashier', 'guide_billing_only'])) {
      await page.evaluate(mode => window.recordsProbe.mount(mode), mode);
      if (mode.startsWith('guide')) {
        const before = requests.filter(row => row.path.startsWith('/api/')).length;
        await page.getByText('First-day and daily staff guide', { exact: true }).click();
        await page.getByText('Busy counter: five medicines and three loose tablets', { exact: true }).click();
        await page.getByRole('button', { name: 'Open Counter sale', exact: true }).click(); assert.equal(await page.evaluate(() => window.recordsProbe.selected), 'counter');
        await page.getByText('Internet failure: recover safely', { exact: true }).click(); await page.getByText(/Shared LAN offline billing across two counters is not available/).waitFor();
        if (mode === 'guide_owner') { await page.getByText('Expiry return: 20 strips across three suppliers', { exact: true }).click(); await page.getByRole('button', { name: 'Open Finance & dues', exact: true }).click(); assert.equal(await page.evaluate(() => window.recordsProbe.selected), 'finance'); await page.getByText("End of day: the owner's 10 PM check", { exact: true }).click(); await page.getByText(/It is not net profit/).waitFor(); }
        else assert.equal(await page.getByText("End of day: the owner's 10 PM check", { exact: true }).count(), 0);
        if (mode === 'guide_billing_only') { await page.getByText(/This branch does not track stock or batches/).waitFor(); assert.equal(await page.getByText('Expiry return: 20 strips across three suppliers', { exact: true }).count(), 0); }
        const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download your daily staff guide', exact: true }).click(); const downloaded = await downloading; assert.equal(downloaded.suggestedFilename(), 'ekavyu-pharmacy-staff-guide.txt'); const text = await fs.readFile(await downloaded.path(), 'utf8'); assert(text.includes('DAILY STAFF CHECKLIST')); assert(!text.includes('synthetic-org')); assert.equal(requests.filter(row => row.path.startsWith('/api/')).length, before);
      } else if (mode.startsWith('rates')) {
        await page.getByRole('button', { name: 'Find medicine', exact: true }).click(); await page.getByRole('button', { name: 'Compare Synthetic tablets', exact: true }).click(); await page.getByRole('button', { name: 'Load supplier comparison', exact: true }).click(); await page.getByRole('region', { name: 'Reviewed supplier rates', exact: true }).waitFor();
        await page.getByText(mode === 'rates_units' ? 'Unit review required — excluded from ranking' : 'Net ₹0.1600 / tablet', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Open source invoice SYNTHETIC-BILL', exact: true }).click(); assert.equal(await page.evaluate(() => window.recordsProbe.selected), invoice);
      } else if (mode.startsWith('register')) {
        await page.getByRole('button', { name: 'Load register', exact: true }).click(); await page.getByRole('region', { name: 'Reviewed register page', exact: true }).waitFor(); await page.getByText('Captured evidence needs review', { exact: true }).waitFor();
        if (mode === 'register_read_only') assert.equal(await page.getByRole('button', { name: 'Export all matching register records', exact: true }).count(), 0);
        else { await page.getByText('I reviewed the branch, register and filters and will keep the exported patient records secure', { exact: true }).click(); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export all matching register records', exact: true }).click(); const saved = await download; assert(saved.suggestedFilename().startsWith('pharmacy-schedule_h1-')); await page.getByText(/Exported 1 records matching these filters/).waitFor(); }
      } else if (mode.startsWith('history')) {
        await page.getByRole('button', { name: 'Load prescription file history', exact: true }).click(); await page.getByRole('heading', { name: 'synthetic-original.pdf', exact: true }).waitFor();
        if (mode === 'history_read_only') assert.equal(await page.getByText('Retention, legal hold and file removal', { exact: true }).count(), 0);
        else { await page.getByText('Retention, legal hold and file removal', { exact: true }).click(); await page.getByRole('button', { name: 'Load file custody', exact: true }).click(); await page.getByText(/State: retained|State: purging|State: purged/).waitFor(); }
        if (mode === 'history_hold') { await page.getByText('Actual legal hold reason', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Remove retained file bytes', exact: true }).count(), 0); }
        if (mode === 'history_pending') { assert.equal(await page.getByRole('button', { name: 'Retry original file removal', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Download historical file synthetic-original.pdf', exact: true }).count(), 0); }
        if (mode === 'history_purged') { await page.getByText('File bytes removed; audit record retained', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Download historical file synthetic-original.pdf', exact: true }).count(), 0); }
      } else {
        await page.getByRole('button', { name: 'Load prescription files', exact: true }).click(); await page.getByText('synthetic-original.pdf', { exact: true }).waitFor();
        if (mode === 'files_pending') { await page.getByText(/Pending — retry with the original file/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Download synthetic-original.pdf', exact: true }).count(), 0); }
        if (mode === 'files_unavailable') await page.getByText('Private file storage unavailable', { exact: true }).waitFor();
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${mode} overflows at ${width}px`); results.push({ width, mode, documentOverflow: false });
      if (width === 390 && ['rates', 'register', 'files', 'history_hold', 'history_pending', 'history_purged', 'guide_owner', 'guide_cashier', 'guide_billing_only'].includes(mode)) await page.screenshot({ path: path.join(output, `${mode}-390.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(requests.some(row => row.method !== 'GET'), false);
  const report = { syntheticApi: true, externalProviderCalls: false, businessDatabaseWrites: false, browser: await browser.version(), results, requests: requests.length }; await fs.writeFile(path.join(output, process.env.PHARMACY_RECORD_MODES ? 'selected-results.json' : 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks: results.length, browser: report.browser, externalProviderCalls: false, businessDatabaseWrites: false }));
} catch (failure) { if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error(failure); console.error(JSON.stringify({ errors, external })); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
