// Synthetic saved documents only. No account, business API, printer spooler or database access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const browserTools = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const buildTools = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '../backend', 'tool.cjs'));
const { chromium } = browserTools('playwright-core'), { build } = buildTools('esbuild');
const output = path.resolve('.next/pharmacy-print-acceptance');
await fs.mkdir(output, { recursive: true });
// Exercise the real dashboard's print reset as well as the document CSS.
const globals = await fs.readFile('src/app/globals.css', 'utf8');
const printStart = globals.indexOf('@media print {'); assert(printStart >= 0);
let end = globals.indexOf('{', printStart), depth = 0;
do { if (globals[end] === '{') depth++; else if (globals[end] === '}') depth--; end++; } while (depth && end < globals.length);
assert.equal(depth, 0);
const palette = [...globals.matchAll(/--print-[\w-]+:\s*#[\da-f]{6};/gi)].map(match => match[0]).join('');
await fs.writeFile(path.join(output, 'global-print.css'), `:root{${palette}}\n${globals.slice(printStart, end)}`);
await build({ stdin: { contents: `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { flushSync } from 'react-dom';
  import { PharmacyInvoiceDocument } from './src/components/pharmacy/PharmacyInvoiceDocument';
  import classes from './src/components/pharmacy/PharmacyPrint.module.css';
  import { printElement } from './src/lib/printBrand';
  import { printOfflinePharmacyReceipt } from './src/lib/pharmacyOfflinePrint';
  import { canPrintPharmacyInvoice } from './src/lib/pharmacyInvoice';
  import { calculatePharmacyDocument } from './src/lib/generated/pharmacyCalculation';
  window.printProbe = { classes, printElement, printOfflinePharmacyReceipt, canPrintPharmacyInvoice, calculatePharmacyDocument,
    mount(invoice, thermal) {
      document.querySelector('#preview')?.remove();
      const wrapper = document.createElement('div'); wrapper.id = 'preview';
      wrapper.className = classes.paper + (thermal ? ' ' + classes.thermal : ''); document.body.append(wrapper);
      flushSync(() => createRoot(wrapper).render(React.createElement(PharmacyInvoiceDocument, { invoice })));
      return wrapper;
    }
  };
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
  outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent' });
const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET') { response.writeHead(405).end(); return; }
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Synthetic pharmacy print acceptance</title><link rel="stylesheet" href="/global-print.css"><link rel="stylesheet" href="/fixture.css"><script src="/fixture.js"></script>'); return;
  }
  const filename = new Map([['/fixture.js', [path.join(output, 'fixture.js'), 'text/javascript']], ['/fixture.css', [path.join(output, 'fixture.css'), 'text/css']], ['/global-print.css', [path.join(output, 'global-print.css'), 'text/css']], ['/offline.css', [path.resolve('public/pharmacy-offline.css'), 'text/css']]]).get(request.url);
  if (!filename) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': filename[1] }).end(await fs.readFile(filename[0]));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`, results = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext(), requests = [], errors = [];
  await context.route('**/*', route => { requests.push({ method: route.request().method(), url: route.request().url() }); return new URL(route.request().url()).origin === origin ? route.continue() : route.abort(); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.waitForFunction(() => Boolean(window.printProbe));
  await page.evaluate(() => {
    const lines = Array.from({ length: 48 }, (_, index) => ({ lineId: `line-${index}`, quantity: 2,
      unitPrice: { numeratorPaise: 1500 + index * 100, denominatorUnits: 1 }, gstRateBps: [0, 500, 1200, 1800][index % 4], lineDiscountPaise: 50 }));
    const calculation = window.printProbe.calculatePharmacyDocument({ policy: 'pharmacy-paise-v2', currency: 'INR', priceMode: 'inclusive', taxMode: 'sgst', lines, invoiceDiscountPaise: 100, roundOffPaise: -1 });
    const issuedAt = '2026-11-16T06:00:00.000Z', totals = calculation.totals;
    window.originalInvoice = {
      kind: 'pharmacy', createdBy: 'synthetic-operator', customerSnapshot: { anonymous: true }, documentVersion: 2, currency: 'INR',
      invoiceNumber: 'I00012627/000137', financialYear: '2026-27', issuedAt, status: 'paid', calculation,
      subtotal: totals.baseAmountPaise / 100, tax: (totals.cgstPaise + totals.sgstPaise) / 100, cgstTotal: totals.cgstPaise / 100, sgstTotal: totals.sgstPaise / 100,
      totalAmount: totals.payablePaise / 100, amountPaid: totals.payablePaise / 100, balanceDue: 0,
      taxDocument: { version: 2, kind: 'tax_invoice', issuedAt, signatureMode: 'manual_on_print', placeOfSupply: '24', reverseCharge: false,
        issuer: { legalName: 'SYNTHETIC ONLY — Long Name Pharmacy And Healthcare Supplies', address: 'Synthetic shop 402, a deliberately long street and locality, Valsad, Gujarat 396001',
          stateCode: '24', gstin: '24ABCDE1234F1Z5', registration: 'regular', drugLicenceNumbers: ['SYNTHETIC-20', 'SYNTHETIC-21'], authorisedSignatory: 'Synthetic pharmacist' },
        recipient: { name: 'Walk-in customer', stateCode: '24' } },
      items: calculation.lines.map((line, index) => ({ description: `Synthetic medicine ${String(index + 1).padStart(2, '0')} — long composition and manufacturer <img src=x onerror=alert(1)>`,
        quantity: line.quantity, amount: lines[index].unitPrice.numeratorPaise / 100, hsnSacCode: '300490', unitCode: 'NOS', gstRate: line.gstRateBps / 100,
        baseAmountPaise: line.baseAmountPaise, cgstPaise: line.cgstPaise, sgstPaise: line.sgstPaise, grossAmountPaise: line.grossAmountPaise,
        unitSnapshot: { baseUnit: 'tablet', packUnit: 'strip', unitsPerPack: 10 },
        batches: [{ batchNumber: 'SYNTHETIC-VERY-LONG-UNBROKEN-BATCH-REFERENCE-' + index, quantity: 2, expiryValue: '2099-12', expiryPrecision: 'month', mrpPaise: 10000, sellingPricePaise: lines[index].unitPrice.numeratorPaise }] }))
    };
    window.originalReceipt = { receipt: { invoice: window.originalInvoice, payment: { collectedPaise: totals.payablePaise, cashTenderedPaise: totals.payablePaise + 500, changePaise: 500 } } };
    window.beforePrint = JSON.stringify(window.originalReceipt); window.printCalls = 0;
    window.print = () => { window.printCalls++; };
    // Simulate the native dialog returning, retaining the frame for inspection.
    new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLIFrameElement && node.dataset.printFrame) node.contentWindow.print = () => { window.printCalls++; };
    } }).observe(document.body, { childList: true });
  });
  assert.equal(await page.evaluate(() => window.printProbe.canPrintPharmacyInvoice(window.originalInvoice)), true);
  for (const paper of ['A4', '80mm', '58mm']) {
    const started = performance.now();
    await page.evaluate(async paper => {
      const element = window.printProbe.mount(window.originalInvoice, paper !== 'A4');
      await window.printProbe.printElement(element, { title: window.originalInvoice.invoiceNumber, paper,
        css: paper === 'A4' ? '' : `html,body{width:calc(${paper} - 4mm)!important}` });
    }, paper);
    const frame = page.frames().find(candidate => candidate.parentFrame()); assert(frame, 'Print frame missing');
    await frame.waitForFunction(() => document.querySelector('article'));
    const captured = await frame.content();
    const rendered = await context.newPage();
    await rendered.goto(origin); await rendered.setContent(captured); await rendered.emulateMedia({ media: 'print' });
    const width = paper === 'A4' ? 718 : (Number.parseInt(paper) - 4) * 96 / 25.4;
    await rendered.setViewportSize({ width: Math.ceil(width), height: 1000 });
    const evidence = await inspect(rendered, width);
    assert.equal(evidence.rows, 48); assert.equal(evidence.batchRows, 48); assert.equal(evidence.images, 0);
    assert.equal(evidence.overflow.length, 0, JSON.stringify({ paper, overflow: evidence.overflow.slice(0, 8) }));
    const pdf = await rendered.pdf({ path: path.join(output, `saved-bill-${paper}.pdf`), ...(paper === 'A4' ? { format: 'A4' } : { width: paper, height: '297mm' }), margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' }, printBackground: true });
    const pages = verifyPdf(pdf, paper);
    await rendered.screenshot({ path: path.join(output, `saved-bill-${paper}.png`) }); await rendered.close();
    await page.evaluate(() => document.querySelector('iframe[data-print-frame]').contentWindow.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('iframe[data-print-frame]').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.originalReceipt) === window.beforePrint), true);
    results.push({ name: `Saved app document ${paper}: 48 items, mixed GST, discounts, long names/batches, isolated handoff and dialog cleanup`, passed: true, elapsedMs: Math.round(performance.now() - started), pages, ...evidence });
  }
  // Public cold-restart path uses its own committed-document renderer.
  const publicPage = await context.newPage();
  await publicPage.goto(origin); await publicPage.waitForFunction(() => Boolean(window.printProbe));
  await publicPage.locator('link[href="/global-print.css"]').evaluate(node => node.remove());
  await publicPage.addStyleTag({ url: `${origin}/offline.css` });
  const receipt = await page.evaluate(() => window.originalReceipt);
  for (const paper of ['A4', '80mm', '58mm']) {
  await publicPage.evaluate(({ receipt, paper }) => {
    window.syntheticNativeCalls = 0; window.print = () => { window.syntheticNativeCalls++; };
    window.printProbe.printOfflinePharmacyReceipt(receipt, paper); window.printProbe.printOfflinePharmacyReceipt(receipt, paper);
    let rejected = false;
    try { window.printProbe.printOfflinePharmacyReceipt({ receipt: { ...receipt.receipt, invoice: { ...receipt.receipt.invoice, totalAmount: 999999 } } }); } catch { rejected = true; }
    if (!rejected) throw Error('Malformed invoice reached native printing');
  }, { receipt, paper });
  const width = paper === 'A4' ? 703 : (Number.parseInt(paper) - 4) * 96 / 25.4;
  await publicPage.emulateMedia({ media: 'print' }); await publicPage.setViewportSize({ width: Math.ceil(width), height: 1000 });
  const publicEvidence = await inspect(publicPage, width);
  assert.equal(publicEvidence.images, 0); assert.equal(publicEvidence.overflow.length, 0, JSON.stringify(publicEvidence.overflow.slice(0, 8)));
  assert.equal(await publicPage.locator('#pharmacy-final-paper').count(), 1);
  assert.equal(await publicPage.locator('#pharmacy-final-paper tbody tr').count(), 48);
  assert.equal(await publicPage.evaluate(() => window.syntheticNativeCalls), 2);
  const publicPdf = await publicPage.pdf({ path: path.join(output, `restart-bill-${paper}.pdf`), ...(paper === 'A4' ? { format: 'A4' } : { width: paper, height: '297mm' }), printBackground: true });
  await publicPage.screenshot({ path: path.join(output, `restart-bill-${paper}.png`) });
  results.push({ name: `Public restart ${paper}: repeated handoff replaces the same committed paper; malformed evidence refused, literal product content and no horizontal clipping`, passed: true, pages: verifyPdf(publicPdf, paper), ...publicEvidence });
  }
  assert.deepEqual(errors, []);
  assert.equal(requests.some(request => request.method !== 'GET'), false);
  assert.equal(requests.some(request => new URL(request.url).origin !== origin), false);
  const report = { syntheticOnly: true, physicalPrinter: false, nativeDialogSimulated: true, financialWrites: false, results };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (failure) { console.error(failure); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

async function inspect(page, width) {
  return page.evaluate(width => {
    const paper = document.querySelector('article'), bounds = paper.getBoundingClientRect();
    const overflow = [...paper.querySelectorAll('*')].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && (rect.left < bounds.left - 1 || rect.right > bounds.left + width + 1);
    }).map(node => ({ tag: node.tagName, text: node.textContent.slice(0, 70), width: Math.round(node.getBoundingClientRect().width) }));
    for (const label of ['SYNTHETIC ONLY', 'I00012627/000137', '2099-12', '300490', 'Synthetic medicine 48']) {
      if (!paper.textContent.includes(label)) throw Error('Missing original paper content: ' + label);
    }
    const header = paper.querySelector('header');
    if (header && getComputedStyle(header).display === 'none') throw Error('Dashboard print reset hid issuer header');
    return { rows: paper.querySelectorAll('tbody tr:has([data-label="Product"])').length, batchRows: paper.querySelectorAll('[data-label="Batch details"]').length,
      images: paper.querySelectorAll('img, script, iframe').length, overflow };
  }, width);
}

function verifyPdf(buffer, paper) {
  const pdf = buffer.toString('latin1'), pages = (pdf.match(/\/Type \/Page\b/g) || []).length;
  assert(pages > 1, 'Long invoice should exercise multiple PDF pages');
  const box = pdf.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/); assert(box, 'PDF page dimensions missing');
  const expectedWidth = paper === 'A4' ? 210 : Number.parseInt(paper);
  assert(Math.abs(Number(box[1]) * 25.4 / 72 - expectedWidth) < 1, `Incorrect ${paper} PDF paper width`);
  return pages;
}
