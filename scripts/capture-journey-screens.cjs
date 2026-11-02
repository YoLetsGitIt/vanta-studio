// Capture the real app with local example responses. No live API calls or writes.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright STUDIO_TEST_URL=http://127.0.0.1:4173 node scripts/capture-journey-screens.cjs
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4173';
const output = path.join(__dirname, '../public/studio/screenshots');
const client = { id:'demo-client', name:'Mia Carter', email:'mia@example.com', phone:'+61400000001', dob:'1998-04-12', booking_count:1, last_booking:'2026-10-09T10:00:00+11:00', design_preferences:'["Fine Line","Blackwork"]' };
const artists = [{ id:'demo-membership', artistId:'demo-artist', name:'Alex Morgan', email:'alex@example.com', status:'approved', acceptingBookings:true }];
const template = { id:'demo-consent', name:'Tattoo consent', updated_at:'2026-09-01T00:00:00Z', requires_signature:true, fields:[] };
const submission = { id:'demo-submission', template_id:template.id, template_name:template.name, client_email:client.email, signer_name:client.name, submitted_at:'2026-09-25T00:00:00Z' };
const defaultBooking = { id:'demo-booking', requester_name:client.name, requester_email:client.email, requester_phone:client.phone, requester_dob:client.dob, artist_id:'demo-artist', artist_name:'Alex Morgan', source:'studio', created_at:'2026-09-25T00:00:00Z', status:'pending', body_location:'Forearm', design_details:'A little botanical piece, inspired by native foliage.', size:'10 cm', color:'Black & grey', proposed_duration_minutes:120, estimated_quote:350, reference_images:[] };
const fields = Object.fromEntries(['artist_id','body_location','design_details','size','image_paths','retouch','skin_tone','notes','allergies'].map(key=>[key,{enabled:['body_location','design_details','size','image_paths'].includes(key),required:key==='design_details'}]));

