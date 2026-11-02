// Local-only layout checks; all services are intercepted and writes are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium, webkit} = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const engine = process.env.STUDIO_BROWSER === 'webkit' ? webkit : chromium;
const output = `../artifacts/studio-mobile-2026-10-11/public-${process.env.STUDIO_BROWSER || 'chromium'}`;
fs.mkdirSync(output, {recursive:true});
const results=[], errors=[], writes=[];
const template={id:'local-form',name:'Consent for studio services',requires_signature:true,requires_minor_guardian:true,fields:[{id:'details',type:'text',label:'Additional details',required:false}]};
async function check(page, name){
 await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{
  const visible=el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&getComputedStyle(el).visibility!=='hidden';
  const elements=[...document.querySelectorAll('input,select,textarea,button,canvas')].filter(visible);
  return {overflow:document.documentElement.scrollWidth-innerWidth,
   outside:elements.filter(el=>{const r=el.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1}).map(el=>el.outerHTML.slice(0,120)),
   smallInputs:elements.filter(el=>el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')&&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.outerHTML.slice(0,120)),
   smallButtons:elements.filter(el=>el.matches('button')&&!el.disabled&&(el.getBoundingClientRect().height<43||el.getBoundingClientRect().width<43)).map(el=>el.textContent)};
 });
 results.push({name,...result}); console.log(JSON.stringify({name,...result}));
 await page.screenshot({path:`${output}/${name}.png`,animations:'disabled'});
}
(async()=>{
 const browser=await engine.launch();
 try{
  for(const [width,height] of [[320,640],[390,844],[844,390]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin===new URL(base).origin)return route.continue();
    if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push({url:req.url(),method:req.method()});return route.fulfill({status:400,json:{error:'Isolated public audit blocks writes'}});}
    let json={};
    if(url.pathname.endsWith('/public'))json={name:'Northside Tattoo and Piercing Studio',artists:[{id:'local-artist',name:'Alexandra Montgomery-Williams'}]};
    if(url.pathname.endsWith('/consent-templates'))json={templates:[template]};
    if(url.pathname.endsWith('/form-config'))json={fields:{}};
    if(url.pathname==='/auth/v1/user')json={id:'22222222-2222-4222-8222-222222222222',email:'local@example.test'};
    if(url.pathname==='/auth/users/me')json={name:'Local Client',phone:'+61412345678'};
    return route.fulfill({json});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const route of ['signin','signup']){
    await page.goto(`${base}/${route}`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:route==='signin'?'Welcome back':'Start your free trial',exact:true}).waitFor();
    await check(page,`${route}-${width}`);
   }
   await page.goto(`${base}/studio-booking?s=local`,{waitUntil:'networkidle'});
   await page.getByRole('heading',{name:'Northside Tattoo and Piercing Studio',exact:true}).waitFor();
   await check(page,`tattoo-booking-${width}`);
   await page.getByLabel('Appointment type',{exact:true}).selectOption('piercing');
   await check(page,`piercing-booking-${width}`);
   await page.goto(`${base}/consent?s=local`,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Create account & continue',exact:true}).waitFor();
   await check(page,`consent-auth-${width}`);
   await context.addInitScript(()=>{
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token',JSON.stringify({access_token:'local-test-token',refresh_token:'local-refresh-token',expires_at:2000000000,user:{id:'22222222-2222-4222-8222-222222222222',email:'local@example.test',user_metadata:{full_name:'Local Client',phone:'+61412345678',dob:'2012-01-01'}}}));
   });
   await page.reload({waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Submit consent',exact:true}).waitFor();
   await check(page,`consent-minor-${width}`);
   await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  assert.deepEqual(results.filter(r=>r.overflow>1||r.outside.length||r.smallInputs.length||r.smallButtons.length),[],'Public mobile layouts');
  console.log('Public mobile signup, booking and consent checks passed.');
 }finally{fs.writeFileSync(`${output}/results.json`,JSON.stringify({results,errors,writes},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
