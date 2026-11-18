// Real Chrome, real components, synthetic API responses only. No business database/providers/spooler.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const browserTools = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/supplier-tools', 'tool.cjs'));
const buildTools = createRequire(path.resolve('../backend', 'tool.cjs'));
const { chromium } = browserTools('playwright-core'), { build } = buildTools('esbuild');
const output = path.resolve('.next/pharmacy-supplier-acceptance'); await fs.mkdir(output, { recursive: true });
const token = 'a'.repeat(64), id = 'd'.repeat(24), locationId = 'a'.repeat(24), supplierId = 'b'.repeat(24);
const expiry = '2099-12-20T12:00:00Z';
const document = { id: 'synthetic-file', name: 'SYNTHETIC-INVOICE.pdf', kind: 'invoice', contentType: 'application/pdf', size: 90, source: 'supplier_link', supplierVisible: true, createdAt: '2026-11-17T06:00:00Z' };
const initialOrder = { reference: 'PO-SYNTHETIC-ONLY', revision: 2, state: 'submitted', status: 'submitted', canRespond: true, canDispatch: true, canUpload: true, uploadsAvailable: true,
  quantities: [{ lineId: 'order-line-0001', invoiced: 0, received: 0 }], buyer: { name: 'SYNTHETIC ONLY Pharmacy', branch: 'Test branch', address: 'Synthetic address' }, supplierName: 'Synthetic supplier', notes: 'Synthetic test only; no supplier contacted.', expiresAt: expiry,
  lines: [{ lineId: 'order-line-0001', name: 'Synthetic medicine ' + 'LongName'.repeat(24), strength: '10 mg', manufacturer: 'Synthetic manufacturer', quantity: 21, unit: 'tablet', packUnit: 'strip', unitsPerPack: 10 }], documents: [] };
let order = structuredClone(initialOrder), revoked = false, loseResponse = false, lossUsed = false, accepted = new Map(); const calls = [], results = [];
let collaboration = { orderId: id, revision: 2, access: null, documents: [], email: null, emailAvailable: false, storageAvailable: true, publicLinkOrigin: null, supplierEmail: 'synthetic@example.test' };
await fs.writeFile(path.join(output, 'api.ts'), `export const getApiUrl=()=>window.location.origin+'/api'; async function request(method,path,input,options={}){const response=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...options.headers},...(input?{body:JSON.stringify(input)}:{}),signal:options.signal});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message),{response:{status:response.status,data}});return {data};} export default {get:(path,options)=>request('GET',path,undefined,options),post:(path,input,options)=>request('POST',path,input,options),put:(path,input,options)=>request('PUT',path,input,options)};`);
await build({ stdin: { contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
  import SupplierOrderPage from './src/app/supplier-order/SupplierOrderPage';
  import {PharmacySupplierCollaboration} from './src/components/pharmacy/PharmacySupplierCollaboration';
  import {PharmacySupplierWorkspace} from './src/components/pharmacy/PharmacySupplierWorkspace';
  import {PharmacyPurchaseOrderDocument} from './src/components/pharmacy/PharmacyPurchaseOrderDocument';
  import {ToastProvider} from './src/components/ui'; import {useAuthStore} from './src/store/authStore';
  import {orderFixture,orderSupplier} from './src/tests/fixtures/pharmacyPurchaseOrder';
  const root=createRoot(document.getElementById('app')); const order=orderFixture({reference:'PO-SYNTHETIC-ONLY',state:'submitted',status:'submitted',revision:2});
  useAuthStore.setState({user:{id:'synthetic-buyer',name:'Synthetic buyer',email:'synthetic@example.test',role:'purchaser',organization_id:'synthetic-org',permissions:['PHARMACY_PURCHASE']}});
  window.supplierProbe={mount(mode){const view=mode==='supplier'?React.createElement(SupplierOrderPage):mode==='collaboration'?React.createElement(PharmacySupplierCollaboration,{order,canManage:true,onClose:()=>{}}):mode==='workspace'?React.createElement(PharmacySupplierWorkspace,{supplier:orderSupplier,locationId:order.locationId,onClose:()=>{},onOrder:()=>{},onInvoice:()=>{}}):React.createElement(PharmacyPurchaseOrderDocument,{order:{...order,lines:Array.from({length:48},(_,i)=>({...order.lines[0],lineId:'line-'+i,medicineSnapshot:{name:'SYNTHETIC medicine '+(i+1)}}))},onClose:()=>{}});flushSync(()=>root.render(React.createElement(ToastProvider,{key:mode},view)));}};
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}', 'process.browser': 'true' }, outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent',
  plugins: [{ name: 'synthetic-api-only', setup(plugin) { plugin.onResolve({ filter: /^(?:@\/lib\/api|\.\/api)$/ }, args => args.path === '@/lib/api' || /[/\\]src[/\\]lib[/\\]/.test(args.importer) ? { path: path.join(output, 'api.ts') } : undefined); } }] });
