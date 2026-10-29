// Abodex Housing market. Czech data only: values are always shown in Kč or as an index, so this page
// has no currency switch. Every number comes from data/market.json, which records its source.
// Formatting (kc, percent, sourceLine, …) is shared in common.js.

// raw = the file as published; data = the same with its notes, periods and area names in the current language
let raw = null, data = null, failed = false;

fetch('data/market.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => { raw = d; data = localData(d); render(); revealSections(); })
  .catch(() => { failed = true; loadNote(); });

function loadNote() {
  const n = $('loadNote');
  n.hidden = false;
  n.innerHTML = t(location.protocol === 'file:' ? 'mk.loadFile' : 'mk.loadRetry');
}
document.addEventListener('langchange', () => {
  if (raw) { data = localData(raw); render(); } else if (failed) loadNote();
});

// Index values as published (215.3 / 215,3)
const indexText = v => (lang === 'cs' ? String(v).replace('.', ',') : String(v));

function render() {
  const d = data;
  $('content').hidden = false;

  // Data last updated
  $('freshRetrieved').innerHTML = t('mk.freshRetrieved', { date: dayName(d.retrieved) });
  $('freshRows').innerHTML = dataFreshness(d).map(f => `<tr><td>${esc(f.what)}</td><td>${esc(f.source)}</td><td>${esc(f.latest)}</td></tr>`).join('');

  // 1. Prices per m²
  const P = d.prices_per_m2;
  P.years.forEach((y, k) => { $('pYear' + k).textContent = y; });
  $('priceRows').innerHTML = P.rows.map(r => `<tr><td>${esc(r.label)} <span class="muted">(${esc(r.source_label)})</span></td>${r.values.map(v => `<td>${kc(v)}</td>`).join('')}</tr>`).join('');
  $('priceSource').innerHTML = sourceLine(P.source, t('mk.tables') + P.rows.map(r => link(r.file, `${r.label} – ${r.table}`)).join(', '));
  const D = d.prague_districts;
  $('districtRows').innerHTML = D.rows.map(r => `<tr><td>${esc(r.district)}</td><td>${kc(r.value)}</td></tr>`).join('')
    + `<tr class="total"><td>${t('mk.pragueOverall')}</td><td>${kc(D.prague_overall)}</td></tr>`;
  $('districtNote').textContent = D.note;
  $('districtSource').innerHTML = sourceLine(D.source);

  // 2. Rents per m²
  const R = d.rents_deloitte;
  $('rentRows').innerHTML = R.rows.map(r => `<tr><td>${esc(r.label)} <span class="private">${t('mk.private')}</span></td><td>${kc(r.value)}</td></tr>`).join('');
  $('rentNote').textContent = R.note;
  $('rentSource').innerHTML = sourceLine(R.source);
  const M = d.rents_mf;
  $('mfNote').textContent = `${M.category}. ${M.note}`;
  const mfRows = list => list.map(r => `<tr><td>${esc(r.cadastral_area)}</td><td>${kc(r.reference_rent)}</td><td>${kc(r.median_rent)}</td><td>${r.data_coverage}</td></tr>`).join('');
  $('mfPrague').innerHTML = mfRows(M.praha);
  $('mfBrno').innerHTML = mfRows(M.brno);
  $('mfPragueSummary').textContent = tn('mk.mfPragueN', M.praha.length);
  $('mfBrnoSummary').textContent = tn('mk.mfBrnoN', M.brno.length);
  $('mfDefs').innerHTML = Object.entries({ [t('mk.refRent')]: M.columns.reference_rent, [t('mk.medRent')]: M.columns.median_rent, [t('mk.coverage')]: M.columns.data_coverage })
    .map(([k, v]) => `<li><b>${k}:</b> ${esc(v)}.</li>`).join('');
  $('mfSource').innerHTML = sourceLine(M.source, t('mk.unit', { u: esc(M.unit) }));

  // 3. Gross rental yield = rent per m² × 12 ÷ price per m²
  const price = id => P.rows.find(r => r.id === id).values[P.years.length - 1];
  const rent = id => R.rows.find(r => r.id === id).value;
  const yields = R.rows.map(r => ({ label: r.label, id: r.id, rent: rent(r.id), price: price(r.id), y: rent(r.id) * 12 / price(r.id) * 100 }));
  $('yieldFormula').innerHTML = t('mk.formula');
  $('yieldRows').innerHTML = yields.map(x => `<tr><td>${esc(x.label)}</td><td>${kc(x.rent)}</td><td>${kc(x.price)}</td><td><b>${percent(x.y)}</b></td></tr>`).join('');
  const pragueAlt = rent('praha') * 12 / D.prague_overall * 100;
  $('yieldNote').textContent = t('mk.yieldNote', { period: R.source.period, year: P.years[P.years.length - 1], price: kc(D.prague_overall), y: percent(pragueAlt) });
  $('yieldSource').innerHTML = t('mk.yieldSource', { rname: esc(R.source.name), rperiod: esc(R.source.period), pname: esc(P.source.name), year: P.years[P.years.length - 1] });

  // 4. Rates
  const RT = d.rates, last = RT.mortgage.series[RT.mortgage.series.length - 1], repoNow = RT.repo.changes[RT.repo.changes.length - 1];
  $('rateLatest').textContent = t('mk.rateLatest', { repo: percent(repoNow.rate), date: dayName(repoNow.valid_from), mort: percent(last[1]), month: monthName(last[0]) });
  $('repoSource').innerHTML = sourceLine(RT.repo.source);
  $('mortSource').innerHTML = sourceLine(RT.mortgage.source);

  // 5. Indices
  $('czSource').innerHTML = sourceLine(d.index_prague_vs_rest.source, ` · ${esc(d.index_prague_vs_rest.unit)}`);
  $('euSource').innerHTML = sourceLine(d.index_cz_vs_eu.source, ` · ${esc(d.index_cz_vs_eu.unit)}`);

  summary(yields);
  setupCopy();
  drawCharts();
}

// ---------- Plain-words summary, worked out from the data above ----------
function summary(yields) {
  const d = data, P = d.prices_per_m2, n = P.years.length;
  const pr = P.rows.find(r => r.id === 'praha').values, cr = P.rows.find(r => r.id === 'cr').values;
  const mort = d.rates.mortgage.series, last = mort[mort.length - 1], repoNow = d.rates.repo.changes[d.rates.repo.changes.length - 1];
  const recent = mort.slice(-12), low = recent.reduce((a, b) => (b[1] < a[1] ? b : a));
  // Area names for the sentences ("Prague and Brno" / "v Praze a v Brně"); the first word starts with a capital
  const areas = list => { const s = list.map(x => t('mk.area.' + x.id)).join(t('mk.and')); return s.charAt(0).toUpperCase() + s.slice(1); };
  const below = yields.filter(x => x.y < last[1]), above = yields.filter(x => x.y >= last[1]);
  const ci = d.index_prague_vs_rest, ce = d.index_cz_vs_eu;
  const growth = s => s[s.length - 1] / s[0];
  const rate = { rate: percent(last[1]), month: monthName(last[0]) };
  const compare = (below.length ? tn('mk.s2below', below.length, { areas: areas(below), ...rate }) : t('mk.s2none', rate))
    + (above.length ? t('mk.s2above', { areas: above.map(x => t('mk.area.' + x.id)).join(t('mk.and')) }) : '');
  // "since 2015 Q1" in English (as before), "od 1. čtvrtletí 2015" in Czech
  const since = lang === 'cs' ? quarterName(ci.quarters[0]) : ci.quarters[0].replace('-', ' ');
  const items = [
    t('mk.s1', { price: kc(pr[n - 1]), year: P.years[n - 1], ratio: dec(pr[n - 1] / cr[n - 1], 1), avg: kc(cr[n - 1]), growth: percent((pr[n - 1] / pr[n - 2] - 1) * 100, 1) }),
    t('mk.s2', { yields: yields.map(x => `${percent(x.y)} ${t('mk.in.' + x.id)}`).join(', '), compare }),
    t('mk.s3', { repo: percent(repoNow.rate), date: dayName(repoNow.valid_from), low: percent(low[1]), lowMonth: monthName(low[0]), last: percent(last[1]), lastMonth: monthName(last[0]) }),
    t('mk.s4', { since, pg: dec(growth(ci.series.Prague), 1), rg: dec(growth(ci.series['Rest of Czechia']), 1),
      cz: indexText(ce.series.Czechia[ce.series.Czechia.length - 1]), eu: indexText(ce.series['EU-27'][ce.series['EU-27'].length - 1]) }),
    t('mk.s5'),
  ];
  $('summary').innerHTML = items.map(t => `<li>${t}</li>`).join('');
}

// ---------- Copy Prague's figures into the investor tool ----------
// (render() runs again on a language switch; the input listener is added once)
let copyUpdate = null;
function setupCopy() {
  const pricePerM2 = data.prices_per_m2.rows.find(r => r.id === 'praha').values.slice(-1)[0];
  const rentPerM2 = data.rents_deloitte.rows.find(r => r.id === 'praha').value;
  const btn = $('copyBtn');
  const update = () => {
    // Input check (js/common.js): no link or figures until the size makes sense
    const problem = inputProblem({ id: 'flatSize', min: 10, max: 400, msg: 'mk.checkSize' });
    showProblem($('flatSize'), problem);
    btn.removeAttribute('aria-disabled');
    if (problem) {
      btn.removeAttribute('href'); btn.setAttribute('aria-disabled', 'true');
      $('copyPreview').textContent = t('mk.copyNone');
      return;
    }
    const size = Math.min(400, Math.max(10, Math.round(parseFloat($('flatSize').value) || 55)));
    const price = pricePerM2 * size, rent = rentPerM2 * size;
    btn.href = `invest.html?from=market&price=${price}&rent=${rent}`;
    $('copyPreview').textContent = t('mk.copy', { size, ppm: kc(pricePerM2), price: kc(price), rpm: kc(rentPerM2), rent: kc(rent) });
  };
  if (!copyUpdate) $('flatSize').addEventListener('input', () => copyUpdate());
  copyUpdate = update;
  update();
}

// ---------- Charts ----------
function lineChart(canvas, labels, series, opts) {
  // The on-screen height comes from the HTML height attribute, remembered on the first draw: setting
  // canvas.height below (× devicePixelRatio for sharp screens) overwrites that attribute, so reading it
  // again would double the chart on every redraw until the browser refuses to draw it.
  if (!canvas.dataset.cssHeight) canvas.dataset.cssHeight = canvas.getAttribute('height');
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = +canvas.dataset.cssHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const pad = { l: 48, r: 14, t: 12, b: 28 };
  const all = series.flatMap(s => s.values).filter(v => v !== null);
  // Gridlines on round values (every opts.step), so every axis label is exact
  const lo = opts.zero ? 0 : Math.floor(Math.min(...all) / opts.step) * opts.step, hi = Math.ceil(Math.max(...all) / opts.step) * opts.step;
  const x = i => pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  ctx.font = '12px ' + css('--font'); ctx.lineWidth = 1;
  for (let v = lo; v <= hi + 1e-9; v += opts.step) {
    ctx.strokeStyle = css('--border'); ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(W - pad.r, y(v)); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText(opts.yFmt(v), pad.l - 6, y(v) + 4);
  }
  ctx.textAlign = 'center';
  labels.forEach((lab, i) => { const t = opts.xTick(lab); if (t) ctx.fillText(t, x(i), H - 8); });
  series.forEach(s => {
    ctx.strokeStyle = css(s.color); ctx.lineWidth = 2.5; ctx.beginPath();
    let started = false, prev = null;
    s.values.forEach((v, i) => {
      if (v === null) { started = false; return; }
      if (!started) { ctx.moveTo(x(i), y(v)); started = true; }
      else if (s.step) { ctx.lineTo(x(i), y(prev)); ctx.lineTo(x(i), y(v)); }
      else ctx.lineTo(x(i), y(v));
      prev = v;
    });
    ctx.stroke();
  });
}

function drawCharts() {
  if (!data) return;
  const RT = data.rates, months = [];
  const end = data.retrieved.slice(0, 7);
  for (let y = 2015, m = 1; `${y}-${String(m).padStart(2, '0')}` <= end; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  // Repo rate in force on the first day of each month (for drawing; the exact change dates are in the data file)
  const repoAt = ym => RT.repo.changes.filter(c => c.valid_from <= ym + '-01').slice(-1)[0].rate;
  const mortMap = Object.fromEntries(RT.mortgage.series);
  const yearTick = ym => (ym.endsWith('-01') && +ym.slice(0, 4) % 2 === 1 ? ym.slice(0, 4) : null);
  lineChart($('rateChart'), months, [
    { values: months.map(repoAt), color: '--interest', step: true },
    { values: months.map(m => mortMap[m] ?? null), color: '--principal' },
  ], { zero: true, step: 1, yFmt: v => pctText(v.toFixed(0)), xTick: yearTick });

  const qTick = q => (q.endsWith('Q1') && +q.slice(0, 4) % 2 === 1 ? q.slice(0, 4) : null);
  const CZ = data.index_prague_vs_rest, EU = data.index_cz_vs_eu;
  lineChart($('czChart'), CZ.quarters, [
    { values: CZ.series.Prague, color: '--principal' },
    { values: CZ.series['Rest of Czechia'], color: '--interest' },
  ], { step: 50, yFmt: v => v.toFixed(0), xTick: qTick });
  lineChart($('euChart'), EU.quarters, [
    { values: EU.series.Czechia, color: '--principal' },
    { values: EU.series['EU-27'], color: '--tax' },
  ], { step: 50, yFmt: v => v.toFixed(0), xTick: qTick });
}
document.addEventListener('themechange', drawCharts);
window.addEventListener('resize', drawCharts);
