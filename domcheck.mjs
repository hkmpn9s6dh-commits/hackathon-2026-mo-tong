import { chromium } from 'playwright-core';
import os from 'node:os';
const exe = os.homedir() + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:4179/', { waitUntil: 'load' });
await p.waitForTimeout(900);
await p.click('[data-act="start"]');
await p.waitForTimeout(400);
await p.evaluate(() => window.__moTong.solve());
await p.waitForTimeout(3200);
const info = await p.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { sel, wm: cs.writingMode, pos: cs.position, right: cs.right, top: cs.top, left: cs.left,
             rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  };
  return ['#hud', '.hud-top', '.level-tag', '#habit-panel', '#habit-list'].map(pick);
});
console.log(JSON.stringify(info, null, 1));
await b.close();
