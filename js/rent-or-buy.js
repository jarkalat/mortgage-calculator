// Abodex rent or buy. Uses js/common.js ($, css, cur, cfg(), money(), moneyShort(), currency switch,
// dark mode) and js/finance.js (monthlyPI).
const num = id => Math.max(0, parseFloat($(id).value) || 0);
const numSigned = id => parseFloat($(id).value) || 0;   // growth rates may be negative

// Per-currency starting numbers and arrow step sizes
const RB_SETTINGS = {
  USD: {
    steps: { price: 5000, buying: 1000, hoa: 10, ins: 50, rent: 50 },
    defaults: { price: 400000, buying: 10000, downPct: 20, rate: 6.5, term: '30', hoa: 150, taxPct: 1.1, ins: 1500, maint: 1,
      rent: 2200, rentGrowth: 3, priceGrowth: 3.5, ret: 7, sell: 6, years: 10 } },
  CZK: {   // a Prague 2+kk
    steps: { price: 100000, buying: 10000, hoa: 100, taxAmt: 100, ins: 500, rent: 500 },
    defaults: { price: 6500000, buying: 60000, downPct: 20, rate: 4.8, term: '30', hoa: 2000, taxAmt: 2000, ins: 3000, maint: 0.5,
      rent: 22000, rentGrowth: 3, priceGrowth: 4, ret: 6, sell: 3, years: 10 } },
  EUR: {
    steps: { price: 5000, buying: 1000, hoa: 10, taxAmt: 50, ins: 50, rent: 50 },
    defaults: { price: 350000, buying: 25000, downPct: 20, rate: 3.5, term: '30', hoa: 100, taxAmt: 800, ins: 500, maint: 0.5,
      rent: 1300, rentGrowth: 2.5, priceGrowth: 3, ret: 6, sell: 3, years: 10 } },
};
const rset = () => RB_SETTINGS[cur];
const GROWTH_SCENARIOS = [0, 2, 4, 6];

const signed = v => Math.abs(v) < 0.5 ? money(0) : (v > 0 ? '+' : '−') + money(Math.abs(v));
const tone = v => v > 0.5 ? 'good' : v < -0.5 ? 'bad' : '';
// "about 850 000 Kč": round large amounts to the nearest thousand for the verdict
const about = v => money(Math.abs(v) >= 10000 ? Math.round(Math.abs(v) / 1000) * 1000 : Math.abs(v));

function inputs() {
  return {
    eu: cfg().eu, price: num('price'), buying: num('buying'), down: Math.min(num('downPct'), 100) / 100,
    rate: num('rate'), termMonths: parseInt($('term').value, 10) * 12,
    hoa: num('hoa'), taxPct: num('taxPct') / 100, taxAmt: num('taxAmt'), ins: num('ins'), maint: num('maint') / 100,
    rent: num('rent'), rentGrowth: numSigned('rentGrowth') / 100, priceGrowth: numSigned('priceGrowth') / 100,
    ret: numSigned('ret') / 100, sell: num('sell') / 100,
    years: Math.min(30, Math.max(1, Math.round(num('years')) || 1)),
  };
}

