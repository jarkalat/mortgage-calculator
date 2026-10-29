// Abodex home page: "Market at a glance". Every number comes from data/market.json (none is typed
// into the HTML), worked out the same way as on the market page. Formatting is shared in common.js.
const sourceName = src => esc(src.name.split(' – ')[0]);

let raw = null, failed = false;
fetch('data/market.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => { raw = d; renderFacts(localData(d), true); })
  .catch(() => { failed = true; loadNote(); });

function loadNote() {
  const n = $('glanceNote');
  n.hidden = false;
  n.innerHTML = t(location.protocol === 'file:' ? 'h.loadFile' : 'h.loadRetry') + ' ' + t('h.loadMore');
}
// Language switch: the same figures again, in the new language (no count-up the second time)
document.addEventListener('langchange', () => { if (raw) renderFacts(localData(raw), false); else if (failed) loadNote(); });

function renderFacts(d, animate) {
  const P = d.prices_per_m2, n = P.years.length, year = P.years[n - 1];
  const price = id => P.rows.find(r => r.id === id).values[n - 1];
  const R = d.rents_deloitte, rent = R.rows.find(r => r.id === 'praha').value;
  // Gross rental yield = rent per m² × 12 ÷ price per m² (as in market.js)
  const grossYield = rent * 12 / price('praha') * 100;
  const M = d.rates.mortgage, last = M.series[M.series.length - 1];
  const RP = d.rates.repo, repoNow = RP.changes[RP.changes.length - 1];

  const facts = [
    {
      label: t('h.f1'), value: kc(price('praha')), num: price('praha'), fmt: kc,
      text: t('h.f1t', { year, ratio: dec(price('praha') / price('cr'), 1), avg: kc(price('cr')) }),
      src: `${sourceName(P.source)} · ${year}`,
    },
    {
      label: t('h.f2'), value: percent(grossYield), num: grossYield, fmt: percent,
      text: t('h.f2t', { rent: kc(rent) }),
      src: t('h.f2s', { rname: sourceName(R.source), rperiod: esc(R.source.period), pname: sourceName(P.source), year }),
    },
    {
      label: t('h.f3'), value: percent(last[1]), num: last[1], fmt: percent,
      text: t('h.f3t', { month: monthName(last[0]) }),
      src: `${sourceName(M.source)} · ${monthName(last[0])}`,
    },
    {
      label: t('h.f4'), value: percent(repoNow.rate), num: repoNow.rate, fmt: percent,
      text: t('h.f4t', { date: dayName(repoNow.valid_from) }),
      src: t('h.f4s', { name: sourceName(RP.source), date: dayName(repoNow.valid_from) }),
    },
  ];
  $('facts').innerHTML = facts.map(f => `<div class="card fact">
    <h3>${f.label}</h3><p class="value">${f.value}</p><p class="explain">${f.text}</p><p class="source"><b>${t('src.source')}</b> ${f.src}</p>
  </div>`).join('');
  if (animate && !reduceMotion()) document.querySelectorAll('#facts .value').forEach((el, k) => onceVisible(el, () => countUp(el, facts[k])));
  // Data last updated: the four sources used above
  const fresh = Object.fromEntries(dataFreshness(d).map(f => [f.id, f]));
  const latest = ['prices', 'rents', 'mortgage', 'repo'].map(id => `${fresh[id].what.toLowerCase()}: ${esc(fresh[id].latest)} — ${esc(fresh[id].source)}`).join('; ');
  $('glanceSource').innerHTML = t('h.updated', { date: dayName(d.retrieved), latest });
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
