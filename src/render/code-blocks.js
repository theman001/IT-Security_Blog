import Prism from 'prismjs/components/prism-core.js';
// Load order follows grammar dependencies (clike -> javascript -> typescript, c -> cpp, ...).
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-powershell.js';

// Highlight only on request. Prism's load-time auto-highlight (rAF / DOMContentLoaded) reads `manual` when it
// fires, and the whole module graph below evaluates synchronously before that, so this is early enough.
Prism.manual = true;

const COPIED_MS = 1800;

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // legacy fallback; execCommand reports failure (e.g. insecure origins) via its return value
  const prev = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    ta.remove();
    prev?.focus?.({ preventScroll: true }); // select() moved focus to the textarea
  }
  return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
}

/** Wrap each `pre > code` in `.code-block` (language label + copy button) and Prism-highlight it. Idempotent. */
export function enhanceCodeBlocks(root) {
  root.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (pre.parentElement?.classList.contains('code-block')) return;

    const lang = /(?:^|\s)language-([\w-]+)/.exec(code.className)?.[1] ?? '';
    if (lang && Object.hasOwn(Prism.languages, lang)) Prism.highlightElement(code); // unknown -> plain text

    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    const bar = document.createElement('div');
    bar.className = 'code-block__bar';
    const label = document.createElement('span');
    label.className = 'code-block__lang';
    label.textContent = lang || 'text';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-block__copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-live', 'polite'); // screen readers announce "Copied!" without a layout change

    let timer;
    btn.addEventListener('click', async () => {
      try {
        await copyText(code.textContent);
      } catch {
        return; // permission denied etc.: keep the label as-is
      }
      btn.textContent = 'Copied!';
      clearTimeout(timer);
      timer = setTimeout(() => (btn.textContent = 'Copy'), COPIED_MS);
    });

    bar.append(label, btn);
    pre.replaceWith(wrap);
    wrap.append(bar, pre);
  });
}
