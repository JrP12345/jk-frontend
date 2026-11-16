// Isolated Chrome acceptance for the real storage and print modules. No API/database access.
// Uses the same optional Playwright tooling as other performance scripts. Set
// PHARMACY_BROWSER_BUNDLER_ROOT to a tool directory with esbuild installed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireBrowser = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireBundler = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '.next/pharmacy-browser-tools', 'tool.cjs'));
const { chromium } = requireBrowser('playwright-core');
const { build } = requireBundler('esbuild');
const output = path.resolve('.next/pharmacy-browser-acceptance');
await fs.mkdir(output, { recursive: true });
await build({
  stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import * as drafts from './src/lib/pharmacyDrafts';
    import * as catalogue from './src/lib/pharmacyCatalogue';
    import * as journal from './src/lib/pharmacyCommandJournal';
    import * as branch from './src/lib/pharmacyBranchCatalogue';
    import * as printing from './src/lib/printBrand';
    import {canPrintPharmacyInvoice} from './src/lib/pharmacyInvoice';
    import {PharmacyInvoiceDocument} from './src/components/pharmacy/PharmacyInvoiceDocument';
    import styles from './src/components/pharmacy/PharmacyPrint.module.css';
    const root=createRoot(document.getElementById('root'));
    window.pharmacyAcceptance={...drafts,...catalogue,...journal,...branch,...printing,canPrintPharmacyInvoice,
      renderInvoice(invoice,thermal=false){root.render(<div className={styles.paper+' '+(thermal?styles.thermal:'')}><PharmacyInvoiceDocument invoice={invoice}/></div>);}
    };`, resolveDir: root, loader: 'tsx' },
  bundle: true, outfile: path.join(output, 'browser.js'), format: 'iife', platform: 'browser',
  jsx: 'automatic', alias: { '@': path.join(root, 'src') }, loader: { '.module.css': 'local-css' },
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated pharmacy acceptance</title><link rel="stylesheet" href="/browser.css"><style>:root{--print-text:#18232d;--print-secondary:#52606a;--print-muted:#52606a;--print-background:#ffffff;--print-surface:#ffffff;--print-surface-muted:#edf2f2;--print-border:#bdc9ce;--border:#bdc9ce}body{margin:0;background:white;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/browser.js"></script></body></html>';
const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET') { response.writeHead(405).end(); return; }
  const file = { '/browser.js': ['browser.js', 'text/javascript'], '/browser.css': ['browser.css', 'text/css'] }[request.url];
  if (file) { response.writeHead(200, { 'Content-Type': file[1] }); response.end(await fs.readFile(path.join(output, file[0]))); }
  else if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(html); }
  else response.writeHead(404).end();
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`, results = [], errors = [];
let browser;
async function check(name, work) {
  const started = performance.now();
  await work(); results.push({ name, passed: true, elapsedMs: Math.round(performance.now() - started) });
  console.log(JSON.stringify(results.at(-1)));
}
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const open = async () => { await page.goto(origin); await page.waitForFunction(() => Boolean(window.pharmacyAcceptance)); };
  await open();
  await check('Save intent is independent of a busy catalogue encryption task', async () => {
    const sample = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance;
      const cache = api.createPharmacyLocalClient('synthetic-owner', 'scheduling', 'catalogue-probe', value => value);
      const journal = api.createSaleJournal('synthetic-owner', 'scheduling');
      await cache.load(); await journal.load();
      const original = SubtleCrypto.prototype.encrypt;
      let entered, release, bulkFinished = false;
      const started = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      SubtleCrypto.prototype.encrypt = async function (...args) {
        if (args[2].byteLength > 100000) { entered(); await gate; }
        return original.apply(this, args);
      };
      const bulk = cache.save(Array.from({ length: 10000 }, (_, n) => ({ id: n, name: 'Synthetic catalogue entry' }))).then(() => { bulkFinished = true; });
      await started;
      const timer = setTimeout(release, 700), at = performance.now();
      try {
        const saved = await journal.save({ key: 'synthetic-scheduling-key', input: { locationId: 'scheduling', confirmationMode: 'current_total', expectedTotalPaise: 1500, invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: 'line', medicineId: 'a'.repeat(24), quantity: 1, expectedUnitVersion: 1, discountPaise: 0, expectedLineTotalPaise: 1500 }] } });
        return { intentMs: Math.round(performance.now() - at), completedBeforeCatalogue: !bulkFinished, durable: saved.durable };
      } finally { clearTimeout(timer); release(); await bulk; SubtleCrypto.prototype.encrypt = original; }
    });
    console.log(JSON.stringify({ probe: 'storage-scheduling', injectedCatalogueDelayMs: 700, ...sample }));
    assert.equal(sample.durable, true);
    if (!process.env.PHARMACY_STORAGE_BASELINE) assert.equal(sample.completedBeforeCatalogue, true, 'Catalogue work must not hold the Save intent queue');
  });
  await check('Encrypted disk draft write and data allowlist', async () => {
    const result = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance;
      await api.clearPharmacyDrafts();
      const product = { id: 'a'.repeat(24), name: 'Synthetic cotton', genericName: 'Cotton', eligible: true, stockQuantity: 10, retailPricePaise: 1500, unitDefinition: { version: 1, baseUnit: 'piece', packUnit: 'box', unitsPerPack: 10 } };
      const draft = { cart: { lines: [{ lineId: 'line', product, packs: '0', loose: '3', discount: '0' }], customerId: null, discount: '0', cashReceived: '100', personalDetails: 'NEVER-PERSIST-THIS' }, held: [] };
      const store = api.createPharmacyDraftClient('synthetic-owner', 'branch'); await store.load();
      const saved = await store.save(draft);
      const rows = await new Promise((resolve, reject) => {
        const request = indexedDB.open('ekavyu-pharmacy-drafts', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts'), get = tx.objectStore('drafts').getAll(); tx.oncomplete = () => { resolve(get.result); db.close(); }; };
      });
      return { durable: saved.durable, encrypted: rows.length === 1 && rows[0].ciphertext instanceof ArrayBuffer && !JSON.stringify(rows).includes('Synthetic cotton'), clean: !JSON.stringify(api.cleanCounterDraft(draft)).match(/NEVER-PERSIST|cashReceived|retailPricePaise/) };
    });
    assert.deepEqual(result, { durable: true, encrypted: true, clean: true });
  });
  await check('Disk draft survives document reload with the same session key', async () => {
    await open();
    const result = await page.evaluate(() => window.pharmacyAcceptance.createPharmacyDraftClient('synthetic-owner', 'branch').load());
    assert.equal(result.durable, true); assert.equal(result.value.cart.lines[0].loose, '3');
  });
  await check('Real IndexedDB rejects a stale concurrent writer', async () => {
    const conflict = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, first = api.createPharmacyDraftClient('synthetic-owner', 'branch'), second = api.createPharmacyDraftClient('synthetic-owner', 'branch');
      const value = (await first.load()).value; await second.load(); await first.save(value);
      try { await second.save(value); return false; } catch (error) { return error.message.includes('another tab'); }
    }); assert.equal(conflict, true);
  });
  await check('Exact paid intent survives reload without resubmitting any API command', async () => {
    await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, store = api.createSaleJournal('synthetic-owner', 'branch'); await store.load();
      await store.save({ key: 'synthetic-request-123', input: { locationId: 'branch', confirmationMode: 'current_total', expectedTotalPaise: 4500, invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: 'line', medicineId: 'a'.repeat(24), quantity: 3, expectedUnitVersion: 1, discountPaise: 0, expectedLineTotalPaise: 4500 }], payment: { locationId: 'branch', expectedPaymentRevision: 0, expectedBalancePaise: 4500, cashTenderedPaise: 10000, manualConfirmed: true, entries: [{ componentId: 'cash', amountPaise: 4500, paymentMethod: 'cash' }] } } });
    });
    await open();
    const result = await page.evaluate(() => window.pharmacyAcceptance.createSaleJournal('synthetic-owner', 'branch').load());
    assert.equal(result.durable, true); assert.equal(result.value.key, 'synthetic-request-123'); assert.equal(result.value.input.payment.cashTenderedPaise, 10000);
  });
  await check('10,000 products persist and restore from actual Chrome IndexedDB', async () => {
    const stored = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, cache = api.createPharmacyBranchCatalogue('synthetic-owner', 'branch'); await cache.load();
      const id = n => n.toString(16).padStart(24, '0');
      await cache.sync(async query => {
        const offset = query.after ? parseInt(query.after, 16) : 0;
        const items = Array.from({ length: 200 }, (_, n) => ({ id: id(offset + n + 1), name: `Synthetic medicine ${offset + n + 1}`, genericName: 'Synthetic ingredient', manufacturer: 'Example maker', eligible: true, stockQuantity: 10, retailPricePaise: 1500, barcodes: [`000${offset + n + 1}`], unitDefinition: { version: 1, baseUnit: 'tablet', packUnit: 'strip', unitsPerPack: 10 } }));
        return { version: 1, locationId: 'branch', after: query.after || null, through: id(10000), hash: id(offset + 1).padStart(64, '0'), count: 200, items, nextCursor: offset + 200 < 10000 ? id(offset + 200) : null };
      }, new AbortController().signal);
      return cache.status;
    });
    assert.equal(stored.complete, true); assert.equal(stored.durable, true); assert.equal(stored.count, 10000);
    await open();
    const restored = await page.evaluate(async () => { const cache = window.pharmacyAcceptance.createPharmacyBranchCatalogue('synthetic-owner', 'branch'); await cache.load(); return { status: cache.status, matches: cache.find('00010000', true).length }; });
    assert.equal(restored.status.complete, true); assert.equal(restored.status.durable, true); assert.equal(restored.status.count, 10000); assert.equal(restored.matches, 1);
  });
  await check('Bounded local search and chunked indexing under synthetic 4x CPU throttling', async () => {
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try {
      const sample = await page.evaluate(async () => {
        const Original = window.MessageChannel; let yields = 0;
        window.MessageChannel = class extends Original { constructor() { super(); yields++; } };
        const cache = window.pharmacyAcceptance.createPharmacyBranchCatalogue('synthetic-owner', 'branch');
        try { await cache.load(); } finally { window.MessageChannel = Original; }
        const durations = [];
        for (let n = 0; n < 30; n++) {
          const start = performance.now(), rows = cache.find('synthetic medicine', false, 25);
          if (rows.length !== 25) throw Error('Expected bounded first page');
          durations.push(performance.now() - start);
        }
        durations.sort((a, b) => a - b);
        const sparseAt = performance.now(), sparse = cache.find('medicine 10000', false, 25), sparseMs = performance.now() - sparseAt;
        return { products: cache.status.count, indexingYields: yields, resultLimit: 25, samples: durations.length,
          broadSearchP50Ms: durations[14], broadSearchP95Ms: durations[28], sparseSearchMs: sparseMs, sparseMatches: sparse.length,
          exactBarcodeMatches: cache.find('00010000', true, 2).length };
      });
      assert.equal(sample.products, 10000); assert.ok(sample.indexingYields >= 49); assert.equal(sample.exactBarcodeMatches, 1); assert.equal(sample.sparseMatches, 1);
      await fs.writeFile(path.join(output, 'synthetic-catalogue-performance.json'), JSON.stringify({ cpuThrottleRate: 4, actualOldPc: false, sample }, null, 2));
      console.log(JSON.stringify({ syntheticCataloguePerformance: sample }));
    } finally { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach(); }
  });
  await check('Injected quota failure reports memory-only storage and does not claim durability', async () => {
    const result = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { throw new DOMException('Injected quota failure', 'QuotaExceededError'); };
      try { const store = api.createPharmacyDraftClient('synthetic-owner', 'quota-branch'); await store.load(); return await store.save(api.emptyCounterDraft()); }
      finally { IDBObjectStore.prototype.put = put; }
    }); assert.equal(result.durable, false);
  });
  await check('Logout removes the encryption key and blocks stale writes', async () => {
    const result = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, old = api.createPharmacyDraftClient('synthetic-owner', 'branch'); await old.load();
      window.dispatchEvent(new Event('auth-logout'));
      let rejected = false; try { await old.save(api.emptyCounterDraft()); } catch { rejected = true; }
      const loaded = await api.createPharmacyDraftClient('new-owner', 'branch').load();
      return { rejected, empty: loaded.value === null };
    }); assert.deepEqual(result, { rejected: true, empty: true });
  });
  const item = { description: 'Synthetic long-name medicine for paper layout verification', quantity: 2, amount: 100, hsnSacCode: '300490', unitCode: 'NOS', gstRate: 5, baseAmountPaise: 20000, cgstPaise: 500, sgstPaise: 500, grossAmountPaise: 21000, unitSnapshot: { baseUnit: 'tablet', packUnit: 'strip', unitsPerPack: 10 }, batches: [{ batchNumber: 'SYNTHETIC-LOT', quantity: 2, expiryValue: '2099-12', expiryPrecision: 'month', mrpPaise: 12000, sellingPricePaise: 10500 }] };
  await check('Logout invalidates an in-flight encrypted write without blocking the new session', async () => {
    const result = await page.evaluate(async () => {
      const api = window.pharmacyAcceptance, old = api.createPharmacyDraftClient('new-owner', 'in-flight');
      await old.load();
      const original = SubtleCrypto.prototype.encrypt;
      let entered, release;
      const started = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
      SubtleCrypto.prototype.encrypt = async function (...args) { entered(); await gate; return original.apply(this, args); };
      const pending = old.save(api.emptyCounterDraft()).then(() => false, error => error.message.includes('workspace changed'));
      await started;
      const clearing = api.clearPharmacyDrafts();
      SubtleCrypto.prototype.encrypt = original;
      try {
        const fresh = api.createPharmacyDraftClient('fresh-owner', 'in-flight');
        const loaded = await fresh.load();
        const saved = await fresh.save(api.emptyCounterDraft());
        release(); await clearing;
        return { oldRejected: await pending, empty: loaded.value === null, durable: saved.durable, freshSurvives: (await api.createPharmacyDraftClient('fresh-owner', 'in-flight').load()).value !== null };
      } finally { release(); await pending; await clearing; SubtleCrypto.prototype.encrypt = original; }
    });
    assert.deepEqual(result, { oldRejected: true, empty: true, durable: true, freshSurvives: true });
  });
  const invoice = { invoiceNumber: 'I00012627/000001', documentVersion: 1, financialYear: '2026-27', issuedAt: '2026-11-15T06:30:00Z', status: 'paid', currency: 'INR', subtotal: 200, tax: 10, cgstTotal: 5, sgstTotal: 5, totalAmount: 210, amountPaid: 210, balanceDue: 0,
    taxDocument: { version: 1, kind: 'tax_invoice', issuedAt: '2026-11-15T06:30:00Z', signatureMode: 'manual_on_print', placeOfSupply: '27', reverseCharge: false, issuer: { legalName: 'Synthetic acceptance pharmacy', address: 'Fictional test address', gstin: '27ABCDE1234F1Z5', stateCode: '27', registration: 'regular', drugLicenceNumbers: ['SYNTHETIC-LICENCE'], authorisedSignatory: 'Synthetic signatory' }, recipient: { name: 'Walk-in customer', stateCode: '27' } }, items: [item] };
  for (const paper of ['A4', '80mm', '58mm']) await check(`Actual print lifecycle and PDF layout: ${paper}`, async () => {
    const bill = paper === 'A4' ? { ...invoice, items: Array.from({ length: 35 }, () => item), subtotal: 7000, tax: 350, cgstTotal: 175, sgstTotal: 175, totalAmount: 7350, amountPaid: 7350 } : invoice;
    assert.equal(await page.evaluate(bill => window.pharmacyAcceptance.canPrintPharmacyInvoice(bill), bill), true);
    await page.evaluate(({ bill, thermal }) => window.pharmacyAcceptance.renderInvoice(bill, thermal), { bill, thermal: paper !== 'A4' });
    await page.getByRole('article', { name: 'Issued pharmacy document' }).waitFor();
    await page.waitForFunction(count => document.querySelectorAll('tbody tr').length === count * 2, bill.items.length);
    const captured = await page.evaluate(async paper => {
      let calls = 0, content = '';
      const observer = new MutationObserver(() => {
        const frame = document.querySelector('iframe[data-print-frame]');
        if (frame) frame.contentWindow.print = () => { calls++; content = frame.contentDocument.documentElement.outerHTML; };
      }); observer.observe(document.body, { childList: true });
      try { await window.pharmacyAcceptance.printElement(document.querySelector('#root > div'), { title: 'Synthetic invoice', paper,
        css: paper === 'A4' ? 'thead{display:table-header-group}tfoot{display:table-footer-group}' : `html,body{width:calc(${paper} - 4mm)!important}` }); }
      finally { observer.disconnect(); document.querySelector('iframe[data-print-frame]')?.contentWindow.dispatchEvent(new Event('afterprint')); }
      return { calls, content, cleaned: !document.querySelector('iframe[data-print-frame]') };
    }, paper);
    assert.equal(captured.calls, 1, `${paper}: print invoked once`); assert.equal(captured.cleaned, true, `${paper}: frame cleanup`); assert.match(captured.content, /SYNTHETIC-LICENCE/);
    const paperPage = await context.newPage();
    try {
      await paperPage.goto(origin); await paperPage.setContent(captured.content); await paperPage.emulateMedia({ media: 'print' });
      const width = paper === 'A4' ? 718 : Math.round(parseInt(paper, 10) * 96 / 25.4);
      await paperPage.setViewportSize({ width, height: 1000 });
      assert.equal(await paperPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${paper}: no horizontal paper overflow`);
      assert.equal(await paperPage.locator('header').evaluate(el => getComputedStyle(el).display !== 'none'), true, `${paper}: issuer header visible`);
      assert.equal(await paperPage.locator('footer').evaluate(el => getComputedStyle(el).display !== 'none'), true, `${paper}: signature footer visible`);
      if (paper !== 'A4') assert.ok(await paperPage.locator('body').evaluate(el => el.getBoundingClientRect().width) <= (parseInt(paper, 10) - 4) * 96 / 25.4 + 1, `${paper}: content fits between roll margins`);
      const pdf = await paperPage.pdf({ path: path.join(output, `synthetic-invoice-${paper}.pdf`), ...(paper === 'A4' ? { format: 'A4' } : { width: paper, height: '500mm' }), printBackground: true, preferCSSPageSize: true });
      const pageCount = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
      assert.ok(paper === 'A4' ? pageCount > 1 : pageCount === 1, `${paper}: expected page count, got ${pageCount}`);
      await paperPage.screenshot({ path: path.join(output, `synthetic-invoice-${paper}.png`), fullPage: true });
    } finally { await paperPage.close(); }
  });
  assert.deepEqual(errors, []);
  await context.close();
} catch (error) {
  results.push({ name: 'Browser acceptance', passed: false, error: error.message }); process.exitCode = 1;
  console.error(error.message);
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic: true, realApiWrites: 0, browserErrors: errors, results, limitations: ['Headless local Chrome only; not physical printer acceptance.', 'Quota exhaustion is injected; not a real full-device quota measurement.', 'PDF export does not prove native print-dialog cancellation or paper output.'] }, null, 2));
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
