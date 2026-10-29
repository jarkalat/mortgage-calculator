// Abodex mortgage calculator. Uses the shared helpers in js/common.js:
// $, css, cur, cfg(), money(), moneyShort(), setCurrency() and the currencychange/themechange events.
const num = id => Math.max(0, parseFloat($(id).value) || 0);

// Per-currency starting numbers and arrow step sizes for this calculator's inputs
const MORTGAGE_SETTINGS = {
  USD: {
    steps: { price: 1000, downAmt: 1000, extraMonthly: 50, ins: 50, hoa: 10, extraYearly: 500, lump: 1000, income: 1000, debts: 50 },
    defaults: { price: 400000, rate: 6.5, tax: 1.1, ins: 1500, pmi: 0.5, hoa: 0, income: 120000, debts: 400 } },
  CZK: {
    steps: { price: 100000, downAmt: 100000, extraMonthly: 1000, taxAmt: 500, ins: 500, hoa: 100, extraYearly: 10000, lump: 50000, income: 10000, debts: 1000 },
    defaults: { price: 7000000, rate: 4.8, taxAmt: 3000, ins: 4000, hoa: 1500, income: 1200000, debts: 5000 } },
  EUR: {
    steps: { price: 5000, downAmt: 5000, extraMonthly: 50, taxAmt: 50, ins: 50, hoa: 10, extraYearly: 500, lump: 1000, income: 1000, debts: 50 },
    defaults: { price: 350000, rate: 3.5, taxAmt: 800, ins: 500, hoa: 100, income: 60000, debts: 300 } },
};
const mset = () => MORTGAGE_SETTINGS[cur];

