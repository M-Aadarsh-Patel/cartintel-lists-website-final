// Motion contact sheet: freezes the tick and cross animations at fixed times, in both
// motion modes, and lays the frames out in shots/sheet-ticks.png. Needs `npm run serve`.
import { chromium } from 'playwright';

const T = [40, 140, 260, 380, 480, 580, 700, 1400];
const timed = 'document.getAnimations().filter((a) => a.timeline instanceof DocumentTimeline)';
const b = await chromium.launch();
const rows = [];

for (const rm of ['no-preference', 'reduce']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, reducedMotion: rm });
  await p.goto('http://localhost:4173/');
  await p.evaluate(() => document.querySelector('.promise__grid').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.waitForFunction(() => document.querySelector('.promise__grid').classList.contains('is-in'));
  await p.evaluate(`${timed}.forEach((a) => a.pause())`);
  const box = (sel, pad) => p.$eval(sel, (e, pad) => {
    const r = e.getBoundingClientRect();
    return { x: r.left - pad, y: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
  }, pad);
  const tick = await box('.promise__grid .tick', 22);
  const cross = await box('.promise__list--no .ico', 14);
  const row = { rm, tick: [], cross: [] };
  for (const t of T) {
    await p.evaluate(`${timed}.forEach((a) => { a.currentTime = ${t}; })`);
    await p.evaluate(() => new Promise(requestAnimationFrame));
    row.tick.push((await p.screenshot({ clip: tick })).toString('base64'));
    row.cross.push((await p.screenshot({ clip: cross })).toString('base64'));
  }
  rows.push(row);
  await p.close();
}

const p = await b.newPage({ viewport: { width: 1100, height: 600 } });
const img = (s) => `<img src="data:image/png;base64,${s}" style="height:70px;margin:4px;border:1px solid #ddd;background:#fff">`;
await p.setContent(`<body style="font:12px monospace;background:#f3f4f1;padding:10px">${rows.map((r) =>
  `<p><b>${r.rm}</b>: tick at ${T.join(', ')}ms</p>${r.tick.map(img).join('')}<p>cross (starts ~570ms)</p>${r.cross.map(img).join('')}`).join('<hr>')}</body>`);
await p.screenshot({ path: 'shots/sheet-ticks.png', fullPage: true });
await b.close();
