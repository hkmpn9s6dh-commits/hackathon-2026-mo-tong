import { describe, expect, it } from 'vitest';
import {
  approxTourLength,
  catmullRom,
  dist,
  pointPolylineDistance,
  polylineLength,
  resample,
  sampleAlong,
  type Vec2,
} from '../src/core/geom';
import { buildAllLevels, buildLevel, DOT_R, LEVEL_PLAN } from '../src/core/levels';
import { blendStyle, extractStyle, NEUTRAL_STYLE, planShadow } from '../src/core/learn';
import { blockedByHazard, evaluateStroke, scoreLevel } from '../src/core/stroke';

const line = (n = 40, len = 600): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: 100 + (len * i) / n, y: 300 }));

const wiggle = (n = 120, len = 600, amp = 40): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: 100 + len * t, y: 300 + Math.sin(t * Math.PI * 8) * amp };
  });

describe('geometry', () => {
  it('measures a polyline', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5, 6);
  });

  it('measures distance to a polyline', () => {
    const path = line(4, 100);
    expect(pointPolylineDistance({ x: 150, y: 310 }, path)).toBeCloseTo(10, 6);
  });

  it('resamples to a fixed spacing and keeps the ends', () => {
    const pts = resample(wiggle(), 5);
    expect(pts.length).toBeGreaterThan(100);
    expect(dist(pts[0], { x: 100, y: 300 })).toBeLessThan(1);
    expect(dist(pts[pts.length - 1], { x: 700, y: 300 })).toBeLessThan(1.5);
  });

  it('samples evenly across a spline', () => {
    const path = catmullRom([{ x: 0, y: 0 }, { x: 100, y: 60 }, { x: 200, y: 0 }], 4);
    const pts = sampleAlong(path, 10);
    expect(pts).toHaveLength(10);
    expect(dist(pts[0], { x: 0, y: 0 })).toBeLessThan(2);
    expect(dist(pts[9], { x: 200, y: 0 })).toBeLessThan(2);
  });

  it('approximates an open tour through every point', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const len = approxTourLength({ x: -100, y: 0 }, { x: 200, y: 100 }, pts);
    expect(len).toBeGreaterThan(300);
    expect(len).toBeLessThan(600);
  });
});

describe('levels', () => {
  const levels = buildAllLevels();

  it('builds every planned level deterministically', () => {
    expect(levels).toHaveLength(LEVEL_PLAN.length);
    const again = buildAllLevels();
    levels.forEach((l, i) => {
      expect(l.dots).toHaveLength(LEVEL_PLAN[i].dots);
      expect(l.solution[0]).toEqual(again[i].solution[0]);
      expect(l.hazards.map((h) => h.id)).toEqual(again[i].hazards.map((h) => h.id));
    });
  });

  it('keeps every reference route solvable, inside the ink budget', () => {
    for (const level of levels) {
      const result = evaluateStroke(level.solution, level, new Set());
      expect(result.dots, `level ${level.id} dots`).toHaveLength(level.dots.length);
      expect(result.reachedGoal, `level ${level.id} goal`).toBe(true);
      expect(result.withinBudget, `level ${level.id} budget`).toBe(true);
      expect(result.complete, `level ${level.id} complete`).toBe(true);
    }
  });

  it('never puts a blot on the reference route', () => {
    for (const level of levels) {
      for (const h of level.hazards) {
        expect(pointPolylineDistance(h, level.solution)).toBeGreaterThan(h.r + 20);
      }
    }
  });

  it('keeps dots on the route and away from blots', () => {
    for (const level of levels) {
      for (const d of level.dots) {
        expect(pointPolylineDistance(d, level.solution)).toBeLessThan(30);
        for (const h of level.hazards) {
          expect(dist(d, h)).toBeGreaterThan(h.r + DOT_R);
        }
      }
    }
  });

  it('gives the later levels less slack', () => {
    expect(levels[0].inkBudget / polylineLength(levels[0].solution)).toBeGreaterThan(
      levels[levels.length - 1].inkBudget / polylineLength(levels[levels.length - 1].solution),
    );
  });

  it('builds the same level from the same seed', () => {
    const a = buildLevel(LEVEL_PLAN[2]);
    const b = buildLevel(LEVEL_PLAN[2]);
    expect(a.dots.map((d) => [Math.round(d.x), Math.round(d.y)])).toEqual(b.dots.map((d) => [Math.round(d.x), Math.round(d.y)]));
    expect(a.hazards.map((h) => Math.round(h.r))).toEqual(b.hazards.map((h) => Math.round(h.r)));
  });
});

