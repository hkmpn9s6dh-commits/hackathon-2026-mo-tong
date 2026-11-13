import { clamp, type Vec2 } from '../core/geom';
import { makeRng, seedFromString } from '../core/rng';

export const INK = '#171310';
export const INK_SOFT = 'rgba(23,19,15,0.72)';
export const CINNABAR = '#b8372a';
export const CINNABAR_DEEP = '#8a2317';
export const GOLD = '#bb9647';

export interface BrushOptions {
  color?: string;
  alpha?: number;
  width?: number;
  /** 0 = a dry, fast stroke, 1 = a wet, slow one */
  wet?: number;
  seed?: number;
}

function normals(pts: readonly Vec2[]): Vec2[] {
  return pts.map((_p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

/** A brush stroke: a soft bleed, a dark core with pooled edges, and dry-brush specks. */
export function drawBrushPath(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], opts: BrushOptions = {}): void {
  if (pts.length < 2) return;
  const color = opts.color ?? INK;
  const alpha = opts.alpha ?? 0.95;
  const baseW = opts.width ?? 7.6;
  const wet = opts.wet ?? 0.5;
  const rng = makeRng(seedFromString(`brush:${opts.seed ?? 1}:${pts.length}`));
  const nrm = normals(pts);

  // the brush presses in, runs, then lifts: thin at both ends, fullest around 40 %
  const profile = (u: number) => {
    const enter = clamp(u / 0.08, 0, 1);
    const leave = clamp((1 - u) / 0.14, 0, 1);
    const swell = 0.62 + 0.38 * Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.62));
    return baseW * (0.3 + 0.7 * enter) * Math.pow(Math.min(leave, 1), 0.5) * (0.78 + 0.22 * swell);
  };
  const wobble = (i: number) => 1 + (Math.sin(i * 1.13) * 0.5 + Math.sin(i * 0.29) * 0.5) * 0.035;

  const shape = (scale: number) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      const w = profile(u) * wobble(i) * scale;
      const p = pts[i];
      const n = nrm[i];
      const x = p.x + n.x * w;
      const y = p.y + n.y * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const u = i / (pts.length - 1);
      const w = profile(u) * wobble(i) * scale;
      const p = pts[i];
      const n = nrm[i];
      ctx.lineTo(p.x - n.x * w, p.y - n.y * w);
    }
    ctx.closePath();
  };

  // 1. paper bleed — warm, wide, almost invisible
  ctx.save();
  ctx.globalAlpha = alpha * (0.05 + wet * 0.05);
  ctx.fillStyle = 'rgba(92,74,52,0.9)';
  shape(2.1 + wet * 0.9);
  ctx.fill();
  ctx.restore();

  // 2. the wet shoulder of the line
  ctx.save();
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = color;
  shape(1.28);
  ctx.fill();
  ctx.restore();

  // 3. solid core
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  shape(1);
  ctx.fill();
  // ink pools at the edge of a wet stroke: a slightly darker rim
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = 'rgba(9,7,6,0.85)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();

  // 4. granulation — pigment settling in the fibres
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = 'rgba(6,4,3,0.9)';
  const grains = Math.min(160, Math.floor(pts.length * 0.5));
  for (let i = 0; i < grains; i++) {
    const idx = Math.floor(rng() * pts.length);
    const p = pts[idx];
    const n = nrm[idx];
    const off = (rng() * 2 - 1) * profile(idx / (pts.length - 1)) * 0.85;
    ctx.beginPath();
    ctx.arc(p.x + n.x * off, p.y + n.y * off, 0.5 + rng() * 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 5. dry edge — where the brush skipped over the paper
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = 'rgba(246,241,228,0.9)';
  const flecks = Math.min(120, Math.floor(pts.length * 0.35));
  for (let i = 0; i < flecks; i++) {
    const idx = Math.floor(rng() * pts.length);
    const p = pts[idx];
    const n = nrm[idx];
    const side = rng() > 0.5 ? 1 : -1;
    const w = profile(idx / (pts.length - 1)) * (0.92 + rng() * 0.22);
    ctx.beginPath();
    ctx.arc(p.x + n.x * w * side + (rng() - 0.5) * 1.5, p.y + n.y * w * side + (rng() - 0.5) * 1.5, 0.4 + rng() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Pre-rendered cinnabar drop. */
export function makeDotSprite(r: number): HTMLCanvasElement {
  const size = Math.ceil(r * 5);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const rng = makeRng(seedFromString(`dot:${r}`));

  const halo = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.45);
  halo.addColorStop(0, 'rgba(178,52,40,0.16)');
  halo.addColorStop(0.5, 'rgba(178,52,40,0.05)');
  halo.addColorStop(1, 'rgba(178,52,40,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  // the drop: a round body with a blunt tail, like a flicked brush dot
  const pts: Array<[number, number]> = [];
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const tail = Math.max(0, Math.cos(a + 2.2)) * 0.3;
    const rr = r * (0.72 + rng() * 0.34 + tail);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96]);
  }
  const grad = g.createRadialGradient(cx - r * 0.2, cy - r * 0.22, r * 0.15, cx, cy, r * 1.15);
  grad.addColorStop(0, '#c04a37');
  grad.addColorStop(0.62, '#b4362a');
  grad.addColorStop(1, '#9a291d');
  const traceBlob = (scale: number) => {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const nxt = pts[(i + 1) % pts.length];
      const mx = ((p[0] + nxt[0]) / 2 - cx) * scale + cx;
      const my = ((p[1] + nxt[1]) / 2 - cy) * scale + cy;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo((p[0] - cx) * scale + cx, (p[1] - cy) * scale + cy, mx, my);
    }
    g.closePath();
  };
  // the cinnabar wicks into the paper: a faint ring just outside the body
  g.fillStyle = 'rgba(160,48,34,0.16)';
  traceBlob(1.12);
  g.fill();

  g.fillStyle = grad;
  traceBlob(1);
  g.fill();

  // pigment settling: grains inside, and a few flicked specks outside
  g.fillStyle = 'rgba(108,24,15,0.32)';
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.25 + rng() * 0.65);
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.5 + rng() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(150,40,28,0.5)';
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (1.05 + rng() * 0.42);
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.7 + rng() * 1.3, 0, Math.PI * 2);
    g.fill();
  }

  // wet highlight + gold mineral flecks
  g.fillStyle = 'rgba(255,226,205,0.16)';
  g.beginPath();
  g.ellipse(cx - r * 0.26, cy - r * 0.34, r * 0.3, r * 0.17, -0.7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(206,166,92,0.42)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(cx + (rng() - 0.5) * r * 1.1, cy + (rng() - 0.5) * r * 1.1, 0.5 + rng() * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Pre-rendered ink blot (hazard), feathered the way ink spreads. */
export function makeHazardSprite(r: number, seed: number): HTMLCanvasElement {
  const size = Math.ceil(r * 3.6);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const rng = makeRng(seedFromString(`hazard:${seed}`));

  const halo = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.72);
  halo.addColorStop(0, 'rgba(34,28,23,0.26)');
  halo.addColorStop(0.45, 'rgba(34,28,23,0.10)');
  halo.addColorStop(1, 'rgba(34,28,23,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  // the pour: one main mass, a few lobes, a couple of satellite specks
  const blobs: Array<{ x: number; y: number; r: number; a: number }> = [];
  blobs.push({ x: cx, y: cy, r: r * 0.92, a: 0.84 });
  const lobes = 3 + Math.floor(rng() * 3);
  for (let l = 0; l < lobes; l++) {
    const ang = rng() * Math.PI * 2;
    const d = r * (0.3 + rng() * 0.62);
    blobs.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d, r: r * (0.32 + rng() * 0.42), a: 0.76 });
  }
  for (let l = 0; l < 4; l++) {
    const ang = rng() * Math.PI * 2;
    const d = r * (0.95 + rng() * 0.5);
    blobs.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d, r: r * (0.03 + rng() * 0.05), a: 0.5 });
  }

  for (const b of blobs) {
    const grad = g.createRadialGradient(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.05, b.x, b.y, b.r * 1.12);
    grad.addColorStop(0, `rgba(30,25,21,${Math.min(0.95, b.a + 0.08)})`);
    grad.addColorStop(0.7, `rgba(24,20,17,${b.a})`);
    grad.addColorStop(1, 'rgba(24,20,17,0)');
    g.fillStyle = grad;
    const pts: Array<[number, number]> = [];
    const seg = 12;
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const rad = b.r * (0.78 + rng() * 0.4);
      pts.push([b.x + Math.cos(th) * rad, b.y + Math.sin(th) * rad]);
    }
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      const nxt = pts[(i + 1) % pts.length];
      const mx = (q[0] + nxt[0]) / 2;
      const my = (q[1] + nxt[1]) / 2;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(q[0], q[1], mx, my);
    }
    g.closePath();
    g.fill();
  }

  // a wet sheen so it does not read as a flat silhouette
  g.fillStyle = 'rgba(255,255,255,0.04)';
  g.beginPath();
  g.ellipse(cx - r * 0.28, cy - r * 0.34, r * 0.34, r * 0.17, -0.6, 0, Math.PI * 2);
  g.fill();

  // ink sinks into paper: soften the whole silhouette a touch
  const soft = document.createElement('canvas');
  soft.width = size;
  soft.height = size;
  const sg = soft.getContext('2d')!;
  sg.filter = 'blur(1.6px)';
  sg.globalAlpha = 0.94;
  sg.drawImage(c, 0, 0);
  return soft;
}

