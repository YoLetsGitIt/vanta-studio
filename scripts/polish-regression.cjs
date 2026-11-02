// Every remote request is intercepted. No live messages, payments or appointments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup, booking, client } = require('./polish-fixtures.cjs');
const studio = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const web = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:3030';
const output = process.env.POLISH_OUTPUT || '../artifacts/polish-fixes-2026-10-10';
const future = new Date(Date.now()+7*86400000).toISOString();
const alternate = new Date(Date.now()+8*86400000).toISOString();
const pending = { id:'local-booking', status:'pending', session_type:'piercing', artist_name:'Local Artist', proposed_time_primary:future, proposed_time_alt1:alternate, user_response_deadline:new Date(Date.now()+86400000).toISOString(),deposit_required:false };
const consent = { id:'local-consent',type:'consent',name:'Local consent',requires_signature:true,fields:[] };
const results=[];
(async()=>{
 const browser=await chromium.launch();
 async function run(name, action, {site='studio',lang='en',width=390,auth=true}={}) {
  const context=await browser.newContext({viewport:{width,height:844}});
  const errors=[],writes=[];
  if(site==='studio')await setup(context);
  await context.addInitScript(({lang,auth})=>{
   localStorage.setItem('studioLanguage',lang);
   if(auth){const user={id:'22222222-2222-4222-8222-222222222222',email:'client@example.test',aud:'authenticated',role:'authenticated'};localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token',JSON.stringify({access_token:'local-access',refresh_token:'local-refresh',expires_at:2000000000,user}));}
   else localStorage.removeItem('sb-aznxvdnpvbcofaqxgmtu-auth-token');
  },{lang,auth});
  if(site==='web')await context.route('**/*',r=>{
   const req=r.request(),url=new URL(req.url());if(url.origin===web)return r.continue();
   if(req.method()!=='GET'){writes.push(url.pathname);return r.fulfill({status:400,json:{error:'Unexpected write'}});}
   if(url.pathname==='/auth/v1/user')return r.fulfill({json:{id:'22222222-2222-4222-8222-222222222222',email:'client@example.test'}});
   return r.fulfill({json:pending});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try {await action(page,context,writes);assert.deepEqual(errors,[]);await page.screenshot({path:output+'/'+name+'.png'});results.push({name,passed:true,writes});console.log('PASS',name);}
  catch(error){await page.screenshot({path:output+'/'+name+'-failure.png'});fs.writeFileSync(output+'/'+name+'-failure.txt',await page.locator('body').innerText());results.push({name,passed:false,error:String(error),errors,writes});throw error;}
  finally {await context.close();}
 }
 try {
  await run('clients-error-retry',async(p,c)=>{
   let fail=true;await c.route('**/studio/me/clients',r=>r.fulfill(fail?{status:503,json:{error:'Local failure'}}:{json:{clients:[client]}}));
   await p.goto(studio+'/dashboard/clients.html',{waitUntil:'networkidle'});assert(!await p.getByText('No clients found.',{exact:true}).count());
   fail=false;await p.getByRole('button',{name:'Try again',exact:true}).click();await p.getByText(client.name,{exact:true}).first().waitFor();
  });
  await run('piercing-detail',async(p,c)=>{
   await c.route('**/studio/me/bookings/booking-1',r=>r.fulfill({json:{...booking,session_type:'piercing',body_location:'Nostril'}}));
   await p.goto(studio+'/dashboard/appointments.html?booking=booking-1',{waitUntil:'networkidle'});
   await p.getByRole('heading',{name:'Piercing',exact:true}).waitFor();await p.getByRole('button',{name:'Copy email',exact:true}).waitFor();
  });
  for(const [lang,title,newTemplate,settings] of [['en','Marketing','New template','Settings'],['zh-Hans','营销','新模板','设置'],['ko','마케팅','새 템플릿','설정']])await run('marketing-'+lang,async(p)=>{
   await p.goto(studio+'/dashboard/marketing.html',{waitUntil:'networkidle'});await p.getByRole('heading',{name:title,exact:true}).waitFor();await p.getByRole('heading',{name:newTemplate,exact:true}).waitFor();
   const picker=p.getByRole('button',{name:lang==='en'?'Choose a saved template or example':lang==='ko'?'저장한 템플릿 또는 예시 선택':'选择已保存的模板或示例',exact:true});await picker.click();assert.equal(await picker.getAttribute('aria-expanded'),'true');
   await p.getByRole('tab',{name:settings,exact:true}).click();
  },{lang});
  await run('financial-data-table',async(p)=>{
   await p.goto(studio+'/dashboard/financial.html',{waitUntil:'networkidle'});await p.getByText('View chart data',{exact:true}).click();await p.getByRole('table').first().waitFor();assert((await p.locator('tbody tr').count())>0);
  },{width:1440});
  for(const site of ['studio','web'])await run('typed-signature-'+site,async(p,c)=>{
   if(site==='studio'){
    await c.route('**/studios/local-studio/public',r=>r.fulfill({json:{id:'local-studio',name:'Local Studio'}}));
    await c.route('**/studios/local-studio/consent-templates?**',r=>r.fulfill({json:{templates:[consent]}}));
   }else await c.route('**/public/consent/local-token',r=>r.fulfill({json:{studio_id:'local-studio',studio_name:'Local Studio',templates:[consent],dob:'1990-01-01'}}));
   await p.goto((site==='studio'?studio+'/consent.html?s=local-studio':web+'/consent.html?token=local-token'),{waitUntil:'networkidle'});
   await p.getByRole('button',{name:'Type signature',exact:true}).click();await p.getByLabel('Full name for your electronic signature').fill('Local Client');await p.getByRole('button',{name:'Use typed signature',exact:true}).press('Enter');await p.getByText('Signature added.',{exact:true}).waitFor();
   const inputRect=await p.getByLabel('Full name for your electronic signature').boundingBox();const labelRect=await p.getByLabel('Full name for your electronic signature').locator('..').boundingBox();assert(inputRect.x+inputRect.width<=labelRect.x+labelRect.width+1);await p.getByLabel('Full name for your electronic signature').fill('Edited Client');assert(!await p.getByText('Signature added.',{exact:true}).count());
  },{site});
  for(const type of ['confirm','confirmed'])await run('pending-'+type,async(p)=>{
   await p.goto(web+`/bookings/_/${type}.html?id=local-booking`,{waitUntil:'networkidle'});
   await p.getByRole('heading',{name:type==='confirm'?'Choose your time':'Booking not confirmed',exact:true}).waitFor();
   if(type==='confirm'){assert.equal(await p.getByRole('button',{name:/Local/}).count(),0);assert((await p.getByRole('button',{name:/2026|2027/}).count())===2);}
   assert(!await p.getByText('Your deposit has been received.',{exact:true}).count());
  },{site:'web'});
  for (const deposit of [false, true]) await run('proposal-accept-'+(deposit?'deposit':'no-deposit'), async(p,c,writes)=>{
   let stored={...pending,deposit_required:deposit,deposit_amount:deposit?50:null};
   await c.route('**/bookings/local-booking',r=>r.fulfill({json:stored}));
   await c.route('**/bookings/local-booking/web-accept',async r=>{
    assert.equal(r.request().headers()['x-booking-statuses'],'v2');
    assert.equal(r.request().headers()['x-booking-session-types'],'v2');
    assert.equal(r.request().postDataJSON().chosen_time,alternate);
    writes.push('intercepted proposal acceptance');stored={...stored,status:deposit?'awaiting_payment':'confirmed',chosen_time:alternate};
    await r.fulfill({json:deposit?{checkout_url:'https://checkout.example.test/local-checkout'}:{}});
   });
   await c.route('**/local-checkout',r=>r.fulfill({contentType:'text/html',body:'<h1>Isolated checkout</h1>'}));
   await p.goto(web+'/bookings/_/confirm.html?id=local-booking',{waitUntil:'networkidle'});
   await p.getByRole('button',{name:/2026|2027/}).nth(1).click();await p.getByRole('button',{name:deposit?'Confirm & pay $50.00':'Confirm booking',exact:true}).click();
   await p.getByRole('heading',{name:deposit?'Isolated checkout':'Booking confirmed',exact:true}).waitFor();assert.equal(writes.length,1);
  },{site:'web'});
  await run('proposal-save-error-preserves-choice',async(p,c)=>{
   await c.route('**/bookings/local-booking/web-accept',r=>r.fulfill({status:503,json:{error:'Local save failure'}}));
   await p.goto(web+'/bookings/_/confirm.html?id=local-booking',{waitUntil:'networkidle'});await p.getByRole('button',{name:/2026|2027/}).nth(1).click();await p.getByRole('button',{name:'Confirm booking',exact:true}).click();await p.getByText('Local save failure',{exact:true}).waitFor();await p.getByRole('button',{name:'Try again',exact:true}).click();await p.getByRole('heading',{name:'Choose your time'}).waitFor();assert.equal(await p.getByRole('button',{name:/2026|2027/}).nth(1).getAttribute('aria-pressed'),'true');
  },{site:'web'});
  await run('expired-proposal',async(p,c)=>{
   await c.route('**/bookings/local-booking',r=>r.fulfill({json:{...pending,user_response_deadline:'2020-01-01T00:00:00Z'}}));
   await p.goto(web+'/bookings/_/confirm.html?id=local-booking',{waitUntil:'networkidle'});await p.getByText(/This proposal has expired/).waitFor();
  },{site:'web'});
  for(const [name,data,message] of [
   ['no-deposit',{status:'confirmed',deposit_required:false},'No deposit is required.'],
   ['paid',{status:'confirmed',deposit_required:true,deposit_paid_at:new Date().toISOString()},'Your deposit has been received.'],
   ['processing',{status:'awaiting_payment',deposit_required:true},'Your deposit has not been confirmed yet.'],
  ])await run('receipt-'+name,async(p,c)=>{
   await c.route('**/bookings/local-booking',r=>r.fulfill({json:{...pending,chosen_time:future,...data}}));
   await p.goto(web+'/bookings/_/confirmed.html?id=local-booking',{waitUntil:'networkidle'});await p.getByText(message,{exact:false}).waitFor();
  },{site:'web'});
  await run('receipt-requires-signin',async(p)=>{await p.goto(web+'/bookings/_/confirmed.html?id=local-booking',{waitUntil:'networkidle'});await p.getByRole('heading',{name:'Sign in to view your booking'}).waitFor();},{site:'web',auth:false});
  for(const type of ['cancel','reschedule'])await run(type+'-retry',async(p,c)=>{
   let fail=true;await c.route('**/bookings/local-booking/manage?**',r=>r.fulfill(fail?{status:503,json:{error:'Local failure'}}:{json:{...pending,status:'confirmed',chosen_time:future,can_reschedule:true}}));
   await p.goto(web+`/bookings/_/${type}.html?id=local-booking&t=local-token`,{waitUntil:'networkidle'});await p.getByRole('heading',{name:'Unable to load your booking'}).waitFor();fail=false;await p.getByRole('button',{name:'Try again',exact:true}).click();await p.getByRole('heading',{name:'Unable to load your booking'}).waitFor({state:'hidden'});assert(!await p.getByText('Link not found',{exact:true}).count());
  },{site:'web'});
  await run('redirect-does-not-prove-payment',async(p,c)=>{
   await c.route('**/booking/local-token',r=>r.fulfill({json:{booking:{...pending,status:'awaiting_payment',chosen_time:future,deposit_required:true},studio:{name:'Local Studio',timezone:'Australia/Melbourne'},artists:[]}}));
   await p.goto(web+'/booking/_.html?token=local-token&deposit=paid',{waitUntil:'networkidle'});await p.getByRole('heading',{name:'Waiting for payment confirmation'}).waitFor();assert(!await p.getByText('Your deposit has been received.',{exact:true}).count());
  },{site:'web'});
 } finally {fs.writeFileSync(output+'/regression-results.json',JSON.stringify(results,null,2));await browser.close();}
 console.log(results.length+' isolated regression scenarios passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
