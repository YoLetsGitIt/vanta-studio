// All remote services are mocked; no live reminder preference or email is changed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const {setup}=require('./polish-fixtures.cjs');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3036',out=process.env.STUDIO_QA_OUTPUT||path.resolve(__dirname,'../../artifacts/studio-3day-reminders-2026-10-31/browser');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});const results=[];
 try{for(const width of [320,390,1440])for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<500,isMobile:width<500});await setup(context);
  await context.addInitScript(t=>localStorage.setItem('vanta-theme',t),theme);
  let studio={name:'Reminder QA Studio',timezone:'Australia/Melbourne',subscription_status:'active',send_reminder_7d:true,send_reminder_24h:false};const writes=[];
  await context.route('**/studio/me',route=>route.fulfill({json:{status:'approved',studio_id:'test-studio',studio}}));
  await context.route('**/studio/me/profile',route=>{assert.equal(route.request().method(),'PATCH');const b=route.request().postDataJSON();writes.push(b);studio={...studio,...b};return route.fulfill({json:{studio}})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/dashboard/settings?tab=bookings`,{waitUntil:'networkidle'});
  const card=page.locator('section').filter({has:page.getByRole('heading',{name:'Emails',exact:true})});await card.waitFor();
  const seven=card.getByRole('switch',{name:'7-day reminder',exact:true}),three=card.getByRole('switch',{name:'3-day reminder',exact:true}),day=card.getByRole('switch',{name:'24-hour reminder',exact:true});
  assert.deepEqual(await card.getByRole('switch').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['7-day reminder','3-day reminder','24-hour reminder']);
  assert.equal(await seven.getAttribute('aria-checked'),'true');assert.equal(await three.getAttribute('aria-checked'),'false');assert.equal(await day.getAttribute('aria-checked'),'false');
  await three.click();assert.equal(await three.getAttribute('aria-checked'),'true');
  const shape=await three.evaluate(el=>{const b=el.getBoundingClientRect(),t=el.firstElementChild.getBoundingClientRect();return{tapWidth:b.width,tapHeight:b.height,trackWidth:t.width,trackHeight:t.height,left:b.left,right:b.right}});
  assert.ok(shape.tapWidth>=44&&shape.tapHeight>=44);assert.equal(shape.trackWidth,44);assert.equal(shape.trackHeight,24);assert.ok(shape.left>=0&&shape.right<=width+1);
  async function save(expected){
   const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/studio/me/profile');await card.getByRole('button',{name:'Save',exact:true}).click();await saved;
   const b=writes.at(-1);assert.equal(b.send_reminder_3d,expected);assert.equal(b.send_reminder_7d,true);assert.equal(b.send_reminder_24h,false);assert.equal(b.scheduling_mode,'all');assert.equal(b.piercing_aftercare_instructions,'');
   await page.reload({waitUntil:'networkidle'});await three.waitFor();assert.equal(await three.getAttribute('aria-checked'),String(expected));
  }
  await save(true);await card.screenshot({path:path.join(out,`emails-${width}-${theme}.png`),animations:'disabled'});
  await three.focus();await page.keyboard.press('Space');assert.equal(await three.getAttribute('aria-checked'),'false');await save(false);
  assert.equal(writes.length,2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  results.push({width,theme,defaultOff:true,enableSaveReload:true,disableSaveReload:true,otherPreferencesPreserved:true,accessibleSwitch:true,noOverflow:true});console.log(`PASS 3-day email reminder ${width}px ${theme}`);await context.close();
 }}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