async function contextFor(browser, state={}) {
  const context = await browser.newContext({viewport:state.viewport||{width:460,height:1000},deviceScaleFactor:state.deviceScaleFactor||2,timezoneId:'Australia/Sydney',...(state.recordVideo?{recordVideo:state.recordVideo}:{})});
  await context.addInitScript(()=>{
    const user={id:'22222222-2222-4222-8222-222222222222',email:'studio@example.com'};
    localStorage.setItem('vanta-theme','dark');
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:2000000000,user}));
    localStorage.setItem(`vanta-studio-tour:${user.id}`,'complete');localStorage.setItem(`vanta-studio-artist-guide:${user.id}`,'complete');
  });
  const booking={...defaultBooking,...state.booking};
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin)return route.continue();
    if(route.request().resourceType()==='script')return route.fulfill({contentType:'application/javascript',body:''});
    const p=url.pathname;
    const custom=state.respond?.(url,route.request());
    if(custom!==undefined)return route.fulfill({json:custom});
    let json={hours:[],stations:[],templates:[],notes:[],submissions:[],consents:{},connected:false};
    if(p.endsWith('/auth/v1/user'))json={id:'22222222-2222-4222-8222-222222222222',email:'studio@example.com'};
    else if(p==='/studio/me')json={status:'approved',studio_id:'demo-studio',studio:{name:'Your Studio',timezone:'Australia/Sydney',subscription_status:'active'}};
    else if(p.endsWith('/artists'))json={artists};
    else if(p==='/studios/demo-studio/public')json={name:'Your Studio',artists};
    else if(p.endsWith('/form-config'))json={fields};
    else if(p.endsWith('/consent-templates'))json={templates:p.startsWith('/studios/')?[]:[template]};
    else if(p.endsWith('/consent-submissions'))json={submissions:state.signed?[submission]:[]};
    else if(p==='/studio/me/clients/consents')json={consents:{},current_version:'1'};
    else if(p==='/studio/me/clients')json={clients:[client]};
    else if(p==='/studio/me/clients/demo-client')json={client,bookings:[booking]};
    else if(p==='/studio/me/bookings')json={bookings:[booking]};
    else if(p==='/studio/me/bookings/demo-booking')json=booking;
    else if(p.endsWith('/stripe/status'))json={connected:true};
    else if(p.endsWith('/sms'))json={opt_in:false,opted_out:false,delivery:{status:'not_opted_in'}};
    return route.fulfill({json});
  });
  return context;
}
async function capture(page,name,locator){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(250);
  if(locator){const r=await locator.boundingBox();if(!r)throw Error(`Missing capture ${name}`);await page.screenshot({path:path.join(output,`${name}.png`),clip:{x:r.x,y:r.y,width:r.width,height:Math.min(r.height,680)},animations:'disabled'});}
  else await page.screenshot({path:path.join(output,`${name}.png`),animations:'disabled'});
  console.log('Captured',name);
}
async function main(){fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch();try{
  {
    const context=await contextFor(browser);const page=await context.newPage();await page.setViewportSize({width:460,height:680});
    await page.goto(`${base}/studio-booking.html?s=demo-studio`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Your Studio',exact:true}).waitFor();
    await page.getByLabel('First name',{exact:false}).fill('Mia');await page.getByLabel('Last name',{exact:false}).fill('Carter');
    await page.evaluate(()=>document.activeElement.blur());
    if(process.argv.includes('--full-form-only')){
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(output,'booking-form-full.png'),fullPage:true,animations:'disabled'});
      console.log('Captured booking-form-full');await context.close();return;
    }
    await capture(page,'booking-form');
    await page.getByText('Your tattoo',{exact:true}).scrollIntoViewIfNeeded();
    await page.evaluate(()=>{const heading=[...document.querySelectorAll('*')].find(el=>el.textContent==='Your tattoo'&&el.children.length===0);window.scrollTo({top:window.scrollY+heading.getBoundingClientRect().top-24,behavior:'instant'})});
    await capture(page,'booking-form-details');await context.close();
  }
  if(process.argv.includes('--forms-only'))return;
  for(const [name,status]of [['enquiry','pending'],['estimate','pending'],['availability','requires_confirmation'],['selection','awaiting_payment'],['confirmed','confirmed']]){
    const selected=['selection','confirmed'].includes(name),paid=name==='confirmed';
    const context=await contextFor(browser,{booking:{status,chosen_time:selected?'2026-10-09T10:00:00+11:00':null,proposed_time_primary:name==='availability'?'2026-10-09T10:00:00+11:00':null,proposed_time_secondary:name==='availability'?'2026-10-10T11:00:00+11:00':null,deposit_required:selected,deposit_amount:selected?100:null,deposit_paid_at:paid?'2026-09-25T00:00:00Z':null,deposit_confirmed_at:paid?'2026-09-25T00:00:00Z':null}});
    const page=await context.newPage();await page.goto(`${base}/dashboard/appointments.html?booking=demo-booking&status=${status}`,{waitUntil:'networkidle'});
    const panel=page.locator('.studio-booking-detail');await panel.getByRole('button',{name:'Close booking details'}).waitFor();
    if(name==='estimate'){
      await panel.getByRole('button',{name:'Send Link',exact:true}).click();
      const modal=page.getByRole('dialog',{name:'Send selection link',exact:true});await modal.waitFor();
      await capture(page,name,modal);
    }else await capture(page,name,panel);
    await context.close();
  }
  for(const signed of [false,true]){
    const context=await contextFor(browser,{signed,booking:{status:'confirmed',chosen_time:'2026-10-09T10:00:00+11:00'}});const page=await context.newPage();
    await page.goto(`${base}/dashboard/clients.html?client=demo-client`,{waitUntil:'networkidle'});const panel=page.locator('.studio-client-detail');await panel.getByRole('button',{name:'Close client details'}).waitFor();
    await panel.getByText(signed?'Consented':'Not consented',{exact:true}).first().waitFor();await capture(page,signed?'consent-signed':'consent',panel);await context.close();
  }
}finally{await browser.close()}}
module.exports={contextFor};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
