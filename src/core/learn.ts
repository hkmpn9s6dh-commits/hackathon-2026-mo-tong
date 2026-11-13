import {
  approxTourLength,
  clamp,
  dist,
  lerpVec,
  nearestNeighbourOrder,
  pointPolylineDistance,
  polylineLength,
  resample,
  smooth,
  type Vec2,
} from './geom';
import type { Level } from './levels';
import { makeRng, seedFromString, type Rng } from './rng';

/**
 * The five habits the ink shadow copies. Every value is a plain number so the
 * whole model can be unit-tested without a browser.
 */
export interface Style {
  /** path length ÷ near-optimal tour length. 1.0 = never wanders. */
  detour: number;
  /** 0 = keeps a wide berth from ink blots, 1 = grazes them. */
  hug: number;
  /** 1 = always grabs the nearest cinnabar first, 0 = takes them out of order. */
  greedy: number;
  /** 0 = a clean line, 1 = a shaky, swaying line. */
  sway: number;
  /** 0 = slow, deliberate brush, 1 = fast flicks. */
  tempo: number;
  /** how many strokes the estimate is averaged over */
  samples: number;
}

export const NEUTRAL_STYLE: Style = {
  detour: 1.12,
  hug: 0.34,
  greedy: 0.6,
  sway: 0.22,
  tempo: 0.5,
  samples: 0,
};

export type StyleSample = Omit<Style, 'samples'>;

/** Distance from a point to the nearest blot edge (negative inside a blot). */
function clearanceToHazards(p: Vec2, level: Level): number {
  let best = Infinity;
  for (const h of level.hazards) {
    const d = dist(p, h) - h.r;
    if (d < best) best = d;
  }
  return best;
}

