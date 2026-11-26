// Build both web repositories and serve their out/ folders locally before running.
// Every remote request is intercepted; no real accounts, bookings or messages are used.
const assert = require('node:assert/strict');
// Date of birth is three dropdowns (day, month, year).
const fillDob = async (page, iso) => { const [y, m, d] = iso.split('-'); const g = page.getByRole('group', { name: 'Date of birth' }).first(); await g.getByLabel('Day of birth').selectOption(String(+d)); await g.getByLabel('Month of birth').selectOption(String(+m)); await g.getByLabel('Year of birth').selectOption(y); };
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const studioBase = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const publicBase = process.env.VANTA_PUBLIC_TEST_URL || 'http://127.0.0.1:3030';
const artistId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'client@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { full_name: 'Local Client' } };
const auth = { access_token: 'local-test-token', refresh_token: 'local-refresh-token', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user };
const studio = { id: 'test-studio', name: 'Local Piercing Studio', timezone: 'Australia/Melbourne', subscription_status: 'active', artists: [{ artistId, artist_id: artistId, name: 'Local Professional' }] };

async function mockContext(browser, width, { studioClosed = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.addInitScript(session => {
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify(session));
    localStorage.setItem(`vanta-studio-tour:${session.user.id}`, 'complete');
  }, auth);
  const writes = [];
  let piercingAftercare = '';
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if ([new URL(studioBase).origin, new URL(publicBase).origin].includes(url.origin)) return route.continue();
    if (req.method() === 'POST' || req.method() === 'PATCH') {
      writes.push({ path, body: req.postDataJSON() });
      if (path === '/studio/me/profile') piercingAftercare = req.postDataJSON().piercing_aftercare_instructions;
      return route.fulfill({ json: { id: 'local-booking', status: 'pending' } });
    }
    if (path.endsWith('/public')) return route.fulfill({ json: studio });
    if (path.endsWith('/form-config')) return route.fulfill({ json: { fields: { size: {enabled: true, required: true}, skin_tone: {enabled: true, required: true} } } });
    if (path.endsWith('/consent-templates')) return route.fulfill({ json: { templates: [] } });
    if (path === `/artists/${artistId}`) return route.fulfill({ json: { id: artistId, name: 'Local Professional' } });
    if (path.endsWith('/work-schedule')) return route.fulfill({ json: { schedule: Array.from({length:7},(_,i)=>({day_of_week:i,start_time:'09:00',end_time:'17:00'})) } });
    if (path === '/users/me') return route.fulfill({ json: { name: 'Local Client', phone: '0400123456' } });
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: studio.id, studio: {...studio,piercing_aftercare_instructions:piercingAftercare} } });
    if (path.endsWith('/artists')) return route.fulfill({ json: { artists: [{artistId, artist_id: artistId, name:'Local Professional', status:'approved'}] } });
    if (path.endsWith('/clients')) return route.fulfill({ json: { clients: [] } });
    if (path.endsWith('/hours')) return route.fulfill({ json: { hours: studioClosed ? Array.from({length:7}, (_,day_of_week) => ({day_of_week, is_closed:true, open_time:'09:00', close_time:'17:00'})) : [] } });
    if (path.endsWith('/stations') || path.endsWith('/stations/available')) return route.fulfill({ json: { stations: [{id:'local-station',name:'Piercing station',is_active:true}] } });
    if (path.endsWith('/schedule')) return route.fulfill({ json: { entries: [] } });
    if (path.endsWith('/bookings')) return route.fulfill({ json: { bookings: [] } });
    return route.fulfill({ json: {} });
  });
  return { context, writes };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const {context,writes} = await mockContext(browser,width);
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${studioBase}/studio-booking.html?s=test-studio`, {waitUntil:'networkidle'});
      await page.getByRole('heading',{name:studio.name,exact:true}).waitFor();
      const picker=page.locator('select').filter({has:page.locator('option[value="piercing"]')});
      await picker.selectOption('piercing');
      assert.equal(await page.getByText('Skin tone',{exact:true}).count(),0);
      assert.equal(await page.getByText('Colour',{exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Nostril',exact:true}).count(),1);
      await page.getByPlaceholder('Your name',{exact:true}).fill('Local Client');
      await fillDob(page, '1990-01-01');
      { const email = page.locator('input[type="email"]'); if (await email.isEditable()) await email.fill('client@example.test'); } // signed-in clients' email is locked
      await page.locator('input[type="tel"]').fill('0400123456');
      await page.getByRole('button',{name:'Nostril',exact:true}).click();
      await page.locator('textarea').first().fill('Single left nostril piercing');
      await page.getByRole('button',{name:'Request booking',exact:true}).click();
      await page.getByRole('heading',{name:"You're on the list!",exact:true}).waitFor();
      const submitted=writes.find(w=>/\/(studio|client)-booking$/.test(w.path)).body;
      assert.equal(submitted.session_type,'piercing');
      assert.equal(submitted.body_location,'Nostril');
      assert.equal(submitted.size,''); assert.equal(submitted.skin_tone,''); assert.equal(submitted.color,'');
      assert.equal(errors.length,0,errors.join('\n'));
      console.log(`PASS studio piercing request at ${width}px`);
      await context.close();
    }
    // New appointment (guided steps): booking type, client, piercing + artist, schedule, price.
    const labels={studio:'Studio appointment',walkin:'Walk-in',personal:'Personal appointment'};
    for (const width of [390, 1280]) for (const source of ['studio', 'walkin', 'personal']) {
      const {context,writes}=await mockContext(browser,width);
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${studioBase}/dashboard/appointments.html`,{waitUntil:'networkidle'});
      await page.locator('main').first().waitFor();
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('vanta:open-new-appointment',{detail:{}})));
      await page.locator('#new-appointment-title').waitFor();
      await page.getByRole('radio',{name:labels[source],exact:true}).click();
      await page.getByRole('button',{name:/New client/i}).first().click();
      await page.locator('#new-appointment-first-name').fill('Local');
      await page.locator('#new-appointment-last-name').fill('Client');
      await page.locator('#new-appointment-email').fill('local.client@example.test');
      await page.locator('#new-appointment-phone').fill('0400123456');
      const openStep=async name=>{const b=page.getByRole('button',{name:`Open ${name}`});if(await b.count()&&await b.getAttribute('aria-expanded')==='false')await b.click();};
      await openStep('Appointment');
      await page.getByRole('radio',{name:'Piercing',exact:true}).click();
      await page.locator('#new-appointment-artist').selectOption(artistId);
      await openStep('Schedule');
      await page.locator('#new-appointment-date').fill(new Date(Date.now()+2*86400000).toISOString().slice(0,10));
      await page.getByLabel('Start time hour').selectOption('11');
      await page.getByLabel('Start time minutes').selectOption({index:0});
      await page.getByLabel('Start time AM or PM').selectOption({index:0});
      await page.locator('#new-appointment-duration').selectOption({index:2});
      if(await page.locator('#new-appointment-station').isEnabled())await page.locator('#new-appointment-station').selectOption('local-station');
      await openStep('Payment');
      await page.locator('#new-appointment-estimate').fill('120');
      const none=page.getByRole('radio',{name:/No deposit/});if(await none.count())await none.first().click();
      await page.getByRole('button',{name:'Create Appointment',exact:true}).click();
      await page.locator('#new-appointment-first-name').waitFor({state:'detached'});
      const manual=writes.find(w=>w.path==='/studio/me/bookings').body;
      assert.equal(manual.session_type,'piercing');assert.equal(manual.size,undefined);
      assert.equal(manual.source,source);assert.equal(manual.artist_id,artistId);
      assert.equal(errors.length,0,errors.join('\n'));
      console.log(`PASS ${source} piercing appointment created at ${width}px`);
      await context.close();
    }
    {
      // A closed day is caught before anything is sent.
      const {context,writes}=await mockContext(browser,390,{studioClosed:true});
      const page=await context.newPage();
      await page.goto(`${studioBase}/dashboard/appointments.html`,{waitUntil:'networkidle'});
      await page.locator('main').first().waitFor();
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('vanta:open-new-appointment',{detail:{}})));
      await page.locator('#new-appointment-title').waitFor();
      await page.getByRole('radio',{name:'Walk-in',exact:true}).click();
      const openStep=async name=>{const b=page.getByRole('button',{name:`Open ${name}`});if(await b.count()&&await b.getAttribute('aria-expanded')==='false')await b.click();};
      await openStep('Appointment');
      await page.getByRole('radio',{name:'Piercing',exact:true}).click();
      await openStep('Schedule');
      await page.locator('#new-appointment-date').fill(new Date(Date.now()+2*86400000).toISOString().slice(0,10));
      await page.getByText('Studio is closed on this day.',{exact:true}).first().waitFor();
      assert.equal(await page.getByRole('button',{name:'Create Appointment',exact:true}).isDisabled(),true);
      assert.equal(writes.length,0);
      console.log('PASS closed day blocks a piercing walk-in before sending');
      await context.close();
    }
    // (Piercing aftercare is hidden in Settings for now, so it isn't checked here.)
    if (!process.env.VANTA_PUBLIC_TEST_URL) { console.log('SKIP website piercing request (set VANTA_PUBLIC_TEST_URL to the served website)'); return; }
    const {context,writes}=await mockContext(browser,390);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${publicBase}/bookings.html?artist=${artistId}`,{waitUntil:'networkidle'});
    await page.getByRole('button').filter({hasText:'Piercing placement and jewellery'}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByPlaceholder('e.g. Left nostril, one piercing, jewellery preference…').fill('Single nostril piercing');
    await page.getByRole('button',{name:/Select placement/}).click();
    await page.getByRole('button',{name:'Nostril',exact:true}).click();
    await page.getByRole('button',{name:'Done',exact:true}).click();
    assert.equal(await page.getByText('COLOUR',{exact:true}).count(),0);
    // Piercing requests can proceed without a tattoo design reference or colour style.
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Toggle push to later',exact:true}).click();
    await page.locator('input[type="date"]').fill(new Date(Date.now()+30*86400000).toISOString().slice(0,10));
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Send Request',exact:true}).click();
    await page.getByRole('heading',{name:'Request sent!',exact:true}).waitFor();
    const personal=writes.find(w=>w.path==='/bookings').body;
    assert.equal(personal.session_type,'piercing'); assert.equal(personal.body_location,'Nostril');
    assert.equal(personal.color,undefined); assert.deepEqual(personal.reference_images,[]);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS personal piercing request without tattoo fields');
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
