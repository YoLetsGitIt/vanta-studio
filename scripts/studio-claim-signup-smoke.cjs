// All external services are mocked. No real signup, subscription or messages.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3036',out=path.resolve(__dirname,'../../artifacts/unclaimed-studio-signup-2026-10-31/browser');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE});const results=[];
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<760,isMobile:width<760});const writes=[],errors=[];let failSearch=false;
   const saved={id:'11111111-2222-4333-8444-555555555555',name:'Saved Ink',addressString:'10 Test Street, Melbourne',latitude:-37.81,longitude:144.96,signup_available:true};
   const owned={...saved,id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',name:'Owned Ink',signup_available:false,subscription_status:'canceled'};
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
    const reply=(json,status=200)=>route.fulfill({json,status});
    if(url.pathname==='/studio/signup/email-availability')return reply({available:true});
    if(url.pathname==='/studio/signup/studios')return reply(failSearch?{error:'Search unavailable'}:{studios:[saved,owned]},failSearch?503:200);
    if(url.hostname==='nominatim.openstreetmap.org')return reply([]);
    if(url.pathname==='/studio/register'){writes.push(req.postDataJSON());return reply({checkout_url:'https://checkout.example.test/studio'},201)}
    if(url.hostname==='checkout.example.test')return route.fulfill({contentType:'text/html',body:'<h1>Isolated checkout</h1>'});
    return reply({});
   });
   const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   async function start(){
    await page.goto(`${base}/signup/`,{waitUntil:'networkidle'});
    await page.getByLabel('Email',{exact:false}).fill('claim-test@example.test');
    await page.getByLabel('Password',{exact:false}).first().fill('local-password-123');
    await page.getByLabel('Confirm password',{exact:false}).fill('local-password-123');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByLabel('Search for your studio').fill('Saved');
   }
   await start();await page.getByRole('button',{name:/Saved Ink/}).click();
   await page.getByText('This studio is already listed. Create its studio account to manage it.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Search again',exact:true}).count(),0);
   assert.equal(await page.locator('input[readonly]').count(),2);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,`claim-${width}.png`),fullPage:true});
   await page.getByRole('button',{name:'Continue to payment',exact:true}).click();await page.getByRole('heading',{name:'Isolated checkout'}).waitFor();
   assert.equal(writes.length,1);assert.equal(writes[0].studio_id,saved.id);assert.equal(writes[0].studio_name,saved.name);assert.equal(writes[0].address,saved.addressString);
   await start();await page.getByRole('button',{name:/Owned Ink/}).click();
   await page.getByText(/This studio is already signed up with Vanta/).waitFor();
   assert.equal(await page.getByRole('button',{name:'Continue to payment',exact:true}).count(),0);
   assert.equal(writes.length,1);
   await page.getByRole('button',{name:'Search again',exact:true}).click();failSearch=true;
   await page.getByLabel('Search for your studio').fill('Unavailable');
   await page.getByRole('alert').filter({hasText:'Could not search studios'}).waitFor();
   assert.equal(await page.getByRole('button',{name:/as a new studio/}).count(),0);
   assert.deepEqual(errors,[]);results.push({width,existingListingReachesCheckout:true,selectedIDPreserved:true,ownedInactiveStudioBlocked:true,failedSearchDoesNotCreateDuplicate:true,noLiveWrites:true});
   console.log(`PASS ${width}: unclaimed listing checkout, correct studio ID, inactive owner protection and search failure.`);await context.close();
  }
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
