// Run after a build, with out/ served locally. All remote API requests are mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.VANTA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.VANTA_STUDIO_TEST_URL || 'http://127.0.0.1:3019';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      const user = { id: '22222222-2222-4222-8222-222222222222', email: 'studio@example.test' };
      localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: 2000000000, user }));
      localStorage.setItem(`vanta-studio-tour:${user.id}`, 'complete');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = 'all';
    const updates = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.pathname === '/studio/me') return route.fulfill({ json: { status: 'approved', studio_id: 'test-studio', studio: { name: 'Test studio', timezone: 'Australia/Melbourne', scheduling_mode: mode, subscription_status: 'active' } } });
      if (url.pathname === '/studio/me/profile') {
        const body = route.request().postDataJSON();
        updates.push(body);
        mode = body.scheduling_mode;
        return route.fulfill({ json: { status: 'ok' } });
      }
      return route.fulfill({ json: { hours: [], stations: [], templates: [], fields: {}, connected: false } });
    });
    await page.goto(`${base}/dashboard/settings.html?tab=bookings`, { waitUntil: 'networkidle' });
    const titles = ['Only offer quieter months', 'Only offer quieter days', 'Keep appointments together'];
    const controls = titles.map(name => page.getByRole('checkbox', { name, exact: true }));
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Smart scheduling', exact: true }) });
    const modes = ['all', 'quieter_months', 'quieter_days_only', 'quieter_days', 'minimize_gaps', 'quieter_months_gaps', 'quieter_days_gaps', 'combined'];
    assert.equal(await page.getByRole('navigation', {name: 'Example booking steps'}).count(), 0);
    for (const [flags, next] of modes.entries()) {
      for (const [index, control] of controls.entries()) await control.setChecked(!!(flags & (1 << index)));
      assert.equal(await page.getByRole('dialog').count(), 0, 'Checkboxes must not open examples');
      const before = updates.length;
      for (const [index, title] of titles.entries()) {
        const trigger = page.getByRole('button', { name: `See example: ${title}`, exact: true });
        await trigger.click();
        const modal = page.getByRole('dialog', { name: title, exact: true });
        await modal.waitFor();
        const groupName = ['month', 'date', 'time'][index];
        const count = await modal.getByRole('group', { name: `Example client ${groupName} options` }).getByRole('button').count();
        assert.equal(count, index === 0 ? flags & 1 ? 2 : 3 : index === 1 ? flags & 2 ? 2 : 5 : flags & 4 ? 3 : 5);
        if (index === 1 && flags & 1) await modal.getByText(/quieter months is also on/).waitFor();
        if (index === 2 && flags & 4) {
          await modal.getByRole('button', {name: 'Show all times', exact:true}).click();
          assert.equal(await modal.getByRole('group', {name:'Example client time options'}).getByRole('button').count(),5);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(await trigger.evaluate(el => document.activeElement === el),true);
        assert.equal(updates.length,before,'Examples must not save preferences');
      }
      await Promise.all([page.waitForResponse(r=>r.url().endsWith('/studio/me/profile')),section.getByRole('button',{name:/Save/}).click()]);
      assert.equal(updates.at(-1).scheduling_mode,next);
      await page.reload({waitUntil:'networkidle'});
      for (const [index, control] of controls.entries()) assert.equal(await control.isChecked(),!!(flags & (1 << index)));
    }
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value,theme);
      for (const width of [1280,360]) {
        await page.setViewportSize({width,height:900});
        for (const [index,title] of titles.entries()) {
          const trigger=page.getByRole('button',{name:`See example: ${title}`,exact:true});
          await trigger.click();
          const modal=page.getByRole('dialog',{name:title,exact:true});
          await modal.getByText('How it’s calculated',{exact:true}).click();
          await modal.getByText(/We compare booked hours/).waitFor();
          const rect=await modal.boundingBox();
          assert.ok(rect.x>=0 && rect.x+rect.width<=width+1);
          assert.ok(rect.y>=0 && rect.y+rect.height<=901);
          if(width===360) assert.ok(Math.abs(rect.y+rect.height-900)<2,'Mobile sheet must anchor to bottom');
          assert.equal(await modal.evaluate(el=>el.scrollWidth>el.clientWidth),false);
          if(index>0) {
            const square=await modal.getByRole('table').getByRole('img').first().boundingBox();
            assert.ok(square.width>=20 && Math.abs(square.width-square.height)<1);
          }
          const done=modal.getByRole('button',{name:'Done',exact:true});
          await done.focus(); await page.keyboard.press('Tab');
          assert.equal(await modal.getByRole('button',{name:'Close example'}).evaluate(el=>document.activeElement===el),true);
          await modal.screenshot({animations:'disabled',path:`/private/tmp/vanta-example-${index}-${theme}-${width}.png`});
          await done.click();
          assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
        }
      }
    }
    for (const width of [1524,1280,1024,768,360]) {
      await page.setViewportSize({width,height:942});
      const bounds=await page.evaluate(()=>{
        const main=document.querySelector('main');main.scrollTo({top:main.scrollHeight,left:10000});window.scrollTo(10000,10000);
        return {x:scrollX,y:scrollY,h:document.documentElement.scrollHeight,mx:main.scrollLeft,bottom:Math.abs(main.scrollHeight-main.clientHeight-main.scrollTop)<2};
      });
      assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.ok(bounds.h<=943);assert.equal(bounds.mx,0);assert.equal(bounds.bottom,true);
    }
    assert.deepEqual(errors, []);
    console.log('Studio settings: eight combinations, modal examples, focus return/trap, mobile sheets, themes and scroll bounds passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
