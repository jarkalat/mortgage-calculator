// Abodex buy-to-let investor. Uses js/common.js ($, cur, cfg(), money(), the currency switch
// and dark mode) and js/finance.js (monthlyPI, balanceAfter).
const num = id => Math.max(0, parseFloat($(id).value) || 0);
const numSigned = id => parseFloat($(id).value) || 0;   // growth rates may be negative

// Per-currency starting numbers and arrow step sizes
const INVEST_SETTINGS = {
  USD: {
    steps: { price: 5000, fees: 500, reno: 1000, furn: 1000, rent: 50, hoa: 10, ins: 50 },
    defaults: { price: 350000, fees: 8000, reno: 10000, furn: 0, loanPct: 75, rate: 7, term: '30', rent: 2600, vacancy: 0.5,
      hoa: 150, taxPct: 1.1, ins: 1800, maint: 8, mgmt: 0, rentGrowth: 3, priceGrowth: 3.5 } },
  CZK: {   // a Prague 2+kk
    steps: { price: 100000, fees: 10000, reno: 10000, furn: 10000, rent: 500, hoa: 100, taxAmt: 100, ins: 500 },
    defaults: { price: 6500000, fees: 60000, reno: 100000, furn: 120000, loanPct: 80, rate: 4.8, term: '30', rent: 22000, vacancy: 0.5,
      hoa: 2000, taxAmt: 2000, ins: 3000, maint: 5, mgmt: 0, rentGrowth: 3, priceGrowth: 4 } },
  EUR: {
    steps: { price: 5000, fees: 1000, reno: 1000, furn: 500, rent: 50, hoa: 10, taxAmt: 50, ins: 50 },
    defaults: { price: 300000, fees: 20000, reno: 10000, furn: 8000, loanPct: 80, rate: 3.5, term: '30', rent: 1300, vacancy: 0.5,
      hoa: 80, taxAmt: 600, ins: 400, maint: 5, mgmt: 0, rentGrowth: 2.5, priceGrowth: 3 } },
};
const iset = () => INVEST_SETTINGS[cur];
const LEVERAGE = [0, 50, 70, 80];

// Formatting: signed money and percentages, with a proper minus sign
const signed = (v, cents) => Math.abs(v) < 0.005 ? money(0, cents) : (v > 0 ? '+' : '−') + money(Math.abs(v), cents);
const pct = v => v === null || !isFinite(v) ? 'n/a' : (v < -0.000005 ? '−' : '') + Math.abs(v * 100).toFixed(2) + '%';
const tone = v => v > 0.005 ? 'good' : v < -0.005 ? 'bad' : '';   // green when you gain, red when you pay

// ---------- The model ----------
// Everything for one loan size; `loanPct` lets the leverage table reuse it.
function model(i, loanPct) {
  const loan = i.price * loanPct / 100;
  const cashIn = i.price - loan + i.buying;
  const payment = loan > 0 ? monthlyPI(loan, i.rate, i.months) : 0;
  const cashFlowYear = i.noi - 12 * payment;
  return { loan, cashIn, payment, cashFlowYear, coc: cashIn > 0 ? cashFlowYear / cashIn : null };
}

function inputs() {
  const eu = cfg().eu, price = num('price');
  const i = {
    price, buying: num('fees') + num('reno') + num('furn'),
    loanPct: Math.min(num('loanPct'), 100), rate: num('rate'), months: parseInt($('term').value, 10) * 12,
    rent: num('rent'), vacancy: Math.min(num('vacancy'), 12),
    varPct: (num('maint') + num('mgmt')) / 100,
    rentGrowth: numSigned('rentGrowth') / 100, priceGrowth: numSigned('priceGrowth') / 100,
  };
  // Fixed yearly costs: repair fund / HOA, property tax (US: % of price, Europe: fixed amount), insurance
  i.fixed = num('hoa') * 12 + (eu ? num('taxAmt') : price * num('taxPct') / 100) + num('ins');
  i.collected = i.rent * (12 - i.vacancy);                       // rent actually received in year 1
  i.running = i.fixed + i.varPct * i.collected;                  // all running costs in year 1
  i.noi = i.collected - i.running;                               // income before the mortgage
  return i;
}

// Input checks (js/common.js): results wait until every field makes sense
const PCT = 'Use a percentage between 0% and 100%.', GROWTH = 'Use a yearly change between −50% and +50%.';
const RULES = [
  { id: 'price', check: v => v > 0 ? '' : 'Enter a price above 0.' },
  { id: 'fees' }, { id: 'reno' }, { id: 'furn' },
  { id: 'loanPct', max: 100, msg: PCT },
  { id: 'rate', max: 30, msg: 'Use a rate between 0% and 30%.' },
  { id: 'rent' },
  { id: 'vacancy', max: 12, msg: 'A year has at most 12 months.' },
  { id: 'hoa' }, { id: 'taxPct', max: 100, msg: PCT }, { id: 'taxAmt' }, { id: 'ins' },
  { id: 'maint', max: 100, msg: PCT }, { id: 'mgmt', optional: true, max: 100, msg: PCT },
  { id: 'rentGrowth', min: -50, max: 50, msg: GROWTH }, { id: 'priceGrowth', min: -50, max: 50, msg: GROWTH },
];

