// Isolated public/account journey review. All records and OTP responses are fictional.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fixture } from './landing-demo.mjs';

const requireTool = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireAudit = createRequire(path.resolve(process.env.LIGHTHOUSE_TOOLS_DIR || '.next/landing-audit-tools', 'package.json'));
const { chromium } = requireTool('playwright-core');
const origin = 'http://localhost:3108', backend = 'http://127.0.0.1:5128';
const output = path.resolve(process.env.PUBLIC_JOURNEY_OUTPUT || '.next/brand-handoff/public-journey');
const phases = new Set((process.env.PUBLIC_JOURNEY_PHASES || 'views,journeys,states').split(','));
const results = [], writes = [], unknown = new Set();
let browser, logs = '', mode = 'normal';
await fs.mkdir(output, { recursive: true });

function responseFor(url) {
  if (url.pathname === '/api/auth/me') return { status: 401, data: { success: false } };
  if (url.pathname.includes('missing-public-profile')) return { status: 404, data: { success: false } };
  if (mode === 'profile-error' && url.pathname.startsWith('/api/public/locations/')) return { status: 503, data: { success: false } };
  let value = structuredClone(fixture(url, 'patient', 'GET'));
  if (mode === 'doctor-removed' && url.pathname.startsWith('/api/public/locations/')) value.data.doctors = [];
  if (url.pathname === '/api/public/locations' && Array.isArray(value?.data)) {
    const query = url.searchParams.get('search')?.toLowerCase();
    if (query) value.data = value.data.filter(row => [row.name, row.city, ...(row.specialties || [])].join(' ').toLowerCase().includes(query));
  }
  if (value === undefined) unknown.add(url.pathname);
  return { status: value === undefined ? 501 : 200, data: value ?? { success: false, message: 'Missing synthetic fixture' } };
}
const api = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (request.method !== 'GET') { writes.push(request.method + ' ' + request.url); response.writeHead(405); response.end('{}'); return; }
  const url = new URL(request.url, backend);
  if (mode === 'profile-loading' && (url.pathname.startsWith('/api/public/locations/') || /^\/api\/public\/doctors\/[^/]+\/profile$/.test(url.pathname))) await new Promise(resolve => setTimeout(resolve, 1800));
  const result = responseFor(url);
  response.writeHead(result.status); response.end(JSON.stringify(result.data));
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(5128, '127.0.0.1', resolve); });
const development = !process.env.PUBLIC_JOURNEY_DIST;
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', development ? 'dev' : 'start', '--hostname', 'localhost', '--port', '3108'], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, EKAVYU_NEXT_DIST_DIR: process.env.PUBLIC_JOURNEY_DIST || '.next/public-journey-dev', NEXT_PUBLIC_API_URL: 'https://api.example.invalid/api', NEXT_PUBLIC_BACKEND_URL: 'https://api.example.invalid', BACKEND_INTERNAL_URL: backend, APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1' },
});
next.stdout.on('data', chunk => { logs += chunk; }); next.stderr.on('data', chunk => { logs += chunk; });

