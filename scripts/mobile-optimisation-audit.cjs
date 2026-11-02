// All remote requests use isolated fixtures. Never contacts client services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const { setup } = require('./polish-fixtures.cjs');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3029';
const output = process.env.STUDIO_MOBILE_OUTPUT || '../artifacts/studio-mobile-2026-10-11/before';
const engines = process.env.STUDIO_BROWSER === 'webkit' ? webkit : chromium;
const records = [], errors = [], writes = [];
fs.mkdirSync(output, { recursive: true });
async function inspect(page, name, screenshot = false) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => {
    const visible = el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 && !el.closest('[hidden],[inert],[aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden'; };
    const label = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.getAttribute('placeholder') || el.id || el.type || '').trim().slice(0, 90);
    const main = document.querySelector('.studio-dashboard-main');
    const controls = [...document.querySelectorAll('button, summary, [role="button"], input, select, textarea')].filter(visible);
    return {
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
      smallTargets: controls.filter(el => el.matches('button, summary, [role="button"]') && !el.disabled && (el.getBoundingClientRect().height < 43 || el.getBoundingClientRect().width < 43)).map(el => ({ label: label(el), height: Math.round(el.getBoundingClientRect().height), width: Math.round(el.getBoundingClientRect().width) })),
      smallInputs: controls.filter(el => el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]), select, textarea') && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => ({ label: label(el), font: getComputedStyle(el).fontSize })),
      outside: [...document.querySelectorAll('input, select, textarea, .studio-feature-header, .studio-feature-body')].filter(visible).filter(el => {const box=el.getBoundingClientRect();return box.left < -1 || box.right > innerWidth + 1;}).map(el => ({label:label(el),class:el.className})),
    };
  });
  records.push({ name, ...result });
  if (screenshot) await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
  console.log(JSON.stringify({name,...result}));
}
(async () => {
  const browser = await engines.launch({headless:true});
  try {
    for (const [width,height] of process.env.STUDIO_AUDIT_SIZES ? JSON.parse(process.env.STUDIO_AUDIT_SIZES) : [[320,640],[390,844],[430,932],[844,390]]) {
      for (const theme of ['dark','light']) {
        const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
        await setup(context);
        await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('vanta-theme',theme);},theme);
        await context.route('**/*',route=>{
          const req=route.request();
          if(new URL(req.url()).origin!==new URL(base).origin && !['GET','HEAD','OPTIONS'].includes(req.method())){
            writes.push({url:req.url(),method:req.method()});
            return route.fulfill({status:400,json:{error:'Isolated audit blocks writes'}});
          }
          if(new URL(req.url()).pathname.endsWith('/consent-templates')) return route.fulfill({json:{templates:[{id:'local-consent',name:'Local consent form',fields:[],requires_signature:true}]}});
          return route.fallback();
        });

        for (const route of process.env.STUDIO_AUDIT_ROUTES ? process.env.STUDIO_AUDIT_ROUTES.split(',') : ['home','schedule','appointments','clients','artists','analytics','financial','settings','import','marketing']) {
          const diagnostics=[]; const page=await context.newPage();page.on('pageerror',error=>errors.push({width,theme,error:error.message}));page.on('requestfailed',r=>diagnostics.push({url:r.url(),failure:r.failure()}));page.on('console',m=>{if(m.type()==='error')diagnostics.push({console:m.text()});});
          await page.goto(`${base}/dashboard/${route}`,{waitUntil:'networkidle'});
          try { await page.locator('.studio-dashboard-main').waitFor(); }
          catch (error) { await page.screenshot({path:`${output}/load-failure-${route}-${width}-${theme}.png`}); fs.writeFileSync(`${output}/load-failure-${route}-${width}-${theme}.html`,await page.content());console.error({url:page.url(),body:await page.locator('body').innerText(),errors,diagnostics});throw error; }
          await inspect(page,`${route}-${width}-${theme}`,width===320||width===390&&theme==='dark');
          if (route==='clients') {
            await page.locator('.studio-client-row').first().click();
            await page.getByRole('button',{name:'Close client details',exact:true}).waitFor();
            await page.getByRole('button',{name:/Allergies.*: Yes/}).click();
            await inspect(page,`client-detail-${width}-${theme}`,true);
            await page.getByRole('button',{name:'Close client details',exact:true}).click();
          }
          if (route==='appointments') {
            await page.locator('.studio-booking-row').first().click();
            await page.getByRole('button',{name:'Close booking details',exact:true}).waitFor();
            await inspect(page,`booking-detail-${width}-${theme}`,true);
          }
          if (route==='settings') for(const tab of ['bookings','payments','account']) {
            await page.locator(`[data-tour-settings-tab="${tab}"]`).click();
            await inspect(page,`settings-${tab}-${width}-${theme}`,width===320&&theme==='dark');
            if(tab==='bookings'){
              const reminder=page.getByRole('switch',{name:'7-day reminder',exact:true});
              const before=await reminder.getAttribute('aria-checked');
              await reminder.click({position:{x:22,y:2}});
              assert.notEqual(await reminder.getAttribute('aria-checked'),before,'The expanded switch area responds to taps');
              const track=await reminder.locator('span[aria-hidden="true"]').boundingBox();
              assert.equal(Math.round(track.height),24,'Switch graphic stays compact');
              await page.getByRole('button',{name:'Edit',exact:true}).first().click();
              const dialog=page.getByRole('dialog',{name:'Edit form',exact:true});
              await dialog.waitFor();
              await dialog.getByRole('button',{name:'+ Text',exact:true}).click();
              await dialog.getByRole('textbox',{name:'Field 1 label',exact:true}).fill('First field');
              await dialog.getByRole('button',{name:'+ Text',exact:true}).click();
              await dialog.getByRole('textbox',{name:'Field 2 label',exact:true}).fill('Second field');
              await dialog.getByRole('button',{name:'Move field 2 up',exact:true}).click();
              assert.equal(await dialog.getByRole('textbox',{name:'Field 1 label',exact:true}).inputValue(),'Second field');
              await inspect(page,`consent-builder-${width}-${theme}`,true);
              await page.setViewportSize({width,height:300});
              await page.waitForFunction(()=>innerHeight===300);
              await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
              await dialog.getByRole('textbox',{name:'Form name'}).focus();
              const save=dialog.getByRole('button',{name:'Save form',exact:true});
              const bounds=await save.boundingBox();
              if(bounds.y<0||bounds.y+bounds.height>301)await page.screenshot({path:`${output}/consent-short-failure-${width}-${theme}.png`});
              assert.ok(bounds.y>=0&&bounds.y+bounds.height<=301,`Save stays visible with a short viewport: ${JSON.stringify(bounds)}`);
              await dialog.getByRole('textbox',{name:'Field 2 label',exact:true}).scrollIntoViewIfNeeded();
              const scrolled=await save.boundingBox();
              assert.ok(scrolled.y>=0&&scrolled.y+scrolled.height<=301,'Scrolling fields keeps Save visible');
              await page.setViewportSize({width,height});
              await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
            }
          }
          if(route==='marketing'){
            await page.getByRole('button',{name:'Settings',exact:true}).click();
            await page.getByRole('heading',{name:'Marketing settings',exact:true}).waitFor();
            await inspect(page,`marketing-settings-${width}-${theme}`,width===320&&theme==='dark');
          }
          if(route==='import'){
            await page.locator('input[type=file]').setInputFiles({name:'local-long-client-import.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Email,Phone\nAlexandra Montgomery-Williams,alexandra.montgomery@example.test,+61412345678\n')});
            await page.getByRole('combobox',{name:'CSV column for Full name',exact:true}).waitFor();
            await inspect(page,`import-mapping-${width}-${theme}`,width===320||width===390&&theme==='dark');
            await page.getByRole('button',{name:/Preview/i}).click();
            await page.getByRole('table',{name:'Import preview'}).waitFor();
            await inspect(page,`import-preview-${width}-${theme}`,width===320||width===390&&theme==='dark');
          }
          await page.close();
        }
        await context.close();
      }
    }
    assert.deepEqual(errors,[],'Runtime errors'); assert.deepEqual(writes,[],'No writes expected during audit');
    if(process.env.STUDIO_ASSERT_MOBILE)assert.deepEqual(records.filter(r=>r.documentOverflow>1||r.mainOverflow>1||r.outside.length||r.smallInputs.length||r.smallTargets.length),[],'Mobile layout and controls');
    console.log(`${records.length} layout states checked; no runtime errors or remote writes.`);
  } finally {
    fs.writeFileSync(`${output}/results.json`,JSON.stringify({records,errors,writes},null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
