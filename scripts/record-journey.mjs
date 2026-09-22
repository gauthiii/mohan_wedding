import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base=(process.argv[2]||process.env.PREVIEW_URL||'http://127.0.0.1:5174').replace(/\/$/,'');
await mkdir('artifacts/walkthrough-frames',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto(`${base}/traditional`,{waitUntil:'networkidle'});await page.waitForSelector('.temple-journey[data-ready="true"]');
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
 for(let i=0;i<150;i++){
  const p=Math.max(0,Math.min(.98,(i-12)/125));
  await page.evaluate(p=>window.scrollTo(0,p*(document.querySelector('.temple-journey').offsetHeight-innerHeight)),p);
  await page.waitForTimeout(60);
  await page.screenshot({path:`artifacts/walkthrough-frames/${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:85});
 }
}finally{await browser.close();}
execFileSync('ffmpeg',['-y','-framerate','15','-i','artifacts/walkthrough-frames/%04d.jpg','-c:v','libx264','-pix_fmt','yuv420p','-crf','21','-movflags','+faststart','artifacts/temple-walkthrough.mp4'],{stdio:'ignore'});
console.log('Recorded artifacts/temple-walkthrough.mp4');
