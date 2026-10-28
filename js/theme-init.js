// Loaded in <head> on every page: applies a saved light theme before the page is drawn,
// so moving between pages doesn't flash the dark theme first.
try {
  if (localStorage.getItem('mortgage-theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {}
