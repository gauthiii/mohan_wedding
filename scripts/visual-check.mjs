import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = (process.argv[2] || process.env.PREVIEW_URL || 'http://127.0.0.1:5174').replace(/\/$/,'');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors=[],report=[];
await mkdir('artifacts/screenshots',{recursive:true});
const scrollToProgress=async(page,p)=>{
 await page.evaluate(p=>{document.documentElement.style.scrollBehavior='auto';const journey=document.querySelector('.temple-journey');window.scrollTo(0,journey.offsetTop+p*(journey.offsetHeight-innerHeight));},p);
 await page.waitForFunction(p=>Math.abs(Number(document.querySelector('.temple-journey')?.dataset.progress)-p)<.002,p,{timeout:12000});
};
try{
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const page=await browser.newPage({viewport});
  page.on('console',m=>{if(m.type()==='error')errors.push(`${viewport.name}: ${m.text()}`);});
  page.on('pageerror',e=>errors.push(`${viewport.name}: ${e.message}`));
  await page.goto(`${base}/traditional`,{waitUntil:'networkidle'});
  await page.waitForSelector('.temple-journey[data-ready="true"]');
  for(const [name,p] of [['entrance',0],['threshold',.24],['mohan',.38],['nandhini',.53],['hall',.72],['ritual',.9],['invitation',.98]]){
   await scrollToProgress(page,p);await page.waitForTimeout(750);
   await page.screenshot({path:`artifacts/screenshots/${viewport.name}-${name}.png`});
   assert.equal(await page.locator('.temple-stage').evaluate(el=>Math.round(el.getBoundingClientRect().top)),0,'scene must stay pinned');
  }
  report.push({viewport:viewport.name,...await page.locator('.temple-journey').evaluate(el=>({...el.dataset}))});
  // Reverse and fast scrolling must converge to the requested view.
  await scrollToProgress(page,.2);await scrollToProgress(page,.93);await scrollToProgress(page,.4);
  await page.getByRole('button',{name:'Switch language'}).click();
  assert.ok((await page.locator('.journey-caption').innerText()).includes('மோகன்'));
  await page.getByRole('button',{name:'Switch language'}).click();
  await page.getByRole('button',{name:'Play ambience'}).click();
  assert.equal(await page.getByRole('button',{name:'Mute ambience'}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Mute ambience'}).click();
  await page.getByRole('button',{name:'Skip to invitation'}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'invitation');
  await page.waitForSelector('.temple-journey[data-active="false"]');await page.waitForTimeout(100);
  const paused=await page.locator('.temple-journey').getAttribute('data-progress');await page.waitForTimeout(250);
  assert.equal(await page.locator('.temple-journey').getAttribute('data-progress'),paused,'rendering pauses offscreen');
  await page.getByRole('button',{name:'Send my RSVP'}).click();assert.equal(await page.locator('.form-error').count(),1);
  await page.locator('input[name=name]').fill('Test Guest');await page.locator('input[name=phone]').fill('5551234567');await page.locator('select[name=attendance]').selectOption('yes');await page.getByRole('button',{name:'Send my RSVP'}).click();await page.waitForSelector('[role=status]');assert.ok((await page.getByRole('status').innerText()).includes('no response was recorded'),'an unconfigured build must not claim it saved anything');
  await scrollToProgress(page,.98);await page.getByRole('button',{name:'Replay journey'}).click();
  await page.waitForFunction(()=>Number(document.querySelector('.temple-journey').dataset.progress)<.002);
  await page.keyboard.press('PageDown');await page.waitForTimeout(800);assert.ok(await page.evaluate(()=>scrollY>0));
  await page.setViewportSize({width:844,height:390});await scrollToProgress(page,.88);await page.screenshot({path:`artifacts/screenshots/${viewport.name}-landscape.png`});
  await page.getByRole('link',{name:'Museum',exact:true}).click();await page.waitForSelector('.m-hero');assert.equal(await page.locator('canvas').count(),0);
  await page.screenshot({path:`artifacts/screenshots/${viewport.name}-museum.png`});
  await page.getByRole('link',{name:'Temple',exact:true}).click();await page.waitForSelector('.temple-journey[data-ready="true"]');
  await page.evaluate(()=>{document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
  await page.waitForSelector('.temple-static');assert.equal(await page.locator('.temple-static article').count(),3);
  await page.close();
 }
 // RSVP delivery. The endpoint is stubbed, so the real spreadsheet is never
 // touched, but the request itself is checked: method, the content type that
 // keeps it a CORS simple request, the honeypot, and which invitation it came
 // from. A failing endpoint must surface an error rather than a false success.
 {
  const endpoint='https://script.google.com/macros/s/TEST/exec';
  for(const [route,invitation] of [['/wedding','classic'],['/traditional','temple'],['/modern','museum']]){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   page.on('pageerror',e=>errors.push(`rsvp-${route}: ${e.message}`));
   await page.addInitScript(u=>{window.RSVP_ENDPOINT=u;},endpoint);
   let sent=null;
   await page.route(endpoint,async r=>{sent={method:r.request().method(),type:r.request().headers()['content-type'],body:JSON.parse(r.request().postData())};await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});});
   await page.goto(`${base}${route}`,{waitUntil:'networkidle'});
   await page.locator('input[name=name]').fill('Test Guest');
   await page.locator('input[name=phone]').fill('+91 98400 12345');
   await page.locator('select[name=attendance]').selectOption('yes');
   await page.locator('select[name=guests]').selectOption('3');
   await page.getByRole('button',{name:'Send my RSVP'}).click();
   await page.waitForSelector('[role=status]');
   assert.ok((await page.getByRole('status').innerText()).includes('has been recorded'),`${route} must confirm a stored response`);
   assert.ok(sent,`${route} never reached the endpoint`);
   assert.equal(sent.method,'POST');
   assert.equal(sent.type,'text/plain;charset=utf-8','a non-simple content type would trigger a preflight Apps Script cannot answer');
   assert.equal(sent.body.invitation,invitation);
   assert.equal(sent.body.name,'Test Guest');
   assert.equal(sent.body.website,'','the honeypot must be submitted empty');
   await page.close();
  }
  // A rejected submission must report failure, never a false confirmation.
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(`rsvp-failure: ${e.message}`));
  await page.addInitScript(u=>{window.RSVP_ENDPOINT=u;},endpoint);
  await page.route(endpoint,r=>r.fulfill({status:500,body:'nope'}));
  await page.goto(`${base}/wedding`,{waitUntil:'networkidle'});
  await page.locator('input[name=name]').fill('Test Guest');
  await page.locator('input[name=phone]').fill('5551234567');
  await page.locator('select[name=attendance]').selectOption('yes');
  await page.getByRole('button',{name:'Send my RSVP'}).click();
  await page.waitForSelector('.form-error');
  assert.equal(await page.getByRole('status').count(),0,'a failed submission must not show a success message');
  await page.close();
 }

 // The previous invitation, preserved at /wedding. It is pure scroll parallax:
 // it must never create a WebGL context, and its own RSVP must still work.
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const page=await browser.newPage({viewport});
  page.on('console',m=>{if(m.type()==='error')errors.push(`classic-${viewport.name}: ${m.text()}`);});
  page.on('pageerror',e=>errors.push(`classic-${viewport.name}: ${e.message}`));
  await page.goto(`${base}/wedding`,{waitUntil:'networkidle'});
  await page.waitForSelector('.t-hero');
  assert.equal(await page.locator('canvas').count(),0,'the classic route must not start WebGL');
  assert.equal(await page.locator('.corridor').count(),1,'classic corridor section present');
  assert.equal(await page.locator('.ceremony').count(),1,'classic ceremony section present');
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({path:`artifacts/screenshots/classic-${viewport.name}.png`,fullPage:false});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.getByRole('link',{name:'Temple',exact:true}).click();
  await page.waitForSelector('.temple-journey[data-ready="true"]');
  await page.getByRole('link',{name:'Classic',exact:true}).click();
  await page.waitForSelector('.t-hero');
  assert.equal(await page.locator('canvas').count(),0,'returning to the classic route must release WebGL');
  await page.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844}});
 await reduced.goto(`${base}/traditional`);await reduced.waitForSelector('.temple-static');assert.equal(await reduced.locator('canvas').count(),0);await reduced.screenshot({path:'artifacts/screenshots/reduced-motion.png'});await reduced.close();
 const unsupported=await browser.newPage();await unsupported.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};});
 await unsupported.goto(`${base}/traditional`);await unsupported.waitForSelector('.temple-static');await unsupported.getByRole('button',{name:'View invitation'}).click();assert.equal(await unsupported.evaluate(()=>document.activeElement.id),'invitation');await unsupported.close();
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/temple-validation.json',JSON.stringify({base,report,errors,checks:['seven chapters','reverse/fast scroll','sticky positioning','Tamil','audio toggle','skip/focus','offscreen pause','RSVP','replay','keyboard','resize','Museum','route re-entry','context loss','reduced motion','WebGL unavailable','classic /wedding route','classic route uses no WebGL','nav round trip','RSVP delivery on all three routes','RSVP failure surfaces an error']},null,2));
 console.log(JSON.stringify(report,null,2));console.log('All temple journey browser checks passed.');
}finally{await browser.close();}
