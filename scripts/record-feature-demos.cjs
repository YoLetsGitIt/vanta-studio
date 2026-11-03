// Record real product interactions using isolated fictional API responses.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/record-feature-demos.cjs [feature-id ...]
const {chromium}=require(process.env.STUDIO_PLAYWRIGHT_PATH||'playwright');
const {contextFor}=require('./capture-journey-screens.cjs');
const {fixtures}=require('./feature-demo-fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:4173';
const output=path.join(__dirname,'../public/studio/demos'),raw='/private/tmp/vanta-feature-demos/raw';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(raw,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const section=(p,title)=>p.locator('section').filter({has:p.getByRole('heading',{name:title,exact:true})}).first();
async function focus(p,locator){
 await locator.waitFor({state:'attached'});
 await p.evaluate(()=>document.querySelectorAll('[data-demo-focus]').forEach(e=>e.removeAttribute('data-demo-focus')));
 await locator.evaluate(e=>{e.setAttribute('data-demo-focus','');e.scrollTop=0;});
 const dialog=p.locator('dialog[open]');if(await dialog.count())await dialog.first().evaluate(e=>{for(const n of document.querySelectorAll('[data-demo-chrome]'))e.appendChild(n)});
 await p.waitForTimeout(250);
}
async function chrome(p,title){
 await p.addStyleTag({content:`body{background:#11120f!important}body *{visibility:hidden!important}[data-demo-focus],[data-demo-focus] *{visibility:visible!important}[data-demo-focus]{position:fixed!important;inset:68px 24px 76px!important;width:calc(100% - 48px)!important;height:calc(100% - 144px)!important;max-width:none!important;max-height:none!important;margin:0!important;overflow:auto!important;background:var(--bg-base,#111)!important;border-radius:14px!important;box-sizing:border-box!important;z-index:10000!important;transform:none!important}dialog::backdrop{background:#11120f!important}[data-demo-chrome],[data-demo-chrome] *{visibility:visible!important}[data-demo-chrome]{position:fixed;z-index:2147483647;pointer-events:none;font-family:Arial,sans-serif;color:#ede6d6}#demo-title{top:0;left:0;right:0;height:56px;display:flex;align-items:center;padding:0 28px;gap:18px;border-bottom:1px solid #ffffff14;background:#11120f;font-size:17px}#demo-title b{font-size:22px;letter-spacing:-1px}#demo-title small{margin-left:auto;color:#a9aa9a;font-size:11px;letter-spacing:1.4px}#demo-caption{bottom:0;left:0;right:0;height:64px;display:flex;align-items:center;padding:0 28px;gap:16px;background:#11120f;border-top:1px solid #ffffff14;font-size:18px}#demo-step{font-size:12px;color:#b8aa8b;border:1px solid #b8aa8b44;border-radius:20px;padding:7px 10px}#demo-cursor{width:22px;height:22px;border:2px solid #f4dfab;border-radius:50%;background:#e2c48b24;box-shadow:0 0 0 5px #ecd6ab15;top:0;left:0;transform:translate(-60px,-60px);transition:transform .32s ease-out,background .16s}#demo-cursor[data-click=true]{background:#f4dfab99;box-shadow:0 0 0 12px #ecd6ab25}`});
 await p.evaluate(title=>{
  const header=document.createElement('div');header.id='demo-title';header.dataset.demoChrome='';header.innerHTML='<b>vanta.</b><span></span><small>EXAMPLE STUDIO</small>';header.querySelector('span').textContent=title;
  const caption=document.createElement('div');caption.id='demo-caption';caption.dataset.demoChrome='';caption.innerHTML='<span id="demo-step">01</span><span id="demo-caption-text"></span>';
  const cursor=document.createElement('div');cursor.id='demo-cursor';cursor.dataset.demoChrome='';
  (document.querySelector('dialog[open]')||document.body).append(header,caption,cursor);
 },title);
}
async function point(p,l,click=false){await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();await p.evaluate(({x,y})=>document.querySelector('#demo-cursor').style.transform=`translate(${x-11}px,${y-11}px)`,{x:b.x+b.width/2,y:b.y+b.height/2});await pause(450);if(click){await p.evaluate(()=>document.querySelector('#demo-cursor').dataset.click='true');await l.click();await pause(200);await p.evaluate(()=>document.querySelector('#demo-cursor').dataset.click='false');}}
async function caption(p,index,text){await p.evaluate(({index,text})=>{document.querySelector('#demo-step').textContent=String(index+1).padStart(2,'0');document.querySelector('#demo-caption-text').textContent=text;},{index,text});}
const demos=[
 {id:'forms',title:'Your booking form',route:'settings.html?tab=bookings',setup:async p=>section(p,'Booking form'),steps:[
  ['Choose the fields your studio needs.',async p=>{await point(p,p.getByRole('switch',{name:'Artist preference field',exact:true}),true)}],
  ['Make important answers required.',async p=>{await point(p,p.getByRole('checkbox',{name:'Artist preference required',exact:true}),true)}],
  ['Your chosen fields appear in the live preview.',async p=>{await point(p,p.getByRole('switch',{name:'Reference photos field',exact:true}));await p.locator('[data-demo-focus]').evaluate(e=>e.scrollTo({top:0,behavior:'smooth'}))}],
 ]},
 {id:'branding',title:'Make it your studio',route:'settings.html?tab=bookings',setup:async p=>section(p,'Booking form'),steps:[
  ['Match the background to your website.',async p=>{const l=p.getByLabel('Widget background hex colour');await point(p,l);await l.fill('#20271F');}],
  ['Choose an accent. See it change live.',async p=>{const l=p.getByLabel('Widget highlight hex colour');await point(p,l);await l.fill('#D9B978');}],
  ['Copy the embed snippet for your own website.',async p=>{await point(p,p.getByRole('button',{name:'Copy snippet',exact:true}),true)}],
 ]},
 {id:'consent',title:'Consent, made yours',route:'settings.html?tab=bookings',setup:async p=>{await section(p,'Consent Form Templates').getByRole('button',{name:'Edit',exact:true}).click();return p.getByRole('dialog',{name:'Edit form',exact:true})},steps:[
  ['Add the questions that matter to your studio.',async p=>{await point(p,p.getByRole('button',{name:'+ Checkbox',exact:true}),true);await p.getByLabel('Field 2 checkbox content').fill('I have reviewed the design and placement.');}],
  ['Require an answer before it can be submitted.',async p=>{await point(p,p.getByRole('checkbox',{name:'Required',exact:true}).last(),true)}],
  ['Collect a client signature with your consent form.',async p=>{await point(p,p.getByRole('checkbox',{name:'Require client signature',exact:true}));}],
 ]},
 {id:'schedule',title:'A place for every appointment',route:'schedule.html',setup:async p=>{await p.getByRole('button',{name:'Day',exact:true}).click();return p.locator('.studio-schedule-page')},steps:[
  ['Start with the artist’s day.',async p=>{await point(p,p.getByRole('button',{name:'Artist',exact:true}));}],
  ['Switch to stations to see every chair.',async p=>{await point(p,p.getByRole('button',{name:'Station',exact:true}),true)}],
  ['See each booking, artist and allocated station.',async p=>{await p.getByText('Mia Carter',{exact:true}).first().scrollIntoViewIfNeeded();await point(p,p.getByText('Mia Carter',{exact:true}).first());}],
 ]},
 {id:'clients',title:'The whole client story',route:'clients.html?client=demo-client',setup:async p=>p.locator('.studio-client-detail'),steps:[
  ['Contact details and consent, together.',async p=>{await point(p,p.getByRole('heading',{name:'Consent',exact:true}));}],
  ['Keep preferences and health notes with the client.',async p=>{await point(p,p.getByRole('button',{name:'Fine Line',exact:true}));}],
  ['Look back through their booking history.',async p=>{await point(p,p.getByText('Booking history (1)',{exact:true}));}],
 ]},
 {id:'artists',title:'Your artists, in one place',route:'artists.html',setup:async p=>p.locator('.studio-artists-page'),steps:[
  ['Open an artist’s studio profile.',async p=>{await point(p,p.getByText('Alex Morgan',{exact:true}).first(),true);await focus(p,p.locator('.studio-artists-page'));}],
  ['See their sessions and revenue at a glance.',async p=>{await point(p,p.getByText('Total sessions',{exact:true}));}],
  ['Manage the timetable behind their availability.',async p=>{await point(p,p.getByRole('button',{name:'Edit',exact:true}),true);await point(p,p.getByLabel('Mon start time'));}],
 ]},
 {id:'payouts',title:'Artist earnings & payouts',route:'financial.html',setup:async p=>{await p.getByRole('button',{name:'Artists & Payouts',exact:true}).click();return p.locator('.studio-financial-page')},steps:[
  ['See earnings, paid amounts and outstanding balances.',async p=>{await point(p,p.getByRole('button',{name:'View payout history for Alex Morgan',exact:true}));}],
  ['Open an artist’s payout record.',async p=>{await point(p,p.getByRole('button',{name:'View payout history for Alex Morgan',exact:true}),true);await focus(p,p.locator('dialog[open]'));}],
  ['Keep the payment method and history together.',async p=>{await point(p,p.getByRole('combobox',{name:'Payout method',exact:true}));}],
 ]},
 {id:'analytics',title:'See how your studio is doing',route:'analytics.html',setup:async p=>p.locator('.studio-revenue-page'),steps:[
  ['Choose the period you want to understand.',async p=>{await point(p,p.getByRole('button',{name:'Last 4 weeks',exact:true}),true)}],
  ['Track bookings, revenue and booking sources.',async p=>{await point(p,p.getByText('Appointment revenue',{exact:true}));}],
  ['See new clients, returning clients and spending.',async p=>{const heading=p.getByRole('heading',{name:'Customer insights',exact:true});await heading.evaluate(e=>{e.style.scrollMarginTop='100px';e.scrollIntoView({block:'start',behavior:'smooth'});});await pause(450);await point(p,heading);}],
 ]},
 {id:'languages',title:'Work in your language',route:'settings.html?tab=account',setup:async p=>section(p,'Language'),steps:[
  ['English, Simplified Chinese and Korean.',async p=>{await point(p,p.getByRole('button',{name:/English/}));}],
  ['Switch to Simplified Chinese in Settings.',async p=>{await point(p,p.getByRole('button',{name:/简体中文/}),true)}],
  ['Or work in Korean. Switch whenever you need.',async p=>{await point(p,p.getByRole('button',{name:/한국어/}),true)}],
 ]},
 {id:'migration',title:'Bring your history with you',route:'import.html',setup:async p=>p.locator('.studio-import-page'),steps:[
  ['Start with your exported client CSV.',async p=>{await point(p,p.getByRole('button',{name:'Choose a CSV file to import'}));await p.locator('input[type=file]').setInputFiles({name:'studio-clients.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Email,Phone\nMia Carter,mia@example.com,+61400000001\nJamie Wilson,jamie@example.com,+61400000002\nAvery Brooks,avery@example.com,+61400000003')});}],
  ['Match your columns to Vanta’s client fields.',async p=>{await point(p,p.getByRole('combobox',{name:'CSV column for Full name',exact:true}));}],
  ['Preview your data before you import.',async p=>{await point(p,p.getByRole('button',{name:/Preview/,exact:false}),true);await p.locator('[data-demo-focus]').evaluate(e=>e.scrollTo({top:0,behavior:'smooth'}));}],
 ]},
];
async function run(){const browser=await chromium.launch();const manifest={};try{for(const demo of demos.filter(d=>!process.argv[2]||process.argv.slice(2).includes(d.id))){
 const context=await contextFor(browser,{viewport:{width:1100,height:800},deviceScaleFactor:1,recordVideo:{dir:raw,size:{width:1100,height:800}},respond:fixtures(),signed:true,booking:{status:'confirmed',chosen_time:'2026-10-09T10:00:00+11:00'}});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 await context.addInitScript(()=>sessionStorage.setItem('financial_unlocked','1'));
 const p=await context.newPage();p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(`${base}/dashboard/${demo.route}`,{waitUntil:'networkidle'});const target=await demo.setup(p);await focus(p,target);await chrome(p,demo.title);
 if(demo.id==='languages')await p.addStyleTag({content:'.studio-dashboard-sidebar,.studio-dashboard-sidebar *{visibility:visible!important}.studio-dashboard-sidebar{position:fixed!important;inset:68px auto 76px 24px!important;width:250px!important;height:auto!important;border-radius:14px;overflow:hidden!important;z-index:10001!important}[data-demo-focus]{inset:200px 40px auto 310px!important;width:750px!important;height:auto!important;min-height:330px!important}'});
 await p.evaluate(()=>document.fonts.ready);await caption(p,0,demo.steps[0][0]);await pause(400);
 const start=Date.now(),chapters=[];await p.screenshot({path:path.join(output,`${demo.id}-poster.jpg`),type:'jpeg',quality:88});
 for(const [i,[text,action]]of demo.steps.entries()){chapters.push({at:(Date.now()-start)/1000,title:text});await caption(p,i,text);await pause(800);await action(p);await pause(2700);await p.screenshot({path:`/private/tmp/vanta-feature-demos/${demo.id}-${i}.png`});}
 if(errors.length)throw Error(errors.join('\n'));
 const duration=(Date.now()-start)/1000;const video=p.video();await context.close();const source=await video.path();
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-of','json',source]));const offset=Math.max(0,Number(probe.format.duration)-duration);
 const dest=path.join(output,`${demo.id}.mp4`);execFileSync('ffmpeg',['-y','-ss',offset.toFixed(3),'-i',source,'-t',duration.toFixed(3),'-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',dest],{stdio:'ignore'});
 // Chapters use the same timeline as the trimmed recording; no audio is required.
 manifest[demo.id]={src:`/studio/demos/${demo.id}.mp4`,poster:`/studio/demos/${demo.id}-poster.jpg`,duration:Math.round(duration),title:demo.title,chapters:chapters.map(c=>({...c,at:Math.round(c.at*10)/10}))};
 fs.writeFileSync(path.join(output,`${demo.id}.json`),JSON.stringify(manifest[demo.id],null,2));console.log('RECORDED',demo.id,duration.toFixed(1)+'s',Math.round(fs.statSync(dest).size/1024)+'KB');
 }catch(error){await p.screenshot({path:`/private/tmp/vanta-feature-demos/${demo.id}-error.png`});console.error('FAILED',demo.id,error.message);await context.close();process.exitCode=1;}
 }
 const metadata=Object.fromEntries(demos.filter(d=>fs.existsSync(path.join(output,`${d.id}.json`))).map(d=>[d.id,JSON.parse(fs.readFileSync(path.join(output,`${d.id}.json`),'utf8'))]));
 fs.writeFileSync(path.join(__dirname,'../lib/studioFeatureDemos.js'),'// Recorded from the local product UI with fictional data.\n// Regenerate with scripts/record-feature-demos.cjs.\nexport const STUDIO_FEATURE_DEMOS = '+JSON.stringify(metadata,null,2)+';\n');
 }finally{await browser.close()}}
run().catch(e=>{console.error(e);process.exitCode=1});
