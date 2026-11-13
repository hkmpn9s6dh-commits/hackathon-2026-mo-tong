import { dist, pointSegmentDistance, pointPolylineDistance, polylineLength, type Vec2 } from './geom';
import { BRUSH_R, type Level } from './levels';

/** True when segment `a→b` comes within `r` of `c`. */
export function segmentHitsCircle(a: Vec2, b: Vec2, c: Vec2, r: number): boolean {
  return pointSegmentDistance(c, a, b) <= r;
}

/** True when moving from `a` to `b` would drag the brush through a blot. */
export function blockedByHazard(a: Vec2, b: Vec2, level: Level): boolean {
  for (const h of level.hazards) {
    if (segmentHitsCircle(a, b, h, h.r + BRUSH_R * 0.55)) return true;
  }
  return false;
}

export interface StrokeResult {
  points: Vec2[];
  length: number;
  /** ids of the cinnabar dots this stroke touches */
  dots: number[];
  reachedGoal: boolean;
  withinBudget: boolean;
  complete: boolean;
}

export function evaluateStroke(points: readonly Vec2[], level: Level, claimed: ReadonlySet<number>): StrokeResult {
  const length = polylineLength(points);
  const touched: number[] = [];
  for (const d of level.dots) {
    if (claimed.has(d.id)) continue;
    if (pointPolylineDistance(d, points) <= d.r + BRUSH_R * 0.7) touched.push(d.id);
  }
  const last = points[points.length - 1];
  const reachedGoal = last ? dist(last, level.goal) <= level.goal.r : false;
  const withinBudget = length <= level.inkBudget + 0.5;
  const allDots = level.dots.filter((d) => !claimed.has(d.id)).length;
  return {
    points: points as Vec2[],
    length,
    dots: touched,
    reachedGoal,
    withinBudget,
    complete: touched.length === allDots && reachedGoal && withinBudget,
  };
}

/** Round-trip score used on the result card; kept small and explainable. */
export function scoreLevel(result: StrokeResult, level: Level, shadowTaken: number): number {
  const base = result.dots.length * 100;
  const sealBonus = result.reachedGoal ? 120 : 0;
  const inkLeft = Math.max(0, level.inkBudget - result.length);
  const thrift = Math.round((inkLeft / Math.max(1, level.inkBudget)) * 60);
  const rivalry = shadowTaken > 0 ? shadowTaken * 25 : 0;
  return base + sealBonus + thrift + rivalry;
}
