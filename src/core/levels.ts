import { catmullRom, dist, lerp, lerpVec, polylineLength, sampleAlong, type Vec2 } from './geom';
import { makeRng, seedFromString, type Rng } from './rng';

export const BOARD = { x0: 78, y0: 86, x1: 992, y1: 674 } as const;
export const DOT_R = 21;
export const GOAL_R = 44;
export const BRUSH_R = 8;

export interface Dot {
  x: number;
  y: number;
  r: number;
  /** stable id used by the shadow's claim bookkeeping */
  id: number;
}

export interface Hazard {
  x: number;
  y: number;
  r: number;
  id: number;
  /** per-blot shape seed so the renderer draws the same blob every frame */
  seed: number;
}

export interface Level {
  id: number;
  name: string;
  subtitle: string;
  start: Vec2;
  goal: { x: number; y: number; r: number };
  dots: Dot[];
  hazards: Hazard[];
  inkBudget: number;
  /** reference path used by the auto-draw demo and by the shadow generator */
  solution: Vec2[];
  /** true when the ink shadow plays before the player */
  shadow: boolean;
  hint: string;
}

export interface LevelOptions {
  id: number;
  name: string;
  subtitle: string;
  hint: string;
  dots: number;
  hazards: number;
  shadow?: boolean;
  wiggleAmp?: number;
  budgetFactor?: number;
  seed: string;
}

function insideBoard(p: Vec2, pad = 0): boolean {
  return p.x > BOARD.x0 + pad && p.x < BOARD.x1 - pad && p.y > BOARD.y0 + pad && p.y < BOARD.y1 - pad;
}

function buildControlPoints(rng: Rng, start: Vec2, goal: Vec2, dotCount: number, wiggleAmp: number): Vec2[] {
  const ctrl: Vec2[] = [{ ...start }];
  const steps = dotCount + 1;
  // one smooth undulation (sometimes two) instead of per-point randomness:
  // the reference route should read as a brush line, not as a scribble.
  const waves = 1 + Math.floor(rng() * 2);
  const phase = rng() * Math.PI * 2;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const base = lerpVec(start, goal, t);
    const taper = Math.sin(t * Math.PI);
    const lateral = Math.sin(t * Math.PI * waves + phase) * wiggleAmp * taper;
    let p = { x: base.x, y: base.y + lateral };
    if (!insideBoard(p, 46)) p = { x: base.x, y: lerp(start.y, goal.y, t) };
    ctrl.push(p);
  }
  ctrl.push({ ...goal });
  return ctrl;
}

function makeHazards(
  rng: Rng,
  count: number,
  solution: readonly Vec2[],
  dots: readonly Dot[],
  start: Vec2,
  goal: { x: number; y: number },
): Hazard[] {
  const out: Hazard[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 3000) {
    const r = 30 + rng() * 18;
    const p = {
      x: lerp(BOARD.x0 + 30, BOARD.x1 - 30, rng()),
      y: lerp(BOARD.y0 + 30, BOARD.y1 - 30, rng()),
    };
    let ok = true;
    for (const s of solution) {
      if (dist(p, s) < r + 40) {
        ok = false;
        break;
      }
    }
    if (ok) for (const d of dots) if (dist(p, d) < r + 62) ok = false;
    if (ok) {
      if (dist(p, start) < r + 74) ok = false;
      if (dist(p, goal) < r + 74) ok = false;
    }
    if (ok) for (const h of out) if (dist(p, h) < r + h.r + 40) ok = false;
    if (!ok) continue;
    out.push({ x: p.x, y: p.y, r, id: out.length, seed: Math.floor(rng() * 1e9) });
  }
  return out;
}

export function buildLevel(opts: LevelOptions): Level {
  const rng = makeRng(seedFromString(opts.seed));
  const start: Vec2 = { x: lerp(BOARD.x0 + 34, 236, rng()), y: lerp(250, 530, rng()) };
  const goal = {
    x: lerp(830, BOARD.x1 - 46, rng()),
    y: lerp(210, 560, rng()),
    r: GOAL_R,
  };

  const ctrl = buildControlPoints(rng, start, goal, opts.dots, opts.wiggleAmp ?? 150);
  const solution = sampleAlong(catmullRom(ctrl, 5), opts.dots * 24 + 90);

  // dots sit on the reference path, nudged a little so they do not look stamped
  const anchors = sampleAlong(solution, opts.dots + 2).slice(1, opts.dots + 1);
  const dots: Dot[] = anchors.map((p, i) => ({
    x: p.x + (rng() * 2 - 1) * 10,
    y: p.y + (rng() * 2 - 1) * 10,
    r: DOT_R,
    id: i,
  }));

  const hazards = makeHazards(rng, opts.hazards, solution, dots, start, goal);
  const pathLen = polylineLength(solution);
  const inkBudget = Math.round(pathLen * (opts.budgetFactor ?? 1.32) + 70);

  return {
    id: opts.id,
    name: opts.name,
    subtitle: opts.subtitle,
    start,
    goal,
    dots,
    hazards,
    inkBudget,
    solution,
    shadow: opts.shadow ?? false,
    hint: opts.hint,
  };
}

export const LEVEL_PLAN: LevelOptions[] = [
  {
    id: 1,
    name: '入院',
    subtitle: '起笔',
    hint: '按住拖动落笔：一笔连起所有朱砂，收在印上。',
    dots: 3,
    hazards: 2,
    seed: 'mo-tong-1',
    budgetFactor: 1.55,
    wiggleAmp: 62,
  },
  {
    id: 2,
    name: '拾朱',
    subtitle: '第一手感',
    hint: '墨渍碰不得——笔到边上就停住。',
    dots: 4,
    hazards: 4,
    seed: 'mo-tong-2',
    budgetFactor: 1.42,
    wiggleAmp: 82,
  },
  {
    id: 3,
    name: '绕石',
    subtitle: '绕路',
    hint: '笔路可以回撤，别急着一次画到底。',
    dots: 5,
    hazards: 6,
    seed: 'mo-tong-3',
    budgetFactor: 1.36,
    wiggleAmp: 96,
  },
  {
    id: 4,
    name: '影初',
    subtitle: '它醒了',
    hint: '墨影先走一步。它学的就是你上一关的走法。',
    dots: 5,
    hazards: 6,
    shadow: true,
    seed: 'mo-tong-4',
    budgetFactor: 1.34,
    wiggleAmp: 104,
  },
  {
    id: 5,
    name: '贴边',
    subtitle: '险路',
    hint: '它爱贴着你贴过的边。',
    dots: 6,
    hazards: 8,
    shadow: true,
    seed: 'mo-tong-5',
    budgetFactor: 1.3,
    wiggleAmp: 112,
  },
  {
    id: 6,
    name: '逆笔',
    subtitle: '倒着来',
    hint: '先收远的，再回近的——看它学不学得会。',
    dots: 6,
    hazards: 9,
    shadow: true,
    seed: 'mo-tong-6',
    budgetFactor: 1.24,
    wiggleAmp: 120,
  },
  {
    id: 7,
    name: '对影',
    subtitle: '终局',
    hint: '它已经全会了。这一局，跟自己的习惯比。',
    dots: 7,
    hazards: 10,
    shadow: true,
    seed: 'mo-tong-7',
    budgetFactor: 1.2,
    wiggleAmp: 126,
  },
];

export function buildAllLevels(): Level[] {
  return LEVEL_PLAN.map(buildLevel);
}
