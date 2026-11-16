// Built-app checkout acceptance against intercepted, synthetic API contracts only.
// Prerequisite: the isolated .next/pharmacy-acceptance-build build described in the audit.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fixture, ids, users } from './landing-demo.mjs';
import { drawerFixture } from '../../src/tests/fixtures/pharmacyDrawer.ts';
import { pharmacyActions } from '../../src/lib/pharmacyCapabilities.ts';

const requireBrowser = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const { chromium } = requireBrowser('playwright-core');
const origin = 'http://localhost:3127', output = path.resolve('.next/pharmacy-checkout-acceptance');
await fs.mkdir(output, { recursive: true });
const buildDirectory = path.resolve(process.env.PHARMACY_CHECKOUT_DIST || '.next/pharmacy-acceptance-build');
if (path.relative(process.cwd(), buildDirectory).startsWith('..') || path.isAbsolute(path.relative(process.cwd(), buildDirectory))) throw Error('Preview build must be inside this workspace.');
const standalone = path.join(buildDirectory, 'standalone');
await fs.access(path.join(standalone, 'server.js'));
// Next's standalone package intentionally excludes these assets; stage them as deployment does.
await fs.cp('public', path.join(standalone, 'public'), { recursive: true });
await fs.cp(path.join(buildDirectory, 'static'), path.join(standalone, path.relative(process.cwd(), buildDirectory), 'static'), { recursive: true });
const user = { ...users.admin, permissions: [...new Set([...users.admin.permissions, 'MANAGE_MEDICINES', 'MANAGE_ORGANIZATION'])], workspaceProfile: 'pharmacy', twoFactorEnabled: true, mfaEnrollmentRequired: false };
const branch = { id: ids.location, organizationId: ids.org, name: 'Synthetic acceptance pharmacy', city: 'Valsad', facilityType: 'pharmacy', isActive: true };
const actions = [...pharmacyActions, 'viewPurchases', 'managePurchases', 'viewSales', 'sell', 'collect', 'viewReturns', 'processReturn', 'approveReturn', 'settle', 'viewSettlements', 'openingBalances', 'viewTill', 'openTill', 'closeTill', 'moveTillCash', 'viewReports', 'transferStock'];
const capabilities = { locationId: ids.location, organizationId: ids.org, revision: 1, enabled: true, moduleEnabled: true, mode: 'configured', commercialEntitlement: 'active', importKinds: ['catalogue'], actions: Object.fromEntries(actions.map(key => [key, !['viewRxQueue', 'dispense', 'recoverDispense'].includes(key)])) };
const product = { id: 'e'.repeat(24), locationId: ids.location, name: 'Synthetic cotton', genericName: 'Cotton', strength: '25 g', rackLocation: 'A2', eligible: true, stockQuantity: 100, retailPricePaise: 1500, price: 15, scheduleType: 'general', barcodes: ['000123'], unitDefinition: { version: 1, baseUnit: 'piece', packUnit: 'box', unitsPerPack: 10 } };
const customer = { id: 'c'.repeat(24), name: 'Synthetic customer', address: 'Fictional address', phone: '9000000001', revision: 1 };
const drawer = { ...drawerFixture, locationId: ids.location, organizationId: ids.org, cashierId: user.id, drawerCode: 'SYNTHETIC-COUNTER' };
const envelope = data => ({ success: true, data });
const publicResult = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'documentForRead'));
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type,authorization,idempotency-key' };
const results = [];
let browser, logs = '';
const preview = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HOSTNAME: 'localhost', PORT: '3127', NEXT_PUBLIC_API_URL: 'https://api.example.invalid/api', NEXT_PUBLIC_BACKEND_URL: 'https://api.example.invalid', BACKEND_INTERNAL_URL: 'http://127.0.0.1:5129', NEXT_TELEMETRY_DISABLED: '1' },
});
preview.stdout.on('data', value => { logs = (logs + value).slice(-5000); }); preview.stderr.on('data', value => { logs = (logs + value).slice(-5000); });

