// Actual settings component and compiled app styles, with synthetic API functions only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd(), dist = path.resolve(process.env.PHARMACY_NUMBERING_DIST || '.next/pharmacy-numbering-build');
const output = path.resolve('.next/pharmacy-numbering-ui-acceptance'); await fs.mkdir(output, { recursive: true });
const { build } = createRequire(path.resolve(process.env.PHARMACY_BROWSER_BUNDLER_ROOT || '../backend', 'tool.cjs'))('esbuild');
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'))('playwright-core');
await build({ stdin: { contents: `
import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {PharmacyInvoiceNumberingSettings} from './src/components/pharmacy/PharmacyInvoiceNumberingSettings';
import {useAuthStore} from './src/store/authStore'; import api from './src/lib/api';
const initial={organizationId:'org',locationId:'branch',revision:0,financialYear:'2026-27',configuration:null,nextNumber:null,preview:null};
let row=initial; window.numberingRequests=[];
api.get=async()=>({data:{data:row}});
api.put=async(url,input)=>{window.numberingRequests.push({url,input});row={...initial,revision:input.expectedRevision+1,configuration:{prefixTemplate:input.prefixTemplate,digits:input.digits,resetPolicy:input.resetPolicy,reviewReference:input.reviewReference},nextNumber:input.nextNumber,preview:input.prefixTemplate.replace('{FY}','26-27')+String(input.nextNumber).padStart(input.digits,'0')}; return {data:{data:row}};};
useAuthStore.setState({user:{id:'owner',name:'Synthetic owner',email:'owner@example.test',role:'admin',organization_id:'org',permissions:['MANAGE_ORGANIZATION']}});
function App(){const [busy,setBusy]=useState(false);return <main style={{maxWidth:640,margin:'24px auto',padding:20}}><h1>Pharmacy invoice numbering</h1><PharmacyInvoiceNumberingSettings locationId="branch" organizationId="org" disabled={busy} onBusyChange={setBusy}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  outfile: path.join(output, 'browser.js'), alias: { '@': path.join(root, 'src') }, loader: { '.module.css': 'local-css' },
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://example.invalid/api' }) }, logLevel: 'silent' });
const assets = new Map();
for await (const file of fs.glob('static/**/*', { cwd: dist })) if ((await fs.stat(path.join(dist, file))).isFile()) assets.set('/_next/' + file.replaceAll('\\', '/'), path.join(dist, file));
const styles = [...assets.keys()].filter(name => name.endsWith('.css')); assert.ok(styles.length, 'Build the isolated Next package first');
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map(url => `<link rel="stylesheet" href="${url}">`).join('')}<link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script src="/browser.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(html); return; }
  const file = req.url === '/browser.js' || req.url === '/browser.css' ? path.join(output, req.url.slice(1)) : assets.get(req.url);
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' }).end(await fs.readFile(file));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
let browser; const results = [];
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  for (const width of [900, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin); await page.getByText('This branch currently uses system numbering.').waitFor();
    await page.getByLabel('Invoice prefix *').fill('PJP/{FY}/'); await page.getByLabel('Next invoice number *').fill('137');
    await page.getByLabel('Numbering review reference *').fill('Synthetic owner review');
    await page.getByText('I confirm this branch series and next number', { exact: true }).click();
    await page.getByRole('button', { name: 'Save invoice numbering', exact: true }).click();
    await page.getByText('Numbering saved. Next available invoice: PJP/26-27/000137.').waitFor();
    const requests = await page.evaluate(() => window.numberingRequests);
    assert.equal(requests.length, 1); assert.equal(requests[0].input.expectedFinancialYear, '2026-27'); assert.equal(requests[0].input.nextNumber, 137);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
    await page.screenshot({ path: path.join(output, `numbering-${width}.png`), fullPage: true }); assert.deepEqual(errors, []);
    results.push({ width, savedOnce: true, preview: 'PJP/26-27/000137', horizontalOverflow: false }); await context.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ syntheticOnly: true, results }, null, 2)); console.log(JSON.stringify(results));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
