// Live UI, fully intercepted services. Exercises filter results and the exact
// selected-recipient payload; it never sends email or changes live clients.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.VANTA_PLAYWRIGHT_PATH||'playwright');
const {setup}=require('./polish-fixtures.cjs');
const base=process.env.STUDIO_TEST_URL||'https://studio.vanta.tattoo';
const fixed=new Date('2026-10-27T12:00:00+11:00').getTime(),day=86400000;
const at=days=>new Date(fixed+days*day).toISOString();
const client=(id,name,sessions,last,next,added)=>({id,name,email:`${id}@example.test`,completed_count:sessions,last_visit:last===null?null:at(-last),next_appointment:next===null?null:at(next),created_at:at(-added)});
const clients=[client('alice','Alice Recent',3,5,7,100),client('bob','Bob Lapsed',4,120,null,200),client('casey','Casey New',0,null,null,5),client('dana','Dana Recent',1,20,45,60),client('evan','Evan Middle',1,60,2,90),client('fatima','Fatima New',0,null,12,2)];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE?{executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Australia/Melbourne'});await setup(context);
   const writes=[],errors=[];let saved=[];let list=clients;
   await context.route('**/studio/me/marketing/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    if(path.endsWith('/templates'))return route.fulfill({json:{templates:[{id:'test-template',name:'Filter test',subject:'Filter validation',body:'Hi {{client_name}}, this is isolated.'}]}});
    if(path.endsWith('/recipients'))return route.fulfill({json:{clients:list}});
    if(path.endsWith('/saved-audiences')){
     if(method==='POST'){const body=request.postDataJSON();saved.push({...body,id:'saved-filter'});writes.push({path,body});return route.fulfill({json:saved.at(-1)});}
     return route.fulfill({json:{audiences:saved}});
    }
    if(path.endsWith('/saved-audiences/saved-filter')&&method==='DELETE'){saved=[];return route.fulfill({json:{status:'deleted'}});}
    if(path.endsWith('/campaigns')&&method==='POST'){const body=request.postDataJSON();writes.push({path,body});return route.fulfill({json:{id:'test-campaign',recipient_count:body.segment.client_ids.length}});}
    if(path.endsWith('/preview'))return route.fulfill({json:{subject:'Filter validation',html:'<p>Isolated preview</p>'}});
    return route.fallback();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(fixed));
   await page.goto(`${base}/dashboard/marketing.html`,{waitUntil:'networkidle'});
   await page.getByRole('navigation',{name:'Email campaigns',exact:true}).getByRole('button',{name:/^Filter test/}).click();
   await page.getByRole('button',{name:'Continue to clients',exact:true}).click();
   await page.getByRole('heading',{name:'Review and send',exact:true}).waitFor();
   const group=page.getByRole('combobox',{name:'Show',exact:true}),search=page.getByRole('searchbox',{name:'Search',exact:true});
   const rows=()=>page.getByRole('list',{name:'Clients',exact:true}).locator('label');
   const names=async()=>rows().evaluateAll(elements=>elements.map(el=>el.querySelector('input').parentElement.querySelector('[class*=clientMain]').firstChild.textContent));
   const expectNames=async expected=>assert.deepEqual((await names()).sort(),expected.sort());
   for(const[value,expected]of [['all',clients.map(c=>c.name)],['p0',['Alice Recent','Bob Lapsed']],['p1',['Bob Lapsed']],['p2',['Alice Recent','Dana Recent']],['p3',['Casey New','Fatima New']],['p4',['Casey New','Fatima New']],['p5',['Bob Lapsed','Casey New']]]){
    await group.selectOption(value);await expectNames(expected);
   }
   await group.selectOption('all');await search.fill(' ALICE ');await expectNames(['Alice Recent']);
   await search.fill('BOB@EXAMPLE.TEST');await expectNames(['Bob Lapsed']);
   await search.fill('unmatched');await page.getByText('No clients match.',{exact:false}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/^Select all/}).isDisabled(),true);
   await search.fill('');await group.selectOption('custom');
   await page.getByRole('combobox',{name:'Upcoming appointment',exact:true}).selectOption('within');
   await page.getByRole('spinbutton',{name:'In the next (days)',exact:true}).fill('10');await expectNames(['Alice Recent','Evan Middle']);
   await page.getByRole('spinbutton',{name:'In the next (days)',exact:true}).fill('30');await expectNames(['Alice Recent','Evan Middle','Fatima New']);
   await page.getByRole('combobox',{name:'Upcoming appointment',exact:true}).selectOption('any_time');await expectNames(['Alice Recent','Dana Recent','Evan Middle','Fatima New']);
   await page.getByRole('combobox',{name:'Upcoming appointment',exact:true}).selectOption('any');
   await page.getByRole('combobox',{name:'Added to your clients',exact:true}).selectOption('within');
   await page.getByRole('spinbutton',{name:'Added in the last (days)',exact:true}).fill('7');await expectNames(['Casey New','Fatima New']);
   await page.getByRole('combobox',{name:'Added to your clients',exact:true}).selectOption('any');
   await page.getByRole('combobox',{name:'Last visit',exact:true}).selectOption('within');
   await page.getByRole('spinbutton',{name:'Within the last (days)',exact:true}).fill('14');await expectNames(['Alice Recent']);
   await page.getByRole('combobox',{name:'Last visit',exact:true}).selectOption('any');
   await page.getByRole('combobox',{name:'Sessions completed here',exact:true}).selectOption('repeat');
   await page.getByRole('combobox',{name:'Last visit',exact:true}).selectOption('before');
   await page.getByRole('spinbutton',{name:'More than (days) ago',exact:true}).fill('90');
   await page.getByRole('combobox',{name:'Upcoming appointment',exact:true}).selectOption('none');await expectNames(['Bob Lapsed']);
   await page.getByRole('button',{name:'Save as a group',exact:true}).click();
   await page.getByRole('textbox',{name:'Name this group',exact:true}).fill('Isolated lapsed regulars');
   await page.getByRole('button',{name:'Save',exact:true}).click();
   await group.selectOption('all');await group.selectOption('ssaved-filter');await expectNames(['Bob Lapsed']);
   await page.getByRole('button',{name:'Delete this saved group',exact:true}).click();
   const deleted=page.waitForResponse(response=>response.url().endsWith('/saved-audiences/saved-filter')&&response.request().method()==='DELETE');
   await page.getByRole('alertdialog').getByRole('button',{name:'Delete',exact:true}).click();await deleted;
   await page.waitForFunction(()=>document.querySelector('select option:checked')?.value==='all');await expectNames(clients.map(c=>c.name));
   await group.selectOption('p0');await expectNames(['Alice Recent','Bob Lapsed']);await page.getByRole('checkbox',{name:/^Select all/}).check();
   await group.selectOption('p3');await page.getByText('2 not in this view',{exact:false}).waitFor();
   await page.getByRole('checkbox',{name:/Casey New/}).check();
   await group.selectOption('all');await page.getByRole('button',{name:'Show selected',exact:true}).click();await expectNames(['Alice Recent','Bob Lapsed','Casey New']);
   await page.getByRole('button',{name:'Send to 3 clients',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
   assert.equal(writes.filter(w=>w.path.endsWith('/campaigns')).length,0);
   await page.getByRole('button',{name:'Send to 3 clients',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Send',exact:true}).click();
   await page.getByRole('heading',{name:'Emails queued',exact:true}).waitFor();
   assert.deepEqual(writes.find(w=>w.path.endsWith('/campaigns')).body.segment,{kind:'selected',client_ids:['alice','bob','casey']});
   assert.deepEqual(errors,[]);assert.equal(await page.getByRole('heading',{name:'Emails queued',exact:true}).count(),1);
   console.log(`PASS ${width}px: all six presets, search, custom conjunctions, saved groups, selection across filters, cancel and exact outgoing IDs.`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
