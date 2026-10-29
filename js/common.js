// Abodex shared code, loaded on every page before the page's own script:
// top navigation bar, currency formatting, the currency switch and dark mode.
// Settings are stored under the original "mortgage-*" names so visitors keep their choices.

const $ = id => document.getElementById(id);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const STORE = { currency: 'mortgage-currency', theme: 'mortgage-theme' };

// ---------- Navigation bar ----------
// Tools without an href show as "coming soon".
const TOOLS = [
  { id: 'mortgage', name: 'Mortgage calculator', href: 'mortgage.html' },
  { id: 'buy-to-let', name: 'Buy-to-let investor', href: 'invest.html' },
  { id: 'rent-or-buy', name: 'Rent or buy', href: 'rent-or-buy.html' },
  { id: 'market', name: 'Housing market', href: 'market.html' },
];
(function renderNav() {
  const nav = $('topnav');
  if (!nav) return;
  const page = nav.dataset.page;
  const links = TOOLS.map(t => t.href
    ? `<li><a href="${t.href}"${t.id === page ? ' aria-current="page"' : ''}>${t.name}</a></li>`
    : `<li><span class="soon" aria-disabled="true">${t.name} <span class="badge">soon</span></span></li>`).join('');
  nav.innerHTML = `<div class="topnav-inner">
    <a class="brand" href="./"${page === 'home' ? ' aria-current="page"' : ''}>Abodex</a>
    <ul class="nav-links">${links}</ul>
    <button id="themeToggle" aria-pressed="true">☀ Light mode</button>
  </div>`;
})();

// ---------- Currencies ----------
// USD keeps the original US rules. CZK and EUR (eu: true) use European rules:
// no PMI, property tax as a fixed yearly amount, "Repair fund" instead of HOA,
// and a warning when the loan is above 80% of the price.
const CURRENCIES = {
  USD: { locale: 'en-US', symbol: '$', after: false, cents: true, eu: false },
  CZK: { locale: 'cs-CZ', symbol: 'Kč', after: true, cents: false, eu: true },
  EUR: { locale: 'en-IE', symbol: '€', after: false, cents: true, eu: true },
};
let cur = 'USD';
const cfg = () => CURRENCIES[cur];

const money = (v, cents = false) => {
  const c = cfg(), d = cents && c.cents ? 2 : 0;
  return v.toLocaleString(c.locale, { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d });
};
// Short axis labels: "$306k" in USD (as before), "5,6 mil. Kč" / "€280K" otherwise
const moneyShort = v => {
  if (v < 1000) return money(v);
  if (cur === 'USD') return '$' + Math.round(v / 1000) + 'k';
  return v.toLocaleString(cfg().locale, { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 });
};

// ---------- Czech market data (data/market.json) ----------
// Used by the market page and the home page. Always Kč, whatever currency is chosen.
// ("percent", not "pct": invest.js has its own pct for fractions.)
const kc = v => v.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
const percent = (v, d = 2) => v.toFixed(d) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const dayName = iso => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
const quarterName = q => { const [y, n] = q.split('-'); return `${n} ${y}`; };

// "Data last updated": how recent each source's latest figure is. Read from the data itself where it has
// dates (years, months, quarters, rate changes); otherwise the period text exactly as recorded.
function dataFreshness(d) {
  const short = src => src.name.split(' – ')[0];
  const P = d.prices_per_m2, D = d.prague_districts, R = d.rents_deloitte, M = d.rents_mf, RT = d.rates;
  const repoNow = RT.repo.changes[RT.repo.changes.length - 1], mort = RT.mortgage.series[RT.mortgage.series.length - 1];
  const CZ = d.index_prague_vs_rest, EU = d.index_cz_vs_eu;
  return [
    { id: 'prices', what: 'Flat prices per m²', source: short(P.source), latest: `${P.years[P.years.length - 1]} (calendar year)` },
    { id: 'districts', what: 'Prague district prices', source: short(D.source), latest: D.source.period },
    { id: 'rents', what: 'Asking rents', source: short(R.source), latest: R.source.period },
    { id: 'rentmap', what: 'Rent map (2+kk)', source: short(M.source), latest: M.source.period },
    { id: 'repo', what: 'Repo rate', source: short(RT.repo.source), latest: `latest change ${dayName(repoNow.valid_from)}` },
    { id: 'mortgage', what: 'New-mortgage rates', source: short(RT.mortgage.source), latest: monthName(mort[0]) },
    { id: 'indexCz', what: 'Price index, Prague vs rest', source: short(CZ.source), latest: quarterName(CZ.quarters[CZ.quarters.length - 1]) },
    { id: 'indexEu', what: 'Price index, Czechia vs EU', source: short(EU.source), latest: quarterName(EU.quarters[EU.quarters.length - 1]) },
  ];
}

