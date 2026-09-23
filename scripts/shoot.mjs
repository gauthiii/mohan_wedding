/**
 * Quick look at the journey: drives the scroll to each chapter and saves a
 * frame. Used while tuning the scene, and kept because it is the fastest way
 * to see a change without scrubbing by hand.
 *
 *   node scripts/shoot.mjs [baseUrl] [viewport]
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = (process.argv[2] || 'http://127.0.0.1:5174').replace(/\/$/, '');
const which = process.argv[3] || 'desktop';
const viewport = which === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await mkdir('artifacts/shots', { recursive: true });
await page.goto(`${base}/traditional`, { waitUntil: 'networkidle' });
await page.waitForSelector('.temple-journey[data-ready="true"]', { timeout: 45000 });
await page.waitForTimeout(1200);

const points = [
  ['00-approach', 0], ['01-threshold', 0.19], ['02-colonnade', 0.33],
  ['03-portrait', 0.45], ['04-aisle', 0.6], ['05-mandapam', 0.72],
  ['06-ritual', 0.86], ['07-invitation', 0.97],
];

for (const [name, p] of points) {
  await page.evaluate(v => {
    document.documentElement.style.scrollBehavior = 'auto';
    const journey = document.querySelector('.temple-journey');
    window.scrollTo(0, journey.offsetTop + v * (journey.offsetHeight - innerHeight));
  }, p);
  await page.waitForFunction(v => Math.abs(Number(document.querySelector('.temple-journey')?.dataset.progress) - v) < 0.003, p, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `artifacts/shots/${which}-${name}.png` });
  if (which === 'desktop' && name === '03-portrait') {
    await page.locator('.portrait-hit').hover();
    await page.waitForTimeout(750);
    await page.screenshot({ path: 'artifacts/shots/desktop-03-portrait-active.png' });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(750);
  }
}

const stats = await page.locator('.temple-journey').evaluate(el => ({ ...el.dataset }));
console.log(which, JSON.stringify(stats));
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.slice(0, 10).join('\n'));
else console.log('no console errors');
await browser.close();
