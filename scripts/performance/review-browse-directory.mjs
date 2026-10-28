// Local presentation checks only; never uses a database or a deployed backend.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fixture } from './landing-demo.mjs';
import { browseCases, facilityProfile } from './browse-demo.mjs';
const directoryRows = browseCases.slice(0,4).map((row,index)=>({...row, name:['Aster Grove Clinic','Riverside Multispeciality Hospital & Research Centre','Sunrise Diagnostic Centre',"Lotus Women's Clinic"][index], city:'Surat',address:['204, Demonstration Medical Centre, VIP Road, Vesu, Surat','Sample address, Adajan, Surat','Sample address, Athwa, Surat','Piplod, Surat'][index], facilityType:['clinic','hospital','diagnostic_center','clinic'][index], latitude:[21.15,21.18,21.13,21.20][index],longitude:[72.77,72.75,72.81,72.83][index], logo_url:index===0?row.logo_url:'', phone:index===3?'':'+91 00000 00000', specialties:[['General Physician / Consultant'],['Cardiology','Orthopedics'],['Pathology','Radiology'],[]][index], timings:index===1?'24/7':index===0?'00:01 - 00:02':'', onlineBookingAvailable:index===0||index===3,bookingStatus:index===0||index===3?'check_availability':index===2?'no_doctors':'contact_location'}));
function filterBrowseCases(url, mode) {
 let rows = mode==='empty'?[]:mode==='single'?[directoryRows[0]]:mode==='unmapped'?directoryRows.map(row=>({...row,latitude:0,longitude:0})):directoryRows;
 if(mode==='long')rows=[{...directoryRows[0],name:'The Centre for Comprehensive Family Medicine, Preventive Care and Specialist Consultations',address:'A long illustrative address near the community health centre and residential gardens in the city'}];
 const q=url.searchParams.get('search')?.toLowerCase(),city=url.searchParams.get('city'),specialties=url.searchParams.getAll('specialization'),bounds=url.searchParams.get('bounds')?.split(',').map(Number);
 if(q)rows=rows.filter(row=>[row.name,row.city,...row.specialties].join(' ').toLowerCase().includes(q));
 if(city)rows=rows.filter(row=>row.city===city);
 if(specialties.length)rows=rows.filter(row=>row.specialties.some(s=>specialties.includes(s)));
 if(url.searchParams.get('openNow')==='true'||url.searchParams.get('open24Hours')==='true')rows=rows.filter(row=>row.timings==='24/7');
 if(bounds)rows=rows.filter(row=>row.latitude>=bounds[0]&&row.latitude<=bounds[2]&&row.longitude>=bounds[1]&&row.longitude<=bounds[3]);
 return rows;
}

const requireTool = createRequire(path.resolve(process.env.PLAYWRIGHT_TOOLS_DIR || '.next/landing-tools', 'tool.cjs'));
const requireAudit = createRequire(path.join(process.env.LIGHTHOUSE_TOOLS_DIR || path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022'), 'package.json'));
const output = path.resolve(process.env.BROWSE_REVIEW_OUTPUT || '.next/brand-handoff/browse-directory-redesign');
const origin = 'http://localhost:3107';
const development = process.env.BROWSE_REVIEW_DEV === '1';
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
    value = { success: true, data: filterBrowseCases(url, mode), filters: { cities: ['Pune', 'Surat'], specialties: ['General Physician / Consultant','Cardiology','Orthopedics','Pathology','Radiology'],specialtyCounts:{'General Physician / Consultant':1,Cardiology:1,Orthopedics:1,Pathology:1,Radiology:1} } };
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
  const context = await browser.newContext({ viewport: { width, height: Number(process.env.BROWSE_DIRECTORY_HEIGHT || (width < 768 ? 844 : 1000)) }, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  await context.addInitScript(dark => {localStorage.setItem('ekavyu-mode', dark ? 'dark' : 'light');Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_ok,fail)=>fail({code:1})}});}, dark);
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
    if(url.hostname==='tile.openstreetmap.org')return process.env.BROWSE_REVIEW_LIVE_TILES==='1'?route.continue():route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')});
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