const cssRoot = path.resolve(process.env.SUPPLIER_ACCEPTANCE_CSS_ROOT || '.next/supplier-verification/static/chunks');
const styles = (await fs.readdir(cssRoot)).filter(name => name.endsWith('.css'));
assert(styles.length, 'Build the frontend before the browser acceptance check');
const globalCss = (await Promise.all(styles.map(name => fs.readFile(path.join(cssRoot, name), 'utf8')))).join('\n');
await fs.writeFile(path.join(output, 'global.css'), globalCss);
const send = (res, data, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, message: data }));
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://test.local');
    if (url.pathname.startsWith('/api/')) {
      let body = ''; for await (const chunk of req) body += chunk; const input = body ? JSON.parse(body) : {};
      calls.push({ method: req.method, path: url.pathname, url: req.url, input, key: req.headers['idempotency-key'], cookie: req.headers.cookie });
      if (url.pathname.startsWith('/api/public/')) {
        assert.equal(req.headers.cookie, undefined); if (input.token !== token || revoked) return send(res, 'Supplier link revoked', 404);
        if (url.pathname.endsWith('/read')) return send(res, order);
        if (url.pathname.endsWith('/respond')) {
          const key = req.headers['idempotency-key'];
          if (!accepted.has(key)) { accepted.set(key, structuredClone(input)); order = { ...order, revision: order.revision + 1, state: 'partially_accepted', status: 'partially_accepted', response: { reference: input.input.reference, recordedAt: '2026-11-17T06:30:00Z', lines: input.input.lines } }; }
          else assert.deepEqual(accepted.get(key), input);
          // A proxy can fail after commit. Use 503 so Chrome does not transparently retry a reset socket.
          if (loseResponse && !lossUsed) { lossUsed = true; return send(res, 'Synthetic response unavailable after commit; retry original request', 503); }
          return send(res, order);
        }
        if (url.pathname.endsWith('/documents')) { assert.equal(input.confirmed, true); assert.equal(input.name, 'SYNTHETIC-INVOICE.pdf'); order.documents = [document]; return send(res, order); }
        if (url.pathname.endsWith('/document-download')) return send(res, { url: 'https://supplier-files.example.test/invoice.pdf', name: document.name });
      }
      if (url.pathname.endsWith('/collaboration')) return send(res, collaboration);
      if (url.pathname.endsWith('/supplier-link')) { assert.equal(input.confirmed, true); collaboration = { ...collaboration, revision: collaboration.revision + 1, access: { active: true, expiresAt: expiry } }; return send(res, { token, expiresAt: expiry, revision: collaboration.revision }); }
      if (url.pathname === '/api/pharmacy/purchase-orders') return send(res, { items: [{ id, reference: 'PO-SYNTHETIC-ONLY', state: 'submitted', status: 'submitted', supplierId, supplierSnapshot: { name: 'Synthetic supplier' }, createdAt: '2026-11-17T06:00:00Z', invoiceCount: 0 }], nextCursor: null });
      if (url.pathname.endsWith('/archive')) return send(res, { items: [], nextCursor: null });
      if (url.pathname.endsWith('/statement')) return send(res, { supplierId, supplierName: 'Synthetic supplier', locationId, currency: 'INR', purchases: [], openingBalances: [], returns: [], totals: { payablePaise: 0, confirmedCreditPaise: 0, paidPaise: 0, duePaise: 0, pendingCreditPaise: 0, supplierRefundReceivablePaise: 0 } });
      if (url.pathname === '/api/pharmacy/purchases') return send(res, { items: [], nextCursor: null });
      return send(res, 'Unexpected synthetic API route', 404);
    }
    const assets = { '/fixture.js': ['fixture.js', 'text/javascript'], '/fixture.css': ['fixture.css', 'text/css'], '/global.css': ['global.css', 'text/css'] };
    if (assets[url.pathname]) { const [file, type] = assets[url.pathname]; res.writeHead(200, { 'Content-Type': type }).end(await fs.readFile(path.join(output, file))); return; }
    if (url.pathname === '/' || url.pathname === '/supplier-order') { res.writeHead(200, { 'Content-Type': 'text/html', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }).end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic supplier acceptance</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); return; }
    res.writeHead(404).end();
  } catch { send(res, 'Synthetic fixture assertion failed', 500); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`; let browser, failurePage; const errors = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext({ acceptDownloads: true }); const foreignRequests = [];
  await context.addCookies([{ name: 'synthetic-staff-session', value: 'synthetic-only', url: origin }]);
  await context.route('**/*', route => { const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'supplier-files.example.test') { assert.equal(request.headers().referer, undefined); return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="SYNTHETIC-INVOICE.pdf"' }, body: '%PDF-1.7\nSYNTHETIC ONLY\n%%EOF' }); }
    foreignRequests.push(url.origin); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000); failurePage = page; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/supplier-order#${token}`); await page.waitForFunction(() => Boolean(window.supplierProbe));
  await page.evaluate(() => window.supplierProbe.mount('supplier')); await page.getByText('PO-SYNTHETIC-ONLY', { exact: true }).waitFor();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, elements: [...document.querySelectorAll('main *')].filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 4).map(node => ({ tag: node.tagName, text: node.textContent.slice(0, 60) })) }));
    assert(overflow.document <= width + 1, JSON.stringify({ width, overflow })); assert.equal(overflow.elements.length, 0, JSON.stringify({ width, overflow }));
    await page.screenshot({ path: path.join(output, `supplier-${width}.png`), fullPage: true }); results.push({ viewport: width, horizontalOverflow: false });
  }
  await page.getByText('I am the intended supplier and have verified these quantities or documents', { exact: true }).click();
  await page.getByRole('button', { name: 'Fill ordered quantities when all are available' }).click();
  await page.getByLabel(`Accepted ${initialOrder.lines[0].name} (tablet)`, { exact: true }).fill('7');
  await page.getByLabel('Supplier confirmation reference', { exact: true }).fill('SYNTHETIC supplier confirmation'); loseResponse = true;
  await page.getByRole('button', { name: 'Confirm supplier details', exact: true }).click();
  await page.getByRole('button', { name: 'Retry original supplier submission', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Retry original supplier submission', exact: true }).click();
  await page.getByText('Supplier details recorded. Pharmacy staff will review the order and actual goods.', { exact: true }).waitFor();
  const attempts = calls.filter(call => call.path.endsWith('/respond')); assert.equal(attempts.length, 2); assert.equal(attempts[0].key, attempts[1].key); assert.deepEqual(attempts[0].input, attempts[1].input); assert.equal(accepted.size, 1);
  await page.getByText('I am the intended supplier and have verified these quantities or documents', { exact: true }).click();
  await page.getByLabel('Document file', { exact: true }).setInputFiles({ name: document.name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 SYNTHETIC ONLY') });
  await page.getByRole('button', { name: 'Share document with pharmacy', exact: true }).click();
  await page.getByRole('button', { name: `Download ${document.name}`, exact: true }).waitFor();
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: `Download ${document.name}`, exact: true }).click(); const downloaded = await downloadEvent; assert.equal(downloaded.suggestedFilename(), document.name); await downloaded.saveAs(path.join(output, 'downloaded-synthetic-invoice.pdf'));
  revoked = true; await page.getByRole('button', { name: 'Refresh supplier order', exact: true }).click(); await page.getByText('Supplier link revoked', { exact: true }).waitFor(); assert.equal(await page.getByText('PO-SYNTHETIC-ONLY', { exact: true }).count(), 0);
  results.push({ supplierResponse: 'passed', lostResponseRetry: 'same_payload_and_key', fileUploadDownload: 'passed', revokedLinkHidesOrder: true });
  await page.evaluate(() => window.supplierProbe.mount('collaboration')); await page.getByText('No active supplier response link.', { exact: true }).waitFor();
  await page.getByText('I verified the intended supplier and understand that this link grants access to this order', { exact: true }).click(); await page.getByRole('button', { name: 'Create / replace supplier link', exact: true }).click(); await page.getByLabel('Private supplier response link', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Email link to current supplier address' }).isEnabled(), false);
  for (const width of [360, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(output, `staff-collaboration-${width}.png`), fullPage: true }); }
  await page.evaluate(() => window.supplierProbe.mount('workspace')); await page.getByRole('button', { name: 'Review order / dispatch PO-SYNTHETIC-ONLY' }).waitFor();
  for (const name of ['Invoices', 'Statement / returns', 'Payments / credits', 'Documents']) { await page.getByRole('tab', { name, exact: true }).click(); await page.getByText('Loading supplier records…', { exact: true }).waitFor({ state: 'hidden' }); }
  results.push({ staffSharing: 'passed', configurationGatesEmail: true, supplierWorkspaceTabs: 'passed' });
  await page.evaluate(() => { window.supplierProbe.mount('document'); window.printCalls = 0; new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLIFrameElement && node.dataset.printFrame) node.contentWindow.print = () => { window.printCalls++; }; }).observe(document.body, { childList: true }); });
  await page.getByRole('button', { name: /^Print Purchase order/ }).click(); await page.waitForFunction(() => window.printCalls === 1);
  const frame = page.frames().find(candidate => candidate.parentFrame()); assert(frame, 'Expected real print frame');
  const printPage = await context.newPage(); await printPage.goto(origin); await printPage.setContent(await frame.content()); await printPage.emulateMedia({ media: 'print' });
  const pdf = await printPage.pdf({ path: path.join(output, 'supplier-purchase-order-A4.pdf'), format: 'A4', printBackground: true }); const text = pdf.toString('latin1'); assert((text.match(/\/Type \/Page\b/g) || []).length > 1); assert.match(text, /\/MediaBox\s*\[0 0 595/);
  assert.equal(await printPage.locator('tbody tr').count(), 48); assert((await printPage.textContent('body')).includes('not a tax invoice'));
  results.push({ purchaseOrderPrint: 'A4_multiple_pages', rows: 48, nativePrintDialog: 'simulated', physicalPrinter: false });
  assert.deepEqual(errors, []); assert.deepEqual(foreignRequests, []);
  assert.equal(calls.some(call => call.url.includes(token)), false, 'Capability must never enter request URLs');
  const report = { syntheticApi: true, businessDatabaseWrites: false, supplierMessagesSent: false, externalProviderCalls: false, browser: await browser.version(), results };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (failure) { console.error(failure); console.error(JSON.stringify({ browserErrors: errors })); if (failurePage) { await failurePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => undefined); await fs.writeFile(path.join(output, 'failure.html'), await failurePage.content()).catch(() => undefined); } process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
