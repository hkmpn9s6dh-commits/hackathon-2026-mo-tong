/**
 * Visual spot-check: renders a few game states to proof/shots/ for review.
 *   node scripts/shots.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const OUT = 'proof/shots';
mkdirSync(OUT, { recursive: true });
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';

const exe = [
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
].find((p) => existsSync(p));
if (!exe) throw new Error('chromium not found');

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/shot-title.png` });

await page.click('[data-act="start"]');
await page.waitForTimeout(500);
await page.evaluate(() => window.__moTong.solve());
await page.waitForTimeout(950);
await page.screenshot({ path: `${OUT}/shot-drawing.png` });
await page.waitForTimeout(2400);
await page.screenshot({ path: `${OUT}/shot-result.png` });

await page.evaluate(() => window.__moTong.jump(4));
await page.waitForTimeout(400);
await page.evaluate(() => window.__moTong.solve());
await page.waitForTimeout(1100);
await page.screenshot({ path: `${OUT}/shot-late.png` });

await browser.close();
console.log('shots written');