// Default start month = next month
(() => {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  $('start').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ---------- Core math ----------
// monthlyPI() lives in js/finance.js, shared with the other tools.

// Walks the loan month by month, applying any extra payments to principal.
// Optional reset = { month, rate }: after that many payments the rate changes and the
// bank recalculates the payment so the loan still ends on the original date.
function amortize(principal, annualRate, months, payment, extras, homePrice, pmiRate, reset = null) {
  let r = annualRate / 100 / 12;
  const rows = [];
  let balance = principal, totalInterest = 0, totalPMI = 0;
  for (let m = 1; m <= months && balance > 0.005; m++) {
    if (reset && m === reset.month + 1) {
      r = reset.rate / 100 / 12;
      payment = monthlyPI(balance, reset.rate, months - reset.month);
    }
    const interest = balance * r;
    let princ = Math.min(payment - interest, balance);
    let extra = 0;
    if (extras) {
      extra = extras.monthly + (m % 12 === 0 ? extras.yearly : 0) + (m === extras.lumpMonth ? extras.lump : 0);
      extra = Math.min(extra, balance - princ);
    }
    balance -= princ + extra;
    // PMI stops with the payment that brings the balance to 80% of the original home price
    const pmi = balance > homePrice * 0.8 ? principal * pmiRate / 100 / 12 : 0;
    totalInterest += interest;
    totalPMI += pmi;
    rows.push({ m, interest, princ, extra, pmi, balance: Math.max(balance, 0), cumInterest: totalInterest });
  }
  return { rows, totalInterest, totalPMI };
}

// ---------- Down payment $ <-> % sync ----------
let lastDownEdited = 'pct';
$('downAmt').addEventListener('input', () => { lastDownEdited = 'amt'; syncDown(); calc(); });
$('downPct').addEventListener('input', () => { lastDownEdited = 'pct'; syncDown(); calc(); });
$('price').addEventListener('input', () => { syncDown(); calc(); });
// Only a valid entry is copied to the other box, so a mistake shows its message in one place and
// what you typed stays as you typed it.
function syncDown() {
  const price = num('price');
  if (inputProblem(rule('price'))) return;
  if (lastDownEdited === 'pct') {
    if (!inputProblem(rule('downPct'))) $('downAmt').value = Math.round(price * num('downPct') / 100);
  } else if (!inputProblem(rule('downAmt'))) {
    $('downPct').value = +(num('downAmt') / price * 100).toFixed(2);
  }
}

// ---------- Input checks (js/common.js): results wait until every field makes sense ----------
const PCT = 'Use a percentage between 0% and 100%.', RATE = 'Use a rate between 0% and 30%.';
const RULES = [
  { id: 'price', check: v => v > 0 ? '' : 'Enter a price above 0.' },
  { id: 'downAmt', check: v => !inputProblem(rule('price')) && v > num('price') ? 'The down payment can’t be more than the price.' : '' },
  { id: 'downPct', max: 100, msg: PCT },
  { id: 'rate', max: 30, msg: RATE },
  { id: 'start' },
  { id: 'extraMonthly', optional: true },
  { id: 'tax', max: 100, msg: PCT }, { id: 'taxAmt' }, { id: 'ins' }, { id: 'pmi', max: 100, msg: PCT }, { id: 'hoa' },
  { id: 'extraYearly', optional: true }, { id: 'lump', optional: true },
  { id: 'lumpMonth', optional: true, int: true, min: 1, msg: 'Use a payment number of 1 or more.',
    check: v => v > parseInt($('term').value, 10) * 12 ? `The loan has only ${parseInt($('term').value, 10) * 12} payments.` : '' },
  { id: 'income', optional: true }, { id: 'debts', optional: true },
  // While it follows "current rate + 2%" by itself, only your own value is checked
  { id: 'resetRate', optional: true, max: 30, msg: RATE, skip: () => resetRateAuto },
];
const rule = id => RULES.find(r => r.id === id);

// ---------- Main calculation ----------
let state = null, view = 'year';

function calc() {
  if (!checkInputs(RULES, document.querySelector('main > .stack'), [$('affordOut')])) return;
  const price = num('price');
  const down = Math.min(num('downAmt'), price);
  const loan = price - down;
  const rate = num('rate');
  const months = parseInt($('term').value, 10) * 12;
  const downPct = price ? down / price * 100 : 0;
  const eu = cfg().eu;
  const pmiRate = !eu && downPct < 20 ? num('pmi') : 0;   // no PMI in Europe

  const pi = loan > 0 ? monthlyPI(loan, rate, months) : 0;
  // US: property tax is a % of the price; Europe: a fixed yearly amount
  const tax = eu ? num('taxAmt') / 12 : price * num('tax') / 100 / 12;
  const ins = num('ins') / 12;
  const pmi = loan * pmiRate / 100 / 12;
  const hoa = num('hoa');
  const total = pi + tax + ins + pmi + hoa;

  const extras = {
    monthly: num('extraMonthly'), yearly: num('extraYearly'),
    lump: num('lump'), lumpMonth: Math.round(num('lumpMonth')) || 1
  };
  const hasExtras = extras.monthly + extras.yearly + extras.lump > 0;

  const base = amortize(loan, rate, months, pi, null, price, pmiRate);
  const withExtra = hasExtras ? amortize(loan, rate, months, pi, extras, price, pmiRate) : base;

  state = { price, loan, rate, months, pi, tax, ins, pmi, hoa, total, base, withExtra, hasExtras, extras, pmiRate };

  // KPIs
  $('kMonthly').textContent = money(total);
  $('kLoan').textContent = money(loan);
  $('kInterest').textContent = money(withExtra.totalInterest);
  $('kPayoff').textContent = payoffLabel(withExtra.rows.length);

  // Breakdown legend + donut
  const parts = [
    ['Principal & interest', pi, '--principal'],
    ['Property tax', tax, '--tax'],
    ['Home insurance', ins, '--insurance'],
    ['PMI', pmi, '--pmi'],
    [eu ? 'Repair fund' : 'HOA', hoa, '--hoa'],
  ].filter(p => p[1] > 0);

  // Loan-to-value warning (Europe): the Czech National Bank normally caps loans at 80%
  const ltv = price ? loan / price * 100 : 0, warn = $('ltvWarn');
  warn.hidden = !(eu && ltv > 80 + 1e-9);
  if (!warn.hidden) {
    const pct = `<b>Loan is ${ltv.toFixed(1)}% of the price.</b> `;
    warn.classList.toggle('strong', ltv > 90 + 1e-9);
    warn.innerHTML = ltv > 90 + 1e-9
      ? pct + (cur === 'CZK'
        ? 'That is above even the 90% limit the Czech National Bank allows for buyers under 36, so Czech banks normally won’t lend this much.'
        : 'That is above even the 90% limit the Czech National Bank allows for buyers under 36; most European lenders won’t go this high.')
      : pct + (cur === 'CZK'
        ? 'The Czech National Bank normally caps mortgages at 80% of the home value (90% for buyers under 36).'
        : 'Many European regulators cap mortgages at 80% (the Czech National Bank: 80%, or 90% for buyers under 36).');
  }
  $('legend').innerHTML = parts.map(([n, v, c]) =>
    `<div><i style="background:var(${c})"></i>${n}<b>${money(v, true)}</b></div>`).join('') +
    `<div>Total per month<b>${money(total, true)}</b></div>`;
  drawDonut(parts);

  // Extra payment effect: compare the loan with and without the extras
  const saved = base.totalInterest - withExtra.totalInterest;
  // Show the panel if the extras save interest OR shorten the loan (at 0% they only shorten it)
  const effective = hasExtras && loan > 0 && (saved > 0.5 || withExtra.rows.length < base.rows.length);
  $('overCard').hidden = !effective;
  let summary = '';
  if (effective) {
    const nNew = withExtra.rows.length, nBase = base.rows.length;
    $('oTime').textContent = duration(nNew);
    $('oTimeSub').textContent = `instead of ${duration(nBase)} · paid off ${payoffLabel(nNew)}`;
    $('oIntBase').textContent = money(base.totalInterest);
    $('oIntExtra').textContent = money(withExtra.totalInterest);
    $('oSaved').textContent = money(saved);
    $('oSavedSub').textContent = `and ${duration(nBase - nNew)} sooner`;
  } else if (loan > 0) {
    summary = `Over the full term you'll pay <b>${money(loan + base.totalInterest)}</b> in principal and interest — <b>${money(base.totalInterest)}</b> of that is interest.`;
    if (hasExtras) summary += ` <br>Your extra payments have no effect — the lump sum falls after the loan is already paid off.`;
  }
  // PMI doesn't last forever — say when it ends and what it costs in total
  const pmiMonths = withExtra.rows.filter(r => r.pmi > 0).length;
  if (pmiMonths) summary += `<br>PMI ends after <b>${pmiMonths}</b> payments (${payoffLabel(pmiMonths)}), costing <b>${money(withExtra.totalPMI)}</b> in total.`;
  $('savings').innerHTML = summary.replace(/^<br>/, '');

  affordability();
  stressTest();
  drawChart();
  renderTable();
}

// Number of monthly payments → "23 yr 11 mo"
function duration(n) {
  const y = Math.floor(n / 12), m = n % 12;
  return [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' ') || '0 mo';
}

function payoffLabel(n) {
  if (!n) return '–';
  let [y, m] = $('start').value.split('-').map(Number);
  if (!y) { const now = new Date(); y = now.getFullYear(); m = now.getMonth() + 2; } // empty → next month
  const d = new Date(y, m - 1 + n - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ---------- Rate fixation stress test ----------
// The expected rate follows "current rate + 2%" until the user types their own value.
let resetRateAuto = true;
const pctLabel = v => +v.toFixed(2) + '%';
const signed = (v, cents) => Math.abs(v) < 0.005 ? money(0, cents) : (v > 0 ? '+' : '−') + money(Math.abs(v), cents);
const upDown = v => v > 0.005 ? 'up' : v < -0.005 ? 'down' : '';

function stressTest() {
  const { loan, rate, months, pi, price, withExtra, hasExtras, extras, pmiRate } = state;
  if (resetRateAuto) $('resetRate').value = +(rate + 2).toFixed(2);
  $('resetRateHint').textContent = resetRateAuto
    ? 'Starts at your current rate + 2%'
    : 'Your own value — clear the box to go back to current rate + 2%';
  const fix = parseInt($('fixYears').value, 10) * 12;
  const newRate = num('resetRate');
  state.fixMonth = null;

  $('stressCard').hidden = !(loan > 0);
  if (!(loan > 0)) return;
  // Edge cases: no reset happens
  let msg = '';
  if (fix >= months) msg = 'The rate is fixed for the whole loan, so there is no reset.';
  else if (withExtra.rows.length <= fix) msg = `Your loan is paid off after ${duration(withExtra.rows.length)}, before the fixation ends, so there is no reset.`;
  $('stressMsg').hidden = !msg; $('stressMsg').textContent = msg;
  $('stressBody').hidden = !!msg;
  if (msg) return;

  state.fixMonth = fix;
  const balance = withExtra.rows[fix - 1].balance;
  // Same loan, same extras — only the rate changes after the fixation ends
  const scenario = r => {
    const run = amortize(loan, rate, months, pi, hasExtras ? extras : null, price, pmiRate, { month: fix, rate: r });
    return { payment: monthlyPI(balance, r, months - fix), interestChange: run.totalInterest - withExtra.totalInterest };
  };

  const s = scenario(newRate), diff = s.payment - pi;
  $('sBalance').textContent = money(balance);
  $('sBalanceSub').textContent = `after ${fix / 12} yr (${payoffLabel(fix)})${hasExtras ? ', including your extra payments' : ''}`;
  $('sPayNow').textContent = money(pi, true);
  $('sPayAfterLabel').textContent = `After reset (${pctLabel(newRate)})`;
  $('sPayAfter').textContent = money(s.payment, true);
  $('sPayDiff').textContent = signed(diff, true);
  $('sPayDiff').className = upDown(diff);
  $('sInt').textContent = signed(s.interestChange);
  $('sInt').className = 'value ' + upDown(s.interestChange);
  $('sIntSub').textContent = `${money(withExtra.totalInterest)} → ${money(withExtra.totalInterest + s.interestChange)}`;

  $('stressRows').innerHTML = [1, 2, 3].map(step => {
    const r = rate + step, x = scenario(r), d = x.payment - pi;
    const chosen = Math.abs(r - newRate) < 0.001 ? ' class="chosen"' : '';
    return `<tr${chosen}><td>${pctLabel(r)} (+${step}%)</td><td>${money(x.payment, true)}</td>
      <td class="${upDown(d)}">${signed(d, true)}</td><td class="${upDown(x.interestChange)}">${signed(x.interestChange)}</td></tr>`;
  }).join('');
}

// ---------- Affordability (28/36 rule) ----------
function affordability() {
  const monthlyIncome = num('income') / 12;
  if (!monthlyIncome) { $('affordOut').innerHTML = ''; return; }
  const front = state.total / monthlyIncome * 100;
  const back = (state.total + num('debts')) / monthlyIncome * 100;
  const maxHousing = Math.min(monthlyIncome * 0.28, monthlyIncome * 0.36 - num('debts'));
  const ok = front <= 28 && back <= 36;
  $('affordOut').innerHTML = `
    Housing cost is <b>${front.toFixed(1)}%</b> of income (guideline ≤ 28%)<br>
    All debts are <b>${back.toFixed(1)}%</b> of income (guideline ≤ 36%)<br>
    Suggested max housing payment: <span class="big">${money(Math.max(maxHousing, 0))}</span>/mo<br>
    <span style="color:${ok ? 'var(--tax)' : 'var(--pmi)'}">${ok ? '✓ Within common lender guidelines' : '⚠ Above common lender guidelines'}</span>`;
}

// ---------- Donut chart ----------
function drawDonut(parts) {
  const c = $('donut'), dpr = window.devicePixelRatio || 1;
  c.width = 180 * dpr; c.height = 180 * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const sum = parts.reduce((s, p) => s + p[1], 0);
  let a = -Math.PI / 2;
  ctx.lineWidth = 26;
  if (!sum) { ctx.strokeStyle = css('--border'); ctx.beginPath(); ctx.arc(90, 90, 70, 0, Math.PI * 2); ctx.stroke(); return; }
  parts.forEach(([, v, col]) => {
    const sweep = v / sum * Math.PI * 2;
    ctx.strokeStyle = css(col);
    ctx.beginPath(); ctx.arc(90, 90, 70, a, a + sweep); ctx.stroke();
    a += sweep;
  });
  ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
  ctx.font = '700 20px ' + css('--font'); ctx.fillText(money(sum), 90, 94);
  ctx.fillStyle = css('--muted'); ctx.font = '13px ' + css('--font'); ctx.fillText('per month', 90, 112);
}

// ---------- Balance line chart ----------
function drawChart() {
  const c = $('chart'), dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = 260;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const pad = { l: 64, r: 24, t: 10, b: 28 };
  const { base, withExtra, loan, months, hasExtras } = state;
  const rows = withExtra.rows;
  if (!rows.length) return;

  const maxY = Math.max(loan, withExtra.totalInterest, base.totalInterest) || 1;
  const x = m => pad.l + (m / months) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);

  // grid + labels
  ctx.strokeStyle = css('--border'); ctx.fillStyle = css('--muted');
  ctx.font = '12px ' + css('--font'); ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = maxY * i / 4, yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(moneyShort(v), pad.l - 8, yy + 4);
  }
  const years = months / 12, step = years > 20 ? 5 : years > 10 ? 2 : 1;
  ctx.textAlign = 'center';
  for (let yr = 0; yr <= years; yr += step) ctx.fillText('Yr ' + yr, x(yr * 12), H - 8);

  const line = (data, key, color, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x(0), y(key === 'balance' ? loan : 0));
    data.forEach(r => ctx.lineTo(x(r.m), y(r[key])));
    ctx.stroke(); ctx.setLineDash([]);
  };
  const effective = hasExtras && rows.length < base.rows.length;
  const plotTop = pad.t, plotBottom = H - pad.b;
  if (effective) {
    // Shade the stretch of time the extra payments cut off the loan
    const x0 = x(rows.length), x1 = x(base.rows.length);
    ctx.fillStyle = css('--accent-soft');
    ctx.fillRect(x0, plotTop, x1 - x0, plotBottom - plotTop);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    if (x1 - x0 > 70) ctx.fillText(duration(base.rows.length - rows.length) + ' sooner', (x0 + x1) / 2, plotTop + 16);
    line(base.rows, 'balance', css('--muted'), [5, 4]);
  }
  line(rows, 'balance', css('--principal'));
  line(rows, 'cumInterest', css('--interest'));
  if (effective) {
    // Payoff markers: original finish (hollow) and new, earlier finish (filled)
    const dot = (m, color, filled) => {
      ctx.beginPath(); ctx.arc(x(m), y(0), 5, 0, Math.PI * 2);
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.fillStyle = filled ? color : css('--card');
      ctx.fill(); ctx.stroke();
    };
    dot(base.rows.length, css('--muted'), false);
    dot(rows.length, css('--principal'), true);
    // Label on a small card-coloured box so chart lines don't run through it
    const label = 'Paid off: ' + duration(rows.length);
    ctx.font = '700 13px ' + css('--font'); ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width, lx = x(rows.length);
    const bx = Math.min(Math.max(lx - tw / 2 - 6, pad.l), W - pad.r - tw - 12), by = y(0) - 34;
    ctx.fillStyle = css('--card'); ctx.strokeStyle = css('--principal'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, tw + 12, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css('--text'); ctx.fillText(label, bx + 6, by + 14);
  }
  $('baselineKey').hidden = !effective;

  // Fixation end (from the stress test): dashed vertical line with a label
  const fix = state.fixMonth;
  $('fixKey').hidden = !fix;
  if (fix) {
    const fx = x(fix);
    ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(fx, plotTop); ctx.lineTo(fx, plotBottom); ctx.stroke(); ctx.setLineDash([]);
    const label = `Fixation ends · yr ${fix / 12}`;
    ctx.font = '700 12px ' + css('--font'); ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width;
    const bx = fx + tw + 18 > W - pad.r ? fx - tw - 18 : fx + 6, by = plotTop + 2;
    ctx.fillStyle = css('--card'); ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, tw + 12, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css('--text'); ctx.fillText(label, bx + 6, by + 13);
  }
}

// ---------- Amortization table ----------
function groupedRows() {
  const rows = state.withExtra.rows;
  if (view === 'month') return rows.map(r => ({ label: `${r.m} · ${payoffLabel(r.m)}`, ...r, paid: r.princ + r.interest + r.extra }));
  const out = [];
  rows.forEach(r => {
    const i = Math.floor((r.m - 1) / 12);
    out[i] = out[i] || { label: 'Year ' + (i + 1), princ: 0, interest: 0, extra: 0, paid: 0 };
    out[i].princ += r.princ; out[i].interest += r.interest; out[i].extra += r.extra;
    out[i].paid += r.princ + r.interest + r.extra; out[i].balance = r.balance;
  });
  return out;
}
function renderTable() {
  $('periodHead').textContent = view === 'year' ? 'Year' : 'Payment';
  $('tbody').innerHTML = groupedRows().map(r =>
    `<tr><td>${r.label}</td><td>${money(r.princ, true)}</td><td>${money(r.interest, true)}</td>
     <td>${money(r.extra, true)}</td><td>${money(r.paid, true)}</td><td>${money(r.balance, true)}</td></tr>`).join('');
}
$('tabYear').onclick = () => { view = 'year'; $('tabYear').classList.add('active'); $('tabMonth').classList.remove('active'); renderTable(); };
$('tabMonth').onclick = () => { view = 'month'; $('tabMonth').classList.add('active'); $('tabYear').classList.remove('active'); renderTable(); };

$('csv').onclick = () => {
  const lines = [];
  if (!cfg().eu) {
    lines.push('Payment,Date,Principal,Interest,Extra,PMI,Balance');
    state.withExtra.rows.forEach(r => lines.push([r.m, payoffLabel(r.m), r.princ.toFixed(2), r.interest.toFixed(2), r.extra.toFixed(2), r.pmi.toFixed(2), r.balance.toFixed(2)].join(',')));
  } else {
    // Europe: no PMI column; amounts labelled with the currency
    lines.push(`Payment,Date,Principal (${cur}),Interest (${cur}),Extra (${cur}),Balance (${cur})`);
    state.withExtra.rows.forEach(r => lines.push([r.m, payoffLabel(r.m), r.princ.toFixed(2), r.interest.toFixed(2), r.extra.toFixed(2), r.balance.toFixed(2)].join(',')));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'amortization-schedule.csv'; a.click();
};

// Reset button: restore every input to its starting value for the current currency
// (page-load values, with the currency's own starting numbers on top)
const defaults = {};
document.querySelectorAll('input, select').forEach(el => defaults[el.id] = el.value);
function applyDefaults() {
  for (const id in defaults) $(id).value = defaults[id];
  for (const [id, v] of Object.entries(mset().defaults)) $(id).value = v;
  lastDownEdited = 'pct';
  resetRateAuto = true;
  syncDown();
  calc();
}
$('reset').onclick = applyDefaults;

// ---------- Currency switch ----------
// js/common.js handles the buttons, symbols and saving; this sets up the calculator's own parts.
document.addEventListener('currencychange', e => {
  for (const [id, step] of Object.entries(mset().steps)) $(id).step = step;
  $('hoaLabel').textContent = cfg().eu ? 'Repair fund / month' : 'HOA / month';
  if (e.detail.fill) applyDefaults(); else calc();
});

// Typing your own expected rate stops it following "current rate + 2%"; clearing the box resumes it.
// (Registered before the general recalc listener below, so it runs first.)
$('resetRate').addEventListener('input', () => { resetRateAuto = $('resetRate').value.trim() === ''; });

// Recalculate on any other input change
document.querySelectorAll('input, select').forEach(el => {
  if (!['downAmt', 'downPct', 'price'].includes(el.id)) el.addEventListener('input', calc);
});
window.addEventListener('resize', () => state && drawChart());

// ---------- Dark mode ----------
// Charts are drawn on canvas, so redraw them in the new colours
document.addEventListener('themechange', () => { if (state) calc(); });

syncDown();
calc();
// (js/common.js reopens the currency chosen last time once this script has run.)
