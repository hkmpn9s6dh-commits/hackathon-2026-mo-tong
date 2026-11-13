/**
 * End-to-end check on the production build. Drives the real game in Chromium,
 * takes screenshots for the proof bundle, and asserts the loop actually works.
 *
 *   node scripts/e2e.mjs            # assumes `npm run build` already ran
 *   node scripts/e2e.mjs --serve    # starts `vite preview` itself
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const OUT = 'proof/shots';
mkdirSync(OUT, { recursive: true });

const exe = findChrome();
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';

let server = null;
if (!process.env.BASE_URL) {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  await new Promise((r) => setTimeout(r, 2200));
}

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(m.text());
});
page.on('pageerror', (e) => problems.push(String(e)));

let failures = 0;
const waitForPhase = async (phase, timeout = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const s = await page.evaluate(() => window.__moTong.snapshot());
    if (s.phase === phase) return s;
    await page.waitForTimeout(120);
  }
  return await page.evaluate(() => window.__moTong.snapshot());
};

const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/01-title.png` });
check('title screen', (await page.locator('.t-title').innerText()) === '墨童');

await page.click('[data-act="start"]');
await page.waitForTimeout(700);
let snap = await page.evaluate(() => window.__moTong.snapshot());
check('starts on level 1 in draw phase', snap.phase === 'draw' && snap.level === 0, JSON.stringify(snap));

// play level 1 with the reference route, watch it walk
await page.evaluate(() => window.__moTong.solve());
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/02-drawing.png` });
snap = await waitForPhase('result');
check('level 1 completes', snap.phase === 'result' && snap.finished === 1, JSON.stringify(snap));
await page.screenshot({ path: `${OUT}/03-result.png` });

// the shadow level: it must claim at least one dot on its own
await page.evaluate(() => window.__moTong.jump(3));
await page.waitForTimeout(500);
snap = await page.evaluate(() => window.__moTong.snapshot());
check('shadow takes at least one dot before the player draws', snap.claimed >= 1, JSON.stringify(snap));
check('shadow never takes more than 40 % of the dots', snap.claimed <= Math.floor(snap.dots * 0.4), JSON.stringify(snap));

await page.evaluate(() => window.__moTong.solve());
await page.waitForTimeout(1100);
await page.screenshot({ path: `${OUT}/04-shadow-level.png` });
snap = await waitForPhase('result');
check('shadow level still solvable with the reference route', snap.phase === 'result', JSON.stringify(snap));

// finale
await page.evaluate(() => window.__moTong.jump(6));
await page.waitForTimeout(400);
await page.evaluate(() => window.__moTong.solve());
snap = await waitForPhase('result');
check('final level reaches a result card', snap.phase === 'result', JSON.stringify(snap));
await page.screenshot({ path: `${OUT}/05-final-result.png` });
await page.evaluate(() => document.querySelector('[data-act="finale"]')?.click());
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/05-finale.png` });
const finale = await page.locator('.finale-canvas').count();
check('finale composes a scroll', finale === 1);

// mobile width pass
await page.setViewportSize({ width: 414, height: 896 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/06-mobile.png` });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check('no horizontal overflow at 414px', !overflow);

check('no console errors', problems.length === 0, problems.slice(0, 3).join(' | '));

await browser.close();
server?.kill();
console.log(failures === 0 ? '\nall e2e checks passed' : `\n${failures} e2e check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

function findChrome() {
  const candidates = [
    path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
    path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('no chromium found');
}
