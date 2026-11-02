// Local browser verification. All remote services are mocked; no real settings change.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const {setup}=require('./polish-fixtures.cjs');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3036',out=process.env.STUDIO_QA_OUTPUT||path.resolve(__dirname,'../../artifacts/studio-reminder-limit-2026-10-31/browser');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});const results=[];
 try{for(const [width,theme] of [[320,'dark'],[390,'dark'],[390,'light'],[1440,'dark']]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<500,hasTouch:width<500});await setup(context);
  await context.addInitScript(t=>localStorage.setItem('vanta-theme',t),theme);
  let studio={name:'Reminder QA Studio',timezone:'Australia/Melbourne',subscription_status:'active',send_reminder_7d:true,send_reminder_3d:false,send_reminder_24h:true};const writes=[];
  const keys=['send_reminder_7d','send_reminder_3d','send_reminder_24h'];
  await context.route('**/studio/me',route=>route.fulfill({json:{status:'approved',studio_id:'test-studio',studio}}));
  await context.route('**/studio/me/profile',route=>{assert.equal(route.request().method(),'PATCH');const b=route.request().postDataJSON();assert.ok(keys.filter(k=>b[k]).length<=2,'UI sent an invalid selection');writes.push(b);studio={...studio,...b};return route.fulfill({json:{studio}})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/dashboard/settings?tab=bookings`,{waitUntil:'networkidle'});
  const card=page.locator('section').filter({has:page.getByRole('heading',{name:'Emails',exact:true})});await card.waitFor();
  const switches=['7-day reminder','3-day reminder','24-hour reminder'].map(name=>card.getByRole('switch',{name,exact:true}));const [seven,three,day]=switches,save=card.getByRole('button',{name:'Save',exact:true});
  async function state(expected){
   for(let i=0;i<switches.length;i++){
    assert.equal(await switches[i].getAttribute('aria-checked'),String(expected[i]));
    assert.equal(await switches[i].isDisabled(),false);
    assert.equal(await switches[i].getAttribute('aria-describedby'),'email-reminder-limit');
   }
  }
  async function persist(expected){
   const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/studio/me/profile');await save.click();await response;
   assert.deepEqual(keys.map(k=>writes.at(-1)[k]),expected);await page.reload({waitUntil:'networkidle'});await card.waitFor();await state(expected);
  }
  await state([true,false,true]);assert.ok(await card.getByRole('status').getByText('2 of 2 selected. Turn one off to choose another.',{exact:true}).isVisible());
  const toast=page.getByRole('status').filter({hasText:'You can select up to 2 email reminders. Turn one off to choose another.'});
  async function attemptThird(control,expected,keyboard=false){
   if(keyboard){await control.focus();await page.keyboard.press('Space')}else if(width<500){await control.tap()}else{await control.click()}
   await toast.waitFor();await state(expected);
   await toast.screenshot({path:path.join(out,`toast-${width}-${theme}.png`)});
   await toast.getByRole('button',{name:'Dismiss message'}).click();await toast.waitFor({state:'hidden'});
  }
  await attemptThird(three,[true,false,true]);assert.equal(writes.length,0);
  await attemptThird(three,[true,false,true],true);assert.equal(writes.length,0);
  await card.screenshot({path:path.join(out,`limit-${width}-${theme}.png`),animations:'disabled'});
  await seven.click();await state([false,false,true]);await three.focus();await page.keyboard.press('Space');await state([false,true,true]);await persist([false,true,true]);await attemptThird(seven,[false,true,true]);
  await day.click();await seven.click();await state([true,true,false]);await persist([true,true,false]);await attemptThird(day,[true,true,false]);
  await three.click();await day.click();await state([true,false,true]);await persist([true,false,true]);
  // Zero and one reminder remain valid; the limit is a maximum, not a requirement.
  await seven.click();await day.click();await state([false,false,false]);await persist([false,false,false]);
  await three.click();await state([false,true,false]);await persist([false,true,false]);
  // Previously saved all-three settings can be corrected without silently changing a choice.
  studio={...studio,send_reminder_7d:true,send_reminder_3d:true,send_reminder_24h:true};await page.reload({waitUntil:'networkidle'});await card.waitFor();await state([true,true,true]);assert.ok(await save.isDisabled());
  assert.ok(await card.getByRole('status').getByText('Turn off a reminder before saving. You can select up to 2.',{exact:true}).isVisible());
  await three.click();await state([true,false,true]);await persist([true,false,true]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,theme,thirdBlocked:true,toastOnAttempt:true,toastOnKeyboardAttempt:true,allPairsSaveReload:true,keyboardSwitch:true,zeroAndOneAllowed:true,legacyThreeCorrectable:true,noOverflow:true});console.log(`PASS reminder limit ${width}px ${theme}`);await context.close();
 }}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
