// Real owner components in Chrome with synthetic local GET responses only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/supplier-tools', 'tool.cjs'))('playwright-core');
const { build } = createRequire(path.resolve('../backend', 'tool.cjs'))('esbuild');
const output = path.resolve('.next/pharmacy-daily-overview-acceptance'); await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: "export { dailyOverviewFixture } from './src/tests/fixtures/pharmacyDailyOverview';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(output, 'data.mjs'), logLevel: 'silent' });
const { dailyOverviewFixture } = await import(pathToFileURL(path.join(output, 'data.mjs')).href);
await fs.writeFile(path.join(output, 'api.ts'), `export const getApiUrl=()=>location.origin+'/api';export default{async get(path,options){const url=new URL('/api'+path,location.origin);url.searchParams.set('variant',window.dailyProbe.variant);const response=await fetch(url,{signal:options?.signal});if(!response.ok)throw Error('Synthetic read failed');return{data:await response.json()}}};`);
await build({ stdin: { contents: `
import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{PharmacyDailyOverview}from'./src/components/pharmacy/PharmacyDailyOverview';import{ToastProvider}from'./src/components/ui';import{useAuthStore}from'./src/store/authStore';
useAuthStore.setState({user:{id:'synthetic-owner',name:'Owner',email:'owner@example.test',role:'admin',organization_id:'synthetic-org',permissions:['MANAGE_ORGANIZATION']}});
const root=createRoot(document.getElementById('root'));window.dailyProbe={variant:'ready',mount(variant){this.variant=variant;this.selected=null;flushSync(()=>root.render(<ToastProvider key={variant}><PharmacyDailyOverview locationId={'b'.repeat(24)} canViewStock canViewDrawer onStock={()=>{window.dailyProbe.selected='stock'}} onDrawer={()=>{window.dailyProbe.selected='drawer'}} onReport={(kind,date)=>{window.dailyProbe.selected={kind,date}}}/></ToastProvider>))}};
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}', 'process.browser': 'true' }, outfile: path.join(output, 'fixture.js'), loader: { '.module.css': 'local-css' }, logLevel: 'silent', plugins: [{ name: 'synthetic-api', setup(plugin) { plugin.onResolve({ filter: /^(?:@\/lib\/api|\.\/api)$/ }, args => args.path === '@/lib/api' || /[/\\]src[/\\]lib[/\\]/.test(args.importer) ? { path: path.join(output, 'api.ts') } : undefined); } }] });
let cssRoot;
for (const candidate of ['.next/supplier-verification/static/chunks', '.next/pharmacy-ux-audit/static/chunks', '.next/vercel-origin-verification/static/chunks', '.next/static/chunks']) {
  try { if ((await fs.readdir(candidate)).some(name => name.endsWith('.css'))) { cssRoot = candidate; break; } } catch { /* Try another existing build. */ }
}
assert(cssRoot, 'Existing built shared CSS is required');
await fs.writeFile(path.join(output, 'global.css'), (await Promise.all((await fs.readdir(cssRoot)).filter(name => name.endsWith('.css')).map(name => fs.readFile(path.join(cssRoot, name), 'utf8')))).join('\n'));
const results = [], errors = [], external = [], requests = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); requests.push({ method: req.method, path: url.pathname });
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' || url.pathname !== '/api/pharmacy/daily-overview') { res.writeHead(405).end(); return; }
    const data = dailyOverviewFixture(), variant = url.searchParams.get('variant');
    if (variant === 'offline') { data.coverage.offlineSession = 'expired'; data.paymentReview = 2; }
    if (variant === 'unknown') { data.sections.margin.values.costPaise = null; data.sections.margin.values.contributionPaise = null; data.sections.margin.values.unknownBills = 1; data.sections.newCredit.values = { amountPaise: null, bills: null, unknownBills: 1 }; }
    if (variant === 'restricted') { for (const key of ['margin', 'customerDues', 'supplierDues', 'newCredit', 'cashMovements']) data.sections[key] = { state: 'restricted', values: null, items: [], note: 'Independent source permission required.' }; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ data })); return;
  }
  const file = { '/fixture.js': ['fixture.js', 'text/javascript'], '/fixture.css': ['fixture.css', 'text/css'], '/global.css': ['global.css', 'text/css'] }[url.pathname];
  if (file) { res.writeHead(200, { 'Content-Type': file[1] }).end(await fs.readFile(path.join(output, file[0]))); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:var(--surface);color:var(--text);font-family:Arial,sans-serif}*{box-sizing:border-box}#root{max-width:1200px;margin:auto}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`; let browser, page;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  const context = await browser.newContext(); await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); external.push(url.origin); return route.abort(); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin); await page.waitForFunction(() => Boolean(window.dailyProbe));
    for (const variant of ['ready', 'offline', 'unknown', 'restricted']) {
      await page.evaluate(variant => window.dailyProbe.mount(variant), variant); await page.getByText(/Business day 2026-11-22/).waitFor();
      if (variant === 'offline') { await page.getByText('Local counter still needs reconciliation', { exact: true }).waitFor(); await page.getByText('Online payments need review', { exact: true }).waitFor(); }
      if (variant === 'unknown') { assert.equal(await page.getByRole('article', { name: 'Gross contribution', exact: true }).getByText('Unknown', { exact: true }).count(), 1); assert.equal(await page.getByRole('article', { name: 'Customer credit created', exact: true }).getByText('Unknown', { exact: true }).count(), 1); }
      if (variant === 'restricted') assert.equal(await page.getByRole('button', { name: 'Review gross contribution source', exact: true }).count(), 0);
      const details = page.getByRole('article', { name: 'Sales issued', exact: true }).getByText('Details and source', { exact: true }); await details.click(); await page.getByRole('button', { name: 'Review sales issued source', exact: true }).click(); assert.deepEqual(await page.evaluate(() => window.dailyProbe.selected), { kind: 'sales', date: '2026-11-22' }); await details.click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${variant} overflows at ${width}px`);
      results.push({ width, variant, documentOverflow: false }); if (width === 390 && ['ready', 'offline'].includes(variant)) await page.screenshot({ path: path.join(output, `${variant}-390.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(requests.some(row => row.method !== 'GET'), false);
  const report = { syntheticApi: true, externalProviderCalls: false, businessDatabaseWrites: false, browser: await browser.version(), results, requests: requests.length }; await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (failure) { if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error(failure); console.error(JSON.stringify({ errors, external })); process.exitCode = 1; }
finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
