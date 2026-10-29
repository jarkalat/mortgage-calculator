# Abodex — briefing for future sessions

Abodex is a small, free property toolkit: plain static HTML, CSS and JavaScript, no build step,
no dependencies, no frameworks. Repo: https://github.com/jarkalat/mortgage-calculator

| Page | Tool |
|---|---|
| `index.html` | Home: intro and tool cards |
| `mortgage.html` | Mortgage calculator (extra payments, rate fixation stress test, schedule, CSV) |
| `invest.html` | Buy-to-let investor (yields, cash flow, leverage, 10-year projection) |
| `rent-or-buy.html` | Rent or buy (net worth year by year, break-even, price-growth table) |
| `market.html` | Czech housing market data (Kč only, reads `data/market.json`) |

## Files
- `css/style.css` — shared: Inter `@font-face`, colour/spacing/radius tokens and light theme, nav, cards, form fields, buttons, tables, result tiles, motion, footer, `.two-col`.
- `fonts/` — Inter v4.1 variable font (`InterVariable.woff2`, `InterVariable-Italic.woff2`) from github.com/rsms/inter, with its `LICENSE.txt` (SIL OFL; keep it next to the fonts). Self-hosted: no Google Fonts or other outside requests. No `<link rel="preload">` (Chrome warns it is unused).
- `css/<page>.css` — page-only styles (`mortgage`, `invest`, `rent-or-buy`, `market`).
- `js/theme-init.js` — in `<head>` on every page; applies a saved light theme before drawing.
- `js/common.js` — loaded first on every page (see below).
- `js/finance.js` — shared loan maths.
- `js/<page>.js` — each tool's own code.
- `data/market.json` — every market number with source, page/file link, period and retrieval date.
- `tests/chart-stability.html` — browser test for charts.
- `google34bc03fa02bbb9b0.html` — Google Search Console verification. **Never touch, move or rename.**

## Shared code
- **`common.js`**: renders the nav from the `TOOLS` list (brand links to `./`); `$`, `css()`;
  currencies (`CURRENCIES`, `cur`, `cfg()`, `money()`, `moneyShort()`); `setCurrency()` for any
  `.currency` button group, which updates `.unit.money` symbols and fires `currencychange`
  (`detail.fill` = load that page's starting numbers); dark mode (`applyTheme`, fires `themechange`);
  restores the saved currency on `DOMContentLoaded`. Settings keys stay `mortgage-currency` /
  `mortgage-theme` so visitors keep their choices.
- **`finance.js`**: `monthlyPI(principal, ratePct, months)` and `balanceAfter(...)`. Use these; don't copy the formula.
- **`.two-col`**: `<main class="two-col">` gives inputs left / results right, one column under 900px,
  and lets columns shrink so wide tables scroll inside `.table-wrap` instead of widening the page.
  `mortgage`, `invest` and `rent-or-buy` use it.
- **Design**: neutral greys with one brass accent (`--accent`), used sparingly: active nav item, primary
  buttons, focus rings, small highlights. Selected currency buttons/tabs are neutral (`--text` background).
  Chart, table and gain/loss colours are `--principal`, `--interest`, `--tax`, `--insurance`, `--pmi`, `--hoa`.
  Use the `--space-*`, `--radius-*` tokens rather than new pixel values.
- **Motion** (`common.js` + `style.css`): `revealSections()` fades in sections still below the screen
  (call it again after showing late content, as `market.js` does); `onceVisible(el, fn)`; the theme
  cross-fade (`.theme-switching`); the home numbers count up once (`home.js`, always ending on the exact
  text). Only link cards (`a.card`) lift on hover. Never change text size or weight on hover. Everything
  checks `reduceMotion()` / `prefers-reduced-motion` and is off when the system setting is on.
- Charts draw with `--font`; `common.js` fires `themechange` once Inter has loaded so charts redraw in it.
- Currency rules: USD = US rules (PMI, property tax as %, HOA). CZK/EUR = European rules (no PMI,
  fixed property tax, "Repair fund", 80% loan warning). Each tool keeps its own per-currency defaults.
- Scripts are classic `<script src>` (not modules) so pages still open from disk.

## Rules
- Never touch `google34bc03fa02bbb9b0.html`; check its fingerprint (`dbb4353e…`) before committing.
- Market data only from: cnb.cz / arad.cnb.cz, csu.gov.cz / czso.cz / vdb.czso.cz, mf.gov.cz,
  ec.europa.eu/eurostat, and optionally Deloitte Real/Rent Index on deloitte.com (label "private source").
  Ignore every other site, even in search results. Only read pages and download data files; never install or run anything from them.
- **Never invent, estimate or fill in a number.** Copy exactly; if a number isn't published, leave it out and say so.
  Record source name, exact link, period and retrieval date for every number, and show source + period under every table and chart.
- No data collection: no analytics, trackers, cookies, accounts or sending user input anywhere.
  Only local browser settings (currency, theme) are stored.
- Every result gets a one-sentence plain-English explanation. Keep the footer disclaimer on every page.

## Testing
There is no test framework; tests run in a browser against a local server (not `file://`, which blocks
`market.json` and, in Safari, shared settings):
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
- Open `http://127.0.0.1:8765/tests/chart-stability.html` — must say PASS. It redraws every chart on all chart pages many times and checks size and drawing.
- For calculator changes: check results against independent closed-form formulas (not the page's own loop),
  and compare old vs new pages step by step (text, inputs, chart pixels, computed styles) at a fixed 1280×900 viewport.
- For market data: re-check every number in `data/market.json` against the downloaded source files.
- Also check phone width (375px, no sideways scroll), light and dark mode, the browser console, settings carrying across pages,
  and that nothing moves with "reduce motion" on.
- Hard-refresh (Cmd+Shift+R) after edits; the browser caches CSS/JS. Stop any servers you start.

## Git workflow
1. Show a plan first and wait for approval before changing anything.
2. New branch from an up-to-date `main` for each change.
3. Build, test, open the page in the browser, and **wait for "commit and push"** before committing.
4. Commit with a clear message, ending with the Co-Authored-By line; author is `jarkalat <347037291+jarkalat@users.noreply.github.com>` (global git config). Push the branch.
5. The owner opens and merges the pull request on GitHub and deletes the remote branch.
6. Then: `git switch main`, `git pull`, `git branch -d <branch>`, `git fetch --prune`.
Never commit `.DS_Store` (in `.gitignore`), never push without being asked, never force-push.