describe('stroke rules', () => {
  const level = buildLevel(LEVEL_PLAN[1]);

  it('blocks a move that would drag the brush through a blot', () => {
    const h = level.hazards[0];
    expect(blockedByHazard({ x: h.x - h.r - 30, y: h.y }, { x: h.x + h.r + 30, y: h.y }, level)).toBe(true);
    expect(blockedByHazard({ x: 200, y: 120 }, { x: 240, y: 120 }, level)).toBe(false);
  });

  it('does not count a stroke that stops short of the seal', () => {
    const short = level.solution.slice(0, Math.floor(level.solution.length * 0.6));
    expect(evaluateStroke(short, level, new Set()).complete).toBe(false);
  });

  it('does not count a stroke that misses a dot', () => {
    const shortcut = [level.start, { x: level.goal.x, y: level.goal.y }];
    expect(evaluateStroke(shortcut, level, new Set()).complete).toBe(false);
  });

  it('treats dots claimed by the shadow as already gone', () => {
    const claimed = new Set([level.dots[0].id]);
    const result = evaluateStroke(level.solution, level, claimed);
    expect(result.dots).not.toContain(level.dots[0].id);
    expect(result.dots).toHaveLength(level.dots.length - 1);
    expect(result.complete).toBe(true);
  });

  it('scores a tidy stroke above a wasteful one', () => {
    const tidy = evaluateStroke(level.solution, level, new Set());
    const wasteful = evaluateStroke([{ x: 110, y: 640 }, ...level.solution], level, new Set());
    expect(scoreLevel(tidy, level, 0)).toBeGreaterThan(scoreLevel(wasteful, level, 0));
  });
});

describe('the shadow learns', () => {
  const level = buildLevel(LEVEL_PLAN[3]);

  it('reads a straight, steady stroke as low detour and low sway', () => {
    const straight = level.solution;
    const s = extractStyle(straight, level, 4000);
    expect(s.detour).toBeLessThan(1.25);
    expect(s.sway).toBeLessThan(0.15);
  });

  it('reads a shaky, wandering stroke as high detour and high sway', () => {
    const messy: Vec2[] = [];
    level.solution.forEach((p, i) => {
      messy.push(p);
      if (i % 3 === 0) messy.push({ x: p.x + Math.sin(i) * 26, y: p.y + Math.cos(i * 1.7) * 26 });
    });
    const s = extractStyle(messy, level, 2500);
    expect(s.detour).toBeGreaterThan(1.2);
    expect(s.sway).toBeGreaterThan(0.1);
  });

  it('blends new evidence into the old habits', () => {
    const prev = { ...NEUTRAL_STYLE, samples: 3, detour: 1.0 };
    const next = blendStyle(prev, { detour: 2.0, hug: 0.5, greedy: 0.5, sway: 0.5, tempo: 0.5 }, 0.5);
    expect(next.detour).toBeCloseTo(1.5, 5);
    expect(next.samples).toBe(4);
  });

  it('lets the first stroke define the personality outright', () => {
    const first = blendStyle(NEUTRAL_STYLE, { detour: 1.9, hug: 0.9, greedy: 0.2, sway: 0.8, tempo: 0.9 });
    expect(first.detour).toBeCloseTo(1.9, 5);
    expect(first.samples).toBe(1);
  });

  it('makes a wandering shadow walk a longer route', () => {
    const tidy = planShadow(level, { ...NEUTRAL_STYLE, detour: 1.0, sway: 0, hug: 0 });
    const messy = planShadow(level, { ...NEUTRAL_STYLE, detour: 2.4, sway: 0.9, hug: 0.9 });
    expect(polylineLength(messy.path)).toBeGreaterThan(polylineLength(tidy.path));
  });

  it('never lets the shadow take more than 40 % of the dots', () => {
    const greedy = planShadow(level, { ...NEUTRAL_STYLE, greedy: 1, detour: 2.6, sway: 1, hug: 1 });
    expect(greedy.claims.length).toBeLessThanOrEqual(Math.floor(level.dots.length * 0.4));
  });

  it('is deterministic for the same level and habits', () => {
    const a = planShadow(level, NEUTRAL_STYLE, 3);
    const b = planShadow(level, NEUTRAL_STYLE, 3);
    expect(a.path.length).toBe(b.path.length);
    expect(a.claims).toEqual(b.claims);
  });
});
