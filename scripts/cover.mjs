/**
 * Cover candidates at 3:2 (1500x1000) for the ModelScope page and the write-up.
 *   node scripts/cover.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
mkdirSync('submission', { recursive: true });

const exe = [
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
].find((p) => existsSync(p));
if (!exe) throw new Error('chromium not found');

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(3200);
await page.screenshot({ path: 'submission/cover-title-1500x1000.png' });

// a mid-game frame with the shadow walking
await page.click('[data-act="start"]');
await page.waitForTimeout(400);
await page.evaluate(() => window.__moTong.jump(3));
await page.waitForTimeout(300);
await page.evaluate(() => window.__moTong.solve());
await page.waitForTimeout(1500);
await page.screenshot({ path: 'submission/cover-play-1500x1000.png' });

// a second play frame, after the dots pop
await page.waitForTimeout(1300);
await page.screenshot({ path: 'submission/cover-play2-1500x1000.png' });

await browser.close();
console.log('cover candidates written to submission/');
