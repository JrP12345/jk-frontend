// Read-only conversion-route checks against the local production preview.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fixture } from './fixtures.mjs';

const requireTool = createRequire(path.join(process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022'), 'package.json'));
const puppeteer = requireTool('puppeteer-core');
const origin = process.env.LANDING_QA_ORIGIN || 'http://127.0.0.1:3097';
const output = path.resolve(process.env.LANDING_QA_OUTPUT || '.next/landing-refinement-final-review');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-first-run', '--no-proxy-server'] });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [], blockedWrites = [];
    await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 1000 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      try {
        if (url.pathname.startsWith('/api/')) {
          const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type, authorization' };
          if (request.method() === 'OPTIONS') return await request.respond({ status: 204, headers });
          if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites.push(request.method() + ' ' + url.pathname); return await request.respond({ status: 405, headers }); }
          const value = fixture(url, 'patient', request.method());
          return await request.respond({ status: value === undefined ? 401 : 200, contentType: 'application/json', headers, body: JSON.stringify(value ?? { success: false }) });
        }
        if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return await request.continue();
        await request.abort();
      } catch (error) { errors.push(error.message); }
    });
    page.on('pageerror', error => errors.push(error.message));
    const checks = [];
    for (const target of [
      { selector: 'main a[href="/browse"]', pathname: '/browse', heading: 'Find a', expected: 'Synthetic Audit Clinic' },
      { selector: 'footer a[href="/pricing"]', pathname: '/pricing', heading: 'Plans for your practice', expected: 'Compare all limits and features' },
      { selector: 'main a[href="/onboarding?mode=new_org"]', pathname: '/onboarding', heading: 'Request organization setup', expected: 'Submit setup request' },
    ]) {
      await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
      await page.click(target.selector);
      await page.waitForFunction(pathname => location.pathname === pathname, { timeout: 30000 }, target.pathname);
      await page.waitForFunction(text => document.querySelector('h1')?.textContent.includes(text), { timeout: 30000 }, target.heading);
      await page.waitForFunction(text => document.body.innerText.includes(text), { timeout: 30000 }, target.expected);
      if (target.pathname === '/pricing') {
        await page.click('[aria-label="Billing cycle"] button:nth-child(2)');
        await page.waitForFunction(() => document.querySelector('[aria-label="Billing cycle"] button:nth-child(2)')?.getAttribute('aria-pressed') === 'true');
      }
      const check = { route: target.pathname, heading: await page.$eval('h1', node => node.textContent), passed: true };
      checks.push(check);
      await page.screenshot({ path: path.join(output, `${mobile ? 'mobile' : 'desktop'}-route-${target.pathname.slice(1)}.png`) });
    }
    results.push({ viewport: mobile ? 'mobile' : 'desktop', checks, errors, blockedWrites, passed: !errors.length });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
} finally {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'journeys.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.length !== 2 || results.some(result => !result.passed)) process.exitCode = 1;