function calc() {
  if (!checkInputs(RULES, document.querySelector('main > .stack'))) return;
  const i = inputs(), m = model(i, i.loanPct);

  // Headline results
  $('rCashFlow').textContent = signed(m.cashFlowYear / 12, true);
  $('rCashFlow').className = 'value ' + tone(m.cashFlowYear);
  $('rGross').textContent = pct(i.price > 0 ? i.rent * 12 / i.price : null);
  $('rNet').textContent = pct(i.price + i.buying > 0 ? i.noi / (i.price + i.buying) : null);
  $('rCash').textContent = money(m.cashIn);
  $('rCoc').textContent = pct(m.coc);
  $('rCoc').className = 'value ' + (m.coc === null ? '' : tone(m.coc));

  // Break-even rent: rent × (12 − vacancy) × (1 − variable %) = fixed costs + mortgage
  const denom = (12 - i.vacancy) * (1 - i.varPct);
  if (denom > 0) {
    const be = (i.fixed + 12 * m.payment) / denom, gap = i.rent - be;
    $('rBreakEven').textContent = money(be, true);
    $('rBreakEvenGap').textContent = Math.abs(gap) < 0.005 ? 'Your rent is exactly at break-even.'
      : `Your rent is ${money(Math.abs(gap), true)} ${gap > 0 ? 'above' : 'below'} it.`;
  } else {
    $('rBreakEven').textContent = 'n/a';
    $('rBreakEvenGap').textContent = i.vacancy >= 12
      ? 'Not possible: with the flat empty all year, no rent covers the costs.'
      : 'Not possible: maintenance and management take all of the rent.';
  }

  // Loan-to-value warning (Europe): the Czech National Bank normally caps loans at 80%
  const warn = $('ltvWarn');
  warn.hidden = !(cfg().eu && i.loanPct > 80 + 1e-9);
  if (!warn.hidden) warn.innerHTML = `<b>Loan is ${+i.loanPct.toFixed(1)}% of the price.</b> ` + (cur === 'CZK'
    ? 'The Czech National Bank normally caps mortgages at 80% of the property value (90% for buyers under 36).'
    : 'Many European regulators cap mortgages at 80% (the Czech National Bank: 80%, or 90% for buyers under 36).');

  // Leverage table: same flat, same rate and term, different loan sizes
  $('leverageRows').innerHTML = LEVERAGE.map(p => {
    const x = model(i, p), chosen = Math.abs(i.loanPct - p) < 1e-9 ? ' class="chosen"' : '';
    return `<tr${chosen}><td>${p}%</td><td>${money(x.loan)}</td><td>${money(x.cashIn)}</td><td>${money(x.payment, true)}</td>
      <td class="${tone(x.cashFlowYear)}">${signed(x.cashFlowYear / 12, true)}</td><td class="${x.coc === null ? '' : tone(x.coc)}">${pct(x.coc)}</td></tr>`;
  }).join('');

  // 10-year projection: rent and running costs grow with rent growth, value with price growth
  const loan = i.price * i.loanPct / 100;
  let cumCashFlow = 0;
  const rows = [];
  for (let y = 1; y <= 10; y++) {
    const g = Math.pow(1 + i.rentGrowth, y - 1);
    const collected = i.collected * g, running = i.fixed * g + i.varPct * collected;
    cumCashFlow += collected - running - 12 * m.payment;
    const value = i.price * Math.pow(1 + i.priceGrowth, y);
    const left = loan > 0 ? balanceAfter(loan, i.rate, i.months, 12 * y) : 0;
    const equity = value - left, total = equity + cumCashFlow - m.cashIn;
    rows.push(`<tr><td>${y}</td><td>${money(value)}</td><td>${money(left)}</td><td>${money(equity)}</td>
      <td class="${tone(cumCashFlow)}">${signed(cumCashFlow)}</td><td class="${tone(total)}">${signed(total)}</td>
      <td>${pct(m.cashIn > 0 ? total / m.cashIn : null)}</td></tr>`);
  }
  $('projectionRows').innerHTML = rows.join('');
}

// ---------- Reset and currency ----------
// Reset restores the page-load values with the current currency's starting numbers on top
const defaults = {};
document.querySelectorAll('main input, main select').forEach(el => defaults[el.id] = el.value);
function applyDefaults() {
  for (const id in defaults) $(id).value = defaults[id];
  for (const [id, v] of Object.entries(iset().defaults)) $(id).value = v;
  calc();
}
$('reset').onclick = applyDefaults;

document.addEventListener('currencychange', e => {
  for (const [id, step] of Object.entries(iset().steps)) $(id).step = step;
  $('hoaLabel').textContent = cfg().eu ? 'Repair fund / month' : 'HOA / month';
  if (e.detail.fill) applyDefaults(); else calc();
});

document.querySelectorAll('main input, main select').forEach(el => el.addEventListener('input', calc));

calc();
// (js/common.js reopens the currency chosen last time once this script has run.)

// Starting values from the Housing market page: invest.html?from=market&price=…&rent=… (Czech data, so CZK).
// Registered after common.js's listener, so it runs after the saved currency is restored.
document.addEventListener('DOMContentLoaded', () => {
  const q = new URLSearchParams(location.search);
  const price = Math.round(parseFloat(q.get('price'))), rent = Math.round(parseFloat(q.get('rent')));
  if (q.get('from') !== 'market' || !(price > 0) || !(rent > 0)) return;
  setCurrency('CZK', true);                 // CZK with its usual starting numbers…
  $('price').value = price; $('rent').value = rent;   // …then the two values from the market page
  calc();
  const note = document.createElement('p');
  note.className = 'hint';
  note.id = 'fromMarket';
  note.textContent = `Starting point from the Housing market page: price ${money(price)} and rent ${money(rent)} a month (Prague averages × flat size). Everything else uses the usual CZK starting numbers.`;
  document.querySelector('header > div').appendChild(note);
});