function quote(input, rate) {
  const total = input.lines.reduce((sum, line) => sum + line.quantity * rate - line.discountPaise, 0) - input.invoiceDiscountPaise;
  return { locationId: ids.location, currency: 'INR', quoteHash: 'a'.repeat(64), customer: input.customerId ? customer : null,
    issueInput: { ...input, expectedQuoteHash: 'a'.repeat(64), expectedProfileRevision: 1, expectedTotalPaise: total, ...(input.customerId ? { expectedCustomerRevision: 1 } : {}), lines: input.lines.map(line => ({ ...line, expectedStockRevision: 1 })) },
    calculation: { policy: 'pharmacy-paise-v2', lines: input.lines.map((line, index) => ({ lineId: line.lineId, quantity: line.quantity, grossAmountPaise: line.quantity * rate - line.discountPaise - (index === 0 ? input.invoiceDiscountPaise : 0), gstRateBps: 0 })), totals: { payablePaise: total, baseAmountPaise: total, cgstPaise: 0, sgstPaise: 0, lineDiscountPaise: input.lines.reduce((sum, line) => sum + line.discountPaise, 0), invoiceDiscountPaise: input.invoiceDiscountPaise, roundOffPaise: 0 } },
    lines: input.lines.map(line => ({ ...line, description: product.name, unitSnapshot: { baseUnit: 'piece' }, batches: [{ batchNumber: 'SYNTHETIC-LOT', quantity: line.quantity, expiryValue: '2099-12', sellingPricePaise: rate, mrpPaise: 2000 }] })) };
}
function savedResult(input, key, sequence, rate) {
  const invoiceId = sequence.toString(16).padStart(24, '0'), invoiceNumber = `I00012627/${String(sequence).padStart(6, '0')}`;
  const paidAt = new Date().toISOString(), paid = Boolean(input.payment), total = input.expectedTotalPaise;
  const collection = paid ? { receiptId: 'f'.repeat(24), invoiceId, invoiceNumber, locationId: ids.location, currency: 'INR', actorId: user.id, shiftId: drawer.id, drawerCode: drawer.drawerCode, paidAt, collectedPaise: total, paidPaise: total, balancePaise: 0, creditedPaise: 0, revision: 1, cashTenderedPaise: input.payment.cashTenderedPaise, cashChangePaise: input.payment.cashTenderedPaise - input.payment.entries.filter(entry => entry.paymentMethod === 'cash').reduce((sum, entry) => sum + entry.amountPaise, 0), status: 'paid', evidenceMode: 'staff_confirmed_manual', entries: input.payment.entries, requestKey: key } : undefined;
  const document = { id: invoiceId, locationId: ids.location, kind: 'pharmacy', createdBy: user.id, customerSnapshot: input.customerId ? { anonymous: false, partyId: input.customerId, name: customer.name } : { anonymous: true }, invoiceNumber, documentVersion: 2, financialYear: '2026-27', issuedAt: paidAt, status: paid ? 'paid' : 'unpaid', currency: 'INR', paymentRevision: paid ? 1 : 0, totalAmount: total / 100, subtotal: total / 100, tax: 0, cgstTotal: 0, sgstTotal: 0, amountPaid: paid ? total / 100 : 0, balanceDue: paid ? 0 : total / 100,
    calculation: { policy: 'pharmacy-paise-v2', priceMode: 'inclusive', taxMode: 'none', currency: 'INR', totals: { lineDiscountPaise: input.lines.reduce((sum, line) => sum + line.discountPaise, 0), invoiceDiscountPaise: input.invoiceDiscountPaise, roundOffPaise: 0, grossAmountPaise: total, payablePaise: total } },
    taxDocument: { version: 2, kind: 'ordinary_bill', issuedAt: paidAt, signatureMode: 'manual_on_print', placeOfSupply: '24', reverseCharge: false, issuer: { legalName: branch.name, address: 'Fictional test premises', stateCode: '24', registration: 'unregistered', drugLicenceNumbers: ['SYNTHETIC-LICENCE'], authorisedSignatory: 'Synthetic signatory' }, recipient: { name: input.customerId ? customer.name : 'Walk-in customer', stateCode: '24' } },
    items: input.lines.map((line, index) => { const gross = line.quantity * rate - line.discountPaise - (index === 0 ? input.invoiceDiscountPaise : 0); return { description: product.name, quantity: line.quantity, amount: gross / line.quantity / 100, hsnSacCode: '300590', unitCode: 'NOS', gstRate: 0, baseAmountPaise: gross, cgstPaise: 0, sgstPaise: 0, grossAmountPaise: gross, unitSnapshot: product.unitDefinition, batches: [{ batchNumber: 'SYNTHETIC-LOT', quantity: line.quantity, expiryValue: '2099-12', expiryPrecision: 'month', sellingPricePaise: rate, mrpPaise: 2000 }] }; }) };
  return { invoiceId, dispenseId: 'd'.repeat(24), invoiceNumber, totalPaise: total, status: paid ? 'paid' : 'unpaid', requestKey: key, ...(collection ? { collection } : {}), ...(input.includeDocument ? { document } : {}), documentForRead: document };
}
async function session(width, mode = 'normal') {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
  await context.addCookies([{ name: 'ekavyu_session', value: 'synthetic-session', domain: 'localhost', path: '/' }]);
  await context.addInitScript(id => {
    localStorage.setItem('ekavyu_active_location_id', id); localStorage.setItem('ekavyu-mode', 'light');
    window.printAttempts = 0; window.failNextPrint = false;
    new MutationObserver(() => {
      const frame = document.querySelector('iframe[data-print-frame]');
      if (frame && !frame.dataset.acceptanceIntercepted) {
        frame.dataset.acceptanceIntercepted = 'true';
        frame.contentWindow.print = () => { window.printAttempts++; if (window.failNextPrint) { window.failNextPrint = false; throw Error('Synthetic printer failure'); } frame.contentWindow.dispatchEvent(new Event('afterprint')); };
      }
    }).observe(document, { childList: true, subtree: true });
  }, ids.location);
  const page = await context.newPage(), errors = [], reads = [], writes = [], committed = new Map(), unexpected = [];
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  const state = { rate: 1500, allowRecovery: mode !== 'lost-response', delay: 0, reject: mode, sequence: 0, branchEnabled: true, inventoryMode: mode.startsWith('reconciliation') ? 'billing_only' : 'tracked', countRevision: 1, countKey: null };
  const countPath = `/pharmacy/locations/${ids.location}/stock-reconciliation`, settingsPath = `/pharmacy/locations/${ids.location}/settings`;
  const countSummary = { locationId: ids.location, products: 1, changedProducts: 1, beforeUnits: 10, countedUnits: 6, newLots: 0 };
  const branchProduct = mode === 'billing-only' ? { ...product, stockQuantity: 0 } : product;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname.replace(/^\/api/, '');
    if (!url.pathname.startsWith('/api/')) return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const reply = (data, status = 200) => route.fulfill({ status, headers, json: envelope(data) });
    if (request.method() === 'PATCH' && p === settingsPath) {
      const input = request.postDataJSON(); writes.push({ path: p, input }); assert.equal(input.inventoryMode, 'billing_only'); assert.equal(input.enabled, false);
      state.branchEnabled = false; state.countRevision++;
      return reply({ ...capabilities, enabled: false, inventoryMode: 'billing_only', revision: state.countRevision });
    }
    if (request.method() === 'POST' && p.startsWith(countPath)) {
      const input = request.postDataJSON(), key = request.headers()['idempotency-key']; writes.push({ path: p, key, input });
      if (p.endsWith('/preview')) return reply({ ...countSummary, previewHash: 'd'.repeat(64) });
      assert.equal(state.branchEnabled, false); assert.equal(input.counts[0].lots[0].quantity, 6); assert.equal(input.confirmed, true);
      state.branchEnabled = true; state.inventoryMode = 'tracked'; state.countRevision++; state.countKey = key;
      if (mode === 'reconciliation-lost-response') return route.abort('failed');
      return reply({ ...countSummary, inventoryMode: 'tracked', revision: state.countRevision, requestKey: key });
    }
    if (request.method() === 'POST' && p === '/pharmacy/sales/quote') { writes.push({ path: p }); return reply(quote(request.postDataJSON(), state.rate)); }
    if (request.method() === 'POST' && p === '/pharmacy/sales') {
      const input = request.postDataJSON(), key = request.headers()['idempotency-key']; writes.push({ path: p, key, input });
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.reject === 'changed-total') { state.rate = 1600; state.reject = 'normal'; return route.fulfill({ status: 409, headers, json: { success: false, message: 'The current total changed', details: { code: 'COUNTER_TOTAL_CHANGED' } } }); }
      if (state.reject === 'insufficient-stock') return route.fulfill({ status: 409, headers, json: { success: false, message: 'Insufficient current stock' } });
      const saved = committed.get(key) || savedResult(input, key, ++state.sequence, state.rate); committed.set(key, saved);
      if (state.reject === 'lost-response') { state.reject = 'normal'; return route.abort('failed'); }
      return route.fulfill({ status: 201, headers: { ...headers, 'Access-Control-Expose-Headers': 'Server-Timing', 'Server-Timing': 'counter_save;dur=15, counter_stock;dur=3' }, json: envelope(publicResult(saved)) });
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      if (p === '/auth/refresh') return reply({ user });
      if (p === '/ai/chat/sessions') return reply({ id: 'synthetic-ai-session', messages: [] });
      if (['/public/track-visit', '/analytics/traffic'].includes(p)) return reply({ recorded: true });
      unexpected.push(request.method() + ' ' + p); return route.fulfill({ status: 405, headers, json: { success: false } });
    }
    reads.push(p);
    if (p === settingsPath) return reply({ ...capabilities, enabled: state.branchEnabled, inventoryMode: state.inventoryMode, revision: state.countRevision });
    if (p === countPath) return reply({ locationId: ids.location, snapshotHash: 'c'.repeat(64), revision: state.countRevision, products: [{ ...product, archived: false, quantity: 10, revision: 1, unit: product.unitDefinition, pricePaise: 1500, billingSupply: null, lots: [{ id: 'f'.repeat(24), batchNumber: 'SYNTHETIC-LOT', expiry: { precision: 'month', value: '2099-12' }, quantity: 10, status: 'active' }] }] });
    if (p.startsWith(countPath + '/operations/')) return reply({ ...countSummary, inventoryMode: 'tracked', revision: state.countRevision, requestKey: state.countKey });
    if (p === '/auth/me') return reply({ user });
    if (p === '/auth/workspaces') return reply([{ organizationId: ids.org, organizationName: branch.name, role: 'admin', workspaceProfile: 'pharmacy', isCurrent: true }]);
    if (p === '/onboarding/locations') return reply([branch]);
    if (p.endsWith('/capabilities')) return reply(mode === 'billing-only' ? { ...capabilities, inventoryMode: 'billing_only', actions: { ...capabilities.actions, receiveStock: false, adjustStock: false, transferStock: false } } : capabilities);
    if (p === '/medicines') return reply([branchProduct]);
    if (p === '/pharmacy/till') return reply({ active: drawer });
    if (p === '/pharmacy/sales/products') return reply({ items: [branchProduct], nextCursor: null });
    if (p === '/pharmacy/sales/customers') return reply({ items: [customer], nextCursor: null });
    if (p === '/pharmacy/sales/catalogue') return reply({ version: 1, locationId: ids.location, after: null, through: product.id, hash: 'b'.repeat(64), count: 1, nextCursor: null, items: [branchProduct] });
    if (p === '/pharmacy/sales/overview') return reply({ locationId: ids.location, currency: 'INR', timezone: 'Asia/Kolkata', date: '2026-11-15', asOf: new Date().toISOString(), salesPaise: 0, bills: 0, drawer: { active: true, cashPaise: 10000 }, stock: null, recent: [...committed.values()].slice(-3).map(row => ({ id: row.invoiceId, invoiceNumber: row.invoiceNumber, issuedAt: row.documentForRead.issuedAt, totalPaise: row.totalPaise, status: row.status })) });
    if (p.startsWith('/pharmacy/sale-operations/')) {
      const saved = committed.get(p.split('/').at(-1));
      if (!state.allowRecovery || !saved) return route.fulfill({ status: state.allowRecovery ? 404 : 503, headers, json: { success: false, message: 'Synthetic recovery not ready' } });
      return reply(publicResult(saved));
    }
    if (/^\/pharmacy\/invoices\/[a-f\d]{24}$/.test(p)) return reply([...committed.values()].find(row => row.invoiceId === p.split('/').at(-1))?.documentForRead);
    if (p === '/pharmacy/invoices') return reply({ items: [...committed.values()].map(row => row.documentForRead), nextCursor: null });
    if (p.endsWith('/collections')) return reply({ items: [], nextCursor: null });
    if (p.startsWith('/pharmacy/')) { unexpected.push('GET ' + p); return route.fulfill({ status: 501, headers, json: { success: false, message: 'Missing synthetic contract' } }); }
    const fallback = fixture(url, 'admin', 'GET', 'pharmacy');
    return fallback ? route.fulfill({ headers, json: fallback }) : route.fulfill({ status: 404, headers, json: { success: false } });
  });
  await page.goto(origin + '/dashboard/pharmacy', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add ' + product.name, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Toggle AI Copilot', exact: true }).evaluate(el => Boolean(el.closest('[data-app-header]')) && el.closest('[data-copilot-placement]')?.dataset.copilotPlacement === 'inline'), true, 'Pharmacy assistant lives in the header');
  const panels = page.getByRole('navigation', { name: 'Counter workspace panels', exact: true });
  const panel = async name => { if (width < 700) await panels.getByRole('button', { name }).click(); };
  const add = async () => { await panel('Products'); await page.getByRole('button', { name: 'Add ' + product.name, exact: true }).click(); };
  const pay = async () => { await panel(/^Pay/); };
  const save = page.getByRole('button', { name: 'Save counter bill', exact: true });
  return { context, page, state, writes, reads, committed, unexpected, errors, add, pay, panel, save };
}
async function run(name, width, mode, work) {
  const s = await session(width, mode), started = performance.now();
  try { await work(s); assert.deepEqual(s.unexpected, [], 'No unhandled pharmacy contracts'); assert.deepEqual(s.errors, [], 'No uncaught browser errors'); await s.page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); const phases = await s.page.evaluate(() => performance.getEntriesByType('measure').filter(row => row.name.startsWith('pharmacy.')).map(row => ({ phase: row.name, durationMs: Math.round(row.duration * 10) / 10 }))); results.push({ name, passed: true, elapsedMs: Math.round(performance.now() - started), phases, commands: s.writes.map(row => ({ path: row.path, key: row.key })), committed: s.committed.size }); }
  catch (error) { await s.page.screenshot({ path: path.join(output, name + '-failed.png'), fullPage: true }); results.push({ name, passed: false, error: error.message, unexpected: s.unexpected, browserErrors: s.errors }); throw error; }
  finally { await s.context.close(); console.log(JSON.stringify(results.at(-1))); }
}
const waitNext = async s => { await s.page.getByRole('button', { name: 'View last saved bill', exact: true }).waitFor(); await s.page.getByText('Your cart is empty', { exact: true }).waitFor({ state: 'attached' }); };
try {
  for (let n = 0; n < 120; n++) {
    try { if ((await fetch(origin + '/manifest.json')).ok) break; } catch { /* startup only */ }
    if (preview.exitCode !== null || n === 119) throw Error('Isolated production preview did not start.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  for (const [name, width, mode] of [['desktop-stock-reconciliation', 1660, 'reconciliation'], ['mobile-count-recovery', 390, 'reconciliation-lost-response']]) await run(name, width, mode, async s => {
    const openSettings = async () => {
      await s.page.goto(origin + '/dashboard/locations', { waitUntil: 'domcontentloaded' });
      await s.page.getByRole('button', { name: 'Actions for ' + branch.name, exact: true }).click();
      await s.page.getByText('Pharmacy settings', { exact: true }).click();
    };
    await openSettings();
    await s.page.getByLabel('Review reference *', { exact: true }).fill('Synthetic physical count');
    await s.page.getByRole('button', { name: 'Pause branch & count stock', exact: true }).click();
    await s.page.getByLabel('Physical count reference *', { exact: true }).fill('Synthetic shelf count');
    await s.page.getByLabel(`Actual piece: ${product.name} / SYNTHETIC-LOT`, { exact: true }).fill('6');
    await s.page.getByRole('button', { name: 'Preview differences', exact: true }).click();
    await s.page.getByText('I verified every product and batch, including zero counts, and confirm the physical count', { exact: true }).click();
    await s.page.screenshot({ path: path.join(output, name + '-preview.png'), fullPage: true });
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Physical count fits the viewport');
    await s.page.getByRole('button', { name: 'Confirm count & enable tracking', exact: true }).click();
    if (mode === 'reconciliation-lost-response') {
      await s.page.getByRole('button', { name: 'Check count result', exact: true }).waitFor();
      await openSettings();
      await s.page.getByRole('button', { name: 'Check earlier physical count', exact: true }).click();
      await s.page.getByRole('button', { name: 'Check count result', exact: true }).click();
    }
    await s.page.getByRole('dialog', { name: 'Reconcile physical stock', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(s.writes.filter(row => row.path.endsWith('/commit')).length, 1, 'Recovery never resubmits a second count');
    assert.equal(s.state.inventoryMode, 'tracked');
  });
  await run('billing-only-zero-stock-save-print', 1660, 'billing-only', async s => {
    assert.match(await s.page.getByRole('button', { name: 'Add ' + product.name, exact: true }).textContent(), /Stock not tracked/);
    await s.add(); await s.page.getByLabel('Quantity ' + product.name, { exact: true }).fill('3');
    assert.match(await s.page.getByLabel('Bill total', { exact: true }).textContent(), /45\.00/);
    assert.equal(s.writes.length, 0, 'Billing-only quantity edits stay local');
    await s.page.getByRole('button', { name: 'Save and print counter bill', exact: true }).click(); await waitNext(s);
    await s.page.waitForFunction(() => window.printAttempts === 1);
    assert.equal(s.writes.length, 1); assert.equal(s.committed.size, 1);
    assert.equal(s.writes[0].input.expectedInventoryMode, 'billing_only'); assert.equal(s.writes[0].input.lines[0].quantity, 3);
    assert.equal(s.reads.filter(value => /^\/pharmacy\/invoices\/[a-f\d]{24}$/.test(value)).length, 0, 'Save response supplies print evidence');
    assert.equal(await s.page.getByRole('dialog').count(), 0, 'No additional collection dialog');
    assert.equal(await s.page.evaluate(() => performance.getEntriesByName('pharmacy.server.save').at(-1)?.duration), 15, 'Allowlisted timing phases are readable across API origins');
  });
  await run('desktop-cash-slow-save', 1660, 'normal', async s => {
    await s.add(); await s.page.getByLabel('Quantity ' + product.name, { exact: true }).fill('3');
    assert.match(await s.page.getByLabel('Bill total', { exact: true }).textContent(), /45\.00/);
    assert.equal(s.writes.length, 0, 'Cart edits stay local');
    await s.page.getByLabel('Cash received (INR)', { exact: true }).fill('40'); assert.equal(await s.save.isDisabled(), true);
    await s.page.getByLabel('Cash received (INR)', { exact: true }).fill('100'); await s.save.waitFor({ state: 'visible' });
    await s.page.waitForFunction(() => !document.querySelector('[aria-label="Save counter bill"]').disabled);
    const before = await s.save.boundingBox(); s.state.delay = 3500; await s.save.click();
    await s.page.getByLabel('Save progress', { exact: true }).waitFor();
    const during = await s.save.boundingBox(); assert.ok(Math.abs(before.y - during.y) <= 2, 'Save footer stays in place');
    await waitNext(s); assert.equal(s.committed.size, 1); assert.equal(s.writes.length, 1); assert.equal(s.writes[0].input.payment.cashTenderedPaise, 10000);
    assert.equal(await s.page.getByRole('dialog').count(), 0); assert.equal(await s.page.getByText('Sale complete', { exact: true }).count(), 0);
    assert.equal(await s.page.getByLabel('Scan barcode or search products', { exact: true }).evaluate(el => el === document.activeElement), true);
    assert.equal(await s.page.locator('[data-app-scroll]').evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'Normal desktop checkout fits the workspace');
  });
  await run('mobile-save-and-print', 390, 'normal', async s => {
    await s.add(); await s.pay();
    assert.equal(await s.save.evaluate(el => { const r = el.getBoundingClientRect(), point = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el.contains(point); }), true, 'Mobile Save has no overlay');
    await s.page.getByRole('button', { name: 'Save and print counter bill', exact: true }).click(); await waitNext(s);
    await s.page.waitForFunction(() => window.printAttempts === 1);
    assert.equal(s.writes.length, 1); assert.equal(s.writes[0].input.includeDocument, true);
    assert.equal(s.reads.some(p => /^\/pharmacy\/invoices\//.test(p)), false, 'Save response supplies print evidence');
    assert.equal(await s.page.getByRole('dialog').count(), 0); assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await run('desktop-digital-reference', 1660, 'normal', async s => {
    await s.add(); await s.page.getByRole('group', { name: 'Preferred payment method' }).getByRole('button', { name: 'UPI', exact: true }).click();
    assert.equal(await s.save.isDisabled(), true); await s.page.getByLabel('Verified payment reference', { exact: true }).fill('SYNTHETIC-UPI-123');
    await s.save.click(); await waitNext(s); assert.equal(s.writes.length, 1); assert.equal(s.writes[0].input.payment.cashTenderedPaise, 0);
    assert.equal(s.writes[0].input.payment.entries[0].referenceNumber, 'SYNTHETIC-UPI-123');
  });
  await run('desktop-recorded-credit', 1660, 'normal', async s => {
    await s.add(); const methods = s.page.getByRole('group', { name: 'Preferred payment method' });
    assert.equal(await methods.getByRole('button', { name: 'Credit', exact: true }).isDisabled(), true);
    await s.page.getByRole('tab', { name: 'Recorded', exact: true }).click(); await s.page.getByLabel('Find recorded customer').fill('9000000001');
    await s.page.getByRole('button', { name: 'Search customers', exact: true }).click(); await s.page.getByRole('button', { name: 'Select customer ' + customer.name, exact: true }).click();
    await methods.getByRole('button', { name: 'Credit', exact: true }).click(); await s.save.click(); await waitNext(s);
    assert.equal(s.writes.length, 1); assert.equal(s.writes[0].input.customerId, customer.id); assert.equal(s.writes[0].input.payment, undefined);
    assert.equal([...s.committed.values()][0].status, 'unpaid'); assert.equal(await s.page.getByRole('dialog').count(), 0);
  });
  await run('desktop-changed-price', 1660, 'changed-total', async s => {
    await s.add(); await s.page.getByRole('group', { name: 'Preferred payment method' }).getByRole('button', { name: 'Card', exact: true }).click();
    const reference = s.page.getByLabel('Verified payment reference', { exact: true }); await reference.fill('SYNTHETIC-OLD-APPROVAL'); await s.save.click();
    await s.page.getByText(/Nothing has been billed or collected/).waitFor(); assert.equal(s.committed.size, 0); assert.equal(await reference.inputValue(), '');
    assert.match(await s.page.getByLabel('Bill total', { exact: true }).textContent(), /16\.00/); assert.equal(await s.save.isDisabled(), true);
    await reference.fill('SYNTHETIC-NEW-APPROVAL'); await s.save.click(); await waitNext(s);
    const saves = s.writes.filter(row => row.path === '/pharmacy/sales'); assert.equal(saves.length, 2); assert.notEqual(saves[0].key, saves[1].key); assert.equal(s.committed.size, 1); assert.equal(saves[1].input.expectedTotalPaise, 1600);
  });
  await run('mobile-lost-response-reload', 390, 'lost-response', async s => {
    await s.add(); await s.pay(); await s.save.click(); await s.page.getByText('Pending sale', { exact: true }).waitFor();
    assert.equal(s.committed.size, 1); const key = s.writes[0].key;
    await s.page.reload({ waitUntil: 'domcontentloaded' }); await s.page.getByRole('button', { name: 'Check sale result', exact: true }).waitFor();
    s.state.allowRecovery = true; await s.page.getByRole('button', { name: 'Check sale result', exact: true }).click(); await waitNext(s);
    assert.equal(s.writes.length, 1, 'Recovery does not resubmit the financial command'); assert.ok(s.reads.includes('/pharmacy/sale-operations/' + key));
  });
  await run('desktop-stock-rejected', 1660, 'insufficient-stock', async s => {
    await s.add(); await s.save.click(); await s.page.getByText('Insufficient current stock', { exact: true }).waitFor();
    assert.equal(s.committed.size, 0); assert.equal(s.writes.length, 1); assert.equal(await s.page.getByLabel('Quantity ' + product.name, { exact: true }).inputValue(), '1');
    assert.equal(await s.page.getByRole('button', { name: 'View last saved bill', exact: true }).count(), 0);
  });
  await run('desktop-print-retry', 1660, 'normal', async s => {
    await s.add(); await s.page.evaluate(() => { window.failNextPrint = true; });
    await s.page.getByRole('button', { name: 'Save and print counter bill', exact: true }).click(); await waitNext(s);
    await s.page.getByText('Bill saved; printing needs attention', { exact: true }).waitFor();
    await s.page.getByRole('button', { name: 'Retry printing', exact: true }).click(); await s.page.waitForFunction(() => window.printAttempts === 2);
    assert.equal(s.writes.length, 1); assert.equal(s.committed.size, 1); assert.equal(await s.page.getByRole('dialog').count(), 0);
  });
  await run('short-desktop-save-visibility', 1366, 'normal', async s => {
    await s.page.setViewportSize({ width: 1366, height: 768 }); await s.add();
    assert.equal(await s.save.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, 'Save is visible on a short desktop');
    assert.equal(await s.page.locator('[data-app-scroll]').evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'Short desktop has no outer scroll');
    await s.save.click(); await waitNext(s); assert.equal(s.writes.length, 1);
  });
  await run('mobile-header-and-assistant', 360, 'normal', async s => {
    const assistant = s.page.getByRole('button', { name: 'Toggle AI Copilot', exact: true });
    await assistant.click(); await s.page.getByRole('dialog', { name: 'Ekavyu AI Copilot', exact: true }).waitFor();
    await s.page.keyboard.press('Escape'); await s.page.getByRole('dialog', { name: 'Ekavyu AI Copilot', exact: true }).waitFor({ state: 'hidden' });
    await s.add();
    const navPay = s.page.getByRole('navigation', { name: 'Counter workspace panels', exact: true }).getByRole('button', { name: /^Pay/ });
    assert.equal(await navPay.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.right - 10, r.top + r.height / 2)); }), true, 'Pay remains unobstructed after closing the loaded assistant');
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ syntheticApi: true, realApiWrites: 0, results, logs, limitations: ['Synthetic API response timing is not configured-store Save latency.', 'Print invocation is intercepted; physical printers and native print dialog remain unverified.'] }, null, 2)); await browser?.close(); preview.kill(); }
