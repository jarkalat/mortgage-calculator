// Abodex "Explain my results" advisor (shared, loaded after common.js on pages that use it).
// Nothing is sent until the visitor clicks the button. Then the calculator's numbers go to the advisor
// server (../abodex-advisor, a Cloudflare Worker), which asks Anthropic's Claude to explain them and
// streams the answer back as plain text. The answer is always shown with textContent, never as HTML.

// The advisor server's address. Change it here only.
const ADVISOR_URL = 'https://abodex-advisor.abodex.workers.dev/explain';

// Error codes the server returns as {"error": "..."}; anything else shows the general message.
const ADVISOR_ERRORS = { visitor_limit: 'adv.errVisitor', daily_cap: 'adv.errDaily' };

// Makes the answer read cleanly as plain text: drops simple Markdown marks (**bold**, # headings,
// `code`, list dashes become "•") and keeps the line breaks. Spaces inside Czech-style numbers
// ("1 862 491,60") and before % / Kč / € / $ become non-breaking, so a number never splits across lines.
function advisorPlain(s) {
  return s
    .replace(/\r/g, '')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1 ')
    .replace(/(\d) (?=%|Kč|€|\$)/g, '$1 ')
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\*\*|__|\*|`/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

// opts: { button, output, calculator, values }
// values() returns the numbers to send ({ name: number }), or null when there is no valid result.
// Returns { clear, refresh }: clear() removes the old explanation (and stops one still arriving),
// refresh() turns the button on or off depending on whether values() has a result.
function setupAdvisor({ button, output, calculator, values }) {
  let controller = null;

  const setIdle = () => {
    button.disabled = !values();
    button.textContent = t('adv.button');
    button.removeAttribute('aria-busy');
  };

  const clear = () => {
    if (controller) controller.abort();
    controller = null;
    output.hidden = true;
    output.textContent = '';
    output.classList.remove('error');
    setIdle();
  };

  const show = (text, isError) => {
    output.textContent = text;
    output.classList.toggle('error', !!isError);
    output.hidden = false;   // fades in gently via CSS (off with reduce motion)
  };

  async function explain() {
    const v = values();
    if (!v) return;
    clear();
    const mine = controller = new AbortController();
    button.disabled = true;
    button.textContent = t('adv.thinking');
    button.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(ADVISOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calculator, lang, values: v }),
        signal: mine.signal,
        credentials: 'omit',
      });
      if (!res.ok || !res.body) {
        let code = '';
        try { code = (await res.json()).error; } catch (e) {}
        throw new Error(code || 'server');
      }
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let raw = '';
      for (;;) {
        const { done, value } = await reader.read();
        // Stopped (inputs changed, or a new click): never write an old answer into the box
        if (controller !== mine) { reader.cancel().catch(() => {}); return; }
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        if (raw.trim()) show(advisorPlain(raw).trimStart());
      }
      raw += decoder.decode();
      if (!raw.trim()) throw new Error('server');
      show(advisorPlain(raw).trim());
    } catch (e) {
      if (controller !== mine) return;   // the inputs changed: clear() has already tidied up
      show(t(ADVISOR_ERRORS[e.message] || 'adv.errOther'), true);
    }
    if (controller === mine) { controller = null; setIdle(); }
  }

  button.addEventListener('click', explain);
  setIdle();
  return { clear, refresh: () => { if (!controller) setIdle(); } };
}
