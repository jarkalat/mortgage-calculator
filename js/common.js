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

// "Source: … · period · retrieved · links" under every table and chart
function sourceLine(src, extra = '') {
  const links = [src.page && link(src.page, 'source page'), src.page_index && link(src.page_index, 'index page'), src.file && link(src.file, 'data file')].filter(Boolean).join(' · ');
  const published = src.published ? ` · published ${dayName(src.published)}` : '';
  const updated = src.updated ? ` · updated ${dayName(src.updated)}` : '';
  return `<b>Source:</b> ${esc(src.name)}${published}${updated} · <b>Period:</b> ${esc(src.period)} · retrieved ${dayName(src.retrieved)} · ${links}${extra}`;
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

// Reopen in the currency chosen last time, once the page's own script has set itself up
document.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = localStorage.getItem(STORE.currency);
    if (saved && saved !== 'USD' && CURRENCIES[saved]) setCurrency(saved, true);
  } catch (e) {}
});