// "Source: … · period · retrieved · links" under every table and chart
function sourceLine(src, extra = '') {
  const links = [src.page && link(src.page, 'source page'), src.page_index && link(src.page_index, 'index page'), src.file && link(src.file, 'data file')].filter(Boolean).join(' · ');
  const published = src.published ? ` · published ${dayName(src.published)}` : '';
  const updated = src.updated ? ` · updated ${dayName(src.updated)}` : '';
  return `<b>Source:</b> ${esc(src.name)}${published}${updated} · <b>Period:</b> ${esc(src.period)} · retrieved ${dayName(src.retrieved)} · ${links}${extra}`;
}

// ---------- Input checks ----------
// Each tool lists rules like { id, min, max, int, optional, msg, check, skip }. A field that breaks its rule gets a
// short message under it, and the tool's results pause (dimmed, last valid numbers kept) until it is fixed.
// Empty optional fields count as 0, as before. Fields hidden for the current currency are skipped.
function inputProblem(r) {
  const el = $(r.id);
  if ((cfg().eu && el.closest('.us-only')) || (!cfg().eu && el.closest('.eu-only')) || (r.skip && r.skip())) return '';
  const raw = el.value.trim();
  if (el.type === 'month') return raw ? '' : 'Please choose a month.';
  if (el.validity.badInput) return 'Please enter a number.';
  if (raw === '') return r.optional ? '' : 'Please enter a number.';
  const v = Number(raw);
  if (!isFinite(v)) return 'Please enter a number.';
  if (v < 0 && (r.min ?? 0) >= 0) return 'This can’t be negative.';
  if (r.int && !Number.isInteger(v)) return 'Please use a whole number.';
  if ((r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)) return r.msg;
  return (r.check && r.check(v)) || '';
}

function showProblem(el, msg) {
  const errId = el.id + 'Error';
  let err = $(errId);
  if (!msg) {
    if (err) err.remove();
    el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
    return;
  }
  if (!err) {
    // Under the input box; under the whole row when boxes sit side by side (down payment $ and %)
    let after = el.closest('.unit') || el;
    if (after.parentElement.classList.contains('row')) after = after.parentElement;
    while (after.nextElementSibling && after.nextElementSibling.classList.contains('field-error')) after = after.nextElementSibling;
    err = document.createElement('div');
    err.className = 'field-error'; err.id = errId; err.setAttribute('aria-live', 'polite');
    after.after(err);
  }
  err.textContent = msg;
  el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', errId);
  const box = el.closest('details');
  if (box) box.open = true;   // never hide a field that needs fixing
}

// results: the results column (gets the "paused" note); also: other result boxes to dim (optional)
function checkInputs(rules, results, also = []) {
  let ok = true;
  rules.forEach(r => { const msg = inputProblem(r); showProblem($(r.id), msg); if (msg) ok = false; });
  let note = results.querySelector(':scope > .paused-note');
  if (!ok && !note) {
    note = document.createElement('p');
    note.className = 'warn strong paused-note'; note.setAttribute('role', 'status');
    note.textContent = 'Results are paused until the highlighted field is fixed. The numbers below are from your last valid entry.';
    results.prepend(note);
  }
  if (ok && note) note.remove();
  [results, ...also].forEach(el => el.classList.toggle(el === results ? 'paused' : 'paused-item', !ok));
  return ok;
}

