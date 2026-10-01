import { chromium } from 'playwright';
const [w,h,scheme,prefix] = [+process.argv[2]||1440, +process.argv[3]||900, process.argv[4]||'light', process.argv[5]||'s'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
const secs = await page.$$('main > section, footer');
let i = 0;
for (const s of secs) {
  await s.scrollIntoViewIfNeeded(); await page.waitForTimeout(1800);
  await s.screenshot({ path: `shots/${prefix}-${i++}.png` });
}
await browser.close();
