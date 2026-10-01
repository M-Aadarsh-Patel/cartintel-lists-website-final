// Cartintel: hero checking sequence, grade tabs, list toggle, source link, sample form.
// CSS controls motion intensity; JS sequences the highlights without moving the text.
const CONTACT = 'hello@cartintel.co';

const onScreen = (el, cb, threshold = 0.25) => {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    cb();
  }, { threshold });
  io.observe(el);
};

document.querySelectorAll('[data-inview]').forEach((el) => onScreen(el, () => el.classList.add('is-in'), 0.2));
document.querySelector('.hero').classList.add('is-in');

// Paint the existing inline rectangles, one line at a time. Temporary backgrounds
// preserve cloned padding and wrapping; the original CSS takes over when finished.
let highlightQueue = document.fonts.ready;
function queueHighlight(el) {
  if (el.dataset.highlight !== 'pending') return;
  el.dataset.highlight = 'queued';
  highlightQueue = highlightQueue.then(async () => {
    const box = el.getBoundingClientRect();
    const hidden = el.closest('[aria-hidden="true"]');
    if (hidden || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) {
      el.dataset.highlight = 'pending';
      if (!hidden) onScreen(el, () => queueHighlight(el));
      return;
    }
    const rects = [...el.getClientRects()];
    const layer = document.createElement('span');
    layer.className = 'highlight-layer';
    layer.setAttribute('aria-hidden', 'true');
    el.append(layer);
    const origin = layer.getBoundingClientRect();
    let resized = false;
    const settle = () => {
      resized = true;
      layer.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    };
    window.addEventListener('resize', settle);
    try {
      for (const rect of rects) {
        if (resized) break;
        const stroke = document.createElement('span');
        stroke.className = 'highlight-stroke';
        Object.assign(stroke.style, { left: `${rect.left - origin.left}px`, top: `${rect.top - origin.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px` });
        layer.append(stroke);
        await Promise.all(stroke.getAnimations().map((animation) => animation.finished.catch(() => {})));
        await new Promise(requestAnimationFrame);
      }
    } finally {
      window.removeEventListener('resize', settle);
      el.dataset.highlight = 'done';
      layer.remove();
    }
  });
}
document.querySelectorAll('.mark, mark').forEach((el) => {
  const text = document.createElement('span');
  text.className = 'highlight-text';
  text.append(...el.childNodes);
  el.append(text);
  el.dataset.highlight = 'pending';
  if (!el.closest('.record, .ledger')) onScreen(el, () => queueHighlight(el));
});

// Hero record: a one-time typewriter fill. A caret types each value in turn, a row gets
// its check when its value is done, the grade stamps, then its explanation types.
// Untyped text stays in the DOM as transparent .tw-rest, so nothing reflows while typing.
const card = document.getElementById('record-card');
const rows = [...card.querySelectorAll('.row')];
const CHAR_MS = 8.75;         // per character... (all timings 1.25x = 20% slower)
const FIELD_MS = [100, 250];   // ...clamped per field, so long quotes don't drag
const GAP_MS = 38;            // caret hop between fields
const STAMP_MS = 250;

rows.forEach((r) => {
  if (r.classList.contains('row--grade')) return;
  r.insertAdjacentHTML('beforeend', '<span class="row__ok tick" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span>');
});

// Every tick gets a spark: 8 rays, alternating long and short, drawn outward once its check lands.
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const [r1, r2] = [5.4, i % 2 ? 8.2 : 9.6];
  const f = (n) => n.toFixed(2);
  return `<line pathLength="1" x1="${f(Math.cos(a) * r1)}" y1="${f(Math.sin(a) * r1)}" x2="${f(Math.cos(a) * r2)}" y2="${f(Math.sin(a) * r2)}"/>`;
}).join('');
document.querySelectorAll('.tick').forEach((t) => t.insertAdjacentHTML('beforeend', `<svg class="spark" viewBox="-10 -10 20 20" aria-hidden="true">${RAYS}</svg>`));

// Ticks and crosses inside an in-view section play in document order.
document.querySelectorAll('[data-inview]').forEach((el) => {
  el.querySelectorAll('.tick, .promise__list--no .ico').forEach((m, i) => m.style.setProperty('--k', i));
});

// Split every text node of a typed element into a visible part and a transparent rest.
// Text inside <mark> is split too; highlights wait until the entire record is complete.
function prepare(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes.map((n) => {
    const typed = document.createElement('span');
    const rest = document.createElement('span');
    typed.className = 'tw-typed';
    rest.className = 'tw-rest';
    rest.textContent = n.textContent;
    n.replaceWith(typed, rest);
    return { typed, rest, text: n.textContent };
  });
}

