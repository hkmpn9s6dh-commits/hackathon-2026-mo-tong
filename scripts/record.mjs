/**
 * Records the demo by playing the real production build in Chromium.
 *   node scripts/record.mjs [baseUrl]
 * Writes video/raw.webm at 1280x720. Subtitles are burnt in by scripts/make-video.sh.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const OUT = 'video/tmp';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const exe = [
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
].find((p) => existsSync(p));
if (!exe) throw new Error('chromium not found');

const browser = await chromium.launch({ executablePath: exe, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const T0 = Date.now();
const mark = (label) => console.log(`MARK ${((Date.now() - T0) / 1000).toFixed(1)}s  ${label}`);
const wait = async (ms) => {
  await page.waitForTimeout(ms);
};
const snap = () => page.evaluate(() => window.__moTong.snapshot());

await page.goto(base, { waitUntil: 'load' });
await wait(3800); // title, the idle stroke draws itself

mark('title shown');
await page.click('[data-act="start"]');
await wait(1500);

// level 1
await page.evaluate(() => window.__moTong.solve());
mark('L1 draw');
await wait(3200);
await wait(2600); // result card so the numbers can be read
mark('L1 result');
await page.click('[data-act="next"]');
await wait(900);

// level 2
await page.evaluate(() => window.__moTong.solve());
await wait(3000);
await page.click('[data-act="next"]');
await wait(900);

// level 3
await page.evaluate(() => window.__moTong.solve());
mark('L1 draw');
await wait(3200);
await page.click('[data-act="next"]');
await wait(600);

// level 4 — the shadow plays first; let it breathe
mark('L4 start');
await wait(4200);
await page.evaluate(() => window.__moTong.solve());
await wait(3600);
await page.click('[data-act="next"]');
await wait(600);

// level 5
await wait(2600);
await page.evaluate(() => window.__moTong.solve());
await wait(3400);
await page.click('[data-act="next"]');
await wait(600);

// level 6
await wait(2600);
await page.evaluate(() => window.__moTong.solve());
await wait(3400);
await page.click('[data-act="next"]');
await wait(600);

// level 7 — duel
mark('L7 start');
await wait(3000);
await page.evaluate(() => window.__moTong.solve());
await wait(3800);
await wait(1200);
mark('finale');
await page.click('[data-act="finale"]');
await wait(5200);
mark('end');

const s = await snap();
console.log('final snapshot', JSON.stringify(s));

// the beat sheet the soundtrack is written against
const recStart = await page.evaluate(() => window.__recStart ?? 0);
const events = await page.evaluate(() => window.__moTong.events());
const timeline = events.map((e) => ({ t: +( (e.t - recStart) / 1000 ).toFixed(3), kind: e.kind, n: e.n }));
writeFileSync('video/timeline.json', JSON.stringify(timeline, null, 1));
console.log('events', timeline.length, 'span', timeline.at(-1)?.t);
await context.close();
await browser.close();

// playwright writes a random name; normalise it
const { readdirSync, renameSync } = await import('node:fs');
const file = readdirSync(OUT).find((f) => f.endsWith('.webm'));
if (!file) throw new Error('no recording produced');
renameSync(path.join(OUT, file), 'video/raw.webm');
console.log('video/raw.webm written');
