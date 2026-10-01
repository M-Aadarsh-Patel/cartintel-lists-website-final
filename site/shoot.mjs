import { chromium } from 'playwright';
const url = 'http://localhost:4173/';
const runs = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, scheme: 'light' },
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, scheme: 'dark' },
  { name: 'laptop', viewport: { width: 1280, height: 720 }, scheme: 'light' },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, scheme: 'light' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, scheme: 'light', mobile: true },
];
const only = process.argv[2];
const browser = await chromium.launch();
for (const r of runs.filter(r => !only || only.split(',').includes(r.name))) {
  const ctx = await browser.newContext({ viewport: r.viewport, colorScheme: r.scheme, deviceScaleFactor: 1, isMobile: !!r.mobile, hasTouch: !!r.mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', e => errs.push(e.message));
  page.on('requestfailed', q => errs.push('failed: ' + q.url()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `shots/${r.name}-fold.png` });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')].filter(el => { const b = el.getBoundingClientRect(); return b.right > w + 1 && !el.closest('.ledger__scroll') && getComputedStyle(el).position !== 'absolute'; }).slice(0, 8).map(el => el.tagName + '.' + el.className + ' ' + Math.round(el.getBoundingClientRect().right));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `shots/${r.name}-full.png`, fullPage: true });
  console.log(r.name, 'height', h, 'errors', JSON.stringify(errs), 'overflow', JSON.stringify(overflow));
  await ctx.close();
}
await browser.close();
