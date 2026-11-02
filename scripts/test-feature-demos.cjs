// Run against the static preview after npm run build.
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:4173';
const titles=['Booking form & widget','Widget branding','Station scheduling','Consent builder','Client records','Artist management','Analytics','Multi-language','Migration import'];
const output='/private/tmp/vanta-feature-demo-check';fs.mkdirSync(output,{recursive:true});
async function checkVideo(page,dialog){
 const video=dialog.locator('video').first();await video.waitFor({timeout:8000}).catch(async error=>{await page.screenshot({path:output+'/failure.png'});console.error(await page.locator('video').evaluateAll(items=>items.map(v=>({bounds:v.getBoundingClientRect().toJSON(),dialogOpen:v.closest('dialog')?.open,root:v.closest('[data-phase]')?.outerHTML.slice(0,350)}))));throw error;});
 await page.waitForFunction(()=>{const v=document.querySelector('dialog[open] video');return v?.readyState>=1&&v.videoWidth>0});
 const info=await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,autoplay:v.autoplay,controls:v.controls,muted:v.muted,inline:v.playsInline,paused:v.paused}));
 assert(info.duration>=10&&info.duration<=20,JSON.stringify(info));assert.equal(info.width,1100);assert.equal(info.height,800);assert(!info.autoplay&&info.controls&&info.muted&&info.inline&&info.paused);
 const chapters=dialog.getByRole('group',{name:/demo chapters/}).first();assert.equal(await chapters.getByRole('button').count(),3);
 await chapters.getByRole('button').nth(1).click();await page.waitForTimeout(500);
 const playing=await video.evaluate(v=>({time:v.currentTime,paused:v.paused,error:v.error}));assert(playing.time>3&&!playing.paused&&!playing.error,JSON.stringify(playing));
 await video.evaluate(v=>v.pause());
 const overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2);assert(!overflow,'Dialog overflows horizontally');
 const bounds=await video.boundingBox();assert(bounds.width>220,'Video too narrow');
}
(async()=>{const browser=await chromium.launch();try{
 for(const width of (process.env.DEMO_TEST_SIGNUP_ONLY ? [] : process.env.DEMO_TEST_WIDTH ? [Number(process.env.DEMO_TEST_WIDTH)] : [1440,390])){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(`${base}/design/studio-walkthrough.html?v=feature-demos`,{waitUntil:'networkidle'});
  const root=page.locator('[data-phase]');await root.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(600);
  for(const title of titles){
   const opener=page.getByRole('button',{name:`Explore ${title}`,exact:true});await opener.click();
   const dialog=page.getByRole('dialog');await checkVideo(page,dialog);
   if(title==='Artist management'){
    await dialog.getByRole('button',{name:'Artist earnings & payouts',exact:true}).click();await checkVideo(page,dialog);
   }
   if(title==='Booking form & widget')await page.screenshot({path:`${output}/walkthrough-${width}.png`});
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.locator('video[data-feature-demo]').count(),0);assert(await page.locator(`[data-flash-print]`).filter({has:page.getByRole('heading',{name:title,exact:true,includeHidden:true})}).evaluate(el=>el===document.activeElement));
  }
  assert.deepEqual(errors,[]);console.log(`PASS walkthrough ${width}px: all nine features, ten clips, chapters, playback, dismissal and focus`);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.goto(`${base}/?signup`,{waitUntil:'networkidle'});
 for(const [index,title] of titles.entries()){
  const section=index<3?'Bookings':index<5?'Clients':index<7?'Studio':'System';
  await page.getByRole('group',{name:'Vanta Studio features',exact:true}).getByRole('button',{name:section,exact:true}).click();
  await page.getByRole('button',{name:new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
  const dialog=page.getByRole('dialog');await checkVideo(page,dialog);
  if(title==='Artist management'){
   const videos=dialog.locator('video');assert.equal(await videos.count(),2);
   await videos.nth(0).evaluate(v=>v.play());await videos.nth(1).evaluate(v=>v.play());assert(await videos.nth(0).evaluate(v=>v.paused));
  }
  if(title==='Consent builder')await page.screenshot({path:`${output}/signup-390.png`});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 }
 console.log('PASS signup mobile: nine feature dialogs; simultaneous demos pause correctly');await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
