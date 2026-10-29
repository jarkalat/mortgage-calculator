// Abodex shared code, loaded on every page before the page's own script:
// language, top navigation bar, number and currency formatting, the currency switch and dark mode.
// Settings are stored under the original "mortgage-*" names so visitors keep their choices.

const $ = id => document.getElementById(id);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const STORE = { currency: 'mortgage-currency', theme: 'mortgage-theme', lang: 'mortgage-lang' };

// ---------- Language ----------
// Every text is in js/lang/en.js and js/lang/cs.js (same keys in both; tests/translations.html checks).
// js/lang-init.js has already picked the language. In the HTML, data-i18n="key" sets an element's text,
// data-i18n-html="key" its text with markup, and data-i18n-attr="title:key; aria-label:key" attributes.
// Switching language fires "langchange" so each page redraws its results.
let lang = document.documentElement.dataset.lang === 'cs' ? 'cs' : 'en';
const t = (key, vars) => {
  let s = I18N[lang][key];
  if (s === undefined) s = I18N.en[key];
  if (s === undefined) return key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
};
// Plural forms: key.one (1), key.few (2–4; Czech "roky"), key.many (the rest; Czech "let")
const tn = (key, n, vars) =>
  t(`${key}.${n === 1 ? 'one' : Number.isInteger(n) && n >= 2 && n <= 4 ? 'few' : 'many'}`, { n, ...vars });

function translatePage() {
  const root = document.documentElement;
  root.lang = lang === 'cs' ? 'cs' : root.dataset.langEn || 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, key] = pair.split(':').map(s => s.trim());
    el.setAttribute(attr, t(key));
  }));
}

function setLang(code) {
  if (code === lang || !I18N[code]) return;
  lang = code;
  document.documentElement.dataset.lang = code;
  try { localStorage.setItem(STORE.lang, code); } catch (e) {}
  // Drop ?lang= from the address, so reloading keeps the language just chosen
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.delete('lang'); history.replaceState(history.state, '', url); }
  translatePage();
  renderNav();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
}

// ---------- Numbers ----------
// English: 4.22%, Czech: 4,22 % (decimal comma, space before %)
const dec = (v, d) => { const s = v.toFixed(d); return lang === 'cs' ? s.replace('.', ',') : s; };
const trimDec = (v, d) => { const s = String(+v.toFixed(d)); return lang === 'cs' ? s.replace('.', ',') : s; };
const pctText = s => s + (lang === 'cs' ? '\u00a0%' : '%');

// ---------- Navigation bar ----------
// Tools without an href show as "coming soon".
const TOOLS = [
  { id: 'mortgage', key: 'nav.mortgage', href: 'mortgage.html' },
  { id: 'buy-to-let', key: 'nav.invest', href: 'invest.html' },
  { id: 'rent-or-buy', key: 'nav.rentBuy', href: 'rent-or-buy.html' },
  { id: 'market', key: 'nav.market', href: 'market.html' },
];
function renderNav() {
  const nav = $('topnav');
  if (!nav) return;
  const page = nav.dataset.page;
  const links = TOOLS.map(tool => tool.href
    ? `<li><a href="${tool.href}"${tool.id === page ? ' aria-current="page"' : ''}>${t(tool.key)}</a></li>`
    : `<li><span class="soon" aria-disabled="true">${t(tool.key)} <span class="badge">${t('nav.soon')}</span></span></li>`).join('');
  const langBtn = code => `<button type="button" data-lang="${code}" lang="${code}" aria-pressed="${code === lang}"`
    + ` aria-label="${t('nav.lang.' + code)}">${code.toUpperCase()}</button>`;
  nav.setAttribute('aria-label', t('nav.label'));
  nav.innerHTML = `<div class="topnav-inner">
    <a class="brand" href="./"${page === 'home' ? ' aria-current="page"' : ''}>Abodex</a>
    <ul class="nav-links">${links}</ul>
    <div class="nav-tools">
      <div class="lang-switch" role="group" aria-label="${t('nav.langGroup')}">${langBtn('cs')}<span aria-hidden="true">|</span>${langBtn('en')}</div>
      <button id="themeToggle" aria-pressed="true">${t('nav.toLight')}</button>
    </div>
  </div>`;
  nav.querySelectorAll('.lang-switch button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $('themeToggle').onclick = () => applyTheme(document.documentElement.hasAttribute('data-theme'));
  themeLabel(!document.documentElement.hasAttribute('data-theme'));
}
translatePage();
renderNav();

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

// Amounts follow the language: "$2,528.27" / "€2,528.27" / "7 233 600 Kč" in English (as before),
// "2 528,27 $" / "2 528,27 €" / "7 233 600 Kč" in Czech.
const money = (v, cents = false) => {
  const c = cfg(), d = cents && c.cents ? 2 : 0;
  if (lang === 'cs') return v.toLocaleString('cs-CZ', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d });
  return v.toLocaleString(c.locale, { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d });
};
// Short axis labels: "$306k" in USD (as before), "5,6 mil. Kč" / "€280K" otherwise.
// Czech rounds the same way: "306 tis. $", "5,6 mil. Kč", "280 tis. €".
const moneyShort = v => {
  if (v < 1000) return money(v);
  if (cur === 'USD') return lang === 'cs' ? Math.round(v / 1000).toLocaleString('cs-CZ') + ' tis. $' : '$' + Math.round(v / 1000) + 'k';
  if (lang === 'cs') return v.toLocaleString('cs-CZ', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 });
  return v.toLocaleString(cfg().locale, { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 });
};