async function open(width, dark = false, coldNavigation = false) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
  await context.addInitScript(dark => localStorage.setItem('ekavyu-mode', dark ? 'dark' : 'light'), dark);
  const page = await context.newPage(), errors = [], simulatedOtp = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/*', socket => { if (development && socket.url().includes('/_next/')) socket.connectToServer(); else socket.close(); });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (coldNavigation && (request.headers()['next-router-prefetch'] || request.headers().purpose === 'prefetch')) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type,authorization' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() === 'POST' && url.pathname === '/api/auth/otp/request') {
        simulatedOtp.push(url.pathname);
        return route.fulfill({ status: 200, headers, json: { success: true, data: { success: true } } });
      }
      if (request.method() === 'POST' && url.pathname === '/api/auth/otp/verify') {
        simulatedOtp.push(url.pathname + ' (rejected synthetic code)');
        return route.fulfill({ status: 200, headers, json: { success: false, data: {} } });
      }
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method() + ' ' + url.pathname); return route.fulfill({ status: 405, headers, json: {} }); }
      const result = responseFor(url);
      return route.fulfill({ status: result.status, headers, json: result.data });
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  return { context, page, errors, simulatedOtp };
}
async function visit(page, pathname, heading) {
  await page.goto(origin + pathname, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { level: 1, name: heading }).waitFor();
  if (development) await page.addStyleTag({ content: 'nextjs-portal { display:none!important }' });
}
async function inspect(page, name, errors) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime < 1000).map(animation => animation.finished.catch(() => {})));
  });
  await page.evaluate(await fs.readFile(requireAudit.resolve('axe-core/axe.min.js'), 'utf8'));
  const accessibility = await page.evaluate(async () => {
    const audit = await window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return { violations: audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), incomplete: audit.incomplete.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary, html: node.html })) })) };
  });
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, main: document.querySelectorAll('main,[role="main"]').length, nestedLinks: document.querySelectorAll('a a').length, typography: [...document.querySelectorAll('h1,h2')].map(node => ({ text: node.textContent, font: getComputedStyle(node).fontFamily })) }));
  const tabHighlightVisible = await page.locator('[data-auth-page] [role="tab"][aria-selected="true"]').evaluateAll(tabs => tabs.every(tab => {
    const slider = tab.parentElement.querySelector(':scope > div'), background = getComputedStyle(tab).backgroundColor;
    return slider && getComputedStyle(slider).display !== 'none' ? slider.getBoundingClientRect().height >= 36 : background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent';
  }));
  const row = { name, errors: [...errors], layout, tabHighlightVisible, accessibility, passed: !errors.length && !layout.overflow && layout.main === 1 && !layout.nestedLinks && !accessibility.violations.length && tabHighlightVisible };
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  results.push(row); console.log(JSON.stringify({ name, passed: row.passed, errors, violations: accessibility.violations.length, incomplete: accessibility.incomplete.map(item => item.id) }));
}
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(origin + '/manifest.json')).ok) break; } catch { /* starting */ }
    if (next.exitCode !== null || attempt === 119) throw new Error('Preview startup failed: ' + logs.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server', '--no-first-run'] });
  if (phases.has('views')) for (const [width, dark] of (process.env.PUBLIC_JOURNEY_VIEWPORTS ? JSON.parse(process.env.PUBLIC_JOURNEY_VIEWPORTS) : [[1440,false],[768,false],[390,false],[320,false],[390,true]])) {
    const { context, page, errors } = await open(width, dark);
    for (const [route, heading, label] of [['/login','Welcome back','login'],['/register','Create your account','register'],['/browse','Clinics & hospitals near you','browse'],['/browse/aster-grove','Aster Grove Clinic','facility'],['/doctor/mira-shah?location=aster-grove','Dr. Mira Shah','doctor']]) {
      if (process.env.PUBLIC_JOURNEY_ROUTES && !process.env.PUBLIC_JOURNEY_ROUTES.split(',').includes(label)) continue;
      await visit(page, route, heading);
      await inspect(page, `${label}-${dark ? 'dark-' : ''}${width}`, errors);
    }
    await context.close();
  }
  if (phases.has('journeys')) for (const width of [1440,390]) {
    const { context, page, errors, simulatedOtp } = await open(width);
    await visit(page, '/browse?search=Aster', 'Clinics & hospitals near you');
    await page.getByRole('link', { name: 'Aster Grove Clinic', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Aster Grove Clinic', exact: true }).waitFor();
    await page.locator('a[href="/doctor/mira-shah?location=aster-grove"]').first().click();
    await page.getByRole('heading', { name: 'Dr. Mira Shah', exact: true }).waitFor();
    await page.getByRole('group', { name: 'Appointment dates', exact: true }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: /^10:30(?: AM)?$/ }).first().click();
    await page.getByRole('button', { name: 'Continue to Details', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Appointment', exact: true }).waitFor();
    await inspect(page, 'booking-details-' + width, errors);
    await page.locator('a[href="/doctor/mira-shah?location=aster-grove-east#booking"]').click();
    await page.waitForFunction(() => location.search === '?location=aster-grove-east' && document.querySelector('#booking')?.textContent.includes('Aster Grove East'));
    await visit(page, '/doctor/mira-shah?location=aster-grove', 'Dr. Mira Shah');
    await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Aster Grove Clinic', exact: true }).click();
    await page.getByRole('heading', { name: 'Aster Grove Clinic', exact: true }).waitFor();
    await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Browse locations', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type="search"]')?.value === 'Aster');
    if (!await page.getByRole('link', { name: /^sign in$/i }).filter({ visible: true }).count()) await page.getByRole('button', { name: 'Toggle Menu', exact: true }).click();
    await page.getByRole('link', { name: /^sign in$/i }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: 'Create patient account', exact: true }).click();
    await page.getByLabel('Full Name *', { exact: true }).fill('Synthetic Journey Patient');
    await page.getByLabel('Mobile Phone Number *', { exact: true }).fill('9876543210');
    await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
    await page.getByRole('heading', { name: 'Verify your mobile number', exact: true }).waitFor();
    await inspect(page, 'register-verification-' + width, errors);
    await page.getByLabel('6-Digit Verification Code *', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Complete Registration', exact: true }).click();
    await page.getByText('Code could not be verified', { exact: true }).waitFor();
    if (!await page.getByRole('button', { name: 'Complete Registration', exact: true }).isEnabled()) throw new Error('Rejected verification left the form disabled');
    await inspect(page, 'register-rejected-code-' + width, errors);
    await page.getByRole('button', { name: 'Already registered? Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Browse locations', exact: true }).click();
    await page.getByRole('link', { name: 'Provider sign in', exact: true }).click();
    await page.getByRole('textbox', { name: 'Staff Email Address *', exact: true }).waitFor();
    await inspect(page, 'provider-sign-in-' + width, errors);
    results.push({ name: 'connected-journey-' + width, simulatedOtp, passed: !errors.length });
    await context.close();
  }
  if (phases.has('states')) for (const width of [1440,390]) {
    const { context, page, errors } = await open(width);
    await visit(page, '/browse/missing-public-profile', 'Location unavailable');
    await inspect(page, 'facility-unavailable-' + width, errors);
    await visit(page, '/doctor/missing-public-profile?location=aster-grove', 'Doctor profile unavailable');
    await inspect(page, 'doctor-unavailable-' + width, errors);
    mode = 'profile-error';
    await visit(page, '/browse/aster-grove', 'Profile temporarily unavailable');
    await inspect(page, 'facility-error-' + width, errors);
    mode = 'normal';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('heading', { name: 'Aster Grove Clinic', exact: true }).waitFor();
    mode = 'doctor-removed';
    await visit(page, '/doctor/mira-shah?location=aster-grove', 'Dr. Mira Shah');
    await page.getByRole('link', { name: 'View available doctors', exact: true }).waitFor();
    await inspect(page, 'doctor-assignment-removed-' + width, errors);
    mode = 'normal'; await context.close();
  }
  if (phases.has('loading')) for (const width of [1440,390]) {
    const { context, page, errors } = await open(width, false, true);
    for (const [route, label, heading, name] of [
      ['/browse/aster-grove', 'Loading location and doctor details', 'Aster Grove Clinic', 'facility'],
      ['/doctor/mira-shah?location=aster-grove', 'Loading doctor profile', 'Dr. Mira Shah', 'doctor'],
    ]) {
      mode = 'normal';
      await visit(page, name === 'facility' ? '/browse' : '/browse/aster-grove', name === 'facility' ? 'Clinics & hospitals near you' : 'Aster Grove Clinic');
      mode = 'profile-loading';
      await page.locator(`a[href="${route}"]`).first().click();
      await page.getByRole('status', { name: label, exact: true }).waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(output, name + '-loading-' + width + '.png') });
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      results.push({ name: name + '-loading-' + width, passed: !errors.length });
    }
    mode = 'normal'; await context.close();
  }
} finally {
  await browser?.close(); next.kill(); await new Promise(resolve => api.close(resolve));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ environment: development ? 'Isolated development preview' : 'Isolated production preview', phases: [...phases], results, blockedWrites: writes, missingFixtures: [...unknown], serverLogTail: logs.slice(-5000) }, null, 2));
}
if (writes.length || unknown.size || results.some(row => !row.passed)) process.exitCode = 1;
