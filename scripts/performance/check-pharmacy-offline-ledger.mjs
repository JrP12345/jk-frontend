// Real Chrome/IndexedDB transactions against synthetic data. No business API/database access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireBrowser = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireBundler = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '../backend', 'tool.cjs'));
const { chromium } = requireBrowser('playwright-core'), { build } = requireBundler('esbuild');
await import('../build-pharmacy-offline.mjs');
const output = path.resolve('.next/pharmacy-offline-ledger-acceptance');
await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: `import * as ledger from './src/lib/pharmacyOfflineLedger'; import * as calculation from './src/lib/generated/pharmacyCalculation'; import * as document from './src/lib/generated/pharmacyOfflineDocument'; import * as backup from './src/lib/pharmacyOfflineBackup'; import * as identity from './src/lib/pharmacyOfflineIdentity'; import * as session from './src/lib/pharmacyOfflineSession'; window.offlineLedger = ledger; window.pharmacyCalculation = calculation; window.offlineDocument = document; window.offlineBackup = backup; window.offlineIdentity = identity; window.offlineSession = session;`, resolveDir: process.cwd() },
  bundle: true, outfile: path.join(output, 'browser.js'), format: 'iife', platform: 'browser', logLevel: 'silent' });
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (req.url === '/browser.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await fs.readFile(path.join(output, 'browser.js'))); return; }
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Isolated offline ledger acceptance</title><script src="/browser.js"></script>'); return; }
  if (/^\/(pharmacy-offline\.(html|css)|sw\.js|brand\/ekavyu-symbol-black\.svg|pharmacy-offline\/[A-Za-z][\w-]*\.(js|json))$/.test(req.url || '')) {
    const target = path.resolve('public', `.${req.url}`), publicRoot = path.resolve('public') + path.sep;
    if (!target.startsWith(publicRoot)) { res.writeHead(400).end(); return; }
    const content = await fs.readFile(target).catch(() => null);
    if (!content) { res.writeHead(404).end(); return; }
    const type = target.endsWith('.html') ? 'text/html' : target.endsWith('.css') ? 'text/css' : target.endsWith('.json') ? 'application/json' : target.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=0' }).end(content); return;
  }
  res.writeHead(404).end();
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`, results = [];
const profile = await fs.mkdtemp(path.join(output, 'chrome-profile-'));
const launch = () => chromium.launchPersistentContext(profile, { executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
let browser;
try {
  browser = await launch();
  const context = browser;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Reinstalled after reload. Each case gets an isolated scope in the same real IndexedDB.
  await page.addInitScript(() => {
    window.openLedger = async scope => {
      const store = await window.offlineLedger.createPharmacyOfflineLedger(scope);
      try { await store.unlock('Synthetic offline passphrase 2026!'); } catch { /* Unprepared fixture scopes initialize explicitly. */ }
      return store;
    };
    window.fixture = function (branch = 'branch') {
      const at = new Date().toISOString(), date = new Date(Date.now() + 330 * 60000), year = date.getUTCFullYear(), start = date.getUTCMonth() >= 3 ? year : year - 1;
      const fy = `${start}-${String(start + 1).slice(-2)}`, code = `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
      const scope = { organizationId: 'synthetic-org', locationId: branch, deviceId: 'synthetic-device' };
      const seed = { calculationEngineSha256: window.pharmacyCalculation.PHARMACY_CALCULATION_ENGINE_SHA256, lease: { id: 'synthetic-lease', prefix: `I0001${code}/`, financialYear: fy, next: 1, last: 100,
        validFrom: new Date(Date.now() - 10000).toISOString(), validUntil: new Date(Date.now() + 300000).toISOString() },
        lots: [{ id: 'lot-one', medicineId: 'product-one', quantity: 10, revision: 0, batchNumber: 'CAPTURED-LOT', expiryValue: '2099-12', expiryPrecision: 'month', sellingPricePaise: 1500, mrpPaise: 2000 }] };
      const sale = (commandId = 'sale-key-0001', quantity = 1) => ({
        commandId, leaseId: seed.lease.id, actorId: 'operator-one',
        invoice: { kind: 'pharmacy', createdBy: 'operator-one', customerSnapshot: { anonymous: true },
          documentVersion: 2, currency: 'INR', issuedAt: at, financialYear: fy, status: 'paid',
          subtotal: quantity * 15, totalAmount: quantity * 15, tax: 0, cgstTotal: 0, sgstTotal: 0, amountPaid: quantity * 15, balanceDue: 0,
          calculation: window.pharmacyCalculation.calculatePharmacyDocument({ policy: 'pharmacy-paise-v2', currency: 'INR', priceMode: 'inclusive', taxMode: 'none',
            lines: [{ lineId: 'line-00001', quantity, unitPrice: { numeratorPaise: 1500, denominatorUnits: 1 }, gstRateBps: 0 }] }),
          taxDocument: { version: 2, kind: 'ordinary_bill', issuedAt: at, signatureMode: 'manual_on_print', placeOfSupply: '24', reverseCharge: false,
            issuer: { legalName: 'Captured Pharmacy', address: 'Captured address', stateCode: '24', registration: 'unregistered', drugLicenceNumbers: ['LIC-20'], authorisedSignatory: 'Captured pharmacist' },
            recipient: { name: 'Walk-in customer', stateCode: '24' } },
          items: [{ description: 'Cotton', quantity, amount: 15, hsnSacCode: '300490', unitCode: 'NOS', gstRate: 0,
            baseAmountPaise: quantity * 1500, cgstPaise: 0, sgstPaise: 0, grossAmountPaise: quantity * 1500,
            unitSnapshot: { baseUnit: 'piece', packUnit: 'box', unitsPerPack: 10 },
            batches: [{ batchNumber: 'CAPTURED-LOT', expiryValue: '2099-12', expiryPrecision: 'month', quantity, sellingPricePaise: 1500, mrpPaise: 2000 }] }] },
        lines: [{ lineId: 'line-00001', medicineId: 'product-one', discountPaise: 0, allocations: [{ lotId: 'lot-one', quantity, expectedRevision: 0 }] }],
        payment: { manualConfirmed: true, cashTenderedPaise: quantity * 1500 + 500, shiftId: 'a'.repeat(24), drawerCode: 'COUNTER-01' },
      });
      return { scope, seed, sale };
    };
  });
  await page.goto(origin); await page.waitForFunction(() => Boolean(window.offlineLedger));
  async function check(name, work) {
    const at = performance.now(); await work();
    const result = { name, passed: true, elapsedMs: Math.round(performance.now() - at) };
    results.push(result); console.log(JSON.stringify(result));
  }
  await check('Atomic invoice, cash, stock, number and outbox commit; duplicate enrollment cannot reset stock', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('restart'), store = await window.openLedger(f.scope);
      await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); const sale = f.sale();
      const started = performance.now(), saved = await store.commit(sale), commitMs = Math.round(performance.now() - started);
      let duplicate = false; try { await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); } catch { duplicate = true; }
      window.originalSale = sale; window.originalReceipt = saved;
      const value = { saved, lot: await store.getLot('lot-one'), pending: await store.pending(), duplicate, commitMs }; store.close(); return value;
    });
    assert.equal(value.saved.receipt.sequence, 1); assert.equal(value.saved.receipt.payment.collectedPaise, 1500); assert.equal(value.saved.receipt.payment.changePaise, 500);
    assert.equal(value.lot.quantity, 9); assert.equal(value.lot.revision, 1); assert.equal(value.pending.length, 1); assert.equal(value.duplicate, true);
    console.log(JSON.stringify({ probe: 'synthetic-local-ledger-commit', milliseconds: value.commitMs, note: 'Excludes preparation, authorization, server sync and physical printing' }));
  });
  const originalSale = await page.evaluate(() => window.originalSale), originalReceipt = await page.evaluate(() => window.originalReceipt);
  await check('Unrecognized calculation version cannot initialize a usable local ledger', async () => {
    const result = await page.evaluate(async () => {
      const f = window.fixture('wrong-engine'), store = await window.openLedger(f.scope);
      let rejected = false; try { await store.initialize({ ...f.seed, calculationEngineSha256: '0'.repeat(64) }, 'Synthetic offline passphrase 2026!'); } catch { rejected = true; }
      let unprepared = false; try { await store.commit(f.sale()); } catch { unprepared = true; }
      await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); const saved = await store.commit(f.sale()); store.close();
      return { rejected, unprepared, sequence: saved.receipt.sequence, engine: saved.receipt.calculationEngineSha256 === f.seed.calculationEngineSha256 };
    });
    assert.deepEqual(result, { rejected: true, unprepared: true, sequence: 1, engine: true });
  });
  await check('Page restart restores non-extractable key and exact issued evidence without session storage', async () => {
    await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForFunction(() => Boolean(window.offlineLedger));
    const value = await page.evaluate(async () => {
      const store = await window.openLedger(window.fixture('restart').scope);
      const value = { saved: await store.recover('sale-key-0001'), lot: await store.getLot('lot-one'), pending: await store.pending() }; store.close(); return value;
    });
    assert.deepEqual(value.saved, originalReceipt); assert.equal(value.lot.quantity, 9); assert.equal(value.pending.length, 1);
    const keyExtractable = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const req = indexedDB.open('ekavyu-pharmacy-issued-ledger', 2); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
      const rows = await new Promise((resolve, reject) => { const req = db.transaction('keys').objectStore('keys').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); db.close(); return rows.some(row => Boolean(row.key) || !row.wrapped?.ciphertext);
    });
    assert.equal(keyExtractable, false);
  });
  await check('Same-key retry returns original invoice, even after expiry; changed evidence is rejected', async () => {
    const value = await page.evaluate(async sale => {
      const store = await window.openLedger(window.fixture('restart').scope);
      const realNow = Date.now; Date.now = () => realNow() + 86400000;
      try {
        await store.unlock('Synthetic offline passphrase 2026!');
        const replay = await store.commit(sale); let changed = false;
        try { await store.commit({ ...sale, payment: { ...sale.payment, cashTenderedPaise: 9999 } }); } catch { changed = true; }
        return { replay, changed, pending: (await store.pending()).length, quantity: (await store.getLot('lot-one')).quantity };
      } finally { Date.now = realNow; store.close(); }
    }, originalSale);
    assert.deepEqual(value.replay, originalReceipt); assert.equal(value.changed, true); assert.equal(value.quantity, 9); assert.equal(value.pending, 1);
  });
  await check('Ciphertext only for issuer, invoice, payment and stock; isolated branch/device/organization keys', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('restart'), result = [];
      for (const scope of [{ ...f.scope, locationId: 'other-branch' }, { ...f.scope, deviceId: 'other-pc' }, { ...f.scope, organizationId: 'other-org' }]) {
        const store = await window.openLedger(scope);
        try { await store.recover('sale-key-0001'); result.push(false); } catch { result.push(true); } finally { store.close(); }
      }
      const db = await new Promise(resolve => { const req = indexedDB.open('ekavyu-pharmacy-issued-ledger', 2); req.onsuccess = () => resolve(req.result); });
      const records = await new Promise(resolve => { const req = db.transaction('records').objectStore('records').getAll(); req.onsuccess = () => resolve(req.result); }); db.close();
      return { isolated: result.every(Boolean), text: JSON.stringify(records), sealed: records.every(row => row.ciphertext instanceof ArrayBuffer && row.iv.byteLength === 12) };
    });
    assert.equal(value.isolated, true); assert.equal(value.sealed, true); assert.doesNotMatch(value.text, /Captured|Cotton|cashTendered|Walk-in|2099/);
  });
  await check('Competing tabs cannot both sell the last stock or allocate the same invoice number', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('race'), a = await window.openLedger(f.scope), b = await window.openLedger(f.scope);
      await a.initialize(f.seed, 'Synthetic offline passphrase 2026!'); await b.unlock('Synthetic offline passphrase 2026!');
      const encrypt = SubtleCrypto.prototype.encrypt; let waiting = 0, release;
      const gate = new Promise(resolve => { release = resolve; });
      const timeout = setTimeout(release, 5000);
      SubtleCrypto.prototype.encrypt = async function (...args) {
        if (new TextDecoder().decode(args[2]).includes('"lastIssuedAt"')) { waiting++; if (waiting === 2) release(); await gate; }
        return encrypt.apply(this, args);
      };
      try {
        const results = await Promise.allSettled([a.commit(f.sale('race-sale-0001', 6)), b.commit(f.sale('race-sale-0002', 6))]);
        return { successes: results.filter(row => row.status === 'fulfilled').length, waiting, pending: (await a.pending()).length, quantity: (await a.getLot('lot-one')).quantity };
      } finally { clearTimeout(timeout); SubtleCrypto.prototype.encrypt = encrypt; a.close(); b.close(); }
    });
    assert.deepEqual(value, { successes: 1, waiting: 2, pending: 1, quantity: 4 });
  });
  await check('Concurrent identical Save returns one immutable receipt and one stock deduction', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('same-key'), a = await window.openLedger(f.scope), b = await window.openLedger(f.scope);
      await a.initialize(f.seed, 'Synthetic offline passphrase 2026!'); await b.unlock('Synthetic offline passphrase 2026!'); const sale = f.sale();
      try { const [one, two] = await Promise.all([a.commit(sale), b.commit(sale)]); return { same: one.digest === two.digest, quantity: (await a.getLot('lot-one')).quantity, pending: (await a.pending()).length }; }
      finally { a.close(); b.close(); }
    });
    assert.deepEqual(value, { same: true, quantity: 9, pending: 1 });
  });
  await check('Quota/write failure after staged invoice writes aborts everything and does not burn the number', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('quota'), store = await window.openLedger(f.scope); await store.initialize(f.seed, 'Synthetic offline passphrase 2026!');
      const original = IDBObjectStore.prototype.add; let rejected = false;
      IDBObjectStore.prototype.add = function (...args) { if (this.name === 'outbox') throw new DOMException('Injected quota exhaustion', 'QuotaExceededError'); return original.apply(this, args); };
      try { await store.commit(f.sale()); } catch { rejected = true; } finally { IDBObjectStore.prototype.add = original; }
      const before = { saved: await store.recover('sale-key-0001'), pending: (await store.pending()).length, quantity: (await store.getLot('lot-one')).quantity };
      const saved = await store.commit(f.sale()); store.close(); return { rejected, before, sequence: saved.receipt.sequence };
    });
    assert.equal(value.rejected, true); assert.deepEqual(value.before, { saved: null, pending: 0, quantity: 10 }); assert.equal(value.sequence, 1);
  });
  await check('Insufficient, expired, stale and foreign stock fail before any invoice/payment is committed', async () => {
    const value = await page.evaluate(async () => {
      const results = [];
      for (const variant of ['insufficient', 'expired', 'stale', 'foreign', 'mismatched-document', 'incomplete-payment', 'extra-payment-fields']) {
        const f = window.fixture(`invalid-${variant}`), store = await window.openLedger(f.scope);
        if (variant === 'expired') f.seed.lots[0].expiryValue = '2020-01';
        await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); const sale = f.sale('invalid-sale-key', variant === 'insufficient' ? 11 : 1);
        if (variant === 'stale') sale.lines[0].allocations[0].expectedRevision = 1;
        if (variant === 'foreign') sale.lines[0].medicineId = 'foreign-product';
        if (variant === 'mismatched-document') sale.invoice.items[0].batches[0].batchNumber = 'INVENTED';
        if (variant === 'incomplete-payment') sale.payment.cashTenderedPaise = 100;
        if (variant === 'extra-payment-fields') sale.payment.cardNumber = 'must-not-store';
        let rejected = false; try { await store.commit(sale); } catch { rejected = true; }
        results.push({ variant, rejected, pending: (await store.pending()).length, saved: await store.recover(sale.commandId), quantity: (await store.getLot('lot-one')).quantity }); store.close();
      }
      return results;
    });
    for (const row of value) { assert.equal(row.rejected, true, row.variant); assert.equal(row.pending, 0); assert.equal(row.saved, null); assert.equal(row.quantity, 10); }
  });
  await check('Balanced but mispriced/tax-discount-forged invoices consume no stock or number', async () => {
    const rows = await page.evaluate(async () => {
      const rows = [];
      for (const variant of ['lot-price', 'hidden-discount', 'partial-calculation', 'wrong-document']) {
        const f = window.fixture(`pricing-${variant}`), store = await window.openLedger(f.scope);
        await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); const sale = f.sale();
        if (variant === 'lot-price') sale.invoice.items[0].batches[0].sellingPricePaise = 1600;
        if (variant === 'hidden-discount') sale.lines[0].discountPaise = 100;
        if (variant === 'partial-calculation') delete sale.invoice.calculation.totals.baseAmountPaise;
        if (variant === 'wrong-document') sale.invoice.taxDocument.kind = 'tax_invoice';
        let rejected = false; try { await store.commit(sale); } catch { rejected = true; }
        const before = { pending: (await store.pending()).length, saved: await store.recover(sale.commandId), quantity: (await store.getLot('lot-one')).quantity };
        const saved = await store.commit(f.sale()); store.close(); rows.push({ rejected, before, sequence: saved.receipt.sequence });
      }
      return rows;
    });
    rows.forEach(row => { assert.equal(row.rejected, true); assert.deepEqual(row.before, { pending: 0, saved: null, quantity: 10 }); assert.equal(row.sequence, 1); });
  });
  await check('Restart/idle locks, failed-credential delay and cancellation protect the real encrypted ledger', async () => {
    const result = await page.evaluate(async () => {
      const f = window.fixture('protected-unlock'), store = await window.openLedger(f.scope); await store.initialize(f.seed, 'Synthetic offline passphrase 2026!');
      store.lock(); let locked = false; try { await store.commit(f.sale()); } catch { locked = true; }
      for (let i = 0; i < 5; i++) { try { await store.unlock('Different incorrect passphrase!'); } catch {} }
      let throttled = false; try { await store.unlock('Synthetic offline passphrase 2026!'); } catch (failure) { throttled = /Wait/.test(failure.message); }
      const realNow = Date.now; Date.now = () => realNow() + 31_000;
      try { await store.unlock('Synthetic offline passphrase 2026!'); } finally { Date.now = realNow; }
      await store.unlock('Synthetic offline passphrase 2026!');
      const pending = store.commit(f.sale()); store.lock(); let cancelled = false; try { await pending; } catch { cancelled = true; }
      await store.unlock('Synthetic offline passphrase 2026!');
      const before = { saved: await store.recover('sale-key-0001'), quantity: (await store.getLot('lot-one')).quantity };
      const saved = await store.commit(f.sale()); store.close();
      const reopened = await window.offlineLedger.createPharmacyOfflineLedger(f.scope); let restartLocked = false;
      try { await reopened.recover('sale-key-0001'); } catch { restartLocked = true; } reopened.close();
      return { locked, throttled, cancelled, before, sequence: saved.receipt.sequence, restartLocked };
    });
    assert.deepEqual(result, { locked: true, throttled: true, cancelled: true, before: { saved: null, quantity: 10 }, sequence: 1, restartLocked: true });
  });
  await check('Expired local allocation, exhausted number range and clock rollback stop new issuance', async () => {
    const value = await page.evaluate(async () => {
      const results = [];
      for (const variant of ['expired', 'exhausted', 'clock']) {
        const f = window.fixture(`lease-${variant}`), store = await window.openLedger(f.scope);
        if (variant === 'exhausted') f.seed.lease.last = 1;
        await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); await store.commit(f.sale());
        const realNow = Date.now, next = f.sale('second-sale-key'); next.lines[0].allocations[0].expectedRevision = 1;
        if (variant === 'expired') Date.now = () => realNow() + 86400000;
        if (variant === 'clock') { next.invoice.issuedAt = new Date(Date.parse(next.invoice.issuedAt) - 1000).toISOString(); next.invoice.taxDocument.issuedAt = next.invoice.issuedAt; }
        let rejected = false; try { await store.commit(next); } catch { rejected = true; } finally { Date.now = realNow; }
        await store.unlock('Synthetic offline passphrase 2026!');
        results.push({ rejected, quantity: (await store.getLot('lot-one')).quantity, pending: (await store.pending()).length }); store.close();
      }
      return results;
    });
    value.forEach(row => assert.deepEqual(row, { rejected: true, quantity: 9, pending: 1 }));
  });
  await check('Input changes during asynchronous Save cannot alter frozen invoice/payment evidence', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('mutated'), store = await window.openLedger(f.scope); await store.initialize(f.seed, 'Synthetic offline passphrase 2026!');
      const sale = f.sale(), pending = store.commit(sale); sale.payment.cashTenderedPaise = 99999; sale.invoice.items[0].description = 'MUTATED';
      try { const saved = await pending; return { tender: saved.receipt.payment.cashTenderedPaise, description: saved.receipt.invoice.items[0].description }; } finally { store.close(); }
    });
    assert.deepEqual(value, { tender: 2000, description: 'Cotton' });
  });
  await check('Owner-defined offline allocation captures its exact format and sequence on the saved invoice', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('custom-numbers');
      f.seed.lease.prefix = `PJP/${f.seed.lease.financialYear.slice(2)}/`;
      f.seed.lease.format = { prefixTemplate: 'PJP/{FY}/', digits: 5, resetPolicy: 'financial_year', configurationRevision: 4 };
      const store = await window.openLedger(f.scope); await store.initialize(f.seed, 'Synthetic offline passphrase 2026!');
      const saved = await store.commit(f.sale()); store.close(); return { invoice: saved.receipt.invoice, prefix: f.seed.lease.prefix };
    });
    assert.equal(value.invoice.invoiceNumber, `${value.prefix}00001`);
    assert.equal(value.invoice.numberingVersion, 3); assert.equal(value.invoice.numberingSnapshot.sequence, 1); assert.equal(value.invoice.numberingSnapshot.configurationRevision, 4);
  });
  await check('Returned evidence cannot mutate the ledger identity for a later bill', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('receipt-isolation'), store = await window.openLedger(f.scope); await store.initialize(f.seed, 'Synthetic offline passphrase 2026!');
      const first = await store.commit(f.sale()); first.receipt.scope.organizationId = 'mutated-owner';
      const next = f.sale('receipt-isolation-second'); next.lines[0].allocations[0].expectedRevision = 1;
      const second = await store.commit(next), recovered = await store.recover(next.commandId); store.close();
      return { owner: second.receipt.scope.organizationId, same: window.offlineLedger.offlineLedgerCanonical(second) === window.offlineLedger.offlineLedgerCanonical(recovered), sequence: second.receipt.sequence };
    });
    assert.deepEqual(value, { owner: 'synthetic-org', same: true, sequence: 2 });
  });
  await check('Sync requires exact number/digest; acknowledgement is idempotent and never rewrites issued evidence', async () => {
    const value = await page.evaluate(async () => {
      const store = await window.openLedger(window.fixture('restart').scope), saved = await store.recover('sale-key-0001');
      const ack = { commandId: saved.receipt.commandId, digest: saved.digest, invoiceNumber: saved.receipt.invoice.invoiceNumber, serverInvoiceId: 'b'.repeat(24) };
      let mismatch = false; try { await store.acknowledge({ ...ack, digest: '0'.repeat(64) }); } catch { mismatch = true; }
      const pendingBefore = (await store.pending()).length;
      await store.acknowledge(ack); await store.acknowledge(ack);
      let replacement = false; try { await store.acknowledge({ ...ack, serverInvoiceId: 'c'.repeat(24) }); } catch { replacement = true; }
      const value = { mismatch, pendingBefore, pendingAfter: (await store.pending()).length, replacement, saved: await store.recover(ack.commandId) }; store.close(); return value;
    });
    assert.equal(value.mismatch, true); assert.equal(value.pendingBefore, 1); assert.equal(value.pendingAfter, 0); assert.equal(value.replacement, true); assert.deepEqual(value.saved, originalReceipt);
  });
  await check('Corrupted issued ciphertext fails authentication and is never silently treated as an empty ledger', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('corrupt'), store = await window.openLedger(f.scope);
      await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); await store.commit(f.sale('corrupt-sale-key'));
      const db = await new Promise(resolve => { const req = indexedDB.open('ekavyu-pharmacy-issued-ledger', 2); req.onsuccess = () => resolve(req.result); });
      const records = await new Promise(resolve => { const req = db.transaction('records').objectStore('records').getAll(); req.onsuccess = () => resolve(req.result); });
      const record = records.find(row => row.id.endsWith(':sale:corrupt-sale-key'));
      const bytes = new Uint8Array(record.ciphertext); bytes[bytes.length - 1] ^= 1;
      await new Promise((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.objectStore('records').put(record); }); db.close();
      let recoverRejected = false, syncRejected = false;
      try { await store.recover('corrupt-sale-key'); } catch { recoverRejected = true; }
      try { await store.pending(); } catch { syncRejected = true; }
      const quantity = (await store.getLot('lot-one')).quantity; store.close(); return { recoverRejected, syncRejected, quantity };
    });
    assert.deepEqual(value, { recoverRejected: true, syncRejected: true, quantity: 9 });
  });
  await check('Prepared checkout requires a pinned signed activation and original PC; commits an ordered signed chain and durably stops before release', async () => {
    const value = await page.evaluate(async () => {
      const encode = value => new TextEncoder().encode(value), hex = value => Array.from(new Uint8Array(value)).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const base64url = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const scope = { organizationId: '1'.repeat(24), locationId: '2'.repeat(24), deviceId: crypto.randomUUID() }, actorId = '3'.repeat(24);
      const identity = await window.offlineIdentity.browserDevice(scope, true); scope.deviceId = identity.deviceId;
      const prototype = window.fixture(), lease = { ...prototype.seed.lease, id: crypto.randomUUID() }, authorityId = crypto.randomUUID();
      const product = { id: '4'.repeat(24), name: 'Synthetic prepared cotton', genericName: 'Cotton', barcodes: [], stockQuantity: 10, availableQuantity: 10, stockRevision: 1, taxRevision: 1, dispensingRevision: 1,
        unitDefinition: { version: 1, baseUnit: 'piece', packUnit: 'box', unitsPerPack: 10 }, hsnSacCode: '300490', unitCode: 'NOS', gstRateBps: 0, classificationGstRateBps: 0, taxTreatment: 'nil_rated', taxReviewReference: 'Synthetic tax review' };
      const lot = { ...prototype.seed.lots[0], id: '5'.repeat(24), medicineId: product.id, expiryCutoff: '2099-12-31T18:30:00.000Z', hsnCode: product.hsnSacCode, gstRateBps: 0 };
      const prepared = { ...scope, actorId, authorityId, enrollmentId: lease.id, checkoutEnabled: false, manifestDigest: '6'.repeat(64), preparedAt: new Date(Date.now() - 1000).toISOString(), validUntil: lease.validUntil, lease,
        drawer: { id: '7'.repeat(24), code: 'ORIGINAL-COUNTER', openingFloatPaise: 1000 }, issuer: prototype.sale().invoice.taxDocument.issuer, issuerRevision: 1, issuerReviewReference: 'Synthetic issuer review',
        products: [product], lots: [lot], calculationEngineSha256: prototype.seed.calculationEngineSha256 };
      const pc = { privateKey: identity.privateKey, publicKey: await crypto.subtle.importKey('jwk', identity.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']) };
      const foreign = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      const serverKey = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
      const signer = { id: hex(await crypto.subtle.digest('SHA-256', await crypto.subtle.exportKey('spki', serverKey.publicKey))), key: serverKey.publicKey };
      const store = await window.offlineLedger.createPharmacyOfflineLedger(scope, authorityId);
      await store.initialize({ lease, lots: [lot], calculationEngineSha256: prepared.calculationEngineSha256, prepared, devicePublicKey: await crypto.subtle.exportKey('jwk', pc.publicKey) }, 'Synthetic offline passphrase 2026!');
      const sale = (key, revision = 0) => {
        const issuedAt = new Date().toISOString(), invoice = window.offlineDocument.buildOfflinePharmacyDocument({ actorId, issuedAt, financialYear: lease.financialYear, issuer: prepared.issuer, issuerRevision: 1,
          issuerReviewReference: prepared.issuerReviewReference, lines: [{ lineId: 'prepared-line-001', product, discountPaise: 0, allocations: [{ ...lot, quantity: 1 }] }], invoiceDiscountPaise: 0, roundOffPaise: 0 });
        return { commandId: key, leaseId: lease.id, actorId, invoice, lines: [{ lineId: 'prepared-line-001', medicineId: product.id, discountPaise: 0, allocations: [{ lotId: lot.id, quantity: 1, expectedRevision: revision }] }],
          payment: { manualConfirmed: true, cashTenderedPaise: 2000, shiftId: prepared.drawer.id, drawerCode: prepared.drawer.code } };
      };
      let beforeActivation = false; try { await store.commit(sale('before-activation'), pc.privateKey); } catch { beforeActivation = true; }
      const payload = JSON.stringify({ version: 1, purpose: 'ekavyu.pharmacy.checkout-grant.v1', checkoutEnabled: true, ...scope, actorId, authorityId, enrollmentId: lease.id, actorAuthVersion: 0, manifestDigest: prepared.manifestDigest,
        calculation: { policy: 'pharmacy-paise-v2', sha256: prepared.calculationEngineSha256, documentSha256: window.offlineDocument.PHARMACY_OFFLINE_DOCUMENT_SHA256 }, inventoryMode: 'tracked', lease, drawer: prepared.drawer,
        validFrom: new Date().toISOString(), validUntil: prepared.validUntil });
      const grant = { authorityId, payload, sha256: hex(await crypto.subtle.digest('SHA-256', encode(payload))), signingKey: { id: signer.id },
        signature: base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', serverKey.privateKey, encode(`ekavyu.pharmacy.checkout-grant.v1\n${payload}`))) };
      await store.activate(grant, signer); await store.activate(grant, signer);
      const wrong = sale('wrong-private-key'); await store.stageSale(wrong);
      let wrongPc = false; try { await store.commit(wrong, foreign.privateKey); } catch { wrongPc = true; }
      await store.finishSale(wrong.commandId, true);
      const original = await store.prepareSale({ commandId: 'original-prepared-sale', actorId, lines: [{ lineId: 'prepared-line-001', medicineId: product.id, quantity: 1, discountPaise: 0 }],
        invoiceDiscountPaise: 0, roundOffPaise: 0, cashTenderedPaise: 2000 });
      await store.stageSale(original); const first = await store.commit(original, pc.privateKey);
      const active = await store.activeSale();
      const exactRecovery = active.sale.commandId === original.commandId && active.saved.digest === first.digest;
      await store.finishSale(original.commandId);
      const next = sale('second-prepared-sale', 1); await store.stageSale(next); const second = await store.commit(next, pc.privateKey); await store.finishSale(next.commandId);
      const sig = Uint8Array.from(atob(first.deviceSignature.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
      const signed = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pc.publicKey, sig, encode(`ekavyu.pharmacy.offline-sale.v1\n${authorityId}\n${first.digest}`));
      const stop = await store.stop('Synthetic shift reconciliation', pc.privateKey);
      const stopAgain = await store.stop('Same operation recovery', pc.privateKey);
      const backup = await store.exportRecoveryBackup();
      const recovery = await window.offlineBackup.openPharmacyOfflineRecovery(backup, 'Synthetic offline passphrase 2026!', scope, await crypto.subtle.exportKey('jwk', pc.publicKey));
      const recovered = await recovery.receipt(first.receipt.commandId), recoveredStop = await recovery.stopped();
      const backupValid = recovery.readOnly === true && window.offlineLedger.offlineLedgerCanonical(recovered) === window.offlineLedger.offlineLedgerCanonical(first) && recoveredStop.lastDigest === second.digest;
      let foreignBackupRejected = false;
      try { await window.offlineBackup.openPharmacyOfflineRecovery(backup, 'Synthetic offline passphrase 2026!', scope, await crypto.subtle.exportKey('jwk', foreign.publicKey)); } catch { foreignBackupRejected = true; }
      recovery.lock(); let recoveryLocked = false; try { await recovery.receipt(first.receipt.commandId); } catch { recoveryLocked = true; }
      let stopped = false; try { await store.commit(sale('after-stopped-sale', 2), pc.privateKey); } catch { stopped = true; }
      const replay = await store.commit(original, pc.privateKey); store.close();
      const restarted = await window.offlineLedger.createPharmacyOfflineLedger(scope, authorityId); await restarted.unlock('Synthetic offline passphrase 2026!');
      let restartStopped = false; try { await restarted.commit(sale('after-restarted-stop', 2), pc.privateKey); } catch { restartStopped = true; }
      const quantity = (await restarted.getLot(lot.id)).quantity, pending = (await restarted.pending()).length; restarted.close();
      // A separate subsequent session uses the same original PC identity, a
      // permanently fresh number range, and isolated encrypted stock records.
      const nextAuthority = crypto.randomUUID(), nextPrepared = { ...prepared, authorityId: nextAuthority, manifestDigest: '8'.repeat(64), lease: { ...lease, next: 101, last: 200 }, products: [{ ...product, stockQuantity: 8, availableQuantity: 8, stockRevision: 3 }], lots: [{ ...lot, quantity: 8 }] };
      const nextStore = await window.offlineLedger.createPharmacyOfflineLedger(scope, nextAuthority);
      await nextStore.initialize({ lease: nextPrepared.lease, lots: nextPrepared.lots, calculationEngineSha256: prepared.calculationEngineSha256, prepared: nextPrepared, devicePublicKey: identity.publicKey }, 'Synthetic offline passphrase 2026!');
      const nextPayload = JSON.stringify({ ...JSON.parse(payload), authorityId: nextAuthority, manifestDigest: nextPrepared.manifestDigest, lease: nextPrepared.lease, validFrom: new Date().toISOString() });
      await nextStore.activate({ authorityId: nextAuthority, payload: nextPayload, sha256: hex(await crypto.subtle.digest('SHA-256', encode(nextPayload))), signingKey: { id: signer.id }, signature: base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', serverKey.privateKey, encode(`ekavyu.pharmacy.checkout-grant.v1\n${nextPayload}`))) }, signer);
      await window.offlineSession.saveOfflineSession({ version: 1, ...scope, actorId, authorityId: nextAuthority, phase: 'active', claim: { authorityId: nextAuthority, deviceId: scope.deviceId }, signingKey: { id: signer.id, jwk: await crypto.subtle.exportKey('jwk', serverKey.publicKey) } }, null); nextStore.close();
      return { beforeActivation, wrongPc, signed, stopped, restartStopped, backupValid, foreignBackupRejected, recoveryLocked, exactRecovery, version: first.receipt.version, firstSequence: first.receipt.sequence, secondSequence: second.receipt.sequence,
        previousDigest: second.receipt.previousDigest === first.digest, product: second.receipt.products[0], stopSequence: stop.sequence, stopDigest: stop.lastDigest === second.digest,
        sameStop: window.offlineLedger.offlineLedgerCanonical(stop) === window.offlineLedger.offlineLedgerCanonical(stopAgain), replay: window.offlineLedger.offlineLedgerCanonical(replay) === window.offlineLedger.offlineLedgerCanonical(first), quantity, pending };
    });
    assert.deepEqual(value, { beforeActivation: true, wrongPc: true, signed: true, stopped: true, restartStopped: true, backupValid: true, foreignBackupRejected: true, recoveryLocked: true, exactRecovery: true, version: 2, firstSequence: 1, secondSequence: 2, previousDigest: true,
      product: { medicineId: '4'.repeat(24), before: 9, after: 8, revision: 3 }, stopSequence: 2, stopDigest: true, sameStop: true, replay: true, quantity: 8, pending: 2 });
  });
  await check('Owner sequences crossing six digits remain in original issue order for synchronization', async () => {
    const value = await page.evaluate(async () => {
      const f = window.fixture('large-owner-sequence'), store = await window.openLedger(f.scope);
      f.seed.lease.prefix = 'OWNER/'; f.seed.lease.next = 999999; f.seed.lease.last = 1000001;
      f.seed.lease.format = { prefixTemplate: 'OWNER/', digits: 7, resetPolicy: 'continuous', configurationRevision: 1 };
      await store.initialize(f.seed, 'Synthetic offline passphrase 2026!'); await store.commit(f.sale('large-sequence-one'));
      const next = f.sale('large-sequence-two'); next.lines[0].allocations[0].expectedRevision = 1; await store.commit(next);
      const sequences = (await store.pending()).map(row => row.receipt.sequence); store.close(); return sequences;
    });
    assert.deepEqual(value, [999999, 1000000]);
  });
  assert.deepEqual(errors, []);
  await check('Financial reconciliation holds survive restart and block new invoices while preserving exact original recovery', async () => {
    const result = await page.evaluate(async () => {
      const fixture = window.fixture('durable-review-hold'), store = await window.openLedger(fixture.scope); await store.initialize(fixture.seed, 'Synthetic offline passphrase 2026!');
      const original = fixture.sale('original-review-sale'), saved = await store.commit(original); await store.suspendIssuance(); store.close();
      const reopened = await window.openLedger(fixture.scope); let blocked = false; try { await reopened.commit(fixture.sale('a-different-bill')); } catch (failure) { blocked = /conflict/.test(failure.message); }
      const replay = await reopened.commit(original), state = await reopened.checkoutState(), pending = await reopened.pending(); reopened.close();
      return { blocked, held: state.reviewRequired, same: replay.digest === saved.digest, pending: pending.length };
    });
    assert.deepEqual(result, { blocked: true, held: true, same: true, pending: 1 });
  });
  await check('Closing and restarting the actual Chrome process retains issued evidence, keys and pending synchronization', async () => {
    await context.close(); browser = await launch();
    await browser.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const reopened = await browser.newPage(); await reopened.goto(origin); await reopened.waitForFunction(() => Boolean(window.offlineLedger));
    const value = await reopened.evaluate(async () => {
      const scope = { organizationId: 'synthetic-org', locationId: 'restart', deviceId: 'synthetic-device' };
      const store = await window.offlineLedger.createPharmacyOfflineLedger(scope); await store.unlock('Synthetic offline passphrase 2026!');
      const acknowledged = { saved: await store.recover('sale-key-0001'), pending: (await store.pending()).length, quantity: (await store.getLot('lot-one')).quantity }; store.close();
      const pendingStore = await window.offlineLedger.createPharmacyOfflineLedger({ ...scope, locationId: 'same-key' }); await pendingStore.unlock('Synthetic offline passphrase 2026!');
      const pending = await pendingStore.pending(); pendingStore.close(); return { acknowledged, pending };
    });
    assert.deepEqual(value.acknowledged.saved, originalReceipt); assert.equal(value.acknowledged.quantity, 9); assert.equal(value.acknowledged.pending, 0);
    assert.equal(value.pending.length, 1); assert.equal(value.pending[0].receipt.sequence, 1); assert.equal(value.pending[0].receipt.payment.collectedPaise, 1500);
  });
  await check('Public restart shell unlocks and saves/prints an actual bill with the whole browser offline after process restart', async () => {
    console.log(JSON.stringify({ probe: 'public-shell-warming' }));
    const warm = await browser.newPage(); warm.on('pageerror', error => console.error(`Public shell error: ${error.message}`)); warm.on('console', message => { if (message.type() === 'error') console.error(`Public shell console: ${message.text()}`); }); await warm.goto(`${origin}/pharmacy-offline.html`);
    console.log(JSON.stringify({ probe: 'public-shell-loaded', registration: await warm.evaluate(async () => { try { const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }); return { scope: registration.scope, installing: registration.installing?.state, active: registration.active?.state }; } catch (failure) { return { error: String(failure) }; } }) }));
    const cdp = await browser.newCDPSession(warm); await cdp.send('Browser.grantPermissions', { origin, permissions: ['durableStorage'] });
    assert.equal(await warm.evaluate(() => navigator.storage.persist()), true);
    await warm.evaluate(async () => { await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Public service worker did not become ready')), 15000))]); });
    await warm.waitForFunction(async () => { const names = await caches.keys(); for (const name of names) { const cache = await caches.open(name); if (await cache.match('/pharmacy-offline/pharmacyFinal.js')) return true; } return false; });
    await browser.close(); browser = await launch(); await browser.setOffline(true);
    console.log(JSON.stringify({ probe: 'public-shell-offline-restarted' }));
    const cold = await browser.newPage(), failures = []; cold.on('pageerror', error => failures.push(error.message));
    // Capture the OS print handoff in headless Chrome; generate the same saved
    // paper with printToPDF below. Physical printer acceptance is separate.
    await cold.addInitScript(() => { window.syntheticPrintCalls = 0; window.print = () => { window.syntheticPrintCalls++; }; });
    await cold.setViewportSize({ width: 1440, height: 900 }); await cold.goto(`${origin}/pharmacy-offline.html`);
    await cold.getByLabel('Offline passphrase').fill('Synthetic offline passphrase 2026!'); await cold.getByRole('button', { name: 'Unlock counter', exact: true }).click();
    console.log(JSON.stringify({ probe: 'public-shell-unlock-clicked' }));
    await cold.getByRole('button', { name: '+ Synthetic prepared cotton', exact: true }).click();
    // CDP permission grants are context-scoped. Check denial, then renew the
    // fixture permission without mocking storage or bypassing the Save guard.
    if (!await cold.evaluate(() => navigator.storage.persisted())) {
      assert.equal(await cold.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
      const restartedCDP = await browser.newCDPSession(cold); await restartedCDP.send('Browser.grantPermissions', { origin, permissions: ['durableStorage'] });
      await cold.getByRole('button', { name: 'Enable durable storage', exact: true }).click();
    }
    try { await cold.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Save & print' && !button.disabled)); }
    catch (failure) { console.error(JSON.stringify({ failures, body: await cold.locator('main').innerText(), persistent: await cold.evaluate(() => navigator.storage.persisted()) })); await cold.screenshot({ path: path.join(output, 'cold-counter-failure.png'), fullPage: true }); throw failure; }
    await cold.getByRole('button', { name: 'Save & print', exact: true }).click();
    console.log(JSON.stringify({ probe: 'offline-public-save-clicked' }));
    await cold.waitForFunction(() => document.querySelector('#pharmacy-final-paper strong')?.textContent?.includes('/000101'));
    console.log(JSON.stringify({ probe: 'offline-public-print-snapshot-ready' }));
    assert.equal(await cold.locator('#pharmacy-final-paper').getByText(/Synthetic prepared cotton/).count(), 1);
    assert.equal(await cold.evaluate(() => window.syntheticPrintCalls), 1);
    await cold.pdf({ path: path.join(output, 'synthetic-offline-invoice.pdf'), format: 'A4', printBackground: true });
    await cold.screenshot({ path: path.join(output, 'synthetic-offline-counter.png'), fullPage: true });
    assert.deepEqual(failures, []);
    const evidence = await cold.evaluate(async () => { const session = await import('/pharmacy-offline/pharmacyOfflineSession.js'), ledger = await import('/pharmacy-offline/pharmacyOfflineLedger.js'); const control = (await session.listOfflineSessions())[0], store = await ledger.createPharmacyOfflineLedger(control, control.authorityId); await store.unlock('Synthetic offline passphrase 2026!'); const pending = await store.pending(), draft = await store.readDraft(); store.close(); return { sequence: pending[0].receipt.sequence, cash: pending[0].receipt.payment.collectedPaise, pending: pending.length, draft: draft.cart.length, overflow: document.documentElement.scrollWidth > innerWidth }; });
    assert.deepEqual(evidence, { sequence: 101, cash: 1500, pending: 1, draft: 0, overflow: false });
    await cold.setViewportSize({ width: 390, height: 844 });
    await cold.getByRole('button', { name: '+ Synthetic prepared cotton', exact: true }).click();
    await cold.getByRole('button', { name: 'Cart', exact: true }).click(); await cold.getByLabel('Quantity Synthetic prepared cotton').waitFor({ state: 'visible' });
    await cold.screenshot({ path: path.join(output, 'synthetic-offline-mobile-cart.png'), fullPage: true });
    assert.equal(await cold.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await cold.getByRole('button', { name: /^Pay/ }).click(); await cold.getByLabel('Cash received (INR)').waitFor({ state: 'visible' });
    assert.equal(await cold.getByLabel('Quantity Synthetic prepared cotton').isVisible(), false);
    await cold.getByRole('button', { name: 'Lock counter', exact: true }).click();
    assert.equal(await cold.locator('#pharmacy-final-paper').count(), 0); assert.equal(await cold.locator('main').innerText().then(value => value.includes('₹15.00')), false);
  });
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ syntheticOnly: true, preparedCashOfflineSave: true, results }, null, 2));
} catch (failure) { console.error(failure); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