// ---------- Czech market data (data/market.json) ----------
// Used by the market page and the home page. Always Kč, whatever currency is chosen.
// ("percent", not "pct": invest.js has its own pct for fractions.)
const kc = v => v.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
const percent = (v, d = 2) => pctText(dec(v, d));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
// Month names come from the language files: "Aug 2026" / "srpen 2026", "19 Jun 2026" / "19. června 2026"
const months = () => t('date.months').split(','), monthsOf = () => t('date.monthsOf').split(',');
const monthName = ym => { const [y, m] = ym.split('-'); return t('date.month', { m: months()[+m - 1], y }); };
const dayName = iso => { const [y, m, d] = iso.split('-'); return t('date.day', { d: +d, m: monthsOf()[+m - 1], y }); };
const quarterName = q => { const [y, n] = q.split('-'); return t('date.quarter', { n: n.slice(1), y }); };

// The data file's own texts (notes, periods, area names) in the current language. The language files
// hold them under "data.<path>" keys, e.g. "data.rents_mf.note"; source names and links stay as recorded.
function localData(raw) {
  const d = JSON.parse(JSON.stringify(raw));
  Object.keys(I18N.en).filter(k => k.startsWith('data.')).forEach(k => {
    const path = k.split('.').slice(1), last = path.pop();
    const obj = path.reduce((o, p) => (o ? o[p] : undefined), d);
    if (obj && typeof obj[last] === 'string') obj[last] = t(k);
  });
  return d;
}

// "Data last updated": how recent each source's latest figure is. Read from the data itself where it has
// dates (years, months, quarters, rate changes); otherwise the period text exactly as recorded.
function dataFreshness(d) {
  const short = src => src.name.split(' – ')[0];
  const P = d.prices_per_m2, D = d.prague_districts, R = d.rents_deloitte, M = d.rents_mf, RT = d.rates;
  const repoNow = RT.repo.changes[RT.repo.changes.length - 1], mort = RT.mortgage.series[RT.mortgage.series.length - 1];
  const CZ = d.index_prague_vs_rest, EU = d.index_cz_vs_eu;
  return [
    { id: 'prices', what: t('fresh.prices'), source: short(P.source), latest: t('fresh.calendarYear', { y: P.years[P.years.length - 1] }) },
    { id: 'districts', what: t('fresh.districts'), source: short(D.source), latest: D.source.period },
    { id: 'rents', what: t('fresh.rents'), source: short(R.source), latest: R.source.period },
    { id: 'rentmap', what: t('fresh.rentmap'), source: short(M.source), latest: M.source.period },
    { id: 'repo', what: t('fresh.repo'), source: short(RT.repo.source), latest: t('fresh.latestChange', { date: dayName(repoNow.valid_from) }) },
    { id: 'mortgage', what: t('fresh.mortgage'), source: short(RT.mortgage.source), latest: monthName(mort[0]) },
    { id: 'indexCz', what: t('fresh.indexCz'), source: short(CZ.source), latest: quarterName(CZ.quarters[CZ.quarters.length - 1]) },
    { id: 'indexEu', what: t('fresh.indexEu'), source: short(EU.source), latest: quarterName(EU.quarters[EU.quarters.length - 1]) },
  ];
}

// "Source: … · period · retrieved · links" under every table and chart
function sourceLine(src, extra = '') {
  const links = [src.page && link(src.page, t('src.page')), src.page_index && link(src.page_index, t('src.indexPage')), src.file && link(src.file, t('src.file'))].filter(Boolean).join(' · ');
  const published = src.published ? ` · ${t('src.published', { date: dayName(src.published) })}` : '';
  const updated = src.updated ? ` · ${t('src.updated', { date: dayName(src.updated) })}` : '';
  return `<b>${t('src.source')}</b> ${esc(src.name)}${published}${updated} · <b>${t('src.period')}</b> ${esc(src.period)} · ${t('src.retrieved', { date: dayName(src.retrieved) })} · ${links}${extra}`;
}

// ---------- Input checks ----------
// Each tool lists rules like { id, min, max, int, optional, msg, check, skip }. A field that breaks its rule gets a
// short message under it, and the tool's results pause (dimmed, last valid numbers kept) until it is fixed.
// Empty optional fields count as 0, as before. Fields hidden for the current currency are skipped.
// msg is a language-file key; check() returns its message already translated.
function inputProblem(r) {
  const el = $(r.id);
  if ((cfg().eu && el.closest('.us-only')) || (!cfg().eu && el.closest('.eu-only')) || (r.skip && r.skip())) return '';
  const raw = el.value.trim();
  if (el.type === 'month') return raw ? '' : t('check.month');
  if (el.validity.badInput) return t('check.number');
  if (raw === '') return r.optional ? '' : t('check.number');
  const v = Number(raw);
  if (!isFinite(v)) return t('check.number');
  if (v < 0 && (r.min ?? 0) >= 0) return t('check.negative');
  if (r.int && !Number.isInteger(v)) return t('check.whole');
  if ((r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)) return t(r.msg);
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
    results.prepend(note);
  }
  if (note) note.textContent = t('check.paused');
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
  themeLabel(dark);
  try { localStorage.setItem(STORE.theme, dark ? 'dark' : 'light'); } catch (e) {}
  document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}
function themeLabel(dark) {
  $('themeToggle').textContent = dark ? t('nav.toLight') : t('nav.toDark');
  $('themeToggle').setAttribute('aria-pressed', dark);
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