const caret = document.createElement('span');
caret.className = 'caret';
caret.setAttribute('aria-hidden', 'true');
const fields = rows.map((r) => [...r.querySelectorAll('[data-type]')].map(prepare));
card.classList.add('tw-ready');

let typingDone = false;
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function typeField(parts) {
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  const dur = Math.min(FIELD_MS[1], Math.max(FIELD_MS[0], total * CHAR_MS));
  const t0 = performance.now();
  return new Promise((res) => {
    const frame = (now) => {
      if (typingDone) return res();
      let left = Math.min(total, Math.ceil(((now - t0) / dur) * total));
      for (const p of parts) {
        const k = Math.min(p.text.length, left);
        left -= k;
        p.typed.textContent = p.text.slice(0, k);
        p.rest.textContent = p.text.slice(k);
      }
      // The caret sits at the end of the first part that still has text to type.
      const current = parts.find((p) => p.rest.textContent) || parts[parts.length - 1];
      if (caret.previousSibling !== current.typed) current.typed.after(caret);
      if (!parts.some((p) => p.rest.textContent)) res();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// Settle everything to plain text: used at the end, and when a tab is clicked mid-typing.
function finishTyping() {
  if (typingDone) return;
  typingDone = true;
  caret.remove();
  for (const p of fields.flat(2)) {
    p.typed.replaceWith(p.text);
    p.rest.remove();
  }
  card.querySelectorAll('[data-type]').forEach((el) => el.normalize());
  rows.forEach((r) => r.classList.remove('is-done', 'is-stamped'));
  card.classList.remove('is-typing');
  card.classList.add('tw-done');
  card.removeAttribute('aria-busy');
  card.querySelectorAll('mark').forEach((el) => onScreen(el, () => queueHighlight(el)));
}

async function typeRecord() {
  card.classList.add('is-typing');
  card.setAttribute('aria-busy', 'true');
  for (const [i, row] of rows.entries()) {
    if (row.classList.contains('row--grade')) {
      row.classList.add('is-stamped');
      await wait(STAMP_MS);
    }
    for (const parts of fields[i]) {
      if (typingDone) return;
      await typeField(parts);
    }
    row.classList.add('is-done');
    await wait(GAP_MS);
  }
  if (typingDone) return;
  caret.classList.add('is-idle'); // one blink at the end, then go
  await wait(1000);
  finishTyping();
}
onScreen(card, typeRecord, 0.35);

// Grade tabs: same contact, so only the email, grade and explanation cross-fade.
const GRADES = [
  { email: 'lucia@palmettorow.example', grade: 'A', why: 'Published on the business’s Our Team page, next to her name.' },
  { email: 'lbarreto@palmettorow.example', grade: 'Verified', why: 'Not published, but the mailbox was confirmed by an email-verification check.' },
  { email: 'lucia.barreto@palmettorow.example', grade: 'Likely', why: 'The mailbox exists, but could not be firmly confirmed.' },
  { email: 'info@palmettorow.example', grade: 'Business inbox', why: 'No personal address could be confirmed. At small spas, this inbox is usually read by the owner.' },
];
const tabs = [...document.querySelectorAll('.tab')];
const swapEls = Object.fromEntries([...card.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el]));
let swapTimer;

function show(i) {
  finishTyping(); // a click mid-typing jumps to the finished record first
  tabs.forEach((t, j) => {
    t.setAttribute('aria-selected', String(j === i));
    t.tabIndex = j === i ? 0 : -1;
  });
  clearTimeout(swapTimer);
  card.classList.add('is-swapping');
  swapTimer = setTimeout(() => {
    for (const k in swapEls) swapEls[k].textContent = GRADES[i][k];
    card.classList.remove('is-swapping');
  }, 170);
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => show(i));
  t.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tabs.length) % tabs.length;
    tabs[n].focus();
    show(n);
  });
});

