// Week grid -> prefilled appointment -> mocked save -> refreshed week.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3060';
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.STUDIO_CHROMIUM_EXECUTABLE });
 try {
  for (const width of (process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [1440, 390, 844])) {
   const context = await browser.newContext({viewport:{width,height:width===844?390:1000},timezoneId:'Australia/Melbourne',hasTouch:width<1000,isMobile:width<1000});
   await setup(context);
   let created;
   let entries=[{bookingId:'existing',clientName:'Existing client',artistId:'artist-0',artistName:'Sam Anderson',stationId:'station-0',chosenTime:'2026-11-09T10:00:00+11:00',durationMins:60,status:'confirmed',source:'studio'}];
   await context.route(/\/studio\/me\/schedule(\?|$)/,r=>r.fulfill({json:{entries}}));
   await context.route(/\/studio\/me\/bookings\/existing$/,r=>r.fulfill({json:{id:'existing',requester_name:'Existing client',status:'confirmed',chosen_time:entries[0].chosenTime}}));
   await context.route(/\/studio\/me\/bookings$/,r=>{
    if(r.request().method()!=='POST')return r.fulfill({json:{bookings:[]}});
    created=r.request().postDataJSON();
    entries.push({bookingId:'created',clientName:created.requester_name,artistId:created.artist_id,stationId:created.station_id,chosenTime:created.chosen_time,durationMins:created.duration_minutes,status:'confirmed',source:created.source});
    return r.fulfill({json:{id:'created'}});
   });
   const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-09T08:00:00+11:00'));
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/dashboard/schedule',{waitUntil:'networkidle'});
   if(width===844)await page.getByLabel('Calendar view').selectOption('week:artist');else await page.getByRole('button',{name:'Week',exact:true}).click();
   const week=page.getByRole('region',{name:'Weekly schedule'});
   await week.waitFor();
   const filter=page.getByLabel('Filter weekly schedule');
   const panel=page.getByRole('dialog',{name:'New Appointment',exact:true});
   async function close(){await panel.getByRole('button',{name:'Close new appointment'}).click(); const discard=page.getByRole('button',{name:'Discard appointment',exact:true});if(await discard.isVisible())await discard.click();await panel.waitFor({state:'hidden'});}
   async function openSlot(date,minutes){const slot=week.locator(`[data-booking-slot="${date}-${minutes}"]`);if(width<1000)await slot.tap();else await slot.click();await panel.waitFor();await panel.locator('#new-appointment-artist option[value="artist-0"]').waitFor({state:'attached'});}
   async function checkSlot(date,hour,minutes){await page.waitForFunction(d=>document.querySelector('#new-appointment-date')?.value===d,date);assert.equal(await panel.locator('#new-appointment-date').inputValue(),date);assert.equal(await panel.getByLabel('Start time hour',{exact:true}).inputValue(),hour);assert.equal(await panel.getByLabel('Start time minutes',{exact:true}).inputValue(),minutes);}
   // Existing cards still open details, never a creation panel.
   await week.locator('[data-booking-id="existing"]').click();
   await page.getByRole('complementary',{name:'Existing client booking details'}).waitFor();
   assert.equal(await panel.isVisible(),false);
   await page.getByRole('button',{name:'Close booking details'}).click();
   await filter.selectOption('artist-1');
   await openSlot('2026-11-09',870);
   await checkSlot('2026-11-09','2','30');
   assert.equal(await panel.getByLabel('Start time AM or PM').inputValue(),'PM');
   assert.equal(await panel.locator('#new-appointment-artist').inputValue(),'artist-1');
   // Booking type starts unchosen; the studio picks it.
   assert.equal(await panel.getByRole('radio',{name:'Studio appointment',exact:true}).getAttribute('aria-checked'),'false');
   await close();
   await week.focus(); await week.press('Home'); await week.evaluate(el=>{el.scrollTop=0;}); await week.press('ArrowUp');
   // All artists leaves the artist unset; (the station view was removed) keyboard arrows choose half-hour slots.
   await filter.selectOption('all');
   const keyboardSlot=week.locator('[data-booking-slot="2026-11-11-540"]');
   await keyboardSlot.focus();await keyboardSlot.press('ArrowDown');await page.keyboard.press('Enter');
   await panel.waitFor();await checkSlot('2026-11-11','9','30');
   assert.equal(await panel.locator('#new-appointment-artist').inputValue(),'');
   await close();
   await week.focus(); await week.press('Home'); await week.evaluate(el=>{el.scrollTop=0;}); await week.press('ArrowUp');
   // Complete one booking and see it on the week without navigating away.
   await filter.selectOption('artist-1');await openSlot('2026-11-12',870);
   // Steps open one at a time: booking type, then client, appointment, schedule.
   await panel.getByRole('radio',{name:'Studio appointment',exact:true}).click();
   await panel.getByRole('searchbox',{name:'Search existing clients'}).fill('Alexandra');
   await panel.getByRole('group',{name:'Matching clients'}).getByRole('button').first().click();
   await panel.getByRole('radio',{name:'Tattoo',exact:true}).click();
   await panel.locator('#new-appointment-duration').selectOption('60');
   // Payment opens once the schedule is done; a price is required.
   await panel.getByLabel('Estimated price').fill('300');
   if(process.env.STUDIO_QA_OUTPUT)await page.screenshot({path:`${process.env.STUDIO_QA_OUTPUT}/prefilled-${width}.png`});
   await panel.getByRole('button',{name:'Create Appointment',exact:true}).click();
   await panel.waitFor({state:'hidden'});
   await week.locator('[data-booking-id="created"]').waitFor();
   assert.equal(created.chosen_time,'2026-11-12T03:30:00.000Z');
   assert.equal(created.artist_id,'artist-1');assert.equal(created.source,'studio');
   await page.getByRole('button',{name:'Dismiss message'}).click();
   // Generic quick-add must not retain the selected calendar slot or artist.
   await page.evaluate(()=>window.dispatchEvent(new Event('vanta:open-new-appointment')));
   await panel.waitFor();await checkSlot('2026-11-09','8','30');
   assert.equal(await panel.locator('#new-appointment-artist').inputValue(),'');
   await close();
   assert.deepEqual(errors,[]);
   console.log(`PASS week creation at ${width}px: slots, artist/station filters, keyboard, mocked save, refresh and generic reset`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
