import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts/screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.type(),m.text());});page.on('pageerror',e=>console.log(e.message));
await page.goto('http://127.0.0.1:5174/traditional');
await page.waitForSelector('.temple-journey[data-ready="true"]',{timeout:30000});
await page.waitForTimeout(1800);
for(const p of [0,.25,.45,.72,.94]){await page.evaluate(p=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,p*(document.querySelector('.temple-journey').offsetHeight-innerHeight));},p);await page.waitForTimeout(1400);await page.screenshot({path:`artifacts/screenshots/temple-${p}.png`});console.log(p,await page.locator('.temple-journey').getAttribute('data-progress'));}
await browser.close();
