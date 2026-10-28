// Local presentation checks only; never uses a database or a deployed backend.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fixture } from './landing-demo.mjs';
import { browseCases, filterBrowseCases, facilityProfile } from './browse-demo.mjs';

const requireTool = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireAudit = createRequire(path.join(process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022'), 'package.json'));
const output = path.resolve(process.env.BROWSE_REVIEW_OUTPUT || '.next/brand-handoff/browse-review');
const origin = 'http://localhost:3107';
const phases = new Set((process.env.BROWSE_REVIEW_PHASES || 'views,singleviews,filters,states,keyboard').split(','));
const development = process.env.BROWSE_REVIEW_DEV === '1';
const compactViewports = process.env.BROWSE_REVIEW_COMPACT_WIDTHS ? JSON.parse(process.env.BROWSE_REVIEW_COMPACT_WIDTHS) : [[320,false],[375,false],[390,false],[430,false],[640,false],[768,false],[1024,false],[1440,false],[1920,false],[390,true],[1440,true]];
let mode = 'populated', failRefresh = false, browser, logs = '';
const reads = [], writes = [], results = [], unexpectedImageRequests = [];
await fs.mkdir(output, { recursive: true });
const api = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:5118');
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] || 'content-type');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (request.method !== 'GET') { writes.push(url.pathname); response.writeHead(405); response.end('{}'); return; }
  if (url.pathname === '/api/auth/me') { response.writeHead(200); response.end(JSON.stringify({ success: true, data: { user: { role: 'guest' } } })); return; }
  if (url.pathname.includes('does-not-exist')) { response.writeHead(404); response.end('{}'); return; }
  let value;
  if (url.pathname === '/api/public/locations') {
    if (mode === 'error' || failRefresh) { response.writeHead(503); response.end('{}'); return; }
    if (mode === 'loading') await new Promise(resolve => setTimeout(resolve, 3500));
    value = { success: true, data: filterBrowseCases(url, mode), filters: { cities: ['Pune', 'Surat'], specialties: ['General Medicine', 'Pediatrics', 'Dermatology'] } };
  } else if (url.pathname.startsWith('/api/public/locations/')) {
    const row = browseCases.find(row => url.pathname.endsWith('/' + row.slug));
    if (!row) { response.writeHead(404); response.end('{}'); return; }
    const read = { path: url.pathname, started: Date.now(), finished: null }; reads.push(read);
    if (mode === 'single') await new Promise(resolve => setTimeout(resolve, 1500));
    read.finished = Date.now(); value = { success: true, data: mode.startsWith('facility') ? { ...facilityProfile, ...(mode === 'facility-empty' ? { doctors: [], images: [], amenities: [], image_url: '', logo_url: '', phone: '', email: '', description: '', googleMapsEmbedUrl: '' } : {}), ...(mode === 'facility-contact' ? { onlineBookingAvailable: false, bookingStatus: 'contact_location' } : {}), ...(mode === 'facility-long' ? { name: 'The Centre for Comprehensive Family Medicine and Specialist Consultations', doctors: [{ ...facilityProfile.doctors[0], name: 'An exceptionally long fictional practitioner name for responsive coverage' }] } : {}) } : row };
    if (mode === 'facility-long') Object.assign(value.data.doctors[0], { specialization: 'General Physician / Consultant', bookingMode: 'sequential_queue', isOnlineBookingClosed: true });
    if (mode === 'facility-single') Object.assign(value.data, {doctors:[facilityProfile.doctors[0]],googleMapsEmbedUrl:''});
  } else value = fixture(url, 'patient', request.method, 'discovery');
  response.writeHead(value === undefined ? 501 : 200); response.end(JSON.stringify(value || {}));
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(5118, '127.0.0.1', resolve); });
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', development ? 'dev' : 'start', '--hostname', 'localhost', '--port', '3107'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, EKAVYU_NEXT_DIST_DIR: process.env.BROWSE_REVIEW_DIST || (development ? '.next/browse-review-dev' : '.next/brand-production'), BACKEND_INTERNAL_URL: 'http://127.0.0.1:5118', NEXT_PUBLIC_API_URL: 'https://api.example.invalid/api', NEXT_PUBLIC_BACKEND_URL: 'https://api.example.invalid', NEXT_TELEMETRY_DISABLED: '1' } });
next.stdout.on('data', chunk => { logs += chunk; }); next.stderr.on('data', chunk => { logs += chunk; });
async function open(width, dark = false, pathname = '/browse') {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  await context.addInitScript(dark => localStorage.setItem('ekavyu-mode', dark ? 'dark' : 'light'), dark);
  const page = await context.newPage(), errors = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/unused-directory-') && new URL(page.url()).pathname === '/browse') unexpectedImageRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('Browser console:', message.text()); });
  await page.routeWebSocket('**/*', socket => {
    if (development && ['localhost', '127.0.0.1'].includes(new URL(socket.url()).hostname)) socket.connectToServer();
    else socket.close();
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (mode === 'delayed-location' && url.hostname === 'ipwho.is') { await new Promise(resolve=>setTimeout(resolve,1800)); return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,city:'Pune',region:'Maharashtra',latitude:18.52,longitude:73.85})}); }
    if (url.hostname === 'api.example.invalid') {
      const local = await fetch('http://127.0.0.1:5118' + url.pathname + url.search, { method: route.request().method() });
      return route.fulfill({ status: local.status, headers: Object.fromEntries(local.headers), body: await local.text() });
    }
    if (url.origin === 'https://www.google.com' && url.pathname === '/maps/embed') return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic map fixture</title><body style="margin:0;display:grid;place-items:center;height:200px;background:#e2e9e3;color:#0b2f2a;font:14px system-ui"><p>Synthetic map preview<br>No Google provider request made.</p></body></html>'});
    if (['localhost', '127.0.0.1'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  await page.goto(origin + pathname, { waitUntil: 'domcontentloaded' });
  // SSR cards appear before development chunks attach interactive handlers.
  await page.getByRole('link', { name: /^sign in$/i }).waitFor();
  if (development) await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  return { context, page, errors };
}
async function inspect(page, name, errors, audit = true) {
  if (unexpectedImageRequests.length) throw new Error('Browse downloaded an unused banner/gallery image: ' + unexpectedImageRequests.join(', '));
  const scroll = await page.evaluate(() => scrollY);
  // Exercise offscreen native lazy images and their failure fallbacks before capture.
  for (const card of await page.locator('main article').all()) {
    await card.scrollIntoViewIfNeeded();
    await card.evaluate(async node => { await Promise.all([...node.querySelectorAll('img')].map(async image => { if (!image.complete) await new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 3000); }); await image.decode().catch(() => {}); })); });
  }
  await page.evaluate(y => scrollTo(0, y), scroll);
  await page.waitForTimeout(150);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('main img')].filter(image => image.complete).map(image => image.decode().catch(() => {}))); });
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    nestedLinks: document.querySelectorAll('a a').length,
    columns: (() => { const list = document.querySelector('ul[aria-label="Healthcare locations"]'); return list ? getComputedStyle(list).gridTemplateColumns.split(' ').length : null; })(),
    expectedColumns: innerWidth >= 1280 ? 4 : innerWidth >= 1024 ? 3 : innerWidth >= 640 ? 2 : 1,
    cards: [...document.querySelectorAll('main article')].map(node => {
      const logo = node.querySelector('[class*="logoFrame"]').getBoundingClientRect();
      const identity = node.querySelector('[class*="identityText"]').getBoundingClientRect();
      const status = node.querySelector('[class*="__status"] > span').getBoundingClientRect();
      const heading = node.querySelector('[class*="__heading"]').getBoundingClientRect();
      const footer = node.querySelector('footer')?.getBoundingClientRect();
      return { name: node.querySelector('h2').textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, logoWidth:logo.width,logoHeight:logo.height,identityAligned:Math.abs(logo.top-identity.top)<1,statusAtTopRight:status.top>=heading.top&&status.bottom<=heading.bottom+1&&status.right<=node.getBoundingClientRect().right+1&&status.right>=node.getBoundingClientRect().right-24,imageCount:node.querySelectorAll('img').length,footerInsideCard: !footer || footer.bottom <= node.getBoundingClientRect().bottom + 1 };
    }),
    undersized: [...document.querySelectorAll('main a, main button:not([disabled])')].filter(node => {
      const box = node.getBoundingClientRect();
      const minimum = 43.5;
      return box.height > 0 && (box.height < minimum || box.width < minimum);
    }).map(node => node.textContent.trim()),
  }));
  let accessibility;
  if (audit) {
    await page.addScriptTag({ path: requireAudit.resolve('axe-core/axe.min.js') });
    accessibility = await page.evaluate(async () => { const result = await window.axe.run(document.querySelector('[role="dialog"]') || document.querySelector('main').parentElement, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }); return { violations: result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), incomplete: result.incomplete.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, html: node.html, summary: node.failureSummary })) })) }; });
  }
  const passed = !layout.overflow && !layout.nestedLinks && (layout.columns === null || layout.columns === layout.expectedColumns) && !layout.undersized.length && !layout.cards.some(card => card.imageCount>1||card.logoWidth!==80||card.logoHeight!==80||!card.identityAligned||!card.statusAtTopRight||!card.footerInsideCard) && !errors.length && !accessibility?.violations.length;
  const result = { name, passed, layout, errors, accessibility }; results.push(result); console.log(JSON.stringify({ name, passed, accessibility, undersized: layout.undersized }));
  if (!passed) throw new Error(JSON.stringify(result));
}
async function inspectFacility(page, name, errors) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.complete).map(image => image.decode().catch(() => {}))); });
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  const layout = await page.evaluate(() => {
    const doctors = document.querySelector('[aria-labelledby="facility-doctors"]')?.getBoundingClientRect();
    const sidebar = document.querySelector('aside[aria-label="Facility information"]')?.getBoundingClientRect();
    const hero = document.querySelector('section[aria-labelledby="facility-title"]')?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth, nestedLinks: document.querySelectorAll('a a').length, doctorsOnLeft: innerWidth < 900 || doctors?.right <= sidebar?.left, facilityFirstOnMobile:innerWidth>=900||sidebar?.bottom<=doctors?.top,heroInsideInformation:hero?.left>=sidebar?.left&&hero?.right<=sidebar?.right,noInformationTabs:!document.querySelector('aside[aria-label="Facility information"] [role="tab"]'),doctorRows: document.querySelectorAll('article[class*="doctorRow"]').length, heroHeight: hero?.height, mapSources: [...document.querySelectorAll('iframe[title^="Map of"]')].map(frame=>frame.src),
      unexpectedDoctorColumns: innerWidth < 640 && [...document.querySelectorAll('article[class*="doctorRow"]')].some(row=>getComputedStyle(row).gridTemplateColumns.split(' ').length!==1),
      doctorBookingAligned:[...document.querySelectorAll('article[class*="doctorRow"]')].every(row=>{const booking=row.querySelector('[class*="doctorBooking"]').getBoundingClientRect(),fee=row.querySelector('[class*="doctorFee"]').getBoundingClientRect(),action=row.querySelector('[class*="doctorActions"] button').getBoundingClientRect(),card=row.getBoundingClientRect();return booking.left>=card.left&&booking.right<=card.right+1&&((Math.abs((fee.top+fee.bottom)/2-(action.top+action.bottom)/2)<1&&fee.right<=action.left)||(Math.abs(fee.left-action.left)<1&&fee.bottom<=action.top));}),
      smallControls: [...document.querySelectorAll('[role="main"] a, [role="main"] button, [role="main"] summary')].filter(node => !node.closest('header[data-app-header]') && !node.disabled && node.getBoundingClientRect().height > 0 && (node.getBoundingClientRect().height < 43.5 || node.getBoundingClientRect().width < 43.5)).map(node => ({label: node.getAttribute('aria-label') || node.textContent, height:node.getBoundingClientRect().height})),
    };
  });
  await page.addScriptTag({ path: requireAudit.resolve('axe-core/axe.min.js') });
  const accessibility = await page.evaluate(async () => { const result = await window.axe.run(document.querySelector('[role="main"]'), {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return { violations:result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})), incomplete:result.incomplete.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})) }; });
  const passed = !layout.overflow && !layout.nestedLinks && !layout.unexpectedDoctorColumns && layout.doctorBookingAligned && layout.doctorsOnLeft && layout.facilityFirstOnMobile && layout.heroInsideInformation && layout.noInformationTabs && !layout.smallControls.length && !errors.length && !accessibility.violations.length;
  const result = { name, passed, layout, accessibility, errors };results.push(result);console.log(JSON.stringify(result));if(!passed)throw new Error(JSON.stringify(result));
}
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin + '/manifest.json')).ok) break; } catch {}
    if (attempt > 100 || next.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  browser = await requireTool('playwright-core').chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking', '--no-proxy-server'] });
  for (const width of phases.has('views') ? [320, 375, 390, 640, 768, 900, 1024, 1280, 1440] : []) {
    mode = 'populated'; const { context, page, errors } = await open(width);
    await page.getByRole('list', { name: 'Healthcare locations' }).waitFor();
    await page.waitForTimeout(700);
    if (reads.length) throw new Error('Multi-result directory eagerly fetched a profile');
    await inspect(page, `light-${width}`, errors);
    await context.close();
  }
  for (const width of phases.has('views') ? [320, 390, 768, 1440] : []) {
    const { context, page, errors } = await open(width, true);
    await page.getByRole('list', { name: 'Healthcare locations' }).waitFor();
    await inspect(page, `dark-${width}`, errors);
    await context.close();
  }
  mode = 'populated';
  if (phases.has('singleviews')) {
    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      mode = 'single'; const { context, page, errors } = await open(width);
      const card = page.getByRole('article', { name: 'Aster Grove Clinic' });
      await card.waitFor();
      const bounds = await card.boundingBox();
      // A sole result occupies one grid cell rather than stretching across the row.
      const columns = width >= 1280 ? 4 : width >= 1024 ? 3 : width >= 640 ? 2 : 1;
      const grid = await page.getByRole('list', { name: 'Healthcare locations' }).boundingBox();
      const expectedWidth = (grid.width - (columns - 1) * 16) / columns - 2;
      if (!bounds || Math.abs(bounds.width - expectedWidth) > 2) throw new Error('Single facility card has an incorrect grid width: ' + JSON.stringify({ width, expectedWidth, bounds }));
      await inspect(page, `single-${width}`, errors);
      await context.close();
    }
    mode = 'populated';
  }
  if (phases.has('compact')) {
    for (const [width,dark] of compactViewports) {
      mode='populated';const {context,page,errors}=await open(width,dark);
      await page.setViewportSize({width,height:740});
      await page.getByRole('list',{name:'Healthcare locations'}).waitFor();
      const initialSearch=await page.getByRole('search').boundingBox();
      const initialDock=await page.locator('[data-browse-search]').boundingBox();
      if(!await page.getByRole('button',{name:'Search',exact:true}).locator('svg').isVisible())throw Error('Search icon is hidden');
      if(width<768){
        const intro=await page.locator('[class*="mobileIntro"]').boundingBox();
        const toolbar=await page.locator('[class*="toolbar"]').boundingBox();
        if(!intro||intro.height>34||intro.y+intro.height>initialSearch.y||toolbar.height>48)throw Error('Mobile introduction or single-row filters overflow: '+JSON.stringify({intro,toolbar,initialSearch}));
        if(await page.getByRole('group',{name:'Care specialties'}).isVisible())throw Error('Mobile duplicate specialty row remains');
      }
      const geometry=await page.evaluate(()=>{
        const hero=document.querySelector('section[aria-labelledby="browse-title"]').getBoundingClientRect();
        const heading=document.querySelector('#browse-title').getBoundingClientRect();
        const toolbar=document.querySelector('[class*="toolbar"]').getBoundingClientRect();
        const parts=['results','specialties','controls'].map(name=>document.querySelector('[class*="'+name+'"]').getBoundingClientRect());
        const mobile = innerWidth < 768;
        const input=document.querySelector('input[aria-label="Search by doctor, location name, or specialty"]').getBoundingClientRect();
        const searchButton=document.querySelector('form[role="search"] button[type="submit"]').getBoundingClientRect();
        const visible=node=>!!node.getClientRects().length;
        return {centered:mobile||Math.abs((heading.left+heading.right)/2-(hero.left+hero.right)/2)<1,oneDesktopRow:innerWidth<900||parts.every(box=>box.top>=toolbar.top-1&&box.bottom<=toolbar.top+65),toolbarHeight:toolbar.height,searchOneRow:Math.abs(input.top-searchButton.top)<1,inputHeight:input.height,buttonHeight:searchButton.height,mobileHeroCompact:!mobile||(!visible(document.querySelector('[class*="eyebrow"]'))&&!visible(document.querySelector('[class*="intro"]'))&&hero.height<=1&&hero.width<=1),heroImageFetched:mobile&&performance.getEntriesByType('resource').some(entry=>entry.name.includes('/browse/reception-hero'))};
      });
      if(!geometry.centered||!geometry.oneDesktopRow||!geometry.searchOneRow||geometry.inputHeight<44||geometry.buttonHeight<44||!geometry.mobileHeroCompact||geometry.heroImageFetched)throw Error('Compact header alignment: '+JSON.stringify(geometry));
      await inspect(page,`compact-${dark?'dark-':''}${width}`,errors);
      if(width===1440&&!dark){
        const card=page.getByRole('article').first().locator('..').locator('..');
        await page.emulateMedia({reducedMotion:'no-preference'});await card.hover();await page.waitForTimeout(220);
        const hover=await card.evaluate(node=>getComputedStyle(node).transform);
        if(hover==='none')throw Error('Card hover feedback is missing');
        await page.emulateMedia({reducedMotion:'reduce'});
        const reduced=await card.evaluate(node=>getComputedStyle(node).transform);
        if(reduced!=='none')throw Error('Card hover ignores reduced motion');
        results.push({name:'card-hover-and-reduced-motion',passed:true,hover,reduced});
      }
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      await page.waitForFunction(()=>document.querySelector('[data-browse-search]').dataset.stuck==='true');
      const dock=page.locator('[data-browse-search]');const box=await dock.boundingBox();
      const narrowedSearch=await page.getByRole('search').boundingBox();
      if(narrowedSearch.width>initialSearch.width-8||Math.abs(initialDock.height-box.height)>1)throw Error('Pinned search failed width/height stability: '+JSON.stringify({initialSearch,narrowedSearch,initialDock,box}));
      if(await page.getByRole('button',{name:/Save.*Clinic|Show saved locations/}).count())throw Error('Removed save control remains');
      const scroll=await page.evaluate(()=>scrollY);
      if(scroll<80||Math.abs(box.y-64)>1)throw Error('Search did not stick below navbar: '+JSON.stringify({width,scroll,box}));
      if(width>=768&&(await page.locator('#browse-title').boundingBox()).y>=64)throw Error('Desktop heading did not scroll away');
      await page.screenshot({path:path.join(output,`sticky-${dark?'dark-':''}${width}.png`)});
      if(width===390||width===1440){
        if(width>=768){await page.getByRole('combobox',{name:'Filter by location'}).click();await page.getByRole('option',{name:'All Cities',exact:true}).waitFor();await page.keyboard.press('Escape');}
        await page.getByRole('textbox',{name:'Search by doctor, location name, or specialty'}).fill('grove');
        await page.getByRole('button',{name:'Search',exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll('main article').length===1);
        await page.getByRole('article',{name:'Aster Grove Clinic'}).waitFor();
      }
      results.push({name:`sticky-${dark?'dark-':''}${width}`,passed:true,geometry,scroll,dock:box,initialSearch,narrowedSearch});
      await context.close();
    }
    mode='populated';
  }
  if(phases.has('stability')){
    for(const width of [390,1440]){
      mode='delayed-location';const {context,page,errors}=await open(width);
      const toolbar=page.locator('[class*="toolbar"]');await toolbar.waitFor();
      const measure=()=>page.evaluate(()=>{const toolbar=document.querySelector('[class*="toolbar"]').getBoundingClientRect();const specialties=document.querySelector('[aria-label="Care specialties"]').getBoundingClientRect();const grid=document.querySelector('ul[aria-label="Healthcare locations"]').getBoundingClientRect();return {toolbar:{x:toolbar.x,y:toolbar.y,height:toolbar.height},specialties:{x:specialties.x,y:specialties.y,height:specialties.height},grid:{x:grid.x,y:grid.y}};});
      const before=await measure();await page.getByText('Near Pune (approx.)',{exact:true}).waitFor();const after=await measure();
      if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Location detection shifted layout: '+JSON.stringify({width,before,after}));
      await inspect(page,'stable-location-'+width,errors);
      results.push({name:'delayed-location-layout-'+width,passed:true,before,after});
      await context.close();
    }
    mode='populated';
  }
  if (phases.has('focus')) {
    for(const width of [390,1440]){
      mode='populated';const {context,page,errors}=await open(width);
      await page.setViewportSize({width,height:740});
      const title=page.getByRole('link',{name:'Aster Grove Clinic',exact:true});await title.waitFor();
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      await title.focus();
      await title.evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
      const target=await title.boundingBox(),dock=await page.locator('[data-browse-search]').boundingBox();
      if(target.y<dock.y+dock.height||target.y+target.height>740)throw Error('Focused card is obscured: '+JSON.stringify({width,target,dock}));
      results.push({name:'sticky-focus-'+width,passed:!errors.length,target,dock,errors});
      await context.close();
    }
  }
  if (phases.has('filters')) {
    const { context, page, errors } = await open(390);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const specialty = page.getByRole('combobox', { name: 'Care specialty' });
    await specialty.click(); await page.getByRole('option', { name: 'Pediatrics', exact: true }).click();
    await inspect(page, 'mobile-filter-sheet', errors);
    await page.getByRole('button', { name: 'Show results', exact: true }).click();
    await page.waitForFunction(()=>document.querySelector('button[aria-label="Filters"]').dataset.active==='true');
    if(await page.getByRole('group',{name:'Applied filters'}).count())throw Error('Removed applied-filter row remains');
    await page.getByRole('article', { name: 'River Hospital and Specialist Care' }).waitFor();
    if (await page.getByRole('list', { name: 'Healthcare locations' }).getByText(/Dr\./).count()) throw new Error('Doctor details leaked onto facility cards');
    const hospital = page.getByRole('article', { name: 'River Hospital and Specialist Care' });
    if (!(await hospital.getByRole('link', { name: /Get directions/ }).getAttribute('href')).startsWith('https://www.google.com/maps/dir/?api=1')) throw new Error('Missing directions action');
    if (await hospital.getByRole('link', { name: /Book appointment|View Hospital/ }).getAttribute('href') !== '/browse/river-hospital') throw new Error('Facility booking/profile link mismatch');
    await inspect(page, 'mobile-applied-filter', errors);
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    await page.getByRole('button',{name:'Clear all filters',exact:true}).click();
    await page.getByRole('button',{name:'Show results',exact:true}).click();
    await page.getByRole('article', { name: 'Aster Grove Clinic' }).waitFor();
    await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
    failRefresh = true;
    await page.getByRole('textbox', { name: 'Search by doctor, location name, or specialty' }).fill('grove');
    await page.getByRole('button',{name:'Search',exact:true}).click();
    await page.getByText('Unable to update results', { exact: true }).waitFor();
    await page.getByRole('article', { name: 'Aster Grove Clinic' }).waitFor();
    await inspect(page, 'mobile-stale-error', errors);
    failRefresh = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('main').getAttribute('aria-busy');
    await context.close();
  }
  for (const state of phases.has('states') ? ['empty', 'error', 'loading', 'single'] : []) {
    mode = state;
    const readsBefore = reads.length;
    const { context, page, errors } = await open(390);
    if (state === 'empty') await page.getByRole('heading', { name: 'No locations found', exact: true }).waitFor();
    if (state === 'error') await page.getByRole('heading', { name: "We couldn't load locations", exact: true }).waitFor();
    if (state === 'loading') await page.getByRole('status').filter({ hasText: 'Finding locations...' }).waitFor();
    if (state === 'single') await page.getByRole('article', { name: 'Aster Grove Clinic' }).waitFor();
    await inspect(page, `mobile-${state}`, errors);
    if (state === 'single' && !development) {
      for (let attempt = 0; !reads.slice(readsBefore).some(read => read.finished); attempt++) {
        if (attempt > 200) throw new Error('Sole profile did not preload');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/browse/aster-grove') && entry.responseEnd > 0));
      await page.waitForLoadState('networkidle');
      const start = Date.now(); await page.getByRole('link', { name: 'Aster Grove Clinic', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Aster Grove Clinic' }).waitFor();
      results.push({ name: 'single-prefetch', passed: true, simulatedApiMs: 1500, clickToHeadingMs: Date.now() - start });
    }
    await context.close();
  }
  mode = 'populated';
  if (phases.has('keyboard')) {
    const { context, page, errors } = await open(390);
    await page.getByRole('list', { name: 'Healthcare locations' }).waitFor();
    await page.getByRole('link', { name: 'Aster Grove Clinic', exact: true }).focus();
    for (let index = 0; index < 12; index++) {
      try {
        await page.waitForFunction(() => { const rect = document.activeElement.getBoundingClientRect(); return rect.bottom > 64 && rect.top < innerHeight; }, null, { timeout: 2000 });
      } catch {
        throw new Error('Keyboard focus obscured: ' + JSON.stringify(await page.evaluate(() => ({ text: document.activeElement.textContent, tag: document.activeElement.tagName, rect: document.activeElement.getBoundingClientRect().toJSON(), scrollY }))));
      }
      await page.keyboard.press('Tab');
    }
    await inspect(page, 'mobile-keyboard', errors);
    await context.close();
  }
  if(phases.has('pendingheader')){
    for(const width of [390,1440]){
      mode='populated';const context=await browser.newContext({viewport:{width,height:800},reducedMotion:'reduce'});const page=await context.newPage();let release;const gate=new Promise(resolve=>{release=resolve;});
      await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='api.example.invalid'){const local=await fetch('http://127.0.0.1:5118'+url.pathname+url.search);return route.fulfill({status:local.status,headers:Object.fromEntries(local.headers),body:await local.text()});}if(url.hostname==='localhost'||url.hostname==='127.0.0.1'){if(url.pathname.endsWith('.js'))await gate;return route.continue();}return route.abort();});
      await page.goto(origin+'/browse',{waitUntil:'commit'});await page.locator('header[data-app-header]').waitFor();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('header[data-app-header]')).position==='fixed');
      const measure=()=>page.evaluate(()=>{const header=document.querySelector('header[data-app-header]'),node=header.firstElementChild.lastElementChild,r=node.getBoundingClientRect(),brand=header.querySelector('img[alt="Ekavyu"]').getBoundingClientRect();return {cluster:{x:r.x,width:r.width,height:r.height},brand:{x:brand.x,width:brand.width,height:brand.height}};});
      const before=await measure();await page.getByText('Checking account…',{exact:true}).waitFor({state:'attached'});release();await page.getByRole('link',{name:/^sign in$/i}).waitFor();const after=await measure();
      const passed=Object.keys(before).every(key=>Object.keys(before[key]).every(metric=>Math.abs(before[key][metric]-after[key][metric])<.5));results.push({name:'pending-header-'+width,passed,before,after});if(!passed)throw Error('Account loading shifts navigation: '+JSON.stringify({width,before,after}));await context.close();
    }
  }
  if(phases.has('detailing')){
    for(const [width,dark]of [[320,false],[390,false],[768,false],[1024,false],[1440,false],[390,true]]){
      mode='populated';const {context,page,errors}=await open(width,dark);
      await page.getByRole('article',{name:'Aster Grove Clinic',exact:true}).waitFor();
      const listing=await page.evaluate(()=>{
        const actions=[...document.querySelectorAll('main article footer a')];
        return {badges:[...document.querySelectorAll('[class*="statusBadge"]')].map(node=>parseFloat(getComputedStyle(node).fontSize)),buttons:actions.map(node=>{const range=document.createRange(),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),tops=[];let text;while(text=walker.nextNode()){if(text.textContent.trim()){range.selectNodeContents(text);tops.push(...[...range.getClientRects()].filter(r=>r.height>0).map(r=>Math.round(r.top)));}}return {text:node.textContent.trim(),radius:getComputedStyle(node).borderRadius,oneLine:Math.max(...tops)-Math.min(...tops)<2};}),logoFits:[...document.querySelectorAll('img[class*="logo"]')].every(node=>node.getBoundingClientRect().width<=node.parentElement.clientWidth+.5&&node.getBoundingClientRect().height<=node.parentElement.clientHeight+.5)};
      });
      if(!listing.logoFits||listing.badges.some(size=>size!==11)||listing.buttons.some(button=>!button.oneLine||button.radius!=='12px'))throw Error('Directory detail mismatch: '+JSON.stringify({width,listing}));
      await inspect(page,`polish-directory-${dark?'dark-':''}${width}`,errors);
      mode='facility-single';await page.getByRole('link',{name:'Aster Grove Clinic',exact:true}).click();
      await page.getByRole('heading',{name:'Aster Grove Clinic',level:1}).waitFor();
      const detail=await page.evaluate(()=>{
        const hero=document.querySelector('section[aria-labelledby="facility-title"]');const frame=document.querySelector('[data-facility-content]'),rect=frame.getBoundingClientRect(),style=getComputedStyle(frame);const crumbs=[...document.querySelectorAll('nav[aria-label="Breadcrumb"] li')].map(node=>node.getBoundingClientRect()).filter(r=>r.height>0);const bar=document.querySelector('[aria-label="Appointment booking"]');const barStyle=bar&&getComputedStyle(bar);const inside=bar&&bar.firstElementChild,insideRect=inside&&inside.getBoundingClientRect(),insideStyle=inside&&getComputedStyle(inside);const logo=hero.querySelector('[class*="__logo"] img');return {breadcrumbsOneRow:Math.max(...crumbs.map(r=>r.top+r.height/2))-Math.min(...crumbs.map(r=>r.top+r.height/2))<1,statusSize:parseFloat(getComputedStyle(hero.querySelector('[class*="statusBadge"]')).fontSize),logoFits:!logo||logo.getBoundingClientRect().width<=logo.parentElement.clientWidth+.5,barAligned:!bar||barStyle.display==='none'||Math.abs(rect.left+parseFloat(style.paddingLeft)-insideRect.left-parseFloat(insideStyle.paddingLeft))<1};
      });
      if(!detail.breadcrumbsOneRow||detail.statusSize!==11||!detail.logoFits||!detail.barAligned)throw Error('Facility detailing mismatch: '+JSON.stringify({width,detail}));
      if(await page.locator('iframe').count()||await page.getByRole('link',{name:/Open Google Maps/}).count()||await page.getByRole('link',{name:/Get directions/}).count()!==1)throw Error('Fallback directions are duplicated');
      await inspectFacility(page,`polish-facility-${dark?'dark-':''}${width}`,errors);
      results.push({name:`polish-details-${dark?'dark-':''}${width}`,passed:true,listing,detail});await context.close();
    }
  }
  if(phases.has('consistency')){
    const measure=page=>page.evaluate(()=>{
      const header=document.querySelector('header[data-app-header]');
      const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      const visible=selector=>[...header.querySelectorAll(selector)].find(node=>node.getBoundingClientRect().width>0);
      const frame=document.querySelector('main[aria-busy]')||document.querySelector('[data-facility-content]');
      const r=frame.getBoundingClientRect(),s=getComputedStyle(frame);
      return {brand:rect(header.querySelector('img[alt="Ekavyu"]')),signIn:rect(visible('a[href="/login"]')),signUp:rect(visible('a[href="/register"]')),theme:rect(visible('button[aria-label^="Switch to"]')),header:rect(header),content:{left:r.left+parseFloat(s.paddingLeft),right:r.right-parseFloat(s.paddingRight)},background:getComputedStyle(header.parentElement).backgroundColor};
    });
    for(const [width,dark]of [[320,false],[375,false],[390,false],[768,false],[1024,false],[1440,false],[1920,false],[390,true],[1440,true]]){
      mode='facility';const {context,page,errors}=await open(width,dark);
      await page.getByRole('list',{name:'Healthcare locations'}).waitFor();
      if(width===390||width===1440){await page.getByRole('textbox',{name:'Search by doctor, location name, or specialty'}).fill('grove');await page.getByRole('button',{name:'Search',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('main article').length===1);}
      const before=await measure(page);await inspect(page,`connected-directory-${dark?'dark-':''}${width}`,errors);
      await page.getByRole('link',{name:'Aster Grove Clinic',exact:true}).click();
      await page.getByRole('heading',{level:1,name:'Aster Grove Clinic',exact:true}).waitFor();await page.getByRole('link',{name:/^sign in$/i}).waitFor();
      const after=await measure(page);
      if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Directory/facility frame shifts: '+JSON.stringify({width,dark,before,after}));
      results.push({name:`connected-frame-${dark?'dark-':''}${width}`,passed:true,before,after});
      await inspectFacility(page,`connected-facility-${dark?'dark-':''}${width}`,errors);
      await page.getByRole('link',{name:'Back to locations',exact:true}).click();
      await page.locator('#browse-title').waitFor({state:'attached'});
      const query=page.getByRole('textbox',{name:'Search by doctor, location name, or specialty'});
      if(width===390||width===1440){await page.waitForFunction(()=>document.querySelector('input[aria-label="Search by doctor, location name, or specialty"]').value==='grove');await page.waitForFunction(()=>document.querySelectorAll('main article').length===1);}
      const returned=await measure(page);if(JSON.stringify(returned)!==JSON.stringify(before))throw Error('Returning to directory changed its frame');
      results.push({name:`connected-back-${dark?'dark-':''}${width}`,passed:true,search:await query.inputValue(),returned});
      await context.close();
    }
  }
  if (phases.has('facility') || phases.has('facilitystates') || phases.has('facilitymobile') || phases.has('facilityflows')) {
    for (const [width, dark] of phases.has('facility') ? [[320,false],[375,false],[390,false],[768,false],[1024,false],[1200,false],[1440,false],[390,true],[1440,true]] : phases.has('facilitymobile') ? [[320,false],[375,false],[390,false],[390,true]] : []) {
      mode = 'facility'; const {context,page,errors} = await open(width,dark,'/browse/aster-grove');
      await page.getByRole('heading',{level:1,name:'Aster Grove Clinic'}).waitFor();
      await inspectFacility(page,`facility-${dark?'dark-':''}${width}`,errors);
      await context.close();
    }
    for (const width of phases.has('facility') || phases.has('facilityflows') ? [390,1440] : phases.has('facilitymobile') ? [390] : []) {
      mode = 'facility'; const {context,page,errors} = await open(width,false,'/browse/aster-grove');
      const map = page.locator('iframe[title="Map of Aster Grove Clinic"]');
      await map.waitFor();
      if(await map.getAttribute('src')!==facilityProfile.googleMapsEmbedUrl)throw new Error('Saved map did not render');
      if(width<768)await page.getByRole('button',{name:'Search clinics and doctors'}).click();
      await page.getByRole('searchbox',{name:'Search clinics, doctors or locations'}).fill('Mira');
      await page.getByRole('button',{name:'Search care',exact:true}).click();
      await page.waitForURL('**/browse?search=Mira');
      const search = page.getByPlaceholder('Search clinics or doctors');await search.waitFor();
      if(await search.inputValue()!=='Mira')throw new Error('Navbar query was not applied');
      await page.goto(origin+'/browse/aster-grove',{waitUntil:'domcontentloaded'});await page.getByRole('link',{name:/^sign in$/i}).waitFor();await page.getByRole('heading',{name:'Aster Grove Clinic',exact:true}).waitFor();
      if(development)await page.addStyleTag({content:'nextjs-portal { display: none !important; }'});
      await page.locator('summary').filter({hasText:'Opening hours'}).focus();await page.keyboard.press('Enter');
      if(!await page.locator('details').filter({has:page.locator('summary').filter({hasText:'Opening hours'})}).evaluate(node=>node.open))throw Error('Opening hours disclosure did not open from keyboard');
      await page.locator('summary').filter({hasText:'Facilities & photos'}).click();
      await page.getByText('Amenities (2)',{exact:true}).waitFor();
      await page.getByRole('button',{name:'View facility photo 1',exact:true}).click();
      await page.getByRole('dialog',{name:'Photo gallery'}).waitFor();await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}});});
      await page.getByRole('button',{name:'Copy phone number'}).click();
      if(await page.evaluate(()=>window.__copied)!==facilityProfile.phone)throw new Error('Phone copy failed');
      await page.getByRole('button',{name:'Book now',exact:true}).first().click();
      await page.getByRole('button',{name:'10:00 AM',exact:true}).waitFor();
      await inspectFacility(page,`facility-booking-${width}`,errors);
      await context.close();
    }
    for (const variant of ['empty','contact','long']) {
      mode = 'facility-'+variant; const {context,page,errors} = await open(320,false,'/browse/aster-grove');
      await page.getByRole('heading',{level:1}).waitFor();
      if(variant==='empty'&&await page.getByRole('button',{name:'Book now',exact:true}).count())throw new Error('Empty facility exposes booking');
      if(variant==='contact'&&!(await page.getByRole('button',{name:'Contact reception',exact:true}).first().isDisabled()))throw new Error('Paused booking is enabled');
      await inspectFacility(page,`facility-${variant}-320`,errors);await context.close();
    }
  }
  for (const route of ['/browse/does-not-exist', '/doctor/does-not-exist']) {
    const response = await fetch(origin + route); if (response.status !== 404) throw new Error(`${route}: ${response.status}`);
    results.push({ name: route, passed: true, status: response.status });
  }
  if (writes.some(path => path !== '/api/public/track-visit')) throw new Error('Unexpected mutation attempt: ' + writes.join(','));
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic: true, development, phases: [...phases], widths: [320, 375, 390, 640, 768, 900, 1024, 1280, 1440, 1920], results, reads, blockedWrites: writes, unexpectedImageRequests }, null, 2));
  await browser?.close(); next.kill(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
}
