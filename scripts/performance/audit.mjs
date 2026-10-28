// Run from the frontend root. Tools are resolved from an existing temporary installation.
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fixture, routes } from './fixtures.mjs';

const root=process.cwd(), toolRoot=process.env.LIGHTHOUSE_TOOLS_DIR||path.join(process.env.TEMP,'ekavyu-lighthouse-audit-20261022');
const req=createRequire(path.join(toolRoot,'package.json'));
const puppeteer=req('puppeteer-core'), WebSocketServer=req('ws').Server;
const {navigation,generateReport}=await import(pathToFileURL(path.join(toolRoot,'node_modules/lighthouse/core/index.js')));
const {default:desktop}=await import(pathToFileURL(path.join(toolRoot,'node_modules/lighthouse/core/config/desktop-config.js')));
const origin='http://127.0.0.1:8798', api='https://api.example.invalid:5099';
const mode=process.env.AUDIT_MODE||'smoke', profile=process.env.AUDIT_PROFILE||'mobile';
const cold=process.env.AUDIT_COLD!=='0';
const dist=process.env.EKAVYU_NEXT_DIST_DIR||'.next/remaining-complete';
const buildId=(await fs.readFile(path.join(root,dist,'BUILD_ID'),'utf8')).trim();
const reports=path.join(process.env.TEMP,'ekavyu-remaining-'+(process.env.AUDIT_STAGE||'before')+'-'+profile+'-'+mode);
await fs.mkdir(reports,{recursive:true});
const selected=process.env.AUDIT_ROUTES?.split(','), runs=Number(process.env.AUDIT_RUNS||1);
if(!['smoke','lighthouse','interaction','accessibility'].includes(mode)||!['mobile','desktop'].includes(profile)||!Number.isInteger(runs)||runs<1||runs>5)throw new Error('Invalid audit mode, profile or run count');
if(selected?.some(name=>!routes.some(route=>route.name===name)))throw new Error('Unknown route selection');
let currentRole='admin', currentRequests=[], unknown=new Set(), sockets=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const waitForView=(page,route)=>page.waitForFunction(expected=>{
 const main=document.querySelector('main,[role=main]');
 if(!main)return false;
 if(expected.readySelector){if(!main.querySelector(expected.readySelector)?.textContent.trim())return false;}
 else if(!main.innerText.toLowerCase().includes(expected.text.toLowerCase()))return false;
 const busy=[...main.querySelectorAll('[aria-busy="true"]')].some(node=>{
  const rect=node.getBoundingClientRect();
  return node.tagName!=='IMG'&&!node.closest('[aria-hidden="true"]')&&rect.height>0&&rect.top<innerHeight&&rect.bottom>0;
 });
 return !busy;
},{timeout:10000},route);
function response(url,method){const value=fixture(url,currentRole,method);if(value===undefined){unknown.add(method+' '+url.pathname);return {status:501,body:{success:false,message:'Unconfigured audit fixture'}};}return {status:200,body:value};}
const handler=async(request,res)=>{
 const url=new URL(request.url,'http://127.0.0.1:5100');
 const result=response(url,request.method);currentRequests.push({method:request.method,path:url.pathname+url.search,status:result.status,kind:request.headers.origin?'browser':'server'});
 await pause(40);res.writeHead(request.method==='OPTIONS'?204:result.status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type, authorization, x-patient-record-access','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Expose-Headers':'x-total-count,x-total-pages','x-total-count':'1','x-total-pages':'1'});res.end(request.method==='OPTIONS'?'':JSON.stringify(result.body));
};
const backend=http.createServer(handler);
const secure=https.createServer({key:await fs.readFile(path.join(process.env.TEMP,'ekavyu-audit-key.pem')),cert:await fs.readFile(path.join(process.env.TEMP,'ekavyu-audit-cert.pem'))},handler);
const ws=new WebSocketServer({server:secure});
ws.on('connection',socket=>{sockets++;socket.on('message',message=>{if(String(message)==='ping')socket.send('pong');});});
const frontendProbe=http.createServer();
await new Promise((resolve,reject)=>{frontendProbe.once('error',reject);frontendProbe.listen(8798,'127.0.0.1',resolve);});
await new Promise(resolve=>frontendProbe.close(resolve));
await new Promise((resolve,reject)=>{backend.once('error',reject);backend.listen(5100,'127.0.0.1',resolve);});
await new Promise((resolve,reject)=>{secure.once('error',reject);secure.listen(5099,'127.0.0.1',resolve);});
const env={...process.env,NODE_ENV:'production',NEXT_PUBLIC_API_URL:api+'/api',NEXT_PUBLIC_BACKEND_URL:api,NEXT_PUBLIC_WS_URL:'wss://api.example.invalid:5099',APP_URL:'https://api.example.invalid',BACKEND_INTERNAL_URL:'http://127.0.0.1:5100',EKAVYU_NEXT_DIST_DIR:dist,NEXT_TELEMETRY_DISABLED:'1'};
let logs='',browser;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','8798'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',c=>logs+=c);server.stderr.on('data',c=>logs+=c);
const rows=[];
try{
 for(let n=0;n<100;n++){try{if((await fetch(origin+'/manifest.json')).ok)break;}catch{}if(server.exitCode!==null)throw new Error(logs);await pause(200);if(n===99)throw new Error('Server startup timeout');}
 for(const route of routes.filter(r=>!selected||selected.includes(r.name)))for(let run=1;run<=runs;run++){
  console.log(JSON.stringify({route:route.name,profile,run,mode,phase:'starting view'}));
  if(!browser)browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:60000,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-proxy-server','--host-resolver-rules=MAP api.example.invalid 127.0.0.1','--ignore-certificate-errors']});
  currentRole=route.role||'admin';currentRequests=[];unknown=new Set();sockets=0;
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],pageErrors=[],failedRequests=[];
  const row={route:route.name,path:route.path,role:route.role,profile,run,mode,cold,buildDist:dist,buildId,collectedAt:new Date().toISOString(),status:'unverified'};
  const inspectView=async()=>{
   row.content=await page.evaluate(()=>({path:location.pathname,headings:[...document.querySelectorAll('h1')].map(n=>n.textContent),text:(document.querySelector('main,[role=main]')||document.body).innerText.slice(0,5000),overflow:document.documentElement.scrollWidth>innerWidth,mainCount:document.querySelectorAll('main,[role=main]').length}));
   if(row.content.path!==route.path.split('?')[0]||pageErrors.length||unknown.size||/Something went wrong|Unable to verify your session|could not be loaded|records unavailable/i.test(row.content.text))throw new Error('Fixture/view validation failed');
   if(row.content.mainCount!==1||row.content.headings.length!==1||row.content.overflow)throw new Error('Page landmark, title or viewport validation failed');
   const required={clinic:['Synthetic doctor'],doctor:['10:00'],'crm-communications':['Synthetic reply for review'],insurance:['Synthetic insurer'],laboratory:['Synthetic blood test'],pharmacy:['Synthetic Medicine']};
   if(required[route.name]?.some(text=>!row.content.text.includes(text)))throw new Error('Expected populated record is missing');
  };
  try{
   if(route.role)await context.setCookie(...[['access_token','synthetic-audit'],['refresh_token','synthetic-audit'],['ekavyu_session','1']].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})));
   await page.setViewport(profile==='desktop'?{width:1350,height:940}:{width:390,height:844,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(((m.location().url||'')+' '+m.text()).trim().slice(0,500));});
   page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
   await page.setRequestInterception(true);
   page.on('request',async request=>{try{
    const u=new URL(request.url());if(u.origin===origin||['data:','blob:'].includes(u.protocol))return request.continue();
    if(u.origin===api)return request.continue();
    if(['ipwho.is','ipapi.co'].includes(u.hostname))return request.respond({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:JSON.stringify({success:false,error:'Synthetic location unavailable'})});
    return request.abort('blockedbyclient');
   }catch(e){errors.push('interception: '+e.message);}});
   const started=Date.now();
   if(mode!=='lighthouse'){
    await page.goto(origin+route.path,{waitUntil:'domcontentloaded',timeout:20000});
    await waitForView(page,route);
    row.meaningfulContentMs=Date.now()-started;
    await pause(300);await inspectView();
   }
   if(mode==='lighthouse'){
    // Lighthouse clears HTTP/memory cache, service workers and CacheStorage by
    // default, preserving cookies. A verified session must not imply a warm cache.
    const result=await navigation(page,origin+route.path,{flags:{logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo'],disableStorageReset:!cold,maxWaitForLoad:30000},...(profile==='desktop'?{config:desktop}:{})});
    const lhr=result.lhr;
    await fs.writeFile(path.join(reports,route.name+'-'+run+'.json'),JSON.stringify(lhr));
    if(lhr.runtimeError)throw new Error(lhr.runtimeError.message);
    if(Object.values(lhr.categories).some(c=>c.score===null))throw new Error('Lighthouse category score unavailable');
    for(const metric of ['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index']){
     if(!Number.isFinite(lhr.audits[metric]?.numericValue))throw new Error('Lighthouse metric unavailable: '+metric);
    }
    // Lighthouse may restore/reload the page after collecting its artifacts.
    // Validate that restored view only after its requests and React updates settle.
    await waitForView(page,route);
    await inspectView();
    row.scores=Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)]));
    row.metrics=Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(k=>[k,lhr.audits[k]?.numericValue]));
    const network=lhr.audits['network-requests'].details.items, scripts=network.filter(r=>r.resourceType==='Script');
    row.network={requests:network.length,prefetchRequests:network.filter(r=>r.url.includes('_rsc')).length,scriptRequests:scripts.length,scriptBytes:scripts.reduce((n,r)=>n+r.resourceSize,0),scriptTransferBytes:scripts.reduce((n,r)=>n+r.transferSize,0)};
    row.lighthouseVersion=lhr.lighthouseVersion;row.throttling=lhr.configSettings.throttling;row.warnings=lhr.runWarnings;
    row.failedAudits=Object.values(lhr.audits).filter(a=>a.score!==null&&a.score<1&&['binary','numeric'].includes(a.scoreDisplayMode)).map(a=>({id:a.id,title:a.title,details:a.details}));
    await fs.writeFile(path.join(reports,route.name+'-'+run+'.html'),generateReport(lhr,'html'));
   }
   if(mode==='accessibility'){
    await page.evaluate(await fs.readFile(req.resolve('axe-core/axe.min.js'),'utf8'));
    const results=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    row.axeVersion=results.testEngine.version;
    row.violations=results.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));
    row.incomplete=results.incomplete.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));
    if(row.violations.length)throw new Error('WCAG accessibility violations remain');
   }
   if(mode==='interaction'){
    await page.evaluate(()=>{window.__auditNavigationMarker='same-document';});
    if(route.name==='home'){
     await page.evaluate(()=>document.querySelector('#plans')?.scrollIntoView());
     await page.waitForFunction(()=>document.querySelector('main')?.innerText.includes('Synthetic practice'));
     if(currentRequests.filter(r=>r.method==='GET'&&r.path==='/api/billing/plans').length!==1)throw new Error('Home did not load exactly one public-plan catalogue');
     await page.waitForFunction(()=>[...document.querySelectorAll('a[href="/pricing"]')].some(a=>a.getClientRects().length));
     await page.evaluate(()=>[...document.querySelectorAll('a[href="/pricing"]')].find(a=>a.getClientRects().length).click());
     await page.waitForFunction(()=>location.pathname==='/pricing'&&document.querySelector('main')?.textContent.includes('Synthetic practice'));
     if(currentRequests.filter(r=>r.method==='GET'&&r.path==='/api/billing/plans').length!==1)throw new Error('Public plan cache was not reused');
     row.interaction='Home to pricing reuses one public-plan read';
    }else if(route.name==='pricing'){
     const navStarted=Date.now();
     await page.click('a[href="/browse"]');
     await page.waitForFunction(()=>location.pathname==='/browse'&&document.querySelector('main')?.textContent.includes('Synthetic Audit Clinic'));
     row.navigationMs=Date.now()-navStarted;
     row.interaction='Pricing to browse retains the document after disabling automatic public navigation prefetch';
    }else if(route.name==='dashboard'){
     if(currentRequests.some(r=>r.path.includes('/ai/')))throw new Error('AI loaded before the user opened it');
     if(currentRequests.some(r=>/^\/api\/notifications(?:\?|$)/.test(r.path)))throw new Error('Notification list loaded before opening');
     const touchAction=await page.$eval('#dashboard-navigation',node=>getComputedStyle(node).touchAction);
     if(!touchAction.includes('pan-y')||!touchAction.includes('pinch-zoom'))throw new Error('Drawer gesture CSS is missing');
     await page.click('button[aria-label="Toggle AI Copilot"]');
     await page.waitForSelector('[role="dialog"]');
     await page.waitForSelector('input[aria-label="Message to AI Copilot"]:not([disabled])');
     if(!currentRequests.some(r=>r.path.includes('/ai/chat/sessions')))throw new Error('AI did not load on demand');
     await page.keyboard.press('Escape');
     await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
     await page.click('button[aria-label^="Open Notifications"]');
     await page.waitForFunction(()=>[...document.querySelectorAll('[role="dialog"]')].some(node=>node.textContent.includes('Synthetic schedule update')));
     await page.keyboard.press('Escape');
     await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
     if(profile==='mobile')await page.click('button[aria-label="Toggle Navigation Drawer"]');
     const navStarted=Date.now();
     await page.evaluate(()=>[...document.querySelectorAll('a[href="/dashboard/patients"]')].find(a=>a.getClientRects().length).click());
     await page.waitForFunction(()=>location.pathname==='/dashboard/patients'&&document.querySelector('main')?.textContent.includes('Synthetic Patient'));
     row.navigationMs=Date.now()-navStarted;
     row.interaction='AI opens on demand; notifications close; permitted patient navigation retains the document';
    }else throw new Error('No interaction defined for '+route.name);
    if(await page.evaluate(()=>window.__auditNavigationMarker)!=='same-document')throw new Error('Navigation reloaded the document');
    if(unknown.size||pageErrors.length)throw new Error('Interaction requested an unknown fixture or crashed');
   }
   row.status='validated';
  }catch(e){row.reason=e.message;row.content=await page.evaluate(()=>({path:location.pathname,headings:[...document.querySelectorAll('h1')].map(n=>n.textContent),text:document.querySelector('main')?.innerText.slice(0,3000)})).catch(()=>null);}
  finally{
   Object.assign(row,{requests:currentRequests,unknown:[...unknown],sockets,errors,pageErrors,failedRequests});rows.push(row);
   await fs.writeFile(path.join(reports,'summary.json'),JSON.stringify(rows,null,2));
   console.log(JSON.stringify({route:row.route,status:row.status,scores:row.scores,unknown:row.unknown,reason:row.reason,pageErrors:row.pageErrors,headings:row.content?.headings}));
   await context.close();
   // Accessibility has no timing comparison; fresh contexts isolate sessions without restarting Chrome.
   if(mode!=='accessibility'){await browser.close();browser=null;}
  }
 }
}finally{
 if(browser)await browser.close();if(server.exitCode===null)server.kill();
 for(const client of ws.clients)client.terminate();await new Promise(resolve=>ws.close(resolve));
 backend.closeAllConnections();secure.closeAllConnections();await Promise.all([new Promise(resolve=>backend.close(resolve)),new Promise(resolve=>secure.close(resolve))]);
}
if(rows.some(row=>row.status!=='validated'))process.exitCode=1;
