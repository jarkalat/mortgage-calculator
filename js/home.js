// Abodex home page: "Market at a glance". Every number comes from data/market.json (none is typed
// into the HTML), worked out the same way as on the market page. Formatting is shared in common.js.
const sourceName = src => esc(src.name.split(' – ')[0]);

fetch('data/market.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(renderFacts)
  .catch(() => {
    const n = $('glanceNote');
    n.hidden = false;
    n.innerHTML = (location.protocol === 'file:'
      ? '<b>The market figures couldn’t be loaded.</b> Browsers block pages opened straight from your disk from reading data files.'
      : '<b>The market figures couldn’t be loaded.</b> Please reload the page.')
      + ' The <a href="market.html">market page</a> has the full data.';
  });

function renderFacts(d) {
  const P = d.prices_per_m2, n = P.years.length, year = P.years[n - 1];
  const price = id => P.rows.find(r => r.id === id).values[n - 1];
  const R = d.rents_deloitte, rent = R.rows.find(r => r.id === 'praha').value;
  // Gross rental yield = rent per m² × 12 ÷ price per m² (as in market.js)
  const grossYield = rent * 12 / price('praha') * 100;
  const M = d.rates.mortgage, last = M.series[M.series.length - 1];
  const RP = d.rates.repo, repoNow = RP.changes[RP.changes.length - 1];

  const facts = [
    {
      label: 'Prague flat price per m²', value: kc(price('praha')), num: price('praha'), fmt: kc,
      text: `What flats in Prague sold for on average in ${year}, about ${(price('praha') / price('cr')).toFixed(1)} times the Czech average of ${kc(price('cr'))}.`,
      src: `${sourceName(P.source)} · ${year}`,
    },
    {
      label: 'Prague gross rental yield', value: percent(grossYield), num: grossYield, fmt: percent,
      text: `A year’s asking rent (${kc(rent)} per m² a month) as a share of the price per m², before any costs, empty months or tax.`,
      src: `rent — ${sourceName(R.source)}, ${esc(R.source.period)}; price — ${sourceName(P.source)}, ${year}`,
    },
    {
      label: 'Average new mortgage rate', value: percent(last[1]), num: last[1], fmt: percent,
      text: `The average yearly interest rate Czech banks charged on new home loans in ${monthName(last[0])}.`,
      src: `${sourceName(M.source)} · ${monthName(last[0])}`,
    },
    {
      label: 'CNB repo rate', value: percent(repoNow.rate), num: repoNow.rate, fmt: percent,
      text: `The Czech National Bank’s main interest rate, which steers what banks charge; it has been at this level since ${dayName(repoNow.valid_from)}.`,
      src: `${sourceName(RP.source)} · since ${dayName(repoNow.valid_from)}`,
    },
  ];
  $('facts').innerHTML = facts.map(f => `<div class="card fact">
    <h3>${f.label}</h3><p class="value">${f.value}</p><p class="explain">${f.text}</p><p class="source"><b>Source:</b> ${f.src}</p>
  </div>`).join('');
  if (!reduceMotion()) document.querySelectorAll('#facts .value').forEach((el, k) => onceVisible(el, () => countUp(el, facts[k])));
  $('glanceSource').innerHTML = `Data retrieved ${dayName(d.retrieved)}. Full sources, links and charts are on the <a href="market.html">market page</a>.`;
}

// Count a number up from zero once, in the same format, always ending on the exact published text.
// aria-busy asks screen readers to wait for the final value.
function countUp(el, f) {
  const start = performance.now(), ms = 900;
  el.setAttribute('aria-busy', 'true');
  const step = now => {
    const t = Math.min(1, (now - start) / ms);
    if (t < 1) { el.textContent = f.fmt(f.num * (1 - Math.pow(1 - t, 3))); requestAnimationFrame(step); }
    else { el.textContent = f.value; el.removeAttribute('aria-busy'); }
  };
  requestAnimationFrame(step);
}
