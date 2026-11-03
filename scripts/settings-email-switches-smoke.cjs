// Production UI with isolated settings. No reminder preference is changed live.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const {setup}=require('./polish-fixtures.cjs');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3036',out=process.env.STUDIO_QA_OUTPUT||path.resolve(__dirname,'../../artifacts/mobile-email-switches-2026-10-29');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});
 const results=[];
 try{
  for(const [width,height,touch] of [[320,900,true],[390,900,true],[844,390,true],[1440,1000,false]])for(const theme of ['dark','light']){
   const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});await setup(context);
   await context.addInitScript(t=>{if(window===window.top)localStorage.setItem('vanta-theme',t)},theme);
   let studio={name:'Northside Tattoo Studio',timezone:'Australia/Melbourne',subscription_status:'active',send_reminder_7d:false,send_reminder_24h:true};const writes=[];
   await context.route('**/studio/me/profile',route=>{
    assert.equal(route.request().method(),'PATCH');const body=route.request().postDataJSON();writes.push(body);studio={...studio,...body};return route.fulfill({json:{studio}});
   });
   await context.route('**/studio/me',route=>{
    return route.fulfill({json:{status:'approved',studio_id:'test-studio',studio}});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}/dashboard/settings?tab=messages`,{waitUntil:'networkidle'});
   const card=page.locator('section').filter({has:page.getByRole('heading',{name:'Emails',exact:true})});await card.waitFor();
   const seven=card.getByRole('switch',{name:'7-day reminder',exact:true}),day=card.getByRole('switch',{name:'24-hour reminder',exact:true});
   async function shape(control){
    const size=await control.evaluate(el=>{const track=el.firstElementChild,thumb=track.firstElementChild,b=el.getBoundingClientRect(),t=track.getBoundingClientRect(),k=thumb.getBoundingClientRect();return {tapWidth:b.width,tapHeight:b.height,trackWidth:t.width,trackHeight:t.height,radius:getComputedStyle(track).borderRadius,inside:k.left>=t.left&&k.right<=t.right&&k.top>=t.top&&k.bottom<=t.bottom}});
    assert.ok(size.tapWidth>=44&&size.tapHeight>=44,'Switch must retain a comfortable tap target');assert.equal(size.trackWidth,44);assert.equal(size.trackHeight,24);assert.ok(size.inside,'Thumb must stay inside the pill');return size;
   }
   await shape(seven);await shape(day);
   assert.equal(await seven.getAttribute('aria-checked'),'false');assert.equal(await day.getAttribute('aria-checked'),'true');
   await seven.click();await day.focus();await page.keyboard.press('Space');
   assert.equal(await seven.getAttribute('aria-checked'),'true');assert.equal(await day.getAttribute('aria-checked'),'false');
   await shape(seven);await shape(day);
   await card.screenshot({path:path.join(out,`emails-${width}-${theme}.png`),animations:'disabled'});
   const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/studio/me/profile');
   await card.getByRole('button',{name:'Save',exact:true}).click();await saved;
   assert.equal(writes.length,1);assert.equal(writes[0].send_reminder_7d,true);assert.equal(writes[0].send_reminder_24h,false);
   await page.reload({waitUntil:'networkidle'});
   assert.equal(await seven.getAttribute('aria-checked'),'true');assert.equal(await day.getAttribute('aria-checked'),'false');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   results.push({width,height,touch,theme,track:'44x24',tapTarget:'at least 44x44',toggleSaveReload:true});
   console.log(`PASS email switches ${width}x${height} ${theme}: pill dimensions, touch/keyboard control and saved preferences.`);await context.close();
  }
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
