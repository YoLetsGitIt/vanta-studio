// Uses only simulated accounts and billing responses. Never starts checkout.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const {setup}=require('./polish-fixtures.cjs');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3036';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});
 try{
  for(const width of [390,1440])for(const [exempt,status] of [[true,'canceled'],[false,'active'],[false,'canceled']]){
   const context=await browser.newContext({viewport:{width,height:1000}});await setup(context);
   const writes=[];
   await context.route('**/*',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(new URL(route.request().url()).pathname);return route.fulfill({status:403,json:{error:'No mutations allowed'}})}
    return route.fallback();
   });
   await context.route('**/studio/me',route=>route.fulfill({json:{status:'approved',studio_id:'test-studio',studio:{name:'Vanta Demo Studio',timezone:'Australia/Melbourne',subscription_status:status,billing_exempt:exempt}}}));
   await context.route('**/studio/me/billing',route=>route.fulfill({json:{billing_exempt:exempt,subscription_status:status,stripe_managed:false,estimated_monthly_cents:exempt?0:3000,next_amount_due_cents:0,seat_count:3,base_tier_seats:6,base_tier_cents:3000,per_extra_seat_cents:500}}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}/dashboard/settings?tab=account`,{waitUntil:'networkidle'});
   if(!exempt&&status==='canceled'){
    assert.equal(await page.getByRole('heading',{name:'Billing',exact:true}).count(),0,'Normal cancelled studio must stay locked');
    assert.ok((await page.locator('body').innerText()).includes('subscription'),'Normal cancelled studio should show a billing gate');
   }else{
    await page.getByRole('heading',{name:'Billing',exact:true}).waitFor();
    const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Billing',exact:true})});
    if(exempt){
     await section.getByText('No billing required',{exact:true}).waitFor();
     await section.getByText('No subscription, payment card or recurring charges.',{exact:true}).waitFor();
     assert.equal(await section.getByRole('button').count(),0,'Complimentary account must expose no billing action');
     assert.ok(!(await section.innerText()).includes('4242'),'No fake card should be displayed');
    }else{
     await section.getByText(/\$30\/mo AUD covers up to 6 artists/).waitFor();
     assert.equal(await section.getByText('No billing required',{exact:true}).count(),0);
    }
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   console.log(`PASS ${width}px: billing_exempt=${exempt}, status=${status}, correct access and no demo billing actions.`);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
