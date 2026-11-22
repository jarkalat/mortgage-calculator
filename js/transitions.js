// Abodex page transitions (in <head> on every page, before the page is first drawn).
// css/style.css turns on cross-document View Transitions (@view-transition) and holds the slide animations.
// This file only says which way to slide: going to a page later in PAGE_ORDER, the new page comes in from the
// right ("forward"); to an earlier one, from the left ("back"). Other pages (404) get the browser's plain fade.
// Skipped with "reduce motion", and when the browser has already animated the change itself (e.g. the
// iPhone swipe-back gesture). Browsers without View Transitions simply navigate as before.
(function () {
  const PAGE_ORDER = ['index', 'mortgage', 'invest', 'rent-or-buy', 'market', 'privacy'];
  const pageOf = url => {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return -1;
      const name = u.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
      return PAGE_ORDER.indexOf(name);
    } catch (e) { return -1; }
  };
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Old page: remember whether the browser is playing its own animation for this navigation
  let uaTransition = false;
  if (window.navigation) navigation.addEventListener('navigate', e => { uaTransition = !!e.hasUAVisualTransition; });
  window.addEventListener('pageswap', e => {
    if (e.viewTransition && (uaTransition || reduce())) e.viewTransition.skipTransition();
  });

  // New page: pick the direction from where we came from
  window.addEventListener('pagereveal', e => {
    const vt = e.viewTransition;
    if (!vt) return;
    if (reduce()) { vt.skipTransition(); return; }
    const act = window.navigation && navigation.activation;
    const from = pageOf((act && act.from && act.from.url) || document.referrer);
    const to = pageOf(location.href);
    if (from < 0 || to < 0 || from === to || !vt.types) return;
    vt.types.add(to > from ? 'forward' : 'back');
  });
})();
