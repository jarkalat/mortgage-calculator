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
  { id: 'rent-or-buy', name: 'Rent or buy' },
  { id: 'market', name: 'Housing market' },
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
