// Pure checker: finds hard-coded colors and px lengths (tokens.css is the only place allowed).
const HEX = '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})';
const RULES = [
  // hex as a CSS declaration value (not a selector like `a:hover #add {` or `url(#id)`)
  ['hex color', new RegExp(`[\\w-]+\\s*:\\s*[^;{}]*?(?<![\\w&(])${HEX}(?![\\w-])\\s*(?:;|}|!important|$)`)],
  // hex as a standalone JS string, e.g. '#abc'. Hex-looking ids ('#add', '#fade') are skipped after
  // href=, data-*/aria-* attributes (=, : or , separated) and selector/id lookups.
  ['hex color', new RegExp(`(?<!href\\s*[=:]\\s*|(?:data|aria)-[\\w-]+['"]?\\s*[=:,]\\s*|(?:querySelector(?:All)?|closest|matches|getElementById)\\(\\s*)(['"])${HEX}\\1`)],
  ['color function', /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/],
  ['px value', /(?<![\w.])(?:\d*\.)?\d*[1-9]\d*(?:\.\d+)?px\b/],
];

export function checkSource(text, filename = '') {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let src = text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
  if (/\.js$/.test(filename)) src = src.replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/@media[^{]*/g, ''); // px is allowed in media conditions
    for (const [rule, re] of RULES) {
      if (re.test(line)) out.push({ file: filename, line: i + 1, rule, text: raw.trim() });
    }
  });
  return out;
}
