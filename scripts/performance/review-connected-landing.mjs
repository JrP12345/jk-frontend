import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fixture } from './landing-demo.mjs';

const requireTool = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireAudit = createRequire(path.join(process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022'), 'package.json'));
const { chromium } = requireTool('playwright-core');
const origin = process.env.LANDING_QA_ORIGIN || 'http://localhost:3106';
const output = path.resolve(process.env.LANDING_QA_OUTPUT || 'docs/landing-page/connected/review');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--no-first-run'] });
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
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, isMobile: !!scenario.touch, hasTouch: !!scenario.touch, javaScriptEnabled: !scenario.noJs, reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(), errors = [], consoleErrors = [], writes = [];
    await context.addInitScript(settings => {
      localStorage.setItem('ekavyu-mode', settings.dark ? 'dark' : 'light');
      if (settings.noWebgl) { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); }; }
    }, scenario);
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type, authorization' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method() + ' ' + url.pathname); return route.fulfill({ status: 405, headers }); }
        const value = fixture(url, 'patient', request.method());
        return route.fulfill({ status: value === undefined ? 401 : 200, headers, json: value ?? { success: false } });
      }
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      return route.abort();
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
    if (scenario.slow) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 90000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const response = await page.goto(origin, { waitUntil: 'networkidle', timeout: 90000 });
    await page.locator('h1').waitFor();
    const row = { scenario: scenario.name, status: response.status(), errors, consoleErrors };
    row.layout = await page.evaluate(() => ({ heading: document.querySelector('h1').textContent, main: document.querySelectorAll('main').length, overflow: document.documentElement.scrollWidth > innerWidth, canvas: document.querySelectorAll('main canvas').length, brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')) }));
    if (!scenario.noJs) {
      await page.addScriptTag({ path: requireAudit.resolve('axe-core/axe.min.js') });
      const audit = async () => page.evaluate(async () => {
        const result = await window.axe.run(document.querySelector('main').parentElement, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return { violations: result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), incomplete: result.incomplete.map(item => item.id) };
      });
      row.accessibility = await audit();
      const select = async locator => { await locator.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await locator.click(); };
      if (scenario.name === 'mobile') {
        const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
        await toggle.click(); await page.keyboard.press('Escape');
        row.menuFocusRecovered = await toggle.evaluate(node => document.activeElement === node && node.getAttribute('aria-expanded') === 'false');
      }
      const consult = page.getByRole('group', { name: 'Explore an example appointment' }).getByRole('button', { name: /Consult/ });
      await consult.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await consult.focus(); await consult.press('Enter');
      await page.getByText('The doctor opens the consultation.', { exact: true }).waitFor();
      row.keyboardStageWorks = true;
      row.evidence = [];
      for (const audience of ['patient', 'clinic', 'communications']) {
        const controls = page.getByRole('group', { name: `Explore ${audience} screens`, exact: true });
        const buttons = controls.getByRole('button');
        for (let index = 0; index < await buttons.count(); index++) {
          const button = buttons.nth(index), label = await button.textContent();
          await select(button);
          const image = page.locator(`#${audience}-product-screen img`);
          await image.scrollIntoViewIfNeeded();
          await page.waitForFunction(selector => { const image = document.querySelector(selector); return image?.complete && image.naturalWidth > 0; }, `#${audience}-product-screen img`, { timeout: 20000 });
          row.evidence.push({ audience, label, pressed: await button.getAttribute('aria-pressed'), source: await image.evaluate(node => node.currentSrc) });
          if (['desktop', 'mobile'].includes(scenario.name) && ['Doctor', 'WhatsApp delivery'].includes(label)) await page.screenshot({ path: path.join(output, `${scenario.name}-${audience}-detail.png`) });
        }
        await select(buttons.first());
      }
      const whatsappQuestion = page.locator('summary').filter({ hasText: 'What can clinics send through WhatsApp?' });
      await select(whatsappQuestion);
      row.whatsappDisclosure = await whatsappQuestion.evaluate(node => node.parentElement.open && node.parentElement.textContent.includes('recorded consent'));
      row.changedStateAccessibility = await audit();
      await select(whatsappQuestion);
      await select(page.getByRole('group', { name: 'Explore an example appointment' }).getByRole('button', { name: /Book/ }));
    }
    if (['desktop', 'tablet', 'mobile', 'dark-desktop'].includes(scenario.name)) {
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 70)); } });
      if (!scenario.noJs) await page.getByText('Essential demo', { exact: true }).waitFor({ timeout: 20000 });
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
      await page.screenshot({ path: path.join(output, scenario.name + '-hero.png') });
      await page.screenshot({ path: path.join(output, scenario.name + '-full.png'), fullPage: true });
      if (['desktop', 'mobile'].includes(scenario.name)) for (const section of ['for-patients', 'for-organizations', 'stay-connected']) {
        await page.locator('#' + section).evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' }));
        await page.screenshot({ path: path.join(output, scenario.name + '-' + section + '.png') });
      }
    }
    row.writes = writes;
    row.passed = row.status === 200 && !errors.length && row.layout.main === 1 && !row.layout.overflow && row.layout.canvas === 0 && !row.layout.brokenAnchors.length && !writes.length;
    if (!scenario.noJs) row.passed &&= !row.accessibility.violations.length && !row.changedStateAccessibility.violations.length && row.keyboardStageWorks && row.whatsappDisclosure && row.evidence.length === 9 && row.evidence.every(item => item.pressed === 'true');
    if (scenario.name === 'mobile') row.passed &&= row.menuFocusRecovered;
    results.push(row); console.log(JSON.stringify({ scenario: row.scenario, passed: row.passed, errors, accessibility: row.accessibility, changedStateAccessibility: row.changedStateAccessibility }));
    await context.close();
  }
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ tool: 'Playwright ' + requireTool('playwright-core/package.json').version, results }, null, 2));
  await browser.close();
}
if (results.some(row => !row.passed)) process.exitCode = 1;
