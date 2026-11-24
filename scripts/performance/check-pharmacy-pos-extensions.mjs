// Real components in headless Chrome; all API/provider data is synthetic and local.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const browserTools = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/supplier-tools', 'tool.cjs'));
const buildTools = createRequire(path.resolve('../backend', 'tool.cjs'));
const { chromium } = browserTools('playwright-core'), { build } = buildTools('esbuild');
const output = path.resolve('.next/pharmacy-pos-acceptance'); await fs.mkdir(output, { recursive: true });
const locationId = 'b'.repeat(24), partyId = 'c'.repeat(24), medicineId = 'd'.repeat(24), digest = 'a'.repeat(64);
await fs.writeFile(path.join(output, 'api.ts'), `async function request(method,path,input,options={}){const url=new URL('/api'+path,window.location.origin);for(const [key,value]of Object.entries(options.params||{}))if(value!==undefined)url.searchParams.set(key,String(value));const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...options.headers},...(input?{body:JSON.stringify(input)}:{}),signal:options.signal});if(options.responseType==='blob')return{data:await response.blob(),headers:Object.fromEntries(response.headers)};const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message),{response:{status:response.status,data}});return{data};}export default{get:(path,options)=>request('GET',path,undefined,options),post:(path,input,options)=>request('POST',path,input,options),put:(path,input,options)=>request('PUT',path,input,options)};export const getApiUrl=()=>window.location.origin+'/api';`);
await build({ stdin: { contents: `
import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{PharmacyReports}from'./src/components/pharmacy/PharmacyReports';import{PharmacyAlternatives}from'./src/components/pharmacy/PharmacyAlternatives';import{PharmacyCustomerReminders}from'./src/components/pharmacy/PharmacyCustomerReminders';import{PharmacyInvoiceExtraction}from'./src/components/pharmacy/PharmacyInvoiceExtraction';
import{ToastProvider}from'./src/components/ui';import{useAuthStore}from'./src/store/authStore';
useAuthStore.setState({user:{id:'synthetic-owner',name:'Synthetic owner',email:'synthetic@example.test',role:'admin',organization_id:'synthetic-org',permissions:['MANAGE_ORGANIZATION','PHARMACY_VIEW_REPORTS']}});
const root=createRoot(document.getElementById('root'));window.posProbe={mount(mode){const props={locationId:'${locationId}',onClose:()=>{}};flushSync(()=>root.render(<ToastProvider key={mode}>{mode==='reports'?<PharmacyReports {...props}/>:mode==='alternatives'?<PharmacyAlternatives {...props} medicineId='${medicineId}'/>:mode==='reminders'?<PharmacyCustomerReminders {...props} partyId='${partyId}'/>:<PharmacyInvoiceExtraction {...props} supplierId='${partyId}' onCsv={csv=>{window.posProbe.csv=csv}}/>}</ToastProvider>))}};
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}', 'process.browser': 'true' }, outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent', plugins: [{ name: 'local-synthetic-api', setup(plugin) { plugin.onResolve({ filter: /^(?:@\/lib\/api|\.\/api)$/ }, args => args.path === '@/lib/api' || /[/\\]src[/\\]lib[/\\]/.test(args.importer) ? { path: path.join(output, 'api.ts') } : undefined); } }] });
let cssRoot;
for (const candidate of [process.env.PHARMACY_POS_CSS_ROOT, '.next/supplier-verification/static/chunks', '.next/pharmacy-ux-audit/static/chunks', '.next/vercel-origin-verification/static/chunks', '.next/static/chunks'].filter(Boolean)) { try { if ((await fs.readdir(candidate)).some(name => name.endsWith('.css'))) { cssRoot = candidate; break; } } catch {} }
assert(cssRoot, 'Existing built shared styles are required for the browser probe');
await fs.writeFile(path.join(output, 'global.css'), (await Promise.all((await fs.readdir(cssRoot)).filter(name => name.endsWith('.css')).map(name => fs.readFile(path.join(cssRoot, name), 'utf8')))).join('\n'));
const product = { id: medicineId, name: 'Synthetic medicine with a deliberately long descriptive brand name', genericName: 'Synthetic generic', strength: '10 mg', dosageForm: 'tablet', stockQuantity: 20, retailPricePaise: 1000, eligible: true, unitDefinition: { version: 1, baseUnit: 'tablet', packUnit: 'strip', unitsPerPack: 10 } };
const send = (res, data, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ success: status === 200, ...(status === 200 ? { data } : { message: data }) }));
const calls = [], errors = [], external = [], results = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null; calls.push({ method: req.method, path: url.pathname });
    const p = url.pathname.slice(4);
    if (p === '/pharmacy/reports') return send(res, { locationId, items: [{ kind: 'gross_margin', label: 'Sales margin after return credits' }] });
    if (p.startsWith('/pharmacy/reports/')) { const rows = [{ id: 'source', number: 'I-SYNTHETIC', netRevenuePaise: 2000, costPaise: 200, marginPaise: 1800 }], columns = [{ key: 'number', label: 'Invoice', format: 'text' }, ...[['netRevenuePaise','Sales after credits'],['costPaise','Captured cost'],['marginPaise','Contribution']].map(([key,label])=>({key,label,format:'paise'}))]; return send(res, { kind: 'gross_margin', label: 'Sales margin after return credits', locationId, currency: 'INR', timezone: 'Asia/Kolkata', asOf: '2026-11-22T09:00:00.000Z', startDate: '2026-10-24', endDate: '2026-11-22', days: Number(url.searchParams.get('days') || 90), limit: Number(url.searchParams.get('limit') || 25), cursor: null, nextCursor: null, digest, totalScope: p.endsWith('/complete') ? 'complete' : 'page', totals: { netRevenuePaise: 2000, costPaise: 200, marginPaise: 1800 }, rows, columns, scanned: 1, basis: 'Synthetic captured contribution; not net profit.' }); }
    if (p.endsWith('/alternatives')) return send(res, { locationId, source: product, items: [{ ...product, id: 'e'.repeat(24), name: 'Synthetic comparison brand' }], nextCursor: null, basis: 'Exact recorded generic, strength, form and units. Pharmacist review required.' });
    if (p === '/pharmacy/customer-reminders') return send(res, { locationId, partyId, customerName: 'Synthetic customer', email: 'synthetic@example.test', archived: false, emailConfigured: false, items: [], nextCursor: null });
    if (p === '/pharmacy/report-exports') return send(res, { id: 'export', locationId, requestKey: req.headers['idempotency-key'] });
    if (p.startsWith('/pharmacy/report-exports/')) return send(res, { id: 'export', locationId, requestKey: p.split('/').at(-1), kind: 'gross_margin', state: 'ready', expiresAt: '2099-12-31T00:00:00.000Z', digest, summary: { label: 'Synthetic prepared margin', timezone: 'Asia/Kolkata', asOf: '2026-11-22T09:00:00.000Z', startDate: '2026-10-24', endDate: '2026-11-22', rows: 2500, scanned: 2500, totals: {}, amountColumns: [], basis: 'Synthetic snapshot only', totalScope: 'complete' } });
    if (p === '/pharmacy/invoice-extractions') return send(res, { id: 'extraction', locationId, supplierId: partyId, requestKey: req.headers['idempotency-key'] });
    if (p.startsWith('/pharmacy/invoice-extractions/')) return send(res, { id: 'extraction', locationId, supplierId: partyId, requestKey: p.split('/').at(-1), status: 'succeeded', extracted: { supplier: 'Synthetic supplier', invoiceNumber: 'SYNTHETIC-ONLY', invoiceDate: '22/11/2026', invoiceTotal: '100.00', rows: [{ line: 1, description: 'Synthetic medicine', productCode: '001', quantity: '2', unit: 'strips', unitPrice: '50.00', amount: '100.00', taxRate: '', confidencePercent: 87 }] } });
    return send(res, `Unexpected synthetic contract ${p}`, 404);
  }
  const file = { '/fixture.js': ['fixture.js', 'text/javascript'], '/fixture.css': ['fixture.css', 'text/css'], '/global.css': ['global.css', 'text/css'] }[url.pathname];
  if (file) { res.writeHead(200, { 'Content-Type': file[1] }).end(await fs.readFile(path.join(output, file[0]))); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:var(--surface);color:var(--text);font-family:Arial,sans-serif}*{box-sizing:border-box}#root{max-width:1100px;margin:auto}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`; let browser, page;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext(); await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); external.push(url.origin); return route.abort(); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin); await page.waitForFunction(() => Boolean(window.posProbe)); await page.evaluate(() => sessionStorage.clear());
    for (const mode of ['reports', 'alternatives', 'reminders', 'ocr']) {
      await page.evaluate(mode => window.posProbe.mount(mode), mode);
      if (mode === 'reports') { await page.getByRole('button', { name: 'Load complete report' }).click(); await page.getByRole('region', { name: 'Reviewed report page' }).waitFor(); await page.getByText('Prepare a larger report in the background').click(); await page.getByRole('button', { name: 'Prepare background CSV export' }).click(); await page.getByRole('button', { name: 'Check background export' }).click(); await page.getByText('Synthetic prepared margin', { exact: true }).waitFor(); }
      if (mode === 'alternatives') await page.getByText('Synthetic comparison brand', { exact: true }).waitFor();
      if (mode === 'reminders') await page.getByText('Email delivery is not configured', { exact: true }).waitFor();
      if (mode === 'ocr') { await page.getByText('Extract a supplier invoice PDF or photo').click(); await page.getByLabel('Invoice PDF or photo').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic only\n%%EOF') }); await page.getByText('I authorize sending this supplier invoice to the configured OCR provider', { exact: true }).click(); await page.getByRole('button', { name: 'Extract invoice text' }).click(); await page.getByRole('button', { name: 'Check extraction status' }).click(); await page.getByRole('table', { name: 'Unreviewed invoice text' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Use reviewed text in CSV mapping' }).isDisabled(), true); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert.equal(overflow, false, `${mode} overflows ${width}px`);
      results.push({ mode, width, documentOverflow: false }); if (width === 390) await page.screenshot({ path: path.join(output, `${mode}-390.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  const report = { syntheticApi: true, externalProviderCalls: false, businessDatabaseWrites: false, browser: await browser.version(), results, requests: calls.length };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (failure) { if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error(failure); console.error(JSON.stringify({ errors, external })); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
