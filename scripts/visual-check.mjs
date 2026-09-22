import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];
await mkdir('artifacts/screenshots', { recursive: true });

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  page.on('console', message => { if (message.type() === 'error') errors.push(`${viewport.name}: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
  for (const route of ['traditional', 'modern']) {
    await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += viewport.height * .75) {
      await page.evaluate(nextY => window.scrollTo(0, nextY), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/screenshots/${route}-${viewport.name}.png`, fullPage: true });
  }
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Visual routes rendered without browser console errors.');
