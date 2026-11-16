// Synthetic browser/transport acceptance only. No application API, auth token,
// configured database, real customer, invoice or physical printer is accessed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { offlineEvidenceCanonical } from '../../../backend/utilities/pharmacyOfflineDocument.ts';

const requireBrowser = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireBundler = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '../backend', 'tool.cjs'));
const { chromium } = requireBrowser('playwright-core'), { build } = requireBundler('esbuild');
await import('../build-pharmacy-offline.mjs');
const output = path.resolve('.next/pharmacy-offline-stress'); await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: `import * as ledger from './src/lib/pharmacyOfflineLedger'; import * as calculation from './src/lib/generated/pharmacyCalculation'; import * as document from './src/lib/generated/pharmacyOfflineDocument'; import * as identity from './src/lib/pharmacyOfflineIdentity'; import * as session from './src/lib/pharmacyOfflineSession'; import * as sync from './src/lib/pharmacyOfflineSync'; import * as backup from './src/lib/pharmacyOfflineBackup'; window.stress = { ledger, calculation, document, identity, session, sync, backup };`, resolveDir: process.cwd() }, bundle: true, outfile: path.join(output, 'fixture.js'), platform: 'browser', format: 'iife', logLevel: 'silent' });
const catalogueSize = 10000, initialBills = 120, interactiveBills = 6, cpuRate = 4;
const network = { offline: false, latency: 400, downloadThroughput: 65536, uploadThroughput: 32768, connectionType: 'cellular3g' };
const approved = new Map(), imported = new Map(), attempts = new Map(), interrupted = new Set(), results = [];
let releaseFirst, firstRequest, inFlight = 0, maxInFlight = 0, bytesReceived = 0;
const firstArrived = new Promise(resolve => { firstRequest = resolve; });
const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const digest = value => crypto.createHash('sha256').update(offlineEvidenceCanonical(value)).digest('hex');
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/synthetic-import') {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        const parts = []; let size = 0;
        for await (const part of req) { size += part.length; if (size > 2 * 1024 * 1024) throw Error('Oversized synthetic receipt'); parts.push(part); }
        bytesReceived += size;
        const value = JSON.parse(Buffer.concat(parts).toString('utf8')), receipt = value.receipt, key = `${receipt.authorityId}:${receipt.commandId}`;
        const authority = approved.get(receipt.authorityId); assert(authority, 'Unknown synthetic authority'); assert.equal(digest(receipt), value.digest);
        assert.equal(receipt.scope.deviceId, authority.scope.deviceId);
        assert(crypto.verify('sha256', Buffer.from(`ekavyu.pharmacy.offline-sale.v1\n${receipt.authorityId}\n${value.digest}`), { key: crypto.createPublicKey({ format: 'jwk', key: authority.publicKey }), dsaEncoding: 'ieee-p1363' }, Buffer.from(value.deviceSignature, 'base64url')));
        attempts.set(key, (attempts.get(key) || 0) + 1);
        const previous = imported.get(key);
        if (previous) assert.equal(previous.digest, value.digest, 'A retry changed issued evidence');
        else {
          assert.equal(receipt.sequence, authority.lastSequence + 1); assert.equal(receipt.previousDigest, authority.lastDigest);
          authority.lastSequence = receipt.sequence; authority.lastDigest = value.digest;
          imported.set(key, { commandId: receipt.commandId, digest: value.digest, invoiceNumber: receipt.invoice.invoiceNumber, serverInvoiceId: receipt.sequence.toString(16).padStart(24, '0'), authorityId: receipt.authorityId, sequence: receipt.sequence });
        }
        if (receipt.sequence === 1 && !previous) { firstRequest(); await firstResponse; }
        if ([7, 23].includes(receipt.sequence) && !interrupted.has(receipt.sequence)) {
          interrupted.add(receipt.sequence);
          // A lost/truncated acknowledgement after commit. Sending headers
          // prevents Chrome transparently replaying a wholly empty response.
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"truncated":'); return;
        }
        // Delayed small acknowledgements emulate a slow link. The receiver is
        // an exact-evidence transport simulator, not native financial posting.
        await sleep(100); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(imported.get(key)));
      } finally { inFlight--; }
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Synthetic pharmacy stress fixture</title><script src="/fixture.js"></script>'); return; }
    if (req.url === '/fixture.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await fs.readFile(path.join(output, 'fixture.js'))); return; }
    if (/^\/(pharmacy-offline\.(html|css)|sw\.js|brand\/ekavyu-symbol-black\.svg|pharmacy-offline\/[A-Za-z][\w-]*\.(js|json))$/.test(req.url || '')) {
      const target = path.resolve('public', `.${req.url}`); assert(target.startsWith(path.resolve('public') + path.sep));
      const content = await fs.readFile(target).catch(() => null); if (!content) { res.writeHead(404).end(); return; }
      const type = target.endsWith('.html') ? 'text/html' : target.endsWith('.css') ? 'text/css' : target.endsWith('.json') ? 'application/json' : target.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=0' }).end(content); return;
    }
    res.writeHead(404).end();
  } catch (failure) { res.writeHead(409, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: failure.message })); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, profile = await fs.mkdtemp(path.join(output, 'chrome-profile-'));
