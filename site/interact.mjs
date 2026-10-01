// Interaction checks. Run with the site served on :4173 (npm run serve).
import { chromium } from 'playwright';

const b = await chromium.launch();
let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

for (const reducedMotion of ['no-preference', 'reduce']) {
  console.log(`\n# reducedMotion: ${reducedMotion}`);
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/');

  // (8) ordinary headings are visible immediately, no fade-up
  assert(await p.$eval('#problem-title', (e) => getComputedStyle(e).opacity === '1'), 'headings not hidden for a fade-up');

  // (2) one-time typewriter fill
  const h0 = await p.$eval('#record-card', (e) => e.offsetHeight);
  await p.waitForTimeout(300);
  assert(await p.$eval('#record-card', (e) => e.classList.contains('is-typing') && e.getAttribute('aria-busy') === 'true'), 'typing starts, card marked busy');
  assert(await p.$('#record-card .caret') !== null, 'caret present while typing');
  const partial = await p.$eval('#record-card', (e) => [...e.querySelectorAll('.tw-rest')].some((r) => r.textContent));
  assert(partial, 'some text still untyped mid-sequence');
  assert(await p.$eval('#record-card', (e) => e.offsetHeight) === h0, 'no reflow while typing');
  // Typing is ~2.75s plus a 1s final blink; we're already ~0.3s in.
  const done = await p.waitForSelector('#record-card.tw-done', { timeout: 4200 }).then(() => true, () => false);
  assert(done, 'typing + final blink finish within ~4.2s');
  assert(await p.$eval('#record-card', (e) => e.classList.contains('tw-done') && !e.hasAttribute('aria-busy')), 'typing finishes');
  assert(await p.$('#record-card .caret') === null, 'caret removed at the end');
  assert(await p.$('#record-card .tw-rest') === null, 'record restored to plain text');
  assert((await p.textContent('.proof mark')) === 'Owner & Medical Director', 'quote text and highlight intact');
  assert((await p.$$('.row__ok')).length === 8, '8 rows checked (grade row stamps instead)');
  assert(await p.$eval('.row__ok', (e) => getComputedStyle(e).opacity === '1'), 'checks visible at the end');

  // (3) tabs cross-fade only email / grade / explanation
  const bizBefore = await p.textContent('.row dd');
  await p.click('.tab[data-rec="3"]');
  await p.waitForTimeout(400);
  assert((await p.textContent('[data-f="email"]')) === 'info@palmettorow.example', 'tab swaps the email');
  assert((await p.textContent('[data-f="grade"]')) === 'Business inbox', 'tab swaps the grade');
  assert((await p.textContent('.row dd')) === bizBefore, 'business row untouched by tab');
  await p.focus('.tab[data-rec="3"]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  assert((await p.textContent('[data-f="grade"]')) === 'A', 'arrow key wraps to first tab');

  // (4) Their list / Your list
  await p.locator('.ledger').scrollIntoViewIfNeeded();
  await p.click('.seg [data-list="yours"]');
  await p.waitForTimeout(1200);
  assert(await p.$eval('.ledger', (e) => e.classList.contains('is-yours')), 'toggle switches to your list');
  assert(await p.$eval('.flip__back', (e) => e.getAttribute('aria-hidden') === 'false'), 'proof snippets exposed to screen readers');
  assert((await p.textContent('.ledger__note')).startsWith('The same rows'), 'note updates');
  const backVisible = await p.$eval('.flip__back', (e) => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 5, r.top + r.height / 2); return e.contains(hit); });
  assert(backVisible, 'snippet face is on top after flip');
  await p.click('.seg [data-list="theirs"]');
  assert(await p.$eval('.ledger', (e) => !e.classList.contains('is-yours')), 'toggle switches back');

  // (5) source link on hover
  await p.locator('.exhibit--web').scrollIntoViewIfNeeded();
  await p.hover('.exhibit--web');
  await p.waitForTimeout(600);
  assert(await p.$eval('.exhibits', (e) => e.classList.contains('is-linked')), 'hover links the two sources');
  assert(await p.$eval('.exhibits__link path', (e) => (e.getAttribute('d') || '').startsWith('M0')), 'bracket path drawn');
  await p.hover('.exhibit--filing'); // cross the gap: must stay linked
  assert(await p.$eval('.exhibits', (e) => e.classList.contains('is-linked')), 'stays linked moving between sources');
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  assert(await p.$eval('.exhibits', (e) => !e.classList.contains('is-linked')), 'unlinks on leave');

  // (6) grade bars grow in
  await p.locator('.stairs').scrollIntoViewIfNeeded(); await p.waitForTimeout(1600);
  assert(await p.$eval('.step', (e) => getComputedStyle(e).opacity === '1' && ['none', 'inset(0px)'].includes(getComputedStyle(e).clipPath)), 'grade bars fully grown');

  // Ticks draw + spark, crosses stamp in, once their section is on screen
  assert((await p.$$('.tick .spark line')).length === 14 * 8, '14 ticks, 8 spark rays each');
  const promiseHidden = await p.$eval('.promise__grid .tick', (e) => getComputedStyle(e).opacity);
  assert(promiseHidden === '0', 'guarantee ticks wait off-screen');
  await p.locator('.promise__grid').scrollIntoViewIfNeeded(); await p.waitForTimeout(1600);
  const t = await p.$eval('.promise__grid .tick', (e) => ({ op: getComputedStyle(e).opacity, clip: getComputedStyle(e.querySelector('.ico')).clipPath, anim: getComputedStyle(e.querySelector('.spark line')).animationName }));
  assert(t.op === '1' && ['none', 'inset(0px)'].includes(t.clip), 'guarantee tick drawn');
  assert(t.anim === 'spark', `spark played (${t.anim})`);
  const motion = await p.$eval('.promise__grid', (g) => [getComputedStyle(g.querySelector('.tick')).animationName, getComputedStyle(g.querySelector('.promise__list--no .ico')).animationName].join());
  assert(motion === 'tick-pop,x-in', `tick and cross animate in both modes (${motion})`);
  assert(await p.$$eval('.promise__list--no .ico', (els) => els.every((e) => getComputedStyle(e).opacity === '1')), 'crosses settled and visible');
  assert(await p.$$eval('.promise__grid .spark line', (els) => els.every((e) => getComputedStyle(e).opacity === '0')), 'sparks gone after playing');

  // (7) form + loading state
  await p.click('#sample-form button[type=submit]');
  const vis = await p.$$eval('.field__err', (els) => els.filter((e) => !e.hidden).map((e) => e.id));
  assert(vis.join() === 'f-name-err,f-agency-err,f-email-err,f-city-err', 'empty submit shows 4 errors');
  await p.fill('#f-name', 'Ana Ruiz'); await p.fill('#f-agency', 'Tidewater Web');
  await p.fill('#f-email', 'ana@tidewater.example');
  await p.selectOption('#f-city', 'other-us');
  assert(await p.isVisible('#f-other-wrap'), '"Another US city" shows the city field');
  await p.fill('#f-other', 'Austin, TX');
  await p.click('#sample-form button[type=submit]');
  await p.waitForTimeout(80);
  assert(await p.$eval('#sample-form [type=submit]', (e) => e.disabled && e.getAttribute('aria-busy') === 'true'), 'button enters loading state');
  assert((await p.textContent('.btn__label')) === 'Opening your email app…', 'loading label shown');
  await p.waitForTimeout(1300);
  assert(await p.isVisible('#form-done'), 'success panel shown');
  assert(await p.$eval('#sample-form [type=submit]', (e) => !e.disabled), 'button restored');

  // Interrupting: a tab click mid-typing settles the record instead of corrupting it.
  await p.goto('http://localhost:4173/');
  await p.waitForTimeout(500);
  await p.click('.tab[data-rec="1"]');
  await p.waitForTimeout(400);
  assert(await p.$eval('#record-card', (e) => e.classList.contains('tw-done') && !e.querySelector('.caret, .tw-rest')), 'tab click mid-typing finishes cleanly');
  assert((await p.textContent('[data-f="email"]')) === 'lbarreto@palmettorow.example', 'and still swaps the email');
  assert((await p.textContent('.row dd')) === 'Palmetto Row Aesthetics', 'other fields complete');

  assert(errs.length === 0, `no page errors ${errs.join(' | ')}`);
  await p.close();
}
await b.close();
console.log(fails ? `\n${fails} failing` : '\nall passing');
process.exitCode = fails ? 1 : 0;