// Problem table: "Their list / Your list" flips every "Not given" into its proof.
const ledger = document.querySelector('.ledger');
const note = ledger.querySelector('.ledger__note');
const segBtns = [...ledger.querySelectorAll('.seg button')];
segBtns.forEach((b) => b.addEventListener('click', () => {
  const yours = b.dataset.list === 'yours';
  segBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  ledger.classList.toggle('is-yours', yours);
  ledger.querySelectorAll('.flip__front').forEach((el) => el.setAttribute('aria-hidden', String(yours)));
  ledger.querySelectorAll('.flip__back').forEach((el) => el.setAttribute('aria-hidden', String(!yours)));
  note.textContent = yours ? note.dataset.yours : note.dataset.theirs;
  // Measure only after every face has settled, including the staggered final row.
  if (yours) Promise.all([...ledger.querySelectorAll('.flip__back')]
    .flatMap((el) => el.getAnimations().map((animation) => animation.finished.catch(() => {})))).then(() => {
    if (ledger.classList.contains('is-yours')) ledger.querySelectorAll('mark').forEach((el) => onScreen(el, () => queueHighlight(el)));
  });
}));

// Proof exhibits: pointing at either source links the website quote to the registry title.
const exhibits = document.querySelector('.exhibits');
const [webEx, fileEx] = exhibits.querySelectorAll('.exhibit');
const linkSvg = exhibits.querySelector('.exhibits__link');
const [linkPath, dotA, dotB] = linkSvg.children;

function drawLink() {
  const box = exhibits.getBoundingClientRect();
  const midY = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - box.top; };
  const yA = midY(webEx.querySelector('.mark'));
  const yB = midY(fileEx.querySelector('.mark'));
  const xB = fileEx.offsetLeft;
  const gx = -14;
  linkPath.setAttribute('d', `M0 ${yA}H${gx}V${yB}H${xB}`);
  dotA.setAttribute('cx', 0); dotA.setAttribute('cy', yA);
  dotB.setAttribute('cx', xB); dotB.setAttribute('cy', yB);
  linkSvg.style.setProperty('--len', Math.ceil(linkPath.getTotalLength()));
}
// Measure up front (and on reflow) so the very first hover already has a path to draw.
new ResizeObserver(drawLink).observe(exhibits);
const link = (on) => {
  if (on) drawLink();
  exhibits.classList.toggle('is-linked', on);
};
// Listen on the shared container so crossing the gap between the two cards doesn't unlink.
exhibits.addEventListener('pointerenter', () => link(true));
exhibits.addEventListener('pointerleave', () => { if (!exhibits.contains(document.activeElement)) link(false); });
exhibits.addEventListener('focusin', () => link(true));
exhibits.addEventListener('focusout', (e) => { if (!exhibits.contains(e.relatedTarget)) link(false); });

// Sample form. No backend yet: validates, then opens a pre-filled email.
// ponytail: mailto hand-off, swap for a form endpoint (Formspree, a serverless function) to capture requests without the visitor's mail app.
const form = document.getElementById('sample-form');
const city = form.elements.city;
const otherWrap = document.getElementById('f-other-wrap');
const other = form.elements.other;
const submitBtn = form.querySelector('[type="submit"]');
const submitLabel = submitBtn.querySelector('.btn__label');
const idleLabel = submitLabel.textContent;

city.addEventListener('change', () => {
  const on = city.value.startsWith('other');
  otherWrap.hidden = !on;
  other.required = on;
  if (on) other.focus();
});

function validate(el) {
  const err = document.getElementById(`${el.id}-err`);
  if (!err) return true;
  el.value = el.value.trimStart();
  const ok = el.checkValidity();
  el.setAttribute('aria-invalid', String(!ok));
  err.hidden = ok;
  return ok;
}

form.querySelectorAll('input, select').forEach((el) => {
  el.addEventListener('blur', () => { if (el.getAttribute('aria-invalid')) validate(el); });
  el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validate(el); });
});

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-loading', on);
  submitBtn.setAttribute('aria-busy', String(on));
  submitLabel.textContent = on ? 'Opening your email app…' : idleLabel;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;
  const els = [...form.querySelectorAll('input[required], select[required]')];
  const bad = els.filter((el) => !validate(el));
  if (bad.length) { bad[0].focus(); return; }

  const f = Object.fromEntries(new FormData(form));
  const where = f.city.startsWith('other') ? f.other.trim() : `${f.city}, FL`;
  const body = [
    `Name: ${f.name.trim()}`,
    `Agency: ${f.agency.trim()}`,
    `Email: ${f.email.trim()}`,
    `City I sell into: ${where}`,
    '',
    'Current clients to leave out:',
    f.exclude.trim() || '(none)',
  ].join('\n');

  setLoading(true);
  // Let the loading state paint before the OS switches to the mail app.
  setTimeout(() => {
    location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(`Free 10-record sample: ${where}`)}&body=${encodeURIComponent(body)}`;
  }, 250);
  setTimeout(() => {
    setLoading(false);
    const done = document.getElementById('form-done');
    done.hidden = false;
    done.focus();
  }, 1200);
});
