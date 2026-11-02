// Artist path through the rendered walkthrough: sit at the station, phone moments,
// the artist wall and a feature detail, standing back up, and handing over to the
// studio owner tour. Build and serve out/ locally before running.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/artist-walkthrough-smoke.cjs
const assert=require('node:assert/strict');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base=process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';const shots=process.env.STUDIO_SHOTS || require('os').tmpdir()+'/vanta-artist-shots';require('fs').mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch();
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const w=viewport.width;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/design/studio-walkthrough.html',{waitUntil:'networkidle'});
  const frame=async()=>Number(await page.locator('canvas').getAttribute('data-frame'));
  const root=page.locator('[data-phase]').first();
  const visible=sel=>page.locator(sel).evaluate(el=>{const s=getComputedStyle(el);return s.opacity>.9&&s.visibility!=='hidden';});
  for(let i=0;i<60&&!(await page.locator('dialog[open]').count());i++){await root.evaluate(el=>el.scrollBy(0,250));await page.waitForTimeout(60);}
  await page.waitForSelector('dialog[open]');await page.waitForTimeout(500);
  await page.getByRole('button',{name:'I’m an artist'}).click();
  const intro=page.getByRole('heading',{name:/Less admin/});
  await intro.waitFor();await page.waitForFunction(()=>document.querySelector('[data-settled=true]'),null,{timeout:10000});await page.waitForTimeout(800);
  assert.equal(await frame(),296);assert(await intro.evaluate(el=>getComputedStyle(el.parentElement).opacity==='1'));
  await page.screenshot({path:`${shots}/${w}-1-seated.png`});
  await page.getByRole('button',{name:/^See how/}).click();
  await page.waitForTimeout(1900);
  assert.equal(await frame(),320,'Looking down at the phone');
  await page.getByRole('heading',{name:/Your work/}).waitFor();
  await page.screenshot({path:`${shots}/${w}-2-phone-found.png`});
  await page.mouse.move(w/2,300);await page.mouse.wheel(0,200);await page.waitForTimeout(1100);
  await page.getByRole('heading',{name:/Every detail/}).waitFor();
  await page.screenshot({path:`${shots}/${w}-3-phone-request.png`});
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(1100);
  await page.getByRole('heading',{name:/Your week/}).waitFor();
  await page.screenshot({path:`${shots}/${w}-4-phone-week.png`});
  await page.locator('[aria-label="The Vanta app for artists"]').getByRole('button',{name:/See every artist tool/}).click();
  await page.waitForTimeout(2200);
  assert.equal(await frame(),296,'Looks back up at the wall');
  const wallHeading=page.getByRole('heading',{name:'Everything behind your chair.'});
  assert(await wallHeading.evaluate(el=>document.activeElement===el),'Wall heading focused');
  await page.screenshot({path:`${shots}/${w}-5-wall.png`});
  await page.getByRole('button',{name:'Explore Quotes, times & deposits'}).click();
  await page.waitForSelector('dialog[open] #feature-title');await page.waitForTimeout(700);
  assert.equal(await page.locator('dialog[open] #feature-title').textContent(),'Quotes, times & deposits');
  assert(await page.locator('dialog[open] img').evaluate(img=>img.complete&&img.naturalWidth>0),'App screenshot loads');
  assert.equal(await page.locator('dialog[open] a[href*="apps.apple.com"]').count(),1);
  await page.screenshot({path:`${shots}/${w}-6-detail.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  assert.equal(await page.locator('dialog[open]').count(),0);assert(await wallHeading.isVisible(),'Still on the wall');
  await page.getByRole('button',{name:/Back to your station/}).click();await page.waitForTimeout(1200);
  assert(await intro.evaluate(el=>getComputedStyle(el.parentElement).opacity==='1'),'Seated again');
  await page.mouse.wheel(0,-200);await page.waitForTimeout(400);
  await page.waitForSelector('dialog[open]',{timeout:10000});await page.waitForTimeout(300);
  assert.equal(await frame(),58,'Scrolling up stood up and returned to reception');
  await page.getByRole('button',{name:'I’m an artist'}).click();
  await page.getByRole('button',{name:/Studio owner view/}).first().waitFor();await page.waitForTimeout(6500);
  await page.getByRole('button',{name:/Studio owner view/}).first().click();
  await page.waitForTimeout(9500);
  const f=await frame();assert(f>=121&&f<=152,`owner tablet frame ${f}`);
  assert.equal(await page.locator('[aria-label="Vanta for artists"]').count(),0,'Artist layer removed');
  assert.deepEqual(errors,[]);
  console.log('PASS',w);await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