/** Arc-length position of the stroke point closest to `p`. */
function arcPosition(p: Vec2, path: readonly Vec2[]): number {
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < path.length; i++) {
    const d = dist(p, path[i]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Read the player's habits out of one finished stroke. */
export function extractStyle(stroke: readonly Vec2[], level: Level, durationMs: number): StyleSample {
  const path = stroke.length > 1 ? stroke : [level.start, level.start];
  const length = polylineLength(path);

  const optimal = approxTourLength(level.start, level.goal, level.dots);
  const detour = clamp(length / Math.max(optimal, 1), 1, 2.8);

  let hugSum = 0;
  for (const p of path) hugSum += clamp(1 - clearanceToHazards(p, level) / 100, 0, 1);
  const hug = clamp(hugSum / path.length, 0, 1);

  const smoothed = smooth(path, 7);
  let dev = 0;
  for (let i = 1; i < path.length - 1; i++) dev += dist(path[i], smoothed[i]);
  const sway = clamp((dev / Math.max(1, path.length - 2)) / 26, 0, 1);

  // visit order of the dots, read off the stroke
  const order = level.dots.map((d) => ({ id: d.id, at: arcPosition(d, path) }));
  order.sort((a, b) => a.at - b.at);
  const actualRank = new Map<number, number>();
  order.forEach((o, i) => actualRank.set(o.id, i));
  const nn = nearestNeighbourOrder(level.start, level.dots);
  let rankError = 0;
  nn.forEach((dotIndex, rank) => {
    const id = level.dots[dotIndex].id;
    rankError += Math.abs((actualRank.get(id) ?? 0) - rank);
  });
  const maxError = Math.max(1, (level.dots.length - 1) * level.dots.length * 0.5);
  const greedy = clamp(1 - rankError / maxError, 0, 1);

  const speed = length / Math.max(durationMs, 120);
  const tempo = clamp((speed - 0.15) / 1.0, 0, 1);

  return { detour, hug, greedy, sway, tempo };
}

/** Exponential blend so one odd stroke does not rewrite the whole personality. */
export function blendStyle(prev: Style, sample: StyleSample, weight = 0.55): Style {
  const mix = (a: number, b: number) => (prev.samples === 0 ? b : a * (1 - weight) + b * weight);
  return {
    detour: mix(prev.detour, sample.detour),
    hug: mix(prev.hug, sample.hug),
    greedy: mix(prev.greedy, sample.greedy),
    sway: mix(prev.sway, sample.sway),
    tempo: mix(prev.tempo, sample.tempo),
    samples: prev.samples + 1,
  };
}

export interface ShadowPlan {
  path: Vec2[];
  /** ids of the dots the shadow will claim on its way */
  claims: number[];
}

/**
 * Turn the learned habits into a concrete route. The shadow starts from the
 * reference route of the level and bends it the way the player bends theirs.
 */
export function planShadow(level: Level, style: Style, seedSalt = 0): ShadowPlan {
  const rng: Rng = makeRng(seedFromString(`shadow:${level.id}:${seedSalt}`));

  // 1. greedy habits change which dots it goes for first
  let base: Vec2[] = level.solution.slice();
  if (style.greedy > 0.55 && level.dots.length > 2) {
    const order = nearestNeighbourOrder(level.start, level.dots);
    const keep = Math.max(2, Math.round(order.length * clamp(style.greedy, 0, 1)));
    const ctrl: Vec2[] = [level.start, ...order.slice(0, keep).map((i) => level.dots[i]), level.goal];
    base = resample(ctrl, 6);
  }

  // 2. detour: one broad bulge, proportional to how much the player wanders
  const bulge = clamp((style.detour - 1) / 1.4, 0, 1) * 150;
  if (bulge > 4) {
    const anchor = Math.floor(base.length * (0.35 + rng() * 0.3));
    const a = base[Math.max(0, anchor - 1)];
    const b = base[Math.min(base.length - 1, anchor + 1)];
    const len = Math.max(1, dist(a, b));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const sign = rng() > 0.5 ? 1 : -1;
    base = base.map((p, i) => {
      const d = Math.abs(i - anchor) / 90;
      const w = Math.exp(-d * d);
      return { x: p.x + nx * bulge * w * sign, y: p.y + ny * bulge * w * sign };
    });
  }

  // 3. hug: drift toward the nearest blot, never into it
  if (style.hug > 0.25) {
    base = base.map((p) => {
      let nearest = null as null | { x: number; y: number; r: number };
      let best = Infinity;
      for (const h of level.hazards) {
        const d = dist(p, h) - h.r;
        if (d < best) {
          best = d;
          nearest = h;
        }
      }
      if (!nearest) return p;
      const gap = best;
      const push = Math.min(style.hug * 22, Math.max(0, gap - 9));
      if (push <= 0.5) return p;
      const len = Math.max(1, dist(p, nearest));
      return { x: p.x + ((nearest.x - p.x) / len) * push, y: p.y + ((nearest.y - p.y) / len) * push };
    });
  }

  // 4. sway: the trembling hand, copied
  if (style.sway > 0.05) {
    const amp = style.sway * 9;
    const wave = 92 + rng() * 40;
    base = base.map((p, i) => {
      const prev = base[Math.max(0, i - 1)];
      const next = base[Math.min(base.length - 1, i + 1)];
      const len = Math.max(1, dist(prev, next));
      const nx = -(next.y - prev.y) / len;
      const ny = (next.x - prev.x) / len;
      const s = Math.sin((i / base.length) * Math.PI * 2 * (polylineLength(base) / wave));
      return { x: p.x + nx * amp * s, y: p.y + ny * amp * s };
    });
  }

  const path = resample(smooth(base, 5), 5);

  // 5. which dots it takes: the ones closest to its route, capped so the level
  //    always stays winnable (a game-design guard, not a model assumption)
  const cap = Math.max(1, Math.floor(level.dots.length * 0.4));
  const scored = level.dots
    .map((d) => ({ id: d.id, d: pointPolylineDistance(d, path) }))
    .filter((x) => x.d < 15)
    .sort((a, b) => a.d - b.d)
    .slice(0, cap);

  return { path, claims: scored.map((s) => s.id) };
}

export interface Trait {
  key: keyof StyleSample;
  label: string;
  value: number;
  /** the word shown next to the bar */
  word: string;
}

/** Two or three plain-language traits for the HUD. */
export function describeStyle(style: Style): Trait[] {
  const traits: Trait[] = [
    {
      key: 'detour',
      label: '绕远',
      value: clamp((style.detour - 1) / 1.2, 0, 1),
      word: style.detour > 1.42 ? '爱绕路' : style.detour > 1.22 ? '会兜圈' : '走直线',
    },
    {
      key: 'hug',
      label: '贴边',
      value: clamp(style.hug, 0, 1),
      word: style.hug > 0.55 ? '敢贴墨' : style.hug > 0.32 ? '略谨慎' : '留余量',
    },
    {
      key: 'greedy',
      label: '贪近',
      value: clamp(style.greedy, 0, 1),
      word: style.greedy > 0.7 ? '先拿近的' : style.greedy > 0.45 ? '顺手就取' : '先远后近',
    },
    {
      key: 'sway',
      label: '摆幅',
      value: clamp(style.sway, 0, 1),
      word: style.sway > 0.45 ? '手很活' : style.sway > 0.22 ? '有点抖' : '笔很稳',
    },
  ];
  return traits;
}

/** Kept for the HUD: which two traits are the loudest. */
export function loudestTraits(style: Style, count = 2): Trait[] {
  return describeStyle(style)
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Position along a polyline at normalised arc length u ∈ [0,1]. */
export function pointAt(path: readonly Vec2[], u: number): Vec2 {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  const total = polylineLength(path);
  let target = clamp(u, 0, 1) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (target <= seg) return lerpVec(path[i - 1], path[i], seg === 0 ? 0 : target / seg);
    target -= seg;
  }
  return path[path.length - 1];
}