async function inspectDirectory(page,name,errors) {
 if(process.env.BROWSE_REVIEW_LIVE_TILES==='1'&&await page.locator('.leaflet-container').count()){
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.leaflet-tile')];return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0);},{},{timeout:20000});
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.leaflet-tile')].map(image=>image.decode().catch(()=>{})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 }
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.complete).map(i=>i.decode().catch(()=>{})));});
 await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
 const geometry=await page.evaluate(()=>({
  overflow:document.documentElement.scrollWidth>innerWidth,
  nestedLinks:document.querySelectorAll('a a').length,
  cards:[...document.querySelectorAll('ul[aria-label="Healthcare locations"] article')].map(row=>{const box=row.getBoundingClientRect(),logo=row.querySelector('[class*="logoFrame"]').getBoundingClientRect(),actions=row.querySelector('footer')?.getBoundingClientRect();return {height:box.height,logoSquare:Math.abs(logo.width-logo.height)<1,contained:!actions||actions.right<=box.right+1&&actions.bottom<=box.bottom+1};}),
  smallActions:[...document.querySelectorAll('main footer a,main [class*="controls"] button,main [class*="floatingView"]')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&(b.width<43.5||b.height<37.5);}).map(el=>el.textContent),
 }));
 if(development)await page.addScriptTag({path:requireAudit.resolve('axe-core/axe.min.js')});
 else await page.evaluate(await fs.readFile(requireAudit.resolve('axe-core/axe.min.js'),'utf8'));
 const accessibility=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('[role="dialog"]')||document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))};});
 const passed=!geometry.overflow&&!geometry.nestedLinks&&!geometry.smallActions.length&&geometry.cards.every(c=>c.logoSquare&&c.contained)&&!errors.length&&!accessibility.violations.length;
 results.push({name,passed,geometry,accessibility,errors});
 console.log(JSON.stringify({name,passed,violations:accessibility.violations.map(v=>v.id),errors}));
 if(!passed)throw Error('Directory check failed: '+name);
}
try {
 for(let i=0;i<180;i++){try{const r=await fetch(origin+'/browse');if(r.ok)break;}catch{}if(i===179)throw Error(logs.slice(-5000));await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await requireTool('playwright-core').chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const widths=process.env.BROWSE_DIRECTORY_WIDTHS?JSON.parse(process.env.BROWSE_DIRECTORY_WIDTHS):[[320,false],[375,false],[390,false],[768,false],[1024,false],[1440,false],[390,true],[1440,true]];
 for(const[width,dark]of widths) {
  mode='populated';
  const {context,page,errors}=await open(width,dark);
  await page.getByRole('heading',{level:1,name:'Clinics & hospitals',exact:true}).waitFor();
  await page.getByRole('searchbox',{name:'Search by doctor, location name, or specialty'}).waitFor();
  if(await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('tile.openstreetmap.org'))))throw Error('List view downloaded map tiles');
  await inspectDirectory(page,'list-'+width+(dark?'-dark':''),errors);
  await page.getByRole('button',{name:'Map',exact:true}).filter({visible:true}).first().click();
  await page.locator('.leaflet-container').waitFor();
  const clinicPin = page.getByRole('button',{name:/Select Aster Grove Clinic/});
  for(let pan=0;pan<6&&!await clinicPin.isVisible();pan++){
   await page.locator('.leaflet-container').press('ArrowDown');
   await clinicPin.waitFor({state:'visible',timeout:700}).catch(()=>{});
  }
  await clinicPin.click();
  await page.locator('[aria-live="polite"] h2').filter({hasText:'Aster Grove Clinic'}).waitFor();
  await page.locator('[aria-live="polite"]').getByRole('link',{name:'Book appointment'}).waitFor();
  await inspectDirectory(page,'map-'+width+(dark?'-dark':''),errors);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/public/locations?')&&r.url().includes('bounds=')),page.getByRole('button',{name:'Search this area',exact:true}).click()]);
  await page.getByRole('button',{name:'List',exact:true}).filter({visible:true}).first().click();
  // A small zoomed viewport can legitimately contain no facilities. Reset the
  // area in the filter panel before checking the independent opening filter.
  await page.getByText('No locations found',{exact:true}).or(page.getByRole('list',{name:'Healthcare locations'})).waitFor();
  const filtered = page.waitForResponse(r=>r.url().includes('open24Hours=true'));
  if(!await page.getByRole('button',{name:'Filters',exact:true}).isVisible()){
   await page.getByRole('checkbox',{name:'Open 24 hours'}).press('Space');
  }else{
   await page.getByRole('button',{name:'Filters',exact:true}).click();
   const clearArea=page.getByRole('button',{name:'Clear map area'});
   if(await clearArea.isVisible())await clearArea.click();
   await page.getByRole('dialog',{name:'Filter locations'}).getByRole('checkbox',{name:'Open 24 hours'}).press('Space');
   await page.getByRole('button',{name:'Show results'}).click();
  }
  await filtered;
  await page.waitForFunction(()=>document.querySelectorAll('ul[aria-label="Healthcare locations"] article').length===1);
  if(await page.getByRole('list',{name:'Healthcare locations'}).locator('article').count()!==1)throw Error('Opening filter failed');
  results.push({name:'selection-zoom-area-filter-'+width+(dark?'-dark':''),passed:true});
  await context.close();
 }
 for(const state of process.env.BROWSE_DIRECTORY_SKIP_STATES==='1'?[]:['empty','error','single','unmapped','long']){
  mode=state;const{context,page,errors}=await open(390,false,state==='unmapped'?'/browse?view=map':'/browse');
  if(state==='error')await page.getByText("We couldn't load locations",{exact:true}).waitFor();
  else if(state==='empty')await page.getByText('No locations found',{exact:true}).waitFor();
  else if(state==='unmapped')await page.getByText('These facilities have no saved map coordinates.',{exact:true}).waitFor();
  await inspectDirectory(page,'state-'+state,errors);
  await context.close();
 }
 if(writes.some(p=>p!=='/api/public/track-visit'))throw Error('Unexpected write: '+writes.join(','));
} catch(error) {
 results.push({name:'review-execution',passed:false,error:error.message});
 throw error;
} finally {
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({synthetic:true,liveTiles:process.env.BROWSE_REVIEW_LIVE_TILES==='1',results,blockedWrites:writes,unexpectedImageRequests},null,2));
 await browser?.close();next.kill();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));
}
