// Live UI, fully isolated external services. No live subscription or account is created.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:4173',out=process.env.STUDIO_QA_OUTPUT||path.resolve(__dirname,'../../artifacts/studio-onboarding-audit-2026-10-28'),user={id:'77777777-7777-4777-8777-777777777777',email:'qa-studio@example.test',aud:'authenticated',role:'authenticated'};
const session={access_token:'qa-only-access-token',refresh_token:'qa-only-refresh-token',expires_at:2000000000,expires_in:3600,token_type:'bearer',user};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})}),results=[];
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}}),calls=[],errors=[];
   let signedIn=false;
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(url.origin===base)return route.continue();
    const headers={'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
    const reply=(json,status=200)=>route.fulfill({json,status,headers});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(p==='/studio/signup/email-availability')return reply(req.postDataJSON().email==='existing@example.test'?{error:'An account with this email already exists'}:{available:true},req.postDataJSON().email==='existing@example.test'?409:200);
    if(p==='/studios/search')return reply({studios:[]});
    if(url.hostname==='nominatim.openstreetmap.org')return reply(url.searchParams.get('q').includes('Swanston')?[{place_id:1234,display_name:'100 Swanston Street, Melbourne, Victoria, Australia',lat:'-37.81',lon:'144.96'}]:[]);
    if(p==='/studio/register'){calls.push({path:p,body:req.postDataJSON()});return reply({checkout_url:'https://checkout.stripe.com/c/pay/cs_test_qa'},201);}
    if(url.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<h1>Isolated QA Checkout</h1>'});
    if(p==='/studio/signup/complete'){calls.push({path:p,body:req.postDataJSON()});return reply({completed:true});}
    if(p==='/auth/v1/token'){signedIn=true;calls.push({path:p});return reply(session);}
    if(p==='/auth/v1/user')return reply(user);
    if(p==='/studio/me')return reply({status:'approved',studio_id:'qa-new',studio:{id:'qa-new',name:'[QA] Newly Created Studio',timezone:'Australia/Melbourne',subscription_status:'trialing',trial_ends_at:new Date(Date.now()+14*86400000).toISOString()}});
    if(p.endsWith('/artists'))return reply({artists:[]});
    if(p.endsWith('/schedule'))return reply({entries:[]});
    if(p.endsWith('/dashboard-attention'))return reply({bookings:[],pending_artists:[],pending_reimbursements:[]});
    if(p.endsWith('/revenue'))return reply({summary:{gross_sales:0,completed_sessions:0},weekly:[],by_artist:[]});
    return reply({templates:[],clients:[],hours:[],stations:[],bookings:[],connected:false});
   });
   const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}/signup/`,{waitUntil:'networkidle'});
   await page.getByRole('heading',{name:'Start your free trial',exact:true}).waitFor();
   const email=page.locator('input[type=email]'),passwords=page.locator('input[type=password]');
   await email.fill('existing@example.test');await passwords.nth(0).fill('qa-only-password');await passwords.nth(1).fill('does-not-match');
   await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Passwords do not match'}).waitFor();
   await passwords.nth(1).fill('qa-only-password');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'already exists'}).waitFor();
   await email.fill(user.email);await page.getByRole('button',{name:'Continue',exact:true}).click();
   await page.getByRole('button',{name:/My studio isn.t listed/}).click();
   await page.getByPlaceholder('e.g. Dark Matter Tattoo').fill('[QA] Newly Created Studio');
   await page.getByRole('button',{name:'Continue to payment',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'select an address'}).waitFor();
   await page.getByPlaceholder('Start typing your address…').fill('100 Swanston');
   await page.getByRole('button',{name:'100 Swanston Street, Melbourne, Victoria, Australia',exact:true}).click();
   await page.getByRole('button',{name:'Continue to payment',exact:true}).click();
   await page.getByRole('heading',{name:'Isolated QA Checkout',exact:true}).waitFor();
   assert.equal(calls[0].body.studio_name,'[QA] Newly Created Studio');
   await page.goto(`${base}/?signup=complete&session_id=cs_test_qa`,{waitUntil:'networkidle'});
   try { await page.locator('.studio-dashboard-main').waitFor(); }
   catch(error) {
     fs.writeFileSync(path.join(out,'signup-completion-failure.txt'),await page.locator('body').innerText());
     fs.writeFileSync(path.join(out,'signup-completion-debug.json'),JSON.stringify({url:page.url(),calls:calls.map(c=>({path:c.path})),errors,signedIn,storageKeys:await page.evaluate(()=>Object.keys(sessionStorage))},null,2));
     await page.screenshot({path:path.join(out,'signup-completion-failure.png'),fullPage:true});
     throw error;
   }
   assert.ok(signedIn,'Completed signup signs into the new studio');
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('vanta-pending-signup')),null,'Pending signup credentials cleared after successful sign-in');
   assert.ok(calls.some(c=>c.path==='/studio/signup/complete'&&c.body.session_id==='cs_test_qa'));
   const text=await page.locator('body').innerText();
   assert.ok(!text.includes('subscription needs attention'),'A newly trialing studio can access its dashboard');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.screenshot({path:path.join(out,`signup-completed-${width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);
   results.push({width,passed:true,signupRequests:calls.map(c=>c.path),tourOrWelcome:text.includes('Welcome')||text.includes('YOUR STUDIO IS READY')});
   await page.evaluate(()=>localStorage.clear());
   await page.goto(`${base}/signin`,{waitUntil:'networkidle'});
   await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
   await page.locator('input[type=email]').fill(user.email);
   await page.locator('input[type=password]').fill('qa-only-password');
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await page.locator('.studio-dashboard-main').waitFor();
   assert.equal(new URL(page.url()).pathname,'/dashboard/home','Sign-in lands on the dashboard document');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}px: validation, duplicate email, required address, checkout handoff, return completion, automatic sign-in, first dashboard and ordinary sign-in.`);
   await context.close();
  }
 }finally{fs.writeFileSync(path.join(out,'signup-completion.json'),JSON.stringify(results,null,2)+'\n');await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
