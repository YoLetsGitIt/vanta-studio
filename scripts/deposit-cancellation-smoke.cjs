// All remote requests are intercepted. No live bookings or payments are modified.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup, booking } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.STUDIO_CHROMIUM_EXECUTABLE ? {executablePath:process.env.STUDIO_CHROMIUM_EXECUTABLE}:{})});
 try {
  for (const width of [390,1440]) {
   const context=await browser.newContext({viewport:{width,height:1000}});
   await setup(context);
   let current={...booking,status:'awaiting_payment',chosen_time:new Date().toISOString(),deposit_required:true,deposit_amount:100,deposit_paid_at:null,deposit_confirmed_at:null};
   let cancellations=0,fail=false;
   await context.route('**/studio/me/dashboard-attention',route=>route.fulfill({json:{bookings:[current],pending_artists:[],pending_reimbursements:[]}}));
   await context.route('**/studio/me/bookings/booking-1',route=>route.fulfill({json:current}));
   await context.route('**/studio/me/bookings/booking-1/cancel-deposit',route=>{
    assert.equal(route.request().method(),'POST');cancellations++;
    if(fail)return route.fulfill({status:409,json:{error:'Payment already received'}});
    current={...current,status:'confirmed',deposit_required:false,deposit_amount:null};
    return route.fulfill({json:{deposit_required:false}});
   });
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/dashboard/home',{waitUntil:'networkidle'});
   await page.getByRole('button',{name:/Unpaid deposits/}).click();
   await page.getByRole('button',{name:'Cancel deposit',exact:true}).click();
   let confirm=page.getByRole('alertdialog');await confirm.waitFor();
   await page.keyboard.press('Escape');assert.equal(cancellations,0);
   await page.getByRole('button',{name:'Cancel deposit',exact:true}).click();
   confirm=page.getByRole('alertdialog');await confirm.getByRole('button',{name:'Cancel deposit',exact:true}).click();
   await page.getByText('Deposit cancelled. The appointment is still booked.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:/Unpaid deposits/}).count(),0);assert.equal(cancellations,1);
   // The details panel offers the same action; a rejected cancellation keeps the requirement.
   current={...current,status:'confirmed',deposit_required:true,deposit_amount:100};fail=true;
   await page.goto(base+'/dashboard/appointments?booking=booking-1',{waitUntil:'networkidle'});
   const cancel=page.getByRole('button',{name:'Cancel deposit',exact:true});await cancel.waitFor();await cancel.click();
   await page.getByRole('alertdialog').getByRole('button',{name:'Cancel deposit',exact:true}).click();
   await page.getByText('Payment already received',{exact:true}).waitFor();assert(await cancel.isVisible());
   fail=false;await cancel.click();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel deposit',exact:true}).click();
   await page.getByText('Not required',{exact:true}).waitFor();assert.equal(await cancel.count(),0);
   assert.deepEqual(errors,[]);console.log('PASS',width,'cancel dismissed, unpaid deposit cancelled, failure retained, details updated');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
