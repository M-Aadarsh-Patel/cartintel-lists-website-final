// Real playback: never seek animations to make a timing assertion pass.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
try {
  for (const { name, viewport, reducedMotion, colorScheme } of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' },
    { name: 'desktop-reduced-dark', viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark' },
    { name: 'mobile', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', colorScheme: 'light' },
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion, colorScheme });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.highlightEvents = [];
      for (const type of ['animationstart', 'animationend']) document.addEventListener(type, (event) => {
        if (event.animationName !== 'highlight-sweep') return;
        const mark = event.target.closest('.mark, mark');
        const entry = { type, text: mark.textContent, time: performance.now(), widths: [],
          recordDone: document.querySelector('#record-card').classList.contains('tw-done') };
        window.highlightEvents.push(entry);
        if (type === 'animationstart') {
          const geometry = JSON.stringify([...mark.getClientRects()].map((r) => [r.width, r.height]));
          entry.initialGeometry = geometry;
          entry.geometryStable = true;
          const sample = () => {
            if (!event.target.isConnected) return;
            const css = getComputedStyle(event.target);
            entry.widths.push(parseFloat(css.backgroundSize));
            entry.finalGeometry = JSON.stringify([...mark.getClientRects()].map((r) => [r.width, r.height]));
            entry.geometryStable &&= geometry === entry.finalGeometry;
            entry.leftAnchored = css.backgroundPosition.startsWith('0px ');
            if (entry.widths.at(-1) < 100) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }
      });
    });
    await page.goto('http://localhost:4173/');
    await page.waitForFunction(() => document.querySelector('h1 .mark').dataset.highlight === 'done');
    await page.locator('#record-card').scrollIntoViewIfNeeded();
    await page.waitForSelector('#record-card.tw-done');
    await page.waitForFunction(() => document.querySelector('.proof mark').dataset.highlight === 'done');
    await page.locator('.ledger').scrollIntoViewIfNeeded();
    await page.click('.seg [data-list="yours"]');
    for (const highlight of await page.$$('.ledger mark, .exhibits .mark, #pricing .mark')) {
      await highlight.scrollIntoViewIfNeeded();
      await page.waitForFunction((el) => el.dataset.highlight === 'done', highlight);
    }
    const events = await page.evaluate(() => window.highlightEvents);
    const starts = events.filter((event) => event.type === 'animationstart');
    assert.equal(starts[0]?.text, 'its proof.', `${name}: headline animates on load`);
    const record = starts.filter((event) => event.text === 'Owner & Medical Director');
    assert.equal(record.length, await page.$eval('.proof mark', (el) => el.getClientRects().length), `${name}: each wrapped record line gets its own stroke`);
    assert(record.every((event) => event.recordDone), `${reducedMotion}: record strokes wait for ALL typing`);
    let drawing = false;
    for (const event of events) {
      if (event.type === 'animationstart') { assert(!drawing, 'strokes never overlap'); drawing = true; }
      else drawing = false;
    }
    assert(!drawing, 'last stroke completes');
    assert.equal(new Set(starts.map((event) => event.text)).size, 9, 'all nine text highlights play');
    for (const event of starts) {
      assert(event.widths.some((width) => width > 2 && width < 98), `${event.text}: visibly draws intermediate widths`);
      assert(event.widths.every((width, i) => !i || width >= event.widths[i - 1]), `${event.text}: only grows left to right`);
      assert(event.geometryStable && event.leftAnchored, `${event.text}: geometry ${event.initialGeometry} → ${event.finalGeometry}, left anchored: ${event.leftAnchored}`);
    }
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(`ok ${name}: ${starts.length} strokes, all 9 highlights, correct order, real intermediate frames, no layout changes`);
    await page.close();
  }
} finally { await browser.close(); }
