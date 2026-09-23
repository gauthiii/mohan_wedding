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
  assert.equal(await page.locator('.journey-shade').count(),0,'the full-screen black shade must not exist');
  assert.equal(await page.locator('.journey-transition').count(),0,'a transition veil must not cover settled chapters');
  assert.ok(await page.locator('.temple-journey').evaluate(el=>el.offsetHeight/innerHeight>11.9),'journey must span 1200svh');

  // The portrait is a semantic DOM target projected onto the 3D frame. It
  // centres without hiding either edge, reveals both labels, and restores.
  await scrollToProgress(page,.4);await page.waitForTimeout(500);
  const portrait=page.locator('.portrait-hit');
  const restBox=await portrait.boundingBox();
  assert.ok(restBox&&restBox.width>30&&restBox.height>60,`${viewport.name}: portrait target missing`);
  if(viewport.name==='desktop')await portrait.hover();
  else await portrait.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:7,isPrimary:true});
  await page.waitForFunction(()=>document.querySelector('.temple-journey')?.classList.contains('portrait-active'));
  await page.waitForTimeout(750);
  const activeBox=await portrait.boundingBox();
  assert.ok(activeBox,`${viewport.name}: active portrait target missing`);
  assert.ok(Math.abs(activeBox.x+activeBox.width/2-viewport.width/2)<10,`${viewport.name}: portrait did not centre`);
  assert.ok(activeBox.x>=-1&&activeBox.x+activeBox.width<=viewport.width+1,`${viewport.name}: centred portrait is clipped`);
  assert.ok(activeBox.height/restBox.height>1.06,`${viewport.name}: portrait did not enlarge`);
  assert.ok(+await page.locator('.journey-caption').evaluate(el=>getComputedStyle(el).opacity)<.1,'caption must fade behind active portrait');
  for(const callout of await page.locator('.portrait-callout').all()){
   const box=await callout.boundingBox();
   assert.ok(box&&box.x>=0&&box.x+box.width<=viewport.width,`${viewport.name}: portrait callout is out of bounds`);
   assert.ok(+await callout.evaluate(el=>getComputedStyle(el).opacity)>.9,'portrait callout must be visible');
  }
  if(viewport.name==='desktop')await page.mouse.move(5,5);
  else await page.locator('.temple-stage').dispatchEvent('pointerdown',{pointerType:'touch',pointerId:8,isPrimary:true});
  await page.waitForFunction(()=>!document.querySelector('.temple-journey')?.classList.contains('portrait-active'));
  await portrait.focus();await page.waitForFunction(()=>document.querySelector('.temple-journey')?.classList.contains('portrait-active'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.temple-journey')?.classList.contains('portrait-active'));
  report.push({viewport:viewport.name,...await page.locator('.temple-journey').evaluate(el=>({...el.dataset}))});
  // Reverse and fast scrolling must converge to the requested view.
  await scrollToProgress(page,.2);await scrollToProgress(page,.93);await scrollToProgress(page,.4);
  await page.getByRole('button',{name:'Switch language'}).click();
  assert.ok((await page.locator('.journey-caption').innerText()).includes('மோகன்'));
  await portrait.focus();
  await page.waitForFunction(()=>document.querySelector('.temple-journey')?.classList.contains('portrait-active'));
  assert.deepEqual(await page.locator('.portrait-callout').allTextContents(),['நந்தினி','மோகன்']);
  await page.keyboard.press('Escape');
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
  // The museum is no longer linked from the navbar, but the route still works.
  assert.equal(await page.getByRole('link',{name:'Museum'}).count(),0,'Museum must not appear in the navbar');
  await page.goto(`${base}/modern`,{waitUntil:'networkidle'});await page.waitForSelector('.m-hero');assert.equal(await page.locator('canvas').count(),0);
  await page.screenshot({path:`artifacts/screenshots/${viewport.name}-museum.png`});
  await page.getByRole('link',{name:'Temple',exact:true}).click();await page.waitForSelector('.temple-journey[data-ready="true"]');
  await page.evaluate(()=>{document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
  await page.waitForSelector('.temple-static');assert.equal(await page.locator('.temple-static article').count(),3);
  await page.close();
 }
 // Every caption flickers into Tamil on arrival and settles back into English,
 // without stealing the text from a guest who is hovering it.
 {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(`glimpse: ${e.message}`));
  await page.goto(`${base}/traditional`,{waitUntil:'networkidle'});
  await page.waitForSelector('.temple-journey[data-ready="true"]');
  const caption=page.locator('.journey-caption');
  const heading=page.locator('.journey-caption h1.bilingual');
  const layers=()=>page.evaluate(()=>{const h=document.querySelector('.journey-caption h1.bilingual');return{en:+getComputedStyle(h.querySelector('span')).opacity,ta:+getComputedStyle(h,'::after').opacity};});

  await scrollToProgress(page,.33);
  await page.waitForFunction(()=>document.querySelector('.journey-caption')?.classList.contains('glimpse'),null,{timeout:8000});
  // The keyframes open on English, so wait for the reveal rather than sampling
  // the instant the class lands.
  await page.waitForFunction(()=>{const h=document.querySelector('.journey-caption h1.bilingual');return h&&+getComputedStyle(h,'::after').opacity>.5;},null,{timeout:4000});
  await page.waitForFunction(()=>!document.querySelector('.journey-caption')?.classList.contains('glimpse'),null,{timeout:8000});
  await page.waitForTimeout(250);
  const settled=await layers();
  assert.ok(settled.en>.9&&settled.ta<.1,'the caption must settle back into English');

  // Hovering must survive the glimpse ending, and still work afterwards.
  await scrollToProgress(page,.5);
  await heading.hover();
  await page.waitForFunction(()=>!document.querySelector('.journey-caption')?.classList.contains('glimpse'),null,{timeout:12000});
  await page.waitForTimeout(300);
  const held=await layers();
  assert.ok(held.ta>.9&&held.en<.1,'hover must keep Tamil after the glimpse ends');
  await page.mouse.move(5,5);
  await page.waitForTimeout(500);
  assert.ok((await layers()).en>.9,'moving away must return to English');

  // Nothing to glimpse once the whole page is Tamil.
  await page.getByRole('button',{name:'Switch language'}).click();
  await scrollToProgress(page,.66);
  await page.waitForTimeout(1400);
  assert.equal(await caption.evaluate(el=>el.classList.contains('glimpse')),false,'Tamil mode must not glimpse');
  await page.close();
 }

 // The couple's track. It must not be fetched until a guest asks for sound, it
 // must loop, it must survive switching invitations, and muting must stop it.
 {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(`music: ${e.message}`));
  const fetched=[];
  page.on('request',r=>{if(/assets\/audio\//.test(r.url()))fetched.push(r.url().split('/').pop());});
  await page.addInitScript(()=>{const O=window.Audio;window.Audio=function(...a){const el=new O(...a);window.__audio=el;return el;};});
  const read=()=>page.evaluate(()=>{const a=window.__audio;return a?{paused:a.paused,loop:a.loop,time:a.currentTime,src:(a.currentSrc||'').split('/').pop()}:null;});

  await page.goto(`${base}/wedding`,{waitUntil:'networkidle'});
  assert.equal(fetched.length,0,'audio must not be downloaded before a guest asks for sound');

  await page.getByRole('button',{name:'Play ambience'}).click();
  await page.waitForFunction(()=>window.__audio&&!window.__audio.paused,null,{timeout:15000});
  await page.waitForTimeout(900);
  const playing=await read();
  assert.ok(playing.loop,'the track must loop');
  assert.equal(await page.getByRole('button',{name:'Mute ambience'}).getAttribute('aria-pressed'),'true');
  // Media elements issue ranged GETs, and seeking adds more, so count distinct
  // files rather than requests: only one codec should ever be downloaded.
  assert.equal(new Set(fetched).size,1,'only one audio file should be downloaded');

  // Switching invitations must not restart or silence it.
  await page.getByRole('link',{name:'Temple',exact:true}).click();
  await page.waitForSelector('.temple-journey');
  await page.waitForTimeout(800);
  const afterNav=await read();
  assert.ok(!afterNav.paused,'music must survive a route change');
  assert.ok(afterNav.time>playing.time,'music must keep playing across a route change');
  assert.equal(await page.getByRole('button',{name:'Mute ambience'}).getAttribute('aria-pressed'),'true','the control must still read as unmuted after navigating');

  // It wraps rather than stopping at the end.
  const wrapped=await page.evaluate(async()=>{const a=window.__audio;a.currentTime=a.duration-1.0;const before=a.currentTime;await new Promise(r=>setTimeout(r,2500));return{before,after:a.currentTime,paused:a.paused,ended:a.ended};});
  assert.ok(wrapped.after<wrapped.before&&!wrapped.paused&&!wrapped.ended,'the track must loop back to the start rather than ending');

  await page.getByRole('button',{name:'Mute ambience'}).click();
  await page.waitForFunction(()=>window.__audio&&window.__audio.paused,null,{timeout:8000});
  assert.equal(await page.getByRole('button',{name:'Play ambience'}).getAttribute('aria-pressed'),'false');
  assert.equal(new Set(fetched).size,1,'muting must not pull down a second audio file');
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
 await writeFile('artifacts/temple-validation.json',JSON.stringify({base,report,errors,checks:['seven chapters','reverse/fast scroll','sticky positioning','Tamil','audio toggle','skip/focus','offscreen pause','RSVP','replay','keyboard','resize','museum route reachable but unlisted','route re-entry','context loss','reduced motion','WebGL unavailable','classic /wedding route','classic route uses no WebGL','nav round trip','RSVP delivery on all three routes','RSVP failure surfaces an error','caption glimpses into Tamil and settles back','glimpse yields to hover','music loops, is lazy, and survives navigation','muting stops playback']},null,2));
 console.log(JSON.stringify(report,null,2));console.log('All temple journey browser checks passed.');
}finally{await browser.close();}
