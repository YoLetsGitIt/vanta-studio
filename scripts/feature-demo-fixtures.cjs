// Fictional local API responses for product-demo recording. Never use a live account.
const artists=['Alex Morgan','Sam Taylor','Riley Chen'].map((name,i)=>({id:`member-${i}`,artistId:`artist-${i}`,name,email:`artist${i}@example.com`,status:'approved',acceptingBookings:true,studioRole:i===0?'owner':'artist',speciality:['Fine Line','Blackwork']}));
const stations=[1,2,3].map(n=>({id:`station-${n}`,name:`Station ${n}`,is_active:true}));
const fields=Object.fromEntries(['artist_id','body_location','design_details','size','image_paths','retouch','skin_tone','notes','allergies'].map(key=>[key,{enabled:['body_location','design_details','size','image_paths'].includes(key),required:key==='design_details'}]));
function fixtures(){
 let config=structuredClone(fields);
 const template={id:'demo-consent',name:'Tattoo consent',updated_at:'2026-09-01T00:00:00Z',requires_signature:true,fields:[{id:'intro',type:'paragraph',label:'Please review your tattoo details and tell us about any relevant health conditions.'}]};
 return (url,request)=>{
 const p=url.pathname,body=request?.postDataJSON?.();
 if(p==='/studio/me')return {status:'approved',studio_id:'demo-studio',studio:{name:'Vanta Studio',timezone:'Australia/Sydney',subscription_status:'active'}};
 if(p.endsWith('/form-config')){if(body?.fields)config=body.fields;return {fields:config};}
 if(p.endsWith('/consent-templates'))return {templates:[template]};
 if(p.includes('/consent-templates/'))return {template:{...template,...body}};
 if(p.endsWith('/stripe/status'))return {connected:true,charges_enabled:true};
 if(p.endsWith('/artists'))return {artists:!url.searchParams.get('status')||url.searchParams.get('status')==='approved'?artists:[]};
 if(p.endsWith('/stations'))return {stations};
 if(p.endsWith('/stats'))return {totalBookings:36,completed:28,upcoming:8,totalRevenue:12400};
 if(p.endsWith('/work-schedule'))return {schedule:[1,2,3,4,5].map(day_of_week=>({day_of_week,start_time:'09:00',end_time:'17:00'}))};
 if(p.endsWith('/schedule')||p.endsWith('/schedule/range')){
 const date=url.searchParams.get('date')||new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'});
 return {entries:[['Mia Carter',0,1,10,120],['Jamie Wilson',1,2,11,180],['Avery Brooks',2,3,10,90]].map(([name,a,s,h,d],i)=>({bookingId:`example-${i}`,clientName:name,artistName:artists[a].name,artistId:artists[a].artistId,stationId:`station-${s}`,stationName:`Station ${s}`,chosenTime:`${date}T${String(h).padStart(2,'0')}:00:00+10:00`,durationMins:d,status:'confirmed',source:'studio'}))};
 }
 if(p.endsWith('/reimbursements'))return {reimbursements:[]};
 if(p.includes('/artists/')&&p.endsWith('/payouts'))return {payouts:[{id:'sample-payout',amount:1200,paid_at:'2026-09-25T10:00:00Z',payment_method:'bank_transfer',recorded_by_email:'studio@example.com',note:'Weekly payout',bookings:[]}]};
 if(p.endsWith('/payouts'))return {payouts:artists.map((a,i)=>({artist_id:a.artistId,artist_name:a.name,total_earned:6000-i*1500,earned_studio:4000-i*1000,earned_personal:2000-i*500,artist_payout:4200-i*1000,total_paid:3000-i*1000,outstanding:1200,incomplete_recordings:0,reimbursed:0}))};
 if(p.endsWith('/revenue'))return {summary:{gross_sales:12400,net_sales:12400,deposits_collected:2400,remaining_balances:1800,completed_sessions:28},weekly:[],appointments:{total:38,completed:28,confirmed:7,pending:2,cancelled:1,no_shows:0,avg_value:442.86,revenue:12400,by_source:[{source:'studio',count:28},{source:'personal',count:10}]},customers:{new_clients:18,returning_clients:10,top_clients:[{name:'Mia Carter',email:'mia@example.com',total_visits:3,last_visit:'2026-09-25',lifetime_spend:1250,avg_spend:416.67}]},by_artist:[]};
 if(p.endsWith('/import'))return {clients:{imported:3,linked:0,skipped:0},errors:[]};
 };
}
module.exports={fixtures};
