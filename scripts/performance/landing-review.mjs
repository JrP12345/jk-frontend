// Local, synthetic landing-page QA. Requires the existing external audit tools.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fixture } from './landing-demo.mjs';

const toolRoot = process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022');
const requireTool = createRequire(path.join(toolRoot, 'package.json'));
const puppeteer = requireTool('puppeteer-core');
const origin = process.env.LANDING_QA_ORIGIN || 'http://localhost:3092';
const output = path.resolve(process.env.LANDING_QA_OUTPUT || '.next/appointment-atelier-review');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-proxy-server'] });
const results = [];
try {
  for (const scenario of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 820, height: 1180, touch: true },
    { name: 'mobile', width: 390, height: 844, touch: true },
    { name: 'narrow-mobile', width: 320, height: 740, touch: true },
    { name: 'reduced-motion', width: 1440, height: 1000, reduced: true },
    { name: 'no-webgl', width: 1440, height: 1000, noWebgl: true },
    { name: 'no-javascript', width: 390, height: 844, noJs: true },
    { name: 'slow-mobile', width: 390, height: 844, touch: true, slow: true },
    { name: 'dark-desktop', width: 1440, height: 1000, dark: true },
  ].filter(scenario => !process.env.LANDING_QA_SCENARIOS || process.env.LANDING_QA_SCENARIOS.split(',').includes(scenario.name))) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const selectScreen = async selector => {
      await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.click(selector);
    };
    const errors = [], requests = [], consoleErrors = [], mutations = [];
    await page.setViewport({ width: scenario.width, height: scenario.height, isMobile: !!scenario.touch, hasTouch: !!scenario.touch });
    if (scenario.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (scenario.noJs) await page.setJavaScriptEnabled(false);
    await page.evaluateOnNewDocument((settings) => {
      if (settings.dark) localStorage.setItem('ekavyu-mode', 'dark');
      if (settings.noWebgl) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : getContext.call(this, type, ...args); };
      }
    }, scenario);
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      requests.push(url.pathname);
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method() + ' ' + url.pathname);
      try {
        if (url.pathname.startsWith('/api/')) {
          const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
          if (request.method() === 'OPTIONS') return await request.respond({ status: 204, headers: cors });
          const value = fixture(url, 'patient', request.method());
          return await request.respond({ status: value === undefined ? 401 : 200, contentType: 'application/json', headers: cors, body: JSON.stringify(value ?? { success: false }) });
        }
        if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return await request.continue();
        return await request.abort();
      } catch (error) { errors.push(error.message); }
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 700)); });
    page.on('requestfailed', request => consoleErrors.push(request.url().slice(0, 180) + ': ' + request.failure()?.errorText));
    if (scenario.slow) {
      const cdp = await page.createCDPSession();
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 90000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const response = await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForSelector('h1');
    if (!scenario.noJs) await new Promise(resolve => setTimeout(resolve, 1200));
    const row = { scenario: scenario.name, status: response.status(), errors, consoleErrors };
    row.view = await page.evaluate(() => ({
      heading: document.querySelector('h1')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth,
      canvas: document.querySelectorAll('main canvas').length,
      appointmentVisible: !!document.querySelector('[aria-label="The living appointment demonstration"]'),
      main: document.querySelectorAll('main').length,
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.getAttribute('href').slice(1))).map(a => a.getAttribute('href')),
    }));
    if (consoleErrors.length) console.log(JSON.stringify({ diagnostic: scenario.name, consoleErrors }));
    if (!scenario.noJs) {
      await page.addScriptTag({ path: requireTool.resolve('axe-core/axe.min.js') });
      row.accessibility = await page.evaluate(async () => {
        const report = await window.axe.run(document.querySelector('main').parentElement, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return { violations: report.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), passes: report.passes.length, incomplete: report.incomplete.map(v => v.id), incompleteDetails: report.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) };
      });
      if (scenario.name === 'mobile') {
        await page.click('button[aria-label="Open navigation"]');
        await page.waitForFunction(() => document.querySelector('button[aria-controls="home-mobile-navigation"]')?.getAttribute('aria-expanded') === 'true', { timeout: 10000 });
        row.menuOpened = await page.$eval('button[aria-controls="home-mobile-navigation"]', el => el.getAttribute('aria-expanded') === 'true');
        await page.keyboard.press('Escape');
        row.menuClosedWithFocus = await page.$eval('button[aria-controls="home-mobile-navigation"]', el => el.getAttribute('aria-expanded') === 'false' && el === document.activeElement);
      }
      const consultButton = '[aria-label="Explore an example appointment"] button:nth-child(4)';
      if (scenario.touch) await page.tap(consultButton);
      else { await page.focus(consultButton); await page.keyboard.press('Enter'); }
      await page.waitForFunction(() => document.getElementById('appointment-stage-story')?.textContent.includes('The doctor opens the consultation.'));
      row.appointmentStagesWork = true;
      await page.click('[aria-label="Explore an example appointment"] button:nth-child(2)');
      await selectScreen('[aria-label="Explore patient screens"] button:nth-child(2)');
      await page.waitForFunction(() => document.querySelector('#patient-product-screen img')?.getAttribute('src')?.includes('booking-desktop'));
      await page.$eval('#patient-product-screen', node => node.scrollIntoView());
      await page.waitForFunction(() => { const img = document.querySelector('#patient-product-screen img'); return img?.complete && img.naturalWidth > 0; });
      row.patientEvidenceWorks = true;
      await page.screenshot({ path: path.join(output, scenario.name + '-booking-evidence.png') });
      await selectScreen('[aria-label="Explore patient screens"] button:nth-child(1)');
      await selectScreen('[aria-label="Explore clinic screens"] button:nth-child(3)');
      await page.waitForFunction(() => document.querySelector('#clinic-product-screen img')?.getAttribute('src')?.includes('doctor-desktop'));
      await page.$eval('#clinic-product-screen', node => node.scrollIntoView());
      await page.waitForFunction(() => { const img = document.querySelector('#clinic-product-screen img'); return img?.complete && img.naturalWidth > 0; }).catch(async error => { throw new Error(error.message + ': ' + JSON.stringify(await page.$eval('#clinic-product-screen', node => ({ html: node.innerHTML, rect: node.getBoundingClientRect().toJSON(), scroll: window.scrollY }))) + JSON.stringify(consoleErrors)); });
      row.doctorEvidenceWorks = true;
      row.changedStateAccessibility = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector('main').parentElement, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })); });
      await selectScreen('[aria-label="Explore clinic screens"] button:nth-child(5)');
      await page.waitForFunction(() => document.querySelector('#clinic-product-screen img')?.getAttribute('src')?.includes('overview-desktop'));
      await page.$eval('#clinic-product-screen', node => node.scrollIntoView());
      await page.waitForFunction(() => { const img = document.querySelector('#clinic-product-screen img'); return img?.complete && img.naturalWidth > 0; }).catch(async error => { throw new Error(error.message + ': ' + JSON.stringify(await page.$eval('#clinic-product-screen', node => ({ html: node.innerHTML, rect: node.getBoundingClientRect().toJSON(), scroll: window.scrollY }))) + JSON.stringify(consoleErrors)); });
      row.fullSizeScreenshotLink = await page.$eval('#clinic-product-screen a[target="_blank"]', link => link.getAttribute('href') === '/landing/product/overview-desktop.webp');
      row.ownerPerspectiveWorks = true;
      await selectScreen('[aria-label="Explore clinic screens"] button:nth-child(1)');
    }
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    if (['desktop', 'mobile', 'tablet', 'dark-desktop'].includes(scenario.name)) {
      await page.screenshot({ path: path.join(output, scenario.name + '-hero.png') });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 50)); } });
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading current plans"]'), { timeout: 10000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, scenario.name + '-full.png'), fullPage: true });
    }
    if (process.argv.includes('--lighthouse') && ['desktop', 'mobile'].includes(scenario.name)) {
      const { navigation, generateReport } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/lighthouse/core/index.js')));
      const { default: desktop } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/lighthouse/core/config/desktop-config.js')));
      const result = await navigation(page, origin, { flags: { logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, ...(scenario.name === 'desktop' ? { config: desktop } : {}) });
      if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
      row.lighthouse = { scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)])), metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift'].map(k => [k, result.lhr.audits[k]?.numericValue])) };
      await fs.writeFile(path.join(output, scenario.name + '-lighthouse.json'), JSON.stringify(result.lhr));
      await fs.writeFile(path.join(output, scenario.name + '-lighthouse.html'), generateReport(result.lhr, 'html'));
    }
    row.apiMutations = mutations;
    row.passed = row.status === 200 && !errors.length && !row.view.overflow && row.view.main === 1 && !row.view.brokenAnchors.length && !row.accessibility?.violations.length && !row.changedStateAccessibility?.length && row.view.canvas === 0 && row.view.appointmentVisible;
    if (!scenario.noJs) row.passed &&= row.appointmentStagesWork && row.patientEvidenceWorks && row.doctorEvidenceWorks && row.ownerPerspectiveWorks && row.fullSizeScreenshotLink && mutations.length === 0;
    if (scenario.name === 'mobile') row.passed &&= row.menuOpened && row.menuClosedWithFocus;
    results.push(row);
    console.log(JSON.stringify({ ...row, ...(row.accessibility ? { accessibility: { ...row.accessibility, incompleteDetails: undefined } } : {}) }));
    await context.close();
  }
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some(row => !row.passed)) process.exitCode = 1;
