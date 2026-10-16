// Local rendering smoke check using Chrome CDP and synthetic API fixtures.
// This is not a real backend or provider end-to-end test.
import fs from 'node:fs';
const origin = 'http://127.0.0.1:4351';
const target = await fetch('http://127.0.0.1:9229/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0, mode = 'doctor';
const pending = new Map();
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const modules = ['dashboard','notifications','settings','appointments','queue','patients','consultations','billing','pharmacy','staff','locations','laboratory','radiology','analytics','service-catalog','insurance','teleconsultation','shifts','audit','feedback'];
const user = () => ({ id: 'fixture-doctor', name: 'Synthetic doctor', email: 'fixture@example.test', organization_id: 'fixture-org', role: 'doctor', twoFactorEnabled: mode !== 'mfa', mfaEnrollmentRequired: mode === 'mfa', permissions: ['VIEW_LOCATIONS','VIEW_PATIENTS','VIEW_APPOINTMENTS','MANAGE_APPOINTMENTS','MANAGE_CLINICAL_NOTES','VIEW_EHR'] });
const visit = { id: 'fixture-visit', patientId: { id: 'fixture-patient', name: 'Synthetic patient', phone: '0000000000' }, doctorId: { id: 'fixture-doctor', name: 'Synthetic doctor' }, locationId: { id: 'fixture-location', name: 'Synthetic clinic' }, status: 'checked-in', tokenNumber: 12, appointmentTime: new Date().toISOString() };
const requests = [];
socket.onmessage = async event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id); pending.delete(message.id);
    if (message.error) waiter?.reject(new Error(message.error.message)); else waiter?.resolve(message.result);
    return;
  }
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const url = new URL(request.url), route = url.pathname.replace(/^\/api/, '');
  requests.push({ mode, method: request.method, route });
  let data = [];
  if (route === '/auth/me') data = { user: user() };
  else if (route === '/onboarding/organization/preferences') data = { registration: 'full', consultation: 'full', currency: 'INR' };
  else if (route === '/onboarding/locations') data = [{ id: 'fixture-location', name: 'Synthetic clinic', effectiveTimezone: 'Asia/Kolkata' }];
  else if (route === '/onboarding/doctors/assignments') data = [{ id: 'fixture-assignment', doctorId: { id: 'fixture-doctor', name: 'Synthetic doctor' }, isActive: true, bookingMode: 'sequential_queue' }];
  else if (route.includes('/slots')) data = { bookingMode: 'sequential_queue', slots: [] };
  else if (route === '/appointments') data = [visit];
  else if (route === '/analytics/daily-summary') data = { appointments: 1, completed: 0, pending: 0, byStatus: { 'checked-in': 1 }, financialVisible: false, recentAppointments: [visit], trends: { days: [], locations: [] } };
  else if (route === '/modules') data = modules.map(moduleKey => ({ moduleKey, enabled: true, alwaysOn: false }));
  else if (route.includes('/notifications/unread-count')) data = { count: 0 };
  await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : 200,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization,x-location-id' }, { name: 'X-Total-Pages', value: '2' }],
    body: request.method === 'OPTIONS' ? '' : Buffer.from(JSON.stringify({ success: true, data })).toString('base64') }).catch(() => {});
};
const evaluate = expression => send('Runtime.evaluate', { expression, returnByValue: true }).then(r => r.result.value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await send('Page.enable'); await send('Network.enable');
  await send('Network.setCookie', { name: 'access_token', value: 'synthetic-render-only', url: origin, httpOnly: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://readiness.example.test/*' }, { urlPattern: 'http://localhost:5000/*' }] });
  const results = [];
  fs.mkdirSync('.next/readiness-viewports', { recursive: true });
  for (const scenario of [{ mode: 'doctor', page: '/dashboard/consultations', widths: [320,390,430,1440] }, { mode: 'dashboard', page: '/dashboard', widths: [320,390] }, { mode: 'mfa', page: '/dashboard', widths: [320,390,430] }]) {
    mode = scenario.mode;
    await send('Page.navigate', { url: origin + scenario.page });
    for (let i = 0; i < 50; i++) {
      const ready = await evaluate(`document.body.innerText.includes(${JSON.stringify(mode === 'mfa' ? 'Secure your workspace' : 'Synthetic patient')})`);
      if (ready) break;
      if (i === 49) throw new Error('Expected synthetic view did not load: ' + mode);
      await wait(200);
    }
    for (const width of scenario.widths) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 500 });
      await wait(150);
      const metrics = await evaluate(`({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, headings: [...document.querySelectorAll('h1,h2')].map(n => n.textContent) })`);
      if (metrics.documentWidth > width + 1) throw new Error('Horizontal overflow: ' + JSON.stringify({ mode, width, ...metrics }));
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('.next/readiness-viewports/' + mode + '-' + width + '.png', Buffer.from(screenshot.data, 'base64'));
      results.push({ mode, width, ...metrics });
    }
    if (mode === 'doctor') {
      await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
      await evaluate(`document.querySelectorAll('button').forEach(button => { if (button.textContent.includes('Start Walk-in')) button.click(); })`);
      for (let i = 0; i < 30; i++) {
        if (await evaluate(`Boolean(document.querySelector('[role="dialog"]'))`)) break;
        if (i === 29) throw new Error('Patient entry did not open');
        await wait(100);
      }
      await wait(300);
      const metrics = await evaluate(`({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, dialogWidth: document.querySelector('[role="dialog"]').getBoundingClientRect().width })`);
      if (metrics.documentWidth > 321 || metrics.dialogWidth > 320) throw new Error('Patient entry overflows narrow viewport');
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('.next/readiness-viewports/patient-entry-320.png', Buffer.from(screenshot.data, 'base64'));
      results.push({ mode: 'patient-entry', width: 320, ...metrics });
    }
  }
  fs.writeFileSync('docs/readiness-viewports.json', JSON.stringify({ scope: 'Production frontend rendering with synthetic API fixtures; no backend/provider E2E claim', results, requests }, null, 2) + '\n');
  console.log(JSON.stringify({ checks: results.length, horizontalOverflow: false }));
} finally { await send('Browser.close').catch(() => {}); socket.close(); }
