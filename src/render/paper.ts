import { makeRng, seedFromString } from '../core/rng';

/** Rice-paper texture, generated once and reused for every frame. */
export function makePaperTexture(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d')!;
  const rng = makeRng(seedFromString('paper-v1'));

  // warm base with a slow gradient, like paper that has seen a window
  const base = g.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#f7f2e5');
  base.addColorStop(0.45, '#f3ecdb');
  base.addColorStop(1, '#eae0cb');
  g.fillStyle = base;
  g.fillRect(0, 0, width, height);

  // large soft cloudiness
  for (let i = 0; i < 60; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const r = 80 + rng() * 260;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.55;
    grad.addColorStop(0, dark ? 'rgba(120,98,66,0.055)' : 'rgba(255,255,255,0.07)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // fibres: short hairs pressed into the sheet
  g.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const len = 2 + rng() * 12;
    const a = rng() * Math.PI * 2;
    g.strokeStyle = rng() > 0.5 ? `rgba(120,98,66,${0.02 + rng() * 0.05})` : `rgba(255,255,255,${0.03 + rng() * 0.07})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.35);
    g.stroke();
  }

  // flecks: the little dark specks real handmade paper keeps
  for (let i = 0; i < 900; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const r = 0.3 + rng() * 1.1;
    g.fillStyle = `rgba(86,70,48,${0.05 + rng() * 0.16})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // faint fibres from long grass, a few per sheet
  for (let i = 0; i < 26; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const len = 40 + rng() * 220;
    const a = rng() * Math.PI;
    g.strokeStyle = `rgba(110,92,62,${0.03 + rng() * 0.04})`;
    g.lineWidth = 0.6 + rng() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + Math.cos(a) * len * 0.3, y + Math.sin(a) * len * 0.3 + 6, x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6 - 8, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // distant hills, the way an album leaf keeps a horizon at the top edge
  const hills = [
    { base: 210, amp: 46, alpha: 0.045, off: 0.0 },
    { base: 168, amp: 32, alpha: 0.035, off: 1.7 },
    { base: 132, amp: 22, alpha: 0.028, off: 3.1 },
  ];
  for (const h of hills) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, h.base);
    for (let x = 0; x <= width; x += 8) {
      const y =
        h.base -
        Math.sin((x / width) * Math.PI * 2.2 + h.off) * h.amp * 0.6 -
        Math.sin((x / width) * Math.PI * 5.3 + h.off * 2) * h.amp * 0.4;
      g.lineTo(x, y);
    }
    g.lineTo(width, 0);
    g.closePath();
    g.fillStyle = `rgba(46,52,46,${h.alpha})`;
    g.fill();
  }

  // aged edge: a gentle warm vignette
  const vig = g.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(120,96,60,0.16)');
  g.fillStyle = vig;
  g.fillRect(0, 0, width, height);

  return c;
}

/** Irregular sheet outline so the paper does not read as a rounded rectangle. */
export function paperPath(width: number, height: number, inset = 10): Path2D {
  const rng = makeRng(seedFromString('deckle-v1'));
  const p = new Path2D();
  const step = 26;
  const pts: Array<[number, number]> = [];
  for (let x = inset; x < width - inset; x += step) pts.push([x, inset + (rng() - 0.5) * 3.2]);
  for (let y = inset; y < height - inset; y += step) pts.push([width - inset + (rng() - 0.5) * 3.2, y]);
  for (let x = width - inset; x > inset; x -= step) pts.push([x, height - inset + (rng() - 0.5) * 3.2]);
  for (let y = height - inset; y > inset; y -= step) pts.push([inset + (rng() - 0.5) * 3.2, y]);
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}
