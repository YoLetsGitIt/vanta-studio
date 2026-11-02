// Actual dashboard captures, with fictional local responses and no live API traffic.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/capture-feature-screens.cjs
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { contextFor } = require('./capture-journey-screens.cjs');
const path = require('node:path');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4173';
const output = path.join(__dirname, '../public/studio/screenshots');
const artists = ['Alex Morgan','Sam Taylor','Riley Chen','Jordan Lee','Casey Lane','Charlie Park'].map((name,i)=>({id:`member-${i}`,artistId:`artist-${i}`,name,email:`artist${i}@example.com`,status:'approved',acceptingBookings:true,studioRole:i===0?'owner':'artist'}));
const stations = [1,2,3].map(n=>({id:`station-${n}`,name:`Station ${n}`,is_active:true}));
function respond(url) {
  const p=url.pathname;
  if(p.endsWith('/artists'))return {artists:!url.searchParams.get('status')||url.searchParams.get('status')==='approved'?artists:[]};
  if(p.endsWith('/stations'))return {stations};
  if(p.endsWith('/schedule')){
    const date=url.searchParams.get('date')||new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'});
    return {entries:[['Mia Carter',0,1,9,120],['Jamie Wilson',1,2,10,180],['Avery Brooks',2,3,9,90],['Finley James',3,1,13,120],['Taylor Quinn',4,3,12,120]].map(([name,a,s,h,d],i)=>({bookingId:`example-${i}`,clientName:name,artistName:artists[a].name,artistId:artists[a].artistId,stationId:`station-${s}`,stationName:`Station ${s}`,chosenTime:`${date}T${String(h).padStart(2,'0')}:00:00+10:00`,durationMins:d,status:'confirmed',source:'studio'}))};
  }
  if(p.endsWith('/revenue'))return {
    summary:{gross_sales:12400,net_sales:12400,deposits_collected:2400,remaining_balances:1800,completed_sessions:28},
    weekly:[{week_start:'2026-09-07',gross_sales:2400,deposits_collected:400},{week_start:'2026-09-14',gross_sales:2800,deposits_collected:600},{week_start:'2026-09-21',gross_sales:3900,deposits_collected:800},{week_start:'2026-09-28',gross_sales:3300,deposits_collected:600}],
    appointments:{total:38,completed:28,confirmed:7,pending:2,cancelled:1,no_shows:0,avg_value:442.86,revenue:12400,by_source:[{source:'studio',count:28},{source:'walk_in',count:6},{source:'app',count:4}]},
    customers:{new_clients:18,returning_clients:10,top_clients:[{name:'Mia Carter',email:'mia@example.com',total_visits:3,last_visit:'2026-09-25',lifetime_spend:1250,avg_spend:416.67}]},
    by_artist:[],
  };
  if(p.endsWith('/payouts'))return {payouts:[]};
  if(p.endsWith('/reimbursements'))return {reimbursements:[]};
}
(async()=>{
  const browser=await chromium.launch();
  try {
    for(const mobile of [false,true])for(const [file,route,selector] of [
      ['schedule','schedule','.studio-schedule-page'],['artists','artists','.studio-artists-page'],
      ['finances','financial','.studio-financial-page'],['analytics','analytics','.studio-revenue-page'],
    ]){
      const viewport=mobile?{width:460,height:860}:{width:1280,height:860};
      const context=await contextFor(browser,{viewport,respond});
      await context.addInitScript(()=>sessionStorage.setItem('financial_unlocked','1'));
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/dashboard/${route}.html`,{waitUntil:'networkidle'});
      const view=page.locator(selector);await view.waitFor();
      if(file==='schedule')await page.getByLabel('Calendar view',{exact:true}).selectOption('day:station',{force:true});
      if(file==='finances'||file==='analytics')await page.getByRole('button',{name:'Last 4 weeks',exact:true}).click();
      await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
      if(errors.length)throw new Error(errors.join('\n'));
      const rect=await view.boundingBox();
      await page.screenshot({path:path.join(output,`feature-${file}${mobile?'-mobile':''}.png`),clip:{x:rect.x,y:rect.y,width:Math.min(rect.width,viewport.width-rect.x),height:Math.min(rect.height,viewport.height-rect.y)},animations:'disabled'});
      console.log('Captured',file,mobile?'mobile':'desktop');await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
