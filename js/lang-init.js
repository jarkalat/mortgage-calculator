// Loaded in <head> on every page: picks the language before the page is drawn.
// Order: ?lang=cs / ?lang=en in the address (saved for the next pages), then the saved choice,
// then Czech if the browser's language is Czech, otherwise English. js/common.js does the rest.
(function () {
  var root = document.documentElement, lang = null;
  root.setAttribute('data-lang-en', root.lang);   // the page's own English tag ("en" / "en-US"), for switching back
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'cs' || q === 'en') { lang = q; localStorage.setItem('mortgage-lang', q); }
    else {
      var saved = localStorage.getItem('mortgage-lang');
      if (saved === 'cs' || saved === 'en') lang = saved;
    }
  } catch (e) {}
  if (!lang) lang = /^cs\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '') ? 'cs' : 'en';
  root.setAttribute('data-lang', lang);
  if (lang === 'cs') root.lang = 'cs';
})();