// ---------- Currency switch ----------
// Updates everything shared, saves the choice, then tells the page through a
// "currencychange" event (detail.fill = load that currency's starting numbers).
function setCurrency(code, fill) {
  cur = code;
  const c = cfg();
  document.documentElement.dataset.cur = code;
  document.querySelectorAll('.currency button').forEach(b => {
    b.classList.toggle('active', b.dataset.cur === code);
    b.setAttribute('aria-pressed', b.dataset.cur === code);
  });
  // Symbol in input boxes: "$" / "€" before the number, "Kč" after it
  document.querySelectorAll('.unit.money').forEach(u => {
    u.querySelector('span').textContent = c.symbol;
    u.classList.toggle('pre', !c.after);
    u.classList.toggle('post', c.after);
  });
  try { localStorage.setItem(STORE.currency, code); } catch (e) {}
  document.dispatchEvent(new CustomEvent('currencychange', { detail: { code, fill } }));
}
document.querySelectorAll('.currency button').forEach(b =>
  b.addEventListener('click', () => { if (b.dataset.cur !== cur) setCurrency(b.dataset.cur, true); }));

// ---------- Dark mode toggle ----------
// Dark (navy) is the default. js/theme-init.js applies a saved light theme before
// the page appears; this keeps the button in step and saves changes.
function applyTheme(dark) {
  // Cross-fade the colours for a moment (skipped with "reduce motion")
  const root = document.documentElement;
  if (!reduceMotion()) {
    root.classList.add('theme-switching');
    clearTimeout(applyTheme.timer);
    applyTheme.timer = setTimeout(() => root.classList.remove('theme-switching'), 300);
  }
  if (dark) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', 'light');
  $('themeToggle').textContent = dark ? '☀ Light mode' : '🌙 Dark mode';
  $('themeToggle').setAttribute('aria-pressed', dark);
  try { localStorage.setItem(STORE.theme, dark ? 'dark' : 'light'); } catch (e) {}
  document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}
$('themeToggle').onclick = () => applyTheme(document.documentElement.hasAttribute('data-theme'));
if (document.documentElement.getAttribute('data-theme') === 'light') {
  $('themeToggle').textContent = '🌙 Dark mode';
  $('themeToggle').setAttribute('aria-pressed', false);
}

// ---------- Motion ----------
// Everything that moves is switched off when the system's "reduce motion" setting is on.
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Run fn(el) once, the first time el scrolls into view
function onceVisible(el, fn) {
  if (!('IntersectionObserver' in window)) return fn(el);
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  io.observe(el);
}

// Sections fade in gently as they scroll into view. Only sections still below the screen are
// hidden first, so nothing already visible flickers, and without JavaScript everything just shows.
// Pages that show content later (the market page) call this again once it is on screen.
function revealSections() {
  if (reduceMotion() || !('IntersectionObserver' in window)) return;
  document.querySelectorAll('main > *, main > .stack > *, .block').forEach(el => {
    if (el.classList.contains('stack') || el.querySelector('.block')) return;  // fade the parts, not their wrapper
    if (el.classList.contains('reveal') || el.hidden) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.classList.add('reveal');
    onceVisible(el, s => s.classList.add('in'));
  });
}
document.addEventListener('DOMContentLoaded', revealSections);

// Charts are drawn on canvases with the page font; redraw them (they listen for "themechange")
// once Inter has loaded, so a first draw in the fallback font doesn't stay on screen.
if (document.fonts && document.fonts.load) {
  document.fonts.load('12px Inter').then(() => document.dispatchEvent(new CustomEvent('themechange',
    { detail: { dark: !document.documentElement.hasAttribute('data-theme') } }))).catch(() => {});
}

// Reopen in the currency chosen last time, once the page's own script has set itself up
document.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = localStorage.getItem(STORE.currency);
    if (saved && saved !== 'USD' && CURRENCIES[saved]) setCurrency(saved, true);
  } catch (e) {}
});