// ---------- The model ----------
// Month by month: the buyer pays the mortgage + ownership costs, the renter pays rent, and whoever pays
// less invests the difference. Rent and ownership costs are fixed within a year and step up each year.
// Investments grow monthly at the rate that compounds to the yearly return.
function simulate(i, priceGrowth = i.priceGrowth) {
  const loan = i.price * (1 - i.down);
  const r = i.rate / 100 / 12, payment = loan > 0 ? monthlyPI(loan, i.rate, i.termMonths) : 0;
  const im = Math.pow(1 + i.ret, 1 / 12) - 1;
  let balance = loan, buyerInv = 0, renterInv = i.price * i.down + i.buying;
  const rows = [{ year: 0, buyerPays: 0, rent: 0, equity: i.price * i.down - i.sell * i.price, buyerInv: 0, renterInv }];
  rows[0].buyerNW = rows[0].equity; rows[0].renterNW = renterInv;
  for (let y = 1; y <= i.years; y++) {
    const startValue = i.price * Math.pow(1 + priceGrowth, y - 1), g = Math.pow(1 + i.rentGrowth, y - 1);
    const rent = i.rent * g;
    const owner = i.hoa * g + (i.eu ? i.taxAmt * g : startValue * i.taxPct) / 12 + i.ins * g / 12 + startValue * i.maint / 12;
    let paidThisYear = 0;
    for (let m = 1; m <= 12; m++) {
      let mortgage = 0;
      if (balance > 0.005) {
        const interest = balance * r, principal = Math.min(payment - interest, balance);
        mortgage = interest + principal; balance -= principal;
      }
      const diff = mortgage + owner - rent;          // > 0: buying costs more this month, so the renter invests
      buyerInv = buyerInv * (1 + im) + (diff < 0 ? -diff : 0);
      renterInv = renterInv * (1 + im) + (diff > 0 ? diff : 0);
      paidThisYear += mortgage + owner;
    }
    const value = i.price * Math.pow(1 + priceGrowth, y);
    const equity = value - Math.max(balance, 0) - i.sell * value;
    rows.push({ year: y, buyerPays: paidThisYear / 12, rent, equity, buyerInv, renterInv, buyerNW: equity + buyerInv, renterNW: renterInv });
  }
  // Break-even: the first year from which the buyer is ahead and stays ahead to the end
  let breakEven = null;
  for (let y = i.years; y >= 1 && rows[y].buyerNW - rows[y].renterNW > 0; y--) breakEven = y;
  return { rows, breakEven, end: rows[i.years] };
}

// ---------- Rendering ----------
let last = null;

function calc() {
  const i = inputs(), s = simulate(i), e = s.end, diff = e.buyerNW - e.renterNW, yrs = i.years === 1 ? '1 year' : `${i.years} years`;
  last = { i, s };

  $('resultsTitle').textContent = `After ${yrs}`;
  $('rBuyer').textContent = money(e.buyerNW);
  $('rRenter').textContent = money(e.renterNW);
  $('rDiff').textContent = signed(diff);
  $('rDiff').className = 'value ' + tone(diff);
  $('rBreakEven').textContent = s.breakEven ? `Year ${s.breakEven}` : 'Renting wins';

  // Verdict in plain English
  const first = s.rows[1], payMore = first.buyerPays - first.rent;
  const start = Math.abs(payMore) < 0.5 ? 'In the first year buying and renting cost the same each month.'
    : `In the first year the buyer pays ${money(first.buyerPays)} a month against ${money(first.rent)} rent, so the ${payMore > 0 ? 'renter' : 'buyer'} invests the ${money(Math.abs(payMore))} difference.`;
  let verdict;
  if (s.breakEven) {
    verdict = `Over ${yrs}, buying leaves you about ${about(diff)} better off than renting and investing the difference. `
      + (s.breakEven === 1 ? 'Buying is ahead from the first year and stays ahead.' : `Buying pulls ahead in year ${s.breakEven} and stays ahead.`);
  } else if (Math.abs(diff) < 0.5) {
    verdict = `Over ${yrs}, buying and renting come out even.`;
  } else {
    verdict = `Over ${yrs}, renting and investing the difference leaves you about ${about(diff)} better off than buying — renting wins over this period. `
      + 'Buying would need more years, cheaper borrowing or faster price growth to catch up.';
  }
  $('verdict').textContent = verdict + ' ' + start;

  // Price growth table: everything as entered except price growth; closest row(s) in bold
  const nearest = Math.min(...GROWTH_SCENARIOS.map(g => Math.abs(g - i.priceGrowth * 100)));
  $('growthRows').innerHTML = GROWTH_SCENARIOS.map(g => {
    const x = simulate(i, g / 100).end, d = x.buyerNW - x.renterNW;
    const chosen = Math.abs(Math.abs(g - i.priceGrowth * 100) - nearest) < 1e-9 ? ' class="chosen"' : '';
    return `<tr${chosen}><td>${g}%</td><td>${money(x.buyerNW)}</td><td>${money(x.renterNW)}</td><td class="${tone(d)}">${signed(d)}</td></tr>`;
  }).join('');

  // Yearly table
  $('yearRows').innerHTML = s.rows.map(r => {
    const d = r.buyerNW - r.renterNW;
    return `<tr${r.year === 0 ? ' class="start"' : ''}><td>${r.year}</td><td>${r.year ? money(r.buyerPays) : '–'}</td><td>${r.year ? money(r.rent) : '–'}</td>
      <td>${money(r.equity)}</td><td>${money(r.buyerInv)}</td><td>${money(r.buyerNW)}</td><td>${money(r.renterNW)}</td><td class="${tone(d)}">${signed(d)}</td></tr>`;
  }).join('');

  // Loan-to-value warning (Europe): the Czech National Bank normally caps loans at 80%
  const ltv = (1 - i.down) * 100, warn = $('ltvWarn');
  warn.hidden = !(i.eu && ltv > 80 + 1e-9);
  if (!warn.hidden) warn.innerHTML = `<b>Loan is ${+ltv.toFixed(1)}% of the price.</b> ` + (cur === 'CZK'
    ? 'The Czech National Bank normally caps mortgages at 80% of the home value (90% for buyers under 36).'
    : 'Many European regulators cap mortgages at 80% (the Czech National Bank: 80%, or 90% for buyers under 36).');

  drawChart();
}

