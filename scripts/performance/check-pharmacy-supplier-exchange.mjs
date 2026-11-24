// Real components and file APIs in Chrome. Synthetic read-only server; no business DB or provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const browserTools = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/supplier-tools', 'tool.cjs'));
const { chromium } = browserTools('playwright-core'), { build } = createRequire(path.resolve('../backend', 'tool.cjs'))('esbuild');
const output = path.resolve('.next/pharmacy-supplier-exchange'); await fs.mkdir(output, { recursive: true });
const locationId = 'b'.repeat(24), results = [], errors = [], external = [], requests = [];
await fs.writeFile(path.join(output, 'api.ts'), `export default{async get(path,options){const response=await fetch('/api'+path,{signal:options?.signal});if(!response.ok)throw Error('Synthetic availability failed');return{data:await response.json()}}};`);
await build({ stdin: { contents: `
import React,{useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{PharmacySupplierResponseFile}from'./src/components/pharmacy/PharmacySupplierResponseFile';import{PharmacyCounterAvailabilityNotice}from'./src/components/pharmacy/PharmacyCounterAvailabilityNotice';import{usePharmacyCounterAvailability}from'./src/hooks/usePharmacyCounterAvailability';
import{supplierResponseTemplate}from'./src/lib/pharmacySupplierExchange';import{orderFixture}from'./src/tests/fixtures/pharmacyPurchaseOrder';import{ToastProvider}from'./src/components/ui';
const order=orderFixture({state:'submitted',status:'submitted',revision:2});
function Supplier(){const[lines,setLines]=useState(null),[busy,setBusy]=useState(false);return <><h1>Supplier response review</h1><PharmacySupplierResponseFile order={order} disabled={false} onBusyChange={setBusy} onReview={rows=>setLines(rows)}/>{lines&&<p role='status'>Ready for review: {lines[0].acceptedQuantity} tablet at {lines[0].quotedUnitPricePaise} paise per tablet</p>}<button disabled={busy||!lines}>Review actual communication</button></>}
function Counter(){const state=usePharmacyCounterAvailability('${locationId}');return <><h1>Branch counter availability</h1><PharmacyCounterAvailabilityNotice {...state} onRefresh={()=>state.refresh()}/><label>Prepare a cart<input/></label><button disabled={state.blocked}>Save new bill</button></>}
const root=createRoot(document.getElementById('root'));window.exchangeProbe={template:supplierResponseTemplate(order),oldTemplate:supplierResponseTemplate({...order,revision:1}),mount(mode){flushSync(()=>root.render(<ToastProvider key={mode}>{mode==='supplier'?<Supplier/>:<Counter/>}</ToastProvider>))}};
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}', 'process.browser': 'true' }, outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent', plugins: [{ name: 'synthetic-api', setup(plugin) { plugin.onResolve({ filter: /^(?:@\/lib\/api|\.\/api)$/ }, args => args.path === '@/lib/api' || /[/\\]src[/\\]lib[/\\]/.test(args.importer) ? { path: path.join(output, 'api.ts') } : undefined); } }] });
let cssRoot;
for (const candidate of ['.next/supplier-verification/static/chunks', '.next/pharmacy-ux-audit/static/chunks', '.next/vercel-origin-verification/static/chunks', '.next/static/chunks']) {
  try { if ((await fs.readdir(candidate)).some(name => name.endsWith('.css'))) { cssRoot = candidate; break; } } catch { /* Try the next existing local build. */ }
}
assert(cssRoot, 'Existing built shared styles are required');
await fs.writeFile(path.join(output, 'global.css'), (await Promise.all((await fs.readdir(cssRoot)).filter(name => name.endsWith('.css')).map(name => fs.readFile(path.join(cssRoot, name), 'utf8')))).join('\n'));
const server = http.createServer(async (req, res) => {
  requests.push({ method: req.method, path: req.url });
  if (req.url.startsWith('/api/')) {
    if (req.method !== 'GET' || !req.url.endsWith('/counter-availability')) { res.writeHead(405).end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ data: { locationId, mode: 'offline_reconciliation', checkedAt: new Date().toISOString(), offline: { deviceName: 'Main pharmacy counter PC', currentOperator: false, validUntil: '2026-11-20T00:00:00.000Z' } } })); return;
  }
  const file = { '/fixture.js': ['fixture.js', 'text/javascript'], '/fixture.css': ['fixture.css', 'text/css'], '/global.css': ['global.css', 'text/css'] }[req.url];
  if (file) { res.writeHead(200, { 'Content-Type': file[1] }).end(await fs.readFile(path.join(output, file[0]))); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:var(--surface);color:var(--text);font-family:Arial,sans-serif}*{box-sizing:border-box}#root{max-width:1000px;margin:auto}h1{font-size:20px;margin-bottom:16px}input[type=file]{max-width:100%}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`; let browser, page;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); external.push(url.origin); return route.abort(); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin); await page.waitForFunction(() => Boolean(window.exchangeProbe));
    for (const mode of ['supplier', 'counter']) {
      await page.evaluate(mode => window.exchangeProbe.mount(mode), mode);
      if (mode === 'supplier') {
        await page.getByText('Supplier response CSV', { exact: true }).click();
        const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download supplier response template' }).click();
        const download = await downloadPromise; assert.match(download.suggestedFilename(), /supplier-response-.*-r2.csv/);
        const downloaded = await fs.readFile(await download.path(), 'utf8'); assert.match(downloaded, /"21","","",""$/);
        const old = await page.evaluate(() => window.exchangeProbe.oldTemplate);
        await page.getByLabel('Returned supplier response CSV').setInputFiles({ name: 'old.csv', mimeType: 'text/csv', buffer: Buffer.from(old) });
        await page.getByText(/differs from this order, revision/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Review actual communication' }).isDisabled(), true);
        const csv = await page.evaluate(() => window.exchangeProbe.template.replace(/"21","","",""$/, '"21","7","1.05","Only seven available"'));
        await page.getByLabel('Returned supplier response CSV').setInputFiles({ name: 'supplier-response.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await page.getByText('Ready for review: 7 tablet at 105 paise per tablet', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Review actual communication' }).isDisabled(), false);
      } else {
        await page.getByText('Branch reserved for the designated offline PC', { exact: true }).waitFor(); await page.getByText(/Expiry does not release stock/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save new bill' }).isDisabled(), true); await page.getByLabel('Prepare a cart').fill('Retained draft');
        await page.getByRole('button', { name: 'Refresh counter availability' }).click(); assert.equal(await page.getByLabel('Prepare a cart').inputValue(), 'Retained draft');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${mode} overflows ${width}px`);
      results.push({ mode, width, documentOverflow: false }); if (width === 390) await page.screenshot({ path: path.join(output, `${mode}-390.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(requests.some(row => row.method !== 'GET'), false);
  const report = { syntheticApi: true, externalProviderCalls: false, businessDatabaseWrites: false, browser: await browser.version(), results, requests: requests.length };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (failure) { if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error(failure); console.error(JSON.stringify({ errors, external })); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
