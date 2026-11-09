// Isolated public page review: synthetic data, no appointment or configuration writes.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { facilityProfile } from './browse-demo.mjs';
const requireTool = createRequire(path.resolve('.next/landing-tools/tool.cjs'));
const requireAudit = createRequire(path.join(process.env.TEMP, 'ekavyu-lighthouse-audit-20261022/package.json'));
const output = path.resolve(process.env.CARE_REVIEW_OUTPUT || '.next/brand-handoff/care-detail-polish');
await fs.mkdir(output, {recursive:true});
const origin = 'http://localhost:3115';
let mode = 'normal', logs = '', browser;
const results = [], writes = [];
const doctor = {...facilityProfile.doctors[0], bookingMode:'sequential_queue', isOnlineBookingClosed:false, workingHours:JSON.stringify(Object.fromEntries(['monday','tuesday','wednesday','thursday','friday'].map(day=>[day,[{start:'09:00',end:'17:00'}]])))};
function location() {
  return {...facilityProfile, googleMapsEmbedUrl:mode==='mapped'?facilityProfile.googleMapsEmbedUrl:'', organizationLocationCount:1, doctors:[{...doctor, ...(mode==='fee'?{fees:0,feeType:'post_consultation'}:{}), ...(mode==='partial'?{qualification:'',specialization:'',experience_years:0}:{}), ...(mode==='long'?{name:'An exceptionally long fictional practitioner name for responsive coverage'}:{})}], ...(mode==='long'?{name:'The Community Centre for Comprehensive Family Medicine and Specialist Consultations',city:'A very long synthetic city name for breadcrumb coverage',address:'A long synthetic address near the community healthcare centre, public gardens and residential neighbourhoods in Surat, Gujarat',email:'appointments.community.healthcare@example.test'}:{}), ...(mode==='partial'?{phone:'',logo_url:''}:{}), ...(mode==='contact'?{onlineBookingAvailable:false,bookingStatus:'contact_location'}:{}), ...(mode==='empty'?{doctors:[],description:'',phone:'',email:'',images:[],amenities:[],timings:''}:{})};
}
const api = http.createServer((request,response)=>{
  const u=new URL(request.url,'http://127.0.0.1:5125');
  response.setHeader('Content-Type','application/json');
  response.setHeader('Access-Control-Allow-Origin',origin);
  response.setHeader('Access-Control-Allow-Credentials','true');
  response.setHeader('Access-Control-Allow-Headers','content-type');
  if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
  if(request.method!=='GET'){writes.push(u.pathname);response.writeHead(405);response.end('{}');return;}
  let value;
  if(u.pathname==='/api/auth/me') value={user:{role:'guest'}};
  else if(u.pathname.includes('/profile')) { const l=location(),d=l.doctors[0];value={id:doctor.id,slug:doctor.slug,name:d.name,specialization:d.specialization,qualification:d.qualification,experienceYears:mode==='partial'?0:7,description:'A fictional MBBS-qualified general physician providing primary care and consultations for common illnesses. This profile is synthetic review data.',imageUrl:null,languages:[],organizationName:l.name,organizationLocationCount:1,organizationLogo:null,currency:'INR',locations:[{...l,logo:null,brandColor:'#0F6F66',fees:d.fees,feeType:d.feeType,bookingMode:d.bookingMode}]}; }
  else if(u.pathname.includes('/slots')) { if(mode==='error'){response.writeHead(503);response.end('{}');return;}value={isWorkingDay:true,bookingMode:mode==='slots'?'time_slot':'sequential_queue',nextToken:mode==='full'?null:3,maxDailyTokens:mode==='full'?2:50,tokensToday:2,slots:mode==='slots'?[{time:'10:00',available:true},{time:'10:30',available:true}]:[],appointmentDuration:15}; }
  else if(u.pathname.startsWith('/api/public/locations/'))value=location();
  else {response.writeHead(404);response.end('{}');return;}
  response.end(JSON.stringify({success:true,data:value}));
});
await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(5125,'127.0.0.1',resolve);});
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','localhost','--port','3115'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,EKAVYU_NEXT_DIST_DIR:'.next/care-final-polish-dev',BACKEND_INTERNAL_URL:'http://127.0.0.1:5125',NEXT_PUBLIC_API_URL:'https://api.example.invalid/api',NEXT_TELEMETRY_DISABLED:'1'}});
next.stdout.on('data',b=>logs+=b);next.stderr.on('data',b=>logs+=b);
async function open(width,dark,doctorPage,height=width<768?844:1000){
  const context=await browser.newContext({viewport:{width,height},colorScheme:dark?'dark':'light',reducedMotion:'reduce'});
  await context.addInitScript(dark=>localStorage.setItem('ekavyu-mode',dark?'dark':'light'),dark);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text());});page.on('requestfailed',r=>console.log('Request failed:',r.url(),r.failure()));
  await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(u.pathname);return route.fulfill({status:405,body:'{}'});}
    if(u.hostname==='api.example.invalid'){const r=await fetch('http://127.0.0.1:5125'+u.pathname+u.search,{method:req.method()});return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});}
    if(u.hostname==='www.google.com'&&u.pathname==='/maps/embed')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic map</title><body style="margin:0;background:#dce8e2;color:#29332e;font:14px sans-serif;display:grid;place-items:center;height:190px">Configured map · synthetic fixture</body></html>'});
    if(['localhost','127.0.0.1'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return route.continue();
    return route.abort();
  });
  await page.goto(origin+(doctorPage?'/doctor/'+doctor.slug+'?location='+facilityProfile.slug:'/browse/'+facilityProfile.slug));
  await page.getByRole('heading',{level:1}).waitFor();
  if(doctorPage&&mode!=='contact')await page.getByRole('button',{name:'Continue to Details',exact:true}).waitFor();
  if(doctorPage&&!['contact','error'].includes(mode))await page.getByText('Availability updated',{exact:true}).waitFor({state:'attached'});
  await page.getByRole('link',{name:/^sign in$/i}).waitFor();
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  return {context,page,errors};
}
async function inspect(page,name,errors){
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.complete).map(i=>i.decode().catch(()=>{})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  await page.screenshot({path:path.join(output,name+'.png'),fullPage:!await page.getByRole('dialog').count()});
  const geometry=await page.evaluate(()=>{
    const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;
    return {overflow:document.documentElement.scrollWidth>innerWidth,nestedLinks:document.querySelectorAll('a a').length,
      contactCollisions:[...document.querySelectorAll('[class*="summaryContact"]')].some(cell=>{const link=cell.querySelector('a'),copy=cell.querySelector('button');return link&&copy&&overlaps(link.getBoundingClientRect(),copy.getBoundingClientRect());}),
      breadcrumbContained:[...document.querySelectorAll('nav[aria-label="Breadcrumb"]')].every(nav=>{const r=nav.getBoundingClientRect();return r.height<=64&&[...nav.querySelectorAll('a')].every(a=>a.getBoundingClientRect().right<=r.right+1);}),
      bookingBarCollision:(()=>{const bar=document.querySelector('[aria-label="Appointment booking"]'),card=document.querySelector('[data-facility-doctor]');if(!bar||!card||bar.getBoundingClientRect().height===0)return false;const r=card.getBoundingClientRect();return r.bottom>64&&r.top<innerHeight;})(),
      smallPhoneActions:innerWidth>=768?[]:[...document.querySelectorAll('main button,[role="main"] button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.5||r.height<43.5);}).map(b=>b.getAttribute('aria-label')||b.textContent.trim()),
      rows:[...document.querySelectorAll('article')].map(row=>{const r=row.getBoundingClientRect();return [...row.querySelectorAll('a,button')].every(el=>{const b=el.getBoundingClientRect();return b.width===0||b.right<=r.right+1&&b.left>=r.left-1;});})};
  });
  await page.addScriptTag({path:requireAudit.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('[role="dialog"]')||document.querySelector('main')||document.querySelector('[role="main"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
  const passed=!geometry.overflow&&!geometry.nestedLinks&&!geometry.contactCollisions&&!geometry.bookingBarCollision&&geometry.breadcrumbContained&&!geometry.smallPhoneActions.length&&geometry.rows.every(Boolean)&&!errors.length&&!violations.length;
  results.push({name,passed,geometry,violations,errors:[...errors]});console.log(JSON.stringify({name,passed,violations}));
  if(!passed)throw Error('Review failed: '+name);
}
try {
  for(let i=0;i<150;i++){try{if((await fetch(origin+'/browse/'+facilityProfile.slug)).ok)break;}catch{}if(i===149)throw Error(logs.slice(-5000));await new Promise(r=>setTimeout(r,500));}
  browser=await requireTool('playwright-core').chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const viewports=process.env.CARE_REVIEW_WIDTHS?JSON.parse(process.env.CARE_REVIEW_WIDTHS):[[320,false],[360,false],[390,false],[430,false],[640,false],[768,false],[899,false],[900,false],[1024,false],[1280,false],[1440,false],[390,true],[1440,true]];
  for(const [width,dark] of viewports)for(const doctorPage of [false,true]){
    mode='normal';const {context,page,errors}=await open(width,dark,doctorPage);
    if(doctorPage)await page.getByText('Your token number is assigned after booking.',{exact:true}).waitFor();
    await inspect(page,(doctorPage?'doctor':'facility')+'-'+width+(dark?'-dark':''),errors);
    if(width===390&&!dark){
      if(doctorPage){await page.getByRole('button',{name:'Continue to Details',exact:true}).click();await page.getByRole('button',{name:'Confirm Appointment',exact:true}).waitFor();await inspect(page,'doctor-details-390',errors);await page.getByRole('button',{name:'Back',exact:true}).click();}
      else{
        await page.getByRole('button',{name:'Copy address',exact:true}).click();await page.getByText('Address copied.',{exact:true}).waitFor();
        await page.locator('[data-facility-booking-action]').evaluate(el=>el.scrollIntoView({block:'center'}));
        await page.getByRole('region',{name:'Appointment booking'}).waitFor({state:'hidden'});await inspect(page,'facility-card-action-390',errors);
        await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
        const cardBottom=await page.locator('[data-facility-doctor]').evaluate(el=>el.getBoundingClientRect().bottom);
        if(cardBottom<=64)await page.getByRole('region',{name:'Appointment booking'}).getByRole('button',{name:'Book now',exact:true}).click();
        else await page.locator('[data-facility-booking-action]').click();
        await page.getByRole('dialog').waitFor();await inspect(page,'facility-booking-390',errors);
      }
    }
    await context.close();
  }
  for(const scenario of process.env.CARE_REVIEW_SKIP_STATES==='1'?[]:['long','partial','fee','contact','empty','mapped','slots','full','error'])for(const doctorPage of scenario==='empty'||scenario==='mapped'?[false]:[false,true]){
    mode=scenario;const {context,page,errors}=await open(320,false,doctorPage);
    if(doctorPage&&scenario==='slots'){await page.getByRole('button',{name:'10:00 AM',exact:true}).click();if(await page.getByRole('button',{name:'Continue to Details'}).isDisabled())throw Error('Slot selection did not enable continue');}
    if(doctorPage&&scenario==='full')await page.getByText('All tokens are booked',{exact:true}).waitFor();
    if(doctorPage&&scenario==='error')await page.getByText('Availability could not be checked. Please try again.',{exact:true}).waitFor();
    await inspect(page,(doctorPage?'doctor':'facility')+'-'+scenario+'-320',errors);await context.close();
  }
  for(const width of [900,1024,1440]){
    mode='normal';const {context,page,errors}=await open(width,false,true,520);
    await page.getByRole('button',{name:'Continue to Details',exact:true}).click();
    const confirm=page.getByRole('button',{name:'Confirm Appointment',exact:true});await confirm.waitFor();
    const box=await confirm.boundingBox();if(!box||box.y<64||box.y+box.height>520)throw Error('Booking footer leaves the short-screen viewport');
    await page.getByPlaceholder(/Fever,/i).focus();
    const visibleForm=await confirm.evaluate(button=>{
      const panel=button.closest('section'),body=panel.querySelector('[class*="body"]'),header=panel.querySelector('header'),input=body.querySelector('input:focus');
      const r=input.getBoundingClientRect(),h=header.getBoundingClientRect(),footer=button.parentElement.getBoundingClientRect();
      return h.top>=64&&r.top>=h.bottom-1&&r.bottom<=footer.top+1&&[...button.parentElement.querySelectorAll('button')].every(action=>{const b=action.getBoundingClientRect();return [.25,.5,.75].every(t=>action.contains(document.elementFromPoint(b.left+b.width*t,b.top+b.height/2)));});
    });
    if(!visibleForm)throw Error('Booking fields or controls are clipped or covered on a short screen');
    await inspect(page,'doctor-details-short-'+width,errors);await context.close();
  }
  if(writes.some(p=>p!=='/api/public/track-visit'))throw Error('Unexpected write attempts: '+writes.join(','));
}catch(error){results.push({name:'execution',passed:false,error:error.stack});console.error(error);process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'results.json'),JSON.stringify({synthetic:true,results,blockedWrites:writes},null,2));await fs.writeFile(path.join(output,'server.log'),logs);await browser?.close();next.kill();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