// ---------- Chart: both net worths, year 0 to N, with the break-even year marked ----------
function drawChart() {
  if (!last) return;
  const { s, i } = last, c = $('chart'), dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = 280;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const pad = { l: 72, r: 16, t: 14, b: 28 };
  const vals = s.rows.flatMap(r => [r.buyerNW, r.renterNW]);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals);
  if (hi - lo < 1) hi = lo + 1;
  const x = yr => pad.l + (yr / i.years) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  ctx.font = '12px ' + css('--font'); ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, yy = y(v);
    ctx.strokeStyle = css('--border'); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    ctx.fillText((v < 0 ? '−' : '') + moneyShort(Math.abs(v)), pad.l - 8, yy + 4);
  }
  const step = i.years > 20 ? 5 : i.years > 10 ? 2 : 1;
  ctx.textAlign = 'center';
  for (let yr = 0; yr <= i.years; yr += step) ctx.fillText('Yr ' + yr, x(yr), H - 8);

  if (s.breakEven) {   // shade the years where buying stays ahead
    ctx.fillStyle = css('--accent-soft');
    ctx.fillRect(x(s.breakEven), pad.t, x(i.years) - x(s.breakEven), H - pad.t - pad.b);
    ctx.strokeStyle = css('--accent'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x(s.breakEven), pad.t); ctx.lineTo(x(s.breakEven), H - pad.b); ctx.stroke(); ctx.setLineDash([]);
  }
  const line = (key, color) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); s.rows.forEach((r, k) => k ? ctx.lineTo(x(r.year), y(r[key])) : ctx.moveTo(x(r.year), y(r[key]))); ctx.stroke();
    if (i.years <= 15) s.rows.forEach(r => { ctx.beginPath(); ctx.arc(x(r.year), y(r[key]), 3, 0, Math.PI * 2); ctx.fill(); });
  };
  line('renterNW', css('--interest'));
  line('buyerNW', css('--principal'));
  if (s.breakEven) {
    const label = `Buying ahead from yr ${s.breakEven}`;
    ctx.font = '700 12px ' + css('--font'); ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width, bx0 = x(s.breakEven);
    const bx = bx0 + tw + 18 > W - pad.r ? bx0 - tw - 18 : bx0 + 6, by = pad.t + 2;
    ctx.fillStyle = css('--card'); ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, tw + 12, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css('--text'); ctx.fillText(label, bx + 6, by + 13);
  }
  $('beKey').hidden = !s.breakEven;
}

// ---------- Reset, currency, theme ----------
const defaults = {};
document.querySelectorAll('main input, main select').forEach(el => defaults[el.id] = el.value);
function applyDefaults() {
  for (const id in defaults) $(id).value = defaults[id];
  for (const [id, v] of Object.entries(rset().defaults)) $(id).value = v;
  calc();
}
$('reset').onclick = applyDefaults;

document.addEventListener('currencychange', e => {
  for (const [id, step] of Object.entries(rset().steps)) $(id).step = step;
  const eu = cfg().eu;
  $('hoaLabel').textContent = eu ? 'Repair fund / month' : 'HOA / month';
  $('hoaHint').textContent = eu ? 'The monthly payment into the building’s repair fund (fond oprav).'
    : 'A monthly fee to the building or association for shared upkeep.';
  if (e.detail.fill) applyDefaults(); else calc();
});
document.addEventListener('themechange', drawChart);
window.addEventListener('resize', drawChart);
document.querySelectorAll('main input, main select').forEach(el => el.addEventListener('input', calc));

calc();
// (js/common.js reopens the currency chosen last time once this script has run.)
