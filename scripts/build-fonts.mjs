/**
 * Vendors only the LXGW WenKai unicode-range subsets the interface actually uses.
 * Run: node scripts/build-fonts.mjs  (needs `lxgw-wenkai-webfont` unpacked somewhere)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PKG = process.env.WENKAI_PKG ?? 'node_modules/lxgw-wenkai-webfont';
const OUT = 'src/fonts';
mkdirSync(OUT, { recursive: true });

const chars = new Set();
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/[.](ts|html)$/.test(f)) for (const ch of readFileSync(p, 'utf8')) chars.add(ch);
  }
};
walk('src');
for (const ch of readFileSync('index.html', 'utf8')) chars.add(ch);
// a little headroom for copy edits and for text the player never types
for (const ch of '0123456789%·—…、。，；：！？「」『』（）《》【】·ABCXYZabcxyz .,:;!?-_/|') chars.add(ch);
const cps = [...chars].map((c) => c.codePointAt(0)).filter((c) => c > 0x20);

const css = readFileSync(path.join(PKG, 'lxgwwenkai-regular.css'), 'utf8');
const blocks = css.split('@font-face').slice(1);
const kept = [];
for (const raw of blocks) {
  const file = raw.match(/files[/]([^']+[.]woff2)/);
  const range = raw.match(/unicode-range:[ \t]*([^;}]+)/);
  if (!file || !range) continue;
  const covered = range[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const t = s.replace(/^U[+]/i, '');
      if (t.includes('-')) {
        const [a, b] = t.split('-').map((x) => parseInt(x, 16));
        return [a, b];
      }
      const v = parseInt(t, 16);
      return [v, v];
    });
  const hit = cps.some((cp) => covered.some(([a, b]) => cp >= a && cp <= b));
  if (!hit) continue;
  copyFileSync(path.join(PKG, 'files', file[1]), path.join(OUT, file[1]));
  kept.push(
    `@font-face {\n  font-family: 'LXGW WenKai';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url('./${file[1]}') format('woff2');\n  unicode-range: ${range[1]};\n}`,
  );
}

writeFileSync(
  path.join(OUT, 'wenkai.css'),
  `/* LXGW WenKai (霞鹜文楷) — SIL Open Font License 1.1.
   Only the unicode ranges the interface uses are vendored; the browser fetches
   one or two of these files, never the whole family.
   Source: https://github.com/lxgw/LxgwWenKai · npm: lxgw-wenkai-webfont */
${kept.join('\n')}
`,
);
console.log('distinct chars', cps.length, '· subsets vendored', kept.length);