/** Pre-rendered red seal (`墨`), eroded so it reads as stamped, not printed. */
export function makeSealSprite(size: number, char = '墨'): HTMLCanvasElement {
  const pad = Math.ceil(size * 0.35);
  const c = document.createElement('canvas');
  c.width = size + pad * 2;
  c.height = size + pad * 2;
  const g = c.getContext('2d')!;
  const rng = makeRng(seedFromString(`seal:${char}:${size}`));

  const x = pad;
  const y = pad;

  g.save();
  g.translate(x + size / 2, y + size / 2);
  g.rotate(-0.035);
  g.translate(-size / 2, -size / 2);

  // stamp body
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#c0402f');
  grad.addColorStop(0.55, '#a92e21');
  grad.addColorStop(1, '#8d2418');
  g.fillStyle = grad;
  const r = size * 0.09;
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(size - r, 0);
  g.quadraticCurveTo(size, 0, size, r);
  g.lineTo(size, size - r);
  g.quadraticCurveTo(size, size, size - r, size);
  g.lineTo(r, size);
  g.quadraticCurveTo(0, size, 0, size - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();
  g.fill();

  // carved character
  g.fillStyle = 'rgba(250,244,232,0.94)';
  g.font = `${Math.round(size * 0.62)}px "KaiTi","STKaiti","楷体",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(char, size / 2, size * 0.52);

  // erosion: punch little holes back to paper colour
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 220; i++) {
    const px = rng() * size;
    const py = rng() * size;
    const rr = rng() * 1.7;
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fill();
  }
  // uneven ink at the border
  for (let i = 0; i < 90; i++) {
    const edge = Math.floor(rng() * 4);
    const t = rng() * size;
    const px = edge === 0 ? t : edge === 1 ? size - rng() * 6 : edge === 2 ? t : rng() * 6;
    const py = edge === 0 ? rng() * 6 : edge === 1 ? t : edge === 2 ? size - rng() * 6 : t;
    g.beginPath();
    g.arc(px, py, rng() * 3.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.globalCompositeOperation = 'source-over';
  return c;
}

export interface ChildOptions {
  alpha?: number;
  color?: string;
  /** eyes glow cinnabar when the shadow walks */
  eyeColor?: string;
  scale?: number;
  squash?: number;
  facing?: number;
  mood?: 'calm' | 'eager' | 'hurt';
}

/** The ink spirit: a droplet with two slits of light for eyes. */
export function drawInkChild(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, opts: ChildOptions = {}): void {
  const alpha = opts.alpha ?? 1;
  const color = opts.color ?? INK;
  const scale = opts.scale ?? 1;
  const squash = opts.squash ?? 0;
  const facing = opts.facing ?? 1;
  const bob = Math.sin(t * 3.4) * 1.6 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + bob);
  ctx.scale(facing, 1);
  ctx.transform(1 + squash * 0.16, 0, 0, 1 - squash * 0.16, 0, 0);
  ctx.scale(scale, scale);

  // ink puddle under it
  ctx.fillStyle = 'rgba(23,19,15,0.13)';
  ctx.beginPath();
  ctx.ellipse(0, 15, 11, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // body: a brush drop, heavy at the bottom
  const grad = ctx.createLinearGradient(0, -14, 0, 16);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(23,19,15,0.82)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.bezierCurveTo(9, -9, 13, 2, 10, 9);
  ctx.bezierCurveTo(7, 15, -7, 15, -10, 9);
  ctx.bezierCurveTo(-13, 2, -9, -9, 0, -15);
  ctx.closePath();
  ctx.fill();

  // tail flick
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-14, -10 + Math.sin(t * 2.2) * 2, -18, -4 + Math.sin(t * 2.2) * 3);
  ctx.stroke();

  // eyes
  const eye = opts.eyeColor ?? 'rgba(247,242,229,0.92)';
  ctx.fillStyle = eye;
  const blink = Math.max(0.15, Math.abs(Math.sin(t * 0.9)) > 0.96 ? 0.2 : 1);
  ctx.beginPath();
  ctx.ellipse(-4.2, -3.4, 1.7, 2.4 * blink, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4.0, -3.6, 1.7, 2.4 * blink, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // a faint cinnabar blush, so it reads as alive
  ctx.fillStyle = 'rgba(184,55,42,0.22)';
  ctx.beginPath();
  ctx.ellipse(-7.5, 3.2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7.5, 3.2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
