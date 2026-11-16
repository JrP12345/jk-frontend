// Read-only landing QA and Lighthouse measurements against a local preview.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { fixture } from './landing-demo.mjs';

const origin = process.env.LANDING_QA_ORIGIN || 'http://localhost:3106';
const output = path.resolve(process.env.LANDING_QA_OUTPUT || '.next/brand-handoff/home-transformation');
if (!process.argv.includes('--lighthouse-only')) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/performance/review-connected-landing.mjs'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, LANDING_QA_ORIGIN: origin, LANDING_QA_OUTPUT: output } });
    child.once('error', reject); child.once('exit', resolve);
  });
  if (code !== 0) process.exit(code || 1);
}
if (!process.argv.some(value => ['--lighthouse', '--lighthouse-only'].includes(value))) process.exit(0);
await fs.mkdir(output, { recursive: true });
const toolRoot = process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022');
const requireTool = createRequire(path.join(toolRoot, 'package.json'));
const puppeteer = requireTool('puppeteer-core');
const { navigation } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/lighthouse/core/index.js')));
const { default: desktopConfig } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/lighthouse/core/config/desktop-config.js')));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', pipe: true, headless: true, args: ['--disable-background-networking', '--no-first-run', '--no-proxy-server'] });
const observations = [];
try {
  for (const desktop of [true, false]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const blockedWrites = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' };
        if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
        if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites.push(request.method() + ' ' + url.pathname); return request.respond({ status: 405, headers, body: '{}' }); }
        const value = fixture(url, 'patient', request.method());
        return request.respond({ status: value === undefined ? 401 : 200, headers, body: JSON.stringify(value ?? { success: false }) });
      }
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
      return request.abort();
    });
    const result = await navigation(page, origin, {
      flags: { logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] },
      ...(desktop ? { config: desktopConfig } : {}),
    });
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
    const profile = desktop ? 'desktop' : 'mobile';
    const observation = { profile, scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)])), metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, result.lhr.audits[key]?.numericValue])), errors, blockedWrites };
    observations.push(observation); console.log(JSON.stringify(observation));
    await fs.writeFile(path.join(output, profile + '-lighthouse.json'), JSON.stringify(result.lhr));
    await context.close();
  }
} finally {
  await fs.writeFile(path.join(output, 'lighthouse-summary.json'), JSON.stringify({ measuredAt: new Date().toISOString(), environment: 'Local production preview; isolated synthetic catalogue; no external services or writes', observations }, null, 2));
  await browser.close();
}
if (observations.some(row => row.errors.length || row.blockedWrites.length)) process.exitCode = 1;