const launch = () => chromium.launchPersistentContext(profile, { executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-automation', '--disable-background-networking', '--no-proxy-server'] });
const percentile = (values, percentage) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * percentage) - 1)];
let browser;
async function check(name, work) { const start = performance.now(), evidence = await work(); results.push({ name, passed: true, elapsedMs: Math.round(performance.now() - start), ...evidence }); console.log(JSON.stringify(results.at(-1))); }
async function fixturePage() {
  const page = await browser.newPage(); await page.goto(origin); await page.waitForFunction(() => Boolean(window.stress));
  const cdp = await browser.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate }); await cdp.send('Network.emulateNetworkConditions', network); return { page, cdp };
}
async function openQueue(page) {
  await page.evaluate(async () => {
    const control = (await window.stress.session.listOfflineSessions())[0], ledger = await window.stress.ledger.createPharmacyOfflineLedger(control, control.authorityId);
    await ledger.unlock('Synthetic offline stress passphrase!');
    const sync = window.stress.sync.createPharmacyOfflineSync(ledger, async (value, signal) => {
      const response = await fetch('/synthetic-import', { method: 'POST', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' }, signal });
      if (!response.ok) throw Object.assign(Error('Synthetic transport rejection'), { status: response.status }); return response.json();
    }, { online: () => navigator.onLine });
    window.queueProbe = { ledger, sync, control };
  });
}
try {
  browser = await launch(); let { page } = await fixturePage();
  let enrollment;
  await check('Prepare 10,000 reviewed synthetic products with real protected IndexedDB and a signed cash grant under 4x CPU throttle', async () => {
    enrollment = await page.evaluate(async ({ catalogueSize, initialBills }) => {
      const start = performance.now(), { ledger, calculation, document: documents, identity, session } = window.stress;
      const scope = { organizationId: '1'.repeat(24), locationId: '2'.repeat(24) }, actorId = '3'.repeat(24), device = await identity.browserDevice(scope, true), owner = { ...scope, deviceId: device.deviceId };
      const now = new Date(), india = new Date(now.getTime() + 330 * 60000), year = india.getUTCFullYear(), firstYear = india.getUTCMonth() >= 3 ? year : year - 1;
      const financialYear = `${firstYear}-${String(firstYear + 1).slice(-2)}`, lease = { id: crypto.randomUUID(), prefix: `I0001${String(firstYear).slice(-2)}${String(firstYear + 1).slice(-2)}/`, financialYear, next: 1, last: 1000, validFrom: new Date(now.getTime() - 1000).toISOString(), validUntil: new Date(now.getTime() + 3600000).toISOString() };
      const products = Array.from({ length: catalogueSize }, (_, index) => ({ id: (BigInt('0x400000000000000000000000') + BigInt(index)).toString(16), name: `Synthetic medicine ${String(index).padStart(5, '0')}`, genericName: 'Synthetic cotton', barcodes: [`890000${String(index).padStart(7, '0')}`], stockQuantity: 1000, availableQuantity: 1000, stockRevision: 1, taxRevision: 1, dispensingRevision: 1, unitDefinition: { version: 1, baseUnit: 'piece', packUnit: 'box', unitsPerPack: 10 }, hsnSacCode: '300490', unitCode: 'NOS', gstRateBps: 0, classificationGstRateBps: 0, taxTreatment: 'nil_rated', taxReviewReference: 'Synthetic reviewed tax' }));
      const lots = products.map((product, index) => ({ id: (BigInt('0x500000000000000000000000') + BigInt(index)).toString(16), medicineId: product.id, quantity: 1000, revision: 0, batchNumber: `SYNTHETIC-${index}`, expiryValue: '2099-12', expiryPrecision: 'month', expiryCutoff: '2099-12-31T18:30:00.000Z', sellingPricePaise: 1500, mrpPaise: 2000, hsnCode: product.hsnSacCode, gstRateBps: 0 }));
      const authorityId = crypto.randomUUID(), prepared = { ...owner, actorId, authorityId, enrollmentId: lease.id, checkoutEnabled: false, manifestDigest: '6'.repeat(64), preparedAt: now.toISOString(), validUntil: lease.validUntil, lease, drawer: { id: '7'.repeat(24), code: 'SYNTHETIC-COUNTER', openingFloatPaise: 0 }, issuer: { legalName: 'Synthetic acceptance pharmacy', address: 'Synthetic fixture address', stateCode: '24', registration: 'unregistered', drugLicenceNumbers: ['SYNTHETIC-LICENCE'], authorisedSignatory: 'Synthetic pharmacist' }, issuerRevision: 1, issuerReviewReference: 'Synthetic issuer review', products, lots, calculationEngineSha256: calculation.PHARMACY_CALCULATION_ENGINE_SHA256 };
      const store = await ledger.createPharmacyOfflineLedger(owner, authorityId); await store.initialize({ lease, lots, prepared, devicePublicKey: device.publicKey, calculationEngineSha256: prepared.calculationEngineSha256 }, 'Synthetic offline stress passphrase!');
      const server = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
      const hex = value => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join(''), encode = value => new TextEncoder().encode(value), keyId = hex(await crypto.subtle.digest('SHA-256', await crypto.subtle.exportKey('spki', server.publicKey)));
      const payload = JSON.stringify({ version: 1, purpose: 'ekavyu.pharmacy.checkout-grant.v1', checkoutEnabled: true, ...owner, actorId, authorityId, enrollmentId: lease.id, actorAuthVersion: 0, manifestDigest: prepared.manifestDigest, calculation: { policy: 'pharmacy-paise-v2', sha256: prepared.calculationEngineSha256, documentSha256: documents.PHARMACY_OFFLINE_DOCUMENT_SHA256 }, inventoryMode: 'tracked', lease, drawer: prepared.drawer, validFrom: new Date().toISOString(), validUntil: lease.validUntil });
      const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', server.privateKey, encode(`ekavyu.pharmacy.checkout-grant.v1\n${payload}`))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await store.activate({ authorityId, payload, sha256: hex(await crypto.subtle.digest('SHA-256', encode(payload))), signingKey: { id: keyId }, signature }, { id: keyId, key: server.publicKey });
      const prepareMs = performance.now() - start;
      await session.saveOfflineSession({ version: 1, ...owner, actorId, authorityId, phase: 'active', claim: { authorityId, deviceId: owner.deviceId }, signingKey: { id: keyId, jwk: await crypto.subtle.exportKey('jwk', server.publicKey) } }, null);
      const timings = [];
      for (let index = 0; index < initialBills; index++) {
        const at = performance.now(), sale = await store.prepareSale({ commandId: crypto.randomUUID(), actorId, lines: [{ lineId: 'synthetic-stress-line', medicineId: products[0].id, quantity: 1, discountPaise: 0 }], invoiceDiscountPaise: 0, roundOffPaise: 0, cashTenderedPaise: 2000 });
        await store.stageSale(sale); await store.commit(sale, device.privateKey); await store.finishSale(sale.commandId); timings.push(performance.now() - at);
      }
      const pending = (await store.checkoutState()).next - 1; store.close();
      return { scope: owner, actorId, authorityId, publicKey: device.publicKey, prepareMs, timings, pending, productId: products[0].id };
    }, { catalogueSize, initialBills });
    assert.equal(enrollment.pending, initialBills); approved.set(enrollment.authorityId, { ...enrollment, lastSequence: 0, lastDigest: null });
    return { catalogueSize, cpuRate, pendingBills: enrollment.pending, preparationMs: Math.round(enrollment.prepareMs), localPrepareStageCommitMs: { p50: Math.round(percentile(enrollment.timings, 0.5)), p95: Math.round(percentile(enrollment.timings, 0.95)), max: Math.round(Math.max(...enrollment.timings)) } };
  });
  const counter = await browser.newPage(), cdp = await browser.newCDPSession(counter);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate }); await cdp.send('Browser.grantPermissions', { origin, permissions: ['durableStorage'] });
  await counter.goto(`${origin}/pharmacy-offline.html`); assert.equal(await counter.evaluate(() => navigator.storage.persist()), true);
  await counter.getByLabel('Offline passphrase').fill('Synthetic offline stress passphrase!'); await counter.getByRole('button', { name: 'Unlock counter', exact: true }).click();
  await counter.getByRole('button', { name: '+ Synthetic medicine 00000', exact: true }).waitFor();
  await openQueue(page);
  await check('Cashier search and six local Saves continue while the first HTTP import acknowledgement is blocked', async () => {
    await page.evaluate(() => { window.queueProbe.sync.flush().then(value => { window.queueProbe.last = value; }); });
    await Promise.race([firstArrived, sleep(15000).then(() => { throw Error('Synthetic receiver never saw the first receipt'); })]);
    const searchTimes = [], saveTimes = [];
    for (let index = 0; index < interactiveBills; index++) {
      let start = performance.now(); await counter.getByLabel('Search prepared medicines').fill('Synthetic medicine 00000');
      await counter.getByRole('button', { name: '+ Synthetic medicine 00000', exact: true }).waitFor(); searchTimes.push(performance.now() - start);
      await counter.getByRole('button', { name: '+ Synthetic medicine 00000', exact: true }).click();
      await counter.getByRole('button', { name: 'Save', exact: true }).waitFor(); await counter.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Save' && !button.disabled));
      start = performance.now(); await counter.getByRole('button', { name: 'Save', exact: true }).click();
      const suffix = `/${String(initialBills + index + 1).padStart(6, '0')}`;
      await counter.waitForFunction(suffix => document.querySelector('[role=status]')?.textContent?.includes(suffix), suffix); saveTimes.push(performance.now() - start);
    }
    assert.equal(imported.size, 1, 'Local Saves unexpectedly waited for the blocked network');
    releaseFirst();
    return { interactiveBills, searchMs: { p50: Math.round(percentile(searchTimes, 0.5)), p95: Math.round(percentile(searchTimes, 0.95)) }, clickToLocalSavedMs: { p50: Math.round(percentile(saveTimes, 0.5)), p95: Math.round(percentile(saveTimes, 0.95)), max: Math.round(Math.max(...saveTimes)) }, receiverEffectsWhileSaving: imported.size };
  });
  await check('A dropped response preserves the original pending command across a Chrome process crash', async () => {
    await page.waitForFunction(() => Boolean(window.queueProbe.last)); assert.equal(await page.evaluate(() => window.queueProbe.last.status), 'retry');
    assert.equal(imported.size, 7); assert.equal(await page.evaluate(async () => (await window.queueProbe.ledger.pending(1))[0].receipt.sequence), 7);
    await fs.writeFile(path.join(output, 'receiver-before-crash.json'), JSON.stringify([...imported.values()], null, 2));
    // Terminate only the exact synthetic Chrome process identified through its
    // own browser CDP connection, after checking its isolated profile argument.
    // Browser.crash can wait indefinitely in Windows crash-report handling.
    const instance = browser.browser(), control = await instance.newBrowserCDPSession();
    const command = await control.send('Browser.getBrowserCommandLine'); assert(command.arguments.includes(`--user-data-dir=${profile}`));
    const processes = await control.send('SystemInfo.getProcessInfo'), processId = processes.processInfo.find(row => row.type === 'browser')?.id;
    assert(Number.isSafeInteger(processId) && processId > 0 && processId !== process.pid);
    const disconnected = new Promise(resolve => instance.once('disconnected', resolve)); process.kill(processId, 'SIGKILL');
    await Promise.race([disconnected, sleep(5000)]); assert.equal(instance.isConnected(), false, 'Synthetic Chrome did not terminate'); browser = await launch();
    ({ page } = await fixturePage()); await openQueue(page);
    await browser.setOffline(true); const requests = [...attempts.values()].reduce((sum, count) => sum + count, 0);
    assert.equal(await page.evaluate(async () => (await window.queueProbe.sync.flush()).status), 'offline');
    assert.equal([...attempts.values()].reduce((sum, count) => sum + count, 0), requests); await browser.setOffline(false);
    const resumedNetwork = await browser.newCDPSession(page); await resumedNetwork.send('Network.emulateNetworkConditions', network);
    const before = await page.evaluate(async () => { const first = (await window.queueProbe.ledger.pending(1))[0].receipt.sequence; return { pending: (await window.queueProbe.ledger.checkoutState()).next - first, first, quantity: (await window.queueProbe.ledger.getProduct('400000000000000000000000')).quantity }; });
    assert.deepEqual(before, { pending: initialBills + interactiveBills - 6, first: 7, quantity: 1000 - initialBills - interactiveBills });
    return { receiverCommittedThrough: 7, localAcknowledgedThrough: 6, recoveredPending: before.pending };
  });
  await check('Slow HTTP, another lost response and reconnect drain the original backlog once in sequence', async () => {
    const deadline = Date.now() + 120000;
    while (await page.evaluate(async () => (await window.queueProbe.ledger.pending(1)).length)) {
      assert(Date.now() < deadline, 'Synthetic backlog exceeded the acceptance deadline');
      const state = await page.evaluate(() => window.queueProbe.sync.flush()); assert.notEqual(state.status, 'review');
      if (state.status === 'retry') await sleep(Math.min(1100, Math.max(0, state.retryAt - Date.now()) + 5));
    }
    const evidence = await page.evaluate(async () => ({ pending: (await window.queueProbe.ledger.pending(1)).length, next: (await window.queueProbe.ledger.checkoutState()).next, quantity: (await window.queueProbe.ledger.getProduct('400000000000000000000000')).quantity }));
    assert.equal(imported.size, initialBills + interactiveBills); assert.equal(maxInFlight, 1); assert.equal(evidence.pending, 0); assert.equal(evidence.next, initialBills + interactiveBills + 1); assert.equal(evidence.quantity, 1000 - initialBills - interactiveBills);
    assert.equal([...attempts.values()].filter(count => count > 1).length, 2); assert.deepEqual([...imported.values()].map(row => row.sequence), Array.from({ length: imported.size }, (_, index) => index + 1));
    return { receipts: imported.size, retransmittedOriginals: 2, maxConcurrentImports: maxInFlight, bytesReceived, remainingPending: evidence.pending, originalNextNumber: evidence.next };
  });
  await check('An external encrypted backup verifies every original receipt and its stopped checkpoint', async () => {
    const archive = await page.evaluate(async () => {
      const device = await window.stress.identity.browserDevice(window.queueProbe.control), stopped = await window.queueProbe.ledger.stop('Synthetic completed stress acceptance', device.privateKey);
      return { serialized: await window.queueProbe.ledger.exportRecoveryBackup(), stopped };
    });
    const file = path.join(output, 'synthetic-external-backup.json'); await fs.writeFile(file, archive.serialized); const serialized = await fs.readFile(file, 'utf8');
    const recovered = await counterRecovery(page, serialized, enrollment);
    assert.equal(recovered.count, initialBills + interactiveBills); assert.equal(recovered.sequence, initialBills + interactiveBills); assert.equal(recovered.lastDigest, archive.stopped.lastDigest);
    return { recoveredOriginals: recovered.count, fileBytes: Buffer.byteLength(serialized), stoppedSequence: recovered.sequence, readOnly: recovered.readOnly };
  });
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ syntheticOnly: true, nativeFinancialApi: false, physicalPowerLoss: false, physicalPrinter: false, catalogueSize, cpuRate, network, results }, null, 2));
} catch (failure) { console.error(failure); process.exitCode = 1; }
finally { releaseFirst(); await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

async function counterRecovery(page, serialized, enrollment) {
  return page.evaluate(async ({ serialized, scope, publicKey }) => {
    const { openPharmacyOfflineRecovery } = window.stress.backup;
    const archive = await openPharmacyOfflineRecovery(serialized, 'Synthetic offline stress passphrase!', scope, publicKey);
    try { for (const reference of archive.references()) await archive.receipt(reference); const stopped = await archive.stopped(); return { count: archive.references().length, sequence: stopped.sequence, lastDigest: stopped.lastDigest, readOnly: archive.readOnly }; }
    finally { archive.lock(); }
  }, { serialized, scope: enrollment.scope, publicKey: enrollment.publicKey });
}
