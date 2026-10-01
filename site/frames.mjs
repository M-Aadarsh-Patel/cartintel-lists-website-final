// Captures frames mid-animation so motion can be reviewed as stills.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4173/');
const card = p.locator('.hero__record');
let last = 0;
for (const t of [250, 700, 1300, 1900]) { await p.waitForTimeout(t - last); last = t; await card.screenshot({ path: `shots/hero-${t}.png` }); }
await p.waitForSelector('#record-card.tw-done'); await card.screenshot({ path: 'shots/hero-done.png' });

await p.locator('.ledger').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await p.click('.seg [data-list="yours"]'); await p.waitForTimeout(330);
await p.locator('.ledger').screenshot({ path: 'shots/ledger-mid.png' });
await p.waitForTimeout(1200); await p.locator('.ledger').screenshot({ path: 'shots/ledger-yours.png' });

await p.locator('.cell--proof').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
await p.hover('.exhibit--web'); await p.waitForTimeout(600);
await p.locator('.cell--proof').screenshot({ path: 'shots/link.png' });
await p.mouse.move(5, 5);

await p.evaluate(() => document.querySelector('.stairs').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(420); await p.locator('.grades .wrap').screenshot({ path: 'shots/stairs-mid.png' });

await p.evaluate(() => document.querySelector('#territories').scrollIntoView());
await p.waitForTimeout(2200); await p.locator('#territories').screenshot({ path: 'shots/terr.png' });

await p.fill('#f-name', 'A'); await p.fill('#f-agency', 'B'); await p.fill('#f-email', 'a@b.example'); await p.selectOption('#f-city', 'Miami');
await p.click('#sample-form [type=submit]'); await p.waitForTimeout(150);
await p.locator('#sample-form [type=submit]').screenshot({ path: 'shots/btn-loading.png' });
await b.close();
